const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');

const prisma = new PrismaClient();

// GET /api/dashboard/admin
const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [
      totalCustomers, newCustomers, followUpsToday, overdueList,
      trialsPlanned, trialsCompleted, quotationsSent,
      pendingLeaves, pendingQuotationApprovals, presentToday,
      recentActivity, monthlyMeetings, monthlyQuotations,
    ] = await Promise.all([
      prisma.customer.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: true, createdAt: { gte: startOfMonth } } }),
      prisma.meeting.count({ where: { nextFollowUp: { gte: startOfDay, lt: endOfDay } } }),
      prisma.meeting.findMany({
        where: { nextFollowUp: { lt: startOfDay }, status: { notIn: ['CLOSED', 'LOST'] } },
        include: { customer: { select: { companyName: true, contactPerson: true } } },
        orderBy: { nextFollowUp: 'asc' },
        take: 10,
      }),
      prisma.meeting.count({ where: { status: 'TRIAL_PLANNED' } }),
      prisma.meeting.count({ where: { status: 'TRIAL_COMPLETED' } }),
      prisma.quotation.count(),
      prisma.leave.count({ where: { status: 'PENDING' } }),
      prisma.quotation.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.attendance.count({ where: { date: { gte: startOfDay, lt: endOfDay }, checkIn: { not: null } } }),
      prisma.activityLog.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, role: true } } } }),
      Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
          return prisma.meeting.count({ where: { meetingDate: { gte: d, lt: end } } }).then((count) => ({ month: d.toLocaleString('default', { month: 'short' }), count }));
        })
      ),
      Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
          return prisma.quotation.count({ where: { createdAt: { gte: d, lt: end } } }).then((count) => ({ month: d.toLocaleString('default', { month: 'short' }), count }));
        })
      ),
    ]);

    const monthlyActivity = monthlyMeetings.map((m, i) => ({
      month: m.month,
      meetings: m.count,
      quotations: monthlyQuotations[i]?.count || 0,
    }));

    return sendSuccess(res, {
      totalCustomers,
      newCustomers,
      followUpsToday,
      overdueFollowUps: overdueList.length,
      trialsPlanned,
      trialsCompleted,
      quotationsSent,
      pendingApprovals: pendingLeaves + pendingQuotationApprovals,
      presentToday,
      leaveRequests: pendingLeaves,
      overdueList,
      recentActivity,
      monthlyActivity,
    }, 'Admin dashboard data fetched');
  } catch (err) {
    console.error('getAdminDashboard:', err);
    return sendError(res, 'Failed to fetch dashboard data.', 500);
  }
};

// GET /api/dashboard/user
const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      myFollowUpsToday, overdueList, myCustomers, meetingsThisMonth,
      myQuotations, todayAttendance, monthlyMeetings, monthlyQuotations,
    ] = await Promise.all([
      prisma.meeting.count({ where: { userId, nextFollowUp: { gte: startOfDay, lt: endOfDay } } }),
      prisma.meeting.findMany({
        where: { userId, nextFollowUp: { lt: startOfDay }, status: { notIn: ['CLOSED', 'LOST'] } },
        include: { customer: { select: { companyName: true, contactPerson: true } } },
        orderBy: { nextFollowUp: 'asc' },
        take: 10,
      }),
      prisma.customer.count({ where: { createdById: userId, isActive: true } }),
      prisma.meeting.count({ where: { userId, meetingDate: { gte: startOfMonth } } }),
      prisma.quotation.count({ where: { userId } }),
      prisma.attendance.findFirst({ where: { userId, date: { gte: startOfDay, lt: endOfDay } } }),
      Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
          return prisma.meeting.count({ where: { userId, meetingDate: { gte: d, lt: end } } }).then((count) => ({ month: d.toLocaleString('default', { month: 'short' }), count }));
        })
      ),
      Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
          return prisma.quotation.count({ where: { userId, createdAt: { gte: d, lt: end } } }).then((count) => ({ month: d.toLocaleString('default', { month: 'short' }), count }));
        })
      ),
    ]);

    const monthlyActivity = monthlyMeetings.map((m, i) => ({
      month: m.month,
      meetings: m.count,
      quotations: monthlyQuotations[i]?.count || 0,
    }));

    return sendSuccess(res, {
      myFollowUpsToday,
      myOverdue: overdueList.length,
      myQuotations,
      myCustomers,
      checkedIn: Boolean(todayAttendance?.checkIn),
      meetingsThisMonth,
      overdueList,
      monthlyActivity,
    }, 'User dashboard data fetched');
  } catch (err) {
    console.error('getUserDashboard:', err);
    return sendError(res, 'Failed to fetch dashboard data.', 500);
  }
};

module.exports = { getAdminDashboard, getUserDashboard };
