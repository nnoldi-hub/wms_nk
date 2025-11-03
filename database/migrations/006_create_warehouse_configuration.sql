-- ============================================================================
-- WMS Configuration Schema
-- Database setup pentru configurare completă depozit
-- ============================================================================

-- ============================================================================
-- 1. WAREHOUSE & ZONES
-- ============================================================================

-- Warehouse main info
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_code VARCHAR(50) UNIQUE NOT NULL,  -- WH-NK-001
    warehouse_name VARCHAR(200) NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    
    -- Address
    street VARCHAR(200),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Romania',
    
    -- Contact
    phone VARCHAR(50),
    email VARCHAR(100),
    manager_name VARCHAR(100),
    
    -- Settings
    timezone VARCHAR(50) DEFAULT 'Europe/Bucharest',
    currency VARCHAR(10) DEFAULT 'RON',
    measurement_system VARCHAR(20) DEFAULT 'METRIC',  -- METRIC or IMPERIAL
    
    -- Dimensions
    total_area_sqm DECIMAL(10,2),
    height_meters DECIMAL(5,2),
    layout_type VARCHAR(50) DEFAULT 'SINGLE_FLOOR',  -- SINGLE_FLOOR, MULTI_FLOOR, MEZZANINE
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    setup_completed BOOLEAN DEFAULT false,
    setup_completed_at TIMESTAMP,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Warehouse floors (for multi-floor warehouses)
CREATE TABLE IF NOT EXISTS warehouse_floors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    floor_name VARCHAR(100),  -- "Ground Floor", "Floor 1", "Mezzanine"
    area_sqm DECIMAL(10,2),
    height_meters DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, floor_number)
);

-- Warehouse zones (logical areas)
CREATE TABLE IF NOT EXISTS warehouse_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    floor_id UUID REFERENCES warehouse_floors(id),
    
    -- Identification
    zone_code VARCHAR(50) NOT NULL,  -- RCV-01, STG-A, PICK-01
    zone_name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(50) NOT NULL,  -- RECEIVING, QC, STORAGE, PICKING, PACKING, SHIPPING, RETURNS, QUARANTINE, PRODUCTION, STAGING
    
    -- Visual coordinates (for map)
    coordinate_x DECIMAL(10,2),
    coordinate_y DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    
    -- Capacity
    max_pallets INTEGER,
    max_volume_cubic_meters DECIMAL(10,2),
    current_occupancy_percent DECIMAL(5,2) DEFAULT 0,
    
    -- Properties
    temperature_controlled BOOLEAN DEFAULT false,
    temperature_min_celsius DECIMAL(5,2),
    temperature_max_celsius DECIMAL(5,2),
    restricted_access BOOLEAN DEFAULT false,
    requires_special_equipment BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(warehouse_id, zone_code)
);

-- Zone access permissions (which users can access which zones)
CREATE TABLE IF NOT EXISTS zone_access_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES warehouse_zones(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_read BOOLEAN DEFAULT true,
    can_write BOOLEAN DEFAULT false,
    can_manage BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zone_id, user_id)
);

-- ============================================================================
-- 2. LOCATIONS
-- ============================================================================

