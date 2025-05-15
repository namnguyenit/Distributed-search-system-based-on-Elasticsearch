const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { isAuthenticated } = require('../middleware/authMiddleware'); // Để lưu lịch sử tìm kiếm

    // API endpoint: GET /api/search/products?q=keyword&page=1&limit=10
router.get('/products', isAuthenticated, searchController.searchProducts);

    // API endpoint: GET /api/search/suggestions?index=products&field=name.suggest&prefix=key
router.get('/suggestions', searchController.getSuggestions);

    // API endpoint: GET /api/search/history (cho user đã đăng nhập)
router.get('/history', isAuthenticated, searchController.getUserSearchHistory);

module.exports = router;