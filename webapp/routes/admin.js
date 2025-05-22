const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// Tất cả các route trong file này đều yêu cầu đăng nhập và là admin
router.use(isAuthenticated, isAdmin);

router.get('/dashboard', (req, res) => {
    console.log('Current session user:', req.session.user);
    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        currentUser: req.session.user
    });
});

// GET /api/admin/dashboard-stats (Tổng quan)
// router.get('/dashboard-stats', adminController.getDashboardStats);

// GET /api/admin/nodes-status (Kiểm tra node search nào còn sống)
router.get('/nodes-status', adminController.getNodesStatus);

// GET /api/admin/request-stats (Đếm tổng lượng request và request từng node - phần này phức tạp)
router.get('/request-stats', adminController.getRequestStats);

// GET /api/admin/users (Danh sách user)
router.get('/users', adminController.getUsers);
// PUT /api/admin/users/:userId/role (Thay đổi role user)
router.put('/users/:userId/role', adminController.updateUserRole);
// DELETE /api/admin/users/:userId (Xóa user)
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;