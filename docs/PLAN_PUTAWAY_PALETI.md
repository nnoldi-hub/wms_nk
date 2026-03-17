# Plan Putaway & Sistem Paleți — WMS NK

> Creat: 16.03.2026 | Ultima actualizare: 16.03.2026 (sesiunea 3)
> Scop: Automatizarea putaway-ului după recepție NIR + gestionarea paleților ca unitate de depozitare

---

## Problema actuală

- După confirmarea unui NIR cu 170+ produse (ex: colaci MYYM 2X0.75), operatorul trebuie să dea manual locație la **fiecare batch** individual → 170 click-uri
- Nu există conceptul de **palet** ca unitate de depozitare — nu se știe câte produse sunt pe un palet, unde e paletul, câte locuri mai are
- La o nouă recepție, sistemul nu știe dacă pe un palet existent mai este loc

---

## Arhitectura soluției

### Concepte cheie

- **Palet** = unitate fizică de transport/depozitare cu QR propriu (`PAL-2026-001`)
- **Slot** = un loc pe palet (ex: un colac, un tambur)
- **Capacitate configurată** = câte unități dintr-un produs specific încap pe un tip de palet
- **Plan Putaway** = propunerea automată a sistemului pentru un NIR întreg (grupat pe paleți)

### Fluxul complet

```
RECEPȚIE NIR (confirmat)
        │
        ▼
[ANALIZA AUTOMATĂ]
├── Citește configurația de capacitate per produs (pallet_product_config)
├── Caută paleți existenți cu același produs și locuri libere
│   └── PAL-2026-005 la B-02-01: 6 locuri libere
├── Restul → PutawayEngine → zonă optimă → paleți noi
│   └── Capacitate din config (ex: 10 colaci/palet EURO)
│
        ▼
[PAGINA PUTAWAY — Plan propus]
┌──────────┬──────────┬──────────────┬────────────┐
│ Palet    │ Locație  │ Produse      │ Status     │
├──────────┼──────────┼──────────────┼────────────┤
│ PAL-005  │ B-02-01  │ 6 colaci     │ Existent   │
│ PAL-NOU  │ B-02-03  │ 10 colaci    │ De creat   │
│ ...      │ ...      │ ...          │ ...        │
└──────────┴──────────┴──────────────┴────────────┘
  [Modifică individual]     [CONFIRMĂ PLANUL ✓]
        │
        ▼
[Printare etichete QR paleți noi]
        │
        ▼
[Operator scanează: palet → produse → locație]
        │
        ▼
[La picking: scădere automată de pe palet → eliberare spațiu]
```

---

## Faze de implementare

---

### FAZA 1 — Bulk Assign (Putaway în Masă cu Aprobare Unică)

> **Scop:** Rezolvă problema imediată — 170 batches → 1 aprobare

#### 1.1 Backend — endpoint `POST /api/v1/batches/bulk-assign`

- [x] Adăugare rută în `services/inventory/src/routes/batches.js`
- [x] Controller `batchController.bulkAssign` — acceptă `[{batch_id, location_id}]`, face tranzacție atomică
- [x] Validare: locații există, nu sunt BLOCKED/MAINTENANCE
- [x] Audit log în `wms_ops_audit`
- [x] Fix: rulată migrație `034_create_wms_ops_audit.sql` (tabela lipsea din DB)
- [x] Fix: adăugat `authenticate` middleware pe toate rutele batches

#### 1.2 Backend — endpoint `POST /api/v1/batches/auto-plan`

- [x] Controller `batchController.autoPlan` — primește `goods_receipt_id` sau lista de `batch_ids`
- [x] Grupează batchurile după `product_sku`
- [x] Pentru fiecare grup: apelează `suggest/putaway` (warehouse-config:3020)
- [x] Citește capacitate configurată din `pallet_product_config` per produs
- [x] Returnează planul complet cu `slots_per_pallet` și `capacity_configured`
- [x] Fix: înlocuit `require('node-fetch')` cu `fetch` nativ Node 20
- [x] Fix: eliminat `gr.warehouse_id` din query (coloana nu există în `goods_receipts`)
- [x] Fix: eliminat `grl.packaging_type` din query (coloana nu există în `goods_receipt_lines`)
- [x] Fix: `warehouse_id` detectat dinamic din DB (`SELECT id FROM warehouses LIMIT 1`) în loc de hardcodat `000...001`
- [x] Fix: query paleți nu mai filtrează după `warehouse_id` — găsește toți paleții cu locație setată
- [x] Fix: configurația de capacitate (50 buc/palet) este corect citită (warehouse_id NULL = global)
- [x] Fix: `bulkAssign` rezolvă `location_id` din palet când nu e furnizat direct
- [x] Fix: `bulkAssign` setează `primary_product_sku` pe palet la prima asignare
- [x] Fix: frontend acceptă asignări cu `pallet_id` chiar dacă `location_id` e null

