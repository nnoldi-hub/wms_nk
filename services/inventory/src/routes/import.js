const express = require('express');
const router = express.Router();
const ImportController = require('../controllers/importController');

// Bulk import products and initial batches
router.post('/import-produse', ImportController.importProducts);

module.exports = router;
