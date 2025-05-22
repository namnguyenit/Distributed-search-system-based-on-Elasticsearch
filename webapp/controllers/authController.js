// webapp/controllers/authController.js
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken'); // Nếu bạn dùng JWT cho API, nhưng ở đây đang dùng session
// const config = require('../config');

// Hiển thị trang đăng nhập
exports.getLoginPage = (req, res) => {
    if (req.session.user) { // Nếu đã đăng nhập, chuyển hướng về trang chủ
        return res.redirect('/');
    }
    res.render('login', {
        title: 'Đăng nhập',
        error: null // Hoặc lấy từ req.flash nếu bạn dùng connect-flash
    });
};

// Xử lý đăng nhập
exports.postLogin = async (req, res) => {
    const { username, password } = req.body;
    try {
        // Tìm người dùng bằng username hoặc email
        const user = await User.findOne({
            $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }]
        });

        if (!user) {
            return res.render('login', {
                title: 'Đăng nhập',
                error: 'Tên đăng nhập hoặc mật khẩu không đúng.'
            });
        }

        // So sánh mật khẩu
        const isMatch = await user.comparePassword(password); // Giả sử bạn có method này trong userModel

        if (!isMatch) {
            return res.render('login', {
                title: 'Đăng nhập',
                error: 'Tên đăng nhập hoặc mật khẩu không đúng.'
            });
        }

        // Lưu thông tin người dùng vào session
        // Chỉ lưu những thông tin cần thiết, không lưu toàn bộ object user có mật khẩu
        req.session.user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        };

        console.log('Session user after login:', req.session.user);

        // Chuyển hướng đến trang dashboard nếu là admin, ngược lại về trang chủ
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/');
        }

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        res.render('login', {
            title: 'Đăng nhập',
            error: 'Đã có lỗi xảy ra, vui lòng thử lại.'
        });
    }
};

// Hiển thị trang đăng ký
exports.getRegisterPage = (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('register', {
        title: 'Đăng ký',
        error: null,
        inputData: {} // Để giữ lại dữ liệu nhập nếu có lỗi
    });
};

// Xử lý đăng ký
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
        // Kiểm tra xem username hoặc email đã tồn tại chưa
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

        // Tạo người dùng mới (mật khẩu sẽ được hash tự động bởi pre-save hook trong userModel)
        const newUser = new User({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: password // Mật khẩu thô, sẽ được hash bởi model
        });

        await newUser.save();

        // (Tùy chọn) Tự động đăng nhập người dùng sau khi đăng ký thành công
        req.session.user = {
            _id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role // PHẢI là 'admin' nếu là admin
        };
        // Hoặc yêu cầu người dùng đăng nhập lại
        // req.flash('success_msg', 'Bạn đã đăng ký thành công! Vui lòng đăng nhập.'); // Nếu dùng connect-flash

        res.redirect('/');

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
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

// Xử lý đăng xuất
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Lỗi khi đăng xuất:", err);
            // Có thể xử lý lỗi ở đây, ví dụ render trang lỗi
            return res.redirect('/'); // Hoặc một trang lỗi
        }
        res.clearCookie('connect.sid'); // Tên cookie mặc định của express-session, kiểm tra lại nếu bạn đặt tên khác
        res.redirect('/auth/login');
    });
};

