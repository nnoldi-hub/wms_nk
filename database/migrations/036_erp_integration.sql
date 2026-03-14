-- ============================================================
-- Migration 036: ERP Integration Tables
-- ============================================================

-- Joburi de sincronizare ERP
CREATE TABLE IF NOT EXISTS erp_sync_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type          TEXT NOT NULL CHECK (type IN ('PO_INBOUND', 'NIR_OUTBOUND', 'DELIVERY_OUTBOUND', 'STOCK_PUSH', 'ALL')),
    status        TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL')),
    records_synced INT NOT NULL DEFAULT 0,
    error_msg     TEXT,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_erp_sync_jobs_started ON erp_sync_jobs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_sync_jobs_type   ON erp_sync_jobs (type, status);

-- Mapare comenzi de achizitie ERP → WMS
CREATE TABLE IF NOT EXISTS erp_po_mappings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_po_id         TEXT UNIQUE NOT NULL,
    supplier_name     TEXT,
    supplier_code     TEXT,
    erp_status        TEXT,
    order_date        DATE,
    expected_delivery DATE,
    lines_json        JSONB DEFAULT '[]',
    wms_order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_po_supplier  ON erp_po_mappings (supplier_code);
CREATE INDEX IF NOT EXISTS idx_erp_po_status    ON erp_po_mappings (erp_status);
CREATE INDEX IF NOT EXISTS idx_erp_po_wms_order ON erp_po_mappings (wms_order_id);

-- Log-uri webhooks primite de la ERP
CREATE TABLE IF NOT EXISTS erp_webhook_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type   TEXT NOT NULL,
    erp_po_id    TEXT,
    payload      JSONB NOT NULL DEFAULT '{}',
    status       TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED')),
    error_msg    TEXT,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_wh_event    ON erp_webhook_logs (event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_wh_po_id    ON erp_webhook_logs (erp_po_id);

-- ── Coloane ERP pe tabele existente ───────────────────────────────────────────

-- goods_receipts (NIR-uri trimise la ERP)
ALTER TABLE goods_receipts
    ADD COLUMN IF NOT EXISTS erp_synced   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS erp_nir_id   TEXT,
    ADD COLUMN IF NOT EXISTS erp_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_goods_receipts_erp_sync ON goods_receipts (erp_synced) WHERE erp_synced = FALSE;

-- shipments (livrari trimise la ERP)
ALTER TABLE shipments
    ADD COLUMN IF NOT EXISTS erp_synced       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS erp_delivery_id  TEXT,
    ADD COLUMN IF NOT EXISTS erp_synced_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shipments_erp_sync ON shipments (erp_synced) WHERE erp_synced = FALSE;

-- orders (legatura cu ERP PO)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS erp_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_erp_order_id ON orders (erp_order_id) WHERE erp_order_id IS NOT NULL;

-- Trigger: updated_at automat pe erp_po_mappings
CREATE OR REPLACE FUNCTION update_erp_po_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_erp_po_updated_at ON erp_po_mappings;
CREATE TRIGGER trg_erp_po_updated_at
    BEFORE UPDATE ON erp_po_mappings
    FOR EACH ROW EXECUTE FUNCTION update_erp_po_updated_at();
