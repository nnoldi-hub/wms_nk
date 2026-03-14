const express = require('express');
const router = express.Router();
const OrdersController = require('../controllers/ordersController');

// List and get orders
router.get('/orders', OrdersController.listOrders);
router.get('/orders/:id', OrdersController.getOrder);
router.get('/orders/:id/pick-note.pdf', OrdersController.pickNotePdf);
// Actualizare status comandă (READY_FOR_LOADING, LOADED, DELIVERED etc.)
router.patch('/orders/:id/status', OrdersController.updateStatus);

// CSV import
router.post('/orders/import-csv', OrdersController.upload.single('file'), OrdersController.importCsv);

module.exports = router;
