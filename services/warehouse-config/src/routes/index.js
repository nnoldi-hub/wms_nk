const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const zoneController = require('../controllers/zoneController');
const locationController = require('../controllers/locationController');
const locationTypeController = require('../controllers/locationTypeController');
const packagingController = require('../controllers/packagingController');
const carrierController = require('../controllers/carrierController');
const vehicleController = require('../controllers/vehicleController');
const deliveryZoneController = require('../controllers/deliveryZoneController');
const workflowController = require('../controllers/workflowController');
const warehouseSettingsController = require('../controllers/warehouseSettingsController');
const { authMiddleware, adminOnly, managerOrAdmin } = require('../middleware/auth');
const { 
  validate, 
  validateQuery,
  createWarehouseSchema, 
  updateWarehouseSchema, 
  createZoneSchema, 
  updateZoneSchema,
  createLocationSchema,
  bulkCreateLocationsSchema,
  createPackagingTypeSchema,
  createCarrierSchema,
  createVehicleSchema,
  createDeliveryZoneSchema,
  createLocationTypeSchema,
  updateLocationTypeSchema
} = require('../validators');
const {
  listWarehousesQuerySchema,
  listZonesQuerySchema,
  listLocationsQuerySchema,
  listCarriersQuerySchema,
  listCarrierServicesQuerySchema,
  listPackagingTypesQuerySchema,
  listPackagingInstancesQuerySchema,
  listVehiclesQuerySchema,
  listSettingsQuerySchema
} = require('../validators');

// In non-production environments, expose /dev routes BEFORE auth middleware so they are public.
if (process.env.NODE_ENV !== 'production') {
  try {
    const devRoutes = require('./dev');
    router.use('/dev', devRoutes);
  } catch (e) {
    // ignore if not present
  }
}

// All routes require authentication
router.use(authMiddleware);

// Lightweight auth utilities
try {
  const authRoutes = require('./auth');
  router.use('/auth', authRoutes);
} catch (e) {
  // no-op if missing
}

// ============================================================================
// WAREHOUSE ROUTES
// ============================================================================

// GET /api/v1/warehouses - Get all warehouses
router.get('/warehouses', validateQuery(listWarehousesQuerySchema), warehouseController.getAll);

// GET /api/v1/warehouses/:id - Get warehouse by ID
router.get('/warehouses/:id', warehouseController.getById);

// GET /api/v1/warehouses/:id/statistics - Get warehouse statistics
router.get('/warehouses/:id/statistics', warehouseController.getStatistics);

// POST /api/v1/warehouses - Create new warehouse (Admin only)
router.post('/warehouses', 
  adminOnly,
  validate(createWarehouseSchema),
  warehouseController.create
);

// PUT /api/v1/warehouses/:id - Update warehouse (Manager or Admin)
router.put('/warehouses/:id',
  managerOrAdmin,
  validate(updateWarehouseSchema),
  warehouseController.update
);

// POST /api/v1/warehouses/:id/complete-setup - Mark setup as complete (Admin only)
router.post('/warehouses/:id/complete-setup',
  adminOnly,
  warehouseController.completeSetup
);

// DELETE /api/v1/warehouses/:id - Delete warehouse (Admin only)
router.delete('/warehouses/:id',
  adminOnly,
  warehouseController.delete
);

// ============================================================================
// ZONE ROUTES
// ============================================================================

// GET /api/v1/warehouses/:warehouseId/zones - Get all zones for warehouse
router.get('/warehouses/:warehouseId/zones', validateQuery(listZonesQuerySchema), zoneController.getAll);

// GET /api/v1/zones/:id - Get zone by ID
router.get('/zones/:id', zoneController.getById);

// POST /api/v1/zones - Create new zone (Manager or Admin)
router.post('/zones',
  managerOrAdmin,
  validate(createZoneSchema),
  zoneController.create
);

// PUT /api/v1/zones/:id - Update zone (Manager or Admin)
router.put('/zones/:id',
  managerOrAdmin,
  validate(updateZoneSchema),
  zoneController.update
);

// DELETE /api/v1/zones/:id - Delete zone (Admin only)
router.delete('/zones/:id',
  adminOnly,
  zoneController.delete
);

// ============================================================================
// LOCATION ROUTES
// ============================================================================

