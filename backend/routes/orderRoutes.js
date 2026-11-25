const express = require('express');
const ctrl = require('../controllers/orderController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', authorizeRoles('admin', 'salesman', 'auditor'), ctrl.listOrders);
router.post('/', authorizeRoles('salesman', 'admin'), ctrl.createOrder);
router.put('/:id', authorizeRoles('admin'), ctrl.updateOrder);
router.patch('/:id/status', authorizeRoles('admin'), ctrl.updateOrderStatus);
router.post('/:id/dispatch', authorizeRoles('admin'), ctrl.dispatchOrder);

module.exports = router;
