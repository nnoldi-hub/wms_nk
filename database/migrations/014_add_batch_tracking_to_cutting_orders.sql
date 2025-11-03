-- Migration: Add batch tracking to cutting_orders
-- Purpose: Link cutting orders to source and result batches

ALTER TABLE cutting_orders
ADD COLUMN IF NOT EXISTS source_batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS result_batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS selection_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS transformation_id UUID REFERENCES product_transformations(id) ON DELETE SET NULL;

-- Indexes for batch lookups
CREATE INDEX IF NOT EXISTS idx_cutting_orders_source_batch ON cutting_orders(source_batch_id);
CREATE INDEX IF NOT EXISTS idx_cutting_orders_result_batch ON cutting_orders(result_batch_id);
CREATE INDEX IF NOT EXISTS idx_cutting_orders_transformation ON cutting_orders(transformation_id);

-- Comments
COMMENT ON COLUMN cutting_orders.source_batch_id IS 'Source batch/drum used for cutting';
COMMENT ON COLUMN cutting_orders.result_batch_id IS 'Result batch created after cutting';
COMMENT ON COLUMN cutting_orders.selection_method IS 'Method used to select source batch (FIFO, MIN_WASTE, LOCATION_PROXIMITY, MANUAL)';
COMMENT ON COLUMN cutting_orders.transformation_id IS 'Link to transformation record in product_transformations table';
