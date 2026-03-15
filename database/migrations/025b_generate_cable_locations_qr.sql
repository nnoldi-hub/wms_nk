-- Migration 025: Generare locații cabluri + location_code + qr_code pe toate locațiile
-- Depozit: NKS001 (c61591b2-fa45-46fb-b5c2-574219392a05)
-- Zone cabluri: HALA-01 (e6fa528b), AER-02 (313e0ed6), TAIERE-01 (e884b708)

-- ============================================================
-- 1. Actualizare location_code pe locațiile existente (dacă lipsește)
-- ============================================================
UPDATE locations
SET location_code = id
WHERE location_code IS NULL OR location_code = '';

-- ============================================================
-- 2. Generare locații HALA rafturi tamburi mari (E1200/E1000)
--    Format: HALA-01-R{rack}-P{pos}
--    4 rânduri x 10 poziții = 40 locații
-- ============================================================
DO $$
DECLARE
  wh_id UUID := 'c61591b2-fa45-46fb-b5c2-574219392a05';
  zone_hala UUID := 'e6fa528b-e6c3-49d5-a4c6-c902dc7212e5';
  zone_aer  UUID := '313e0ed6-1816-4a1b-9629-51dc043ae1cf';
  zone_taiere UUID := 'e884b708-4df7-4ea6-a241-2db00e6de014';
  rack_no INT;
  pos_no INT;
  loc_id VARCHAR(50);
  loc_code VARCHAR(100);
BEGIN

  -- HALA rafturi pentru tamburi mari (E1200) — 4 rânduri x 10 poziții
  FOR rack_no IN 1..4 LOOP
    FOR pos_no IN 1..10 LOOP
      loc_id   := 'HALA-R' || LPAD(rack_no::TEXT, 2, '0') || '-P' || LPAD(pos_no::TEXT, 2, '0');
      loc_code := 'HALA-R' || LPAD(rack_no::TEXT, 2, '0') || '-P' || LPAD(pos_no::TEXT, 2, '0');

      INSERT INTO locations (
        id, zone, rack, position,
        location_code, barcode,
        warehouse_id, zone_id,
        is_active, status, is_pickable,
        requires_forklift, accessibility, priority,
        allowed_types, capacity_m3,
        notes
      ) VALUES (
        loc_id, 'HALA', 'R' || LPAD(rack_no::TEXT, 2, '0'), 'P' || LPAD(pos_no::TEXT, 2, '0'),
        loc_code, loc_code,
        wh_id, zone_hala,
        true, 'AVAILABLE', true,
        true, 'LOW', 5,
        ARRAY['DRUM', 'CABLU'],
        4.0,
        'Locație tamburi mari (E1200/E1000) — necesită stivuitor'
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- AER LIBER — locații exterioare tamburi voluminoși — 2 rânduri x 8 poziții
  FOR rack_no IN 1..2 LOOP
    FOR pos_no IN 1..8 LOOP
      loc_id   := 'AER-R' || LPAD(rack_no::TEXT, 2, '0') || '-P' || LPAD(pos_no::TEXT, 2, '0');
      loc_code := 'AER-R' || LPAD(rack_no::TEXT, 2, '0') || '-P' || LPAD(pos_no::TEXT, 2, '0');

      INSERT INTO locations (
        id, zone, rack, position,
        location_code, barcode,
        warehouse_id, zone_id,
        is_active, status, is_pickable,
        requires_forklift, accessibility, priority,
        allowed_types, capacity_m3,
        notes
      ) VALUES (
        loc_id, 'AER', 'R' || LPAD(rack_no::TEXT, 2, '0'), 'P' || LPAD(pos_no::TEXT, 2, '0'),
        loc_code, loc_code,
        wh_id, zone_aer,
        true, 'AVAILABLE', true,
        true, 'LOW', 7,
        ARRAY['DRUM', 'CABLU'],
        8.0,
        'Locație aer liber — tamburi voluminoși'
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- TAIERE — mese de lucru pentru derulare/tăiere — 1 rând x 6 mese
  FOR pos_no IN 1..6 LOOP
    loc_id   := 'TAIERE-M' || LPAD(pos_no::TEXT, 2, '0');
    loc_code := 'TAIERE-M' || LPAD(pos_no::TEXT, 2, '0');

    INSERT INTO locations (
      id, zone, rack, position,
      location_code, barcode,
      warehouse_id, zone_id,
      is_active, status, is_pickable,
      requires_forklift, accessibility, priority,
      allowed_types, capacity_m3,
      notes
    ) VALUES (
      loc_id, 'TAIERE', 'MESE', 'M' || LPAD(pos_no::TEXT, 2, '0'),
      loc_code, loc_code,
      wh_id, zone_taiere,
      true, 'AVAILABLE', true,
      false, 'HIGH', 1,
      ARRAY['COLAC', 'CABLU', 'REST'],
      1.0,
      'Masă derulare/tăiere cablu'
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

END $$;

-- ============================================================
-- 3. Generare qr_code JSON pe TOATE locațiile (unde lipsește)
-- ============================================================
UPDATE locations
SET qr_code = json_build_object(
  'type', 'WMS_LOCATION',
  'id', id,
  'code', COALESCE(location_code, id),
  'zone', COALESCE(zone, ''),
  'rack', COALESCE(rack, ''),
  'pos', COALESCE(position, '')
)::text
WHERE qr_code IS NULL OR qr_code = '';

-- ============================================================
-- 4. Verificare
-- ============================================================
SELECT
  zone,
  COUNT(*) AS total,
  COUNT(location_code) AS cu_code,
  COUNT(qr_code) AS cu_qr
FROM locations
GROUP BY zone
ORDER BY zone;
