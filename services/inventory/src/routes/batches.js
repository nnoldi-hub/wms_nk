const express = require('express');
const router = express.Router();
const BatchController = require('../controllers/batchController');
const { authenticate } = require('../middleware/auth');

// All batch routes require authentication
router.use(authenticate);

// Get pending putaway batches (batches without location from confirmed NIRs)
router.get('/pending-putaway', BatchController.getPendingPutaway);

// Confirm putaway: assign location_id to batch and mark as INTACT
router.post('/:id/confirm-putaway', BatchController.confirmPutaway);

// Bulk assign locations to multiple batches (one transaction)
router.post('/bulk-assign', BatchController.bulkAssign);

// Auto-plan putaway: calculate optimal location plan for a NIR or list of batches
router.post('/auto-plan', BatchController.autoPlan);

// Get batch by batch_number (for QR scan lookup)
router.get('/by-number/:batchNumber', BatchController.getByBatchNumber);

// Get all batches with filters
router.get('/', BatchController.getAllBatches);

// Get batch statistics
router.get('/statistics', BatchController.getBatchStatistics);

// Get aggregated dashboard stats (S4.4)
router.get('/dashboard-stats', BatchController.getDashboardStats);

// Select optimal batch
router.get('/select', BatchController.selectOptimalBatch);

// Get batches by product SKU
router.get('/product/:sku', BatchController.getBatchesByProduct);

// Get single batch by ID
router.get('/:id', BatchController.getBatchById);

// Generate label PDF for a batch
router.get('/:id/label.pdf', BatchController.batchLabelPdf);

// Create new batch
router.post('/', BatchController.createBatch);

// Update batch
router.put('/:id', BatchController.updateBatch);

// Delete (soft) batch
router.delete('/:id', BatchController.deleteBatch);

module.exports = router;
