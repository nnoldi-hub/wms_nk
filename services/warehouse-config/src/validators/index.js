const Joi = require('joi');

// Warehouse schemas
const createWarehouseSchema = Joi.object({
  warehouse_code: Joi.string().max(50).required(),
  warehouse_name: Joi.string().max(200).required(),
  company_name: Joi.string().max(200).required(),
  street: Joi.string().max(200).optional(),
  city: Joi.string().max(100).optional(),
  postal_code: Joi.string().max(20).optional(),
  country: Joi.string().max(100).default('Romania'),
  phone: Joi.string().max(50).optional(),
  email: Joi.string().email().max(100).optional(),
  manager_name: Joi.string().max(100).optional(),
  timezone: Joi.string().max(50).default('Europe/Bucharest'),
  currency: Joi.string().max(10).default('RON'),
  measurement_system: Joi.string().valid('METRIC', 'IMPERIAL').default('METRIC'),
  total_area_sqm: Joi.number().positive().optional(),
  height_meters: Joi.number().positive().optional(),
  layout_type: Joi.string().valid('SINGLE_FLOOR', 'MULTI_FLOOR', 'MEZZANINE').default('SINGLE_FLOOR')
});

const updateWarehouseSchema = Joi.object({
  warehouse_name: Joi.string().max(200).optional(),
  company_name: Joi.string().max(200).optional(),
  street: Joi.string().max(200).optional(),
  city: Joi.string().max(100).optional(),
  postal_code: Joi.string().max(20).optional(),
  country: Joi.string().max(100).optional(),
  phone: Joi.string().max(50).optional(),
  email: Joi.string().email().max(100).optional(),
  manager_name: Joi.string().max(100).optional(),
  timezone: Joi.string().max(50).optional(),
  currency: Joi.string().max(10).optional(),
  measurement_system: Joi.string().valid('METRIC', 'IMPERIAL').optional(),
  total_area_sqm: Joi.number().positive().optional(),
  height_meters: Joi.number().positive().optional(),
  layout_type: Joi.string().valid('SINGLE_FLOOR', 'MULTI_FLOOR', 'MEZZANINE').optional(),
  is_active: Joi.boolean().optional()
});

// Zone schemas
const createZoneSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  zone_code: Joi.string().max(50).required(),
  zone_name: Joi.string().max(100).required(),
  zone_type: Joi.string().valid(
    'RECEIVING', 'QC', 'STORAGE', 'PICKING', 'PACKING', 
    'SHIPPING', 'RETURNS', 'QUARANTINE', 'PRODUCTION', 'STAGING'
  ).required(),
  coordinate_x: Joi.number().optional(),
  coordinate_y: Joi.number().optional(),
  width: Joi.number().positive().optional(),
  height: Joi.number().positive().optional(),
  max_pallets: Joi.number().integer().positive().optional(),
  max_volume_cubic_meters: Joi.number().positive().optional(),
  temperature_controlled: Joi.boolean().default(false),
  temperature_min_celsius: Joi.number().optional(),
  temperature_max_celsius: Joi.number().optional(),
  restricted_access: Joi.boolean().default(false),
  requires_special_equipment: Joi.boolean().default(false)
});

// Location Type schemas
const createLocationTypeSchema = Joi.object({
  code: Joi.string().alphanum().min(1).max(50).required(),
  name: Joi.string().min(2).max(100).required(),
  capacity_type: Joi.string().max(50).optional(),
  default_width_cm: Joi.number().positive().optional(),
  default_depth_cm: Joi.number().positive().optional(),
  default_height_cm: Joi.number().positive().optional(),
  default_max_weight_kg: Joi.number().positive().optional(),
  default_max_volume_cubic_meters: Joi.number().positive().optional(),
  requires_forklift: Joi.boolean().optional(),
  is_pickable: Joi.boolean().optional(),
  is_stackable: Joi.boolean().optional(),
  max_stack_height: Joi.number().integer().positive().optional()
});

const updateLocationTypeSchema = Joi.object({
  code: Joi.string().alphanum().min(1).max(50).optional(),
  name: Joi.string().min(2).max(100).optional(),
  capacity_type: Joi.string().max(50).optional(),
  default_width_cm: Joi.number().positive().optional(),
  default_depth_cm: Joi.number().positive().optional(),
  default_height_cm: Joi.number().positive().optional(),
  default_max_weight_kg: Joi.number().positive().optional(),
  default_max_volume_cubic_meters: Joi.number().positive().optional(),
  requires_forklift: Joi.boolean().optional(),
  is_pickable: Joi.boolean().optional(),
  is_stackable: Joi.boolean().optional(),
  max_stack_height: Joi.number().integer().positive().optional(),
  is_active: Joi.boolean().optional()
}).min(1);