-- Location types (Pallet rack, Shelf, Bin, Floor, etc.)
CREATE TABLE IF NOT EXISTS location_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,  -- PALLET, SHELF, BIN, FLOOR
    name VARCHAR(100) NOT NULL,
    capacity_type VARCHAR(50),  -- PALLET, SHELF, BIN, FLOOR
    
    -- Default dimensions
    default_width_cm DECIMAL(10,2),
    default_depth_cm DECIMAL(10,2),
    default_height_cm DECIMAL(10,2),
    default_max_weight_kg DECIMAL(10,2),
    default_max_volume_cubic_meters DECIMAL(10,2),
    
    -- Properties
    requires_forklift BOOLEAN DEFAULT false,
    is_pickable BOOLEAN DEFAULT true,
    is_stackable BOOLEAN DEFAULT false,
    max_stack_height INTEGER DEFAULT 1,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,  -- System-defined, cannot be deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations (actual physical locations in warehouse)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES warehouse_zones(id) ON DELETE CASCADE,
    location_type_id UUID NOT NULL REFERENCES location_types(id),
    
    -- Identification
    location_code VARCHAR(100) UNIQUE NOT NULL,  -- STG-A01-A1
    barcode VARCHAR(200) UNIQUE,
    qr_code TEXT,
    
    -- Hierarchy (for organized storage)
    aisle VARCHAR(20),      -- A01, A02, B01
    rack VARCHAR(20),       -- 01, 02, 03
    shelf_level INTEGER,    -- 1, 2, 3, 4
    bin_position VARCHAR(10), -- A, B, C
    
    -- Dimensions
    width_cm DECIMAL(10,2),
    depth_cm DECIMAL(10,2),
    height_cm DECIMAL(10,2),
    
    -- Capacity
    max_pallets INTEGER DEFAULT 1,
    max_weight_kg DECIMAL(10,2),
    max_volume_cubic_meters DECIMAL(10,2),
    current_occupancy_percent DECIMAL(5,2) DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'AVAILABLE',  -- AVAILABLE, OCCUPIED, RESERVED, BLOCKED, MAINTENANCE
    is_pickable BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5,  -- 1=highest priority for auto-allocation
    
    -- Physical properties
    temperature_controlled BOOLEAN DEFAULT false,
    requires_forklift BOOLEAN DEFAULT false,
    accessibility VARCHAR(50) DEFAULT 'MEDIUM',  -- GROUND, LOW, MEDIUM, HIGH
    
    -- Tracking
    last_inventory_check TIMESTAMP,
    last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Location naming convention configuration
CREATE TABLE IF NOT EXISTS location_naming_conventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    
    -- Format pattern
    format_pattern VARCHAR(200),  -- "{zone}-{aisle}{rack}-{shelf}{bin}"
    separator VARCHAR(10) DEFAULT '-',
    
    -- Component formats
    zone_prefix_format VARCHAR(50),    -- "STG", "RCV", etc.
    aisle_format VARCHAR(50),          -- "[A-Z][01-99]"
    rack_format VARCHAR(50),           -- "[01-50]"
    shelf_format VARCHAR(50),          -- "[A-E]"
    bin_format VARCHAR(50),            -- "[1-10]"
    
    -- Examples
    example_codes JSONB,  -- ["STG-A01-A1", "STG-A01-B2"]
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(warehouse_id)
);

-- Product-Location preferences (which products prefer which locations)
CREATE TABLE IF NOT EXISTS product_location_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_sku VARCHAR(100) NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    preference_rank INTEGER DEFAULT 1,  -- 1=most preferred
    reason VARCHAR(200),  -- "Fast mover", "Fragile", "Heavy", etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_sku, location_id)
);

-- ============================================================================
-- 3. PACKAGING TYPES
-- ============================================================================

CREATE TABLE IF NOT EXISTS packaging_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    code VARCHAR(50) UNIQUE NOT NULL,  -- DRUM, PALLET, BOX, ROLL
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50),  -- PRIMARY, SECONDARY, TERTIARY
    
    -- Dimensions
    width_cm DECIMAL(10,2),
    depth_cm DECIMAL(10,2),
    height_cm DECIMAL(10,2),
    weight_empty_kg DECIMAL(10,2),
    volume_liters DECIMAL(10,2),
    
    -- Capacity
    max_product_weight_kg DECIMAL(10,2),
    max_product_volume_liters DECIMAL(10,2),
    max_product_length_meters DECIMAL(10,2),  -- For rolls/drums
    
    -- Standards
    is_standard BOOLEAN DEFAULT false,
    standard_name VARCHAR(200),  -- "EUR Pallet 800x1200mm", "ISO Container 20ft"
    
    -- Handling
    requires_forklift BOOLEAN DEFAULT false,
    is_stackable BOOLEAN DEFAULT false,
    max_stack_height INTEGER DEFAULT 1,
    
    -- Reusability
    is_reusable BOOLEAN DEFAULT false,
    is_returnable BOOLEAN DEFAULT false,
    rental_cost_per_day DECIMAL(10,2),
    replacement_cost DECIMAL(10,2),
    
    -- Tracking
    has_barcode BOOLEAN DEFAULT false,
    barcode_format VARCHAR(100),  -- "PKG-{TYPE}-{NUMBER}"
    requires_individual_tracking BOOLEAN DEFAULT false,  -- Track each package individually
    
    -- Inventory
    current_stock INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    max_stock_level INTEGER DEFAULT 0,
    cost_per_unit DECIMAL(10,2),
    
    -- Image
    image_url TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual package instances (pentru returnable/reusable packages)
