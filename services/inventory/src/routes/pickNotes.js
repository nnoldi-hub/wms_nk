const express = require('express');
const router = express.Router();
const PickNotesController = require('../controllers/pickNotesController');

// List & detail
router.get('/pick-notes', PickNotesController.list);
router.get('/pick-notes/:id', PickNotesController.getOne);

// Import (ERP webhook + manual JSON)
router.post('/pick-notes/erp-webhook', PickNotesController.erpWebhook);
router.post('/pick-notes/import-json', PickNotesController.importJson);

// Actions on a nota
router.post('/pick-notes/:id/generate-picking', PickNotesController.generatePicking);
router.post('/pick-notes/:id/cancel', PickNotesController.cancel);

module.exports = router;
