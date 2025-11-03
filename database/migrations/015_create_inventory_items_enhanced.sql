-- Migration: Enhanced inventory_items table for product-location tracking
-- Date: 2025-10-31
-- Description: Add warehouse/zone references and QR code data to inventory_items

-- Drop existing table if it exists
DROP TABLE IF EXISTS inventory_items CASCADE;

-- Create enhanced inventory_items table
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_sku VARCHAR(100) NOT NULL REFERENCES products(sku) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  zone_id UUID NOT NULL REFERENCES warehouse_zones(id) ON DELETE RESTRICT,
  location_id VARCHAR(50) NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  reserved_qty DECIMAL(10,3) DEFAULT 0,
  lot_number VARCHAR(100),
  expiry_date DATE,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  qr_code_data JSONB, -- Store QR code data (product + location info)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  CONSTRAINT positive_reserved CHECK (reserved_qty >= 0),
  CONSTRAINT reserved_not_exceed_quantity CHECK (reserved_qty <= quantity)
);

-- Create indexes for performance
CREATE INDEX idx_inventory_items_product ON inventory_items(product_sku);
CREATE INDEX idx_inventory_items_location ON inventory_items(location_id);
CREATE INDEX idx_inventory_items_warehouse ON inventory_items(warehouse_id);
CREATE INDEX idx_inventory_items_zone ON inventory_items(zone_id);
CREATE INDEX idx_inventory_items_lot ON inventory_items(lot_number) WHERE lot_number IS NOT NULL;
CREATE INDEX idx_inventory_items_expiry ON inventory_items(expiry_date) WHERE expiry_date IS NOT NULL;

-- Create unique constraint for product-location combination
CREATE UNIQUE INDEX idx_unique_product_location ON inventory_items(product_sku, location_id)
WHERE lot_number IS NULL;

-- Create partial unique index for product-location-lot combination
CREATE UNIQUE INDEX idx_unique_product_location_lot ON inventory_items(product_sku, location_id, lot_number)
WHERE lot_number IS NOT NULL;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_items_updated_at();

-- Add comment
COMMENT ON TABLE inventory_items IS 'Tracks products in warehouse locations with QR code data';
COMMENT ON COLUMN inventory_items.qr_code_data IS 'JSON data for QR code generation (product + location info)';
COMMENT ON COLUMN inventory_items.reserved_qty IS 'Quantity reserved for orders but not yet shipped';
