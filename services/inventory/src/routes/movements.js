const express = require('express');
const router = express.Router();
const movementController = require('../controllers/movementController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest, createMovementSchema, adjustInventorySchema } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// Get movement history
router.get('/', movementController.getMovementHistory);

// Create movement (transfer between locations)
router.post('/',
  authorize(['admin', 'manager', 'operator']),
  validateRequest(createMovementSchema),
  movementController.createMovement
);

// Adjust inventory (manual adjustment)
router.post('/adjust',
  authorize(['admin', 'manager']),
  validateRequest(adjustInventorySchema),
  movementController.adjustInventory
);

module.exports = router;
