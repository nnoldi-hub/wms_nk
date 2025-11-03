-- Migration: Create cutting_orders table
-- Purpose: Manage cutting orders for garment production

CREATE TABLE IF NOT EXISTS cutting_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    product_sku VARCHAR(100) NOT NULL REFERENCES products(sku) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    actual_quantity INTEGER,
    waste_quantity INTEGER DEFAULT 0,
    pattern_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    worker_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Generate order_number automatically
CREATE OR REPLACE FUNCTION generate_cutting_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'CUT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('cutting_order_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS cutting_order_seq START 1;

CREATE TRIGGER generate_cutting_order_number_trigger
    BEFORE INSERT ON cutting_orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_cutting_order_number();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cutting_orders_status ON cutting_orders(status);
CREATE INDEX IF NOT EXISTS idx_cutting_orders_product ON cutting_orders(product_sku);
CREATE INDEX IF NOT EXISTS idx_cutting_orders_worker ON cutting_orders(worker_id);
CREATE INDEX IF NOT EXISTS idx_cutting_orders_created ON cutting_orders(created_at DESC);

-- Audit trigger
CREATE TRIGGER audit_cutting_orders
    AFTER INSERT OR UPDATE OR DELETE ON cutting_orders
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger();

COMMENT ON TABLE cutting_orders IS 'Cutting orders for garment production process';
COMMENT ON COLUMN cutting_orders.order_number IS 'Auto-generated order number (CUT-YYYYMMDD-XXXXX)';
COMMENT ON COLUMN cutting_orders.actual_quantity IS 'Actual quantity produced after cutting';
COMMENT ON COLUMN cutting_orders.waste_quantity IS 'Quantity wasted during cutting process';
