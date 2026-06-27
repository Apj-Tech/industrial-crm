const express = require('express');
const router = express.Router();
const {
  getQuotations, getQuotationStats, getQuotation, createQuotation,
  updateQuotation, deleteQuotation, approveQuotation, generatePDF,
} = require('../controllers/quotations.controller');
const { exportQuotations } = require('../controllers/export.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats',  getQuotationStats);
router.get('/export', requireAdmin, exportQuotations);
router.get('/',       getQuotations);
router.post('/',      createQuotation);
router.get('/:id',    getQuotation);
router.put('/:id',    updateQuotation);
router.delete('/:id', requireAdmin, deleteQuotation);
router.get('/:id/pdf', generatePDF);
router.patch('/:id/approve', requireAdmin, approveQuotation);

module.exports = router;
