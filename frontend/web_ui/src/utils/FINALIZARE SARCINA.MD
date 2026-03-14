1. FLUX INTRARE MARFĂ (RECEPȚIE → STOCARE → COD QR)
🔹 1.1. Recepția
Preiei comanda din ERP (PO)

Verifici fizic produsele

Completezi date lipsă (lot, lungimi, capete, greutate, observații)

Confirmi recepția

🔹 1.2. Generarea codurilor QR
Pentru fiecare produs recepționat:

Cod QR produs

Cod QR ambalaj

Cod QR locație (depozit)

Aici se creează identitatea produsului în WMS.

🔹 1.3. Depozitarea (Putaway)
Ai două moduri, exact cum vrei:

🅰️ Automat
WMS îți spune unde să duci produsul.

🅱️ Manual
Operatorul alege altă locație dacă:

zona este ocupată

produsul urmează să fie livrat imediat

produsul trebuie pus temporar

🔹 1.4. Crearea stocului
După depozitare, produsul are:

cod unic

locație

proprietăți (greutate, lungime, capete, lot, UM)

ambalaj asociat

Aici se formează stocul real, granular, pe unități fizice.

🟩 2. FLUX IEȘIRE MARFĂ (VÂNZARE → PICKING → LIVRARE)
🔹 2.1. Comanda clientului
ERP trimite automat în WMS:

produsele cerute

cantitățile

lungimile

observațiile (ex: tăieri)

🔹 2.2. Nota de culegere (Picking Note)
Aici apare:

produsul

locația din care îl iei

ce trebuie să faci cu el:

livrare directă

prelucrare (tăiere)

🔹 2.3. Sarcina de lucru
WMS generează sarcina:

lucrător asignat

traseu optim

instrucțiuni (taie, ia, mută)

Lucrătorul acceptă sarcina pe scanner.

🔹 2.4. Pregătirea mărfii
Operatorul:

scanează locația

scanează produsul

taie dacă este necesar

marchează cantitatea culeasă

🔸 Dacă rămâne din produsul inițial:
WMS generează automat un nou produs cu:

noua lungime

noul capăt

noul lot (dacă se schimbă)

noua greutate

noul cod QR

Acesta este dus înapoi în depozit, într-o locație stabilită automat sau manual.

🔹 2.5. Mutarea în zona de livrare
După ce sarcina este finalizată:

produsele sunt mutate în zona de expediere

WMS verifică:

cantități

loturi

greutăți

coerența cu nota de culegere

Status comandă: READY_FOR_LOADING

🔹 2.6. Verificare finală în zona de livrare
Operatorul verifică:

toate produsele sunt prezente

toate codurile QR sunt valide

totul este pregătit pentru încărcare

🔹 2.7. Încărcarea
Șoferul sau operatorul:

scanează comanda

scanează fiecare produs

scanează mașina / cursa

Status comandă: LOADED

🔹 2.8. Livrarea
La client:

șoferul confirmă livrarea

poate adăuga semnătură, poză, observații

Status comandă: DELIVERED AICI CAND SOFERUL RIDICA INDEIFERENT CINE ESTE PRIMESTE DOCUMENTELE DE LA FACTURARE AVIZ ETC IAR CEI DE LA FACTURARE INCHID COMANDA

---

# 📋 PLAN DEZVOLTARE WMS NK — TRACKING PROGRES

## ✅ FINALIZAT

| # | Modul | Pagină / Controller | Status |
|---|---|---|---|
| 1.1 | Recepție PO din ERP | `ComenziFurnizorPage` + `purchaseOrderController` | ✅ DONE |
| 1.2 | NIR + verificare fizică | `ReceptieMarfaPage` + `ReceptieNIRPage` + `receptieController` | ✅ DONE |
| 1.3 | Putaway auto/manual | `PutawayTasksPage` + `warehouseController` | ✅ DONE |
| 1.4 | Stoc granular (loturi, batches) | `ProductsPage` + `BatchesPage` + `inventoryController` | ✅ DONE |
| 2.1 | Comenzi client din ERP | `OrdersPage` + `ordersController` | ✅ DONE |
| 2.2 | Notă culegere + import PDF | `PickNotesPage` + `pickNotesController` | ✅ DONE |
| 2.3 | Picking job + scanner | `PickJobsPage` + `ScanPage` + `pickingController` | ✅ DONE |

