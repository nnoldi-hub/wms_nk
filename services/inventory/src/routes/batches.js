const express = require('express');
const router = express.Router();
const BatchController = require('../controllers/batchController');

// Get all batches with filters
router.get('/', BatchController.getAllBatches);

// Get batch statistics
router.get('/statistics', BatchController.getBatchStatistics);

// Select optimal batch
router.get('/select', BatchController.selectOptimalBatch);

// Get batches by product SKU
router.get('/product/:sku', BatchController.getBatchesByProduct);

// Get single batch by ID
router.get('/:id', BatchController.getBatchById);

// Create new batch
router.post('/', BatchController.createBatch);

// Update batch
router.put('/:id', BatchController.updateBatch);

// Delete (soft) batch
router.delete('/:id', BatchController.deleteBatch);

module.exports = router;
