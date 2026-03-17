-- ============================================================
-- Migrație 038: Sistem Paleți
-- Scop: Paleți ca unitate de depozitare de primă clasă
--       Bulk putaway + tracking fizic colaci/tamburi pe paleți
-- Data: 2026-03-16
-- ============================================================

-- Secvență pentru coduri unelegit de paleți (PAL-2026-001)
CREATE SEQUENCE IF NOT EXISTS pallet_seq START 1 INCREMENT 1;

-- -------------------------------------------------------
-- Tabela principală: paleți fizici
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS pallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_code     VARCHAR(30) UNIQUE NOT NULL,
  -- ex: PAL-2026-001 (generat automat la creare)
  qr_code         TEXT,
  -- JSON string pentru QR: {"type":"PALLET","code":"PAL-2026-001","id":"uuid"}

  location_id     VARCHAR(50) REFERENCES locations(id) ON DELETE SET NULL,
  warehouse_id    UUID REFERENCES warehouses(id) ON DELETE CASCADE,

  pallet_type     VARCHAR(20) NOT NULL DEFAULT 'EURO'
    CHECK (pallet_type IN ('EURO','INDUSTRIAL','SEMI','CUSTOM')),

  -- Capacitate
  max_slots       INTEGER NOT NULL DEFAULT 10,
  -- câte unități (colaci, tamburi) încap fizic pe palet
  current_slots   INTEGER NOT NULL DEFAULT 0,
  -- câte sunt acum pe palet (calculat automat)

  -- Greutate
  tare_weight_kg  NUMERIC(6,2),
  -- greutatea goală a paletului (fără produse)

  -- Produs predominant (pentru sugestii la recepție)
  -- NULL = palet mixt
  primary_product_sku  VARCHAR(100) REFERENCES products(sku) ON DELETE SET NULL,

  status          VARCHAR(20) NOT NULL DEFAULT 'EMPTY'
    CHECK (status IN ('EMPTY','IN_USE','FULL','IN_TRANSIT','RETIRED')),

  notes           TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indecși pentru căutare rapidă
CREATE INDEX IF NOT EXISTS idx_pallets_status       ON pallets(status);
CREATE INDEX IF NOT EXISTS idx_pallets_location_id  ON pallets(location_id);
CREATE INDEX IF NOT EXISTS idx_pallets_warehouse_id ON pallets(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pallets_product_sku  ON pallets(primary_product_sku);
CREATE INDEX IF NOT EXISTS idx_pallets_code         ON pallets(pallet_code);

-- -------------------------------------------------------
-- Istoricul deplasărilor unui palet
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS pallet_movements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id        UUID NOT NULL REFERENCES pallets(id) ON DELETE CASCADE,
  from_location_id VARCHAR(50) REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id   VARCHAR(50) REFERENCES locations(id) ON DELETE SET NULL,
  moved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  reason           VARCHAR(100),
  -- INITIAL_PLACEMENT / RELOCATION / PUTAWAY / PICKING_COMPLETE / MANUAL
  moved_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pallet_movements_pallet  ON pallet_movements(pallet_id);
CREATE INDEX IF NOT EXISTS idx_pallet_movements_moved_at ON pallet_movements(moved_at DESC);

-- -------------------------------------------------------
-- Linkul batch ↔ palet (adăugat la product_batches)
-- -------------------------------------------------------
ALTER TABLE product_batches
  ADD COLUMN IF NOT EXISTS pallet_id     UUID REFERENCES pallets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slot_position INTEGER;
-- slot_position = pozitia pe palet (1,2,3...) util pt picking ordonat

CREATE INDEX IF NOT EXISTS idx_batches_pallet_id ON product_batches(pallet_id);

-- -------------------------------------------------------
-- Trigger: update pallets.updated_at automat
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_pallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pallets_updated_at ON pallets;
CREATE TRIGGER trg_pallets_updated_at
  BEFORE UPDATE ON pallets
  FOR EACH ROW EXECUTE FUNCTION update_pallets_updated_at();

-- -------------------------------------------------------
-- Trigger: update pallets.current_slots automat
-- când se adaugă/elimină batches de pe un palet
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_pallet_slots()
RETURNS TRIGGER AS $$
BEGIN
  -- La INSERT sau UPDATE (pallet_id setat)
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.pallet_id IS NOT NULL THEN
    UPDATE pallets
    SET current_slots = (
      SELECT COUNT(*)
      FROM product_batches
      WHERE pallet_id = NEW.pallet_id
        AND status NOT IN ('EMPTY', 'DAMAGED')
    ),
    status = CASE
      WHEN (SELECT COUNT(*) FROM product_batches WHERE pallet_id = NEW.pallet_id AND status NOT IN ('EMPTY','DAMAGED')) = 0
        THEN 'EMPTY'
      WHEN (SELECT COUNT(*) FROM product_batches WHERE pallet_id = NEW.pallet_id AND status NOT IN ('EMPTY','DAMAGED')) >= max_slots
        THEN 'FULL'
      ELSE 'IN_USE'
    END,
    primary_product_sku = (
      -- Produsul cu cele mai multe batches pe palet
      SELECT product_sku
      FROM product_batches
      WHERE pallet_id = NEW.pallet_id AND status NOT IN ('EMPTY','DAMAGED')
      GROUP BY product_sku
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    updated_at = NOW()
    WHERE id = NEW.pallet_id;
  END IF;

  -- La UPDATE când se scoate de pe palet (pallet_id setat la NULL)
  IF TG_OP = 'UPDATE' AND OLD.pallet_id IS NOT NULL AND NEW.pallet_id IS NULL THEN
    UPDATE pallets
    SET current_slots = (
      SELECT COUNT(*)
      FROM product_batches
      WHERE pallet_id = OLD.pallet_id
        AND status NOT IN ('EMPTY', 'DAMAGED')
    ),
    status = CASE
      WHEN (SELECT COUNT(*) FROM product_batches WHERE pallet_id = OLD.pallet_id AND status NOT IN ('EMPTY','DAMAGED')) = 0
        THEN 'EMPTY'
      ELSE 'IN_USE'
    END,
    updated_at = NOW()
    WHERE id = OLD.pallet_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pallet_slots ON product_batches;
CREATE TRIGGER trg_sync_pallet_slots
  AFTER INSERT OR UPDATE OF pallet_id ON product_batches
  FOR EACH ROW EXECUTE FUNCTION sync_pallet_slots();

-- -------------------------------------------------------
-- Audit: înregistrare acțiune tip palet în wms_ops_audit
-- (folosit de backend când se creează/muta paleti)
-- -------------------------------------------------------
-- Noutate tip acțiune: PALLET_CREATE, PALLET_PLACE, PALLET_MOVE, BULK_PUTAWAY

COMMENT ON TABLE pallets IS 'Paleți fizici ca unitate de depozitare. Fiecare palet are QR propriu și poate conține mai multe batches (colaci/tamburi).';
COMMENT ON COLUMN pallets.max_slots IS 'Numărul maxim de unități (colaci, tamburi) care încap fizic pe palet';
COMMENT ON COLUMN pallets.current_slots IS 'Calculat automat prin trigger din product_batches';
COMMENT ON COLUMN pallets.primary_product_sku IS 'Produsul predominant — pentru sugestii la recepție nouă';
