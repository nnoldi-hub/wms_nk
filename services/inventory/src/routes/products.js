const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const productController = require('../controllers/productController');
const productImportController = require('../controllers/productImportController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest, createProductSchema, updateProductSchema } = require('../middleware/validation');

// Configure multer for file upload (ensure upload dir exists)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (e) {
      return cb(e);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files allowed.'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// Import products from CSV/Excel (admin/manager only) - MUST come before generic routes
router.post('/import',
  authorize(['admin', 'manager']),
  upload.single('file'),
  productImportController.importProducts
);

// Get available categories (for UI filters)
router.get('/categories', productController.getCategories);

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

// Delete product (admin only)
router.delete('/sku/:sku',
  authorize(['admin']),
  productController.deleteProduct
);

module.exports = router;