const updateZoneSchema = Joi.object({
  zone_name: Joi.string().max(100).optional(),
  zone_type: Joi.string().valid(
    'RECEIVING', 'QC', 'STORAGE', 'PICKING', 'PACKING', 
    'SHIPPING', 'RETURNS', 'QUARANTINE', 'PRODUCTION', 'STAGING'
  ).optional(),
  coordinate_x: Joi.number().optional(),
  coordinate_y: Joi.number().optional(),
  width: Joi.number().positive().optional(),
  height: Joi.number().positive().optional(),
  max_pallets: Joi.number().integer().positive().optional(),
  max_volume_cubic_meters: Joi.number().positive().optional(),
  temperature_controlled: Joi.boolean().optional(),
  temperature_min_celsius: Joi.number().optional(),
  temperature_max_celsius: Joi.number().optional(),
  restricted_access: Joi.boolean().optional(),
  requires_special_equipment: Joi.boolean().optional(),
  is_active: Joi.boolean().optional()
});

// Location schemas
const createLocationSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  zone_id: Joi.string().uuid().required(),
  location_type_id: Joi.string().uuid().required(),
  location_code: Joi.string().max(100).required(),
  aisle: Joi.string().max(20).optional(),
  rack: Joi.string().max(20).optional(),
  shelf_level: Joi.number().integer().positive().optional(),
  bin_position: Joi.string().max(10).optional(),
  width_cm: Joi.number().positive().optional(),
  depth_cm: Joi.number().positive().optional(),
  height_cm: Joi.number().positive().optional(),
  max_pallets: Joi.number().integer().positive().default(1),
  max_weight_kg: Joi.number().positive().optional(),
  max_volume_cubic_meters: Joi.number().positive().optional(),
  is_pickable: Joi.boolean().default(true),
  priority: Joi.number().integer().min(1).max(10).default(5),
  temperature_controlled: Joi.boolean().default(false),
  requires_forklift: Joi.boolean().default(false),
  accessibility: Joi.string().valid('GROUND', 'LOW', 'MEDIUM', 'HIGH').default('MEDIUM'),
  notes: Joi.string().optional()
});

const bulkCreateLocationsSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  zone_id: Joi.string().uuid().required(),
  location_type_id: Joi.string().uuid().required(),
  naming_pattern: Joi.object({
    zone_prefix: Joi.string().required(),
    aisle_start: Joi.string().required(),
    aisle_end: Joi.string().required(),
    rack_start: Joi.number().integer().positive().required(),
    rack_end: Joi.number().integer().positive().required(),
    shelf_levels: Joi.array().items(Joi.string()).required(),
    bins_per_shelf: Joi.number().integer().positive().required()
  }).required(),
  properties: Joi.object({
    width_cm: Joi.number().positive().optional(),
    depth_cm: Joi.number().positive().optional(),
    height_cm: Joi.number().positive().optional(),
    max_weight_kg: Joi.number().positive().optional(),
    requires_forklift: Joi.boolean().optional(),
    accessibility: Joi.string().valid('GROUND', 'LOW', 'MEDIUM', 'HIGH').optional()
  }).optional()
});

// Packaging schemas
const createPackagingTypeSchema = Joi.object({
  code: Joi.string().max(50).required(),
  name: Joi.string().max(200).required(),
  category: Joi.string().valid('PRIMARY', 'SECONDARY', 'TERTIARY').optional(),
  width_cm: Joi.number().positive().optional(),
  depth_cm: Joi.number().positive().optional(),
  height_cm: Joi.number().positive().optional(),
  weight_empty_kg: Joi.number().positive().optional(),
  volume_liters: Joi.number().positive().optional(),
  max_product_weight_kg: Joi.number().positive().optional(),
  max_product_volume_liters: Joi.number().positive().optional(),
  max_product_length_meters: Joi.number().positive().optional(),
  is_standard: Joi.boolean().default(false),
  standard_name: Joi.string().max(200).optional(),
  requires_forklift: Joi.boolean().default(false),
  is_stackable: Joi.boolean().default(false),
  max_stack_height: Joi.number().integer().positive().default(1),
  is_reusable: Joi.boolean().default(false),
  is_returnable: Joi.boolean().default(false),
  rental_cost_per_day: Joi.number().positive().optional(),
  replacement_cost: Joi.number().positive().optional(),
  current_stock: Joi.number().integer().min(0).default(0),
  min_stock_level: Joi.number().integer().min(0).default(0),
  max_stock_level: Joi.number().integer().min(0).default(0),
  cost_per_unit: Joi.number().positive().optional()
});

