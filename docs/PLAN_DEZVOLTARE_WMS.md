# WMS NK — Plan de Dezvoltare (actualizat)

> Scopul principal: operatorul configurează depozitul o singură dată → WMS-ul lucrează automat.
> ERP decide CE și CÂT. WMS decide DE UNDE și UNDE.

---

## 📊 Stare curentă proiect

### ✅ Implementat

| Modul | Stare |
|-------|-------|
| Autentificare JWT (auth service) | ✅ Funcțional |
| Dashboard | ✅ Funcțional |
| Comenzi Furnizor (PO) | ✅ Funcțional |
| Recepție NIR (cu generare loturi) | ✅ Funcțional — auto-creare produse fixat |
| Loturi (batches) — afișare, filtrare | ✅ Funcțional — stoc fixat |
| Produse — catalog cu stoc real | ✅ Fixat (stoc din product_batches) |
| Configurare Depozit (depozite, zone, locații) | ✅ Funcțional |
| Capacități Locații | ✅ Funcțional |
| Reguli Dinamice / Alerte | ✅ Funcțional |
| Comenzi Clienți | ✅ Funcțional |
| Picking / Culegere | ✅ Funcțional |
| Note de Culegere | ✅ Funcțional |
| Expedieri | ✅ Funcțional |
| Livrare Șofer | ✅ Funcțional |
| Paleți | ✅ Funcțional |
| Transformări (tăiere/rebobinare) | ✅ Funcțional (manual) |
| ERP Pluriva (connector) | ✅ Structură funcțională |
| Rapoarte Stoc, Performanță, Predicții | ✅ Funcționale |
| Mișcări Inventar | ✅ Funcționale |
| Scanare QR | ✅ Funcțională |
| Utilizatori + permisiuni granulare | ✅ Funcționale |
| Wizard Configurare + Template-uri | ✅ Funcționale |

### ✅ Progres Realizat

| Task | Status |
|------|--------|
| Menu Română (Layout.tsx) | ✅ Done |
| Fix produse după NIR | ✅ Done |
| Fix stoc = 0 (productController) | ✅ Done |
| Migrare 040 PENDING_PUTAWAY | ✅ Done |
| S2.1 NIR → PENDING_PUTAWAY | ✅ Done |
| S1.1 LocationTypesPage (`/tipuri-locatii`) | ✅ Done |
| Fix Joi schema (underscore în cod tip locație) | ✅ Done |
| S2.3 Confirmare Putaway endpoint + UI | ✅ Done |
| Fix getPendingPutaway (include PENDING_PUTAWAY) | ✅ Done |
| S1.2 PackagingTypesPage (`/tipuri-ambalaje`) | ✅ Done |
| Fix packagingController (coloane SQL corecte) | ✅ Done |
| S1.4 Zone RECV/SHIP | ✅ Done (preexistente) |
| S2.2 Sugestie locație din reguli putaway | ✅ Done |
| S1.3 PutawayRulesPage (`/reguli-putaway`) | ✅ Done |
| S2.4 Etichete QR la NIR (handlePrintLabels) | ✅ Done |
| S3.1 Tăiere → lot REST auto PENDING_PUTAWAY | ✅ Done |
| S3.2 REST apare în PutawayTasksPage | ✅ Done (automat) |
| S3.3 inventory_items sync trigger (042) | ✅ Done — 177 rânduri backfill |
| S4.3 Hartă depozit cu stoc vizual (viewMode Stock) | ✅ Done |
| S2.2 Sugestie locație din reguli putaway | ✅ Done |
| S4.4 Dashboard: Resturi + Stoc per Zonă | ✅ Done |
| **Teste integrare** (toate serviciile) | ✅ Done — 57/57 verzi |

### ❌ Rămase de implementat

| Modul | Problemă | Sprint |
|-------|---------|--------|
| **ERP → WMS flux complet** | Recepție comandă tăiere de la ERP → generează task WMS → confirmare → ERP | S4.1 |

---

## 🗂 Structura Depozit Configurată (baza de care avem nevoie)

