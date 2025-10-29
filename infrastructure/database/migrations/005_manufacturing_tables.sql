-- Cutting Orders Table
CREATE TABLE IF NOT EXISTS cutting_orders (
    id SERIAL PRIMARY KEY,
    product_sku VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    pattern_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'PENDING',
    worker_id INTEGER,
    actual_quantity INTEGER,
    waste_quantity INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_cutting_orders_status ON cutting_orders(status);
CREATE INDEX idx_cutting_orders_worker ON cutting_orders(worker_id);
CREATE INDEX idx_cutting_orders_product ON cutting_orders(product_sku);

-- Sewing Orders Table
CREATE TABLE IF NOT EXISTS sewing_orders (
    id SERIAL PRIMARY KEY,
    cutting_order_id INTEGER NOT NULL,
    machine_id VARCHAR(100),
    operator_id INTEGER,
    estimated_time INTEGER, -- minutes
    actual_time INTEGER, -- minutes
    defects_count INTEGER DEFAULT 0,
    rework_count INTEGER DEFAULT 0,
    checkpoints JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    FOREIGN KEY (cutting_order_id) REFERENCES cutting_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_sewing_orders_status ON sewing_orders(status);
CREATE INDEX idx_sewing_orders_operator ON sewing_orders(operator_id);
CREATE INDEX idx_sewing_orders_cutting ON sewing_orders(cutting_order_id);

-- QC Inspections Table
CREATE TABLE IF NOT EXISTS qc_inspections (
    id SERIAL PRIMARY KEY,
    sewing_order_id INTEGER NOT NULL,
    inspector_id INTEGER,
    inspection_type VARCHAR(100) NOT NULL,
    checklist JSONB,
    defects_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    notes TEXT,
    rejection_reason TEXT,
    rework_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    FOREIGN KEY (sewing_order_id) REFERENCES sewing_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_qc_inspections_status ON qc_inspections(status);
CREATE INDEX idx_qc_inspections_inspector ON qc_inspections(inspector_id);
CREATE INDEX idx_qc_inspections_sewing ON qc_inspections(sewing_order_id);

-- QC Defects Table
CREATE TABLE IF NOT EXISTS qc_defects (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL,
    defect_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL, -- CRITICAL, MAJOR, MINOR
    location VARCHAR(200),
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (inspection_id) REFERENCES qc_inspections(id) ON DELETE CASCADE
);

CREATE INDEX idx_qc_defects_inspection ON qc_defects(inspection_id);
CREATE INDEX idx_qc_defects_severity ON qc_defects(severity);

-- Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    customer_address TEXT NOT NULL,
    customer_phone VARCHAR(50),
    carrier VARCHAR(100),
    tracking_number VARCHAR(100) UNIQUE,
    tracking_events JSONB DEFAULT '[]',
    carrier_tracking_url TEXT,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    shipped_at TIMESTAMP
);

CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_customer ON shipments(customer_name);

-- Shipment Items Table
CREATE TABLE IF NOT EXISTS shipment_items (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER NOT NULL,
    product_sku VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
);

CREATE INDEX idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX idx_shipment_items_product ON shipment_items(product_sku);

-- Insert sample data
INSERT INTO cutting_orders (product_sku, quantity, pattern_id, status, notes) VALUES
('TEX-001', 100, 'PATTERN-A', 'PENDING', 'Fabric roll #123'),
('TEX-002', 50, 'PATTERN-B', 'IN_PROGRESS', 'High priority order');

COMMENT ON TABLE cutting_orders IS 'Manufacturing cutting operations tracking';
COMMENT ON TABLE sewing_orders IS 'Sewing operations with machine assignments and checkpoints';
COMMENT ON TABLE qc_inspections IS 'Quality control inspections with pass/fail decisions';
COMMENT ON TABLE qc_defects IS 'Defects found during QC inspections';
COMMENT ON TABLE shipments IS 'Outbound shipments tracking';
COMMENT ON TABLE shipment_items IS 'Items included in each shipment';
