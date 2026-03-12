-- Migration 024: Tabel audit log pentru motorul de reguli
-- Înregistrează fiecare decizie luată de motor: ce regulă, pentru ce operațiune, cu ce context

BEGIN;

CREATE TABLE IF NOT EXISTS wms_rule_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Contextul operațiunii
    operation_type  VARCHAR(50) NOT NULL,           -- PUTAWAY, PICKING, CUTTING, EVALUATE
    entity_type     VARCHAR(50),                    -- picking_job, location, cutting_order etc.
    entity_id       TEXT,                           -- ID-ul entității afectate (UUID sau număr job)
    
    -- Regula care a decis
    rule_id         UUID REFERENCES wms_rules(id) ON DELETE SET NULL,
    rule_name       TEXT,
    rule_scope      VARCHAR(50),
    rule_type       VARCHAR(50),
    
    -- Acțiunile rezultate
    action_type     VARCHAR(100),                   -- PICK_STRATEGY, SUGGEST_ZONE, BLOCK_OPERATION etc.
    action_value    TEXT,
    
    -- Context complet (pentru debugging)
    context_snapshot JSONB,
    
    -- Rezultat
    matched         BOOLEAN NOT NULL DEFAULT TRUE,
    blocked         BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE dacă operațiunea a fost blocată
    
    -- Utilizatorul care a declanșat operațiunea
    triggered_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    triggered_by_name TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indecși pentru filtrare rapidă
CREATE INDEX IF NOT EXISTS idx_rule_audit_operation ON wms_rule_audit_log(operation_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_audit_rule_id    ON wms_rule_audit_log(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_audit_entity     ON wms_rule_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_rule_audit_created    ON wms_rule_audit_log(created_at DESC);

COMMENT ON TABLE wms_rule_audit_log IS 'Audit trail pentru deciziile motorului de reguli WMS';
COMMENT ON COLUMN wms_rule_audit_log.blocked IS 'TRUE dacă acțiunea BLOCK_OPERATION a fost declanșată';
COMMENT ON COLUMN wms_rule_audit_log.context_snapshot IS 'Snapshot JSON al contextului la momentul evaluării (produs, stoc, locație)';

COMMIT;
