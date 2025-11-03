# 📦 Workflow Batch Tracking cu Ambalaje (Tamburi, Paleți, Cutii)

## Conceptul de Batch cu Ambalaj

Un **batch** reprezintă o cantitate specifică de material pe un **ambalaj fizic** (tambur, paleți, cutie, sul) într-o **locație** din depozit.

### Tipuri de Ambalaje Suportate

```sql
product_units:
- DRUM   → Tambur (pentru materiale textile pe rolă)
- ROLL   → Sul (pentru materiale înfășurate)
- PALLET → Paleți (pentru materiale pe platformă)
- BOX    → Cutii (pentru materiale împachetate)
- METER  → Metru (unitate de măsură)
- KG     → Kilogram (unitate de greutate)
- PIECE  → Bucată (unitate de număr)
```

---

## 🔄 Scenarii de Transformare

### Scenario 1: Tăiere Material din Tambur → Nou Tambur

#### **Situația inițială:**
- **Batch-ul Sursă**: BATCH-00001
  - Produs: MAT-001 (Material textil alb)
  - Ambalaj: DRUM (Tambur T-2024-001)
  - Cantitate: 500m
  - Locație: R01-A1 (Raft 1, Poziție A1)
  - Status: INTACT

#### **Operațiunea:**
1. **Cutting Order**: CUT-20250129-00001
   - Cantitate necesară: 80m
   - Sistem sugerează: BATCH-00001 (algoritm MIN_WASTE)

2. **Execuție Tăiere**:
   ```
   POST /api/v1/cutting/orders/{id}/execute
   ```

3. **Ce se întâmplă automat:**

   a) **Actualizare Batch Sursă** (BATCH-00001):
   ```
   current_quantity: 500m → 420m
   status: INTACT → CUT
   opened_at: 2025-01-29T10:30:00
   ```

   b) **Creare Transformation** (TRANS-20250129-00001):
   ```
   transformation_type: CUT
   source_batch_id: BATCH-00001
   source_quantity_used: 80m
   cutting_order_id: CUT-20250129-00001
   waste_quantity: 0m (dacă e tăiere precisă)
   ```

   c) **Creare Batch Rezultat** (BATCH-00002):
   ```
   product_sku: MAT-001 (același material)
   unit_id: DRUM (Tambur nou T-2024-002)
   initial_quantity: 80m
   current_quantity: 80m
   location_id: R02-B5 (Zona de producție)
   status: INTACT
   source_batch_id: BATCH-00001
   transformation_id: TRANS-20250129-00001
   notes: "Material taiat din tambur T-2024-001, pus pe tambur nou T-2024-002"
   ```

#### **Rezultat Final:**
- **Tambur Vechi (T-2024-001)**: 420m rămași, R01-A1, status CUT
- **Tambur Nou (T-2024-002)**: 80m material tăiat, R02-B5, status INTACT
- **Traceability**: BATCH-00002 → TRANS-00001 → BATCH-00001

---

### Scenario 2: Reambalare Material (REPACK)

#### **Situația:**
Material deteriorat trebuie mutat pe un ambalaj nou.

#### **Proces:**
1. **Identificare Batch**: BATCH-00003 (Tambur T-2024-003)
   - Produs: MAT-002
   - Cantitate: 150m
   - Status: DAMAGED
   - Locație: R01-C3

2. **Creare Transformation Manual**:
   ```
   POST /api/v1/transformations
   {
     "transformation_type": "REPACK",
     "source_batch_id": "BATCH-00003",
     "source_quantity_used": 150,
     "result_product_sku": "MAT-002",
     "result_quantity": 150,
     "notes": "Reambalat de pe tambur deteriorat pe tambur nou"
   }
   ```

3. **Creare Batch Nou**:
   ```
   POST /api/v1/batches
   {
     "product_sku": "MAT-002",
     "unit_id": "DRUM",
     "initial_quantity": 150,
     "current_quantity": 150,
     "location_id": "R01-C4",
     "source_batch_id": "BATCH-00003",
     "transformation_id": "TRANS-00002",
     "notes": "Reambalat pe tambur T-2024-005"
   }
   ```