#### 1.3 Frontend — buton „Auto-Repartizare" în PutawayTasksPage

- [x] Buton nou în header lângă "NIR Nou"
- [x] Modal cu două etape:
  - **Etapa 1:** Loading — "Se calculează planul optim..."
  - **Etapa 2:** Tabel de previzualizare plan (batch | produs | cantitate | locație sugerată | edit)
- [x] Confirmare în masă → `POST /batches/bulk-assign`
- [x] Progress bar pe durata confirmării

**Status: ✅ IMPLEMENTAT**

---

### FAZA 2 — Sistemul de Paleți

> **Scop:** Pallets ca entitate de primă clasă în WMS

#### 2.1 Migrație DB — `038_create_pallets.sql`

- [x] Tabelă `pallets` cu: `id, pallet_code, qr_code, location_id, warehouse_id, pallet_type, max_slots, current_slots, tare_weight_kg, status`
- [x] Coloană `pallet_id` și `slot_position` în `product_batches`
- [x] Tabelă `pallet_movements` pentru istoricul deplasărilor unui palet
- [x] Trigger `sync_pallet_slots` — actualizare automată `current_slots` la orice modificare în `product_batches`
- [x] Secvență `pallet_seq` pentru coduri unice
- [x] **Migrație rulată pe baza de date** (`wms_nks`)

**Status: ✅ IMPLEMENTAT + RULAT**

#### 2.2 Backend — CRUD Paleți (inventory-service)

- [x] Controller `palletController.js` — creare, listare, detalii, update status
- [x] Generare automată `pallet_code` secvențial (`PAL-YYYY-NNN`)
- [x] Generare QR code per palet
- [x] Endpoint `POST /api/v1/pallets/:id/add-batch` — adaugă un batch pe palet
- [x] Endpoint `POST /api/v1/pallets/:id/place` — plasează paletul la o locație
- [x] Endpoint `GET /api/v1/pallets/available-space?product_sku=X` — paleți cu loc liber
- [x] Fix: adăugat `authenticate` middleware pe toate rutele pallets

**Status: ✅ IMPLEMENTAT**

#### 2.3 Backend — Sugestii la confirmare NIR

- [ ] Modificare `goodsReceiptController.confirm`:
  - După creare batches → analiză automată paleți disponibili
  - Returnare `putaway_suggestions` în răspuns
- [ ] Logica de potrivire: `pallets WHERE product_sku = X AND current_slots < max_slots AND location_id IS NOT NULL`

**Status: ⬜ De implementat (Faza 2.3)**

#### 2.4 Frontend — Pagina Paleți

- [x] `PalletsPage.tsx` — vizualizare paleți, stare, locație, ocupare cu progress bar
- [x] Crearea unui palet nou cu printare QR
- [x] Flux "Plasează palet la locație" cu dialog și Autocomplete locații
- [x] Afișare QR per palet cu opțiune imprimare
- [x] Statistici: total, goi, în uz, plini, sloturi ocupate
- [x] Filtru după status
- [x] Rută `/pallets` adăugată în App.tsx și meniu Layout
- [x] **Tab „Capacitate per Produs"** — configurare câte buc/colaci per tip palet

**Status: ✅ IMPLEMENTAT**

#### 2.5 Migrație DB — `039_create_pallet_product_config.sql` ⭐ NOU

- [x] Tabelă `pallet_product_config`: configurare capacitate per produs + tip palet
- [x] Câmpuri: `units_per_pallet`, `max_weight_kg`, `unit_weight_kg`, `max_volume_m3`, `unit_volume_m3`, `stacking_allowed`
- [x] Constraint `UNIQUE (product_sku, pallet_type, warehouse_id)`
- [x] **Migrație rulată pe baza de date**

