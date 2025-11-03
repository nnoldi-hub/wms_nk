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
router.post('/pick-jobs/:id/accept', PickingController.acceptJob);
router.post('/pick-jobs/:id/pick', PickingController.pickItem);
router.post('/pick-jobs/:id/complete', PickingController.completeJob);

module.exports = router;