CREATE TABLE IF NOT EXISTS package_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    packaging_type_id UUID NOT NULL REFERENCES packaging_types(id),
    
    -- Identification
    instance_code VARCHAR(100) UNIQUE NOT NULL,  -- T-2024-001, P-2024-015
    barcode VARCHAR(200) UNIQUE,
    rfid_tag VARCHAR(100),
    
    -- Status
    status VARCHAR(50) DEFAULT 'AVAILABLE',  -- AVAILABLE, IN_USE, DAMAGED, MAINTENANCE, LOST
    condition VARCHAR(50) DEFAULT 'GOOD',  -- GOOD, FAIR, POOR, DAMAGED
    
    -- Tracking
    current_location_id UUID REFERENCES locations(id),
    current_batch_id UUID REFERENCES product_batches(id),
    
    -- Rental tracking (for returnable packages)
    rented_to_customer_id UUID REFERENCES customers(id),
    rented_at TIMESTAMP,
    expected_return_date DATE,
    returned_at TIMESTAMP,
    
    -- Maintenance
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    total_uses INTEGER DEFAULT 0,
    max_uses INTEGER,  -- Replace after N uses
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Package inventory movements
CREATE TABLE IF NOT EXISTS package_inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    packaging_type_id UUID NOT NULL REFERENCES packaging_types(id),
    
    movement_type VARCHAR(50) NOT NULL,  -- PURCHASE, USE, RETURN, DAMAGE, DISPOSAL
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    
    reference_type VARCHAR(50),  -- BATCH, ORDER, SUPPLIER
    reference_id UUID,
    
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- ============================================================================
-- 4. DELIVERY METHODS & CARRIERS
-- ============================================================================

-- Shipping carriers (couriers, freight companies)
CREATE TABLE IF NOT EXISTS shipping_carriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification
    carrier_code VARCHAR(50) UNIQUE NOT NULL,  -- FAN, DPD, UPS
    carrier_name VARCHAR(200) NOT NULL,
    carrier_type VARCHAR(50),  -- COURIER, FREIGHT, POSTAL
    
    -- Contact
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(200),
    account_number VARCHAR(100),
    
    -- API Integration
    has_api_integration BOOLEAN DEFAULT false,
    api_url VARCHAR(500),
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    api_config JSONB,  -- Additional API settings
    
    -- Pricing
    pricing_model VARCHAR(50) DEFAULT 'WEIGHT_BASED',  -- FLAT_RATE, WEIGHT_BASED, VOLUME_BASED, ZONE_BASED
    base_cost DECIMAL(10,2),
    cost_per_kg DECIMAL(10,2),
    cost_per_km DECIMAL(10,2),
    cost_per_cubic_meter DECIMAL(10,2),
    
    -- Constraints
    max_weight_kg DECIMAL(10,2),
    max_length_cm DECIMAL(10,2),
    max_width_cm DECIMAL(10,2),
    max_height_cm DECIMAL(10,2),
    
    -- SLA
    standard_delivery_days INTEGER,
    express_delivery_hours INTEGER,
    
    -- Performance tracking
    total_shipments INTEGER DEFAULT 0,
    on_time_deliveries INTEGER DEFAULT 0,
    on_time_percentage DECIMAL(5,2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_preferred BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 5,  -- 1=highest priority for auto-selection
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Carrier services (Standard, Express, Overnight, etc.)
CREATE TABLE IF NOT EXISTS carrier_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id UUID NOT NULL REFERENCES shipping_carriers(id) ON DELETE CASCADE,
    
    service_code VARCHAR(50) NOT NULL,  -- STANDARD, EXPRESS, OVERNIGHT
    service_name VARCHAR(200) NOT NULL,
    
    delivery_time_hours INTEGER,
    cost_multiplier DECIMAL(5,2) DEFAULT 1.0,  -- Multiply base cost
    
    -- Availability
    available_days JSONB,  -- ["Monday", "Tuesday", ...]
    cutoff_time TIME,  -- Orders after this time go next day
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(carrier_id, service_code)
);