---

## 🔴 DE DEZVOLTAT (în ordine)

### SPRINT 1 — Tăiere + rest produs nou (2.4)
**Prioritate: MAXIMĂ** — fără asta fluxul picking se rupe

Când operatorul taie rolă/cablu în picking:
- câmpul "cantitate tăiată" din picking item
- dacă `ramane = lungime_initiala - cantitate_taiata > 0`:
  - WMS creează automat un nou lot în stoc cu proprietățile noi
  - generează cod QR nou pentru restul
  - propune locație de depunere (auto sau manual)
  - marchează produsul original ca CONSUMED

**Fișiere de creat/modificat:**
- [ ] `DB migration 033` — câmp `cut_quantity`, `remainder_lot_id` în `picking_job_items`
- [ ] `pickingController.js` — endpoint `POST /pick-jobs/:id/items/:itemId/cut`
- [ ] `PickJobsPage.tsx` / `ScanPage.tsx` — dialog tăiere cu input cantitate + preview rest
- [ ] Logic creare lot nou în stoc după tăiere

---

### SPRINT 2 — Mutare în zona de livrare + READY_FOR_LOADING (2.5)
**Prioritate: MARE**

După finalizare picking job:
- buton "Mută în zona expediere" pe picking job COMPLETED
- WMS validează că toate cantitățile sunt OK
- status comandă → `READY_FOR_LOADING`
- inventarul se mută logic din locația curentă în zona de expediere

**Fișiere de creat/modificat:**
- [ ] `DB migration 034` — status `READY_FOR_LOADING` pe `sales_orders`
- [ ] `pickingController.js` — endpoint `POST /pick-jobs/:id/move-to-shipping`
- [ ] `PickJobsPage.tsx` — buton + dialog confirmare mutare
- [ ] `ShipmentsPage.tsx` — afișare comenzi READY_FOR_LOADING

---

### SPRINT 3 — Verificare finală + Încărcare LOADED (2.6 + 2.7)
**Prioritate: MARE**

Pagină dedicată zona expediere:
- lista produse de expediat per comandă
- scanare QR fiecare produs din lista
- scanare mașină/cursă
- status → `LOADED`

**Fișiere de creat/modificat:**
- [ ] `DB migration 035` — câmp `vehicle_id`, `loaded_at`, `loaded_by` pe `sales_orders`
- [ ] `ExpediereVerificareController.js` (nou)
- [ ] `ExpediereVerificarePage.tsx` (pagină nouă)
- [ ] Rută nouă în `App.tsx` + `Layout.tsx`

---

### SPRINT 4 — Livrare + confirmare șofer (2.8)
**Prioritate: MEDIE**

Pagina șoferului (simplă, mobile-friendly):
- vede comanda sa
- confirmă livrarea
- poate adăuga observații
- status → `DELIVERED`
- notificare automată facturare

**Fișiere de creat/modificat:**
- [ ] `DB migration 036` — `delivered_at`, `driver_notes`, `delivery_photo_url`
- [ ] `LivrareController.js` (nou)
- [ ] `LivrarePage.tsx` (pagină nouă, mobile-first)
- [ ] Webhook/notificare pentru facturare la DELIVERED

---

### SPRINT 5 — QR produs + ambalaj complet (1.2)
**Prioritate: MEDIE**

`QRLocationsPage` există doar pentru locații. Trebuie extins:
- QR per lot/batch (scanabil pe product unit)
- QR per ambalaj (tob/rolă)
- Printare etichete PDF (A4 sau label printer)

**Fișiere de creat/modificat:**
- [ ] `QRLocationsPage.tsx` — tab nou "Produse & Loturi"
- [ ] `pickingController.js` — extindere labels PDF pentru loturi
- [ ] Etichetă = SKU + lot + locație + QR + greutate + lungime