// Carrier schemas
const createCarrierSchema = Joi.object({
  carrier_code: Joi.string().max(50).required(),
  carrier_name: Joi.string().max(200).required(),
  carrier_type: Joi.string().valid('COURIER', 'FREIGHT', 'POSTAL').optional(),
  phone: Joi.string().max(50).optional(),
  email: Joi.string().email().max(100).optional(),
  website: Joi.string().max(200).optional(),
  account_number: Joi.string().max(100).optional(),
  has_api_integration: Joi.boolean().default(false),
  api_url: Joi.string().max(500).optional(),
  pricing_model: Joi.string().valid('FLAT_RATE', 'WEIGHT_BASED', 'VOLUME_BASED', 'ZONE_BASED').default('WEIGHT_BASED'),
  base_cost: Joi.number().positive().optional(),
  cost_per_kg: Joi.number().positive().optional(),
  cost_per_km: Joi.number().positive().optional(),
  max_weight_kg: Joi.number().positive().optional(),
  standard_delivery_days: Joi.number().integer().positive().optional(),
  express_delivery_hours: Joi.number().integer().positive().optional(),
  is_preferred: Joi.boolean().default(false),
  priority: Joi.number().integer().min(1).max(10).default(5)
});

// Vehicle schemas
const createVehicleSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  vehicle_code: Joi.string().max(50).required(),
  vehicle_type: Joi.string().valid('VAN', 'TRUCK', 'CAR', 'MOTORCYCLE').required(),
  make: Joi.string().max(100).optional(),
  model: Joi.string().max(100).optional(),
  license_plate: Joi.string().max(50).required(),
  year: Joi.number().integer().min(1900).max(2100).optional(),
  max_weight_kg: Joi.number().positive().optional(),
  max_volume_cubic_meters: Joi.number().positive().optional(),
  max_pallets: Joi.number().integer().positive().optional(),
  has_refrigeration: Joi.boolean().default(false),
  has_lift_gate: Joi.boolean().default(false),
  has_gps: Joi.boolean().default(false),
  cost_per_km: Joi.number().positive().optional(),
  cost_per_hour: Joi.number().positive().optional(),
  fuel_consumption_l_per_100km: Joi.number().positive().optional()
});

// Delivery zone schemas
const createDeliveryZoneSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  zone_code: Joi.string().max(50).required(),
  zone_name: Joi.string().max(200).required(),
  zone_type: Joi.string().valid('LOCAL', 'REGIONAL', 'NATIONAL', 'INTERNATIONAL').required(),
  countries: Joi.array().items(Joi.string()).optional(),
  regions: Joi.array().items(Joi.string()).optional(),
  postal_code_patterns: Joi.array().items(Joi.string()).optional(),
  cities: Joi.array().items(Joi.string()).optional(),
  min_order_value: Joi.number().positive().optional(),
  free_shipping_threshold: Joi.number().positive().optional(),
  max_delivery_days: Joi.number().integer().positive().optional()
});

// Workflow schemas
const createWorkflowStateSchema = Joi.object({
  warehouse_id: Joi.string().uuid().allow(null).optional(),
  state_code: Joi.string().max(50).required(),
  state_name: Joi.string().max(200).required(),
  state_category: Joi.string().valid('RECEIVING','QC','STORAGE','PICKING','PACKING','SHIPPING','RETURNS').optional(),
  color: Joi.string().max(20).optional(),
  icon: Joi.string().max(50).optional(),
  is_initial_state: Joi.boolean().default(false),
  is_final_state: Joi.boolean().default(false),
  requires_location: Joi.boolean().default(false),
  allows_batch_modification: Joi.boolean().default(false),
  is_system: Joi.boolean().default(true),
  display_order: Joi.number().integer().optional()
});

const createWorkflowTransitionSchema = Joi.object({
  warehouse_id: Joi.string().uuid().allow(null).optional(),
  from_state_id: Joi.string().uuid().required(),
  to_state_id: Joi.string().uuid().required(),
  transition_name: Joi.string().max(200).optional(),
  required_role: Joi.string().max(50).optional(),
  requires_approval: Joi.boolean().default(false),
  approver_role: Joi.string().max(50).optional(),
  is_automatic: Joi.boolean().default(false),
  auto_transition_delay_minutes: Joi.number().integer().optional(),
  conditions: Joi.array().items(Joi.object()).optional()
});

