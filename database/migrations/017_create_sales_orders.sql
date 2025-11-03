-- Migration: Create sales orders and lines tables for picking/CMD notes
-- Date: 2025-10-31

-- Enable required extensions (safety)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sales orders header
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(50) UNIQUE NOT NULL, -- CMD_<sequence>
  order_date DATE DEFAULT CURRENT_DATE,
  customer_name VARCHAR(200) NOT NULL,
  delivery_address TEXT,
  contact_name VARCHAR(200),
  delivery_type VARCHAR(50), -- RIDICARE DIN DEPOZIT / CURIER etc
  agent_name VARCHAR(200),
  internal_notes TEXT,
  status VARCHAR(30) DEFAULT 'PENDING', -- PENDING/ALLOCATED/PICKING/PACKED/SHIPPED
  total_weight DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lines
CREATE TABLE IF NOT EXISTS sales_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  product_sku VARCHAR(100) NOT NULL REFERENCES products(sku) ON DELETE RESTRICT,
  description TEXT,
  requested_qty DECIMAL(12,3) NOT NULL,
  uom VARCHAR(20) NOT NULL DEFAULT 'Km',
  requested_lengths JSONB, -- ex: [50,20,30]
  management_code VARCHAR(50), -- Cod gest.
  lot_label VARCHAR(200), -- Lot intrare (dacă e pre-alocat)
  allocated_batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
  source_length_before_cut DECIMAL(12,3),
  remaining_after_cut DECIMAL(12,3),
  line_weight DECIMAL(12,2),
  location_id VARCHAR(50) REFERENCES locations(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, line_no)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_order ON sales_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_sku ON sales_order_lines(product_sku);

-- Trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_sales_orders_updated_at'
  ) THEN
    CREATE TRIGGER update_sales_orders_updated_at
      BEFORE UPDATE ON sales_orders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_sales_order_lines_updated_at'
  ) THEN
    CREATE TRIGGER update_sales_order_lines_updated_at
      BEFORE UPDATE ON sales_order_lines
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Simple sequence for CMD numbers (if not exists)
CREATE SEQUENCE IF NOT EXISTS sales_order_cmd_seq START 10000;

-- Helper function to generate CMD number CMD_XXXXX
CREATE OR REPLACE FUNCTION generate_cmd_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'CMD_' || LPAD(nextval('sales_order_cmd_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;
