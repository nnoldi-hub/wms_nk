-- Migration 040: Add PENDING_PUTAWAY and IN_TRANSIT to product_batches status
-- These statuses are needed for the NIR → Putaway flow

-- Drop old constraint and recreate with new values
ALTER TABLE product_batches DROP CONSTRAINT IF EXISTS batch_status_check;

ALTER TABLE product_batches
  ADD CONSTRAINT batch_status_check CHECK (
    status IN (
      'INTACT',          -- Lot complet, în locație
      'PENDING_PUTAWAY', -- Nou sosit (NIR confirmat), asteaptă depozitare
      'IN_TRANSIT',      -- Se mișcă între locații
      'CUT',             -- Tăiat parțial (restul devine lot nou)
      'REPACKED',        -- Rebobinat/reambalajet
      'EMPTY',           -- Epuizat
      'DAMAGED',         -- Avariat
      'QUARANTINE'       -- Carantinată (inspecție calitate)
    )
  );

-- Add putaway_at timestamp to track when putaway was completed
ALTER TABLE product_batches
  ADD COLUMN IF NOT EXISTS putaway_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS putaway_by VARCHAR(100);

-- Index for fast lookup of pending putaway tasks
CREATE INDEX IF NOT EXISTS idx_batches_pending_putaway
  ON product_batches (status)
  WHERE status = 'PENDING_PUTAWAY';
