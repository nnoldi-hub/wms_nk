const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate } = require('../middleware/auth');

// All inventory routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/inventory/assign-location
 * Assign product to a warehouse location
 */
router.post('/assign-location', inventoryController.assignProductToLocation);

/**
 * GET /api/v1/inventory/product/:sku
 * Get all inventory items for a product
 */
router.get('/product/:sku', inventoryController.getProductInventory);

/**
 * GET /api/v1/inventory/location/:locationId
 * Get all inventory items in a location
 */
router.get('/location/:locationId', inventoryController.getLocationInventory);

/**
 * GET /api/v1/inventory/qr/:inventoryItemId
 * Generate QR code for an inventory item
 */
router.get('/qr/:inventoryItemId', inventoryController.generateQRCode);

/**
 * GET /api/v1/inventory/stock-summary
 * Get stock summary by warehouse/zone/location
 */
router.get('/stock-summary', inventoryController.getStockSummary);

module.exports = router;
