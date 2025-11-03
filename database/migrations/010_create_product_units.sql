-- Migration: Create Product Units table
-- Description: Defines packaging/measurement units for products (boxes, rolls, drums, meters, kg)

-- Create product_units table
CREATE TABLE IF NOT EXISTS product_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    is_splittable BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT product_unit_type_check CHECK (type IN ('CONTAINER', 'MEASUREMENT'))
);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_product_units_updated_at ON product_units;
CREATE TRIGGER update_product_units_updated_at
    BEFORE UPDATE ON product_units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create index
CREATE INDEX IF NOT EXISTS idx_product_units_code ON product_units(code);
CREATE INDEX IF NOT EXISTS idx_product_units_type ON product_units(type);

-- Add comments
COMMENT ON TABLE product_units IS 'Product packaging and measurement units';
COMMENT ON COLUMN product_units.code IS 'Unique unit code (BOX, ROLL, DRUM, METER, KG, etc.)';
COMMENT ON COLUMN product_units.type IS 'Unit type: CONTAINER (physical packaging) or MEASUREMENT (unit of measure)';
COMMENT ON COLUMN product_units.is_splittable IS 'Can this unit be split/cut (e.g., drums can be cut, boxes cannot)';

-- Insert seed data
INSERT INTO product_units (code, name, type, is_splittable, description) VALUES
('BOX', 'Cutie', 'CONTAINER', FALSE, 'Cutie standard pentru ambalare produse'),
('ROLL', 'Rola', 'CONTAINER', TRUE, 'Rola de material care poate fi taiata'),
('DRUM', 'Tambur', 'CONTAINER', TRUE, 'Tambur mare pentru cabluri sau fire'),
('PALLET', 'Palet', 'CONTAINER', FALSE, 'Palet pentru transport multiproduse'),
('METER', 'Metru', 'MEASUREMENT', TRUE, 'Unitate de masura - metru'),
('KG', 'Kilogram', 'MEASUREMENT', TRUE, 'Unitate de masura - kilogram'),
('PIECE', 'Bucata', 'MEASUREMENT', FALSE, 'Unitate de masura - bucata individuala');

-- Verify insertion
SELECT code, name, type, is_splittable FROM product_units ORDER BY code;
