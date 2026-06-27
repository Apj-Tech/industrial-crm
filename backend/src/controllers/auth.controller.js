const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');

const prisma = new PrismaClient();

const generateToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const MAX_FAILED_ATTEMPTS = 5;

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 'Email and password are required.', 400);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return sendError(res, 'Invalid email or password.', 401);
    if (!user.isActive) return sendError(res, 'Account deactivated. Contact your admin.', 403);
    if (user.isLocked) return sendError(res, 'Account locked due to too many failed attempts. Contact your admin.', 403);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const newCount = user.failedLoginCount + 1;
      const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: newCount, isLocked: shouldLock },
      });
      if (shouldLock) return sendError(res, `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Contact your admin.`, 403);
      return sendError(res, `Invalid email or password. ${MAX_FAILED_ATTEMPTS - newCount} attempt(s) remaining.`, 401);
    }

    // Successful login — reset failed count
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lastLoginAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id, action: 'LOGIN',
        ipAddress: req.ip, userAgent: req.get('user-agent'),
      },
    });

    const token = generateToken(user);
    return sendSuccess(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, avatar: user.avatar },
    }, 'Login successful');
  } catch (err) {
    console.error('login:', err);
    return sendError(res, 'Login failed.', 500);
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    if (req.user?.id) {
      await prisma.activityLog.create({ data: { userId: req.user.id, action: 'LOGOUT' } });
    }
    return sendSuccess(res, {}, 'Logged out successfully');
  } catch (err) {
    return sendSuccess(res, {}, 'Logged out');
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, phone: true, department: true, avatar: true, lastLoginAt: true, sessionTimeout: true, twoFactorEnabled: true },
    });
    if (!user) return sendError(res, 'User not found.', 404);
    return sendSuccess(res, { user });
  } catch (err) {
    return sendError(res, 'Failed to fetch profile.', 500);
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return sendError(res, 'Both current and new password are required.', 400);
    if (newPassword.length < 6) return sendError(res, 'New password must be at least 6 characters.', 400);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return sendError(res, 'Current password is incorrect.', 401);

    const hashedPw = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPw } });
    await prisma.activityLog.create({ data: { userId: req.user.id, action: 'PASSWORD_CHANGED' } });

    return sendSuccess(res, {}, 'Password changed successfully');
  } catch (err) {
    return sendError(res, 'Failed to change password.', 500);
  }
};

// PUT /api/auth/profile  — update own name/phone/avatar
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { ...(name && { name: name.trim() }), ...(phone !== undefined && { phone: phone?.trim() }) },
      select: { id: true, name: true, email: true, role: true, phone: true, department: true, avatar: true },
    });
    return sendSuccess(res, { user }, 'Profile updated');
  } catch (err) {
    return sendError(res, 'Failed to update profile.', 500);
  }
};

module.exports = { login, logout, getMe, changePassword, updateProfile };
