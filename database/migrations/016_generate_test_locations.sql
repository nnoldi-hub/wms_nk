-- =========================================
-- MIGRARE: Generare Locații de Test
-- Data: 2025-10-31
-- Scop: Creare locații ierarhice pentru toate zonele depozitului
-- =========================================

-- Presupunem că există un depozit "DEPOZIT-BUC" (București)
-- Dacă nu există, îl vom crea mai jos

DO $$
DECLARE
    v_warehouse_id UUID;
    v_zone_hala_id UUID;
    v_zone_aer_id UUID;
    v_zone_taiere_id UUID;
    v_zone_livrare_id UUID;
    v_zone_receptie_id UUID;
    
    -- IDs pentru location types
    v_type_r_id UUID;
    v_type_h_id UUID;
    v_type_t_id UUID;
    v_type_c_id UUID;
    v_type_sector_id UUID;
    v_type_l_id UUID;
    v_type_p_id UUID;
    v_type_lt_id UUID;
    v_type_bl_id UUID;
    v_type_la_id UUID;
    v_type_se_id UUID;
    v_type_za_id UUID;
    v_type_rmp_id UUID;
    v_type_lr_id UUID;
    v_type_zt_id UUID;
    
    -- IDs pentru locații parent
    v_culoar_id UUID;
    v_raft_id UUID;
    v_nivel_id UUID;
    v_sector_id UUID;
    v_linie_id UUID;
    v_linie_taiere_id UUID;
    v_linie_ambalare_id UUID;
    v_rampa_id UUID;
