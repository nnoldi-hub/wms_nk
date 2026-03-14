# NIVEL ENTERPRISE - WMS NK Roadmap
Actualizat: Martie 2026

---

## FAZA 1 - Fundamentul WMS [FINALIZATA COMPLET]

### 1.1. Configurare depozit
- [x] Adaugare depozit
- [x] Adaugare zone
- [x] Generare locatii (bulk)
- [x] Tipuri locatii
- [x] QR locatii

### 1.2. Operatiuni inbound
- [x] Receptie PO
- [x] NIR
- [x] Putaway auto/manual
- [x] Stoc granular (loturi, resturi, tamburi)

### 1.3. Operatiuni outbound
- [x] Comenzi clienti
- [x] Note de culegere
- [x] Picking job
- [x] Taiere cabluri (cutItem endpoint + CutItemDialog)
- [x] Resturi generate automat
- [x] Livrari (LivrarePage - UI sofer)
- [x] Etichete loturi PDF (BatchLabelsPage)
- [x] Shipments board (3 tab-uri: Pregatire, Incarcare, Livrate)

### 1.4. Analitica (Reports v2 - Finalizat Mar 2026)
- [x] Miscari inventar - 5 taburi cu filtre complete + Istoric produs
- [x] Stoc & loturi - Disponibil / Rezervat / In picking / In expediere
- [x] Performanta - KPI General + per lucrator + livrare
- [x] Predictii - Rata zilnica/saptamanala + Top rotatie mare/mica
- [x] Rapoarte WMS - Eficienta picking, Locatii sub-utilizate, Resturi mari, Audit log

**Status: FINALIZATA COMPLET**

---

## FAZA 2 - Motorul inteligent WMS [PARTIAL]

### 2.1. Reguli WMS [DONE]
- [x] FIFO
- [x] Minimize Waste
- [x] Prefera resturi
- [x] Proximitate
- [x] Zone dedicate
- [x] Audit log reguli (tabel wms_rule_audit_log - mig. 024)
- [x] Versiuni reguli (mig. 025)
- [x] Simulare reguli
- [x] Detectare conflicte

### 2.2. Harta depozit [DONE]
- [x] Vizualizare harta
- [x] Editare locatii pe harta
- [x] Zone colorate
- [x] Coordonate locatii (mig. 027)

### 2.3. Legatura REGULI <-> HARTA ✅ DONE
- [x] Endpoint GET /api/v1/rules/validate
- [x] Verificare: zone fara reguli asociate
- [x] Verificare: reguli fara zone valide
- [x] Alerte conflicte logice (ex: zona tamburi fara locatii tambur)
- [x] Sugestii automate (ex: adauga FIFO pe zona RECEIVING)
- [x] UI panou validare cu badge OK/WARNING/ERROR per zona → RulesValidationPage.tsx

### 2.4. Capacitati locatii ✅ DONE
- [x] Greutate maxima per locatie
- [x] Volum maxim
- [x] Tip marfa permisa (allowed_categories JSONB)
- [x] Restrictii (restriction_note, allowed_packaging)
- [x] UI editare capacitati → LocationCapacitiesPage.tsx
- [x] Backend PATCH /api/v1/locations/:id/capacity

**Status: COMPLET (2.1 + 2.2 + 2.3 + 2.4 DONE)**

---

## FAZA 3 - Configurator Enterprise Wizard [PARTIAL]

### 3.1. Wizard configurare depozit ✅ DONE
- [x] WizardPage.tsx - stepper cu 7 pasi → WarehouseSetupWizardPage.tsx
- [x] Pas 1: Date generale depozit (cod, nume, suprafata, oras)
- [x] Pas 2: Zone depozit (tip, dimensiuni, cod)
- [x] Pas 3: Tipuri locatii (cod, dimensiuni, capacitate)
- [x] Pas 4: Reguli putaway (din template sau custom)
- [x] Pas 5: Reguli picking (FIFO, MIN_WASTE, etc.)
- [x] Pas 6: Generare locatii bulk (preview inainte de creare)
- [x] Pas 7: Validare + Finalizare setup
- [x] Route: /wizard-configurare + sidebar entry

### 3.2. Validator configurare ✅ DONE
- [x] Verifica zone (cel putin 1 din fiecare tip esential)
- [x] Verifica tipuri locatii asociate la zone
- [x] Verifica cel putin 1 regula activa PUTAWAY + 1 PICKING
- [x] Detecteaza coduri duplicate
- [x] Verifica compatibilitate reguli <-> tipuri locatii
- [x] Backend GET /api/v1/validate/setup-check → `validationController.validateWarehouseConfig`
- [x] UI pagina → `ConfigValidatorPage.tsx` (`/validator-configurare`) cu scor, erori, avertismente, info