-- Internal delivery fleet
CREATE TABLE IF NOT EXISTS internal_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    
    -- Identification
    vehicle_code VARCHAR(50) UNIQUE NOT NULL,  -- VAN-01, TRUCK-02
    vehicle_type VARCHAR(50),  -- VAN, TRUCK, CAR, MOTORCYCLE
    
    -- Details
    make VARCHAR(100),  -- Mercedes, Volvo, etc.
    model VARCHAR(100),
    license_plate VARCHAR(50),
    year INTEGER,
    vin VARCHAR(100),
    
    -- Capacity
    max_weight_kg DECIMAL(10,2),
    max_volume_cubic_meters DECIMAL(10,2),
    max_pallets INTEGER,
    
    -- Features
    has_refrigeration BOOLEAN DEFAULT false,
    has_lift_gate BOOLEAN DEFAULT false,
    has_gps BOOLEAN DEFAULT false,
    gps_device_id VARCHAR(100),
    
    -- Assignment
    assigned_driver_id UUID REFERENCES users(id),
    current_status VARCHAR(50) DEFAULT 'AVAILABLE',  -- AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_SERVICE
    
    -- Location tracking
    current_latitude DECIMAL(10,8),
    current_longitude DECIMAL(11,8),
    last_location_update TIMESTAMP,
    
    -- Costs
    cost_per_km DECIMAL(10,2),
    cost_per_hour DECIMAL(10,2),
    fuel_consumption_l_per_100km DECIMAL(5,2),
    
    -- Maintenance
    last_service_date DATE,
    next_service_date DATE,
    last_service_odometer_km INTEGER,
    current_odometer_km INTEGER,
    
    -- Insurance
    insurance_company VARCHAR(200),
    insurance_policy_number VARCHAR(100),
    insurance_expiry_date DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle maintenance history
CREATE TABLE IF NOT EXISTS vehicle_maintenance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES internal_vehicles(id) ON DELETE CASCADE,
    
    maintenance_type VARCHAR(50),  -- ROUTINE, REPAIR, INSPECTION
    description TEXT,
    cost DECIMAL(10,2),
    odometer_km INTEGER,
    
    performed_at TIMESTAMP,
    performed_by VARCHAR(200),  -- Service center name
    next_maintenance_date DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery zones (geographic areas)
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    
    -- Identification
    zone_code VARCHAR(50) NOT NULL,
    zone_name VARCHAR(200) NOT NULL,
    zone_type VARCHAR(50),  -- LOCAL, REGIONAL, NATIONAL, INTERNATIONAL
    
    -- Geographic coverage
    countries JSONB,  -- ["RO", "HU"]
    regions JSONB,    -- ["București", "Ilfov"]
    postal_code_patterns JSONB,  -- ["01*", "02*"]
    cities JSONB,
    
    -- Polygon coordinates (for map visualization)
    boundary_coordinates JSONB,  -- [{"lat": 44.4268, "lng": 26.1025}, ...]
    
    -- Constraints
    min_order_value DECIMAL(10,2),
    free_shipping_threshold DECIMAL(10,2),
    max_delivery_days INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(warehouse_id, zone_code)
);

-- Carrier availability per zone
CREATE TABLE IF NOT EXISTS zone_carrier_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_zone_id UUID NOT NULL REFERENCES delivery_zones(id) ON DELETE CASCADE,
    carrier_id UUID NOT NULL REFERENCES shipping_carriers(id) ON DELETE CASCADE,
    
    priority INTEGER DEFAULT 5,  -- 1=first choice
    estimated_delivery_days INTEGER,
    cost_adjustment DECIMAL(10,2) DEFAULT 0,  -- +/- adjustment to base cost
    
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(delivery_zone_id, carrier_id)
);

-- ============================================================================
-- 5. WORKFLOW CONFIGURATION
-- ============================================================================

