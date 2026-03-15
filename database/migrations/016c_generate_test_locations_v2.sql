-- =========================================
-- MIGRARE: Generare Locații de Test (Simplificat)
-- Data: 2025-10-31
-- Scop: Creare locații pentru toate zonele depozitului
-- =========================================

DO $$
DECLARE
    v_warehouse_id UUID;
    v_zone_hala_id UUID;
    v_zone_aer_id UUID;
    v_zone_taiere_id UUID;
    v_zone_livrare_id UUID;
    v_zone_receptie_id UUID;
    
    -- IDs pentru location types
    v_type_c_id UUID;
    v_type_p_id UUID;
    v_type_bl_id UUID;
    v_type_se_id UUID;
    v_type_za_id UUID;
    v_type_lr_id UUID;
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
            id, warehouse_code, warehouse_name, company_name, city, country, is_active
        )
        VALUES (
            v_warehouse_id, 'BUC', 'Depozit Bucuresti', 'WMS NK Company',
            'București', 'Romania', true
        );
        RAISE NOTICE 'Depozit BUC creat: %', v_warehouse_id;
    ELSE
        RAISE NOTICE 'Folosim depozit existent BUC: %', v_warehouse_id;
    END IF;
    
    -- ============================================
    -- 2. OBTINERE IDs PENTRU LOCATION TYPES
    -- ============================================
    SELECT id INTO v_type_c_id FROM location_types WHERE code = 'C';
    SELECT id INTO v_type_p_id FROM location_types WHERE code = 'P';
    SELECT id INTO v_type_bl_id FROM location_types WHERE code = 'BL';
    SELECT id INTO v_type_se_id FROM location_types WHERE code = 'SE';
    SELECT id INTO v_type_za_id FROM location_types WHERE code = 'ZA';
    SELECT id INTO v_type_lr_id FROM location_types WHERE code = 'LR';
    
    -- ============================================
    -- 3. CREARE ZONE
    -- ============================================
    
    v_zone_hala_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_hala_id, v_warehouse_id, 'HALA-01', 'Hală Rafturi 01', 'STORAGE', true);
    
    v_zone_aer_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_aer_id, v_warehouse_id, 'AER-02', 'Zona Aer Liber Cabluri', 'STORAGE', true);
    
    v_zone_taiere_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_taiere_id, v_warehouse_id, 'TAIERE-01', 'Zona Derulare Tăiere', 'PRODUCTION', true);
    
    v_zone_livrare_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_livrare_id, v_warehouse_id, 'LIVRARE-01', 'Zona Pregătire Livrare', 'SHIPPING', true);
    
    v_zone_receptie_id := gen_random_uuid();
    INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
    VALUES (v_zone_receptie_id, v_warehouse_id, 'RECEPTIE-01', 'Zona Recepție Marfă', 'RECEIVING', true);
    
    RAISE NOTICE '✅ Zone create: 5 zone';
    
    -- ============================================
    -- 4. 🔒 GENERARE LOCAȚII ZONA HALA (10 locații)
    -- ============================================
    
    RAISE NOTICE '🔒 Generez locații HALA...';
    
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, aisle, rack, shelf_level, bin_position, is_active, status)
    VALUES 
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R01-H01-T01-C01', 'R01', 'H01', 1, 'C01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R01-H01-T01-C02', 'R01', 'H01', 1, 'C02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R01-H02-T02-C01', 'R01', 'H02', 2, 'C01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R02-H01-T01-C01', 'R02', 'H01', 1, 'C01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R02-H02-T02-C03', 'R02', 'H02', 2, 'C03', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R03-H03-T01-C01', 'R03', 'H03', 1, 'C01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R04-H01-T03-C02', 'R04', 'H01', 3, 'C02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R05-H04-T02-C04', 'R05', 'H04', 2, 'C04', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R05-H04-T03-C01', 'R05', 'H04', 3, 'C01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_hala_id, v_type_c_id, 'HALA-01-R05-H03-T01-C02', 'R05', 'H03', 1, 'C02', true, 'AVAILABLE');
    
    RAISE NOTICE '✅ 10 locații HALA create';
    
    -- ============================================
    -- 5. 🌤️ GENERARE LOCAȚII ZONA AER LIBER (10 locații)
    -- ============================================
    
    RAISE NOTICE '🌤️ Generez locații AER LIBER...';
    
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, is_active, status)
    VALUES 
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-CU-L01-P01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-CU-L01-P02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-AL-L02-P01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-AL-L02-P02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-FV-L03-P01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-FV-L03-P02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-CU-L04-P03', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-AL-L05-P04', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-FV-L05-P05', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_aer_id, v_type_p_id, 'AER-CABLU-CU-L05-P06', true, 'AVAILABLE');
    
    RAISE NOTICE '✅ 10 locații AER LIBER create';
    
    -- ============================================
    -- 6. ✂️ GENERARE LOCAȚII ZONA TAIERE (5 locații)
    -- ============================================
    
    RAISE NOTICE '✂️ Generez locații TAIERE...';
    
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, is_active, status)
    VALUES 
    (gen_random_uuid(), v_warehouse_id, v_zone_taiere_id, v_type_bl_id, 'TAIERE-01-LT01-BL01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_taiere_id, v_type_bl_id, 'TAIERE-01-LT01-BL02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_taiere_id, v_type_bl_id, 'TAIERE-01-LT02-BL01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_taiere_id, v_type_bl_id, 'TAIERE-01-LT02-BL02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_taiere_id, v_type_bl_id, 'TAIERE-01-LT03-BL01', true, 'AVAILABLE');
    
    RAISE NOTICE '✅ 5 locații TAIERE create';
    
    -- ============================================
    -- 7. 📦 GENERARE LOCAȚII ZONA LIVRARE (9 locații)
    -- ============================================
    
    RAISE NOTICE '📦 Generez locații LIVRARE...';
    
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, is_active, status)
    VALUES 
    -- CURIER (3 locații)
    (gen_random_uuid(), v_warehouse_id, v_zone_livrare_id, v_type_se_id, 'LIVRARE-CURIER-L01-S01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_livrare_id, v_type_se_id, 'LIVRARE-CURIER-L01-S02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_livrare_id, v_type_se_id, 'LIVRARE-CURIER-L02-S01', true, 'AVAILABLE'),
    -- INTERN (3 locații)
    (gen_random_uuid(), v_warehouse_id, v_zone_livrare_id, v_type_se_id, 'LIVRARE-INTERN-L01-S01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_livrare_id, v_type_se_id, 'LIVRARE-INTERN-L02-S01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_livrare_id, v_type_se_id, 'LIVRARE-INTERN-L02-S02', true, 'AVAILABLE'),
    -- RIDICARE (3 locații)
    (gen_random_uuid(), v_warehouse_id, v_zone_livrare_id, v_type_za_id, 'LIVRARE-RIDICARE-L01-S01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_livrare_id, v_type_za_id, 'LIVRARE-RIDICARE-L01-S02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_livrare_id, v_type_za_id, 'LIVRARE-RIDICARE-L02-S01', true, 'AVAILABLE');
    
    RAISE NOTICE '✅ 9 locații LIVRARE create';
    
    -- ============================================
    -- 8. 📥 GENERARE LOCAȚII ZONA RECEPTIE (5 locații)
    -- ============================================
    
    RAISE NOTICE '📥 Generez locații RECEPTIE...';
    
    INSERT INTO locations (id, warehouse_id, zone_id, location_type_id, location_code, is_active, status)
    VALUES 
    (gen_random_uuid(), v_warehouse_id, v_zone_receptie_id, v_type_lr_id, 'RECEPTIE-01-RMP01-LR01-ZT01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_receptie_id, v_type_lr_id, 'RECEPTIE-01-RMP01-LR02-ZT02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_receptie_id, v_type_lr_id, 'RECEPTIE-01-RMP02-LR01-ZT01', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_receptie_id, v_type_lr_id, 'RECEPTIE-01-RMP02-LR02-ZT02', true, 'AVAILABLE'),
    (gen_random_uuid(), v_warehouse_id, v_zone_receptie_id, v_type_lr_id, 'RECEPTIE-01-RMP03-LR03-ZT03', true, 'AVAILABLE');
    
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
    warehouse_code,
    warehouse_name,
    city,
    is_active
