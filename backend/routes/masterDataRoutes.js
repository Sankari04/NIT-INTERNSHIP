const express = require('express');
const ctrl = require('../controllers/masterDataController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Products
router.get('/products', authorizeRoles('admin', 'salesman', 'production', 'auditor'), ctrl.listProducts);
router.post('/products', authorizeRoles('admin'), ctrl.createProduct);
router.put('/products/:id', authorizeRoles('admin'), ctrl.updateProduct);
router.delete('/products/:id', authorizeRoles('admin'), ctrl.deleteProduct);

// Customers
router.get('/customers', authorizeRoles('admin', 'salesman', 'auditor'), ctrl.listCustomers);
router.post('/customers', authorizeRoles('admin'), ctrl.createCustomer);
router.put('/customers/:id', authorizeRoles('admin'), ctrl.updateCustomer);
router.delete('/customers/:id', authorizeRoles('admin'), ctrl.deleteCustomer);

// Raw Materials
router.get('/raw-materials', authorizeRoles('admin', 'production', 'auditor'), ctrl.listRawMaterials);
router.post('/raw-materials', authorizeRoles('admin'), ctrl.createRawMaterial);
router.put('/raw-materials/:id', authorizeRoles('admin'), ctrl.updateRawMaterial);
router.delete('/raw-materials/:id', authorizeRoles('admin'), ctrl.deleteRawMaterial);

// Packaging Materials
router.get('/packaging-materials', authorizeRoles('admin', 'production', 'auditor'), ctrl.listPackagingMaterials);
router.post('/packaging-materials', authorizeRoles('admin'), ctrl.createPackagingMaterial);
router.put('/packaging-materials/:id', authorizeRoles('admin'), ctrl.updatePackagingMaterial);
router.delete('/packaging-materials/:id', authorizeRoles('admin'), ctrl.deletePackagingMaterial);

// Suppliers
router.get('/suppliers', authorizeRoles('admin', 'production', 'auditor'), ctrl.listSuppliers);
router.post('/suppliers', authorizeRoles('admin'), ctrl.createSupplier);
router.put('/suppliers/:id', authorizeRoles('admin'), ctrl.updateSupplier);
router.delete('/suppliers/:id', authorizeRoles('admin'), ctrl.deleteSupplier);

module.exports = router;
