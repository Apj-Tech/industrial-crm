const express = require('express');
const multer = require('multer');
const router = express.Router();
const { getProducts, getProduct, searchByCode, autocomplete, createProduct, updateProduct } = require('../controllers/products.controller');
const {
  getStock, getStockAlerts, getStockStats, createStock, updateStock, deleteStock,
  downloadTemplate, bulkImportStock,
} = require('../controllers/stock.controller');
const { exportProducts } = require('../controllers/export.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB, matching the PHP system's limit
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .xlsx, .xls, or .csv files are allowed.'), ok);
  },
});

router.use(authenticate);

// ── Stock routes (must come before /:id to avoid route collision) ──
router.get('/stock', getStock);
router.get('/stock/alerts', getStockAlerts);
router.get('/stock/stats', getStockStats);
router.get('/stock/template', downloadTemplate);
router.post('/stock/import', requireAdmin, upload.single('file'), bulkImportStock);
router.post('/stock', requireAdmin, createStock);
router.put('/stock/:id', requireAdmin, updateStock);
router.delete('/stock/:id', requireAdmin, deleteStock);

// ── Product routes ───────────────────────────────────────────────────
router.get('/export', requireAdmin, exportProducts);
router.get('/search', autocomplete); // AJAX typeahead for quotation line items
router.get('/', getProducts);
router.get('/code/:code', searchByCode);
router.get('/:id', getProduct);
router.post('/', requireAdmin, createProduct);
router.put('/:id', requireAdmin, updateProduct);

module.exports = router;
