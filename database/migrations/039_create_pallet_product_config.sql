-- ============================================================
-- Migration 039: Pallet product capacity configuration
-- Permite configurarea câte unități dintr-un produs încap pe un palet
-- în funcție de tipul paletului, volum și greutate
-- ============================================================

CREATE TABLE IF NOT EXISTS pallet_product_config (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_sku         VARCHAR(100) NOT NULL,
    pallet_type         VARCHAR(30) NOT NULL DEFAULT 'EURO',  -- EURO, INDUSTRIAL, SEMI, CUSTOM
    units_per_pallet    INTEGER NOT NULL DEFAULT 10,          -- câte batches/unități încap
    max_weight_kg       NUMERIC(10,2),                        -- greutate maximă pe palet (kg)
    max_volume_m3       NUMERIC(10,4),                        -- volum maxim (m³)
    unit_weight_kg      NUMERIC(10,4),                        -- greutate per unitate/batch (kg)
    unit_volume_m3      NUMERIC(10,6),                        -- volum per unitate (m³)
    stacking_allowed    BOOLEAN DEFAULT TRUE,                 -- se pot stivui
    notes               TEXT,
    warehouse_id        UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    created_by          UUID,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Un produs poate avea o singură configurație per tip palet per depozit
    CONSTRAINT uq_pallet_product_config UNIQUE (product_sku, pallet_type, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_ppc_sku         ON pallet_product_config(product_sku);
CREATE INDEX IF NOT EXISTS idx_ppc_warehouse   ON pallet_product_config(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_ppc_pallet_type ON pallet_product_config(pallet_type);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_ppc_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ppc_updated_at ON pallet_product_config;
CREATE TRIGGER trg_ppc_updated_at
    BEFORE UPDATE ON pallet_product_config
    FOR EACH ROW EXECUTE FUNCTION update_ppc_updated_at();

COMMENT ON TABLE pallet_product_config IS 'Configurare capacitate paleți per produs și tip palet';
COMMENT ON COLUMN pallet_product_config.units_per_pallet IS 'Nr. maxim de batches/unități pe un palet de acest tip';
COMMENT ON COLUMN pallet_product_config.max_weight_kg IS 'Greutate maximă admisă pe palet (kg)';
COMMENT ON COLUMN pallet_product_config.max_volume_m3 IS 'Volum maxim admis pe palet (m³)';
COMMENT ON COLUMN pallet_product_config.unit_weight_kg IS 'Greutate per batch/unitate (kg) - pentru calcul auto';
COMMENT ON COLUMN pallet_product_config.unit_volume_m3 IS 'Volum per batch/unitate (m³) - pentru calcul auto';
