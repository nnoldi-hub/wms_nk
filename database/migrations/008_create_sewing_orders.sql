-- Migration: Create sewing_orders table
-- Purpose: Manage sewing orders for garment production

CREATE TABLE IF NOT EXISTS sewing_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    product_sku VARCHAR(100) NOT NULL REFERENCES products(sku) ON DELETE RESTRICT,
    cutting_order_id UUID REFERENCES cutting_orders(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    actual_quantity INTEGER,
    defect_quantity INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    worker_id UUID REFERENCES users(id) ON DELETE SET NULL,
    quality_notes TEXT,
    notes TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Generate order_number automatically
CREATE OR REPLACE FUNCTION generate_sewing_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'SEW-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('sewing_order_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS sewing_order_seq START 1;

CREATE TRIGGER generate_sewing_order_number_trigger
    BEFORE INSERT ON sewing_orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_sewing_order_number();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sewing_orders_status ON sewing_orders(status);
CREATE INDEX IF NOT EXISTS idx_sewing_orders_product ON sewing_orders(product_sku);
CREATE INDEX IF NOT EXISTS idx_sewing_orders_worker ON sewing_orders(worker_id);
CREATE INDEX IF NOT EXISTS idx_sewing_orders_cutting ON sewing_orders(cutting_order_id);
CREATE INDEX IF NOT EXISTS idx_sewing_orders_created ON sewing_orders(created_at DESC);

COMMENT ON TABLE sewing_orders IS 'Sewing orders for garment production process';
COMMENT ON COLUMN sewing_orders.order_number IS 'Auto-generated order number (SEW-YYYYMMDD-XXXXX)';
COMMENT ON COLUMN sewing_orders.cutting_order_id IS 'Reference to the cutting order that produced the pieces';
COMMENT ON COLUMN sewing_orders.defect_quantity IS 'Quantity with defects found during sewing';
COMMENT ON COLUMN sewing_orders.quality_notes IS 'Quality control notes from sewing operator';