// Warehouse settings schemas
const createWarehouseSettingSchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  setting_category: Joi.string().max(100).required(),
  setting_key: Joi.string().max(100).required(),
  setting_value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array()).allow(null).required(),
  setting_type: Joi.string().valid('STRING','NUMBER','BOOLEAN','JSON').default('STRING'),
  display_name: Joi.string().max(200).optional(),
  description: Joi.string().optional(),
  default_value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.object(), Joi.array()).allow(null).optional(),
  validation_rules: Joi.object().optional(),
  is_editable: Joi.boolean().default(true)
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(d => ({
            field: d.path.join('.'),
            message: d.message
          }))
        }
      });
    }

    req.validatedBody = value;
    next();
  };
};

// Query validation helpers
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
        }
      });
    }

    req.validatedQuery = value;
    next();
  };
};

const buildListQuerySchema = (sortByValues, extra = {}) => {
  return Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(25),
    sortBy: Joi.string().valid(...sortByValues).default(sortByValues[0]),
    sortDir: Joi.string().valid('asc', 'desc').default('asc'),
    ...extra
  });
};

// List query schemas
const listWarehousesQuerySchema = buildListQuerySchema(
  ['created_at','updated_at','warehouse_code','warehouse_name','company_name'],
  {
    company_name: Joi.string().max(200),
    is_active: Joi.boolean(),
    q: Joi.string().max(200)
  }
);

const listZonesQuerySchema = buildListQuerySchema(
  ['zone_code','zone_name','zone_type','created_at','updated_at'],
  {
    zone_type: Joi.string().max(50),
    is_active: Joi.boolean()
  }
);

const listLocationsQuerySchema = buildListQuerySchema(
  ['aisle','rack','shelf_level','bin_position','created_at','updated_at','location_code'],
  {
    status: Joi.string().max(50),
    location_type: Joi.string().max(50)
  }
);

const listCarriersQuerySchema = buildListQuerySchema(
  ['carrier_name','carrier_code','created_at','updated_at','carrier_type'],
  {
    carrier_type: Joi.string().max(50),
    is_active: Joi.boolean(),
    q: Joi.string().max(200)
  }
);

const listCarrierServicesQuerySchema = buildListQuerySchema(
  ['service_name','service_code','service_type','created_at','updated_at']
);

const listPackagingTypesQuerySchema = buildListQuerySchema(
  ['category','packaging_name','packaging_code','created_at','updated_at'],
  {
    category: Joi.string().max(50),
    is_reusable: Joi.boolean(),
    is_active: Joi.boolean(),
    q: Joi.string().max(200)
  }
);

const listPackagingInstancesQuerySchema = buildListQuerySchema(
  ['created_at','updated_at','status','barcode'],
  {
    packaging_type_id: Joi.string().uuid(),
    current_location_id: Joi.string().uuid(),
    status: Joi.string().max(50)
  }
);

const listVehiclesQuerySchema = buildListQuerySchema(
  ['vehicle_code','created_at','updated_at','current_status','year'],
  {
    warehouse_id: Joi.string().uuid(),
    status: Joi.string().max(50),
    has_refrigeration: Joi.boolean(),
    is_active: Joi.boolean(),
    q: Joi.string().max(200)
  }
);

const listSettingsQuerySchema = buildListQuerySchema(
  ['setting_category','setting_key','created_at','updated_at'],
  {
    category: Joi.string().max(100)
  }
);

module.exports = {
  validate,
  validateQuery,
  buildListQuerySchema,
  createWarehouseSchema,
  updateWarehouseSchema,
  createZoneSchema,
  updateZoneSchema,
  createLocationSchema,
  bulkCreateLocationsSchema,
  createLocationTypeSchema,
  updateLocationTypeSchema,
  createPackagingTypeSchema,
  createCarrierSchema,
  createVehicleSchema,
  createDeliveryZoneSchema,
  createWorkflowStateSchema,
  createWorkflowTransitionSchema
  ,createWarehouseSettingSchema,
  // query schemas
  listWarehousesQuerySchema,
  listZonesQuerySchema,
  listLocationsQuerySchema,
  listCarriersQuerySchema,
  listCarrierServicesQuerySchema,
  listPackagingTypesQuerySchema,
  listPackagingInstancesQuerySchema,
  listVehiclesQuerySchema,
  listSettingsQuerySchema
};
