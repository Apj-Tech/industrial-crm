const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError } = require('../utils/response');

const prisma = new PrismaClient();

// GET /api/analytics/overview  — high-level KPIs
const getOverview = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);
    const isAdmin = ['ADMIN','SUPER_ADMIN','MANAGER'].includes(req.user.role);
    const userFilter = isAdmin ? {} : { userId: req.user.id };

    const [
      totalCustomers, newCustomersMonth, activeCustomers,
      totalMeetings, meetingsToday, overdueFollowUps,
      trialsPlanned, trialsCompleted, quotationsSent, poReceived,
      totalVisits, avgVisitDuration,
    ] = await Promise.all([
      prisma.customer.count({ where: { isActive: true } }),
      prisma.customer.count({ where: { isActive: true, createdAt: { gte: startOfMonth } } }),
      prisma.customer.count({ where: { isActive: true, status: 'ACTIVE' } }),
      prisma.meeting.count({ where: { ...userFilter } }),
      prisma.meeting.count({ where: { ...userFilter, meetingDate: { gte: startOfDay, lt: endOfDay } } }),
      prisma.meeting.count({ where: { ...userFilter, nextFollowUp: { lt: now }, status: { notIn: ['CLOSED','LOST'] } } }),
      prisma.meeting.count({ where: { ...userFilter, status: 'TRIAL_PLANNED' } }),
      prisma.meeting.count({ where: { ...userFilter, status: 'TRIAL_COMPLETED' } }),
      prisma.meeting.count({ where: { ...userFilter, status: 'QUOTATION_SUBMITTED' } }),
      prisma.meeting.count({ where: { ...userFilter, status: 'PURCHASE_ORDER' } }),
      prisma.meeting.count({ where: { ...userFilter, checkedInAt: { not: null } } }),
      prisma.meeting.aggregate({ where: { ...userFilter, visitDurationMinutes: { not: null } }, _avg: { visitDurationMinutes: true } }),
    ]);

    return sendSuccess(res, {
      customers: { total: totalCustomers, newThisMonth: newCustomersMonth, active: activeCustomers },
      meetings: { total: totalMeetings, today: meetingsToday, overdueFollowUps, trialsPlanned, trialsCompleted, quotationsSent, poReceived },
      visits: { total: totalVisits, avgDurationMinutes: Math.round(avgVisitDuration._avg.visitDurationMinutes || 0) },
    });
  } catch (err) {
    console.error('getOverview:', err);
    return sendError(res, 'Failed to fetch analytics overview.', 500);
  }
};

// GET /api/analytics/monthly?months=6  — monthly meeting + quotation + visit counts
const getMonthly = async (req, res) => {
  try {
    const months = Math.min(Number(req.query.months) || 6, 12);
    const isAdmin = ['ADMIN','SUPER_ADMIN','MANAGER'].includes(req.user.role);
    const userFilter = isAdmin ? {} : { userId: req.user.id };
    const now = new Date();

    const data = await Promise.all(
      Array.from({ length: months }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const range = { gte: d, lt: end };
        return Promise.all([
          prisma.meeting.count({ where: { ...userFilter, meetingDate: range } }),
          prisma.meeting.count({ where: { ...userFilter, status: 'QUOTATION_SUBMITTED', updatedAt: range } }),
          prisma.meeting.count({ where: { ...userFilter, checkedInAt: range } }),
          prisma.meeting.count({ where: { ...userFilter, status: 'PURCHASE_ORDER', updatedAt: range } }),
        ]).then(([meetings, quotations, visits, orders]) => ({
          month: d.toLocaleString('default', { month: 'short' }),
          year: d.getFullYear(),
          meetings, quotations, visits, orders,
        }));
      })
    );

    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, 'Failed to fetch monthly data.', 500);
  }
};

// GET /api/analytics/employee  — per-employee performance (admin/manager only)
const getEmployeeAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['SALES','SALES_ENGINEER','MANAGER'] } },
      select: { id: true, name: true, department: true },
    });

    const stats = await Promise.all(
      users.map(async (u) => {
        const [totalVisits, monthVisits, avgDuration, overdueFollowUps, wonDeals] = await Promise.all([
          prisma.meeting.count({ where: { userId: u.id, checkedInAt: { not: null } } }),
          prisma.meeting.count({ where: { userId: u.id, checkedInAt: { gte: startOfMonth } } }),
          prisma.meeting.aggregate({ where: { userId: u.id, visitDurationMinutes: { not: null } }, _avg: { visitDurationMinutes: true } }),
          prisma.meeting.count({ where: { userId: u.id, nextFollowUp: { lt: now }, status: { notIn: ['CLOSED','LOST'] } } }),
          prisma.meeting.count({ where: { userId: u.id, status: 'PURCHASE_ORDER' } }),
        ]);
        return {
          user: u, totalVisits, monthVisits,
          avgDurationMinutes: Math.round(avgDuration._avg.visitDurationMinutes || 0),
          overdueFollowUps, wonDeals,
        };
      })
    );

    stats.sort((a, b) => b.monthVisits - a.monthVisits);
    return sendSuccess(res, { employees: stats });
  } catch (err) {
    return sendError(res, 'Failed to fetch employee analytics.', 500);
  }
};

// GET /api/analytics/customer-segmentation  — customers grouped by status + visit frequency
const getCustomerSegmentation = async (req, res) => {
  try {
    const [byStatus, byCategory, topCustomers] = await Promise.all([
      prisma.customer.groupBy({ by: ['status'], where: { isActive: true }, _count: { _all: true } }),
      prisma.customer.groupBy({ by: ['category'], where: { isActive: true, category: { not: null } }, _count: { _all: true } }),
      prisma.customer.findMany({
        where: { isActive: true },
        include: { _count: { select: { meetings: true } } },
        orderBy: { meetings: { _count: 'desc' } },
        take: 10,
        select: { id: true, companyName: true, contactPerson: true, status: true, category: true, _count: true },
      }),
    ]);

    return sendSuccess(res, {
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count._all })),
      byCategory: byCategory.map(c => ({ category: c.category, count: c._count._all })),
      topCustomers,
    });
  } catch (err) {
    return sendError(res, 'Failed to fetch segmentation.', 500);
  }
};

// GET /api/analytics/win-loss  — win/loss analysis by month
const getWinLoss = async (req, res) => {
  try {
    const months = 6;
    const now = new Date();
    const isAdmin = ['ADMIN','SUPER_ADMIN','MANAGER'].includes(req.user.role);
    const userFilter = isAdmin ? {} : { userId: req.user.id };

    const data = await Promise.all(
      Array.from({ length: months }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const range = { gte: d, lt: end };
        return Promise.all([
          prisma.meeting.count({ where: { ...userFilter, status: 'PURCHASE_ORDER', updatedAt: range } }),
          prisma.meeting.count({ where: { ...userFilter, status: 'LOST', updatedAt: range } }),
          prisma.meeting.count({ where: { ...userFilter, status: 'CLOSED', updatedAt: range } }),
        ]).then(([won, lost, closed]) => ({
          month: d.toLocaleString('default', { month: 'short' }),
          won, lost, closed,
          winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
        }));
      })
    );

    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, 'Failed to fetch win/loss data.', 500);
  }
};

module.exports = { getOverview, getMonthly, getEmployeeAnalytics, getCustomerSegmentation, getWinLoss };
