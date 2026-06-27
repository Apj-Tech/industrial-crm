const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const prisma = new PrismaClient();

const ROLES = ['SUPER_ADMIN','ADMIN','MANAGER','SALES_ENGINEER','SALES'];

const safeSelect = {
  id: true, name: true, email: true, role: true, phone: true,
  department: true, avatar: true, isActive: true, isLocked: true,
  twoFactorEnabled: true, lastLoginAt: true, sessionTimeout: true,
  createdAt: true, updatedAt: true,
};

const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', role = '', isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      AND: [
        search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }, { department: { contains: search } }] } : {},
        role ? { role } : {},
        isActive !== undefined ? { isActive: isActive === 'true' } : {},
      ],
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, select: safeSelect, skip, take: Number(limit), orderBy: { name: 'asc' } }),
      prisma.user.count({ where }),
    ]);
    return sendPaginated(res, users, total, page, limit, 'Users fetched');
  } catch (err) {
    return sendError(res, 'Failed to fetch users.', 500);
  }
};

const getUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: safeSelect });
    if (!user) return sendError(res, 'User not found.', 404);
    return sendSuccess(res, { user });
  } catch (err) {
    return sendError(res, 'Failed to fetch user.', 500);
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, department, sessionTimeout } = req.body;
    if (!name || !email || !password) return sendError(res, 'Name, email, and password are required.', 400);
    if (role && !ROLES.includes(role)) return sendError(res, `Role must be one of: ${ROLES.join(', ')}`, 400);
    if (password.length < 6) return sendError(res, 'Password must be at least 6 characters.', 400);

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (exists) return sendError(res, 'An account with this email already exists.', 409);

    const hashedPw = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name.trim(), email: email.toLowerCase().trim(),
        password: hashedPw, role: role || 'SALES',
        phone: phone?.trim(), department: department?.trim(),
        sessionTimeout: sessionTimeout ? Number(sessionTimeout) : 480,
      },
      select: safeSelect,
    });

    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'USER_CREATED', entityType: 'User', entityId: user.id,
              details: JSON.stringify({ name, email, role: role || 'SALES' }) },
    });

    return sendSuccess(res, { user }, 'User created successfully', 201);
  } catch (err) {
    console.error('createUser:', err);
    return sendError(res, 'Failed to create user.', 500);
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, phone, department, role, sessionTimeout } = req.body;
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 'User not found.', 404);
    if (role && !ROLES.includes(role)) return sendError(res, `Invalid role.`, 400);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() }),
        ...(department !== undefined && { department: department?.trim() }),
        ...(role && { role }),
        ...(sessionTimeout && { sessionTimeout: Number(sessionTimeout) }),
      },
      select: safeSelect,
    });
    return sendSuccess(res, { user }, 'User updated');
  } catch (err) {
    return sendError(res, 'Failed to update user.', 500);
  }
};

// Admin: reset any user's password
const adminResetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return sendError(res, 'New password must be at least 6 characters.', 400);
    const hashedPw = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashedPw, failedLoginCount: 0, isLocked: false } });
    await prisma.activityLog.create({
      data: { userId: req.user.id, action: 'PASSWORD_RESET', entityType: 'User', entityId: req.params.id },
    });
    return sendSuccess(res, {}, 'Password reset successfully');
  } catch (err) {
    return sendError(res, 'Failed to reset password.', 500);
  }
};

// Admin: lock / unlock account
const toggleLock = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return sendError(res, 'User not found.', 404);
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { isLocked: !user.isLocked } });
    await prisma.activityLog.create({
      data: { userId: req.user.id, action: updated.isLocked ? 'USER_LOCKED' : 'USER_UNLOCKED', entityType: 'User', entityId: req.params.id },
    });
    return sendSuccess(res, { isLocked: updated.isLocked }, updated.isLocked ? 'Account locked' : 'Account unlocked');
  } catch (err) {
    return sendError(res, 'Failed to toggle lock.', 500);
  }
};

// Soft-deactivate
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) return sendError(res, 'You cannot deactivate your own account.', 400);
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false }, select: safeSelect });
    return sendSuccess(res, { user }, 'User deactivated');
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'User not found.', 404);
    return sendError(res, 'Failed to deactivate user.', 500);
  }
};

// Reactivate
const reactivateUser = async (req, res) => {
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: true, isLocked: false, failedLoginCount: 0 }, select: safeSelect });
    return sendSuccess(res, { user }, 'User reactivated');
  } catch (err) {
    return sendError(res, 'Failed to reactivate user.', 500);
  }
};

module.exports = { getUsers, getUser, createUser, updateUser, adminResetPassword, toggleLock, deleteUser, reactivateUser };
