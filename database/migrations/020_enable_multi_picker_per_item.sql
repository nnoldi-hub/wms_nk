-- Enable multi-picker workflow per order line (per job item)
-- Adds assignment fields and timeline on picking_job_items so multiple employees can work in parallel

ALTER TABLE IF EXISTS picking_job_items
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Optional index to query who is working on what
CREATE INDEX IF NOT EXISTS idx_picking_job_items_assigned_to ON picking_job_items(assigned_to) WHERE assigned_to IS NOT NULL;
