const express = require('express');
const router = express.Router();
const TransformationController = require('../controllers/transformationController');

// Get all transformations with filters
router.get('/', TransformationController.getAllTransformations);

// Get transformation statistics
router.get('/statistics', TransformationController.getTransformationStatistics);

// Get transformation tree (source batch -> transformations -> result batches)
router.get('/tree/:batch_id', TransformationController.getTransformationTree);

// Get single transformation by ID
router.get('/:id', TransformationController.getTransformationById);

// Create new transformation
router.post('/', TransformationController.createTransformation);

// Set/Update result batch for an existing transformation
router.put('/:id/result', TransformationController.setTransformationResult);

module.exports = router;
