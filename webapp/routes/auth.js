// webapp/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Bạn cần tạo file controller này

// Trang hiển thị form đăng nhập (GET)
router.get('/login', authController.getLoginPage);

// Xử lý yêu cầu đăng nhập (POST)
router.post('/login', authController.postLogin);

// Trang hiển thị form đăng ký (GET)
router.get('/register', authController.getRegisterPage);

// Xử lý yêu cầu đăng ký (POST)
router.post('/register', authController.postRegister);

// Xử lý yêu cầu đăng xuất (GET hoặc POST)
router.get('/logout', authController.logout); // Hoặc postLogout nếu bạn muốn dùng POST

module.exports = router;