4. **Golire Batch Vechi**:
   ```
   PUT /api/v1/batches/BATCH-00003
   {
     "current_quantity": 0,
     "status": "EMPTY",
     "emptied_at": "2025-01-29T14:00:00"
   }
   ```

---

### Scenario 3: Split (Împărțire pe Multiple Ambalaje)

#### **Situația:**
Un tambur mare trebuie împărțit pe 3 tamburi mici pentru livrare.

#### **Batch Sursă:** BATCH-00005
- Produs: MAT-003
- Ambalaj: DRUM (Tambur mare T-2024-010)
- Cantitate: 300m
- Locație: R03-A1

#### **Transformare SPLIT**:

**Pas 1 - Creare Transformation:**
```
POST /api/v1/transformations
{
  "transformation_type": "SPLIT",
  "source_batch_id": "BATCH-00005",
  "source_quantity_used": 300,
  "notes": "Impartit pe 3 tamburi pentru livrare"
}
```

**Pas 2 - Creare Batch-uri Rezultat:**

**Batch 1:**
```
POST /api/v1/batches
{
  "product_sku": "MAT-003",
  "unit_id": "DRUM",
  "initial_quantity": 100,
  "location_id": "R04-A1",
  "source_batch_id": "BATCH-00005",
  "transformation_id": "TRANS-00003",
  "notes": "Tambur 1/3 - T-2024-011"
}
```

**Batch 2:**
```
POST /api/v1/batches
{
  "product_sku": "MAT-003",
  "unit_id": "DRUM",
  "initial_quantity": 100,
  "location_id": "R04-A2",
  "source_batch_id": "BATCH-00005",
  "transformation_id": "TRANS-00003",
  "notes": "Tambur 2/3 - T-2024-012"
}
```

**Batch 3:**
```
POST /api/v1/batches
{
  "product_sku": "MAT-003",
  "unit_id": "DRUM",
  "initial_quantity": 100,
  "location_id": "R04-A3",
  "source_batch_id": "BATCH-00005",
  "transformation_id": "TRANS-00003",
  "notes": "Tambur 3/3 - T-2024-013"
}
```

**Pas 3 - Golire Batch Sursă:**
```
PUT /api/v1/batches/BATCH-00005
{
  "current_quantity": 0,
  "status": "EMPTY"
}
```

---

## 🎯 Best Practices

### 1. **Nomenclatură Ambalaje**
```
Tamburi: T-{AN}-{NR}     Ex: T-2024-001, T-2024-002
Paleți:  P-{AN}-{NR}     Ex: P-2024-015
Cutii:   C-{AN}-{NR}     Ex: C-2024-100
```

### 2. **Locații Logice**
```
Depozit:    R{raft}-{zona}{pozitie}    Ex: R01-A1, R02-B5
Producție:  PROD-{zona}                 Ex: PROD-CUT, PROD-SEW
Expediție:  SHIP-{zona}                 Ex: SHIP-A1
```

### 3. **Notes Standard**
```
- "Material primit pe tambur {ID}"
- "Taiat din tambur {ID_sursa}, pus pe tambur {ID_nou}"
- "Reambalat de pe {ambalaj_vechi} pe {ambalaj_nou}"
- "Impartit pe {N} ambalaje pentru {motiv}"
```

### 4. **Workflow în UI**

#### **Pagina Batches**:
1. Filtrare după status/product/location
2. View Details → Vezi transformări asociate
3. Create Batch → Specifică unit_id (DRUM, PALLET, etc.)

#### **Pagina Transformations**:
1. Vezi toate transformările
2. Filter by type: CUT, REPACK, SPLIT, MERGE
3. Click batch → Vezi detalii ambalaj și locație

#### **Pagina Cutting Orders**:
1. Suggest Source → Sistem alege batch-ul optim
2. Execute → Creează automat:
   - Transformation
   - Actualizează batch sursă
   - Poate crea batch rezultat (opțional)

