
const express = require('express');
const router = express.Router();
const esService = require('../services/elasticsearchService'); // Nếu cần tìm kiếm từ server-side
const SearchHistory = require('../models/searchHistoryModel');
const { isAuthenticated } = require('../middleware/authMiddleware'); // Để lấy lịch sử

// Trang chủ
router.get('/', (req, res) => {
    // Bạn có thể truyền thêm dữ liệu vào trang chủ nếu cần
    res.render('index', {
        title: 'Trang chủ Tìm kiếm'
        // isAuthenticated: req.session.user ? true : false, // Đã có trong res.locals
        // currentUser: req.session.user, // Đã có trong res.locals
        // isAdmin: req.session.user && req.session.user.role === 'admin' // Đã có trong res.locals
    });
});

// Trang hiển thị kết quả tìm kiếm (nếu bạn render từ server)
// Nếu bạn đã xử lý tìm kiếm hoàn toàn bằng API và JS phía client, route này có thể không cần thiết
// hoặc chỉ đơn giản là render một trang EJS rồi JS client sẽ gọi API.
// Ví dụ này giả sử controller search sẽ xử lý logic và render.
router.get('/search', async (req, res, next) => {
    const query = req.query.q;
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Số sản phẩm mỗi trang
    const from = (page - 1) * limit;

    if (!query) {
        // Có thể redirect về trang chủ hoặc hiển thị thông báo
        return res.redirect('/');
    }

    try {
        const esResults = await esService.searchProducts('products', query, from, limit);

        // Lưu lịch sử tìm kiếm nếu người dùng đã đăng nhập
        if (req.session.user) {
            const history = new SearchHistory({
                userId: req.session.user._id, // Hoặc req.user.id tùy cách bạn lưu
                query: query,
                resultsCount: esResults.total.value,
            });
            await history.save().catch(err => console.error("Lỗi khi lưu lịch sử tìm kiếm:", err));
        }

        res.render('search-results', {
            title: `Kết quả cho "${query}"`,
            query: query,
            results: esResults.hits, // Mảng các document sản phẩm
            total: esResults.total.value,
            currentPage: page,
            totalPages: Math.ceil(esResults.total.value / limit)
        });
    } catch (error) {
        console.error('Lỗi khi thực hiện tìm kiếm từ server-side:', error);
        next(error); // Chuyển lỗi cho global error handler
    }
});

// Trang lịch sử tìm kiếm của người dùng
router.get('/history', isAuthenticated, async (req, res, next) => {
    try {
        const userId = req.session.user._id; // Hoặc req.user.id
        const userHistory = await SearchHistory.find({ userId: userId })
            .sort({ timestamp: -1 })
            .limit(50); // Giới hạn số lượng hiển thị

        res.render('history', {
            title: 'Lịch sử tìm kiếm của bạn',
            history: userHistory
        });
    } catch (error) {
        console.error('Lỗi khi lấy lịch sử tìm kiếm:', error);
        next(error);
    }
});


// (Tùy chọn) Các trang tĩnh khác như /about, /contact
// router.get('/about', (req, res) => {
//     res.render('about', { title: 'Về chúng tôi' });
// });

module.exports = router;