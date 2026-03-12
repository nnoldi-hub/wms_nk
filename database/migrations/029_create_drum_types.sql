-- Migration 029: Catalog Tipuri Tamburi (Drum Types)
-- Prețuri reale din documentele NK Smart Cables (NIR NK26_351)

CREATE TABLE IF NOT EXISTS drum_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(30) UNIQUE NOT NULL,    -- E1000, E1200, E1400, E1600
  name             VARCHAR(100) NOT NULL,
  capacity_meters  INTEGER,                         -- capacitate aprox. cablu (m)
  tare_weight_kg   NUMERIC(8,2),                   -- greutate goala (kg)
  diameter_mm      INTEGER,
  width_mm         INTEGER,
  unit_price       NUMERIC(10,2) DEFAULT 0,        -- pret achizitie RON
  is_active        BOOLEAN DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Date reale din NIR NK26_351 / 11/03/26 (ENERGOPLAST SA)
INSERT INTO drum_types (code, name, capacity_meters, tare_weight_kg, unit_price) VALUES
  ('E1000',      'Tambur lemn E1000',  1000, 42.0,  340.00),
  ('E1200',      'Tambur lemn E1200',  1200, 52.0,  575.00),
  ('E1400',      'Tambur lemn E1400',  1400, 63.0,  725.00),
  ('E1600',      'Tambur lemn E1600',  1600, 78.0,  950.00),
  ('E1800',      'Tambur lemn E1800',  1800, 94.0,    0.00),
  ('PALET_LEMN', 'Palet lemn standard', NULL, 18.0,  55.00),
  ('ROLA_MIC',   'Rola mica (plastic)',  100,  1.5,   0.00),
  ('ROLA_MARE',  'Rola mare (plastic)',  500,  6.0,   0.00)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_drum_types_active ON drum_types(is_active);
