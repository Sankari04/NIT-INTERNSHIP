const express = require('express');
const { listProductionRuns, createProductionRun } = require('../controllers/productionController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', authorizeRoles('production', 'admin', 'auditor'), listProductionRuns);
router.post('/', authorizeRoles('production', 'admin'), createProductionRun);

module.exports = router;
