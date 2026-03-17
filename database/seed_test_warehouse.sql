-- ============================================================
-- SEED: Depozit Test NKS Cables — 30.000 mp
-- Genereaza ~2.668 locatii conform specificatiei
-- ============================================================

BEGIN;

-- ── VARIABILE GLOBALE (IDuri reutilizate) ─────────────────────
-- Obtinem adminul pentru created_by
DO $$
DECLARE
  v_admin_id       uuid;
  v_wh_id          uuid;

  -- zone IDs
  v_zone_recv      uuid;
  v_zone_h1        uuid;
  v_zone_h2        uuid;
  v_zone_h3        uuid;
  v_zone_ext       uuid;
  v_zone_ship      uuid;

  -- location type IDs
  v_lt_rack_std    uuid;
  v_lt_rack_pallet uuid;
  v_lt_drl_small   uuid;
  v_lt_drl_large   uuid;
  v_lt_rack_resturi uuid;
  v_lt_rack_echip  uuid;
  v_lt_floor_heavy uuid;
  v_lt_tambur      uuid;
  v_lt_receptie    uuid;
  v_lt_zona_astept uuid;
  v_lt_zona_tampon uuid;

  -- contoare / iteratori
  v_aisle    int;
  v_rack     int;
  v_level    int;
  v_bin      int;
  v_loc_id   text;
  v_loc_code text;