// GET /api/v1/zones/:zoneId/locations - Get all locations for zone
router.get('/zones/:zoneId/locations', validateQuery(listLocationsQuerySchema), locationController.getAll);

// GET /api/v1/locations/:id - Get location by ID
router.get('/locations/:id', locationController.getById);

// POST /api/v1/locations - Create new location (Manager or Admin)
router.post('/locations',
  managerOrAdmin,
  validate(createLocationSchema),
  locationController.create
);

// POST /api/v1/locations/bulk - Bulk create locations (Manager or Admin)
router.post('/locations/bulk',
  managerOrAdmin,
  validate(bulkCreateLocationsSchema),
  locationController.bulkCreate
);

// PUT /api/v1/locations/:id - Update location (Manager or Admin)
router.put('/locations/:id',
  managerOrAdmin,
  locationController.update
);

// DELETE /api/v1/locations/:id - Delete location (Admin only)
router.delete('/locations/:id',
  adminOnly,
  locationController.delete
);

// GET /api/v1/locations/:id/barcode - Generate barcode for location
router.get('/locations/:id/barcode', locationController.generateBarcode);

// ============================================================================
// LOCATION TYPE ROUTES
// ============================================================================

// GET /api/v1/location-types - list all location types
router.get('/location-types', locationTypeController.getAll);

// GET /api/v1/location-types/:id - get by id
router.get('/location-types/:id', locationTypeController.getById);

// POST /api/v1/location-types - create (Admin only)
router.post('/location-types', adminOnly, validate(createLocationTypeSchema), locationTypeController.create);

// PUT /api/v1/location-types/:id - update (Admin only)
router.put('/location-types/:id', adminOnly, validate(updateLocationTypeSchema), locationTypeController.update);

// ============================================================================
// PACKAGING ROUTES
// ============================================================================

// GET /api/v1/packaging/types - Get all packaging types
router.get('/packaging/types', validateQuery(listPackagingTypesQuerySchema), packagingController.getAllTypes);

// GET /api/v1/packaging/types/:id - Get packaging type by ID
router.get('/packaging/types/:id', packagingController.getTypeById);

// POST /api/v1/packaging/types - Create packaging type (Admin only)
router.post('/packaging/types',
  adminOnly,
  validate(createPackagingTypeSchema),
  packagingController.createType
);

// PUT /api/v1/packaging/types/:id - Update packaging type (Admin only)
router.put('/packaging/types/:id',
  adminOnly,
  packagingController.updateType
);

// GET /api/v1/packaging/instances - Get all package instances
router.get('/packaging/instances', validateQuery(listPackagingInstancesQuerySchema), packagingController.getAllInstances);

// POST /api/v1/packaging/instances - Create package instance
router.post('/packaging/instances',
  managerOrAdmin,
  packagingController.createInstance
);

// PUT /api/v1/packaging/instances/:id/status - Update package instance status
router.put('/packaging/instances/:id/status',
  managerOrAdmin,
  packagingController.updateInstanceStatus
);

// GET /api/v1/packaging/inventory - Get packaging inventory report
router.get('/packaging/inventory', packagingController.getInventoryReport);

// ============================================================================
// CARRIER ROUTES
// ============================================================================

// GET /api/v1/carriers - Get all carriers
router.get('/carriers', validateQuery(listCarriersQuerySchema), carrierController.getAll);

// GET /api/v1/carriers/:id - Get carrier by ID
router.get('/carriers/:id', carrierController.getById);

// POST /api/v1/carriers - Create carrier (Admin only)
router.post('/carriers',
  adminOnly,
  validate(createCarrierSchema),
  carrierController.create
);

// PUT /api/v1/carriers/:id - Update carrier (Admin only)
router.put('/carriers/:id',
  adminOnly,
  carrierController.update
);

// DELETE /api/v1/carriers/:id - Delete carrier (Admin only)
router.delete('/carriers/:id',
  adminOnly,
  carrierController.delete
);

// GET /api/v1/carriers/:carrierId/services - Get carrier services
router.get('/carriers/:carrierId/services', validateQuery(listCarrierServicesQuerySchema), carrierController.getServices);

// POST /api/v1/carriers/services - Create carrier service (Admin only)
router.post('/carriers/services',
  adminOnly,
  carrierController.createService
);

