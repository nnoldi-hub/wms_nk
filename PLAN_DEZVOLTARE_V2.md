# WMS NK — Plan de Dezvoltare V2
## Bazat pe analiza din OPTIMIZARE.MD

> **Data:** Martie 2026  
> **Stare curentă:** Sprint 1–5 COMPLET (Rule Engine, Rapoarte, Mobile Recepție/Putaway)  
> **Obiectiv:** Nivel enterprise — hartă depozit, simulare reguli, cutting station, traseu optim

---

## Rezumat stare curentă & ce trebuie adăugat

| Componentă | Există | Lipsește |
|---|---|---|
| Rule Engine (PUTAWAY/PICKING/CUTTING) | ✅ | Versionare, groups/fallback, conflict detection |
| Redis | ✅ instalat în warehouse-config | Cache-ul nu e folosit încă pe reguli/zone/locații |
| Audit log reguli | ✅ tabel + API | — |
| Coordonate spațiale locații | ❌ | Coloane x/y/z/path_cost pe tabelul `locations` |
| Hartă vizuală depozit | ❌ | Editor SVG/canvas în frontend |
| Simulare reguli (toate deodată) | ❌ | Există test individual, nu playground complet |
| Cutting Station (mobil) | ❌ | Există CutSimulatorDialog pe web, nu ecran mobil |
| Optimizare traseu picking | ❌ | Necesită coordonate mai întâi |
| Rapoarte avansate | Parțial | Heatmap, operator performance, reguli în timp |

---

## SPRINT 6 — Cache Redis pentru performanță
> **Efort estimat:** 1-2 zile | **Impact:** Mare (reduce load DB cu ~60%)

### De ce acum
Redis e deja instalat și configurat în warehouse-config. E cel mai rapid câștig fără risc.

### Ce facem

**Backend — `services/warehouse-config/src/`**
- [ ] **`services/cache.js`** — wrapper Redis cu `get/set/del/invalidate(pattern)`
  - TTL configurabil per tip de date (reguli: 60s, zone: 5min, locații: 2min)
  - Fallback transparent la DB dacă Redis e down (circuit breaker simplu)
- [ ] **`ruleController.js`** — cached `GET /rules` (invalidat la orice creare/editare/ștergere regulă)
- [ ] **`routes/index.js`** — cached `GET /zones`, `GET /locations`, `GET /location-types`, `GET /packaging-types`
- [ ] **`ruleEngine.js`** — la `evaluateRules()` → citește regulile din cache, nu direct din DB

### Nu atingem
- Logica de business (engines rămân identice)
- Schema DB

### Rezultat
API răspunde în <10ms pentru operații frecvente în loc de 30-80ms.

---

## SPRINT 7 — Rule Versioning + Fallback Strategy
> **Efort estimat:** 2-3 zile | **Impact:** Mare (trasabilitate enterprise)

### De ce
Dacă o regulă a stat activă și a afectat 500 de picking-uri → trebuie să știi ce versiune era.

### Ce facem

**DB**
- [ ] **Migration 025** — tabel `wms_rule_versions`:
  ```sql
  id, rule_id (FK wms_rules), version (INT),
  conditions (JSONB), actions (JSONB),
  changed_by (UUID), change_reason (TEXT),
  created_at TIMESTAMP
  ```
- [ ] **Migration 026** — coloana `default_strategy` pe `warehouse_zones` (FIFO/MIN_WASTE/FEWEST_CUTS) — fallback când nicio regulă nu se potrivește

**Backend**
- [ ] **`ruleController.js`** — la `PUT /rules/:id` → salvează automat versiunea anterioară în `wms_rule_versions`
- [ ] **`GET /rules/:id/versions`** — istoricul versiunilor unei reguli
- [ ] **`POST /rules/:id/restore/:version`** — restaurare versiune anterioară
- [ ] **`ruleEngine.js`** — dacă nicio regulă nu se potrivește → aplică `default_strategy` din zona curentă

**Frontend**
- [ ] **`RulesTab.tsx`** — buton "Istoric" (HistoryIcon) pe fiecare rând → dialog cu versiunile anterioare + diff vizual (conditions/actions JSON simplu)
- [ ] **`WarehouseConfigPage.tsx`** — câmp "Strategie fallback" pe zona de depozit (Select)

---