BEGIN
    -- ============================================
    -- 1. VERIFICARE/CREARE DEPOZIT
    -- ============================================
    SELECT id INTO v_warehouse_id 
    FROM warehouses 
    WHERE warehouse_code = 'BUC' 
    LIMIT 1;
    
    IF v_warehouse_id IS NULL THEN
        v_warehouse_id := gen_random_uuid();
        INSERT INTO warehouses (
            id, 
            warehouse_code, 
            warehouse_name, 
            company_name,
            city,
            country,
            is_active
        )
        VALUES (
            v_warehouse_id,
            'BUC',
            'Depozit Bucuresti',
            'WMS NK Company',
            'București',
            'Romania',
            true
        );
        RAISE NOTICE 'Depozit BUC creat: %', v_warehouse_id;
    ELSE
        RAISE NOTICE 'Folosim depozit existent BUC: %', v_warehouse_id;
    END IF;
    
    -- ============================================
    -- 2. OBTINERE IDs PENTRU LOCATION TYPES
    -- ============================================
    SELECT id INTO v_type_r_id FROM location_types WHERE code = 'R';
    SELECT id INTO v_type_h_id FROM location_types WHERE code = 'H';
    SELECT id INTO v_type_t_id FROM location_types WHERE code = 'T';
    SELECT id INTO v_type_c_id FROM location_types WHERE code = 'C';
    SELECT id INTO v_type_sector_id FROM location_types WHERE code = 'SECTOR';
    SELECT id INTO v_type_l_id FROM location_types WHERE code = 'L';
    SELECT id INTO v_type_p_id FROM location_types WHERE code = 'P';
    SELECT id INTO v_type_lt_id FROM location_types WHERE code = 'LT';
    SELECT id INTO v_type_bl_id FROM location_types WHERE code = 'BL';
    SELECT id INTO v_type_la_id FROM location_types WHERE code = 'LA';
    SELECT id INTO v_type_se_id FROM location_types WHERE code = 'SE';
    SELECT id INTO v_type_za_id FROM location_types WHERE code = 'ZA';
    SELECT id INTO v_type_rmp_id FROM location_types WHERE code = 'RMP';
    SELECT id INTO v_type_lr_id FROM location_types WHERE code = 'LR';
    SELECT id INTO v_type_zt_id FROM location_types WHERE code = 'ZT';
    
    -- ============================================
    -- 3. CREARE ZONE
    -- ============================================
    
    -- Zona HALA-01
    v_zone_hala_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_hala_id, v_warehouse_id, 'HALA-01', 'Hală Rafturi 01', 'STORAGE', true);
    
    -- Zona AER-02 (Cablu)
    v_zone_aer_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_aer_id, v_warehouse_id, 'AER-02', 'Zona Aer Liber Cabluri', 'STORAGE', true);
    
    -- Zona TAIERE-01
    v_zone_taiere_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_taiere_id, v_warehouse_id, 'TAIERE-01', 'Zona Derulare Tăiere', 'PRODUCTION', true);
    
    -- Zona LIVRARE-01
    v_zone_livrare_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_livrare_id, v_warehouse_id, 'LIVRARE-01', 'Zona Pregătire Livrare', 'SHIPPING', true);
    
    -- Zona RECEPTIE-01
    v_zone_receptie_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_receptie_id, v_warehouse_id, 'RECEPTIE-01', 'Zona Recepție Marfă', 'RECEIVING', true);
    
    RAISE NOTICE '✅ Zone create: HALA, AER, TAIERE, LIVRARE, RECEPTIE';
    
    -- ============================================
    -- 4. 🔒 GENERARE LOCAȚII ZONA HALA (10 locații)
    -- Ierarhie: Culoar → Raft → Nivel → Cutie
    -- Notă: locations folosește location_code, nu are parent_location_id
    -- ============================================
    
    RAISE NOTICE '🔒 Generez locații HALA...';
    
    -- HALA-01-R01-H01-T01-C01
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, aisle, rack, shelf_level, bin_position, is_active, status)
    VALUES (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R01-H01-T01-C01', 'R01', 'H01', 1, 'C01', true, 'AVAILABLE');
    
    -- HALA-01-R01-H01-T01-C02
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, aisle, rack, shelf_level, bin_position, is_active, status)
    VALUES (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R01-H01-T01-C02', 'R01', 'H01', 1, 'C02', true, 'AVAILABLE');
    
    -- HALA-01-R01-H02-T02-C01
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, aisle, rack, shelf_level, bin_position, is_active, status)
    VALUES (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R01-H02-T02-C01', 'R01', 'H02', 2, 'C01', true, 'AVAILABLE');
    
    -- HALA-01-R02-H01-T01-C01
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, aisle, rack, shelf_level, bin_position, is_active, status)
    VALUES (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R02-H01-T01-C01', 'R02', 'H01', 1, 'C01', true, 'AVAILABLE');
    
    -- Mai adăugăm 6 locații HALA
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, aisle, rack, shelf_level, bin_position, is_active, status)
    VALUES 
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R02-H02-T02-C03', 'R02', 'H02', 2, 'C03', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R03-H03-T01-C01', 'R03', 'H03', 1, 'C01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R04-H01-T03-C02', 'R04', 'H01', 3, 'C02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R05-H04-T02-C04', 'R05', 'H04', 2, 'C04', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R05-H04-T03-C01', 'R05', 'H04', 3, 'C01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R05-H03-T01-C02', 'R05', 'H03', 1, 'C02', true, 'AVAILABLE');
    
    RAISE NOTICE '✅ 10 locații HALA create';
    
    -- ============================================
    -- 5. 🌤️ GENERARE LOCAȚII ZONA AER LIBER (10 locații)
    -- Ierarhie: Sector → Linie → Poziție
    -- ============================================
    
    RAISE NOTICE '🌤️ Generez locații AER LIBER...';
    
    -- Sector CABLU-CU
    v_sector_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (v_sector_id, v_zone_aer_id, v_type_sector_id, 'AER-CABLU-CU', true);
    
    v_linie_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES (v_linie_id, v_zone_aer_id, v_type_l_id, v_sector_id, 'AER-CABLU-CU-L01', true);
    
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_aer_id, v_type_p_id, v_linie_id, 'AER-CABLU-CU-L01-P01', true),
    (gen_random_uuid(), v_zone_aer_id, v_type_p_id, v_linie_id, 'AER-CABLU-CU-L01-P02', true);
    
    -- Sector CABLU-AL
    v_sector_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (v_sector_id, v_zone_aer_id, v_type_sector_id, 'AER-CABLU-AL', true);
    
    v_linie_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES (v_linie_id, v_zone_aer_id, v_type_l_id, v_sector_id, 'AER-CABLU-AL-L02', true);
    
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_aer_id, v_type_p_id, v_linie_id, 'AER-CABLU-AL-L02-P01', true),
    (gen_random_uuid(), v_zone_aer_id, v_type_p_id, v_linie_id, 'AER-CABLU-AL-L02-P02', true);
    
    -- Sector CABLU-FV
    v_sector_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (v_sector_id, v_zone_aer_id, v_type_sector_id, 'AER-CABLU-FV', true);
    
    v_linie_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES (v_linie_id, v_zone_aer_id, v_type_l_id, v_sector_id, 'AER-CABLU-FV-L03', true);
    
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_aer_id, v_type_p_id, v_linie_id, 'AER-CABLU-FV-L03-P01', true),
    (gen_random_uuid(), v_zone_aer_id, v_type_p_id, v_linie_id, 'AER-CABLU-FV-L03-P02', true);
    
    -- Mai adăugăm 2 locații
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_aer_id, v_type_p_id, 'AER-CABLU-CU-L04-P03', true),
    (gen_random_uuid(), v_zone_aer_id, v_type_p_id, 'AER-CABLU-AL-L05-P04', true);
    
    RAISE NOTICE '✅ 10 locații AER LIBER create';
    
    -- ============================================
    -- 6. ✂️ GENERARE LOCAȚII ZONA TAIERE (5 locații)
    -- ============================================
    
    RAISE NOTICE '✂️ Generez locații TAIERE...';
    
    -- Linie tăiere 01
    v_linie_taiere_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (v_linie_taiere_id, v_zone_taiere_id, v_type_lt_id, 'TAIERE-01-LT01', true);
    
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_taiere_id, v_type_bl_id, v_linie_taiere_id, 'TAIERE-01-LT01-BL01', true),
    (gen_random_uuid(), v_zone_taiere_id, v_type_bl_id, v_linie_taiere_id, 'TAIERE-01-LT01-BL02', true);
    
    -- Linie tăiere 02
    v_linie_taiere_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (v_linie_taiere_id, v_zone_taiere_id, v_type_lt_id, 'TAIERE-01-LT02', true);
    
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_taiere_id, v_type_bl_id, v_linie_taiere_id, 'TAIERE-01-LT02-BL01', true),
    (gen_random_uuid(), v_zone_taiere_id, v_type_bl_id, v_linie_taiere_id, 'TAIERE-01-LT02-BL02', true);
    
    -- Linie tăiere 03
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (gen_random_uuid(), v_zone_taiere_id, v_type_bl_id, 'TAIERE-01-LT03-BL01', true);
    
    RAISE NOTICE '✅ 5 locații TAIERE create';
    
    -- ============================================
    -- 7. 📦 GENERARE LOCAȚII ZONA LIVRARE (9 locații)
    -- ============================================
    
    RAISE NOTICE '📦 Generez locații LIVRARE...';
    
    -- CURIER (3 locații)
    v_linie_ambalare_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (v_linie_ambalare_id, v_zone_livrare_id, v_type_la_id, 'LIVRARE-CURIER-L01', true);
    
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_livrare_id, v_type_se_id, v_linie_ambalare_id, 'LIVRARE-CURIER-L01-S01', true),
    (gen_random_uuid(), v_zone_livrare_id, v_type_se_id, v_linie_ambalare_id, 'LIVRARE-CURIER-L01-S02', true),
    (gen_random_uuid(), v_zone_livrare_id, v_type_se_id, 'LIVRARE-CURIER-L02-S01', true);
    
    -- INTERN (3 locații)
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_livrare_id, v_type_se_id, 'LIVRARE-INTERN-L01-S01', true),
    (gen_random_uuid(), v_zone_livrare_id, v_type_se_id, 'LIVRARE-INTERN-L02-S01', true),
    (gen_random_uuid(), v_zone_livrare_id, v_type_se_id, 'LIVRARE-INTERN-L02-S02', true);
    
    -- RIDICARE (3 locații)
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_livrare_id, v_type_za_id, 'LIVRARE-RIDICARE-L01-S01', true),
    (gen_random_uuid(), v_zone_livrare_id, v_type_za_id, 'LIVRARE-RIDICARE-L01-S02', true),
    (gen_random_uuid(), v_zone_livrare_id, v_type_za_id, 'LIVRARE-RIDICARE-L02-S01', true);
    
    RAISE NOTICE '✅ 9 locații LIVRARE create';
    
    -- ============================================
    -- 8. 📥 GENERARE LOCAȚII ZONA RECEPTIE (5 locații)
    -- ============================================
    
    RAISE NOTICE '📥 Generez locații RECEPTIE...';
    
    -- Rampă 01
    v_rampa_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (v_rampa_id, v_zone_receptie_id, v_type_rmp_id, 'RECEPTIE-01-RMP01', true);
    
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_receptie_id, v_type_lr_id, v_rampa_id, 'RECEPTIE-01-RMP01-LR01-ZT01', true),
    (gen_random_uuid(), v_zone_receptie_id, v_type_lr_id, v_rampa_id, 'RECEPTIE-01-RMP01-LR02-ZT02', true);
    
    -- Rampă 02
    v_rampa_id := gen_random_uuid();
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (v_rampa_id, v_zone_receptie_id, v_type_rmp_id, 'RECEPTIE-01-RMP02', true);
    
    INSERT INTO locations (id, zone_id, location_type_id, parent_location_id, code, is_active)
    VALUES 
    (gen_random_uuid(), v_zone_receptie_id, v_type_lr_id, v_rampa_id, 'RECEPTIE-01-RMP02-LR01-ZT01', true),
    (gen_random_uuid(), v_zone_receptie_id, v_type_lr_id, v_rampa_id, 'RECEPTIE-01-RMP02-LR02-ZT02', true);
    
    -- Rampă 03
    INSERT INTO locations (id, zone_id, location_type_id, code, is_active)
    VALUES (gen_random_uuid(), v_zone_receptie_id, v_type_zt_id, 'RECEPTIE-01-RMP03-LR03-ZT03', true);
    
    RAISE NOTICE '✅ 5 locații RECEPTIE create';
    
    -- ============================================
    -- SUMAR FINAL
    -- ============================================
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🎉 GENERARE COMPLETĂ!';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '✅ Depozit: BUC (București)';
    RAISE NOTICE '✅ Zone: 5 (HALA, AER, TAIERE, LIVRARE, RECEPTIE)';
    RAISE NOTICE '✅ Locații totale: 39';
    RAISE NOTICE '   🔒 HALA: 10 locații';
    RAISE NOTICE '   🌤️ AER LIBER: 10 locații';
    RAISE NOTICE '   ✂️ TAIERE: 5 locații';
    RAISE NOTICE '   📦 LIVRARE: 9 locații';
    RAISE NOTICE '   📥 RECEPTIE: 5 locații';
    RAISE NOTICE '==========================================';
    
