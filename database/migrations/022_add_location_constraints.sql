-- Migration 022: Constrângeri pe locații pentru motorul de reguli
-- Adaugă allowed_categories, allowed_packaging, constraints JSONB pe locations

DO $$
BEGIN
    -- Categorii de produse permise în această locație (NULL = orice)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'locations' AND column_name = 'allowed_categories'
    ) THEN
        ALTER TABLE locations ADD COLUMN allowed_categories JSONB DEFAULT NULL;
        COMMENT ON COLUMN locations.allowed_categories IS 'Array categorii permise: ["cable","equipment"]. NULL = orice categorie.';
    END IF;

    -- Tipuri de ambalaj permise în această locație (NULL = orice)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'locations' AND column_name = 'allowed_packaging'
    ) THEN
        ALTER TABLE locations ADD COLUMN allowed_packaging JSONB DEFAULT NULL;
        COMMENT ON COLUMN locations.allowed_packaging IS 'Array coduri ambalaj permise: ["DRUM","ROLL"]. NULL = orice ambalaj.';
    END IF;

    -- Constrângeri generice extensibile (min_length_m, max_length_m etc.)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'locations' AND column_name = 'constraints'
    ) THEN
        ALTER TABLE locations ADD COLUMN constraints JSONB DEFAULT '{}';
        COMMENT ON COLUMN locations.constraints IS 'Constrângeri extensibile: {min_length_m, max_length_m, min_weight_kg, max_weight_kg}';
    END IF;

    -- Etichetă sugestie zonă (pentru afișare mobilă)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'locations' AND column_name = 'suggestion_label'
    ) THEN
        ALTER TABLE locations ADD COLUMN suggestion_label VARCHAR(200) DEFAULT NULL;
        COMMENT ON COLUMN locations.suggestion_label IS 'Text afișat operatorului când se sugerează această locație';
    END IF;
END $$;

-- Indexuri pentru filtrare rapidă după categorii/ambalaj (GIN pentru JSONB)
CREATE INDEX IF NOT EXISTS idx_locations_allowed_categories ON locations USING GIN (allowed_categories);
CREATE INDEX IF NOT EXISTS idx_locations_allowed_packaging ON locations USING GIN (allowed_packaging);
CREATE INDEX IF NOT EXISTS idx_locations_constraints ON locations USING GIN (constraints);

-- Update locații existente ce au zone_type sau tip în nume
-- Dacă există zone cu tip specific, marcăm constrângerile

-- Locații din zone de tip DRUM_RACK → permit doar DRUM
UPDATE locations l
SET
    allowed_packaging = '["DRUM"]'::JSONB,
    constraints = '{"min_length_m": 100}'::JSONB,
    suggestion_label = 'Zonă tamburi — doar tamburi > 100m'
FROM warehouse_zones wz
WHERE l.zone_id = wz.id
  AND (
    UPPER(wz.zone_name) LIKE '%TAMBUR%'
    OR UPPER(wz.zone_code) LIKE '%TAMBUR%'
    OR UPPER(wz.zone_name) LIKE '%DRUM%'
  )
  AND l.allowed_packaging IS NULL;

-- Locații din zone RESTURI → permit doar cabluri tăiate (mici)
UPDATE locations l
SET
    allowed_categories = '["cable"]'::JSONB,
    constraints = '{"max_length_m": 100}'::JSONB,
    suggestion_label = 'Zonă resturi — cabluri tăiate sub 100m'
FROM warehouse_zones wz
WHERE l.zone_id = wz.id
  AND (
    UPPER(wz.zone_name) LIKE '%REST%'
    OR UPPER(wz.zone_code) LIKE '%REST%'
  )
  AND l.allowed_categories IS NULL;

-- Locații din zone ECHIPAMENTE
UPDATE locations l
SET
    allowed_categories = '["equipment","electrical_panel","switch","accessory"]'::JSONB,
    suggestion_label = 'Zonă echipamente electrice'
FROM warehouse_zones wz
WHERE l.zone_id = wz.id
  AND (
    UPPER(wz.zone_name) LIKE '%ECHIPAMENT%'
    OR UPPER(wz.zone_code) LIKE '%ECHIP%'
  )
  AND l.allowed_categories IS NULL;

-- Verificare: câte locații au constrângeri setate
SELECT
    CASE
        WHEN allowed_categories IS NOT NULL AND allowed_packaging IS NOT NULL THEN 'Ambele'
        WHEN allowed_categories IS NOT NULL THEN 'Doar categorii'
        WHEN allowed_packaging IS NOT NULL THEN 'Doar ambalaj'
        ELSE 'Nicio constrângere'
    END as tip_constrangere,
    COUNT(*) as numar_locatii
FROM locations
GROUP BY tip_constrangere
ORDER BY tip_constrangere;
