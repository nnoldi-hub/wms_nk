-- ============================================================
-- Migration 037: Fix ERP Integration — tabele lipsă
-- erp_po_mappings referentiat orders (nu exista) → supplier_orders
-- Creare tabela shipments pentru shipments-service
-- ============================================================

-- 1. Creare erp_po_mappings cu FK corect catre supplier_orders
CREATE TABLE IF NOT EXISTS erp_po_mappings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_po_id         TEXT UNIQUE NOT NULL,
    supplier_name     TEXT,
    supplier_code     TEXT,
    erp_status        TEXT,
    order_date        DATE,
    expected_delivery DATE,
    lines_json        JSONB DEFAULT '[]',
    wms_order_id      UUID REFERENCES supplier_orders(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erp_po_supplier  ON erp_po_mappings (supplier_code);
CREATE INDEX IF NOT EXISTS idx_erp_po_status    ON erp_po_mappings (erp_status);
CREATE INDEX IF NOT EXISTS idx_erp_po_wms_order ON erp_po_mappings (wms_order_id);

-- Trigger updated_at
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

-- 2. Creare tabela shipments (pentru shipments-service si erp-connector)
CREATE TABLE IF NOT EXISTS shipments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    customer_name    TEXT,
    customer_address TEXT,
    customer_phone   TEXT,
    carrier          TEXT,
    status           TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','SHIPPED','DELIVERED','CANCELLED')),
    tracking_number  TEXT,
    lines_json       JSONB DEFAULT '[]',
    delivered_at     TIMESTAMPTZ,
    erp_synced       BOOLEAN NOT NULL DEFAULT FALSE,
    erp_delivery_id  TEXT,
    erp_synced_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id  UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    product_sku  TEXT NOT NULL,
    quantity     NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id   ON shipments (order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status     ON shipments (status);
CREATE INDEX IF NOT EXISTS idx_shipments_erp_sync   ON shipments (erp_synced) WHERE erp_synced = FALSE;
CREATE INDEX IF NOT EXISTS idx_shipment_items_ship  ON shipment_items (shipment_id);

-- 3. Adauga erp_order_id pe supplier_orders (in loc de orders inexistenta)
ALTER TABLE supplier_orders
    ADD COLUMN IF NOT EXISTS erp_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_supplier_orders_erp_id
    ON supplier_orders (erp_order_id) WHERE erp_order_id IS NOT NULL;

-- 4. Adauga erp_order_id pe sales_orders (pentru sync livrari)
ALTER TABLE sales_orders
    ADD COLUMN IF NOT EXISTS erp_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_orders_erp_id
    ON sales_orders (erp_order_id) WHERE erp_order_id IS NOT NULL AND erp_order_id <> '';
