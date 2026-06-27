const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const {
  getMeetings, getMeeting, createMeeting, updateMeeting, getTodayFollowups,
  getAlerts, markAlertRead, checkInCustomer, updateTimer, uploadAttachment,
  getCustomerVisits,
} = require('../controllers/meetings.controller');
const { exportMeetings } = require('../controllers/export.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Multer for meeting attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/meetings');
    require('fs').mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

router.get('/today-followups', getTodayFollowups);
router.get('/alerts', getAlerts);
router.get('/export', requireAdmin, exportMeetings);
router.get('/customer/:customerId/visits', getCustomerVisits);
router.get('/', getMeetings);
router.get('/:id', getMeeting);
router.post('/', createMeeting);
router.put('/:id', updateMeeting);
router.post('/:id/checkin', checkInCustomer);
router.patch('/:id/timer', updateTimer);
router.post('/:id/attachments', upload.single('file'), uploadAttachment);
router.patch('/alerts/:id/read', markAlertRead);

module.exports = router;
