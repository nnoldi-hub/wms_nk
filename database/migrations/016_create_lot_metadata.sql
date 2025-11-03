-- Migration: Add lot metadata table for enhanced packaging tracking
-- Purpose: Store parsed information from "Lot intrare" field (packaging, manufacturer, length, marking)

-- Create lot_metadata table
CREATE TABLE IF NOT EXISTS lot_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_sku VARCHAR(100) NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
  lot_number VARCHAR(100) NOT NULL,
  
  -- Packaging information
  packaging_type VARCHAR(50), -- TAMBUR, COLAC, BUNDLE, PRODUCER_LOT
  tambur_code VARCHAR(50), -- E1200, E1400, etc.
  
  -- Manufacturer information
  manufacturer VARCHAR(100), -- Electroplast, Prysmian, Cabtec, etc.
  manufacturer_code VARCHAR(20), -- ELP, PRVSMIAN, etc.
  
  -- Length and quantity
  length DECIMAL(10,3), -- Total length (e.g., 1083)
  length_uom VARCHAR(10), -- M, ML (meters, linear meters)
  
  -- Cable marking (for tamburs)
  marking_start INTEGER, -- Start marking (e.g., 0)
  marking_end INTEGER, -- End marking (e.g., 1083)
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT unique_product_lot UNIQUE(product_sku, lot_number)
);

-- Create indexes for performance
CREATE INDEX idx_lot_metadata_product ON lot_metadata(product_sku);
CREATE INDEX idx_lot_metadata_packaging ON lot_metadata(packaging_type);
CREATE INDEX idx_lot_metadata_manufacturer ON lot_metadata(manufacturer);
CREATE INDEX idx_lot_metadata_tambur ON lot_metadata(tambur_code) WHERE tambur_code IS NOT NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lot_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_lot_metadata_updated_at
  BEFORE UPDATE ON lot_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_lot_metadata_updated_at();

-- Add comments
COMMENT ON TABLE lot_metadata IS 'Stores parsed packaging and manufacturer metadata from lot numbers';
COMMENT ON COLUMN lot_metadata.packaging_type IS 'Type of packaging: TAMBUR (drum), COLAC (coil), BUNDLE, PRODUCER_LOT';
COMMENT ON COLUMN lot_metadata.tambur_code IS 'Tambur/drum code extracted from lot number (e.g., E1200)';
COMMENT ON COLUMN lot_metadata.manufacturer IS 'Full manufacturer name (e.g., Electroplast)';
COMMENT ON COLUMN lot_metadata.marking_start IS 'Cable start marking for tamburs (e.g., 0)';
COMMENT ON COLUMN lot_metadata.marking_end IS 'Cable end marking for tamburs (e.g., 1083)';
