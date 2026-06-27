const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

const VALID_STATUSES = [
  'NEW_LEAD','FOLLOW_UP_PENDING','TRIAL_PLANNED','TRIAL_COMPLETED',
  'QUOTATION_SUBMITTED','WAITING_APPROVAL','NEGOTIATION','PURCHASE_ORDER',
  'TECHNICAL_DISCUSSION_COMPLETED','PENDING_CUSTOMER_RESPONSE','LOST','CLOSED'
];
const VALID_TYPES = ['VISIT','CALL','ONLINE','TRIAL_SUPPORT','QUOTATION_DISCUSSION','TECHNICAL_DISCUSSION'];

// Haversine formula — distance between two GPS coords in metres
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// GET /api/meetings
const getMeetings = async (req, res) => {
  try {
    const { page = 1, limit = 20, customerId, status, type, userId, overdueOnly, assignedToMe } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();
    const isAdmin = ['ADMIN','SUPER_ADMIN','MANAGER'].includes(req.user.role);

    const where = {
      ...(customerId && { customerId }),
      ...(status && { status }),
      ...(type && { meetingType: type }),
      ...(!isAdmin && { userId: req.user.id }),
      ...(isAdmin && userId && { userId }),
      ...(assignedToMe === 'true' && { assignedToId: req.user.id }),
      ...(overdueOnly === 'true' && { nextFollowUp: { lt: now }, status: { notIn: ['CLOSED','LOST'] } }),
    };

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where, skip, take: Number(limit),
        orderBy: { meetingDate: 'desc' },
        include: {
          customer: { select: { id: true, companyName: true, contactPerson: true, lat: true, lng: true } },
          user: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    return sendPaginated(res, meetings, total, page, limit, 'Meetings fetched');
  } catch (err) {
    console.error('getMeetings:', err);
    return sendError(res, 'Failed to fetch meetings.', 500);
  }
};

// GET /api/meetings/today-followups
const getTodayFollowups = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const isAdmin = ['ADMIN','SUPER_ADMIN','MANAGER'].includes(req.user.role);

    const meetings = await prisma.meeting.findMany({
      where: {
        nextFollowUp: { gte: startOfDay, lt: endOfDay },
        ...(!isAdmin && { userId: req.user.id }),
      },
      include: {
        customer: { select: { id: true, companyName: true, contactPerson: true, contactNumber: true, lat: true, lng: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { nextFollowUp: 'asc' },
    });

    return sendSuccess(res, { meetings, count: meetings.length });
  } catch (err) {
    return sendError(res, 'Failed to fetch today\'s follow-ups.', 500);
  }
};

// GET /api/meetings/alerts  — unread follow-up alerts for this user
const getAlerts = async (req, res) => {
  try {
    const alerts = await prisma.followUpAlert.findMany({
      where: { userId: req.user.id, isRead: false },
      include: {
        meeting: {
          include: { customer: { select: { companyName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return sendSuccess(res, { alerts, count: alerts.length });
  } catch (err) {
    return sendError(res, 'Failed to fetch alerts.', 500);
  }
};

// PATCH /api/meetings/alerts/:id/read
const markAlertRead = async (req, res) => {
  try {
    await prisma.followUpAlert.update({ where: { id: req.params.id }, data: { isRead: true } });
    return sendSuccess(res, {}, 'Alert marked as read');
  } catch (err) {
    return sendError(res, 'Failed to mark alert.', 500);
  }
};

// GET /api/meetings/:id
const getMeeting = async (req, res) => {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        user: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        followUpAlerts: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!meeting) return sendError(res, 'Meeting not found.', 404);
    return sendSuccess(res, { meeting });
  } catch (err) {
    return sendError(res, 'Failed to fetch meeting.', 500);
  }
};

// POST /api/meetings
const createMeeting = async (req, res) => {
  try {
    const {
      customerId, meetingDate, meetingType, status, notes, summary, actionItems,
      customerRequirements, competitorInfo, opportunities,
      nextFollowUp, followUpTime, followUpPriority, assignedToId,
      trialDate, trialStatus, trialFeedback, quotationDate, quotationStatus,
    } = req.body;

    if (!customerId || !meetingDate || !meetingType) return sendError(res, 'Customer, date, and type are required.', 400);
    if (!VALID_TYPES.includes(meetingType)) return sendError(res, 'Invalid meeting type.', 400);
    if (status && !VALID_STATUSES.includes(status)) return sendError(res, 'Invalid status.', 400);

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return sendError(res, 'Customer not found.', 404);

    const meeting = await prisma.meeting.create({
      data: {
        customerId, userId: req.user.id,
        meetingDate: new Date(meetingDate), meetingType,
        status: status || 'NEW_LEAD',
        notes, summary, actionItems, customerRequirements, competitorInfo, opportunities,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
        followUpTime, followUpPriority: followUpPriority || 'MEDIUM',
        assignedToId: assignedToId || null,
        trialDate: trialDate ? new Date(trialDate) : null,
        trialStatus, trialFeedback,
        quotationDate: quotationDate ? new Date(quotationDate) : null,
        quotationStatus,
      },
      include: {
        customer: { select: { id: true, companyName: true, contactPerson: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // Schedule a follow-up alert if nextFollowUp was set
    if (nextFollowUp) {
      await scheduleFollowUpAlerts(meeting.id, req.user.id, new Date(nextFollowUp));
    }

    await prisma.activityLog.create({
      data: {
        userId: req.user.id, action: 'MEETING_CREATED', entityType: 'Meeting', entityId: meeting.id,
        details: JSON.stringify({ customer: customer.companyName, type: meetingType }),
      },
    });

    return sendSuccess(res, { meeting }, 'Meeting logged', 201);
  } catch (err) {
    console.error('createMeeting:', err);
    return sendError(res, 'Failed to create meeting.', 500);
  }
};

// PUT /api/meetings/:id
const updateMeeting = async (req, res) => {
  try {
    const {
      meetingDate, meetingType, status, notes, summary, actionItems,
      customerRequirements, competitorInfo, opportunities,
      nextFollowUp, followUpTime, followUpPriority, assignedToId,
      trialDate, trialStatus, trialFeedback, quotationDate, quotationStatus,
    } = req.body;

    const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!existing) return sendError(res, 'Meeting not found.', 404);
    const isAdmin = ['ADMIN','SUPER_ADMIN','MANAGER'].includes(req.user.role);
    if (!isAdmin && existing.userId !== req.user.id) return sendError(res, 'Can only edit your own meetings.', 403);

    const meeting = await prisma.meeting.update({
      where: { id: req.params.id },
      data: {
        ...(meetingDate && { meetingDate: new Date(meetingDate) }),
        ...(meetingType && { meetingType }),
        ...(status && { status }),
        notes, summary, actionItems, customerRequirements, competitorInfo, opportunities,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : existing.nextFollowUp,
        followUpTime: followUpTime ?? existing.followUpTime,
        followUpPriority: followUpPriority || existing.followUpPriority,
        assignedToId: assignedToId !== undefined ? (assignedToId || null) : existing.assignedToId,
        trialDate: trialDate ? new Date(trialDate) : existing.trialDate,
        trialStatus, trialFeedback,
        quotationDate: quotationDate ? new Date(quotationDate) : existing.quotationDate,
        quotationStatus,
      },
      include: {
        customer: { select: { id: true, companyName: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // Re-schedule alerts if follow-up date changed
    if (nextFollowUp && nextFollowUp !== existing.nextFollowUp?.toISOString()) {
      await prisma.followUpAlert.deleteMany({ where: { meetingId: req.params.id, isRead: false } });
      await scheduleFollowUpAlerts(meeting.id, existing.userId, new Date(nextFollowUp));
    }

    return sendSuccess(res, { meeting }, 'Meeting updated');
  } catch (err) {
    console.error('updateMeeting:', err);
    return sendError(res, 'Failed to update meeting.', 500);
  }
};

// POST /api/meetings/:id/checkin  — geo-fence validated customer check-in
const checkInCustomer = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) return sendError(res, 'GPS coordinates required.', 400);

    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
      include: { customer: true },
    });
    if (!meeting) return sendError(res, 'Meeting not found.', 404);
    if (meeting.checkedInAt) return sendError(res, 'Already checked in for this meeting.', 400);

    const customer = meeting.customer;
    let distance = null;
    let isGeoVerified = false;

    if (customer.lat && customer.lng) {
      distance = Math.round(haversineMetres(Number(lat), Number(lng), customer.lat, customer.lng));
      isGeoVerified = distance <= (customer.geoFenceRadius || 200);

      if (!isGeoVerified) {
        return sendError(res, `You are ${distance}m away from ${customer.companyName}. Check-in is only allowed within ${customer.geoFenceRadius || 200}m.`, 400);
      }
    }
    // If customer has no GPS set, allow check-in but flag as not geo-verified
    else {
      isGeoVerified = false;
    }

    const updated = await prisma.meeting.update({
      where: { id: req.params.id },
      data: {
        checkInLat: Number(lat), checkInLng: Number(lng),
        checkInDistance: distance,
        checkedInAt: new Date(),
        isGeoVerified,
        timerStartedAt: new Date(),
        status: meeting.status === 'NEW_LEAD' ? 'FOLLOW_UP_PENDING' : meeting.status,
      },
    });

    return sendSuccess(res, { meeting: updated, distance, isGeoVerified }, 'Checked in successfully');
  } catch (err) {
    console.error('checkInCustomer:', err);
    return sendError(res, 'Check-in failed.', 500);
  }
};

// PATCH /api/meetings/:id/timer
const updateTimer = async (req, res) => {
  try {
    const { action } = req.body; // start | pause | resume | stop
    const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!meeting) return sendError(res, 'Meeting not found.', 404);

    let updateData = {};
    const now = new Date();

    if (action === 'start' && !meeting.timerStartedAt) {
      updateData = { timerStartedAt: now };
    } else if (action === 'pause' && meeting.timerStartedAt && !meeting.timerEndedAt) {
      // Record the pause — store current elapsed in pausedSeconds
      const elapsed = Math.floor((now - meeting.timerStartedAt) / 1000) - meeting.timerPausedSeconds;
      updateData = { timerPausedSeconds: meeting.timerPausedSeconds + elapsed, timerStartedAt: now };
    } else if (action === 'resume') {
      updateData = {}; // timer is already running from timerStartedAt
    } else if (action === 'stop') {
      const totalSeconds = meeting.timerStartedAt
        ? Math.floor((now - meeting.timerStartedAt) / 1000) - meeting.timerPausedSeconds
        : 0;
      const totalMinutes = Math.round(totalSeconds / 60);
      updateData = { timerEndedAt: now, visitDurationMinutes: Math.max(0, totalMinutes) };
    }

    const updated = await prisma.meeting.update({ where: { id: req.params.id }, data: updateData });
    return sendSuccess(res, { meeting: updated }, `Timer ${action}ed`);
  } catch (err) {
    return sendError(res, 'Timer update failed.', 500);
  }
};

// POST /api/meetings/:id/attachments  — upload photos/docs
const uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return sendError(res, 'No file uploaded.', 400);

    const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!meeting) return sendError(res, 'Meeting not found.', 404);

    const existing = meeting.attachments ? JSON.parse(meeting.attachments) : [];
    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/meetings/${req.file.filename}`,
      uploadedAt: new Date().toISOString(),
    };
    existing.push(fileInfo);

    await prisma.meeting.update({
      where: { id: req.params.id },
      data: { attachments: JSON.stringify(existing) },
    });

    return sendSuccess(res, { file: fileInfo }, 'File uploaded');
  } catch (err) {
    console.error('uploadAttachment:', err);
    return sendError(res, 'Upload failed.', 500);
  }
};

// GET /api/meetings/customer/:customerId/visits  — visit history for map
const getCustomerVisits = async (req, res) => {
  try {
    const visits = await prisma.meeting.findMany({
      where: {
        customerId: req.params.customerId,
        checkedInAt: { not: null },
      },
      orderBy: { checkedInAt: 'desc' },
      include: { user: { select: { name: true } } },
      take: 50,
    });
    return sendSuccess(res, { visits, count: visits.length });
  } catch (err) {
    return sendError(res, 'Failed to fetch visit history.', 500);
  }
};

// Helper — create FollowUpAlert rows for a given meeting+date
async function scheduleFollowUpAlerts(meetingId, userId, followUpDate) {
  const now = new Date();
  const alerts = [];

  const oneDayBefore = new Date(followUpDate); oneDayBefore.setDate(oneDayBefore.getDate() - 1);
  const sameDayStart = new Date(followUpDate); sameDayStart.setHours(8, 0, 0, 0);

  if (oneDayBefore > now) alerts.push({ meetingId, userId, alertType: 'UPCOMING_24H' });
  if (sameDayStart > now) alerts.push({ meetingId, userId, alertType: 'UPCOMING_SAME_DAY' });
  if (followUpDate < now) alerts.push({ meetingId, userId, alertType: 'OVERDUE' });

  if (alerts.length > 0) {
    await prisma.followUpAlert.createMany({ data: alerts, skipDuplicates: true });
  }
}

module.exports = {
  getMeetings, getMeeting, createMeeting, updateMeeting, getTodayFollowups,
  getAlerts, markAlertRead, checkInCustomer, updateTimer, uploadAttachment,
  getCustomerVisits,
};