END $$;

-- ============================================
-- VERIFICARE REZULTAT
-- ============================================

-- Verifică depozitul
SELECT 
    '🏢 DEPOZIT' as categorie,
    code,
    name,
    location,
    is_active
FROM warehouses
WHERE code = 'BUC';

-- Verifică zonele
SELECT 
    '📍 ZONE' as categorie,
    code,
    name,
    zone_type,
    is_active
FROM zones
WHERE warehouse_id IN (SELECT id FROM warehouses WHERE code = 'BUC')
ORDER BY code;

-- Verifică distribuția locațiilor pe zone
SELECT 
    z.code as zona,
    lt.code as tip_locatie,
    lt.name as nume_tip,
    COUNT(l.id) as numar_locatii
FROM locations l
JOIN zones z ON l.zone_id = z.id
JOIN location_types lt ON l.location_type_id = lt.id
WHERE z.warehouse_id IN (SELECT id FROM warehouses WHERE code = 'BUC')
GROUP BY z.code, lt.code, lt.name
ORDER BY z.code, lt.code;

-- Afișează primele 5 locații din fiecare zonă
SELECT 
    '📦 EXEMPLE LOCAȚII' as categorie,
    z.code as zona,
    l.code as cod_locatie,
    lt.code as tip,
    l.aisle as culoar,
    l.rack as raft,
    l.shelf as nivel,
    l.bin as cutie
FROM locations l
JOIN zones z ON l.zone_id = z.id
JOIN location_types lt ON l.location_type_id = lt.id
WHERE z.warehouse_id IN (SELECT id FROM warehouses WHERE code = 'BUC')
ORDER BY z.code, l.code
LIMIT 20;
