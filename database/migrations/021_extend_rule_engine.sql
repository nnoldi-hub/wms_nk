-- Migration 021: Extindere Rule Engine
-- Adaugă scope, description detaliată, conditions și actions structurate
-- pe tabela batch_selection_rules (refolosită ca tabelă generală de reguli)

-- 1. Redenumire tabelă (alias generic)
ALTER TABLE batch_selection_rules RENAME TO wms_rules;

-- 2. Adăugare coloane noi
DO $$
BEGIN
    -- scope: PUTAWAY, PICKING, RECEIVING, CUTTING, SEWING, SHIPPING
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wms_rules' AND column_name = 'scope'
    ) THEN
        ALTER TABLE wms_rules ADD COLUMN scope VARCHAR(50) NOT NULL DEFAULT 'PICKING';
    END IF;

    -- actions: array JSON de acțiuni [{type, value}]
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wms_rules' AND column_name = 'actions'
    ) THEN
        ALTER TABLE wms_rules ADD COLUMN actions JSONB NOT NULL DEFAULT '[]';
    END IF;

    -- conditions: schimbare format la array [{field, operator, value}]
    -- (coloana conditions există deja ca JSONB, rămâne compatibilă)

    -- created_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wms_rules' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE wms_rules ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Constraint pe scope
ALTER TABLE wms_rules DROP CONSTRAINT IF EXISTS wms_rules_scope_check;
ALTER TABLE wms_rules ADD CONSTRAINT wms_rules_scope_check
    CHECK (scope IN ('PUTAWAY', 'PICKING', 'RECEIVING', 'CUTTING', 'SEWING', 'SHIPPING', 'GENERAL'));

-- 4. Constraint pe rule_type (extins)
ALTER TABLE wms_rules DROP CONSTRAINT IF EXISTS rule_type_check;
ALTER TABLE wms_rules ADD CONSTRAINT rule_type_check
    CHECK (rule_type IN (
        'FIFO', 'MIN_WASTE', 'LOCATION_PROXIMITY', 'BATCH_SIZE', 'CUSTOM',
        'USE_REMAINS_FIRST', 'SUGGEST_ZONE', 'SUGGEST_LOCATION',
        'BLOCK_OPERATION', 'REQUIRE_APPROVAL', 'PICK_STRATEGY'
    ));

-- 5. Indexuri noi
CREATE INDEX IF NOT EXISTS idx_wms_rules_scope ON wms_rules(scope);
CREATE INDEX IF NOT EXISTS idx_wms_rules_active_scope ON wms_rules(is_active, scope);
CREATE INDEX IF NOT EXISTS idx_wms_rules_priority_scope ON wms_rules(scope, priority DESC);

-- 6. Update reguli existente cu scope implicit
UPDATE wms_rules SET scope = 'PICKING' WHERE scope IS NULL OR scope = '';

-- 7. Inserare reguli inițiale pentru PUTAWAY
INSERT INTO wms_rules (name, rule_type, scope, priority, conditions, actions, description, is_active) VALUES
(
    'Tamburi mari → zona TAMBURI',
    'SUGGEST_ZONE',
    'PUTAWAY',
    100,
    '[
        {"field": "stock.packaging_type", "operator": "=", "value": "DRUM"},
        {"field": "stock.length_m", "operator": ">", "value": 300}
    ]'::JSONB,
    '[
        {"type": "SUGGEST_ZONE", "value": "TAMBURI"},
        {"type": "SUGGEST_LOCATION", "value": "DRUM_RACK"}
    ]'::JSONB,
    'Tamburii cu lungime > 300m se pun în zona TAMBURI pe rafturi pentru tamburi',
    true
),
(
    'Resturi cabluri → zona RESTURI',
    'SUGGEST_ZONE',
    'PUTAWAY',
    90,
    '[
        {"field": "product.category", "operator": "=", "value": "cable"},
        {"field": "stock.status", "operator": "=", "value": "CUT"},
        {"field": "stock.length_m", "operator": "<", "value": 50}
    ]'::JSONB,
    '[
        {"type": "SUGGEST_ZONE", "value": "RESTURI"},
        {"type": "SUGGEST_LOCATION", "value": "SHELF"}
    ]'::JSONB,
    'Resturile de cablu (sub 50m, status CUT) merg în zona RESTURI',
    true
),
(
    'Echipamente electrice → zona ECHIPAMENTE',
    'SUGGEST_ZONE',
    'PUTAWAY',
    80,
    '[
        {"field": "product.category", "operator": "IN", "value": ["equipment", "electrical_panel", "switch"]}
    ]'::JSONB,
    '[
        {"type": "SUGGEST_ZONE", "value": "ECHIPAMENTE"}
    ]'::JSONB,
    'Echipamentele electrice se depozitează în zona dedicată',
    true
)
ON CONFLICT DO NOTHING;

