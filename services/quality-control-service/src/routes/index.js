const express = require('express');
const router = express.Router();
const InspectionController = require('../controllers/inspectionController');

router.get('/inspections', InspectionController.getInspections);
router.post('/inspections', InspectionController.createInspection);
router.get('/inspections/:id', InspectionController.getInspectionById);
router.put('/inspections/:id', InspectionController.updateInspection);
router.post('/inspections/:id/pass', InspectionController.passInspection);
router.post('/inspections/:id/fail', InspectionController.failInspection);

module.exports = router;
