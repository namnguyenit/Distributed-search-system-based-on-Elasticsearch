// Trong webapp/controllers/productController.js giả định của bạn

const Product = require('../models/productModel');
const esService = require('../services/elasticsearchService');

exports.createProduct = async (req, res) => {
    try {
        const newProductData = req.body; // { name, description, price, ... }
        const product = new Product(newProductData);
        await product.save(); // Đã lưu vào MongoDB

        // Bây giờ index nó trong Elasticsearch
        await esService.indexProduct(product);

        res.status(201).json({ message: 'Product created and indexed successfully', product });
    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ message: 'Failed to create product', error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const productId = req.params.productId;
        const updatedData = req.body;
        updatedData.updatedAt = new Date(); // Đảm bảo updatedAt là hiện tại

        const product = await Product.findByIdAndUpdate(productId, updatedData, { new: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found in MongoDB' });
        }

        // Bây giờ cập nhật nó trong Elasticsearch
        // Chuẩn bị dữ liệu cho ES (chỉ gửi các trường mà ES mong đợi hoặc đã thay đổi)
        const esProductData = {
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            tags: product.tags,
            imageUrl: product.imageUrl,
            stock: product.stock,
            updatedAt: product.updatedAt
        };
        await esService.updateProductInES(productId, esProductData);

        res.status(200).json({ message: 'Product updated in MongoDB and Elasticsearch successfully', product });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: 'Failed to update product', error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await Product.findByIdAndDelete(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found in MongoDB' });
        }

        // Bây giờ xóa nó khỏi Elasticsearch
        await esService.deleteProductFromES(productId);

        res.status(200).json({ message: 'Product deleted from MongoDB and Elasticsearch successfully' });
    } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ message: 'Failed to delete product', error: error.message });
    }
};