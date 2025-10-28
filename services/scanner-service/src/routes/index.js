const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');
const { validateScan } = require('../validators/scanValidator');
const rateLimit = require('express-rate-limit');

// Rate limiting
const scanLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many scan requests, please try again later',
});

// POST /api/v1/scanner/scan - Process a barcode/QR scan
router.post('/scan', scanLimiter, validateScan, scanController.processScan);

// GET /api/v1/scanner/validate/:code - Validate a code without processing
router.get('/validate/:code', scanController.validateCode);

// GET /api/v1/scanner/history/:userId - Get scan history for a user
router.get('/history/:userId', scanController.getScanHistory);

// GET /api/v1/scanner/stats - Get scanning statistics
router.get('/stats', scanController.getStats);

module.exports = router;
