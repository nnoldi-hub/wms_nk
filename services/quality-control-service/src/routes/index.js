const express = require('express');
const router = express.Router();
const InspectionController = require('../controllers/inspectionController');

router.get('/inspections', InspectionController.getInspections);
router.post('/inspections', InspectionController.createInspection);
router.get('/inspections/:id', InspectionController.getInspectionById);
router.post('/inspections/:id/defects', InspectionController.addDefect);
router.post('/inspections/:id/approve', InspectionController.approveInspection);
router.post('/inspections/:id/reject', InspectionController.rejectInspection);

module.exports = router;
