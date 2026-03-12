-- Migration 026: Strategie fallback pe zone depozit
-- Când nicio regulă de picking/putaway nu se potrivește → se aplică strategia implicită a zonei.

ALTER TABLE warehouse_zones
  ADD COLUMN IF NOT EXISTS default_strategy VARCHAR(30) NOT NULL DEFAULT 'FIFO';

-- Valori permise: FIFO | LIFO | MIN_WASTE | USE_REMAINS_FIRST | FEWEST_CUTS
ALTER TABLE warehouse_zones
  ADD CONSTRAINT IF NOT EXISTS chk_wz_default_strategy
  CHECK (default_strategy IN ('FIFO', 'LIFO', 'MIN_WASTE', 'USE_REMAINS_FIRST', 'FEWEST_CUTS'));

COMMENT ON COLUMN warehouse_zones.default_strategy IS
  'Strategie de picking/putaway aplicată dacă nicio regulă WMS nu se potrivește contextului';
