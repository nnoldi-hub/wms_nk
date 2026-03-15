# 📋 Plan de Extindere WMS-NKS - Sistem Tamburi & Transformări

## 🎯 Obiectiv General
Extindere sistem WMS pentru gestionare avansată stoc cu:
- **Loturi individuale** (tamburi, role, cutii) cu tracking complet
- **Transformări produse** (tăiere, reambalare, conversii)
- **Algoritmi inteligenti** pentru selectare automată tambur optim
- **Trasabilitate completă** de la tambur sursă la produs final

---

## 📊 Arhitectură Nouă

### Entități Database Noi

#### 1. `product_units` - Unități de Ambalare
```sql
CREATE TABLE product_units (
  id UUID PRIMARY KEY,
  code VARCHAR(20) UNIQUE,        -- BOX, ROLL, DRUM, METER, KG
  name VARCHAR(100),               -- Cutie, Rolă, Tambur, Metru, Kilogram
  type VARCHAR(20),                -- CONTAINER, MEASUREMENT
  is_splittable BOOLEAN,           -- Poate fi împărțit (tambur=true, cutie=false)
  created_at TIMESTAMP
);
```

#### 2. `product_batches` - Loturi/Tamburi Individuale
```sql
CREATE TABLE product_batches (
  id UUID PRIMARY KEY,
  batch_number VARCHAR(50) UNIQUE, -- DRUM-SKU-YYYYMMDD-XXX
  product_sku VARCHAR(50) FK,
  unit_id UUID FK,                 -- Legătură la product_units
  
  -- Caracteristici fizice
  initial_quantity DECIMAL,        -- Cantitate inițială
  current_quantity DECIMAL,        -- Cantitate rămasă
  length_meters DECIMAL,           -- Pentru cabluri
  weight_kg DECIMAL,
  
  -- Status tracking
  status VARCHAR(20),              -- INTACT, CUT, REPACKED, EMPTY, DAMAGED
  location_id UUID FK,             -- Locație curentă
  
  -- Trasabilitate
  source_batch_id UUID FK,         -- Tambur sursă (dacă provine din tăiere)
  transformation_id UUID FK,       -- Legătură la transformare
  
  -- Metadata
  received_at TIMESTAMP,
  opened_at TIMESTAMP,
  emptied_at TIMESTAMP,
  notes TEXT,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### 3. `product_transformations` - Istoric Transformări
```sql
CREATE TABLE product_transformations (
  id UUID PRIMARY KEY,
  transformation_number VARCHAR(50) UNIQUE, -- TRANS-YYYYMMDD-XXXXX
  type VARCHAR(20),                -- CUT, REPACK, CONVERT, SPLIT
  
  -- Sursă
  source_batch_id UUID FK,
  source_quantity DECIMAL,
  
  -- Rezultat
  result_batch_id UUID FK,
  result_quantity DECIMAL,
  waste_quantity DECIMAL,          -- Pierdere la tăiere
  
  -- Context
  cutting_order_id UUID FK,        -- Dacă provine din ordin de tăiere
  performed_by UUID FK,            -- User care a executat
  performed_at TIMESTAMP,
  
  -- Algoritm folosit
  selection_method VARCHAR(20),    -- FIFO, MIN_WASTE, MANUAL
  
  notes TEXT,
  created_at TIMESTAMP
);
```

#### 4. `batch_selection_rules` - Reguli Algoritm Selectare
```sql
CREATE TABLE batch_selection_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  priority INTEGER,                -- Ordinea aplicării regulilor
  rule_type VARCHAR(20),           -- FIFO, MIN_WASTE, LOCATION_PROXIMITY
  conditions JSONB,                -- Condiții parametrizabile
  is_active BOOLEAN,
  created_at TIMESTAMP
);
```

---

## 🔄 Faze de Implementare

### FAZA 1: Database & Core Models (2-3 ore)
**Obiectiv:** Migrații database și structuri de bază

**Taskuri:**
1. ✅ Migrație `010_create_product_units.sql`
   - Tabel product_units
   - Seed data: BOX, ROLL, DRUM, METER, KG, PALLET

2. ✅ Migrație `011_create_product_batches.sql`
   - Tabel product_batches
   - Indexuri: batch_number, product_sku, status, location_id
   - Trigger: auto-generate batch_number

3. ✅ Migrație `012_create_product_transformations.sql`
   - Tabel product_transformations
   - Indexuri: source_batch_id, result_batch_id, type
   - Trigger: auto-generate transformation_number

4. ✅ Migrație `013_create_batch_selection_rules.sql`
   - Tabel batch_selection_rules
   - Seed data: FIFO rule, MIN_WASTE rule

5. ✅ Actualizare `products` table
   - Adaugă default_unit_id FK
   - Adaugă is_batch_tracked BOOLEAN

**Verificare:** 
```sql
SELECT * FROM product_units;
SELECT * FROM product_batches WHERE status = 'INTACT';
```

---

### FAZA 2: Inventory Service Extensions (3-4 ore)
**Obiectiv:** API pentru gestionare loturi/tamburi

**Taskuri:**
1. ✅ `batchController.js` - CRUD loturi
   - GET /api/v1/inventory/batches - listă loturi
   - GET /api/v1/inventory/batches/:id - detalii lot
   - POST /api/v1/inventory/batches - înregistrare lot nou
   - PUT /api/v1/inventory/batches/:id - actualizare status
   - GET /api/v1/inventory/batches/product/:sku - loturi per produs

2. ✅ `transformationController.js` - Istoric transformări
   - GET /api/v1/inventory/transformations
   - GET /api/v1/inventory/transformations/:id
   - POST /api/v1/inventory/transformations - înregistrare transformare

3. ✅ Algoritm selectare tambur: `batchSelectionService.js`
   ```javascript
   class BatchSelectionService {
     selectOptimalBatch(productSku, requiredQuantity, method = 'FIFO') {
       // Implementare FIFO
       // Implementare MIN_WASTE (minimizare rest)
       // Implementare LOCATION_PROXIMITY
     }
   }
   ```

4. ✅ Actualizare `movementController.js`
   - Adaugă tipuri noi: CUT, REPACK, CONVERT
   - Link mișcări cu batch_id

**Verificare:**
```bash
curl http://localhost:3011/api/v1/inventory/batches?status=INTACT
curl http://localhost:3011/api/v1/inventory/batches/select?sku=MAT-001&quantity=50
```

---

### FAZA 3: Cutting Service Enhancement (2-3 ore)
**Obiectiv:** Integrare cu sistem loturi și sugestii automate

**Taskuri:**
1. ✅ Actualizare `cutting_orders` table
   - Adaugă source_batch_id UUID FK
   - Adaugă result_batch_id UUID FK
   - Adaugă waste_quantity DECIMAL

2. ✅ Endpoint nou: `POST /api/v1/cutting/orders/:id/suggest-source`
   ```javascript
   {
     orderId: "uuid",
     productSku: "MAT-001",
     requiredLength: 50,
     selectionMethod: "MIN_WASTE" // or FIFO, MANUAL
   }
   // Response:
   {
     suggestedBatch: {
       id: "uuid",
       batchNumber: "DRUM-MAT001-20251029-001",
       currentQuantity: 100,
       wasteQuantity: 50,
       location: "A-01-01"
     },
     alternatives: [ /* alte opțiuni */ ]
   }
   ```

3. ✅ Endpoint nou: `POST /api/v1/cutting/orders/:id/execute`
   ```javascript
   {
     orderId: "uuid",
     sourceBatchId: "uuid",
     cutQuantity: 50
   }
   // Procesare:
   // 1. Validare disponibilitate
   // 2. Actualizare source_batch (current_quantity -= cutQuantity)
   // 3. Creare result_batch (cantitate = cutQuantity)
   // 4. Înregistrare transformation
   // 5. Creare inventory movements
   // 6. Actualizare cutting_order (status = COMPLETED)
   ```

4. ✅ Business Logic: `cuttingExecutionService.js`
   - Validare tambur disponibil
   - Calcul pierdere (waste)
   - Creare tambur rezultat
   - Logging transformare

**Verificare:**
```bash
curl -X POST http://localhost:3013/api/v1/cutting/orders/123/suggest-source \
  -d '{"requiredLength": 50, "selectionMethod": "FIFO"}'

