const express = require('express');
const router = express.Router();
const {
  getUsers, getUser, createUser, updateUser,
  adminResetPassword, toggleLock, deleteUser, reactivateUser,
} = require('../controllers/users.controller');
const { exportUsers } = require('../controllers/export.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);
router.get('/export', requireAdmin, exportUsers);
router.get('/', requireAdmin, getUsers);
router.get('/:id', requireAdmin, getUser);
router.post('/', requireAdmin, createUser);
router.put('/:id', requireAdmin, updateUser);
router.patch('/:id/reset-password', requireAdmin, adminResetPassword);
router.patch('/:id/toggle-lock', requireAdmin, toggleLock);
router.patch('/:id/reactivate', requireAdmin, reactivateUser);
router.delete('/:id', requireAdmin, deleteUser);
module.exports = router;
