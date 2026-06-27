const express = require('express');
const router = express.Router();
const { login, getMe, changePassword, updateProfile, logout } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);
router.put('/profile', authenticate, updateProfile);
router.post('/logout', authenticate, logout);

module.exports = router;