```
H1 — Cabluri mici (colaci, resturi mici)
  └── RACK_PALLET (colaci, max 50/palet)
  └── RACK_RESTURI (resturi sub 100m)

H2 — Tamburi + Derulatoare
  └── DERULATOR (tamburi mici ≤600m)
  └── RACK_PALLET (tamburi medii 600-1200m)

H3 — Echipamente + Voluminoase
  └── FLOOR_HEAVY (tamburi mari >1200m)

EXT — Platformă Betonată
  └── TAMBUR_PLATFORMĂ (tamburi industriale)

RECV — Zonă Recepție
  └── RACK_PALLET (temporar, loturi noi sosite)

SHIP — Zonă Livrare
  └── RACK_PALLET (temporar, pregătite pentru expediere)
```

**Tipuri Ambalaj (product_packaging):**
| Tip | Label | Regula vânzare | Zone permise |
|-----|-------|----------------|--------------|
| COLAC_100M | Colac 100m | Întreg | H1-RACK_PALLET |
| COLAC_CUSTOM | Colac rest | Întreg | H1-RACK_RESTURI |
| TAMBUR_MIC | Tambur ≤600m | Poate fi derulat | H2-DERULATOR |
| TAMBUR_MEDIU | Tambur 600-1200m | Poate fi derulat | H2-RACK_PALLET |
| TAMBUR_MARE | Tambur >1200m | Poate fi derulat | H3-FLOOR_HEAVY |
| REST | Rest după tăiere | Întreg | H1-RACK_RESTURI |

---

## 📋 Sprint S1 — Configurare Depozit Completă

**Obiectiv:** Adminul poate configura complet depozitul din UI fără SQL manual.

### S1.1 — Pagina Tipuri Locații (`/tipuri-locatii`) ✅ DONE

- [x] **Backend** — rutele din `locationTypeController.js` verificate și funcționale
- [x] **Frontend** — `LocationTypesPage.tsx` creată cu DataGrid, dialog add/edit, buton seed 8 tipuri implicite
- [x] **Layout** — meniu Admin → "Tipuri Locații" (`/tipuri-locatii`) adăugat

### S1.2 — Pagina Tipuri Ambalaje (`/tipuri-ambalaje`) ✅ DONE

- [x] **Backend** — `packagingController.js` fix complet (coloane SQL corecte: `name`/`code`)
- [x] **Frontend** — `PackagingTypesPage.tsx` creată cu CRUD: COLAC, TAMBUR, REST etc.
  - Câmpuri: `max_product_length_meters`, `max_product_weight_kg`, `is_reusable`
  - Buton "Tipuri Implicite Cabluri" → seed 8 tipuri standard
- [x] **Layout** — meniu Admin → "Tipuri Ambalaje" (`/tipuri-ambalaje`) adăugat
- [x] **warehouseConfig.service.ts** — `listPackagingTypes`, `createPackagingType`, `updatePackagingType` adăugate

### S1.3 — Reguli Putaway per Tip Ambalaj ✅ DONE

- [x] **Migrare 041** — tabel `putaway_rules` creat cu 18 reguli implicite
- [x] **Backend** — `putawayRulesController.js` cu CRUD + `/bulk` + `/suggest`
- [x] **Rute** — `/api/v1/putaway-rules` (GET, POST, PUT, DELETE, bulk, suggest)
- [x] **Frontend** — `PutawayRulesPage.tsx` cu matrice vizuală Ambalaj × Locație + list CRUD
- [x] **Layout** — meniu Admin → "Reguli Depozitare" (`/reguli-putaway`)
- [x] **warehouseConfig.service.ts** — 6 metode noi pentru putaway rules

### S1.4 — Zonele RECV și SHIP cu locații dedicate ✅ DONE (preexistente)

- [x] Zone RECV/SHIP existente în DB cu locații dedicate (RECV-LR-01..10)
- [x] Folosite automat la NIR confirm (lot primește `location_id` din zona RECV)

---

## 📋 Sprint S2 — Flux NIR → Depozitare

**Obiectiv:** Lotul confirmat în NIR apare automat în Sarcini Depozitare cu locație sugerată.

### S2.1 — NIR Confirm → PENDING_PUTAWAY ✅ DONE

- [x] **`goodsReceiptController.js`** — la confirmare NIR, batch primeşte `status='PENDING_PUTAWAY'` + `location_id` din zona RECV
- [x] **Migrare 040** — `PENDING_PUTAWAY` adăugat în `batch_status_check` + coloane `putaway_at`, `putaway_by`

