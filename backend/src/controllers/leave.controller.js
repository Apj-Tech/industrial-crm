const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const prisma = new PrismaClient();

const LEAVE_TYPES = ['CASUAL', 'SICK', 'PERMISSION', 'HALF_DAY'];

// GET /api/leaves
const getLeaves = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, userId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      ...(req.user.role !== 'ADMIN' && { userId: req.user.id }),
      ...(req.user.role === 'ADMIN' && userId && { userId }),
      ...(status && { status }),
    };

    const [leaves, total] = await Promise.all([
      prisma.leave.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, department: true } } },
      }),
      prisma.leave.count({ where }),
    ]);

    return sendPaginated(res, leaves, total, page, limit, 'Leaves fetched');
  } catch (err) {
    return sendError(res, 'Failed to fetch leaves.', 500);
  }
};

// POST /api/leaves
const createLeave = async (req, res) => {
  try {
    const { leaveType, fromDate, toDate, reason } = req.body;
    if (!leaveType || !fromDate || !toDate) return sendError(res, 'Leave type, from date, and to date are required.', 400);
    if (!LEAVE_TYPES.includes(leaveType)) return sendError(res, 'Invalid leave type.', 400);

    const from = new Date(fromDate);
    const to = new Date(toDate);
    const totalDays = leaveType === 'HALF_DAY' ? 0.5 :
      Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await prisma.leave.create({
      data: { userId: req.user.id, leaveType, fromDate: from, toDate: to, totalDays, reason, status: 'PENDING' },
      include: { user: { select: { name: true } } },
    });
    return sendSuccess(res, { leave }, 'Leave request submitted', 201);
  } catch (err) {
    return sendError(res, 'Failed to submit leave request.', 500);
  }
};

// PATCH /api/leaves/:id/approve  (admin only)
const approveLeave = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) return sendError(res, 'Status must be APPROVED or REJECTED.', 400);

    const leave = await prisma.leave.update({
      where: { id: req.params.id },
      data: { status, adminNote, approvedById: req.user.id, approvedAt: new Date() },
      include: { user: { select: { name: true, email: true } } },
    });
    return sendSuccess(res, { leave }, `Leave ${status.toLowerCase()}`);
  } catch (err) {
    if (err.code === 'P2025') return sendError(res, 'Leave request not found.', 404);
    return sendError(res, 'Failed to update leave.', 500);
  }
};

module.exports = { getLeaves, createLeave, approveLeave };
