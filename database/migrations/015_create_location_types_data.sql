-- =========================================
-- MIGRARE: Tipuri de Locații pentru WMS
-- Data: 2025-10-30
-- Scop: Populare tabela location_types cu toate tipurile din structura depozit
-- =========================================

-- 🔒 TIPURI PENTRU ZONA HALA (RAFTURI)
-- Ierarhie: Culoar → Raft → Nivel → Cutie

INSERT INTO location_types (
    id,
    code,
    name,
    capacity_type,
    default_width_cm,
    default_depth_cm,
    default_height_cm,
    default_max_weight_kg,
    requires_forklift,
    is_pickable,
    is_stackable,
    max_stack_height,
    is_active
) VALUES 
-- CULOAR (R) - Aisle/Row
(
    gen_random_uuid(),
    'R',
    'Culoar',
    'aisle',
    300,  -- 3m lățime culoar
    NULL,
    400,  -- 4m înălțime
    NULL,
    false,
    false,
    false,
    NULL,
    true
),

-- RAFT (H) - Rack/Height
(
    gen_random_uuid(),
    'H',
    'Raft',
    'rack',
    120,  -- 1.2m lățime
    80,   -- 80cm adâncime
    200,  -- 2m înălțime
    500,  -- 500kg capacitate totală
    true,
    false,
    false,
    NULL,
    true
),

-- NIVEL (T) - Tier/Level
(
    gen_random_uuid(),
    'T',
    'Nivel',
    'shelf',
    120,  -- 1.2m lățime
    80,   -- 80cm adâncime
    50,   -- 50cm înălțime per nivel
    200,  -- 200kg per nivel
    false,
    true,
    true,
    3,
    true
),

-- CUTIE (C) - Bin/Box
(
    gen_random_uuid(),
    'C',
    'Cutie',
    'bin',
    30,   -- 30cm lățime
    30,   -- 30cm adâncime
    20,   -- 20cm înălțime
    10,   -- 10kg per cutie
    false,
    true,
    true,
    5,
    true
);

-- 🌤️ TIPURI PENTRU ZONA AER LIBER (CABLURI)
-- Ierarhie: Sector → Linie → Poziție

INSERT INTO location_types (
    id,
    code,
    name,
    capacity_type,
    default_width_cm,
    default_depth_cm,
    default_height_cm,
    default_max_weight_kg,
    requires_forklift,
    is_pickable,
    is_stackable,
    max_stack_height,
    is_active
) VALUES 
-- SECTOR (pentru categorii: CABLU-CU, CABLU-AL, CABLU-FV)
(
    gen_random_uuid(),
    'SECTOR',
    'Sector Cablu',
    'floor',
    1000,  -- 10m lățime sector
    1000,  -- 10m adâncime
    300,   -- 3m înălțime (bobine mari)
    5000,  -- 5000kg (bobine grele)
    true,
    false,
    false,
    NULL,
    true
),

-- LINIE (L) - zona de depozitare în linie
(
    gen_random_uuid(),
    'L',
    'Linie Depozitare',
    'floor',
    200,   -- 2m lățime
    500,   -- 5m lungime
    250,   -- 2.5m înălțime
    2000,  -- 2000kg
    true,
    false,
    false,
    NULL,
    true
),

-- POZITIE (P) - poziție specifică pentru o bobină/palet
(
    gen_random_uuid(),
    'P',
    'Pozitie',
    'pallet',
    120,   -- 1.2m (palet standard)
    80,    -- 80cm
    150,   -- 1.5m înălțime
    1000,  -- 1000kg
    true,
    true,
    true,
    2,
    true
);

-- ✂️ TIPURI PENTRU ZONA DERULARE/TAIERE
-- Ierarhie: Linie Tăiere → Banc Lucru

INSERT INTO location_types (
    id,
    code,
    name,
    capacity_type,
    default_width_cm,
    default_depth_cm,
    default_height_cm,
    default_max_weight_kg,
    requires_forklift,
    is_pickable,
    is_stackable,
    max_stack_height,
    is_active
) VALUES 
-- LINIE TAIERE (LT)
(
    gen_random_uuid(),
    'LT',
    'Linie Taiere',
    'workstation',
    400,   -- 4m lungime linie
    150,   -- 1.5m lățime
    100,   -- 1m înălțime masă
    500,   -- 500kg
    false,
    false,
    false,
    NULL,
    true
),

-- BANC LUCRU (BL)
(
    gen_random_uuid(),
    'BL',
    'Banc Lucru',
    'workstation',
    200,   -- 2m lungime banc
    80,    -- 80cm lățime
    100,   -- 1m înălțime
    200,   -- 200kg
    false,
    true,
    false,
    NULL,
    true
);

