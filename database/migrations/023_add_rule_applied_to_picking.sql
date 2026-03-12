-- Migration 023: Adăugare câmpuri rule engine pe picking_job_items
-- Permite tracking-ul regulii care a selectat stocul + sugestii motor

BEGIN;

-- Câmpuri noi pe picking_job_items
ALTER TABLE picking_job_items
  ADD COLUMN IF NOT EXISTS rule_applied_id   UUID        REFERENCES wms_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rule_applied_name TEXT,
  ADD COLUMN IF NOT EXISTS pick_strategy     TEXT,
  ADD COLUMN IF NOT EXISTS engine_suggestion JSONB       DEFAULT '{}';

-- Index pentru rapoarte / filtrare pe regulă
CREATE INDEX IF NOT EXISTS idx_picking_items_rule
  ON picking_job_items(rule_applied_id)
  WHERE rule_applied_id IS NOT NULL;

-- Câmp pe picking_jobs: strategia generală aplicată la job
ALTER TABLE picking_jobs
  ADD COLUMN IF NOT EXISTS pick_strategy     TEXT,
  ADD COLUMN IF NOT EXISTS engine_metadata   JSONB       DEFAULT '{}';

COMMENT ON COLUMN picking_job_items.rule_applied_id   IS 'Regula WMS care a selectat acest lot/locație';
COMMENT ON COLUMN picking_job_items.rule_applied_name IS 'Numele regulii (denormalizat pentru rapoarte)';
COMMENT ON COLUMN picking_job_items.pick_strategy     IS 'Strategia: FIFO, MIN_WASTE, USE_REMAINS_FIRST etc.';
COMMENT ON COLUMN picking_job_items.engine_suggestion IS 'Răspunsul complet al picking engine (JSON)';
COMMENT ON COLUMN picking_jobs.pick_strategy          IS 'Strategia aplicată la nivel de job';
COMMENT ON COLUMN picking_jobs.engine_metadata        IS 'Metadata motor: reguli aplicate, timing etc.';

COMMIT;
