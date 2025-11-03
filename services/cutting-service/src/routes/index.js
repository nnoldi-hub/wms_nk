const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/orders', orderController.getOrders);
router.post('/orders', orderController.createOrder);
router.get('/orders/:id', orderController.getOrderById);
router.put('/orders/:id', orderController.updateOrder);
router.post('/orders/:id/complete', orderController.completeOrder);
router.get('/orders/:id/suggest-source', orderController.suggestSource);
router.post('/orders/:id/execute', orderController.executeOrder);

module.exports = router;
