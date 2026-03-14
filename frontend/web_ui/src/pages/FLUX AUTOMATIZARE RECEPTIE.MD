# FLUX AUTOMATIZARE RECEPTIE — STATUS & PLAN DEZVOLTARE
> Ultima actualizare: 13 Martie 2026

---

## LEGENDA STATUS
- ✅ REALIZAT — functional, integrat
- 🔄 PARTIAL — exista dar incomplet / nelinkat
- ❌ NEIMPLEMENTAT — de construit
- 🚀 ETAPA URMATOARE — in lucru activ

---

## FAZA 1 — Importul comenzii de la furnizor (PO) din ERP

🎯 **Obiectiv:** Sa ai in WMS comanda exact cum este in Pluriva, fara introducere manuala.

### Functionalitati & Status:
- ✅ Creare manuala PO cu linii de produse (`ComenziFurnizorPage.tsx`)
- ✅ Schema DB `supplier_orders` + `supplier_order_lines` (migration 028)
- ✅ Statusuri PO: DRAFT → CONFIRMED → RECEIVING → RECEIVED → CLOSED / CANCELLED
- ✅ Numerotare automata comenzi furnizor
- ✅ Vizualizare detalii PO cu linii
- ✅ Filtrare comenzi pe status
- 🔄 Buton „Start Receptie" din PO → deschide NIR pre-completat (**ETAPA URMATOARE**)
- ❌ Import automat din Pluriva API (`erp-connector/src/` gol)
- ❌ Mapare automata coduri produse ERP <-> WMS

📌 **Dependente:** Conexiune API Pluriva, mapare SKU-uri

---

## 🟩 FAZA 2 — Receptia fizica a marfii

🎯 **Obiectiv:** Operatorul verifica marfa si completeaza datele lipsa.

### Functionalitati & Status:
- ✅ UI receptie multi-step (`ReceptieMarfaPage.tsx`): Date → Locatie Sugerata → Confirmat
- ✅ Cantitate receptionata, lot, unitate de masura, observatii
- ✅ Creare batch/lot la confirmare
- ✅ `ReceptieNIRPage.tsx` — generare NIR dintr-un PO selectat
- ✅ Schema DB `goods_receipts` + `goods_receipt_lines` (migration 030)
- ✅ Numerotare NIR format NK{YY}_{SEQ}
- 🔄 Link direct PO → Receptie NIR (navigare automata cu date pre-completate) **(ETAPA URMATOARE)**
- 🔄 Validare diferente (lipsa / supralivrare) — partial, nefinalizat
- ❌ Status PO actualizat automat la confirmare NIR → „Receptionata" **(ETAPA URMATOARE)**
- ❌ Vizualizare receptii multiple pentru acelasi PO (receptie partiala)

📌 **Dependente:** UI receptie, validari business

---

## 🟨 FAZA 3 — Generarea codurilor QR pentru produse / ambalaje

🎯 **Obiectiv:** Fiecare produs receptionat sa aiba identitate unica in depozit.

### Functionalitati & Status:
- ✅ Generare QR batch/lot in `ReceptieMarfaPage.tsx` (via Google Charts API)
- ✅ `QRLocationsPage.tsx` — QR pentru locatii depozit
- ✅ Format QR: JSON cu tip, batch, SKU, furnizor, cantitate, unitate
- ❌ Template etichete pentru print (ZPL / PDF)
- ❌ Print automat la confirmare receptie
- ❌ QR dedicat per ambalaj (tambur/bobina individuala)

📌 **Dependente:** Motor QR (exista), template etichete (lipsa)

---

## 🟧 FAZA 4 — Sarcini de depozitare (Putaway)

🎯 **Obiectiv:** Operatorul stie exact unde sa duca marfa.

### 4A — Putaway automat (WMS decide locatia):
- ✅ Algoritm sugestie locatie in `ReceptieMarfaPage.tsx` (API `/suggest/putaway`)
- ✅ Top 5 locatii sugerate cu scor
- ❌ Pagina dedicata „Sarcini Putaway" cu lista activa **(ETAPA URMATOARE)**
- ❌ Sarcini atribuite per operator
- ❌ Creare automata sarcini putaway la confirmarea receptiei