-- Workflow states (product lifecycle states)
CREATE TABLE IF NOT EXISTS workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id),
    
    state_code VARCHAR(50) NOT NULL,  -- RECEIVING, QC_PENDING, STORED, etc.
    state_name VARCHAR(200) NOT NULL,
    state_category VARCHAR(50),  -- RECEIVING, QC, STORAGE, PICKING, PACKING, SHIPPING, RETURNS
    
    -- Visual
    color VARCHAR(20),  -- For UI display
    icon VARCHAR(50),
    
    -- Properties
    is_initial_state BOOLEAN DEFAULT false,
    is_final_state BOOLEAN DEFAULT false,
    requires_location BOOLEAN DEFAULT false,
    allows_batch_modification BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT true,  -- System-defined, cannot be deleted
    display_order INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(warehouse_id, state_code)
);

-- Workflow transitions (how to move between states)
CREATE TABLE IF NOT EXISTS workflow_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id),
    
    from_state_id UUID NOT NULL REFERENCES workflow_states(id),
    to_state_id UUID NOT NULL REFERENCES workflow_states(id),
    
    transition_name VARCHAR(200),
    
    -- Permissions
    required_role VARCHAR(50),  -- Only users with this role can make transition
    requires_approval BOOLEAN DEFAULT false,
    approver_role VARCHAR(50),
    
    -- Automation
    is_automatic BOOLEAN DEFAULT false,  -- Happens automatically
    auto_transition_delay_minutes INTEGER,
    
    -- Conditions (JSON rules)
    conditions JSONB,  -- [{"field": "qc_status", "operator": "equals", "value": "APPROVED"}]
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(warehouse_id, from_state_id, to_state_id)
);

-- Workflow actions (what happens during transition)
CREATE TABLE IF NOT EXISTS workflow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transition_id UUID NOT NULL REFERENCES workflow_transitions(id) ON DELETE CASCADE,
    
    action_type VARCHAR(50) NOT NULL,  -- SEND_EMAIL, UPDATE_LOCATION, GENERATE_LABEL, NOTIFY_USER, CREATE_TASK
    action_name VARCHAR(200),
    
    -- Action parameters (JSON)
    action_params JSONB,
    
    -- Execution
    execution_order INTEGER DEFAULT 1,
    continue_on_error BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Batch state history (track product batch through workflow)
CREATE TABLE IF NOT EXISTS batch_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES product_batches(id) ON DELETE CASCADE,
    
    from_state_id UUID REFERENCES workflow_states(id),
    to_state_id UUID NOT NULL REFERENCES workflow_states(id),
    transition_id UUID REFERENCES workflow_transitions(id),
    
    -- Context
    from_location_id UUID REFERENCES locations(id),
    to_location_id UUID REFERENCES locations(id),
    
    -- Metadata
    notes TEXT,
    metadata JSONB,  -- Additional context data
    
    -- Audit
    transitioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transitioned_by UUID REFERENCES users(id)
);

-- ============================================================================
-- 6. WAREHOUSE SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    
    setting_category VARCHAR(100) NOT NULL,  -- INVENTORY, PICKING, PACKING, SHIPPING
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'STRING',  -- STRING, NUMBER, BOOLEAN, JSON
    
    -- Metadata
    display_name VARCHAR(200),
    description TEXT,
    default_value TEXT,
    
    -- Validation
    validation_rules JSONB,
    
    -- Status
    is_editable BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(warehouse_id, setting_category, setting_key)
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

-- Warehouses
CREATE INDEX idx_warehouses_code ON warehouses(warehouse_code);
CREATE INDEX idx_warehouses_active ON warehouses(is_active);

-- Zones
CREATE INDEX idx_zones_warehouse ON warehouse_zones(warehouse_id);
CREATE INDEX idx_zones_type ON warehouse_zones(zone_type);
CREATE INDEX idx_zones_active ON warehouse_zones(is_active);

-- Locations
CREATE INDEX idx_locations_warehouse ON locations(warehouse_id);
CREATE INDEX idx_locations_zone ON locations(zone_id);
CREATE INDEX idx_locations_code ON locations(location_code);
CREATE INDEX idx_locations_status ON locations(status);
CREATE INDEX idx_locations_pickable ON locations(is_pickable);
CREATE INDEX idx_locations_barcode ON locations(barcode);

