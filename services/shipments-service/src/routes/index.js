const express = require('express');
const router = express.Router();
const ShipmentController = require('../controllers/shipmentController');

router.get('/', ShipmentController.getShipments);
router.post('/', ShipmentController.createShipment);
router.get('/:id', ShipmentController.getShipmentById);
router.put('/:id/track', ShipmentController.updateTracking);
router.post('/:id/ship', ShipmentController.markAsShipped);
router.get('/:id/label', ShipmentController.generateLabel);

module.exports = router;