### 4B — Putaway manual (operatorul decide):
- ✅ Selectare manuala locatie in `ReceptieMarfaPage.tsx`
- ❌ Scenarii speciale: locatie temporara, carantina, livrare imediata **(ETAPA URMATOARE partial)**
- ❌ Validare compatibilitate produs-locatie

📌 **Dependente:** Structura locatii (exista), reguli de alocare (partial)

---

## ✅ FAZA 5 — Confirmarea depozitarii (scanare produs + locatie)

🎯 **Obiectiv:** Trasabilitate 100% si eliminarea erorilor.

### Functionalitati & Status:
- ✅ `ScanPage.tsx` — scanner general functional
- ✅ `scanner-service` — procesare scan, validare, istoric, statistici
- ✅ Mod PUTAWAY in ScanPage — `PutawayMode` component (stepper 3 pasi)
- ✅ Scan QR produs → identificare batch (`GET /batches/by-number/:batchNumber`)
- ✅ Scan QR locatie → validare locatie (`GET /locations/by-code/:code`)
- ✅ Confirmare putaway → `PUT /batches/:id {location_id}` + contor sesiune

📌 **Dependente:** Pagina Putaway Tasks (Faza 4) ← ✅ REALIZATA

---

## 🟪 FAZA 6 — Finalizarea receptiei si trimiterea datelor in ERP

🎯 **Obiectiv:** ERP-ul sa aiba stocul contabil corect.

### Functionalitati & Status:
- ✅ `ReceptieNIRPage.tsx` — generare si confirmare NIR
- ✅ NIR pre-completat din PO (furnizor, linii, preturi)
- ✅ Schema DB `goods_receipts` cu referinta la `supplier_orders`
- ✅ Tipuri gestiuni (VZCB_CMP, AMB_CMP, PROD_CMP, SCULE)
- 🔄 Status PO nu se actualizeaza automat la confirmare NIR **(ETAPA URMATOARE)**
- ❌ Trimitere automata date in Pluriva (`erp-connector/src/` gol)
- ❌ Export NIR PDF

📌 **Dependente:** ERP connector (neimplementat), status PO sync

---

## 🟧 FAZA 7 — Exceptii si scenarii speciale (partial ✅)

🎯 **Obiectiv:** Acoperirea tuturor situatiilor din realitate.

### Functionalitati & Status:
- ✅ Indicator diferență cantitate per linie NIR (supralivrare/lipsă cu chip colorat)
- ✅ Marfă deteriorată — toggle WarningAmber per linie, note automate DETERIORAT, chip CARANTINA în putaway
- ✅ Supralivrare — vizibil în NIR (chip `+X%`, colorare rând portocaliu)
- ✅ Lipsă — vizibil în NIR (chip `-X%`, colorare rând galben)
- ❌ Marfă livrată imediat → locație temporară
- ❌ Flux aprobare manager pentru supralivrare
- ❌ Notificare furnizor automată pentru lipsă
- ❌ Locație plină → redirect operator la altă locație

📌 **Dependențe:** notifications-service (pentru notificări automate)

---

## ✅ FAZA 8 — Dashboard + Raportari

🎯 **Obiectiv:** Vizibilitate completa asupra fluxului de receptie.

### Functionalitati & Status:
- ✅ `DashboardPage.tsx` — rescris cu date reale (fetch live din API)
- ✅ `ReportsPage.tsx` — rapoarte generale
- ✅ Widget: Recepții în curs (PO cu status RECEIVING) + contor live
- ✅ Widget: Sarcini putaway active / nefinalizate (count + listă preview)
- ✅ Widget: Begări Furnizor Active (CONFIRMED + RECEIVING)
- ✅ Tabel comenzi recente cu buton NIR rapid
- ❌ Widget: Locații ocupate / libere %
- ❌ Timp mediu de recepție (de la PO confirmed → NIR confirmed)
- ❌ Raport erori / diferențe de cantitate

📌 **Dependențe:** Date din Faza 4 si 5 ← ✅ REALIZATE

---

## 🧠 Flux complet — legatura dintre faze

```
[ERP/Manual] → PO Creat (FAZA 1)
      ↓
[Buton Start Receptie] → NIR pre-completat (FAZA 2)  ← ETAPA URMATOARE
      ↓
[Confirmare NIR] → Generare QR batches (FAZA 3) + Status PO = RECEIVED
      ↓
[Creare automata sarcini Putaway] (FAZA 4)            ← ETAPA URMATOARE
      ↓
[Operator: Scan QR produs + Scan QR locatie] (FAZA 5) ← ETAPA URMATOARE
      ↓
[Confirmare depozitare] → Stoc actualizat in WMS
      ↓
[Trimitere NIR in ERP] (FAZA 6)                       ← Partial existent
```