-- 📦 TIPURI PENTRU ZONA LIVRARE
-- Ierarhie: Linie Ambalare → Stație Etichetare → Zonă Așteptare

INSERT INTO location_types (
    id,
    code,
    name,
    capacity_type,
    default_width_cm,
    default_depth_cm,
    default_height_cm,
    default_max_weight_kg,
    requires_forklift,
    is_pickable,
    is_stackable,
    max_stack_height,
    is_active
) VALUES 
-- LINIE AMBALARE (LA)
(
    gen_random_uuid(),
    'LA',
    'Linie Ambalare',
    'workstation',
    300,   -- 3m lungime
    120,   -- 1.2m lățime
    100,   -- 1m înălțime masă
    300,   -- 300kg
    false,
    false,
    false,
    NULL,
    true
),

-- STATIE ETICHETARE (SE)
(
    gen_random_uuid(),
    'SE',
    'Statie Etichetare',
    'workstation',
    150,   -- 1.5m
    80,    -- 80cm
    100,   -- 1m
    100,   -- 100kg
    false,
    true,
    false,
    NULL,
    true
),

-- ZONA ASTEPTARE (ZA) - pentru comenzi pregătite
(
    gen_random_uuid(),
    'ZA',
    'Zona Asteptare',
    'staging',
    400,   -- 4m
    400,   -- 4m
    200,   -- 2m
    1000,  -- 1000kg
    false,
    true,
    true,
    3,
    true
);

-- 📥 TIPURI PENTRU ZONA RECEPTIE MARFA
-- Ierarhie: Rampă → Linie Recepție → Zonă Tampon

INSERT INTO location_types (
    id,
    code,
    name,
    capacity_type,
    default_width_cm,
    default_depth_cm,
    default_height_cm,
    default_max_weight_kg,
    requires_forklift,
    is_pickable,
    is_stackable,
    max_stack_height,
    is_active
) VALUES 
-- RAMPA (RMP)
(
    gen_random_uuid(),
    'RMP',
    'Rampa',
    'dock',
    400,   -- 4m lățime rampă
    800,   -- 8m lungime
    300,   -- 3m înălțime
    10000, -- 10 tone (camion întreg)
    true,
    false,
    false,
    NULL,
    true
),

-- LINIE RECEPTIE (LR)
(
    gen_random_uuid(),
    'LR',
    'Linie Receptie',
    'staging',
    300,   -- 3m
    200,   -- 2m
    150,   -- 1.5m
    2000,  -- 2000kg
    true,
    true,
    false,
    NULL,
    true
),

-- ZONA TAMPON (ZT) - stocare temporară după recepție
(
    gen_random_uuid(),
    'ZT',
    'Zona Tampon',
    'staging',
    500,   -- 5m
    500,   -- 5m
    200,   -- 2m
    3000,  -- 3000kg
    true,
    true,
    true,
    2,
    true
);

-- =========================================
-- VERIFICARE: Afișare toate tipurile create
-- =========================================
SELECT 
    code,
    name,
    capacity_type,
    default_width_cm,
    default_depth_cm,
    default_height_cm,
    default_max_weight_kg,
    requires_forklift,
    is_pickable,
    is_stackable,
    CASE 
        WHEN code IN ('R', 'H', 'T', 'C') THEN '🔒 HALA'
        WHEN code IN ('SECTOR', 'L', 'P') THEN '🌤️ AER LIBER'
        WHEN code IN ('LT', 'BL') THEN '✂️ TAIERE'
        WHEN code IN ('LA', 'SE', 'ZA') THEN '📦 LIVRARE'
        WHEN code IN ('RMP', 'LR', 'ZT') THEN '📥 RECEPTIE'
    END as zona_functionala
FROM location_types
WHERE code IN (
    'R', 'H', 'T', 'C',           -- Hala
    'SECTOR', 'L', 'P',            -- Aer liber
    'LT', 'BL',                    -- Taiere
    'LA', 'SE', 'ZA',              -- Livrare
    'RMP', 'LR', 'ZT'              -- Receptie
)
ORDER BY 
    zona_functionala,
    CASE code
        -- Ordinea logică în fiecare zonă
        WHEN 'R' THEN 1 WHEN 'H' THEN 2 WHEN 'T' THEN 3 WHEN 'C' THEN 4
        WHEN 'SECTOR' THEN 1 WHEN 'L' THEN 2 WHEN 'P' THEN 3
        WHEN 'LT' THEN 1 WHEN 'BL' THEN 2
        WHEN 'LA' THEN 1 WHEN 'SE' THEN 2 WHEN 'ZA' THEN 3
        WHEN 'RMP' THEN 1 WHEN 'LR' THEN 2 WHEN 'ZT' THEN 3
    END;