**Status: ✅ IMPLEMENTAT + RULAT**

#### 2.6 Backend — CRUD pallet_product_config ⭐ NOU

- [x] `GET /api/v1/pallets/config` — listare cu filtru produs/tip/depozit
- [x] `POST /api/v1/pallets/config` — creare sau upsert (ON CONFLICT UPDATE)
- [x] `DELETE /api/v1/pallets/config/:id` — ștergere
- [x] `autoPlan` citește capacitatea configurată; fallback la 10 dacă nu există config

**Status: ✅ IMPLEMENTAT**

#### 2.7 Frontend — Sugestii la NIR Confirmat

- [ ] Banner/Alert în ReceptieNIRPage după confirmare: "Sistem a identificat X paleți cu loc liber"
- [ ] Link direct la planul de putaway pre-completat

**Status: ⬜ De implementat**

---

### FAZA 3 — Flux Scanare Fizică & Integrare Scanner

> **Scop:** Operatorul scanează fizic în depozit

#### 3.1 Flux scan palet → produse → locație

- [ ] Scanner Service: detectare cod `PAL-YYYY-NNN` → tip `pallet`
- [ ] Pagina de scanare modală: după scan palet → "Scanați produsele de pe palet"
- [ ] Confirmare prin scanarea locației → palet plasat automat

#### 3.2 Picking cu scădere de pe palet

- [ ] La picking: scădere `product_batches.current_quantity` + update `pallets.current_slots`
- [ ] Când palet gol → `pallets.status = 'EMPTY'`, `location_id = NULL`
- [ ] Notificare: "Paletul PAL-005 din B-02-01 a fost golit — locație disponibilă"

#### 3.3 Sugestii la recepție bazate pe paleți existenți

- [ ] La confirmare NIR: afișare alertă "PAL-005 la B-02-01 mai are 4 locuri pentru MYYM 2X0.75"
- [ ] Opțiunea de a completa paleții existenți vs a crea paleți noi

**Status: ⬜ De implementat**

---

## Schema DB — Tabele (sesiunea 1 + 2)

### `pallets` (038)

```sql
CREATE TABLE pallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_code     VARCHAR(30) UNIQUE NOT NULL,  -- PAL-2026-001
  qr_code         TEXT,
  location_id     VARCHAR(50) REFERENCES locations(id) ON DELETE SET NULL,
  warehouse_id    UUID REFERENCES warehouses(id),
  pallet_type     VARCHAR(20) DEFAULT 'EURO',
  max_slots       INTEGER NOT NULL DEFAULT 10,
  current_slots   INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(20) DEFAULT 'EMPTY'
);
```

### `pallet_product_config` (039) ⭐ NOU

```sql
CREATE TABLE pallet_product_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_sku       VARCHAR(100) NOT NULL,
  pallet_type       VARCHAR(30) NOT NULL DEFAULT 'EURO',
  units_per_pallet  INTEGER NOT NULL DEFAULT 10,
  max_weight_kg     NUMERIC(10,2),
  max_volume_m3     NUMERIC(10,4),
  unit_weight_kg    NUMERIC(10,4),
  unit_volume_m3    NUMERIC(10,6),
  stacking_allowed  BOOLEAN DEFAULT TRUE,
  notes             TEXT,
  warehouse_id      UUID REFERENCES warehouses(id),
  CONSTRAINT uq_pallet_product_config UNIQUE (product_sku, pallet_type, warehouse_id)
);
```

---

## Progres general