---

## 🚀 ETAPA URMATOARE — Plan Activ (13 Martie 2026)

### Prioritate 1 — Link PO → NIR (FAZA 1 + 2 + 6) — ✅ REALIZAT
- [x] ✅ Buton „📋 Start Receptie / NIR" in `ComenziFurnizorPage.tsx` (exista deja + navigare)
- [x] ✅ Navigare la `/receptie-nir?po=<id>` cu date pre-completate automat
- [x] ✅ `ReceptieNIRPage.tsx`: citire `?po` din URL si auto-populare furnizor + linii
- [x] ✅ La confirmare NIR → auto-confirm → creeaza batches → actualizeaza PO status → `RECEIVED`

### Prioritate 2 — PutawayTasksPage (FAZA 4) — ✅ REALIZAT
- [x] ✅ Creare `PutawayTasksPage.tsx` — lista sarcini putaway active
- [x] ✅ Endpoint backend: `GET /batches/pending-putaway` — batch-uri fara locatie din NIR-uri confirmate
- [x] ✅ Asignare locatie manuala sau din sugestii WMS (`/suggest/putaway`)
- [x] ✅ Tipuri destinatie: NORMAL / TEMP / CARANTINA
- [x] ✅ Ruta `/putaway-tasks` + element meniu „Putaway Tasks" in sidebar
- [x] ✅ Buton „Sarcini Putaway" in ecranul de succes al NIR

### Prioritate 3 — Confirmare scanare putaway (FAZA 5) — ✅ REALIZAT
- [x] ✅ Mod PUTAWAY in `ScanPage.tsx` — `PutawayMode` component cu stepper 3 pasi
- [x] ✅ Scan QR batch → `GET /batches/by-number/:batchNumber` — card cu info produs/NIR/furnizor
- [x] ✅ Scan QR locatie → `GET /locations/by-code/:code` — validare + afisare detalii locatie
- [x] ✅ Confirmare → `PUT /batches/:id` cu `location_id` → succes cu contor sesiune
- [x] ✅ Backend: `getByBatchNumber`, `getLocationByCode`, rute `/by-number/`, `/by-code/`
- [x] ✅ Validare QR: detectie automata tip batch vs locatie, erori clare pentru QR gresit tip

### Prioritate 4 — Excepții de bază (FAZA 7 partial) — ✅ REALIZAT
- [x] ✅ Indicator diferență cantitate per linie NIR (chip `+X%` supralivrare / `-X%` lipsă sub câmpul cant. recepționată)
- [x] ✅ Colorare rând: roz = deteriorat, portocaliu = supralivrare, galben = lipsă
- [x] ✅ Buton ⚠️ per linie → marchează marfă deteriorată → note automate `ANOMALII: L1:DETERIORAT`
- [x] ✅ Alert sumar sub tabel NIR (dacă există abateri sau deteriorări)
- [x] ✅ Note automate în NIR: `ANOMALII: L1:DETERIORAT; L2:SUPRALIVR+15%; L3:LIPSA-10%`
- [x] ✅ Selecție CARANTINA la putaway disponibilă în PutawayTasksPage (chip tip CARANTINA)

### Prioritate 5 — Dashboard recepție widgets (FAZA 8) — ✅ REALIZAT
- [x] ✅ `DashboardPage.tsx` rescris cu date reale din API (fetch live)
- [x] ✅ Widget: PO în Recepție Activă (status RECEIVING) — click → Comenzi Furnizor
- [x] ✅ Widget: Putaway Pending (count batch-uri fără locație) — click → Putaway Tasks
- [x] ✅ Widget: Comenzi Furnizor Active (CONFIRMED + RECEIVING count)
- [x] ✅ Widget: Scanare WMS → link rapid la pagina Scan mod PUTAWAY
- [x] ✅ Tabel Comenzi Furnizor Recente cu status chips + buton NIR rapid
- [x] ✅ Panou Putaway Pending cu lista lot-uri + indicator `fără locație`
