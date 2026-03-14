const express = require('express');
const router = express.Router();
const PurchaseOrderController = require('../controllers/purchaseOrderController');

router.get('/suppliers',    PurchaseOrderController.getSuppliers);
router.get('/next-number',  PurchaseOrderController.nextNumber);
router.post('/import-bulk', PurchaseOrderController.importBulk);
router.get('/',             PurchaseOrderController.list);
router.get('/:id',          PurchaseOrderController.getById);
router.post('/',            PurchaseOrderController.create);
router.patch('/:id/status', PurchaseOrderController.updateStatus);

module.exports = router;