curl -X POST http://localhost:3013/api/v1/cutting/orders/123/execute \
  -d '{"sourceBatchId": "uuid", "cutQuantity": 50}'
```

---

### FAZA 4: Scanner Service Integration (1-2 ore)
**Obiectiv:** Scanare tamburi și înregistrare post-tăiere

**Taskuri:**
1. ✅ Endpoint: `POST /api/v1/scanner/scan-batch`
   ```javascript
   {
     barcode: "DRUM-MAT001-20251029-001",
     action: "IDENTIFY" // or CUT, MOVE, INSPECT
   }
   // Response: detalii batch
   ```

2. ✅ Endpoint: `POST /api/v1/scanner/register-cut-batch`
   ```javascript
   {
     sourceBatchBarcode: "DRUM-MAT001-20251029-001",
     cutLength: 50,
     newBatchBarcode: "DRUM-MAT001-20251029-002" // generat sau manual
   }
   ```

**Verificare:**
```bash
curl -X POST http://localhost:3012/api/v1/scanner/scan-batch \
  -d '{"barcode": "DRUM-MAT001-20251029-001"}'
```

---

### FAZA 5: Frontend Mobile App (3-4 ore)
**Obiectiv:** Ecran "Tăiere Cablu" cu sugestii automate

**Taskuri:**
1. ✅ Screen: `CuttingScreen.tsx`
   - Step 1: Scanare tambur sursă (sau selectare manuală)
   - Step 2: Introducere lungime tăiere
   - Step 3: Afișare sugestie automată (locație, cantitate rămasă)
   - Step 4: Confirmare tăiere
   - Step 5: Generare barcode tambur nou

2. ✅ Component: `BatchSelectionCard.tsx`
   - Afișare tambur sugerat
   - Opțiuni alternative
   - Warning pentru pierdere mare

3. ✅ Service: `cutting.service.ts` (mobile)
   - `suggestSourceBatch(sku, quantity)`
   - `executeCutting(orderId, sourceBatchId, quantity)`

**Verificare:**
- Teste manuale în emulator
- Scanare QR mock
- Confirmare tăiere → verificare în DB

---

### FAZA 6: Frontend Web UI (2-3 ore)
**Obiectiv:** Dashboard transformări și gestionare tamburi

**Taskuri:**
1. ✅ Page: `BatchesPage.tsx`
   - DataGrid cu toate loturile
   - Filtre: status (INTACT/CUT/EMPTY), product, location
   - Coloane: batch_number, product, quantity, status, location, age
   - Acțiuni: View details, Move, Mark as damaged

2. ✅ Page: `TransformationsPage.tsx`
   - Istoric transformări
   - Filtre: type (CUT/REPACK/CONVERT), date range
   - Vizualizare arbore: tambur sursă → transformări → tamburi rezultat

3. ✅ Component: `BatchDetailsDialog.tsx`
   - Detalii complete lot
   - Istoric mișcări
   - Timeline transformări
   - QR code pentru printare

4. ✅ Dashboard widget: "Tamburi Activi"
   - Total tamburi INTACT
   - Tamburi CUT (parțial folosite)
   - Alerte: tamburi vechi, expirări apropiate

**Verificare:**
- Login web UI
- Navighează la Batches
- Verifică afișare date din DB

---

### FAZA 7: Reports Service Extension (1-2 ore)
**Obiectiv:** Rapoarte specifice transformări

**Taskuri:**
1. ✅ Report: "Consum Tamburi"
   - GET /api/v1/reports/drum-consumption
   - Parametri: date_from, date_to, product_sku
   - Output: tamburi consumate, waste total, eficiență

2. ✅ Report: "Transformări SKU"
   - GET /api/v1/reports/transformations
   - Grupare: per tip transformare, per produs
   - Grafice: trend tăieri, pierderi medii

3. ✅ Report: "Pierderi la Tăiere"
   - GET /api/v1/reports/cutting-waste
   - Analiza pierderi per worker, per produs
   - Identificare oportunități optimizare

**Verificare:**
```bash
curl "http://localhost:3019/api/v1/reports/drum-consumption?date_from=2025-10-01&date_to=2025-10-31"
```

---

### FAZA 8: Audit & Trasabilitate (1 oră)
**Obiectiv:** Logging complet și trasare

**Taskuri:**
1. ✅ Trigger: `log_batch_transformation`
   - La fiecare transformare → entry în audit_logs
   - Detalii: user, timestamp, batch sursă, batch rezultat

2. ✅ API: GET `/api/v1/inventory/batches/:id/traceability`
   - Returnează arbore complet:
     - Tambur original
     - Toate transformările
     - Toate loturile rezultate
     - Mișcări asociate

**Verificare:**
```bash
curl http://localhost:3011/api/v1/inventory/batches/uuid/traceability
```

---

### FAZA 9: ERP Connector Update (1-2 ore)
**Obiectiv:** Sincronizare transformări cu ERP

**Taskuri:**
1. ✅ Actualizare `erpConnectorService.js`
   - Endpoint: `syncTransformation(transformationId)`
   - Format mesaj ERP:
     ```json
     {
       "type": "STOCK_TRANSFORMATION",
       "sourceSKU": "MAT-001",
       "sourceBatch": "DRUM-001",
       "sourceQuantity": 100,
       "resultSKU": "MAT-001",
       "resultBatch": "DRUM-002",
       "resultQuantity": 50,
       "waste": 0,
       "timestamp": "2025-10-29T10:00:00Z"
     }
     ```

2. ✅ Listener RabbitMQ: `transformation.completed`
   - Trigger automat la completare transformare
   - Trimitere mesaj către ERP

**Verificare:**
- Test cu ERP sandbox
- Verificare sincronizare stoc

---

### FAZA 10: Testing & Documentation (2 ore)
**Obiectiv:** Teste complete și documentație

**Taskuri:**
1. ✅ Unit Tests
   - `batchSelectionService.test.js` - algoritmi selectare
   - `cuttingExecutionService.test.js` - logică tăiere
   - `transformationController.test.js` - API endpoints

2. ✅ Integration Tests
   - Flow complet: creare lot → sugestie → tăiere → verificare DB
   - Test FIFO vs MIN_WASTE
   - Test concurență (2 useri aleg același tambur)

3. ✅ API Documentation
   - Swagger/OpenAPI pentru toate endpoint-urile noi
   - Exemple request/response
   - Flow diagrams

4. ✅ User Documentation
   - Ghid: "Cum se înregistrează un tambur nou"
   - Ghid: "Cum se execută o tăiere cu sugestie automată"
   - Video tutorial (optional)

---

## 📅 Timeline Estimat

| Fază | Ore | Zile (6h/zi) | Dependențe |
|------|-----|--------------|-----------|
| FAZA 1: Database | 3 | 0.5 | - |
| FAZA 2: Inventory API | 4 | 0.7 | FAZA 1 |
| FAZA 3: Cutting Service | 3 | 0.5 | FAZA 1, 2 |
| FAZA 4: Scanner Service | 2 | 0.3 | FAZA 2 |
| FAZA 5: Mobile App | 4 | 0.7 | FAZA 2, 3 |
| FAZA 6: Web UI | 3 | 0.5 | FAZA 2, 3 |
| FAZA 7: Reports | 2 | 0.3 | FAZA 2, 3 |
| FAZA 8: Audit | 1 | 0.2 | FAZA 2 |
| FAZA 9: ERP Connector | 2 | 0.3 | FAZA 2, 3 |
| FAZA 10: Testing | 2 | 0.3 | Toate |
| **TOTAL** | **26 ore** | **~4-5 zile** | |

---

## 🚀 Ordre de Prioritate

### Sprint 1 (Critic - 2 zile)
1. FAZA 1: Database (migrații complete)
2. FAZA 2: Inventory API (CRUD loturi + algoritm selectare)
3. FAZA 3: Cutting Service (sugestii + execuție)

**Obiectiv:** Backend funcțional pentru gestionare loturi și tăieri

### Sprint 2 (Important - 1.5 zile)
4. FAZA 4: Scanner Service
5. FAZA 5: Mobile App (ecran tăiere)
6. FAZA 6: Web UI (dashboard tamburi)

**Obiectiv:** Interfețe utilizator complete

### Sprint 3 (Nice-to-have - 1 zi)
7. FAZA 7: Reports
8. FAZA 8: Audit
9. FAZA 9: ERP Connector

**Obiectiv:** Funcționalități avansate

### Sprint 4 (Finalizare - 0.5 zile)
10. FAZA 10: Testing & Documentation

---

## 🎯 Milestone-uri Critice

### Milestone 1: "Tambur Tracking Live"
✅ Database cu product_batches funcțional  
✅ API pentru înregistrare tamburi noi  
✅ API pentru listare tamburi disponibile  
**Verificare:** Creez manual 5 tamburi în DB, le văd în API

### Milestone 2: "Sugestie Automată Funcțională"
✅ Algoritm FIFO implementat  
✅ Algoritm MIN_WASTE implementat  
✅ API `/suggest-source` returnează tambur optim  
**Verificare:** Request cu requiredQuantity=50 → primesc tambur sugerat

### Milestone 3: "Tăiere End-to-End"
✅ API `/execute` finalizează tăiere  
✅ Se creează tambur nou cu rest  
✅ Se înregistrează transformare  
**Verificare:** Flow complet: sugestie → execuție → verificare 2 tamburi în DB

### Milestone 4: "UI Complet"
✅ Mobile app: ecran tăiere funcțional  
✅ Web UI: dashboard tamburi activi  
✅ Web UI: istoric transformări  
**Verificare:** User poate executa tăiere din mobile, vede rezultatul în web

---

## 🔧 Tehnologii & Tools

### Backend
- **Node.js 18+** - toate microservicele
- **PostgreSQL 15** - database principal
- **Redis** - cache pentru sugestii recente
- **RabbitMQ** - evenimente transformări

### Frontend
- **React Native** - mobile app (existent)
- **React + TypeScript + MUI** - web UI (existent)
- **Recharts** - grafice rapoarte

### DevOps
- **Docker Compose** - orchestration
- **GitHub Actions** - CI/CD (opțional)

---

## 📊 Metrici de Succes

1. **Performanță Algoritm**
   - Timp răspuns `/suggest-source` < 200ms
   - Acuratețe FIFO: 100%
   - Reducere waste cu MIN_WASTE: ≥ 15%

2. **Adopție Utilizatori**
   - 80% tăieri cu sugestie automată (nu manual)
   - 95% tamburi corect înregistrate

3. **Trasabilitate**
   - 100% transformări loggate
   - 100% tamburi trasabile până la sursă

---

## 🚨 Riscuri & Mitigări

| Risc | Probabilitate | Impact | Mitigare |
|------|---------------|--------|----------|
| Algoritm MIN_WASTE prea lent | Medie | Ridicat | Cache + indexare DB, fallback la FIFO |
| Concurență: 2 useri aleg același tambur | Ridicată | Ridicat | Locking optimist, validare disponibilitate |
| Sincronizare ERP eșuează | Medie | Mediu | Retry queue, logging erori |
| Mobile app: scanare QR inconsistentă | Medie | Mediu | Validare format barcode, fallback manual |

---

## 📝 Notițe Implementare

### Considerații Database
- **Indexuri critice:** `product_batches.status`, `product_batches.product_sku`
- **Partitioning:** Dacă > 1M loturi, partitioning pe `created_at`
- **Archiving:** Tamburi EMPTY > 1 an → move la archive table

### Considerații API
- **Rate limiting:** 100 req/min per user pentru `/suggest-source`
- **Caching:** Cache sugestii FIFO pentru 5 min (Redis)
- **Versioning:** Toate endpoint-uri noi: `/api/v2/...`

### Considerații Mobile
- **Offline mode:** Stochează tăieri locale, sync la reconnect
- **Barcode formats:** Suport QR, Code128, DataMatrix
- **Camera permissions:** Check înainte de scan

---

## ✅ Checklist Pre-Start

Înainte de a începe implementarea:

- [ ] Review arhitectură cu echipa
- [ ] Aprob migrații database
- [ ] Setup environment de development
- [ ] Creez branch nou: `feature/batch-tracking`
- [ ] Configurez database de test cu date mock
- [ ] Pregătesc mock data pentru 10 tamburi test

---

## 🎬 Next Steps

**Pas imediat următor:**
1. Confirm acest plan cu tine
2. Încep cu FAZA 1: Database migrations
3. Creez primele 3 tabele: `product_units`, `product_batches`, `product_transformations`
4. Seed data pentru testare

**Întrebări pentru clarificare:**
1. Vrei să începem imediat sau revizuim planul mai întâi?
2. Există alte cerințe specifice pentru algoritm selectare tambur?
3. Format barcode preferat pentru tamburi? (QR vs Code128)
4. Integrare ERP este critică sau o putem lăsa pentru final?

---

**Status:** 📝 Plan pregătit, aștept confirmare pentru start implementare!
