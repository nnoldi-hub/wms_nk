-- Migration: Create Batch Selection Rules table
-- Description: Configurable rules for batch selection algorithms

-- Create batch_selection_rules table
CREATE TABLE IF NOT EXISTS batch_selection_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(20) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    conditions JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT rule_type_check CHECK (rule_type IN ('FIFO', 'MIN_WASTE', 'LOCATION_PROXIMITY', 'BATCH_SIZE', 'CUSTOM')),
    CONSTRAINT priority_check CHECK (priority >= 0 AND priority <= 1000)
);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_batch_selection_rules_updated_at ON batch_selection_rules;
CREATE TRIGGER update_batch_selection_rules_updated_at
    BEFORE UPDATE ON batch_selection_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_selection_rules_type ON batch_selection_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_selection_rules_priority ON batch_selection_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_selection_rules_active ON batch_selection_rules(is_active);

-- Add comments
COMMENT ON TABLE batch_selection_rules IS 'Configurable rules for batch selection algorithms';
COMMENT ON COLUMN batch_selection_rules.rule_type IS 'Rule type: FIFO, MIN_WASTE, LOCATION_PROXIMITY, BATCH_SIZE, CUSTOM';
COMMENT ON COLUMN batch_selection_rules.priority IS 'Rule priority (0-1000, higher = more important)';
COMMENT ON COLUMN batch_selection_rules.conditions IS 'JSON conditions for rule application';

-- Insert default rules
INSERT INTO batch_selection_rules (name, rule_type, priority, conditions, description) VALUES
(
    'FIFO - First In First Out',
    'FIFO',
    100,
    '{"sort_by": "received_at", "order": "ASC"}'::JSONB,
    'Select oldest batch first (received_at ascending)'
),
(
    'Minimize Waste',
    'MIN_WASTE',
    90,
    '{"prefer_closest_match": true, "max_waste_percent": 10}'::JSONB,
    'Select batch that minimizes remaining quantity after cut'
),
(
    'Location Proximity',
    'LOCATION_PROXIMITY',
    80,
    '{"prefer_same_zone": true, "max_distance_meters": 50}'::JSONB,
    'Prefer batches in closest physical location'
),
(
    'Prefer Partial Batches',
    'BATCH_SIZE',
    70,
    '{"prefer_status": "CUT", "minimize_new_cuts": true}'::JSONB,
    'Prefer already-cut batches to avoid opening new intact ones'
);

-- Verify insertion
SELECT name, rule_type, priority, is_active FROM batch_selection_rules ORDER BY priority DESC;
