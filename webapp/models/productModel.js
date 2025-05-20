// webapp/models/productModel.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên sản phẩm là bắt buộc'],
        trim: true,
        index: true
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Giá sản phẩm là bắt buộc'],
        min: 0
    },
    category: {
        type: String,
        trim: true,
        index: true
    },
    tags: [{ // [VIETNAMESE_COMMENT: Giữ nguyên 'tags' vì đã thảo luận ở bước trước]
        type: String,
        trim: true
    }],
    brand: { // FIX: Thêm trường brand
        type: String,
        trim: true,
        index: true // Đánh index nếu bạn thường xuyên truy vấn theo brand trong MongoDB
    },
    imageUrl: {
        type: String,
        trim: true
    },
    stock: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware để cập nhật trường `updatedAt` trước khi lưu
productSchema.pre('save', function(next) {
    if (this.isModified()) {
        this.updatedAt = Date.now();
    }
    next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;