### S2.2 — PutawayTasksPage — afișare loturi PENDING_PUTAWAY ✅ DONE

- [x] **`batchController.js`** — `getPendingPutaway` filtrează `status IN ('PENDING_PUTAWAY', 'INTACT')` cu `location_id IS NULL`
- [x] **`PutawayTasksPage.tsx`** — afișează loturi cu batch_number, produs, cantitate, NIR, dată
- [x] **Sugestie locație automată bazată pe reguli putaway (S2.2)** — `inferPackagingType()` heuristică + `/putaway-rules/suggest` + `/locations/available?location_type_code=X`
- [x] **Backend WC** — endpoint nou `GET /api/v1/locations/available?location_type_code=X` cross-zone

### S2.3 — Confirmare Putaway → Setare locație pe lot ✅ DONE

- [x] **Backend** — `POST /api/v1/batches/:id/confirm-putaway` în `batchController.js`: setează `status='INTACT'`, `location_id`, `putaway_at`, `putaway_by`
- [x] **Frontend `PutawayTasksPage.tsx`** — buton "Confirmă Depozitare" apelează noul endpoint
- [ ] Înregistrare în `wms_ops_audit` (TODO)

### S2.4 — Etichete lot la recepție ✅ DONE

- [x] **`ReceptieNIRPage.tsx`** — după confirmare NIR, buton "🏷️ Printează Etichete (N)" adăugat
- [x] `handlePrintLabels()` — deschide fereastră print cu QR-uri via `api.qrserver.com`: batch_number, material, cantitate, NIR

---

## 📋 Sprint S3 — Flux Tăiere → REST

**Obiectiv:** Operatorul confirmă tăierea → WMS creează automat lotul REST + pune în zona H1-RACK_RESTURI.

### S3.1 — Confirmare Tăiere → Auto-creare lot REST ✅ DONE

- [x] **`transformationController.js`** — `createTransformation`: dacă `type='CUT'` și restul > 0, creează automat lot REST cu `status='PENDING_PUTAWAY'`
- [x] Lotul REST primește: `product_sku` și `unit_id` din sursa, `source_batch_id` setat, batch_number auto-generat
- [x] Răspuns API include câmpul `rest_batch` cu detalii despre lotul REST creat — la confirmare transformare (status → DONE):
  ```js
  const restQty = source_batch.current_quantity - cut_quantity;
  if (restQty > 0) {
    INSERT INTO product_batches (batch_number, product_sku, unit_id,
      initial_quantity, current_quantity, status, notes)
    VALUES ('REST-' + source_batch.batch_number, ..., restQty, 'PENDING_PUTAWAY', 'Rest după tăiere');
  }
  UPDATE product_batches SET current_quantity = cut_quantity, status = 'CUT' WHERE id = source_id;
  ```
- [ ] Lotul tăiat → status `INTACT`, mutat în zona SHIP (pregătit livrare)
- [ ] Lot REST → status `PENDING_PUTAWAY`, zonă preferată `H1-RACK_RESTURI`

### S3.2 — REST apare în Sarcini Depozitare ✅ DONE (automat)

- [x] `PutawayTasksPage.tsx` deja filtrează `PENDING_PUTAWAY` — lotă REST apar automat după S3.1
- [ ] Badge vizual "REST" pe rândurile REST (TODO opcțional)
- [ ] Sugestie locație bazată pe reguli putaway (TODO — connect S1.3 → S2.2)

### S3.3 — Stoc pe locație (inventory_items populat) ✅ DONE

- [x] **Migrare 042** — funcție trigger `sync_inventory_from_batch()` creată
- [x] **Trigger** `trg_sync_inventory_from_batch` pe `product_batches` (INSERT/UPDATE/DELETE) → sync automat în `inventory_items`
- [x] **Backfill** — 177 rânduri populate din batch-uri existente cu locație
- [x] Sincronizare verificată: update cantitate batch → inventory_items actualizat automat `042_sync_inventory_from_batches.sql`:
  ```sql
  INSERT INTO inventory_items (product_sku, location_id, quantity, lot_number)
  SELECT product_sku, location_id, current_quantity, batch_number
  FROM product_batches
  WHERE status NOT IN ('EMPTY','DAMAGED') AND location_id IS NOT NULL
  ON CONFLICT (product_sku, location_id, lot_number) DO UPDATE SET quantity = EXCLUDED.quantity;
  ```
