const express = require('express');
const router = express.Router();
const PickingController = require('../controllers/pickingController');
const { authenticate } = require('../middleware/auth');

// All picking routes require authentication
router.use(authenticate);

// Allocate a picking job from an order
router.post('/orders/:id/allocate', PickingController.allocateFromOrder);

// Pick jobs CRUD-ish
router.get('/pick-jobs', PickingController.listJobs);
router.get('/pick-jobs/:id', PickingController.getJob);
router.get('/pick-jobs/:id/labels.pdf', PickingController.labelsPdf);
router.get('/pick-jobs/:id/labels-reserved.pdf', PickingController.labelsReservedPdf);
router.post('/pick-jobs/:id/accept', PickingController.acceptJob);
// Supervisor: reassign job to another worker
router.post('/pick-jobs/:id/reassign', PickingController.reassignJob);
// Per-item accept/release for multi-picker
router.post('/pick-jobs/:id/items/:itemId/accept', PickingController.acceptJobItem);
router.post('/pick-jobs/:id/items/:itemId/release', PickingController.releaseJobItem);
// Tăiere fizică dintr-un lot + creare rest nou în stoc
router.post('/pick-jobs/:id/items/:itemId/cut', PickingController.cutItem);
router.post('/pick-jobs/:id/pick', PickingController.pickItem);
router.post('/pick-jobs/:id/complete', PickingController.completeJob);
// Mută jobul în zona de expediere + READY_FOR_LOADING pe comandă
router.post('/pick-jobs/:id/move-to-shipping', PickingController.moveToShipping);

// List items (supports mine=1 for per-operator view)
router.get('/pick-items', PickingController.listItems);

module.exports = router;
