// webapp/controllers/authController.js
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken'); 
// const config = require('../config');


exports.getLoginPage = (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', {
        title: 'Đăng nhập',
        error: null
    });
};


exports.postLogin = async (req, res) => {
    const { username, password } = req.body;
    // Nếu là admin/admin123 thì luôn cho đăng nhập và đảm bảo user này tồn tại, role là admin
    if (username === 'admin' && password === 'admin123') {
        let user = await User.findOne({ username: 'admin' });
        if (!user) {
            user = new User({ username: 'admin', password: 'admin123', role: 'admin', email: 'admin@example.com' });
            await user.save();
        } else {
            if (user.role !== 'admin') {
                user.role = 'admin';
                await user.save();
            }
            if (user.password !== 'admin123') {
                user.password = 'admin123';
                await user.save();
            }
            if (user.email !== 'admin@example.com') {
                user.email = 'admin@example.com';
                await user.save();
            }
        }
        req.session.user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        };
        return res.redirect('/admin/dashboard');
    }
    // Các tài khoản khác: xác thực như bình thường
    try {
        const user = await User.findOne({
            $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }]
        });
        if (!user) {
            return res.render('login', {
                title: 'Đăng nhập',
                error: 'Tên đăng nhập hoặc mật khẩu không đúng.'
            });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('login', {
                title: 'Đăng nhập',
                error: 'Tên đăng nhập hoặc mật khẩu không đúng.'
            });
        }
        req.session.user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        };
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/');
        }
    } catch (error) {
        res.render('login', {
            title: 'Đăng nhập',
            error: 'Đã có lỗi xảy ra. Vui lòng thử lại.'
        });
    }
};

exports.getRegisterPage = (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('register', {
        title: 'Đăng ký',
        error: null,
        inputData: {}
    });
};


exports.postRegister = async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.render('register', {
            title: 'Đăng ký',
            error: 'Mật khẩu và xác nhận mật khẩu không khớp.',
            inputData: { username, email }
        });
    }

    try {

        const existingUser = await User.findOne({
            $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
        });

        if (existingUser) {
            let errorMessage = '';
            if (existingUser.username === username.toLowerCase()) {
                errorMessage = 'Tên đăng nhập đã được sử dụng.';
            } else {
                errorMessage = 'Email đã được sử dụng.';
            }
            return res.render('register', {
                title: 'Đăng ký',
                error: errorMessage,
                inputData: { username, email }
            });
        }


        const newUser = new User({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: password
        });

        await newUser.save();

        req.session.user = {
            _id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role 
        };


        res.redirect('/');

    } catch (error) {
        // console.error("Lỗi đăng ký:", error);
        // Xử lý lỗi validation từ Mongoose (nếu có)
        if (error.name === 'ValidationError') {
            let errors = {};
            for (field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            // Bạn có thể muốn hiển thị các lỗi này chi tiết hơn trên form
            return res.render('register', {
                title: 'Đăng ký',
                error: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
                inputData: { username, email }
            });
        }
        res.render('register', {
            title: 'Đăng ký',
            error: 'Đã có lỗi xảy ra trong quá trình đăng ký.',
            inputData: { username, email }
        });
    }
};


exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            // console.error("Lỗi khi đăng xuất:", err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); 
        res.redirect('/auth/login');
    });
};

