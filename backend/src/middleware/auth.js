const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendError } = require('../utils/response');

const prisma = new PrismaClient();

// Role hierarchy: SUPER_ADMIN > ADMIN > MANAGER > SALES_ENGINEER > SALES
const ROLE_LEVELS = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  MANAGER: 3,
  SALES_ENGINEER: 2,
  SALES: 1,
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, isActive: true, isLocked: true },
    });

    if (!user) return sendError(res, 'User not found.', 401);
    if (!user.isActive) return sendError(res, 'Account deactivated. Contact admin.', 403);
    if (user.isLocked) return sendError(res, 'Account locked. Contact your admin.', 403);

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return sendError(res, 'Token expired. Please login again.', 401);
    if (err.name === 'JsonWebTokenError') return sendError(res, 'Invalid token.', 401);
    return sendError(res, 'Authentication failed.', 500);
  }
};

// Require minimum role level
const requireRole = (minRole) => (req, res, next) => {
  const userLevel = ROLE_LEVELS[req.user?.role] || 0;
  const requiredLevel = ROLE_LEVELS[minRole] || 99;
  if (userLevel < requiredLevel) {
    return sendError(res, `Access denied. ${minRole} or higher required.`, 403);
  }
  next();
};

const requireAdmin = requireRole('ADMIN');
const requireSuperAdmin = requireRole('SUPER_ADMIN');
const requireManager = requireRole('MANAGER');

// Check if user can view/edit another user's data
const canAccessUser = (requestingUser, targetUserId) => {
  if (['SUPER_ADMIN', 'ADMIN'].includes(requestingUser.role)) return true;
  if (requestingUser.role === 'MANAGER') return true; // managers can view all
  return requestingUser.id === targetUserId;
};

module.exports = { authenticate, requireAdmin, requireSuperAdmin, requireManager, canAccessUser, ROLE_LEVELS };