## SPRINT 8 — Coordonate spațiale + Hartă depozit (vizualizare)
> **Efort estimat:** 4-5 zile | **Impact:** Foarte mare (diferențiator major față de soluții competitive)

### De ce
Fără coordonate X/Y nu poți face hartă, heatmap sau traseu optim. Trebuie adăugat acum.

### Ce facem

**DB**
- [ ] **Migration 027** — adaugă pe `locations`:
  ```sql
  ALTER TABLE locations
    ADD COLUMN coord_x SMALLINT,   -- coloana în grid depozit
    ADD COLUMN coord_y SMALLINT,   -- rândul în grid depozit
    ADD COLUMN coord_z SMALLINT DEFAULT 0, -- nivelul (0=sol, 1=raft1, etc.)
    ADD COLUMN path_cost SMALLINT DEFAULT 1; -- costul traversării (1=normal, 5=cu stivuitor)
  ```

**Backend**
- [ ] **`GET /locations`** — include câmpurile noi în răspuns
- [ ] **`PUT /locations/:id`** — acceptă coord_x/y/z, path_cost
- [ ] **`GET /warehouse-map/:warehouse_id`** — returnează toate locațiile cu coordonate + ocupare curentă + ultima mișcare → optimizat pentru hartă

**Frontend (web)**
- [ ] **`WarehouseMapPage.tsx`** — pagină nouă dedicată hartei:
  - Grid SVG 2D (coord_x × coord_y) generat dinamic din date
  - Fiecare celulă = o locație (colorată după ocupare: verde/galben/roșu)
  - Zone delimitate cu bordură și etichetă colorată
  - Click pe locație → panel lateral cu detalii (cod, prod, ocupare, ultima mișcare)
  - Toggle: **Ocupare** / **Ultima activitate** / **Tip locație**
  - Fără librării externe — SVG pur + React state
- [ ] **`Layout.tsx`** — adaugă "Hartă Depozit" în meniu (MapIcon)
- [ ] **`LocationsTab.tsx`** sau în pagina existentă — câmpuri coord_x/y/z/path_cost pe formularul de editare locație (4 câmpuri numerice simple)

**Nu facem în acest sprint**
- Drag & drop locații pe hartă (Sprint 9)
- Highlight sugestii din ruleEngine (Sprint 9)
- Pathfinding (Sprint 10)

---

## SPRINT 9 — Rule Simulation Playground + Highlight hartă
> **Efort estimat:** 2-3 zile | **Impact:** Mare (debugging reguli, training operatori)

### Ce facem

**Backend**
- [ ] **`POST /rules/simulate`** — rulează TOATE regulile active pe un context dat:
  ```json
  Request: { "scope": "PICKING", "context": { "product": {...}, "stock": {...} } }
  Response: {
    "rules_evaluated": 12,
    "matched": [{rule_name, priority, conditions_passed, actions}],
    "not_matched": [{rule_name, priority, first_failed_condition}],
    "final_actions": [...],
    "fallback_applied": false
  }
  ```
- [ ] **`POST /rules/detect-conflicts`** — primește o listă de reguli → detectează acțiuni contradictorii (ex: două reguli dau PICK_STRATEGY diferit cu aceeași prioritate)

**Frontend**
- [ ] **`RulesTab.tsx`** — buton nou "🎮 Simulare" (lângă "Reordonează") → deschide `RuleSimulatorDialog`
- [ ] **`RuleSimulatorDialog.tsx`** — componentă nouă:
  - Select scope (PICKING/PUTAWAY/etc.)
  - Editor JSON context cu exemple predefinite (butoane rapide: "Context cablu FIFO", "Context cablu cu rest")
  - Buton "Rulează simularea"
  - Rezultate: tabel cu toate regulile (matched în verde, not_matched în gri cu motivul)
  - Secțiune "Acțiuni finale" + "Fallback aplicat: DA/NU"
- [ ] **`WarehouseMapPage.tsx`** — după simulare picking → highlight locațiile sugerate pe hartă (border animat)

---

## SPRINT 10 — Cutting Station (ecran mobil dedicat) + Optimizare traseu
> **Efort estimat:** 3-4 zile | **Impact:** Operațional direct (reduce erorile la tăiere)

### Ce facem

