-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create Konga database for Kong Admin UI
CREATE DATABASE konga;
GRANT ALL PRIVILEGES ON DATABASE konga TO wms_admin;

-- Use wms_nks database (default)
\c wms_nks;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    sku VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight_kg DECIMAL(10,3),
    length_cm DECIMAL(10,2),
    width_cm DECIMAL(10,2),
    height_cm DECIMAL(10,2),
    uom VARCHAR(20) DEFAULT 'm',
    lot_control BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(50) PRIMARY KEY,
    zone VARCHAR(50),
    rack VARCHAR(50),
    position VARCHAR(50),
    allowed_types TEXT[],
    capacity_m3 DECIMAL(10,3),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_sku VARCHAR(100) REFERENCES products(sku) ON DELETE CASCADE,
    location_id VARCHAR(50) REFERENCES locations(id) ON DELETE CASCADE,
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    reserved_qty DECIMAL(10,3) NOT NULL DEFAULT 0,
    lot_number VARCHAR(100),
    expiry_date DATE,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_sku, location_id, lot_number)
);

-- Movements table
CREATE TABLE IF NOT EXISTS movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_type VARCHAR(50) NOT NULL,
    product_sku VARCHAR(100) REFERENCES products(sku),
    from_location VARCHAR(50) REFERENCES locations(id),
    to_location VARCHAR(50) REFERENCES locations(id),
    quantity DECIMAL(10,3) NOT NULL,
    lot_number VARCHAR(100),
    user_id UUID REFERENCES users(id),
    device_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id),
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync conflicts table
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(100) NOT NULL,
    action_id VARCHAR(255) NOT NULL,
    conflict_type VARCHAR(50) NOT NULL,
    server_data JSONB,
    client_data JSONB,
    resolution VARCHAR(50) DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_inventory_product ON inventory_items(product_sku);
CREATE INDEX idx_inventory_location ON inventory_items(location_id);
CREATE INDEX idx_movements_sku ON movements(product_sku);
CREATE INDEX idx_movements_created ON movements(created_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Insert default admin user (password: Admin123!)
INSERT INTO users (username, email, password_hash, role) 
VALUES (
    'admin',
    'admin@wms-nks.local',
    '$2a$10$YourHashedPasswordHere', -- Hash using bcrypt
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Insert sample locations
INSERT INTO locations (id, zone, rack, position, capacity_m3) VALUES
    ('R01-A1', 'Zone-A', 'R01', 'A1', 10.5),
    ('R01-A2', 'Zone-A', 'R01', 'A2', 10.5),
    ('R02-B1', 'Zone-B', 'R02', 'B1', 15.0),
    ('R02-B2', 'Zone-B', 'R02', 'B2', 15.0),
    ('R03-C1', 'Zone-C', 'R03', 'C1', 12.0)
ON CONFLICT (id) DO NOTHING;

-- Insert sample products
INSERT INTO products (sku, name, weight_kg, uom) VALUES
    ('MAT-001', 'Material Textil A', 5.5, 'm'),
    ('MAT-002', 'Material Textil B', 7.2, 'm'),
    ('MAT-003', 'Material Textil C', 4.8, 'm')
ON CONFLICT (sku) DO NOTHING;
