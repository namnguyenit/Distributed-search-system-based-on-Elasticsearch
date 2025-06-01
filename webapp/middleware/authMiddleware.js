const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/userModel');
const SearchHistory = require('../models/searchHistoryModel');
exports.isAuthenticated = (req, res, next) => {
    console.log('isAuthenticated session:', req.session.user);
    if (req.session && req.session.user) {
        return next();
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Không thể xác minh. Không tìm thấy token được cung cấp' });
        }
        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            User.findById(decoded.id).select('-password').then(user => {
                if (!user) {
                    return res.status(401).json({ message: 'Không tìm thấy người dùng' });
                }
                req.user = user;
                return next();
            }).catch(err => {
                console.error("Lỗi khi tìm kiếm người dùng bằng token ID:", err);
                return res.status(500).json({ message: "Error verifying authentication." });
            });
        } catch (err) {
            console.error("Lỗi xác thực JWT", err.message);
            return res.status(401).json({ message: 'Chưa xác thực. Token không hợp lệ' });
        }
    } else {

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ message: 'Chưa xác thực.' });
        }
        return res.redirect('/auth/login');
    }
};

// Middleware kiểm tra xem người dùng có phải là admin không
exports.isAdmin = (req, res, next) => {
    const userForCheck = req.user || (req.session && req.session.user);
    console.log('isAdmin check:', userForCheck);
    if (userForCheck && userForCheck.role === 'admin') {
        return next();
    }
    return res.redirect('/');
};