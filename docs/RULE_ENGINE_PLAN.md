# WMS NK — Motor de Reguli & Harta Depozitului
## Plan de Dezvoltare

> **Ultima actualizare:** 13 Mai 2025  
> **Scop:** Sistem configurabil de reguli pentru putaway, picking, recepție, tăiere — fără cod hardcodat.

---

## Ce EXISTĂ deja (bifat = implementat)

### Infrastructură DB
- [x] Tabela `warehouses` — depozite
- [x] Tabela `warehouse_zones` — zone (RECEPȚIE, TAMBURI, etc.)
- [x] Tabela `locations` — locații cu cod, zone, tip
- [x] Tabela `location_types` — tipuri locație (PALLET, SHELF, DRUM_RACK etc.)
- [x] Tabela `packaging_types` — tipuri ambalaj (TAMBUR, ROLĂ, CUTIE etc.)
- [x] Tabela `batch_selection_rules` — reguli de bază (FIFO, MIN_WASTE, etc.)
- [x] Tabela `picking_jobs` + `picking_job_items` + `inventory_reservations`
- [x] Tabela `sales_orders` + `sales_order_lines`
- [x] Tabela `product_batches` + `product_units`
- [x] Tabela `product_location_preferences`

### API — warehouse-config service (:3020)
- [x] CRUD Warehouses
- [x] CRUD Zones
- [x] CRUD Locations (cu filtrare pe tip, status)
- [x] CRUD Location Types
- [x] CRUD Packaging Types
- [x] CRUD Carriers / Delivery Zones
- [x] Workflow states

### Frontend Web (:5173)
- [x] `WarehouseConfigPage.tsx` — configurare depozit
- [x] `PickJobsPage.tsx` — joburi de picking
- [x] `BatchesPage.tsx` — loturi
- [x] `ProductsPage.tsx`, `OrdersPage.tsx`, `ShipmentsPage.tsx`
- [x] `DashboardPage.tsx`, `ReportsPage.tsx`

### Mobile (Expo / React Native)
- [x] `ScannerScreen.js` — scanare produs sau locație
- [x] `PickJobsScreen.js` + `PickJobDetailsScreen.js`
- [x] `LocationsScreen.js` + `LocationDetailsScreen.js`
- [x] `ProductsScreen.js` + `ProductDetailsScreen.js`
- [x] `MovementsScreen.js`, `HistoryScreen.js`

---

## SPRINT 1 — Fundație Motor de Reguli (DB + Engine)
> **Durată estimată:** 2-3 zile | **Status:** ✅ COMPLET

### DB Migrations
- [x] **Migration 021** — Extindere `batch_selection_rules` cu `scope` + `actions` JSONB (putaway/picking/receiving/cutting)
- [x] **Migration 022** — Adăugare `allowed_categories` + `allowed_packaging` + `constraints` JSONB pe `locations`

### Rule Engine Service (warehouse-config)
- [x] **`src/services/ruleEngine.js`** — Evaluator de condiții (field/operator/value)
- [x] **`src/services/putawayEngine.js`** — Logică sugestie locație la recepție
- [x] **`src/services/pickingEngine.js`** — Logică selecție stoc optim la picking
- [x] **`src/controllers/ruleController.js`** — CRUD reguli cu scope
- [x] **Rute noi în `routes/index.js`** — `/rules`, `/suggest/putaway`, `/suggest/picking`

---

## SPRINT 2 — API Sugestii & Integrare Picking
> **Durată estimată:** 3-4 zile | **Status:** ✅ COMPLET

### API Endpoints noi
- [x] `POST /api/v1/suggest/putaway` — ✅ funcțional
- [x] `POST /api/v1/suggest/picking` — ✅ funcțional  
- [x] `GET /api/v1/rules` — ✅ funcțional (returnează 8 reguli)
- [x] `POST /api/v1/rules` — ✅ funcțional
- [x] `PUT /api/v1/rules/:id` — ✅ funcțional
- [x] `DELETE /api/v1/rules/:id` — ✅ funcțional
- [x] `POST /api/v1/rules/evaluate` — ✅ funcțional