-- Packaging
CREATE INDEX idx_packaging_types_code ON packaging_types(code);
CREATE INDEX idx_packaging_types_active ON packaging_types(is_active);
CREATE INDEX idx_package_instances_code ON package_instances(instance_code);
CREATE INDEX idx_package_instances_status ON package_instances(status);

-- Carriers
CREATE INDEX idx_carriers_code ON shipping_carriers(carrier_code);
CREATE INDEX idx_carriers_active ON shipping_carriers(is_active);
CREATE INDEX idx_carriers_preferred ON shipping_carriers(is_preferred);

-- Vehicles
CREATE INDEX idx_vehicles_code ON internal_vehicles(vehicle_code);
CREATE INDEX idx_vehicles_warehouse ON internal_vehicles(warehouse_id);
CREATE INDEX idx_vehicles_status ON internal_vehicles(current_status);
CREATE INDEX idx_vehicles_driver ON internal_vehicles(assigned_driver_id);

-- Delivery Zones
CREATE INDEX idx_delivery_zones_warehouse ON delivery_zones(warehouse_id);
CREATE INDEX idx_delivery_zones_type ON delivery_zones(zone_type);

-- Workflow
CREATE INDEX idx_workflow_states_warehouse ON workflow_states(warehouse_id);
CREATE INDEX idx_workflow_states_code ON workflow_states(state_code);
CREATE INDEX idx_workflow_transitions_warehouse ON workflow_transitions(warehouse_id);
CREATE INDEX idx_workflow_transitions_from ON workflow_transitions(from_state_id);
CREATE INDEX idx_workflow_transitions_to ON workflow_transitions(to_state_id);
CREATE INDEX idx_batch_state_history_batch ON batch_state_history(batch_id);
CREATE INDEX idx_batch_state_history_state ON batch_state_history(to_state_id);

-- Settings
CREATE INDEX idx_warehouse_settings_warehouse ON warehouse_settings(warehouse_id);
CREATE INDEX idx_warehouse_settings_category ON warehouse_settings(setting_category);

-- ============================================================================
-- TRIGGERS for auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_zones_updated_at BEFORE UPDATE ON warehouse_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packaging_types_updated_at BEFORE UPDATE ON packaging_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_package_instances_updated_at BEFORE UPDATE ON package_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_carriers_updated_at BEFORE UPDATE ON shipping_carriers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internal_vehicles_updated_at BEFORE UPDATE ON internal_vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouse_settings_updated_at BEFORE UPDATE ON warehouse_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA - Default Location Types
-- ============================================================================

INSERT INTO location_types (code, name, capacity_type, default_width_cm, default_depth_cm, default_height_cm, default_max_weight_kg, default_max_volume_cubic_meters, requires_forklift, is_pickable, is_system)
VALUES
    ('PALLET', 'Pallet Location', 'PALLET', 120, 80, 200, 1000, 1.92, true, false, true),
    ('SHELF', 'Shelf Location', 'SHELF', 100, 50, 40, 100, 0.2, false, true, true),
    ('BIN', 'Bin Location', 'BIN', 40, 30, 30, 20, 0.036, false, true, true),
    ('FLOOR', 'Floor Space', 'FLOOR', 200, 200, 400, 2000, 16.0, true, false, true),
    ('RACK', 'Rack Position', 'SHELF', 120, 60, 180, 500, 1.296, false, true, true);

-- ============================================================================
-- SEED DATA - Default Workflow States
-- ============================================================================

