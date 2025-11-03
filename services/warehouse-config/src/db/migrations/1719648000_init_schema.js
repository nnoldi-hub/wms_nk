/* eslint-disable camelcase */
/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  // Core tables
  pgm.createTable('warehouses', {
    id: { type: 'uuid', primaryKey: true },
    warehouse_code: { type: 'text', notNull: true },
    warehouse_name: { type: 'text', notNull: true },
    company_name: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('warehouses', 'warehouse_code', { unique: false, ifNotExists: true });

  pgm.createTable('warehouse_zones', {
    id: { type: 'uuid', primaryKey: true },
    warehouse_id: { type: 'uuid', notNull: true, references: 'warehouses', onDelete: 'cascade' },
    zone_code: { type: 'text', notNull: true },
    zone_name: { type: 'text', notNull: true },
    zone_type: { type: 'text' },
    coordinate_x: { type: 'numeric' },
    coordinate_y: { type: 'numeric' },
    width: { type: 'numeric' },
    height: { type: 'numeric' },
    max_pallets: { type: 'integer' },
    max_volume_cubic_meters: { type: 'numeric' },
    temperature_controlled: { type: 'boolean' },
    temperature_min_celsius: { type: 'numeric' },
    temperature_max_celsius: { type: 'numeric' },
    restricted_access: { type: 'boolean' },
    requires_special_equipment: { type: 'boolean' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('warehouse_zones', ['warehouse_id','zone_code'], { ifNotExists: true });

  pgm.createTable('location_types', {
    id: { type: 'uuid', primaryKey: true },
    type_code: { type: 'text', notNull: true },
    type_name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('location_types', 'type_code', { unique: true, ifNotExists: true });

  pgm.createTable('locations', {
    id: { type: 'varchar(50)', primaryKey: true },
    warehouse_id: { type: 'uuid', notNull: true, references: 'warehouses', onDelete: 'cascade' },
    zone_id: { type: 'uuid', notNull: true, references: 'warehouse_zones', onDelete: 'cascade' },
    location_code: { type: 'text', notNull: true },
    barcode: { type: 'text' },
    location_type_id: { type: 'uuid', references: 'location_types' },
    aisle: { type: 'text' },
    rack: { type: 'text' },
    shelf_level: { type: 'integer' },
    bin_position: { type: 'integer' },
    width_cm: { type: 'numeric' },
    depth_cm: { type: 'numeric' },
    height_cm: { type: 'numeric' },
    max_weight_kg: { type: 'numeric' },
    max_volume_cubic_meters: { type: 'numeric' },
    status: { type: 'text', notNull: true, default: 'AVAILABLE' },
    priority_level: { type: 'integer', notNull: true, default: 1 },
    accessibility_level: { type: 'text', notNull: true, default: 'GROUND' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('locations', ['zone_id','location_code'], { ifNotExists: true });

  pgm.createTable('internal_vehicles', {
    id: { type: 'uuid', primaryKey: true },
    warehouse_id: { type: 'uuid', references: 'warehouses', onDelete: 'set null' },
    vehicle_code: { type: 'text', notNull: true },
    license_plate: { type: 'text' },
    current_status: { type: 'text' },
    year: { type: 'integer' },
    has_refrigeration: { type: 'boolean' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('internal_vehicles', 'vehicle_code', { ifNotExists: true });

  pgm.createTable('vehicle_maintenance_history', {
    id: { type: 'uuid', primaryKey: true },
    vehicle_id: { type: 'uuid', notNull: true, references: 'internal_vehicles', onDelete: 'cascade' },
    description: { type: 'text' },
    performed_at: { type: 'timestamptz' },
    odometer_km: { type: 'integer' },
    cost: { type: 'numeric' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });

  pgm.createTable('shipping_carriers', {
    id: { type: 'uuid', primaryKey: true },
    carrier_code: { type: 'text', notNull: true },
    carrier_name: { type: 'text', notNull: true },
    carrier_type: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('shipping_carriers', ['carrier_code','carrier_name'], { ifNotExists: true });

  pgm.createTable('carrier_services', {
    id: { type: 'uuid', primaryKey: true },
    carrier_id: { type: 'uuid', notNull: true, references: 'shipping_carriers', onDelete: 'cascade' },
    service_code: { type: 'text', notNull: true },
    service_name: { type: 'text', notNull: true },
    service_type: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });

  pgm.createTable('packaging_types', {
    id: { type: 'uuid', primaryKey: true },
    category: { type: 'text' },
    packaging_code: { type: 'text', notNull: true },
    packaging_name: { type: 'text', notNull: true },
    is_reusable: { type: 'boolean' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });

  pgm.createTable('package_instances', {
    id: { type: 'uuid', primaryKey: true },
    packaging_type_id: { type: 'uuid', notNull: true, references: 'packaging_types', onDelete: 'cascade' },
    barcode: { type: 'text', notNull: true },
    status: { type: 'text' },
    current_location_id: { type: 'varchar(50)', references: 'locations' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });

  pgm.createTable('delivery_zones', {
    id: { type: 'uuid', primaryKey: true },
    warehouse_id: { type: 'uuid', notNull: true, references: 'warehouses', onDelete: 'cascade' },
    zone_code: { type: 'text', notNull: true },
    zone_name: { type: 'text', notNull: true },
    zone_type: { type: 'text' },
    countries: { type: 'jsonb' },
    regions: { type: 'jsonb' },
    postal_code_patterns: { type: 'jsonb' },
    cities: { type: 'jsonb' },
    boundary_coordinates: { type: 'jsonb' },
    min_order_value: { type: 'numeric' },
    free_shipping_threshold: { type: 'numeric' },
    max_delivery_days: { type: 'integer' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });

  pgm.createTable('zone_carrier_availability', {
    id: { type: 'uuid', primaryKey: true },
    delivery_zone_id: { type: 'uuid', notNull: true, references: 'delivery_zones', onDelete: 'cascade' },
    carrier_id: { type: 'uuid', notNull: true, references: 'shipping_carriers', onDelete: 'cascade' },
    priority: { type: 'integer', notNull: true, default: 5 },
    estimated_delivery_days: { type: 'integer' },
    cost_adjustment: { type: 'numeric', notNull: true, default: 0 },
    is_available: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('zone_carrier_availability', ['delivery_zone_id','carrier_id'], { unique: true, ifNotExists: true });

  pgm.createTable('warehouse_settings', {
    id: { type: 'uuid', primaryKey: true },
    warehouse_id: { type: 'uuid', notNull: true, references: 'warehouses', onDelete: 'cascade' },
    setting_category: { type: 'text', notNull: true },
    setting_key: { type: 'text', notNull: true },
    setting_value: { type: 'jsonb' },
    setting_type: { type: 'text' },
    display_name: { type: 'text' },
    description: { type: 'text' },
    default_value: { type: 'jsonb' },
    validation_rules: { type: 'jsonb' },
    is_editable: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('warehouse_settings', ['warehouse_id','setting_category','setting_key'], { ifNotExists: true });

  // Workflows (minimal)
  pgm.createTable('workflow_states', {
    id: { type: 'uuid', primaryKey: true },
    warehouse_id: { type: 'uuid', references: 'warehouses', onDelete: 'cascade' },
    state_code: { type: 'text', notNull: true },
    state_name: { type: 'text', notNull: true },
    is_terminal: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('workflow_states', ['warehouse_id','state_code'], { unique: true, ifNotExists: true });

  pgm.createTable('workflow_transitions', {
    id: { type: 'uuid', primaryKey: true },
    warehouse_id: { type: 'uuid', references: 'warehouses', onDelete: 'cascade' },
    from_state_id: { type: 'uuid', notNull: true, references: 'workflow_states', onDelete: 'cascade' },
    to_state_id: { type: 'uuid', notNull: true, references: 'workflow_states', onDelete: 'cascade' },
    transition_code: { type: 'text', notNull: true },
    transition_name: { type: 'text', notNull: true },
    guard_rules: { type: 'jsonb' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  }, { ifNotExists: true });
  pgm.createIndex('workflow_transitions', ['warehouse_id','transition_code'], { unique: true, ifNotExists: true });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('workflow_transitions', { ifExists: true });
  pgm.dropTable('workflow_states', { ifExists: true });
  pgm.dropIndex('warehouse_settings', ['warehouse_id','setting_category','setting_key'], { ifExists: true });
  pgm.dropTable('warehouse_settings', { ifExists: true });
  pgm.dropIndex('zone_carrier_availability', ['delivery_zone_id','carrier_id'], { ifExists: true });
  pgm.dropTable('zone_carrier_availability', { ifExists: true });
  pgm.dropTable('delivery_zones', { ifExists: true });
  pgm.dropTable('package_instances', { ifExists: true });
  pgm.dropTable('packaging_types', { ifExists: true });
  pgm.dropTable('carrier_services', { ifExists: true });
  pgm.dropIndex('shipping_carriers', ['carrier_code','carrier_name'], { ifExists: true });
  pgm.dropTable('shipping_carriers', { ifExists: true });
  pgm.dropTable('vehicle_maintenance_history', { ifExists: true });
  pgm.dropIndex('internal_vehicles', 'vehicle_code', { ifExists: true });
  pgm.dropTable('internal_vehicles', { ifExists: true });
  pgm.dropIndex('locations', ['zone_id','location_code'], { ifExists: true });
  pgm.dropTable('locations', { ifExists: true });
  pgm.dropIndex('location_types', 'type_code', { ifExists: true });
  pgm.dropTable('location_types', { ifExists: true });
  pgm.dropIndex('warehouse_zones', ['warehouse_id','zone_code'], { ifExists: true });
  pgm.dropTable('warehouse_zones', { ifExists: true });
  pgm.dropIndex('warehouses', 'warehouse_code', { ifExists: true });
  pgm.dropTable('warehouses', { ifExists: true });
};
