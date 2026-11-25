const express = require('express');
const { listPurchases, createPurchase } = require('../controllers/purchaseController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', authorizeRoles('production', 'admin', 'auditor'), listPurchases);
router.post('/', authorizeRoles('production', 'admin'), createPurchase);

module.exports = router;