-- 8. Update reguli de picking existente cu format nou de condiții/acțiuni
UPDATE wms_rules
SET
    scope = 'PICKING',
    conditions = '[{"field": "stock.received_at", "operator": "ORDER_BY_ASC", "value": "received_at"}]'::JSONB,
    actions = '[{"type": "PICK_STRATEGY", "value": "FIFO"}]'::JSONB
WHERE rule_type = 'FIFO' AND scope = 'PICKING';

UPDATE wms_rules
SET
    scope = 'PICKING',
    conditions = '[{"field": "stock.remaining_after_pick_percent", "operator": "MINIMIZE", "value": true}]'::JSONB,
    actions = '[{"type": "PICK_STRATEGY", "value": "MIN_WASTE"}]'::JSONB
WHERE rule_type = 'MIN_WASTE' AND scope = 'PICKING';

UPDATE wms_rules
SET
    scope = 'PICKING',
    conditions = '[{"field": "stock.status", "operator": "=", "value": "CUT"}]'::JSONB,
    actions = '[{"type": "PICK_STRATEGY", "value": "USE_REMAINS_FIRST"}]'::JSONB
WHERE rule_type = 'BATCH_SIZE' AND scope = 'PICKING';

-- 9. Inserare regulă picking importantă: resturi înainte de tamburi întregi
INSERT INTO wms_rules (name, rule_type, scope, priority, conditions, actions, description, is_active) VALUES
(
    'Picking cabluri — resturi înaintea tamburilor întregi',
    'USE_REMAINS_FIRST',
    'PICKING',
    95,
    '[
        {"field": "product.category", "operator": "=", "value": "cable"},
        {"field": "order_line.requested_length_m", "operator": ">", "value": 0}
    ]'::JSONB,
    '[
        {"type": "PICK_STRATEGY", "value": "USE_REMAINS_FIRST"},
        {"type": "PICK_STRATEGY", "value": "ALLOW_MULTI_LOT"}
    ]'::JSONB,
    'La picking de cabluri, folosește resturi (status=CUT) înaintea tamburilor întregi. Permite combinarea mai multor loturi.',
    true
)
ON CONFLICT DO NOTHING;

-- 10. Comentarii tabelă
COMMENT ON TABLE wms_rules IS 'Motor de reguli WMS — reguli configurabile pentru putaway, picking, receiving, cutting';
COMMENT ON COLUMN wms_rules.scope IS 'PUTAWAY, PICKING, RECEIVING, CUTTING, SEWING, SHIPPING, GENERAL';
COMMENT ON COLUMN wms_rules.conditions IS 'Array JSON: [{field, operator, value}] — condiții IF';
COMMENT ON COLUMN wms_rules.actions IS 'Array JSON: [{type, value}] — acțiuni THEN';
COMMENT ON COLUMN wms_rules.priority IS 'Prioritate 0-1000, mai mare = evaluat primul';

-- Verificare finală
SELECT scope, COUNT(*) as rules_count FROM wms_rules GROUP BY scope ORDER BY scope;
