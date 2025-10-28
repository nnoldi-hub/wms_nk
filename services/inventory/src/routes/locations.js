const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest, createLocationSchema } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// Get all locations
router.get('/', locationController.getAllLocations);

// Get location by ID
router.get('/:id', locationController.getLocationById);

// Create location (admin/manager only)
router.post('/',
  authorize(['admin', 'manager']),
  validateRequest(createLocationSchema),
  locationController.createLocation
);

module.exports = router;
