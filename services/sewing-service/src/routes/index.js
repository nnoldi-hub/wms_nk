const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/orderController');

router.get('/orders', OrderController.getOrders);
router.post('/orders', OrderController.createOrder);
router.get('/orders/:id', OrderController.getOrderById);
router.put('/orders/:id', OrderController.updateOrder);
router.post('/orders/:id/complete', OrderController.completeOrder);

module.exports = router;
