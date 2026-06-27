const express = require('express');
const router = express.Router();
const {
  getCustomers, getCustomersWithLocation, getCustomer,
  createCustomer, updateCustomer, deleteCustomer, getFilterMeta,
} = require('../controllers/customers.controller');
const { exportCustomers } = require('../controllers/export.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
router.use(authenticate);
router.get('/meta/filters', getFilterMeta);
router.get('/with-location', getCustomersWithLocation);
router.get('/export', requireAdmin, exportCustomers);
router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', requireAdmin, deleteCustomer);
module.exports = router;
