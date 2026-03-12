const express = require('express');
const router = express.Router();
const DrumTypesController = require('../controllers/drumTypesController');

router.get('/',  DrumTypesController.list);
router.post('/', DrumTypesController.create);

module.exports = router;