---

## 📊 Raportare și Traceability

### Query: "Unde este materialul din tambur T-2024-001?"

```sql
SELECT 
  b.batch_number,
  b.product_sku,
  b.current_quantity,
  b.location_id,
  b.status,
  u.name as unit_name,
  t.transformation_type,
  t.created_at as transformation_date
FROM product_batches b
LEFT JOIN product_units u ON b.unit_id = u.id
LEFT JOIN product_transformations t ON b.transformation_id = t.id
WHERE b.source_batch_id = (
  SELECT id FROM product_batches WHERE batch_number = 'BATCH-00001'
)
ORDER BY b.created_at;
```

**Rezultat:**
```
BATCH-00002 | MAT-001 | 80m  | R02-B5 | INTACT | DRUM | CUT | 2025-01-29
BATCH-00007 | MAT-001 | 120m | R03-A1 | CUT    | DRUM | CUT | 2025-01-30
```

### Query: "Waste per ambalaj type"

```sql
SELECT 
  u.code as ambalaj_type,
  u.name,
  COUNT(t.id) as transformations,
  SUM(t.waste_quantity) as total_waste,
  AVG(t.waste_percent) as avg_waste_percent
FROM product_transformations t
JOIN product_batches b ON t.source_batch_id = b.id
JOIN product_units u ON b.unit_id = u.id
WHERE t.transformation_type = 'CUT'
GROUP BY u.code, u.name
ORDER BY total_waste DESC;
```

---

## ✅ Checklist Implementare

- [x] Database schema cu `product_units` (tamburi, paleți, etc.)
- [x] Batch CRUD cu `unit_id` și `location_id`
- [x] Transformation tracking cu source/result batches
- [x] Frontend BatchesPage cu vizualizare ambalaje
- [x] Frontend TransformationsPage cu tracking
- [x] Cutting Orders integration cu batch selection
- [ ] **TODO**: UI pentru creare batch rezultat în TransformationsPage
- [ ] **TODO**: Barcode/QR pentru ambalaje fizice (Scanner Service)
- [ ] **TODO**: Reports pentru utilizare ambalaje

---

## 🚀 Next Steps

1. **Barcode Labels**: Generare etichete pentru tamburi/paleți
   - QR Code: `BATCH-{number}` sau `T-2024-001`
   - Scanare mobilă pentru tracking

2. **Mobile App**: Scan și asociere batch cu locație
   - Scan tambur → Selectează locație → Update batch

3. **Dashboard Widget**: 
   - Utilizare ambalaje (câte tamburi active/goale)
   - Material per tip ambalaj
   - Waste per ambalaj type

4. **Alerts**:
   - Tambur aproape gol (< 10% capacitate)
   - Ambalaje deteriorate → Notificare reambalare

---

## 📝 Exemplu Complet Flow

```
1. Primire Material (Receiving)
   → BATCH-00001: 500m pe Tambur T-2024-001, R01-A1

2. Cutting Order (Production)
   → Necesită 80m
   → Sistem sugerează BATCH-00001 (MIN_WASTE)
   → Execute → BATCH-00001: 420m, BATCH-00002: 80m pe T-2024-002

3. Sewing Order (Production)
   → Consumă BATCH-00002: 80m → 0m
   → Status EMPTY

4. Rapoarte
   → Tambur T-2024-001: 420m rămași, poate fi refolosit
   → Tambur T-2024-002: Gol, poate fi refolosit
   → Transformation: 80m tăiat, waste 0%
```

---

**Sistemul actual suportă deja acest workflow complet!** 🎉

Trebuie doar să:
1. Creezi batch-uri cu `unit_id` corect (DRUM, PALLET, etc.)
2. Specifici `location_id` la creare/actualizare
3. Adaugi `notes` pentru a identifica ambalajul fizic (T-2024-001, etc.)

Interfața permite deja toate acestea prin formularele de Create/Edit Batch!