| Faza | Task | Status | Sesiunea |
|------|------|--------|---------|
| 1 | Backend bulk-assign endpoint | ✅ | 1 |
| 1 | Backend auto-plan endpoint | ✅ | 1 |
| 1 | Fix auth middleware batches | ✅ | 2 |
| 1 | Fix node-fetch → fetch nativ | ✅ | 2 |
| 1 | Frontend Auto-Repartizare modal | ✅ | 1 |
| 2 | Migrație DB pallets (038) | ✅ rulat | 1+2 |
| 2 | Backend CRUD paleți | ✅ | 1 |
| 2 | Fix auth middleware pallets | ✅ | 2 |
| 2 | Migrație DB pallet_product_config (039) | ✅ rulat | 2 |
| 2 | Backend CRUD pallet_product_config | ✅ | 2 |
| 2 | autoPlan folosește config capacitate | ✅ | 2 |
| 2 | Frontend PalletsPage | ✅ | 1 |
| 2 | Frontend tab Capacitate per Produs | ✅ | 2 |
| 3b | Fix: migrație 034 wms_ops_audit rulată | ✅ rulat | 3 |
| 3b | Fix: warehouse_id detectat din DB | ✅ | 3 |
| 3b | Fix: coloane inexistente gr/grl eliminate | ✅ | 3 |
| 3b | Fix: capacitate 50/palet aplicată corect | ✅ | 3 |
| 3b | Fix: bulkAssign → location din palet | ✅ | 3 |
| 3b | Flux complet auto-plan + confirmare | ✅ FUNCȚIONAL | 3 |
| 2 | Frontend sugestii NIR post-confirmare | ⬜ | — |
| 3 | Scanner: detectare PAL-YYYY-NNN | ⬜ | — |
| 3 | Flux scan fizic palet→produse→locație | ⬜ | — |
| 3 | Picking cu scădere de pe palet | ⬜ | — |
| 3 | Sugestii la recepție bazate pe paleți | ⬜ | — |

---

## Note tehnice

- Serviciul `inventory` (port 3011) — conține batches, goods_receipts, locations, pallets
- Serviciul `warehouse-config` (port 3020) — conține putawayEngine, wms_rules
- DB: `wms_nks` pe `wms-postgres`, user `wms_admin`
- Frontend: `PutawayTasksPage.tsx`, `PalletsPage.tsx`, `ReceptieNIRPage.tsx`
- Migrații rulate: `038_create_pallets.sql`, `039_create_pallet_product_config.sql`
- **Flux configurare capacitate:** Paleți → tab „Capacitate per Produs" → Adaugă Configurație
- **Auto-plan fallback:** dacă nu există config pentru un produs → 10 buc/palet implicit cu avertizare în UI
- **Docker sync:** volumele inventory sunt comentate în docker-compose → orice modificare necesită `docker cp <fișier> wms-inventory:/app/src/...`
- **warehouse_id paleți:** `607ebe9d-875d-4bf6-b0cf-c1cd26688ce6` (depozitul principal H1)
- **Flux validat sesiunea 3:** creare 4 paleți EURO → plasare pe raft → Auto-Repartizare 170 batches → 50 buc/palet → Confirmă Planul → putaway descărcat


---

## Problema actuală

- După confirmarea unui NIR cu 170+ produse (ex: colaci MYYM 2X0.75), operatorul trebuie să dea manual locație la **fiecare batch** individual → 170 click-uri
- Nu există conceptul de **palet** ca unitate de depozitare — nu se știe câte produse sunt pe un palet, unde e paletul, câte locuri mai are
- La o nouă recepție, sistemul nu știe dacă pe un palet existent mai este loc

---

## Arhitectura soluției

### Concepte cheie

- **Palet** = unitate fizică de transport/depozitare cu QR propriu (`PAL-2026-001`)
- **Slot** = un loc pe palet (ex: un colac, un tambur)
- **Plan Putaway** = propunerea automată a sistemului pentru un NIR întreg (grupat pe paleți)

### Fluxul complet

```
RECEPȚIE NIR (confirmat)
        │
        ▼
[ANALIZA AUTOMATĂ]
├── Caută paleți existenți cu același produs și locuri libere
│   └── PAL-2026-005 la B-02-01: 6 locuri libere
├── Restul → PutawayEngine → zonă optimă → paleți noi
│
        ▼
[PAGINA PUTAWAY — Plan propus]
┌──────────┬──────────┬──────────────┬────────────┐
│ Palet    │ Locație  │ Produse      │ Status     │
├──────────┼──────────┼──────────────┼────────────┤
│ PAL-005  │ B-02-01  │ 6 colaci     │ Existent   │
│ PAL-NOU  │ B-02-03  │ 10 colaci    │ De creat   │
│ ...      │ ...      │ ...          │ ...        │
└──────────┴──────────┴──────────────┴────────────┘
  [Modifică individual]     [CONFIRMĂ PLANUL ✓]
        │
        ▼
[Printare etichete QR paleți noi]
        │
        ▼
[Operator scanează: palet → produse → locație]
        │
        ▼
[La picking: scădere automată de pe palet → eliberare spațiu]
```

