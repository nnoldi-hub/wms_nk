-- Migration: Create Product Transformations table
-- Description: Tracks all product transformations (cuts, repacks, conversions)

-- Create product_transformations table
CREATE TABLE IF NOT EXISTS product_transformations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transformation_number VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,
    
    -- Source batch
    source_batch_id UUID NOT NULL REFERENCES product_batches(id) ON DELETE RESTRICT,
    source_quantity DECIMAL(10,2) NOT NULL,
    
    -- Result batch
    result_batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
    result_quantity DECIMAL(10,2),
    waste_quantity DECIMAL(10,2) DEFAULT 0,
    
    -- Context
    cutting_order_id UUID REFERENCES cutting_orders(id) ON DELETE SET NULL,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Algorithm used
    selection_method VARCHAR(20),
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT transformation_type_check CHECK (type IN ('CUT', 'REPACK', 'CONVERT', 'SPLIT', 'MERGE')),
    CONSTRAINT transformation_selection_check CHECK (selection_method IN ('FIFO', 'MIN_WASTE', 'MANUAL', 'LOCATION_PROXIMITY') OR selection_method IS NULL)
);

-- Create sequence for transformation numbers
CREATE SEQUENCE IF NOT EXISTS transformation_number_seq START 1;

-- Create trigger function for auto-generating transformation numbers (TRANS-YYYYMMDD-XXXXX)
CREATE OR REPLACE FUNCTION generate_transformation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transformation_number IS NULL OR NEW.transformation_number = '' THEN
        NEW.transformation_number := 'TRANS-' || 
            TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
            LPAD(nextval('transformation_number_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS generate_transformation_number_trigger ON product_transformations;
CREATE TRIGGER generate_transformation_number_trigger
    BEFORE INSERT ON product_transformations
    FOR EACH ROW
    EXECUTE FUNCTION generate_transformation_number();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transformations_number ON product_transformations(transformation_number);
CREATE INDEX IF NOT EXISTS idx_transformations_source ON product_transformations(source_batch_id);
CREATE INDEX IF NOT EXISTS idx_transformations_result ON product_transformations(result_batch_id);
CREATE INDEX IF NOT EXISTS idx_transformations_type ON product_transformations(type);
CREATE INDEX IF NOT EXISTS idx_transformations_performed ON product_transformations(performed_at DESC);

-- Add comments
COMMENT ON TABLE product_transformations IS 'History of all product transformations (cuts, repacks, conversions)';
COMMENT ON COLUMN product_transformations.transformation_number IS 'Auto-generated unique transformation number (TRANS-YYYYMMDD-XXXXX)';
COMMENT ON COLUMN product_transformations.type IS 'Transformation type: CUT, REPACK, CONVERT, SPLIT, MERGE';
COMMENT ON COLUMN product_transformations.waste_quantity IS 'Quantity lost during transformation';
COMMENT ON COLUMN product_transformations.selection_method IS 'Algorithm used for batch selection: FIFO, MIN_WASTE, MANUAL, LOCATION_PROXIMITY';

-- No sample data for transformations yet (will be created when cuts happen)

-- Verify table creation
SELECT COUNT(*) as transformation_count FROM product_transformations;
