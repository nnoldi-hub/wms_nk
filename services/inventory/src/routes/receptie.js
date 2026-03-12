const express = require('express');
const router = express.Router();
const ReceptieController = require('../controllers/receptieController');

// GET /api/v1/receptie/units — list all packaging unit types with their UUIDs
router.get('/units', ReceptieController.getUnits);

// POST /api/v1/receptie — create a new batch on goods receipt
router.post('/', ReceptieController.createReceptie);

module.exports = router;