// ============================================================================
// VEHICLE ROUTES
// ============================================================================

// GET /api/v1/vehicles - list vehicles
router.get('/vehicles', validateQuery(listVehiclesQuerySchema), vehicleController.getAll);

// GET /api/v1/vehicles/:id - get by id
router.get('/vehicles/:id', vehicleController.getById);

// POST /api/v1/vehicles - create
router.post('/vehicles',
  managerOrAdmin,
  validate(createVehicleSchema),
  vehicleController.create
);

// PUT /api/v1/vehicles/:id - update generic fields
router.put('/vehicles/:id', managerOrAdmin, vehicleController.update);

// PUT /api/v1/vehicles/:id/status - update status/assignment
router.put('/vehicles/:id/status', managerOrAdmin, vehicleController.updateStatus);

// POST /api/v1/vehicles/:id/maintenance - add maintenance record
router.post('/vehicles/:id/maintenance', managerOrAdmin, vehicleController.addMaintenance);

// GET /api/v1/vehicles/:id/maintenance - list maintenance history
router.get('/vehicles/:id/maintenance', vehicleController.listMaintenance);

// DELETE /api/v1/vehicles/:id - soft delete
router.delete('/vehicles/:id', adminOnly, vehicleController.delete);

// ============================================================================
// DELIVERY ZONE ROUTES
// ============================================================================

// GET /api/v1/warehouses/:warehouseId/delivery-zones
router.get('/warehouses/:warehouseId/delivery-zones', deliveryZoneController.getAll);

// GET /api/v1/delivery-zones/:id
router.get('/delivery-zones/:id', deliveryZoneController.getById);

// POST /api/v1/delivery-zones
router.post('/delivery-zones',
  managerOrAdmin,
  validate(createDeliveryZoneSchema),
  deliveryZoneController.create
);

// PUT /api/v1/delivery-zones/:id
router.put('/delivery-zones/:id', managerOrAdmin, deliveryZoneController.update);

// DELETE /api/v1/delivery-zones/:id
router.delete('/delivery-zones/:id', adminOnly, deliveryZoneController.delete);

// GET /api/v1/delivery-zones/:zoneId/carriers
router.get('/delivery-zones/:zoneId/carriers', deliveryZoneController.getCarriers);

// POST /api/v1/delivery-zones/:zoneId/carriers
router.post('/delivery-zones/:zoneId/carriers', managerOrAdmin, deliveryZoneController.upsertCarrier);

// ============================================================================
// WORKFLOW ROUTES
// ============================================================================

// States
router.get('/warehouses/:warehouseId/workflow/states', workflowController.listStates);
router.post('/workflow/states', adminOnly, validate(require('../validators').createWorkflowStateSchema), workflowController.createState);
router.put('/workflow/states/:id', adminOnly, workflowController.updateState);

// Transitions
router.get('/warehouses/:warehouseId/workflow/transitions', workflowController.listTransitions);
router.post('/workflow/transitions', adminOnly, validate(require('../validators').createWorkflowTransitionSchema), workflowController.createTransition);
router.put('/workflow/transitions/:id', adminOnly, workflowController.updateTransition);

// Validation
router.post('/workflow/validate-transition', workflowController.validateTransition);

// ============================================================================
// WAREHOUSE SETTINGS ROUTES
// ============================================================================

// GET /api/v1/warehouses/:warehouseId/settings?category=INVENTORY
router.get('/warehouses/:warehouseId/settings', validateQuery(listSettingsQuerySchema), warehouseSettingsController.list);

// GET /api/v1/warehouse-settings/:id
router.get('/warehouse-settings/:id', warehouseSettingsController.getById);

// POST /api/v1/warehouse-settings (Admin only)
router.post('/warehouse-settings',
  adminOnly,
  validate(require('../validators').createWarehouseSettingSchema),
  warehouseSettingsController.create
);

// PUT /api/v1/warehouse-settings/:id (Admin only)
router.put('/warehouse-settings/:id', adminOnly, warehouseSettingsController.update);

// DELETE /api/v1/warehouse-settings/:id (Admin only)
router.delete('/warehouse-settings/:id', adminOnly, warehouseSettingsController.remove);

module.exports = router;
