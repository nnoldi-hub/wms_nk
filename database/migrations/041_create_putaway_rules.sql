-- Migration 041: Create putaway_rules table
-- Defines priority rules: packaging_type_code x location_type_code -> priority

CREATE TABLE IF NOT EXISTS putaway_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  packaging_type_code VARCHAR(50) NOT NULL,
  location_type_code  VARCHAR(50) NOT NULL,
  priority            INTEGER NOT NULL DEFAULT 10 CHECK (priority BETWEEN 1 AND 100),
  notes               TEXT,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  UNIQUE (packaging_type_code, location_type_code)
);

CREATE INDEX IF NOT EXISTS idx_putaway_rules_pkg ON putaway_rules (packaging_type_code);
CREATE INDEX IF NOT EXISTS idx_putaway_rules_loc ON putaway_rules (location_type_code);

-- Seed default rules for cable warehouse
INSERT INTO putaway_rules (packaging_type_code, location_type_code, priority, notes) VALUES
  ('COLAC',        'RACK_PALLET',  1, 'Colaci standard -> rafturi paleti'),
  ('COLAC',        'RACK_STANDARD',2, 'Alternativa rafturi standard'),
  ('COLAC_100M',   'RACK_PALLET',  1, 'Colaci 100m -> rafturi paleti'),
  ('COLAC_100M',   'RACK_STANDARD',2, 'Alternativa rafturi standard'),
  ('COLAC_200M',   'RACK_PALLET',  1, 'Colaci 200m -> rafturi paleti'),
  ('COLAC_200M',   'RACK_STANDARD',2, 'Alternativa rafturi standard'),
  ('REST',         'RACK_RESTURI', 1, 'Resturi -> raft resturi'),
  ('REST',         'RACK_PALLET',  2, 'Alternativa palet'),
  ('TAMBUR_MIC',   'DRL_SMALL',    1, 'Tambur mic -> derulator mic'),
  ('TAMBUR_MIC',   'DRL_LARGE',    2, 'Alternativa derulator mare'),
  ('TAMBUR_MEDIU', 'DRL_LARGE',    1, 'Tambur mediu -> derulator mare'),
  ('TAMBUR_MEDIU', 'RACK_PALLET',  2, 'Alternativa raft paleti'),
  ('TAMBUR_MARE',  'FLOOR_HEAVY',  1, 'Tambur mare -> podea marfa grea'),
  ('TAMBUR_MARE',  'TAMBUR',       2, 'Alternativa locatie tambur exterior'),
  ('PALET',        'RACK_PALLET',  1, 'Paleti -> rafturi paleti'),
  ('BOX_LARGE',    'RACK_PALLET',  1, 'Cutii mari -> rafturi paleti'),
  ('BOX_MEDIUM',   'RACK_STANDARD',1, 'Cutii medii -> rafturi standard'),
  ('BOX_SMALL',    'RACK_STANDARD',1, 'Cutii mici -> rafturi standard')
ON CONFLICT (packaging_type_code, location_type_code) DO NOTHING;
