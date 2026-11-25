const express = require('express');
const { getAllBoms, getBomByProduct, upsertBom } = require('../controllers/bomController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', authorizeRoles('admin', 'production', 'auditor'), getAllBoms);
router.get('/product/:productId', authorizeRoles('admin', 'production', 'auditor'), getBomByProduct);
router.post('/', authorizeRoles('admin'), upsertBom);

module.exports = router;
