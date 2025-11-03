-- Migration: Create Product Batches table
-- Description: Individual batches/drums tracking with transformations support

-- Create product_batches table
CREATE TABLE IF NOT EXISTS product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    product_sku VARCHAR(50) NOT NULL REFERENCES products(sku) ON DELETE RESTRICT,
    unit_id UUID NOT NULL REFERENCES product_units(id) ON DELETE RESTRICT,
    
    -- Physical characteristics
    initial_quantity DECIMAL(10,2) NOT NULL,
    current_quantity DECIMAL(10,2) NOT NULL,
    length_meters DECIMAL(10,2),
    weight_kg DECIMAL(10,2),
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'INTACT',
    location_id VARCHAR(50) REFERENCES locations(id) ON DELETE SET NULL,
    
    -- Traceability
    source_batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
    transformation_id UUID,
    
    -- Metadata
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP WITH TIME ZONE,
    emptied_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT batch_status_check CHECK (status IN ('INTACT', 'CUT', 'REPACKED', 'EMPTY', 'DAMAGED', 'QUARANTINE')),
    CONSTRAINT batch_quantity_check CHECK (current_quantity >= 0 AND current_quantity <= initial_quantity)
);

-- Create sequence for batch numbers
CREATE SEQUENCE IF NOT EXISTS product_batch_number_seq START 1;

-- Create trigger function for auto-generating batch numbers (BATCH-YYYYMMDD-XXXXX)
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
        NEW.batch_number := 'BATCH-' || 
            TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
            LPAD(nextval('product_batch_number_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS generate_batch_number_trigger ON product_batches;
CREATE TRIGGER generate_batch_number_trigger
    BEFORE INSERT ON product_batches
    FOR EACH ROW
    EXECUTE FUNCTION generate_batch_number();

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_product_batches_updated_at ON product_batches;
CREATE TRIGGER update_product_batches_updated_at
    BEFORE UPDATE ON product_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_batches_number ON product_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_batches_product ON product_batches(product_sku);
CREATE INDEX IF NOT EXISTS idx_batches_status ON product_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_location ON product_batches(location_id);
CREATE INDEX IF NOT EXISTS idx_batches_source ON product_batches(source_batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_created ON product_batches(created_at DESC);

-- Add comments
COMMENT ON TABLE product_batches IS 'Individual product batches/drums with tracking';
COMMENT ON COLUMN product_batches.batch_number IS 'Auto-generated unique batch number (BATCH-YYYYMMDD-XXXXX)';
COMMENT ON COLUMN product_batches.initial_quantity IS 'Initial quantity when batch was created/received';
COMMENT ON COLUMN product_batches.current_quantity IS 'Current remaining quantity in batch';
COMMENT ON COLUMN product_batches.status IS 'Batch status: INTACT, CUT, REPACKED, EMPTY, DAMAGED, QUARANTINE';
COMMENT ON COLUMN product_batches.source_batch_id IS 'Reference to source batch if this was created from a transformation';
COMMENT ON COLUMN product_batches.transformation_id IS 'Reference to the transformation that created this batch';

-- Insert sample data (5 test drums)
INSERT INTO product_batches (product_sku, unit_id, initial_quantity, current_quantity, length_meters, weight_kg, status, location_id, notes)
SELECT 
    'MAT-001',
    (SELECT id FROM product_units WHERE code = 'DRUM'),
    500.00,
    500.00,
    500.00,
    750.00,
    'INTACT',
    'R01-A1',
    'Tambur mare MAT-001 - neatins'
UNION ALL
SELECT 
    'MAT-001',
    (SELECT id FROM product_units WHERE code = 'DRUM'),
    300.00,
    180.00,
    180.00,
    270.00,
    'CUT',
    'R01-A2',
    'Tambur MAT-001 - taiat partial (120m folositi)'
UNION ALL
SELECT 
    'MAT-002',
    (SELECT id FROM product_units WHERE code = 'DRUM'),
    1000.00,
    1000.00,
    1000.00,
    1500.00,
    'INTACT',
    'R02-B1',
    'Tambur foarte mare MAT-002'
UNION ALL
SELECT 
    'MAT-003',
    (SELECT id FROM product_units WHERE code = 'ROLL'),
    100.00,
    45.00,
    45.00,
    67.50,
    'CUT',
    'R02-B2',
    'Rola MAT-003 - partial folosita'
UNION ALL
SELECT 
    'PROD-001',
    (SELECT id FROM product_units WHERE code = 'BOX'),
    50.00,
    50.00,
    NULL,
    25.00,
    'INTACT',
    'R03-C1',
    'Cutie PROD-001 sigilata';

-- Verify insertion
SELECT batch_number, product_sku, initial_quantity, current_quantity, status 
FROM product_batches 
ORDER BY created_at;