### Integrare în Picking Jobs
- [x] La generarea `picking_job_items` — apel automat `pickingEngine` (non-blocking, 3s timeout)
- [x] Câmpuri `pick_strategy`, `rule_applied_name`, `rule_applied_id`, `engine_suggestion` pe `picking_job_items` (Migration 023)
- [x] Câmpuri `pick_strategy`, `engine_metadata` pe `picking_jobs` (Migration 023)
- [ ] Support "overpick" — permite luarea din mai multe loturi dacă nu ajunge unul singur *(de-scoped → Sprint 5)*

### Kong Gateway
- [x] Rută `warehouse-rules-route` → `/api/v1/rules` → warehouse-config ✅
- [x] Rută `warehouse-suggest-route` → `/api/v1/suggest` → warehouse-config ✅

---

## SPRINT 3 — UI Admin Motor de Reguli
> **Durată estimată:** 2-3 zile | **Status:** ✅ COMPLET

### Frontend Web
- [x] Tab nou "Reguli WMS" în `WarehouseConfigPage.tsx` (Tabs MUI, navigare Depozit & Locații / Reguli)
- [x] Componentă `RulesTab.tsx` — listare reguli cu filtrare pe scope
- [x] DataGrid reguli: prioritate, scope (chip color), tip regulă, nume, toggle activ
- [x] Editor de regulă (dialog creare/editare):
  - [x] Câmpuri: nume, descriere, scope, tip_regulă, prioritate, activ
  - [x] Template automat condiții+acțiuni la selectare tip regulă
  - [x] Editor JSON condiții cu validare inline
  - [x] Editor JSON acțiuni cu validare inline
  - [x] Referință rapidă operatori + câmpuri context
- [x] Toggle activ/inactiv direct din grid
- [x] Buton "Testează" (PlayIcon) → dialog evaluare cu context JSON și rezultat afișat
- [x] Confirmare ștergere regulă
- [ ] Drag & drop reordonare prioritate *(de-scoped → Sprint 5)*
- [ ] Hartă depozit vizuală *(de-scoped → Sprint 5)*

### Service TypeScript nou
- [x] Metode `listRules`, `getRule`, `createRule`, `updateRule`, `deleteRule`, `evaluateRule` în `warehouseConfig.service.ts`
- [x] Metode `suggestPicking`, `suggestPutaway` în `warehouseConfig.service.ts`

---

## SPRINT 4 — Mobile Recepție / Putaway
> **Durată estimată:** 2-3 zile | **Status:** ✅ COMPLET

### Ecrane noi mobile
- [x] **`ReceivingScreen.js`** — ecran recepție marfă:
  - [x] Input produs (SKU) + cantitate + UOM
  - [x] Lookup produs automat (getBySKU pe blur/submit)
  - [x] Apel `POST /suggest/putaway` → afisare locatii sugerate cu scor
  - [x] Selectare locatie (sau override manual)
  - [x] Confirmare → `POST /movements/adjust` cu reason=RECEIVING
- [x] **`PutawayScreen.js`** — mutare produs la locație sugerată:
  - [x] Input produs (SKU) + cantitate + locatie sursă (opțional)
  - [x] Apel `POST /suggest/putaway` → sugestie destinație cu scor
  - [x] Selectare locație (sau override manual cu cod locație)
  - [x] Confirmare → `POST /movements` (transfer) sau `POST /movements/adjust` (putaway)
- [x] **`HomeScreen.js`** — adaugare menu items: Recepție + Putaway
- [x] **`AppNavigator.js`** — import + Stack.Screen Receiving/Putaway

### Mobile — API
- [x] **`config.js`** — endpoint-uri: `SUGGEST_PUTAWAY`, `SUGGEST_PICKING`, `WAREHOUSES`
- [x] **`api.js`** — `suggestAPI.putaway()`, `suggestAPI.picking()`, `warehouseAPI.list()`

### Mobile — Picking îmbunătățit
- [x] **`PickJobDetailsScreen.js`** — afisare `pick_strategy` (banner albastru pe job) + `rule_applied_name` (tag galben per item) + `pick_strategy` per item

---

## SPRINT 5 — Reguli Avansate & Rapoarte
> **Durată estimată:** 3-4 zile | **Status:** ✅ COMPLET