---

## Faze de implementare

---

### FAZA 1 — Bulk Assign (Putaway în Masă cu Aprobare Unică)

> **Scop:** Rezolvă problema imediată — 170 batches → 1 aprobare

#### 1.1 Backend — endpoint `POST /api/v1/batches/bulk-assign`

- [x] Adăugare rută în `services/inventory/src/routes/batches.js`
- [x] Controller `batchController.bulkAssign` — acceptă `[{batch_id, location_id}]`, face tranzacție atomică
- [x] Validare: locații există, nu sunt BLOCKED/MAINTENANCE
- [x] Audit log în `wms_ops_audit`

#### 1.2 Backend — endpoint `POST /api/v1/batches/auto-plan`

- [x] Controller `batchController.autoPlan` — primește `goods_receipt_id` sau lista de `batch_ids`
- [x] Grupează batchurile după `product_sku`
- [x] Pentru fiecare grup: apelează `suggest/putaway` (warehouse-config:3020)
- [x] Returnează planul complet: `[{batch_id, batch_number, product_sku, location_id, location_code, confidence_score}]`

#### 1.3 Frontend — buton „Auto-Repartizare" în PutawayTasksPage

- [x] Buton nou în header lângă "NIR Nou"
- [x] Modal cu două etape:
  - **Etapa 1:** Loading — "Se calculează planul optim..."
  - **Etapa 2:** Tabel de previzualizare plan (batch | produs | cantitate | locație sugerată | edit)
- [x] Confirmare în masă → `POST /batches/bulk-assign`
- [x] Progress bar pe durata confirmării

**Status: ✅ IMPLEMENTAT**

---

### FAZA 2 — Sistemul de Paleți

> **Scop:** Pallets ca entitate de primă clasă în WMS

#### 2.1 Migrație DB — `038_create_pallets.sql`

- [x] Tabelă `pallets` cu: `id, pallet_code, qr_code, location_id, warehouse_id, pallet_type, max_slots, current_slots, tare_weight_kg, status`
- [x] Coloană `pallet_id` și `slot_position` în `product_batches`
- [x] Tabelă `pallet_movements` pentru istoricul deplasărilor unui palet
- [x] Trigger `sync_pallet_slots` — actualizare automată `current_slots` la orice modificare în `product_batches`
- [x] Secvență `pallet_seq` pentru coduri unice

**Status: ✅ IMPLEMENTAT**

#### 2.2 Backend — CRUD Paleți (inventory-service)

- [x] Controller `palletController.js` — creare, listare, detalii, update status
- [x] Generare automată `pallet_code` secvențial (`PAL-YYYY-NNN`)
- [x] Generare QR code per palet
- [x] Endpoint `POST /api/v1/pallets/:id/add-batch` — adaugă un batch pe palet
- [x] Endpoint `POST /api/v1/pallets/:id/place` — plasează paletul la o locație
- [x] Endpoint `GET /api/v1/pallets/available-space?product_sku=X` — paleți cu loc liber

**Status: ✅ IMPLEMENTAT**

#### 2.3 Backend — Sugestii la confirmare NIR

- [ ] Modificare `goodsReceiptController.confirm`:
  - După creare batches → analiză automată paleți disponibili
  - Returnare `putaway_suggestions` în răspuns
- [ ] Logica de potrivire: `pallets WHERE product_sku = X AND current_slots < max_slots AND location_id IS NOT NULL`

**Status: ⬜ De implementat (Faza 2.3)**

#### 2.4 Frontend — Pagina Paleți

- [x] `PalletsPage.tsx` — vizualizare paleți, stare, locație, ocupare cu progress bar
- [x] Crearea unui palet nou cu printare QR
- [x] Flux "Plasează palet la locație" cu dialog și Autocomplete locații
- [x] Afișare QR per palet cu opțiune imprimare
- [x] Statistici: total, goi, în uz, plini, sloturi ocupate
- [x] Filtru după status
- [x] Rută `/pallets` adăugată în App.tsx și meniu Layout

**Status: ✅ IMPLEMENTAT**

#### 2.5 Frontend — Sugestii la NIR Confirmat