BEGIN

  SELECT id INTO v_admin_id FROM users WHERE role = 'admin' LIMIT 1;

  -- ══════════════════════════════════════════════════════════
  -- 1. WAREHOUSE
  -- ══════════════════════════════════════════════════════════
  INSERT INTO warehouses (
    warehouse_code, warehouse_name, company_name,
    street, city, postal_code, country,
    total_area_sqm, height_meters, layout_type,
    is_active, setup_completed, created_by
  ) VALUES (
    'NKS-TEST',
    'Depozit Test NKS Cables',
    'NKS Cables SRL',
    'Str. Industriala nr. 1',
    'Bucuresti',
    '077190',
    'Romania',
    30000.00, 8.00, 'MULTI_FLOOR',
    true, true, v_admin_id
  )
  RETURNING id INTO v_wh_id;

  -- ══════════════════════════════════════════════════════════
  -- 2. ZONE (6 zone logice)
  -- ══════════════════════════════════════════════════════════
  INSERT INTO warehouse_zones (warehouse_id, zone_code, zone_name, zone_type, width, height, is_active)
  VALUES (v_wh_id, 'RECV', 'Receptie',               'RECEIVING',  100.00, 50.00, true) RETURNING id INTO v_zone_recv;

  INSERT INTO warehouse_zones (warehouse_id, zone_code, zone_name, zone_type, width, height, is_active)
  VALUES (v_wh_id, 'H1',   'Cabluri Mici (Hala 1)',  'STORAGE',    200.00, 50.00, true) RETURNING id INTO v_zone_h1;

  INSERT INTO warehouse_zones (warehouse_id, zone_code, zone_name, zone_type, width, height, is_active)
  VALUES (v_wh_id, 'H2',   'Derulatoare (Hala 2)',   'STORAGE',    200.00, 50.00, true) RETURNING id INTO v_zone_h2;

  INSERT INTO warehouse_zones (warehouse_id, zone_code, zone_name, zone_type, width, height, is_active)
  VALUES (v_wh_id, 'H3',   'Echipamente (Hala 3)',   'STORAGE',    200.00, 50.00, true) RETURNING id INTO v_zone_h3;

  INSERT INTO warehouse_zones (warehouse_id, zone_code, zone_name, zone_type, width, height, is_active)
  VALUES (v_wh_id, 'EXT',  'Platforma Betonata',     'EXTERIOR',   300.00, 50.00, true) RETURNING id INTO v_zone_ext;

  INSERT INTO warehouse_zones (warehouse_id, zone_code, zone_name, zone_type, width, height, is_active)
  VALUES (v_wh_id, 'SHIP', 'Expediere',              'SHIPPING',   100.00, 50.00, true) RETURNING id INTO v_zone_ship;

  -- ══════════════════════════════════════════════════════════
  -- 3. TIPURI LOCATII (12 tipuri)
  -- ══════════════════════════════════════════════════════════

  -- RACK_STANDARD (Hala 1 — cutii, colaci, cabluri mici)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('RACK_STANDARD', 'Raft Standard', 'BOX',
    120, 80, 100,  500, 0.96,
    false, true, true)
  RETURNING id INTO v_lt_rack_std;

  -- RACK_PALLET (Hala 1 — paleti)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('RACK_PALLET', 'Raft Paleti', 'PALLET',
    120, 100, 150, 1500, 1.80,
    true, true, true)
  RETURNING id INTO v_lt_rack_pallet;

  -- DRL_SMALL (Hala 1 — derulator tamburi mici)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('DRL_SMALL', 'Derulator Mic', 'DRUM',
    200, 200, 150, 3000, 6.00,
    true, true, true)
  RETURNING id INTO v_lt_drl_small;

  -- DRL_LARGE (Hala 2 — derulatoare mari)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('DRL_LARGE', 'Derulator Mare', 'DRUM',
    400, 400, 250, 8000, 40.00,
    true, true, true)
  RETURNING id INTO v_lt_drl_large;

  -- RACK_RESTURI (Hala 2 — resturi cabluri)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('RACK_RESTURI', 'Raft Resturi Cabluri', 'BOX',
    120, 80, 100,  300, 0.96,
    false, true, true)
  RETURNING id INTO v_lt_rack_resturi;

  -- RACK_ECHIPAMENTE (Hala 3)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('RACK_ECHIPAMENTE', 'Raft Echipamente', 'BOX',
    120, 80, 120,  600, 1.15,
    false, true, true)
  RETURNING id INTO v_lt_rack_echip;

  -- FLOOR_HEAVY (Hala 3 — platbanda, teava, copex)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('FLOOR_HEAVY', 'Podea Marfa Grea', 'BULK',
    300, 200, 100, 5000, 6.00,
    true, true, true)
  RETURNING id INTO v_lt_floor_heavy;

  -- TAMBUR (Exterior — tamburi T500-T3500)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('TAMBUR', 'Locatie Tambur Exterior', 'DRUM',
    400, 400, 350, 12000, 56.00,
    true, true, true)
  RETURNING id INTO v_lt_tambur;

  -- LR (Receptie)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('LR', 'Locatie Receptie', 'PALLET',
    150, 150, 200, 2000, 4.50,
    true, true, true)
  RETURNING id INTO v_lt_receptie;

  -- ZA (Zona Asteptare Livrare)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('ZA', 'Zona Asteptare Livrare', 'PALLET',
    150, 150, 200, 2000, 4.50,
    true, false, true)
  RETURNING id INTO v_lt_zona_astept;

  -- ZT (Zona Tampon)
  INSERT INTO location_types (code, name, capacity_type,
    default_width_cm, default_depth_cm, default_height_cm,
    default_max_weight_kg, default_max_volume_cubic_meters,
    requires_forklift, is_pickable, is_active)
  VALUES ('ZT', 'Zona Tampon', 'PALLET',
    150, 150, 200, 2000, 4.50,
    true, false, true)
  RETURNING id INTO v_lt_zona_tampon;

  -- ══════════════════════════════════════════════════════════
  -- 4. GENERARE LOCATII
  -- ══════════════════════════════════════════════════════════

  -- ── RECEPȚIE: 20 locatii LR (RECV-LR-01 … RECV-LR-20) ──
  FOR v_rack IN 1..20 LOOP
    v_loc_code := 'RECV-LR-' || LPAD(v_rack::text, 2, '0');
    v_loc_id   := v_loc_code;
    INSERT INTO locations (
      id, location_code, barcode, qr_code,
      warehouse_id, zone_id, location_type_id,
      zone, rack, position, aisle, shelf_level, bin_position,
      width_cm, depth_cm, height_cm,
      max_weight_kg, max_volume_cubic_meters,
      is_active, is_pickable, status, priority, requires_forklift, created_by
    ) VALUES (
      v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
      v_wh_id, v_zone_recv, v_lt_receptie,
      'RECV', v_rack::text, '1', 'A', 1, '1',
      150, 150, 200,
      2000, 4.50,
      true, true, 'AVAILABLE', 1, true, v_admin_id
    );
  END LOOP;

  -- ── HALA 1 – RACK_STANDARD: 4 culoare × 20 rafturi × 4 niveluri × 4 bin-uri = 1.280 locatii ──
  -- Cod: H1-RS-{culoar}{raft}-{nivel}-{bin}  ex: H1-RS-A01-1-1
  FOR v_aisle IN 1..4 LOOP
    FOR v_rack IN 1..20 LOOP
      FOR v_level IN 1..4 LOOP
        FOR v_bin IN 1..4 LOOP
          v_loc_code := 'H1-RS-' || CHR(64 + v_aisle) || LPAD(v_rack::text, 2, '0')
                        || '-' || v_level || '-' || v_bin;
          v_loc_id := v_loc_code;
          INSERT INTO locations (
            id, location_code, barcode, qr_code,
            warehouse_id, zone_id, location_type_id,
            zone, rack, position, aisle, shelf_level, bin_position,
            width_cm, depth_cm, height_cm,
            max_weight_kg, max_volume_cubic_meters,
            is_active, is_pickable, status, priority, requires_forklift, created_by
          ) VALUES (
            v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
            v_wh_id, v_zone_h1, v_lt_rack_std,
            'H1', v_rack::text, v_bin::text,
            CHR(64 + v_aisle), v_level, v_bin::text,
            120, 80, 100,
            500, 0.96,
            true, true, 'AVAILABLE', 5, false, v_admin_id
          );
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ── HALA 1 – RACK_PALLET: 2 culoare × 15 rafturi × 3 niveluri × 1 bin = 90 locatii ──
  FOR v_aisle IN 1..2 LOOP
    FOR v_rack IN 1..15 LOOP
      FOR v_level IN 1..3 LOOP
        v_loc_code := 'H1-RP-' || CHR(64 + v_aisle) || LPAD(v_rack::text, 2, '0')
                      || '-' || v_level;
        v_loc_id := v_loc_code;
        INSERT INTO locations (
          id, location_code, barcode, qr_code,
          warehouse_id, zone_id, location_type_id,
          zone, rack, position, aisle, shelf_level, bin_position,
          width_cm, depth_cm, height_cm,
          max_weight_kg, max_volume_cubic_meters, max_pallets,
          is_active, is_pickable, status, priority, requires_forklift, created_by
        ) VALUES (
          v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
          v_wh_id, v_zone_h1, v_lt_rack_pallet,
          'H1', v_rack::text, '1',
          CHR(64 + v_aisle), v_level, '1',
          120, 100, 150,
          1500, 1.80, 1,
          true, true, 'AVAILABLE', 5, true, v_admin_id
        );
      END LOOP;
    END LOOP;
  END LOOP;

  -- ── HALA 1 – DRL_SMALL: 4 locatii derulator mic ──
  FOR v_rack IN 1..4 LOOP
    v_loc_code := 'H1-DRL-' || LPAD(v_rack::text, 2, '0');
    v_loc_id := v_loc_code;
    INSERT INTO locations (
      id, location_code, barcode, qr_code,
      warehouse_id, zone_id, location_type_id,
      zone, rack, position, aisle, shelf_level, bin_position,
      width_cm, depth_cm, height_cm,
      max_weight_kg, max_volume_cubic_meters,
      is_active, is_pickable, status, priority, requires_forklift, created_by
    ) VALUES (
      v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
      v_wh_id, v_zone_h1, v_lt_drl_small,
      'H1', v_rack::text, '1', 'DRL', 1, '1',
      200, 200, 150,
      3000, 6.00,
      true, true, 'AVAILABLE', 3, true, v_admin_id
    );
  END LOOP;

  -- ── HALA 2 – DRL_LARGE: 4 derulatoare mari ──
  FOR v_rack IN 1..4 LOOP
    v_loc_code := 'H2-DRL-' || LPAD(v_rack::text, 2, '0');
    v_loc_id := v_loc_code;
    INSERT INTO locations (
      id, location_code, barcode, qr_code,
      warehouse_id, zone_id, location_type_id,
      zone, rack, position, aisle, shelf_level, bin_position,
      width_cm, depth_cm, height_cm,
      max_weight_kg, max_volume_cubic_meters,
      is_active, is_pickable, status, priority, requires_forklift, created_by
    ) VALUES (
      v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
      v_wh_id, v_zone_h2, v_lt_drl_large,
      'H2', v_rack::text, '1', 'DRL', 1, '1',
      400, 400, 250,
      8000, 40.00,
      true, true, 'AVAILABLE', 1, true, v_admin_id
    );
  END LOOP;

  -- ── HALA 2 – RACK_RESTURI: 2 culoare × 10 rafturi × 4 niveluri × 4 bin-uri = 320 locatii ──
  FOR v_aisle IN 1..2 LOOP
    FOR v_rack IN 1..10 LOOP
      FOR v_level IN 1..4 LOOP
        FOR v_bin IN 1..4 LOOP
          v_loc_code := 'H2-RR-' || CHR(64 + v_aisle) || LPAD(v_rack::text, 2, '0')
                        || '-' || v_level || '-' || v_bin;
          v_loc_id := v_loc_code;
          INSERT INTO locations (
            id, location_code, barcode, qr_code,
            warehouse_id, zone_id, location_type_id,
            zone, rack, position, aisle, shelf_level, bin_position,
            width_cm, depth_cm, height_cm,
            max_weight_kg, max_volume_cubic_meters,
            is_active, is_pickable, status, priority, requires_forklift, created_by
          ) VALUES (
            v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
            v_wh_id, v_zone_h2, v_lt_rack_resturi,
            'H2', v_rack::text, v_bin::text,
            CHR(64 + v_aisle), v_level, v_bin::text,
            120, 80, 100,
            300, 0.96,
            true, true, 'AVAILABLE', 5, false, v_admin_id
          );
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ── HALA 3 – RACK_ECHIPAMENTE: 3 culoare × 15 rafturi × 4 niveluri × 4 bin-uri = 720 locatii ──
  FOR v_aisle IN 1..3 LOOP
    FOR v_rack IN 1..15 LOOP
      FOR v_level IN 1..4 LOOP
        FOR v_bin IN 1..4 LOOP
          v_loc_code := 'H3-RE-' || CHR(64 + v_aisle) || LPAD(v_rack::text, 2, '0')
                        || '-' || v_level || '-' || v_bin;
          v_loc_id := v_loc_code;
          INSERT INTO locations (
            id, location_code, barcode, qr_code,
            warehouse_id, zone_id, location_type_id,
            zone, rack, position, aisle, shelf_level, bin_position,
            width_cm, depth_cm, height_cm,
            max_weight_kg, max_volume_cubic_meters,
            is_active, is_pickable, status, priority, requires_forklift, created_by
          ) VALUES (
            v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
            v_wh_id, v_zone_h3, v_lt_rack_echip,
            'H3', v_rack::text, v_bin::text,
            CHR(64 + v_aisle), v_level, v_bin::text,
            120, 80, 120,
            600, 1.15,
            true, true, 'AVAILABLE', 5, false, v_admin_id
          );
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ── HALA 3 – FLOOR_HEAVY: 50 locatii podea ──
  FOR v_rack IN 1..50 LOOP
    v_loc_code := 'H3-FH-' || LPAD(v_rack::text, 2, '0');
    v_loc_id := v_loc_code;
    INSERT INTO locations (
      id, location_code, barcode, qr_code,
      warehouse_id, zone_id, location_type_id,
      zone, rack, position, aisle, shelf_level, bin_position,
      width_cm, depth_cm, height_cm,
      max_weight_kg, max_volume_cubic_meters,
      is_active, is_pickable, status, priority, requires_forklift, created_by
    ) VALUES (
      v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
      v_wh_id, v_zone_h3, v_lt_floor_heavy,
      'H3', v_rack::text, '1', 'FH', 1, '1',
      300, 200, 100,
      5000, 6.00,
      true, true, 'AVAILABLE', 3, true, v_admin_id
    );
  END LOOP;

  -- ── EXTERIOR – TAMBUR: 3 randuri × 50 locatii = 150 ──
  FOR v_aisle IN 1..3 LOOP
    FOR v_rack IN 1..50 LOOP
      v_loc_code := 'EXT-T-' || CHR(64 + v_aisle) || LPAD(v_rack::text, 2, '0');
      v_loc_id := v_loc_code;
      INSERT INTO locations (
        id, location_code, barcode, qr_code,
        warehouse_id, zone_id, location_type_id,
        zone, rack, position, aisle, shelf_level, bin_position,
        width_cm, depth_cm, height_cm,
        max_weight_kg, max_volume_cubic_meters,
        is_active, is_pickable, status, priority, requires_forklift, created_by
      ) VALUES (
        v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
        v_wh_id, v_zone_ext, v_lt_tambur,
        'EXT', v_rack::text, '1',
        CHR(64 + v_aisle), 1, '1',
        400, 400, 350,
        12000, 56.00,
        true, true, 'AVAILABLE', 3, true, v_admin_id
      );
    END LOOP;
  END LOOP;

  -- ── LIVRARE – ZA: 15 locatii asteptare ──
  FOR v_rack IN 1..15 LOOP
    v_loc_code := 'SHIP-ZA-' || LPAD(v_rack::text, 2, '0');
    v_loc_id := v_loc_code;
    INSERT INTO locations (
      id, location_code, barcode, qr_code,
      warehouse_id, zone_id, location_type_id,
      zone, rack, position, aisle, shelf_level, bin_position,
      width_cm, depth_cm, height_cm,
      max_weight_kg, max_volume_cubic_meters,
      is_active, is_pickable, status, priority, requires_forklift, created_by
    ) VALUES (
      v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
      v_wh_id, v_zone_ship, v_lt_zona_astept,
      'SHIP', v_rack::text, '1', 'ZA', 1, '1',
      150, 150, 200,
      2000, 4.50,
      true, false, 'AVAILABLE', 2, true, v_admin_id
    );
  END LOOP;

  -- ── LIVRARE – ZT: 15 locatii tampon ──
  FOR v_rack IN 1..15 LOOP
    v_loc_code := 'SHIP-ZT-' || LPAD(v_rack::text, 2, '0');
    v_loc_id := v_loc_code;
    INSERT INTO locations (
      id, location_code, barcode, qr_code,
      warehouse_id, zone_id, location_type_id,
      zone, rack, position, aisle, shelf_level, bin_position,
      width_cm, depth_cm, height_cm,
      max_weight_kg, max_volume_cubic_meters,
      is_active, is_pickable, status, priority, requires_forklift, created_by
    ) VALUES (
      v_loc_id, v_loc_code, 'BC-' || v_loc_code, 'QR-' || v_loc_code,
      v_wh_id, v_zone_ship, v_lt_zona_tampon,
      'SHIP', v_rack::text, '1', 'ZT', 1, '1',
      150, 150, 200,
      2000, 4.50,
      true, false, 'AVAILABLE', 2, true, v_admin_id
    );
  END LOOP;

  -- ══════════════════════════════════════════════════════════
  -- 5. WAREHOUSE SETTINGS
  -- ══════════════════════════════════════════════════════════
  INSERT INTO warehouse_settings (warehouse_id, setting_category, setting_key, setting_value, setting_type, display_name, description, is_editable)
  VALUES
    (v_wh_id, 'OPERATIONS', 'picking_strategy',     '"FIFO"',       'STRING',  'Strategie Picking',    'Strategie picking implicita',               true),
    (v_wh_id, 'OPERATIONS', 'putaway_strategy',     '"ZONE_BASED"', 'STRING',  'Strategie Putaway',   'Strategie putaway implicita',                true),
    (v_wh_id, 'ALERTS',     'min_stock_alert',      '10',           'NUMBER',  'Prag Minim Stoc',     'Prag minim stoc pentru alerta',              true),
    (v_wh_id, 'OPERATIONS', 'auto_putaway',         'true',         'BOOLEAN', 'Putaway Automat',     'Putaway automat activat',                    true),
    (v_wh_id, 'TRACKING',   'lot_tracking_enabled', 'true',         'BOOLEAN', 'Tracking Loturi',     'Tracking loturi activat',                    true),
    (v_wh_id, 'OPERATIONS', 'qr_scan_required',     'true',         'BOOLEAN', 'Scanare QR',          'Scanare QR obligatorie la putaway',          true),
    (v_wh_id, 'GENERAL',    'default_currency',     '"RON"',        'STRING',  'Moneda Implicita',    'Moneda implicita',                           true),
    (v_wh_id, 'GENERAL',    'weight_unit',          '"kg"',         'STRING',  'Unitate Greutate',    'Unitate greutate',                           true),
    (v_wh_id, 'GENERAL',    'length_unit',          '"m"',          'STRING',  'Unitate Lungime',     'Unitate lungime cablu',                      true),
    (v_wh_id, 'ERP',        'erp_sync_enabled',     'false',        'BOOLEAN', 'Sincronizare ERP',    'Sincronizare ERP (configurat separat)',       true);

  RAISE NOTICE '✅ Depozit creat cu ID: %', v_wh_id;
  RAISE NOTICE '📦 Zone create: RECV, H1, H2, H3, EXT, SHIP';
  RAISE NOTICE '📍 Tipuri locatii create: 11';
  RAISE NOTICE '🗂️  Locatii generate: 20 + 1280 + 90 + 4 + 4 + 320 + 720 + 50 + 150 + 15 + 15 = 2668';

