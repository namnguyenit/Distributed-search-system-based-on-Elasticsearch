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
    tags: [{
        type: String,
        trim: true
    }],
    brand: {
        type: String,
        trim: true,
        index: true
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

productSchema.pre('save', function(next) {
    if (this.isModified()) {
        this.updatedAt = Date.now();
    }
    next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;