**Mobile — Cutting Station**
- [ ] **`CuttingStationScreen.js`** — ecran nou:
  1. **Scanare tambur** (barcode/QR) → fetch batch info (SKU, lungime totală, rest curent)
  2. **Input lungime cerută** (cu selector UOM: m/cm)
  3. **Apel `POST /suggest/cutting`** → afișare plan tăiere (din ce tambur, cât rămâne)
  4. **Confirmare** → `POST /movements` pentru reducere stoc batch + creare lot rest nou
  5. Generare QR cod pentru lotul rest (afișat pe ecran, printabil)
- [ ] **`HomeScreen.js`** — adaugă "Stație Tăiere" în meniu
- [ ] **`AppNavigator.js`** — înregistrare screen

**Backend — optimizare traseu picking** *(necesită Sprint 8 finalizat)*
- [ ] **`services/pathfinder.js`** — algoritm greedy simplu (nu A* complet, suficient pentru depozit liniar):
  - Input: lista de locații ce trebuie vizitate (din picking_job_items)
  - Output: ordinea optimă de vizitare (minimizează distanța Manhattan pe grid X/Y)
- [ ] **`POST /picking-jobs/:id/optimize-route`** — returnează picking_job_items reordonat după traseu optim
- [ ] **`PickJobDetailsScreen.js`** (mobil) — buton "Traseu optim" → reordonează lista după răspuns API

---

## SPRINT 11 — Rapoarte avansate
> **Efort estimat:** 2-3 zile | **Impact:** Management & analiză

### Ce facem

**Backend — endpoint-uri noi în reportsController.js**
- [ ] **`GET /reports/rule-engine/rules-over-time`** — câte evenimente per regulă pe zi (ultimele 90 zile), câte blocate
- [ ] **`GET /reports/warehouse/heatmap`** — pentru fiecare locație: număr mișcări + ultimul acces → date pentru heatmap
- [ ] **`GET /reports/operators/performance`** — per `triggered_by_name` din audit_log: total operațiuni, blocate, override-uri, medie timp (dacă există timestamps)

**Frontend — `ReportsPage.tsx`** — tab-uri noi (5 și 6)
- [ ] **Tab "Heatmap Depozit"** — re-folosește componenta SVG din Sprint 8, colorare după frecvență mișcări (alb → galben → roșu)
- [ ] **Tab "Reguli în Timp"** — tabel/grafic simplu cu reguli active + count events pe ultimele 30/60/90 zile (MUI Table cu sparkline sau doar numere)
- [ ] **Tab "Performanță Operatori"** — tabel cu operatori, total operațiuni, rata de blocare, override-uri

---

## Ordinea recomandată de implementare

```
SPRINT 6  (1-2 zile)   → Cache Redis          ← PORNEȘTE CU ASTA, risc zero
SPRINT 7  (2-3 zile)   → Rule Versioning      ← Trasabilitate, nu blochează altceva
SPRINT 8  (4-5 zile)   → Coordonate + Hartă   ← Fundație pentru 9, 10, 11
SPRINT 9  (2-3 zile)   → Simulator Reguli     ← Depinde de Sprint 8 (highlight hartă)
SPRINT 10 (3-4 zile)   → Cutting Station      ← Depinde de Sprint 8 (pathfinding)
SPRINT 11 (2-3 zile)   → Rapoarte avansate    ← Depinde de Sprint 8 (heatmap)
```

**Total estimat:** 14–20 zile de lucru efectiv

---

## Progres General

| Sprint | Descriere | Status |
|--------|-----------|--------|
| Sprint 1 | Fundație DB + Rule Engine | ✅ COMPLET |
| Sprint 2 | API Sugestii & Integrare Picking | ✅ COMPLET |
| Sprint 3 | UI Admin Motor de Reguli | ✅ COMPLET |
| Sprint 4 | Mobile Recepție / Putaway | ✅ COMPLET |
| Sprint 5 | Reguli Avansate & Rapoarte | ✅ COMPLET |
| Sprint 6 | Cache Redis | ⬜ Neînceput |
| Sprint 7 | Rule Versioning + Fallback | ⬜ Neînceput |
| Sprint 8 | Coordonate Spațiale + Hartă | ⬜ Neînceput |
| Sprint 9 | Simulator Reguli + Highlight | ⬜ Neînceput |
| Sprint 10 | Cutting Station Mobile + Traseu | ⬜ Neînceput |
| Sprint 11 | Rapoarte Avansate + Heatmap | ⬜ Neînceput |
