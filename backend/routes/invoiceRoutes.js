const express = require('express');
const { listInvoices, createInvoiceFromOrder, cancelInvoice } = require('../controllers/invoiceController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', authorizeRoles('admin', 'auditor'), listInvoices);
router.post('/from-order/:orderId', authorizeRoles('admin'), createInvoiceFromOrder);
router.post('/:id/cancel', authorizeRoles('admin'), cancelInvoice);

module.exports = router;