### 3.3. Template-uri depozit ✅ DONE
- [x] Template: depozit cabluri (zone tamburi, resturi, expediere, QC) → WarehouseTemplatesPage.tsx
- [x] Template: depozit echipamente
- [x] Template: depozit mixt
- [x] Template: depozit exterior (umiditate, temperatura)
- [x] Dialog configurare + creare automata secventiala
- [x] Route: /template-depozit + sidebar entry

**Status: FAZA 3 COMPLET (3.1 + 3.2 + 3.3 DONE)**

---

## FAZA 4 - Optimizare avansata AI [DONE]

### 4.1. Reguli dinamice [DONE]
- [x] Zona plina -> fallback automat pe zona alternativa (`GET /api/v1/rules/dynamic/alerts`)
- [x] Tambur aproape gol -> propune mutare in zona resturi
- [x] Rotatie mare -> propune relocare langa expediere
- [x] Lot expirat -> carantina automata
- [x] UI dashboard alerte cu praguri configurabile → `DynamicRulesPage.tsx` (`/reguli-dinamice`)
- [x] Backend `dynamicRulesController.js` cu 4 checkuri: ZONE_FULL_FALLBACK, REEL_DEPLETES, HIGH_ROTATION_RELOCATE, LOT_EXPIRED_QUARANTINE

### 4.2. Simulator putaway/picking [DONE]
- [x] Introduci produs + cantitate -> vezi unde il pune sistemul (step by step)
- [x] Introduci comanda -> preview alocare picking lot cu lot
- [x] Compara strategii (FIFO vs MIN_WASTE) side-by-side → `SimulatorPage.tsx` (`/simulator-wms`)

### 4.3. Harta inteligenta ✅ DONE
- [x] Heatmap ocupare (verde-galben-rosu per locatie) → `WarehouseMapTab.tsx` viewMode='heatmap'
- [x] Colorare dupa tip marfa → viewMode='type'
- [x] Colorare dupa rotatie produs → viewMode='rotation' (consum % din cantitatea initiala, albastru=lent → rosu=rapid)
- [x] Traseu picking vizual animat step-by-step → buton "Traseu", selector job picking, animatie Play/Stop/Next/Prev cu overlay numeric pe harta

**Status: 4.1 DONE, 4.2 DONE, 4.3 DONE**

---

## FAZA 5 - Multi-depozit & scalare [OPTIONAL]

### 5.1. Multi-warehouse
- [ ] Depozit central + depozite secundare
- [ ] Selector depozit activ in UI
- [ ] Context multi-depozit in reguli

### 5.2. Transferuri intre depozite
- [ ] Cerere transfer (cu aprobare)
- [ ] Picking transfer
- [ ] Receptie transfer + NIR inter-depozit

### 5.3. Dashboard global
- [ ] Stoc total consolidat (toate depozitele)
- [ ] Rotatie totala comparata
- [ ] Performanta comparativa depozite

**Status: OPTIONAL, pentru scalare**

---

## FAZA 6 - Audit & securitate [PARTIAL]

### 6.1. Audit trail complet
- [x] Audit log reguli WMS (tabel wms_rule_audit_log exista - mig. 024)
- [x] Audit Controller + endpoint GET /api/v1/rules/audit-log
- [x] UI vizualizare audit log → `ActivityLogPage.tsx` (`/audit-activitate`) cu filtre, stats, export CSV, drawer detalii
- [x] Audit log locatii → `wms_ops_audit` (mig. 034) + hooks in `locationController.js` (CREATE/UPDATE/DELETE/PATCH_CAPACITY/PATCH_COORDINATES)
- [x] Audit log marfa → hook RECEIPT_BATCH in `receptieController.js` + PICKING_COMPLETE in `pickingController.js`
- [x] Backend endpoint GET /api/v1/audit/events + /stats → `opsAuditController.js` in warehouse-config
- [x] UI tab "Operatiuni WMS" in `ActivityLogPage.tsx` cu filtre, stats chips, drawer cu changes/extra_info JSONB
- [x] Audit log configuratie depozit (setari globale) → hooks SETTING_CREATE/UPDATE/DELETE in `warehouseSettingsController.js`

### 6.2. Permisiuni avansate
- [x] Roluri de baza: admin / manager / operator / sofer
- [x] UI management utilizatori → `UsersPage.tsx` (`/utilizatori`)
- [x] Tabel `user_operation_permissions` (migrare 035) — user_id x resource x can_view/create/edit/delete/approve
- [x] Backend: GET/PUT `/api/v1/users/:id/permissions` în auth service
- [x] `PermissionsDialog.tsx` — matrice checkbox resource × acțiune cu toggle-all pe coloană, reset la rol, save
- [x] `usePermissions.ts` hook — citeste permisiunile curente + fallback la role defaults
- [x] Buton 🔒 în coloana Actions din `UsersPage.tsx` deschide dialogul de permisiuni
- [x] `PermissionGuard.tsx` component — wrapper care ascunde/dezactiveaza butoane bazat pe `can(action, resource)`
- [x] Aplicat pe `OrdersPage.tsx` (Import CSV, generare picking job guarded)
- [ ] Acces pe zone (operator vede doar zona sa) — low priority

