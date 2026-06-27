const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { exportActivity } = require('../controllers/export.controller');
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/export', requireAdmin, exportActivity);

// GET /api/activity — admin only, supports search + action filter
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(search && {
        OR: [
          { action: { contains: search } },
          { entityType: { contains: search } },
          { user: { name: { contains: search } } },
        ],
      }),
    };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, role: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return sendPaginated(res, logs, total, page, limit, 'Activity logs fetched');
  } catch (err) {
    console.error('activity list:', err);
    return sendError(res, 'Failed to fetch logs.', 500);
  }
});

module.exports = router;
