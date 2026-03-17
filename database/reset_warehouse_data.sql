-- ============================================================
-- RESET COMPLET DEPOZIT — păstrează doar conturile utilizatori
-- Executat: manual, înainte de pornirea unui depozit de test
-- ============================================================

BEGIN;

-- Dezactivează temporar verificările de FK pentru TRUNCATE
SET session_replication_role = replica;

-- ── Operațiuni & mișcări ────────────────────────────────────
TRUNCATE TABLE movements                   RESTART IDENTITY CASCADE;
TRUNCATE TABLE inventory_items             RESTART IDENTITY CASCADE;
TRUNCATE TABLE inventory_reservations      RESTART IDENTITY CASCADE;
TRUNCATE TABLE lot_metadata                RESTART IDENTITY CASCADE;

-- ── Picking ─────────────────────────────────────────────────
TRUNCATE TABLE pick_note_lines             RESTART IDENTITY CASCADE;
TRUNCATE TABLE pick_notes                  RESTART IDENTITY CASCADE;
TRUNCATE TABLE picking_job_items           RESTART IDENTITY CASCADE;
TRUNCATE TABLE picking_jobs                RESTART IDENTITY CASCADE;

-- ── Comenzi clienți ─────────────────────────────────────────
TRUNCATE TABLE sales_order_lines           RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales_orders                RESTART IDENTITY CASCADE;

-- ── Comenzi furnizor & recepții ─────────────────────────────
TRUNCATE TABLE goods_receipt_lines         RESTART IDENTITY CASCADE;
TRUNCATE TABLE goods_receipts              RESTART IDENTITY CASCADE;
TRUNCATE TABLE supplier_order_lines        RESTART IDENTITY CASCADE;
TRUNCATE TABLE supplier_orders             RESTART IDENTITY CASCADE;

-- ── Expedieri ───────────────────────────────────────────────
TRUNCATE TABLE shipment_items              RESTART IDENTITY CASCADE;
TRUNCATE TABLE shipments                   RESTART IDENTITY CASCADE;

-- ── Produse, loturi, transformări ───────────────────────────
TRUNCATE TABLE batch_state_history         RESTART IDENTITY CASCADE;
TRUNCATE TABLE product_batches             RESTART IDENTITY CASCADE;
TRUNCATE TABLE product_transformations     RESTART IDENTITY CASCADE;
TRUNCATE TABLE product_location_preferences RESTART IDENTITY CASCADE;
TRUNCATE TABLE product_units               RESTART IDENTITY CASCADE;
TRUNCATE TABLE products                    RESTART IDENTITY CASCADE;

-- ── QC, Croitorie, Confecții ────────────────────────────────
TRUNCATE TABLE qc_inspections              RESTART IDENTITY CASCADE;
TRUNCATE TABLE cutting_orders              RESTART IDENTITY CASCADE;
TRUNCATE TABLE sewing_orders               RESTART IDENTITY CASCADE;

-- ── Ambalaje ────────────────────────────────────────────────
TRUNCATE TABLE package_inventory_movements RESTART IDENTITY CASCADE;
TRUNCATE TABLE package_instances           RESTART IDENTITY CASCADE;
-- packaging_types e tabel de configurare — îl golim opțional
-- TRUNCATE TABLE packaging_types          RESTART IDENTITY CASCADE;

-- ── ERP sync ────────────────────────────────────────────────
TRUNCATE TABLE erp_po_mappings             RESTART IDENTITY CASCADE;
TRUNCATE TABLE erp_sync_jobs               RESTART IDENTITY CASCADE;
TRUNCATE TABLE erp_webhook_logs            RESTART IDENTITY CASCADE;
TRUNCATE TABLE sync_conflicts              RESTART IDENTITY CASCADE;

-- ── Configurare depozit (zone, locații, structură fizică) ───
TRUNCATE TABLE zone_access_permissions     RESTART IDENTITY CASCADE;
TRUNCATE TABLE zone_carrier_availability   RESTART IDENTITY CASCADE;
TRUNCATE TABLE location_naming_conventions RESTART IDENTITY CASCADE;
TRUNCATE TABLE locations                   RESTART IDENTITY CASCADE;
TRUNCATE TABLE warehouse_zones             RESTART IDENTITY CASCADE;
TRUNCATE TABLE warehouse_floors            RESTART IDENTITY CASCADE;
TRUNCATE TABLE warehouses                  RESTART IDENTITY CASCADE;
TRUNCATE TABLE location_types              RESTART IDENTITY CASCADE;
TRUNCATE TABLE warehouse_settings          RESTART IDENTITY CASCADE;

-- ── Reguli & workflow ────────────────────────────────────────
TRUNCATE TABLE wms_rule_audit_log          RESTART IDENTITY CASCADE;
TRUNCATE TABLE wms_rules                   RESTART IDENTITY CASCADE;
TRUNCATE TABLE workflow_actions            RESTART IDENTITY CASCADE;
TRUNCATE TABLE workflow_transitions        RESTART IDENTITY CASCADE;
TRUNCATE TABLE workflow_states             RESTART IDENTITY CASCADE;

-- ── Transportatori & vehicule ────────────────────────────────
TRUNCATE TABLE carrier_services            RESTART IDENTITY CASCADE;
TRUNCATE TABLE delivery_zones              RESTART IDENTITY CASCADE;
TRUNCATE TABLE shipping_carriers           RESTART IDENTITY CASCADE;
TRUNCATE TABLE vehicle_maintenance_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE internal_vehicles           RESTART IDENTITY CASCADE;
TRUNCATE TABLE drum_types                  RESTART IDENTITY CASCADE;

-- ── Audit log ────────────────────────────────────────────────
TRUNCATE TABLE audit_logs                  RESTART IDENTITY CASCADE;

-- Reactivează verificările FK
SET session_replication_role = DEFAULT;

-- ── Verificare finală: utilizatori rămași ────────────────────
SELECT id, username, email, role FROM users ORDER BY role, username;

COMMIT;
