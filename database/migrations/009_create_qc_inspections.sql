-- Migration: Create QC Inspections table
-- Description: Quality control inspections for sewing orders

-- Create QC Inspections table
CREATE TABLE IF NOT EXISTS qc_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_number VARCHAR(50) UNIQUE NOT NULL,
    sewing_order_id UUID NOT NULL REFERENCES sewing_orders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    defects_found INTEGER DEFAULT 0,
    severity VARCHAR(20),
    inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
    inspection_notes TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT qc_inspection_status_check CHECK (status IN ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'RECHECK')),
    CONSTRAINT qc_inspection_severity_check CHECK (severity IN ('NONE', 'MINOR', 'MAJOR', 'CRITICAL') OR severity IS NULL)
);

-- Create sequence for inspection numbers
CREATE SEQUENCE IF NOT EXISTS qc_inspection_number_seq START 1;

-- Create trigger function for auto-generating inspection numbers (QC-YYYYMMDD-XXXXX)
CREATE OR REPLACE FUNCTION generate_qc_inspection_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.inspection_number IS NULL OR NEW.inspection_number = '' THEN
        NEW.inspection_number := 'QC-' || 
            TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
            LPAD(nextval('qc_inspection_number_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS generate_qc_inspection_number_trigger ON qc_inspections;
CREATE TRIGGER generate_qc_inspection_number_trigger
    BEFORE INSERT ON qc_inspections
    FOR EACH ROW
    EXECUTE FUNCTION generate_qc_inspection_number();

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_qc_inspections_updated_at ON qc_inspections;
CREATE TRIGGER update_qc_inspections_updated_at
    BEFORE UPDATE ON qc_inspections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_qc_inspections_status ON qc_inspections(status);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_sewing_order ON qc_inspections(sewing_order_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_inspector ON qc_inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_severity ON qc_inspections(severity);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_created_at ON qc_inspections(created_at DESC);

-- Add comments
COMMENT ON TABLE qc_inspections IS 'Quality control inspections for sewing orders';
COMMENT ON COLUMN qc_inspections.inspection_number IS 'Auto-generated unique inspection number (QC-YYYYMMDD-XXXXX)';
COMMENT ON COLUMN qc_inspections.sewing_order_id IS 'Reference to the sewing order being inspected';
COMMENT ON COLUMN qc_inspections.status IS 'Inspection status: PENDING, IN_PROGRESS, PASSED, FAILED, RECHECK';
COMMENT ON COLUMN qc_inspections.defects_found IS 'Number of defects found during inspection';
COMMENT ON COLUMN qc_inspections.severity IS 'Overall severity: NONE, MINOR, MAJOR, CRITICAL';
COMMENT ON COLUMN qc_inspections.inspector_id IS 'Reference to the user performing the inspection';

-- Insert sample data
INSERT INTO qc_inspections (sewing_order_id, status, defects_found, severity, inspector_id, inspection_notes, notes) VALUES
(
    (SELECT id FROM sewing_orders WHERE order_number = 'SEW-20251029-00001'),
    'PASSED',
    2,
    'MINOR',
    (SELECT id FROM users WHERE username = 'admin'),
    'Minor stitching issues on 2 pieces',
    'Overall quality acceptable'
),
(
    (SELECT id FROM sewing_orders WHERE order_number = 'SEW-20251029-00002'),
    'IN_PROGRESS',
    0,
    'NONE',
    (SELECT id FROM users WHERE username = 'admin'),
    'Inspection in progress',
    'Standard quality check'
),
(
    (SELECT id FROM sewing_orders WHERE order_number = 'SEW-20251029-00003'),
    'FAILED',
    15,
    'MAJOR',
    (SELECT id FROM users WHERE username = 'admin'),
    'Multiple alignment issues and loose threads',
    'Requires rework'
),
(
    (SELECT id FROM sewing_orders WHERE order_number = 'SEW-20251029-00004'),
    'PENDING',
    0,
    NULL,
    NULL,
    NULL,
    'Awaiting inspection'
);
