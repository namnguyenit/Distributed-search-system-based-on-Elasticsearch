const express = require('express');
const path = require('path');
const morgan = require('morgan');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const config = require('./config'); 
const Product = require('./models/productModel');
const { indexProduct, createProductIndex, bulkIndexProducts  } = require('./services/elasticsearchService');

// đẩy các route vào
const mainRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const searchApiRoutes = require('./routes/search'); 
const adminApiRoutes = require('./routes/admin');   

const app = express();

// --- Kết nối MongoDB ---
mongoose.connect(config.mongoURI)
    .then(() => {
        console.log('MongoDB Connected Successfully!')
        initialSyncMongoToES();
    })
    .catch(err => console.error('MongoDB Connection Error:', err));

// --- Middleware ---
app.use(morgan('dev')); // Logging HTTP requests trong console
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: config.mongoURI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

// Đặt middleware này NGAY SAU session
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user; 
    res.locals.isAuthenticated = !!req.session.user;
    res.locals.isAdmin = req.session.user ? req.session.user.role === 'admin' : false;
    next();
});

// Thiết lập EJS làm view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(express.static(path.join(__dirname, 'public')));


// --- Routes ---
app.use('/admin', adminApiRoutes);
app.use('/', mainRoutes); // Routes cho các trang chính (trang chủ, giới thiệu,...)
app.use('/auth', authRoutes); // Routes cho đăng nhập, đăng ký
app.use('/api/search', searchApiRoutes); // API Routes cho chức năng tìm kiếm
app.use('/api/admin', adminApiRoutes);   // API Routes cho chức năng admin

app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Page Not Found' }); // Tạo file views/404.ejs
});

app.use((error, req, res, next) => {
    console.error("Global Error Handler:", error);
    res.status(error.status || 500);
    res.render('error', { 
        title: 'Error',
        message: error.message,
        error: process.env.NODE_ENV === 'development' ? error : {}
    });
});

app.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
    console.log(`Connecting to Elasticsearch via: ${config.elasticsearchHost}`);
    console.log(`Connecting to MongoDB via: ${config.mongoURI}`);
});

// --- Hàm đồng bộ hóa ban đầu dữ liệu từ MongoDB sang Elasticsearch ---
async function initialSyncMongoToES() {
    console.log('Starting initial sync from MongoDB to Elasticsearch...');
    try {
        // Đảm bảo index tồn tại và có mapping chính xác
        await createProductIndex(); // Hàm này cũng sẽ log nếu index đã tồn tại

        const products = await Product.find({});
        if (products.length === 0) {
            console.log('No products found in MongoDB to sync.');
            return;
        }
        console.log(`Found ${products.length} products in MongoDB. Starting bulk indexing...`);
        await bulkIndexProducts(products); // Sử dụng bulk thay vì for...await
        console.log('Initial sync completed successfully.');
    } catch (error) {
        console.error('Error during initial sync:', error);
    }
}