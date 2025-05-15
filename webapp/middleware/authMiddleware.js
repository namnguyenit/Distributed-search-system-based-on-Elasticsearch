const jwt = require('jsonwebtoken');
    const config = require('../config');
    const User = require('../models/userModel');
    const SearchHistory = require('../models/searchHistoryModel');
    exports.isAuthenticated = (req, res, next) => {
        if (req.session && req.session.user) {
            return next();
        }
        // Nếu không có session, kiểm tra JWT token (nếu bạn dùng API token-based)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({ message: 'Không thể xác minh. Không tìm thấy token được cung cấp' });
            }
            try {
                const decoded = jwt.verify(token, config.jwtSecret);
                // Gắn thông tin user vào request để các controller sau có thể sử dụng
                // Bạn có thể muốn tìm user trong DB ở đây để đảm bảo user còn tồn tại và thông tin là mới nhất
                User.findById(decoded.id).select('-password').then(user => {
                    if (!user) {
                        return res.status(401).json({ message: 'Không tìm thấy người dùng' });
                    }
                    req.user = user; // Gắn object user đầy đủ
                    return next();
                }).catch(err => {
                    console.error("Error finding user by token ID:", err);
                    return res.status(500).json({ message: "Error verifying authentication." });
                });
            } catch (err) {
                console.error("JWT Verification Error:", err.message);
                return res.status(401).json({ message: 'Not authenticated. Invalid token.' });
            }
        } else {
            // Đối với web app dùng EJS, thường sẽ redirect về trang login
            res.redirect('/auth/login');
            // Đối với API, trả về lỗi JSON
            return res.status(401).json({ message: 'Not authenticated. Please log in.'});
        }
    };

    // Middleware kiểm tra xem người dùng có phải là admin không
    exports.isAdmin = (req, res, next) => {
        // Phải gọi isAuthenticated trước middleware này
        const userForCheck = req.user || (req.session && req.session.user);

        if (userForCheck && userForCheck.role === 'admin') {
            return next();
        }
        // Đối với web app dùng EJS
        req.flash('error_msg', 'You are not authorized to view this resource.');
        return res.redirect('/');
        // Đối với API
        return res.status(403).json({ message: 'Forbidden. Admin access required.' });
    };