### 6.3. Loguri sistem & Notificari
- [x] Loki + Grafana (infrastructura monitoring)
- [x] NotificationBell în AppBar cu WebSocket real-time + badge CRITICAL/WARNING → `NotificationBell.tsx`
- [x] `useWebSocket.ts` hook — conexiune WS + reconectare exponential backoff
- [x] Backend WebSocket server `wsNotifications.js` atașat pe `/ws` (JWT auth, heartbeat ping/pong, broadcast 30s)
- [x] `StockAlertsPage.tsx` — pagina live alerte WebSocket cu filtrare, KPI, acknowledge → `/alerte-live`
- [x] Alerte automate real-time: ZONE_FULL_FALLBACK, LOT_EXPIRED_QUARANTINE emise prin WS
- [x] Log actiuni utilizatori in UI → `useActivityLog.ts` hook + POST /api/v1/audit/ui-event + tab "Actiuni UI" in `ActivityLogPage.tsx`

**Status: 6.1 ✅ DONE Mar 2026, 6.2 ✅ DONE Mar 2026, 6.3 ✅ DONE Mar 2026**

---

## FAZA 7 - Integrare ERP Pluriva [DONE]

### 7.1. Sincronizare inbound
- [x] Preluare PO din ERP (sync periodic + manual trigger)
- [x] Upsert PO-uri in `erp_po_mappings`
- [x] Sincronizare loturi via linii JSON pe PO

### 7.2. Sincronizare outbound
- [x] Trimitere NIR catre ERP dupa confirmare receptie (`erp_synced` flag)
- [x] Confirmare livrari la ERP (`DELIVERY_OUTBOUND` job)
- [x] Declansare facturare prin webhook

### 7.3. Webhook-uri
- [x] POST `/webhooks/pluriva` — HMAC-SHA256 verificare semnatura
- [x] Evenimente: `PO_CONFIRMED`, `PO_CANCELLED`, `INVOICE_CREATED`
- [x] Log toate webhook-urile in `erp_webhook_logs`

### 7.4. Infrastructura
- [x] `erp-connector` service complet (Express + Redis + PostgreSQL)
- [x] Demo mode automat cand API Key neconfigurata
- [x] Migrare DB `036_erp_integration.sql` (3 tabele noi + coloane pe tables existente)
- [x] Dashboard frontend `/erp-integrare` — status, PO-uri, istoric joburi, webhook log
- [x] Triggere manuale per tip sincronizare din UI

**Status: 7 ✅ DONE Apr 2026**

---

## REZUMAT STATUS (Mar 2026)

| Faza | Descriere                    | Status        | Prioritate   |
|------|------------------------------|---------------|--------------|
| 1    | Fundament WMS                | ✅ DONE       | -            |
| 2    | Motor inteligent WMS         | ✅ DONE       | -            |
| 3    | Configurator Enterprise      | ✅ DONE       | -            |
| 4    | Optimizare avansata AI       | ✅ DONE       | -            |
| 6.1  | Audit trail complet          | ✅ DONE       | -            |
| 6.2  | Permisiuni avansate          | ✅ DONE       | -            |
| 6.3  | Notificari real-time         | ✅ DONE       | -            |
| 7    | Integrare ERP Pluriva        | ✅ DONE       | -            |
| 5    | Multi-depozit                | ⏳ OPTIONAL   | ⭐ LOW       |

---

## NEXT SPRINT — FAZA 8: Multi-Depozit & Scalare

### Obiectiv
Suport pentru operarea mai multor depozite dintr-o singura instanta WMS.

### Backend
- Tabel `warehouses` cu `warehouse_id` propagat pe toate entitatile
- Row-level security PostgreSQL per `warehouse_id`
- JWT claims: `{ warehouse_ids: [...], default_warehouse: '...' }`
- Endpoint `POST /api/v1/warehouses` + switch context

### Frontend
- Selector depozit activ in header (persistat in localStorage)
- Filtrare automata a tuturor datelor dupa depozitul activ
- Dashboard per-depozit cu KPI-uri separate

### Operatiuni cross-depozit
- Transfer stoc intre depozite (cu NIR + document expeditie)
- Rapoarte consolidate multi-depozit
- Permisiuni per user per depozit
