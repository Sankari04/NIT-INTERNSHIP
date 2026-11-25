const express = require('express');
const { listPayments, getCustomerOutstanding, createPayment } = require('../controllers/paymentController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', authorizeRoles('admin', 'auditor'), listPayments);
router.get('/outstanding', authorizeRoles('admin', 'auditor'), getCustomerOutstanding);
router.post('/', authorizeRoles('admin'), createPayment);

module.exports = router;