FROM warehouses
WHERE warehouse_code = 'BUC';

-- Verifică zonele
SELECT 
    '📍 ZONE' as categorie,
    zone_code,
    zone_name,
    zone_type,
    is_active
FROM warehouse_zones
WHERE warehouse_id IN (SELECT id FROM warehouses WHERE warehouse_code = 'BUC')
ORDER BY zone_code;

-- Verifică distribuția locațiilor pe zone
SELECT 
    wz.zone_code as zona,
    lt.code as tip_locatie,
    lt.name as nume_tip,
    COUNT(l.id) as numar_locatii
FROM locations l
JOIN warehouse_zones wz ON l.zone_id = wz.id
JOIN location_types lt ON l.location_type_id = lt.id
WHERE wz.warehouse_id IN (SELECT id FROM warehouses WHERE warehouse_code = 'BUC')
GROUP BY wz.zone_code, lt.code, lt.name
ORDER BY wz.zone_code, lt.code;

-- Afișează primele 20 locații
SELECT 
    '📦 EXEMPLE LOCAȚII' as categorie,
    wz.zone_code as zona,
    l.location_code as cod_locatie,
    lt.code as tip,
    l.aisle as culoar,
    l.rack as raft,
    l.shelf_level as nivel,
    l.bin_position as cutie,
    l.status
FROM locations l
JOIN warehouse_zones wz ON l.zone_id = wz.id
JOIN location_types lt ON l.location_type_id = lt.id
WHERE wz.warehouse_id IN (SELECT id FROM warehouses WHERE warehouse_code = 'BUC')
ORDER BY wz.zone_code, l.location_code
LIMIT 20;