- [ ] Banner/Alert în ReceptieNIRPage după confirmare: "Sistem a identificat X paleți cu loc liber"
- [ ] Link direct la planul de putaway pre-completat

**Status: ⬜ De implementat (Faza 2.5)**

---

### FAZA 3 — Flux Scanare Fizică & Integrare Scanner

> **Scop:** Operatorul scanează fizic în depozit

#### 3.1 Flux scan palet → produse → locație

- [ ] Scanner Service: detectare cod `PAL-YYYY-NNN` → tip `pallet`
- [ ] Pagina de scanare modală: după scan palet → "Scanați produsele de pe palet"
- [ ] Confirmare prin scanarea locației → palet plasat automat

#### 3.2 Picking cu scădere de pe palet

- [ ] La picking: scădere `product_batches.current_quantity` + update `pallets.current_slots`
- [ ] Când palet gol → `pallets.status = 'EMPTY'`, `location_id = NULL`
- [ ] Notificare: "Paletul PAL-005 din B-02-01 a fost golit — locație disponibilă"

#### 3.3 Sugestii la recepție bazate pe paleți existenți

- [ ] La confirmare NIR: afișare alertă "PAL-005 la B-02-01 mai are 4 locuri pentru MYYM 2X0.75"
- [ ] Opțiunea de a completa paleții existenți vs a crea paleți noi

**Status: ⬜ De implementat**

---

## Schema DB — Tabela `pallets` (Faza 2)

```sql
CREATE TABLE pallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_code     VARCHAR(30) UNIQUE NOT NULL,  -- PAL-2026-001
  qr_code         TEXT,
  location_id     VARCHAR(50) REFERENCES locations(id) ON DELETE SET NULL,
  warehouse_id    UUID REFERENCES warehouses(id),
  pallet_type     VARCHAR(20) DEFAULT 'EURO',   -- EURO / INDUSTRIAL / SEMI / CUSTOM
  max_slots       INTEGER NOT NULL DEFAULT 10,
  current_slots   INTEGER NOT NULL DEFAULT 0,
  tare_weight_kg  NUMERIC(6,2),
  status          VARCHAR(20) DEFAULT 'EMPTY'   -- EMPTY/IN_USE/FULL/IN_TRANSIT/RETIRED
    CHECK (status IN ('EMPTY','IN_USE','FULL','IN_TRANSIT','RETIRED')),
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pallet_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id   UUID NOT NULL REFERENCES pallets(id),
  from_location_id VARCHAR(50) REFERENCES locations(id),
  to_location_id   VARCHAR(50) REFERENCES locations(id),
  moved_by    UUID REFERENCES users(id),
  reason      VARCHAR(100),
  moved_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Linkul palet ↔ batch
ALTER TABLE product_batches
  ADD COLUMN pallet_id     UUID REFERENCES pallets(id) ON DELETE SET NULL,
  ADD COLUMN slot_position INTEGER;

-- Secvență palet
CREATE SEQUENCE pallet_seq START 1;
```

---

## Progres general

| Faza | Task | Status |
|------|------|--------|
| 1 | Backend bulk-assign endpoint | ✅ |
| 1 | Backend auto-plan endpoint | ✅ |
| 1 | Frontend Auto-Repartizare modal | ✅ |
| 2 | Migrație DB pallets | ✅ |
| 2 | Backend CRUD paleți | ✅ |
| 2 | Backend sugestii la NIR confirmat | ⬜ |
| 2 | Frontend PalletsPage | ✅ |
| 2 | Frontend sugestii NIR | ⬜ |
| 3 | Scanner: detectare PAL-YYYY-NNN | ⬜ |
| 3 | Flux scan fizic palet→produse→locație | ⬜ |
| 3 | Picking cu scădere de pe palet | ⬜ |
| 3 | Sugestii la recepție bazate pe paleți | ⬜ |

---

## Note tehnice

- Serviciul `inventory` (port 3011) — conține batches, goods_receipts, locations
- Serviciul `warehouse-config` (port 3020) — conține putawayEngine, wms_rules  
- Frontend: `PutawayTasksPage.tsx`, `ReceptieNIRPage.tsx`
- Ultima migrație: `037_fix_erp_missing_tables.sql` → urmatoarea: `038_create_pallets.sql`
