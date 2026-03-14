-- Migration 034: Audit log general pentru operațiuni WMS
-- Înregistrează modificări de locații, mișcări de loturi/marfă, receptii NIR
-- Toate serviciile pot scrie în acest tabel (același DB wms_nks)

BEGIN;

CREATE TABLE IF NOT EXISTS wms_ops_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tipul acțiunii
    action_type     VARCHAR(80) NOT NULL,   -- CREATE_LOCATION, UPDATE_LOCATION, PATCH_COORDINATES,
                                            -- PATCH_CAPACITY, DELETE_LOCATION, STATUS_CHANGE,
                                            -- RECEIPT_NIR, MOVE_BATCH, PICKING_COMPLETE, etc.

    -- Entitatea afectată
    entity_type     VARCHAR(50) NOT NULL,   -- location, batch, picking_job, goods_receipt, etc.
    entity_id       TEXT,                   -- UUID sau string ID
    entity_code     TEXT,                   -- location_code, batch_number, order_number etc.

    -- Serviciul care a generat evenimentul
    service         VARCHAR(40),            -- warehouse-config, inventory, auth

    -- Datele modificate (before/after sau un snapshot minimal)
    changes         JSONB,                  -- { before: { status: 'AVAILABLE' }, after: { status: 'BLOCKED' } }
    extra_info      JSONB,                  -- context extra (zone_name, warehouse_name, etc.)

    -- Utilizatorul responsabil
    user_id         TEXT,                   -- UUID sau 'system'
    user_name       TEXT,                   -- username sau email

    -- IP și timestamp
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indecși pentru filtrare rapidă
CREATE INDEX IF NOT EXISTS idx_wms_ops_audit_action    ON wms_ops_audit(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_ops_audit_entity    ON wms_ops_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_wms_ops_audit_entity_code ON wms_ops_audit(entity_code);
CREATE INDEX IF NOT EXISTS idx_wms_ops_audit_user      ON wms_ops_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_ops_audit_created   ON wms_ops_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_ops_audit_service   ON wms_ops_audit(service, created_at DESC);

COMMENT ON TABLE wms_ops_audit IS 'Audit trail general WMS: modificări locații, mișcări marfă, receptii NIR, completare picking';
COMMENT ON COLUMN wms_ops_audit.changes IS 'Snapshot JSON cu valorile before/after sau datele snapshotate la momentul acțiunii';
COMMENT ON COLUMN wms_ops_audit.extra_info IS 'Context adițional: zone_name, warehouse_name, lot_number etc.';

COMMIT;