### Reguli avansate
- [x] Reguli pentru tăiere (cutting) — `cuttingEngine.js` cu strategii MINIMIZE_WASTE, FEWEST_CUTS, USE_REMAINS_FIRST, FIFO
- [x] Reguli pentru UM (conversii automate metru ↔ bucăți ↔ kg) — `convertToMeters` / `convertFromMeters` în cuttingEngine
- [x] Reguli de blocare — `enforceBlockOperation()` în ruleEngine.js returnează 422 cu `blocked: true`
- [x] Audit log reguli — tabel `wms_rule_audit_log` (migration 024) + `auditController.js`

### Rapoarte
- [x] Raport "Eficiență picking" — `GET /api/v1/reports/rule-engine/picking-efficiency` + tab frontend
- [x] Raport "Locații sub-utilizate" — `GET /api/v1/reports/rule-engine/underused-locations` + tab frontend
- [x] Raport "Resturi mari" — `GET /api/v1/reports/rule-engine/large-remnants` + tab frontend
- [x] Audit Log viewer — tab 4 în ReportsPage.tsx cu filtre pe operationType
- [x] Reordonare prioritate reguli — dialog cu butoane ↑/↓ în RulesTab.tsx → `PUT /api/v1/rules/reorder`

---

## Arhitectura Fluxului (Referință)

```
RECEPȚIE (Putaway Flow)
  Operator scanează produs + ambalaj
       ↓
  POST /suggest/putaway
       ↓
  RuleEngine evaluează regulile scope=PUTAWAY
       ↓
  Filtrează locations cu allowed_categories + allowed_packaging
       ↓
  Returnează: locații sugerate (ordonate)
       ↓
  Operator confirmă sau overrideaza
       ↓
  Stoc creat + locație actualizată

PICKING Flow
  Comandă ERP → sales_order_lines
       ↓
  POST /suggest/picking (per linie)
       ↓
  PickingEngine: caută inventory_items
       ↓
  Aplică reguli: MIN_WASTE, USE_REMAINS_FIRST, FIFO
       ↓
  Generează picking_job_items cu source_inventory_id
       ↓
  Mobile: operator confirmă locație, scanează, picked_qty++
```

---

## Structura Regulilor (Schema JSON)

```json
{
  "name": "Picking cabluri - folosește resturi",
  "scope": "PICKING",
  "priority": 10,
  "is_active": true,
  "conditions": [
    { "field": "product.category", "operator": "=", "value": "cable" },
    { "field": "order_line.requested_length_m", "operator": ">", "value": 5 }
  ],
  "actions": [
    { "type": "PICK_STRATEGY", "value": "USE_REMAINS_FIRST" },
    { "type": "EXCLUDE_PACKAGING", "value": "FULL_DRUM_OVER_500M" }
  ]
}
```

**Câmpuri disponibile în condiții:**
| Prefix | Câmpuri disponibile |
|--------|---------------------|
| `product.` | `category`, `sku`, `brand`, `cable_section`, `voltage` |
| `stock.` | `length_m`, `quantity`, `packaging_type`, `status`, `location_zone` |
| `order_line.` | `requested_length_m`, `requested_qty`, `uom` |
| `location.` | `zone_type`, `zone_code`, `type`, `accessibility` |

**Acțiuni disponibile:**
| Acțiune | Descriere |
|---------|-----------|
| `SUGGEST_ZONE` | Sugerează zona (TAMBURI, RESTURI, etc.) |
| `SUGGEST_LOCATION` | Sugerează locație specifică |
| `PICK_STRATEGY` | Strategia de picking: `USE_REMAINS_FIRST`, `FIFO`, `MIN_WASTE` |
| `EXCLUDE_PACKAGING` | Exclude un tip de ambalaj de la picking |
| `BLOCK_OPERATION` | Blochează operațiunea (erorare) |
| `REQUIRE_APPROVAL` | Cere aprobare manager înainte de continuat |

---

## Progres General

| Sprint | Descriere | Status |
|--------|-----------|--------|
| Sprint 1 | Fundație DB + Rule Engine | ✅ COMPLET |
| Sprint 2 | API Sugestii & Integrare Picking | ✅ COMPLET |
| Sprint 3 | UI Admin Motor de Reguli | ✅ COMPLET |
| Sprint 4 | Mobile Recepție / Putaway | ✅ COMPLET |
| Sprint 5 | Reguli Avansate & Rapoarte | ✅ COMPLET |
