const express = require('express');
const { getInventoryOverview, getReport } = require('../controllers/reportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/inventory', authorizeRoles('admin', 'production', 'auditor'), getInventoryOverview);
router.get('/:type', authorizeRoles('admin', 'auditor'), getReport);

module.exports = router;
