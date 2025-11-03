-- Seed initial users for testing
-- Password for all test users: "password123" (hashed with bcrypt, cost=10)
-- Hash generated with: bcrypt.hash('password123', 10)

INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
VALUES 
  ('admin', 'admin@wmsnk.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', true, NOW(), NOW()),
  ('manager', 'manager@wmsnk.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'manager', true, NOW(), NOW()),
  ('operator', 'operator@wmsnk.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'operator', true, NOW(), NOW())
ON CONFLICT (username) DO NOTHING;

-- Insert some test products
INSERT INTO products (sku, name, description, weight_kg, uom, lot_control, created_at, updated_at)
VALUES
  ('FABRIC-001', 'Cotton Fabric Blue', 'High quality cotton fabric - Blue', 0.250, 'm', false, NOW(), NOW()),
  ('FABRIC-002', 'Cotton Fabric Red', 'High quality cotton fabric - Red', 0.250, 'm', false, NOW(), NOW()),
  ('BTN-001', 'Button White 15mm', 'White plastic button 15mm diameter', 0.001, 'pcs', false, NOW(), NOW()),
  ('BTN-002', 'Button Black 15mm', 'Black plastic button 15mm diameter', 0.001, 'pcs', false, NOW(), NOW()),
  ('THREAD-001', 'Thread White', 'Polyester thread white', 0.050, 'pcs', false, NOW(), NOW()),
  ('THREAD-002', 'Thread Black', 'Polyester thread black', 0.050, 'pcs', false, NOW(), NOW()),
  ('ZIP-001', 'Zipper 20cm Black', 'Metal zipper 20cm black', 0.010, 'pcs', false, NOW(), NOW()),
  ('LABEL-001', 'Brand Label', 'Woven brand label', 0.001, 'pcs', false, NOW(), NOW())
ON CONFLICT (sku) DO NOTHING;

-- Insert test locations
INSERT INTO locations (id, zone, rack, position, capacity_m3, is_active, created_at, updated_at)
VALUES
  ('A-01-01', 'Zone A', 'Rack-01', 'Pos-01', 10.0, true, NOW(), NOW()),
  ('A-01-02', 'Zone A', 'Rack-01', 'Pos-02', 10.0, true, NOW(), NOW()),
  ('B-01-01', 'Zone B', 'Rack-01', 'Pos-01', 15.0, true, NOW(), NOW()),
  ('B-01-02', 'Zone B', 'Rack-01', 'Pos-02', 15.0, true, NOW(), NOW()),
  ('WIP-01', 'WIP', NULL, NULL, 20.0, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Add some initial inventory_items
INSERT INTO inventory_items (product_sku, location_id, quantity, reserved_qty, created_at, updated_at)
VALUES
  ('FABRIC-001', 'A-01-01', 500.0, 0.0, NOW(), NOW()),
  ('FABRIC-002', 'A-01-02', 450.0, 0.0, NOW(), NOW()),
  ('BTN-001', 'B-01-01', 5000.0, 0.0, NOW(), NOW()),
  ('BTN-002', 'B-01-02', 4500.0, 0.0, NOW(), NOW()),
  ('THREAD-001', 'B-01-01', 200.0, 0.0, NOW(), NOW()),
  ('THREAD-002', 'B-01-02', 180.0, 0.0, NOW(), NOW())
ON CONFLICT (product_sku, location_id, lot_number) DO NOTHING;

COMMIT;
