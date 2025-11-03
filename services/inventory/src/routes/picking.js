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
// Per-item accept/release for multi-picker
router.post('/pick-jobs/:id/items/:itemId/accept', PickingController.acceptJobItem);
router.post('/pick-jobs/:id/items/:itemId/release', PickingController.releaseJobItem);
router.post('/pick-jobs/:id/pick', PickingController.pickItem);
router.post('/pick-jobs/:id/complete', PickingController.completeJob);

// List items (supports mine=1 for per-operator view)
router.get('/pick-items', PickingController.listItems);

module.exports = router;
