const express = require('express');
const router = express.Router();
const GoodsReceiptController = require('../controllers/goodsReceiptController');

router.get('/next-number',   GoodsReceiptController.nextNumber);
router.get('/gestiuni',      GoodsReceiptController.getGestiuni);
router.get('/',              GoodsReceiptController.list);
router.get('/:id',           GoodsReceiptController.getById);
router.post('/',             GoodsReceiptController.create);
router.post('/:id/confirm',  GoodsReceiptController.confirm);

module.exports = router;
