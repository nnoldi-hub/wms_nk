const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest, createProductSchema, updateProductSchema } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// Get all products (paginated, searchable)
router.get('/', productController.getAllProducts);

// Get product by SKU
router.get('/sku/:sku', productController.getProductBySku);

// Create product (admin/manager only)
router.post('/', 
  authorize(['admin', 'manager']),
  validateRequest(createProductSchema),
  productController.createProduct
);

// Update product (admin/manager only)
router.put('/sku/:sku',
  authorize(['admin', 'manager']),
  validateRequest(updateProductSchema),
  productController.updateProduct
);

module.exports = router;
