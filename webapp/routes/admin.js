const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

// Middleware chung cho tất cả các route trong file này
router.use(isAuthenticated, isAdmin);

// ==== Page Rendering Routes ====
// Các route này sẽ được truy cập qua /admin/dashboard, /admin/node-status, ...

router.get('/dashboard', (req, res) => {
    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        currentUser: req.session.user,
        currentPath: '/admin/dashboard'
    });
});

router.get('/node-status', (req, res) => {
    res.render('admin/node-status', {
        title: 'Trạng thái Node',
        currentUser: req.session.user,
        currentPath: '/admin/node-status'
    });
});

router.get('/user-management', (req, res) => {
    res.render('admin/user-management', {
        title: 'Quản lý User',
        currentUser: req.session.user,
        currentPath: '/admin/user-management'
    });
});

router.get('/request-statistics', (req, res) => {
    res.render('admin/request-statistics', {
        title: 'Thống kê Request',
        currentUser: req.session.user,
        currentPath: '/admin/request-statistics'
    });
});

router.get('/nodes', (req, res) => {
    res.render('admin/node-status', {
        title: 'Trạng thái Node',
        currentUser: req.session.user,
        currentPath: '/admin/nodes'
    });
});

router.get('/users', (req, res) => {
    res.render('admin/user-management', {
        title: 'Quản lý User',
        currentUser: req.session.user,
        currentPath: '/admin/users'
    });
});

router.get('/request-stats', (req, res) => {
    res.render('admin/request-statistics', {
        title: 'Thống kê Request',
        currentUser: req.session.user,
        currentPath: '/admin/request-stats'
    });
});

// ==== API Endpoints ====
// Các route này sẽ được truy cập qua /api/admin/nodes-status, /api/admin/users, ...
// do được mount kép trong app.js với prefix /api

router.get('/api/nodes-status', adminController.getNodesStatus);
router.get('/api/request-stats', adminController.getRequestStats);
router.get('/api/users', adminController.getUsers);
router.put('/api/users/:userId/role', adminController.updateUserRole);
router.delete('/api/users/:userId', adminController.deleteUser);

module.exports = router;