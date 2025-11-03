-- Picking workflow schema
-- picking_jobs: header for a picking task generated from a sales order
-- picking_job_items: line-level picking instructions
-- inventory_reservations: reserved quantities for items to prevent double allocation

CREATE TABLE IF NOT EXISTS picking_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  number TEXT NOT NULL, -- e.g., PJ_<seq>
  status TEXT NOT NULL DEFAULT 'NEW', -- NEW, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
  assigned_to TEXT, -- username/user id (string for now)
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS picking_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES picking_jobs(id) ON DELETE CASCADE,
  line_id UUID REFERENCES sales_order_lines(id) ON DELETE SET NULL,
  product_sku TEXT NOT NULL REFERENCES products(sku) ON UPDATE CASCADE,
  requested_qty NUMERIC(18,3) NOT NULL DEFAULT 0,
  uom TEXT NOT NULL,
  lot_label TEXT,
  source_inventory_id UUID, -- inventory_items.id when preallocated
  picked_qty NUMERIC(18,3) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PARTIAL, DONE
  extra_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  line_id UUID REFERENCES sales_order_lines(id) ON DELETE SET NULL,
  job_id UUID REFERENCES picking_jobs(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL,
  product_sku TEXT NOT NULL,
  reserved_qty NUMERIC(18,3) NOT NULL,
  uom TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_picking_jobs_order ON picking_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_picking_items_job ON picking_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_reservations_inv ON inventory_reservations(inventory_item_id);

-- simple sequence for picking job numbers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'picking_job_seq') THEN
    CREATE SEQUENCE picking_job_seq;
  END IF;
END$$;

CREATE OR REPLACE FUNCTION generate_picking_job_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PJ_' || LPAD(nextval('picking_job_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tg_picking_jobs_updated') THEN
    CREATE TRIGGER tg_picking_jobs_updated BEFORE UPDATE ON picking_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tg_picking_job_items_updated') THEN
    CREATE TRIGGER tg_picking_job_items_updated BEFORE UPDATE ON picking_job_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