INSERT INTO workflow_states (state_code, state_name, state_category, color, is_initial_state, is_final_state, requires_location, is_system, display_order)
VALUES
    ('RECEIVING', 'Receiving', 'RECEIVING', '#2196F3', true, false, true, true, 1),
    ('QC_PENDING', 'QC Pending', 'QC', '#FF9800', false, false, true, true, 2),
    ('QC_IN_PROGRESS', 'QC In Progress', 'QC', '#FF9800', false, false, true, true, 3),
    ('QC_APPROVED', 'QC Approved', 'QC', '#4CAF50', false, false, true, true, 4),
    ('QC_REJECTED', 'QC Rejected', 'QC', '#F44336', false, false, true, true, 5),
    ('PUTAWAY_PENDING', 'Putaway Pending', 'STORAGE', '#9C27B0', false, false, true, true, 6),
    ('STORED', 'Stored', 'STORAGE', '#4CAF50', false, false, true, true, 7),
    ('PICKING_ALLOCATED', 'Picking Allocated', 'PICKING', '#FF9800', false, false, true, true, 8),
    ('PICKING_IN_PROGRESS', 'Picking In Progress', 'PICKING', '#FF9800', false, false, true, true, 9),
    ('PICKED', 'Picked', 'PICKING', '#4CAF50', false, false, false, true, 10),
    ('PACKING_PENDING', 'Packing Pending', 'PACKING', '#FF9800', false, false, false, true, 11),
    ('PACKING_IN_PROGRESS', 'Packing In Progress', 'PACKING', '#FF9800', false, false, false, true, 12),
    ('PACKED', 'Packed', 'PACKING', '#4CAF50', false, false, false, true, 13),
    ('SHIPPING_PENDING', 'Shipping Pending', 'SHIPPING', '#FF9800', false, false, false, true, 14),
    ('SHIPPED', 'Shipped', 'SHIPPING', '#2196F3', false, false, false, true, 15),
    ('DELIVERED', 'Delivered', 'SHIPPING', '#4CAF50', false, true, false, true, 16),
    ('RETURNED', 'Returned', 'RETURNS', '#F44336', false, false, true, true, 17),
    ('QUARANTINE', 'Quarantine', 'QC', '#F44336', false, false, true, true, 18);

-- ============================================================================
-- SEED DATA - Standard Packaging Types
-- ============================================================================

INSERT INTO packaging_types (code, name, category, width_cm, depth_cm, height_cm, weight_empty_kg, volume_liters, max_product_weight_kg, max_product_length_meters, is_standard, standard_name, requires_forklift, is_stackable, max_stack_height, is_reusable, is_returnable, cost_per_unit)
VALUES
    ('EUR_PALLET', 'Paleți EUR 800x1200mm', 'TERTIARY', 80, 120, 14.4, 25, 1152, 1000, null, true, 'EUR Pallet', true, true, 4, true, true, 45.00),
    ('DRUM_200L', 'Tambur Textil 200L', 'SECONDARY', 60, 60, 90, 15, 200, 150, 500, false, null, false, false, 1, true, false, 85.00),
    ('BOX_SMALL', 'Cutie Carton Mică 40x30x30cm', 'PRIMARY', 40, 30, 30, 0.5, 36, 20, null, false, null, false, true, 8, false, false, 3.00),
    ('BOX_MEDIUM', 'Cutie Carton Medie 60x40x40cm', 'PRIMARY', 60, 40, 40, 1, 96, 40, null, false, null, false, true, 6, false, false, 5.50),
    ('BOX_LARGE', 'Cutie Carton Mare 80x60x60cm', 'PRIMARY', 80, 60, 60, 2, 288, 80, null, false, null, false, true, 4, false, false, 9.00),
    ('ROLL_TUBE', 'Tub Carton pentru Role', 'PRIMARY', 10, 10, 150, 1, 15, 20, 100, false, null, false, false, 1, false, false, 4.50);

COMMENT ON TABLE warehouses IS 'Main warehouse information and configuration';
COMMENT ON TABLE warehouse_zones IS 'Logical zones within warehouse (receiving, storage, shipping, etc.)';
COMMENT ON TABLE locations IS 'Physical storage locations (racks, shelves, bins)';
COMMENT ON TABLE packaging_types IS 'Types of packaging used (drums, pallets, boxes)';
COMMENT ON TABLE shipping_carriers IS 'External shipping carriers (FAN, DPD, etc.)';
COMMENT ON TABLE internal_vehicles IS 'Company-owned delivery vehicles';
COMMENT ON TABLE delivery_zones IS 'Geographic delivery zones with carrier assignments';
COMMENT ON TABLE workflow_states IS 'Product lifecycle states (receiving, QC, stored, shipped)';
COMMENT ON TABLE workflow_transitions IS 'Allowed transitions between workflow states with rules';
