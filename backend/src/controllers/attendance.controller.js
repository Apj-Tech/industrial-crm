const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const prisma = new PrismaClient();

// POST /api/attendance/checkin
const checkIn = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const existing = await prisma.attendance.findFirst({
      where: { userId: req.user.id, date: { gte: startOfDay, lt: endOfDay } },
    });
    if (existing) return sendError(res, 'Already checked in today.', 400);

    const record = await prisma.attendance.create({
      data: {
        userId: req.user.id,
        date: startOfDay,
        checkIn: new Date(),
        checkInLat: lat ? Number(lat) : null,
        checkInLng: lng ? Number(lng) : null,
        status: 'PRESENT',
      },
    });
    return sendSuccess(res, { record }, 'Check-in recorded', 201);
  } catch (err) {
    return sendError(res, 'Check-in failed.', 500);
  }
};

// POST /api/attendance/checkout
const checkOut = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const record = await prisma.attendance.findFirst({
      where: { userId: req.user.id, date: { gte: startOfDay, lt: endOfDay } },
    });
    if (!record) return sendError(res, 'No check-in found for today.', 400);
    if (record.checkOut) return sendError(res, 'Already checked out today.', 400);

    const checkOutTime = new Date();
    const hours = (checkOutTime - record.checkIn) / (1000 * 60 * 60);

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: {
        checkOut: checkOutTime,
        checkOutLat: lat ? Number(lat) : null,
        checkOutLng: lng ? Number(lng) : null,
        workingHours: Math.round(hours * 100) / 100,
      },
    });
    return sendSuccess(res, { record: updated }, `Checked out. Working hours: ${updated.workingHours}h`);
  } catch (err) {
    return sendError(res, 'Check-out failed.', 500);
  }
};

// GET /api/attendance
const getAttendance = async (req, res) => {
  try {
    const { userId, month, year, page = 1, limit = 31 } = req.query;
    const now = new Date();
    const m = month ? Number(month) - 1 : now.getMonth();
    const y = year ? Number(year) : now.getFullYear();
    const from = new Date(y, m, 1);
    const to = new Date(y, m + 1, 1);

    const targetUserId = (req.user.role === 'ADMIN' && userId) ? userId : req.user.id;

    const where = {
      userId: targetUserId,
      date: { gte: from, lt: to },
      ...(req.query.status && { status: req.query.status }),
    };
    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: { user: { select: { name: true, department: true } } },
        orderBy: { date: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.attendance.count({ where }),
    ]);
    return sendPaginated(res, records, total, page, limit, 'Attendance fetched');
  } catch (err) {
    return sendError(res, 'Failed to fetch attendance.', 500);
  }
};

// GET /api/attendance/today
const getTodayAttendance = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const record = await prisma.attendance.findFirst({
      where: { userId: req.user.id, date: { gte: startOfDay, lt: endOfDay } },
    });
    return sendSuccess(res, { record });
  } catch (err) {
    return sendError(res, 'Failed to fetch today\'s attendance.', 500);
  }
};

// POST /api/attendance/ping
// Called repeatedly by the employee's device while checked in to record a
// live GPS point. Rejected if there's no open (checked-in, not checked-out)
// attendance record for today.
const recordPing = async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body;
    if (lat === undefined || lng === undefined) return sendError(res, 'lat and lng are required.', 400);

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const record = await prisma.attendance.findFirst({
      where: { userId: req.user.id, date: { gte: startOfDay, lt: endOfDay }, checkIn: { not: null }, checkOut: null },
    });
    if (!record) return sendError(res, 'No active check-in session. Punch in first.', 400);

    const ping = await prisma.locationPing.create({
      data: {
        attendanceId: record.id,
        lat: Number(lat),
        lng: Number(lng),
        accuracy: accuracy !== undefined ? Number(accuracy) : null,
      },
    });
    return sendSuccess(res, { ping }, 'Location recorded', 201);
  } catch (err) {
    console.error('recordPing:', err);
    return sendError(res, 'Failed to record location.', 500);
  }
};

// GET /api/attendance/live  (Admin only)
// Everyone currently checked in today, with their most recent location ping.
const getLiveTracking = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const activeRecords = await prisma.attendance.findMany({
      where: { date: { gte: startOfDay, lt: endOfDay }, checkIn: { not: null }, checkOut: null },
      include: {
        user: { select: { id: true, name: true, department: true, phone: true } },
        locationPings: { orderBy: { capturedAt: 'desc' }, take: 1 },
      },
      orderBy: { checkIn: 'desc' },
    });

    const live = activeRecords.map((r) => {
      const lastPing = r.locationPings[0] || null;
      return {
        attendanceId: r.id,
        user: r.user,
        checkIn: r.checkIn,
        checkInLat: r.checkInLat,
        checkInLng: r.checkInLng,
        lastLocation: lastPing ? { lat: lastPing.lat, lng: lastPing.lng, capturedAt: lastPing.capturedAt } : (r.checkInLat ? { lat: r.checkInLat, lng: r.checkInLng, capturedAt: r.checkIn } : null),
      };
    });

    return sendSuccess(res, { live, count: live.length }, 'Live tracking data fetched');
  } catch (err) {
    console.error('getLiveTracking:', err);
    return sendError(res, 'Failed to fetch live tracking data.', 500);
  }
};

// GET /api/attendance/:id/locations  (Admin only, or the owning user)
// Full GPS trail for one attendance record — used to plot a movement path.
const getLocationTrail = async (req, res) => {
  try {
    const record = await prisma.attendance.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!record) return sendError(res, 'Attendance record not found.', 404);
    if (req.user.role !== 'ADMIN' && record.userId !== req.user.id) {
      return sendError(res, 'Not authorized to view this record.', 403);
    }

    const pings = await prisma.locationPing.findMany({
      where: { attendanceId: req.params.id },
      orderBy: { capturedAt: 'asc' },
    });

    return sendSuccess(res, { record, pings }, 'Location trail fetched');
  } catch (err) {
    console.error('getLocationTrail:', err);
    return sendError(res, 'Failed to fetch location trail.', 500);
  }
};

module.exports = { checkIn, checkOut, getAttendance, getTodayAttendance, recordPing, getLiveTracking, getLocationTrail };