- [ ] **Trigger** — la UPDATE pe `product_batches` (status sau quantity), sincronizare automată în `inventory_items`
- [x] **Trigger** verificat — UPDATE cantitate batch → inventory_items actualizat instant

---

## 📋 Sprint S4 — ERP → WMS Flux Complet + Hartă cu Stoc

**Obiectiv:** ERP trimite comanda de tăiere → WMS procesează automat → ERP primește confirmarea.

### S4.1 — ERP → WMS: Recepție comandă tăiere

- [ ] **`erp-connector`** — parsare webhook Pluriva cu câmpurile: `drum_id`, `cut_length`, `remaining`, `destination`
- [ ] **Backend** — creare automată `CuttingOrder` din webhook ERP → apare în `CuttingOrdersPage.tsx`
- [ ] Notificare operator (notifications-service) — "Comandă tăiere nouă de la ERP"

### S4.2 — WMS → ERP: Confirmare după tăiere

- [ ] **`erp-connector`** — endpoint `POST /api/v1/erp/confirm-cutting` care trimite la Pluriva: lotul tăiat, locația restului, locația produsului finit
- [ ] **`CuttingOrdersPage.tsx`** — buton "Trimite confirmare ERP" (vizibil doar după status DONE)

### S4.3 — Hartă Depozit cu stoc vizual ✅ DONE

- [x] **`WarehouseMapTab.tsx`** — view mode nou **"Stoc"** colorează celulele după `current_quantity` din loturi
  - Fără stoc → gri închis · < 100 m → albastru · 100–500 m → albastru · 500–2000 m → verde · 2000–8000 m → chihlimbar · > 8000 m → portocaliu
- [x] **Tooltip** — stoc real afișat la hover pe orice locație (toate modurile): cantitate totală + nr. loturi
- [x] **Legendă** dinamică `STOCK_LEGEND` în panoul lateral la `viewMode === 'stock'`
- [x] **`loadStockData()`** — agregare `current_quantity` per `location_code` din `/batches?limit=5000`
- [x] **Refresh** reîncarcă și stocul

### S4.4 — Dashboard actualizat ✅ DONE

- [x] **Card „Resturi Disponibile‟** — număr loturi REST + cantitate totală din batch-uri active (violet)
- [x] **Backend** — endpoint nou `GET /api/v1/batches/dashboard-stats`: resturi, pending_putaway, stoc per zonă
- [x] **Tabel „Stoc per Zonă‟** — loturi + cantitate totală grupat pe zonă depozit → link către hartă
- [x] Carduri existente păstrate, nou ordin: PO recepție · Putaway · PO active · Scanare · Comenzi întârziate · Resturi

---

## 🎯 Prioritate acțiuni imediate (next)

1. ~~**S1.1, S1.2, S1.3, S1.4**~~ ✅ Done
2. ~~**S2.1, S2.3, S2.4**~~ ✅ Done
3. ~~**S3.1, S3.2, S3.3**~~ ✅ Done
4. ~~**S4.3**~~ ✅ Done
5. **S4.1 / S4.2** — ERP ↔ WMS flux complet (Pluriva webhook → CuttingOrder → confirmare)

---

## 📈 Tracking

| Sprint | Status | Completat |
|--------|--------|-----------|
| S1 — Configurare Depozit | ✅ Complet | 4/4 tasks |
| S2 — NIR → Depozitare | ✅ Complet | 4/4 tasks |
| S3 — Tăiere → REST | ✅ Complet | 3/3 tasks |
| S4 — ERP + Hartă | 🔵 În lucru | 3/4 tasks (S4.1/S4.2 ERP planificate) |

---

## 📝 Note tehnice

- Toate serviciile pe Docker: `docker-compose up -d`
- Inventory service: port 3011 (`wms-inventory`)
- Warehouse-config: port 3020 (`wms-warehouse-config`)
- DB: PostgreSQL, user `wms_admin`, db `wms_nks`
- Frontend: React + MUI 7, Vite, port 5173 în dev
- Migrări SQL: `database/migrations/NNN_descriere.sql` (ultimele: 041 putaway_rules, 042 sync inventory trigger, următor: 043)
