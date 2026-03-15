-- Migration: Create location_types table
-- Description: Stores types of warehouse locations (e.g., PALLET, SHELF, FLOOR, etc.)

BEGIN;

-- Create location_types table
CREATE TABLE IF NOT EXISTS location_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code VARCHAR(20) UNIQUE NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_location_types_type_code ON location_types(type_code);
CREATE INDEX idx_location_types_is_active ON location_types(is_active);
CREATE INDEX idx_location_types_created_at ON location_types(created_at);

-- Insert default location types
INSERT INTO location_types (type_code, type_name, description, created_by) VALUES
  ('PALLET', 'Pallet Location', 'Standard pallet storage location', NULL),
  ('SHELF', 'Shelf Location', 'Shelf storage for smaller items', NULL),
  ('FLOOR', 'Floor Location', 'Floor-level storage', NULL),
  ('RACK', 'Rack Location', 'Vertical rack storage', NULL),
  ('BIN', 'Bin Location', 'Small bin storage', NULL),
  ('STAGING', 'Staging Area', 'Temporary staging location', NULL),
  ('DOCK', 'Dock Location', 'Loading/unloading dock', NULL)
ON CONFLICT (type_code) DO NOTHING;

-- Update existing locations table to add foreign key
ALTER TABLE locations 
  DROP CONSTRAINT IF EXISTS fk_locations_location_type,
  ADD CONSTRAINT fk_locations_location_type 
    FOREIGN KEY (location_type_id) 
    REFERENCES location_types(id) 
    ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_location_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_location_types_updated_at
  BEFORE UPDATE ON location_types
  FOR EACH ROW
  EXECUTE FUNCTION update_location_types_updated_at();

COMMIT;