END $$;

-- ══════════════════════════════════════════════════════════
-- VERIFICARE FINALA
-- ══════════════════════════════════════════════════════════
SELECT 'WAREHOUSE' AS entitate, warehouse_code, warehouse_name, total_area_sqm || ' mp' AS info
FROM warehouses WHERE warehouse_code = 'NKS-TEST';

SELECT z.zone_code, z.zone_name, z.zone_type,
       COUNT(l.id) AS nr_locatii
FROM warehouse_zones z
LEFT JOIN locations l ON l.zone_id = z.id
WHERE z.warehouse_id = (SELECT id FROM warehouses WHERE warehouse_code = 'NKS-TEST')
GROUP BY z.zone_code, z.zone_name, z.zone_type
ORDER BY z.zone_code;

SELECT lt.code, lt.name,
       COUNT(l.id) AS nr_locatii
FROM location_types lt
LEFT JOIN locations l ON l.location_type_id = lt.id
GROUP BY lt.code, lt.name
HAVING COUNT(l.id) > 0
ORDER BY COUNT(l.id) DESC;

SELECT 'TOTAL LOCATII' AS label, COUNT(*) AS total
FROM locations
WHERE warehouse_id = (SELECT id FROM warehouses WHERE warehouse_code = 'NKS-TEST');

COMMIT;
