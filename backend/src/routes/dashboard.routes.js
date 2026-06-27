const express = require('express');
const router = express.Router();
const { getAdminDashboard, getUserDashboard } = require('../controllers/dashboard.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
router.use(authenticate);
router.get('/admin', requireAdmin, getAdminDashboard);
router.get('/user', getUserDashboard);
module.exports = router;
