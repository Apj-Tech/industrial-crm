const express = require('express');
const router = express.Router();
const {
  checkIn, checkOut, getAttendance, getTodayAttendance,
  recordPing, getLiveTracking, getLocationTrail,
} = require('../controllers/attendance.controller');
const { exportAttendance } = require('../controllers/export.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.post('/ping', recordPing);
router.get('/today', getTodayAttendance);
router.get('/live', requireAdmin, getLiveTracking);
router.get('/export', requireAdmin, exportAttendance);
router.get('/:id/locations', getLocationTrail);
router.get('/', getAttendance);

module.exports = router;
