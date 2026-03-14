# FLUX COMENZI CLIENTI — Plan de Dezvoltare WMS
> Ultima actualizare: 13 Martie 2026 | Legend: ✅ Gata | 🔄 Parțial | ❌ Neimplementat

---

## FAZA 1 — Preluarea comenzilor (Import + ERP)
**Obiectiv:** Comenzile clienților intră în WMS automat sau manual, fără erori.

| # | Funcționalitate | Status | Detalii |
|---|---|---|---|
| 1.1 | Import CSV comenzi client | ✅ | `OrdersPage` → `OrderImportDialog` → `POST /orders/import-csv` |
| 1.2 | Listare și paginare comenzi | ✅ | `GET /orders` cu paginare |
| 1.3 | Vizualizare detalii comandă | ✅ | `OrderDetailsDialog` cu linii produse |
| 1.4 | Câmp `delivery_date` pe comandă | ❌ | **[SPRINT 1]** Migration + UI necesar |
| 1.5 | Câmp `priority` (NORMAL/HIGH/URGENT) | ❌ | **[SPRINT 1]** Migration + UI necesar |
| 1.6 | Câmp `erp_ref` (referință ERP extern) | ❌ | **[SPRINT 1]** Migration necesar |
| 1.7 | Filtrare comenzi după status / prioritate | ❌ | **[SPRINT 2+3]** Backend + UI necesar |
| 1.8 | Sync ERP (URL configurabil) | ❌ | **[SPRINT 3]** Backend + UI necesar |
| 1.9 | Validare stoc disponibil la import | ❌ | Opțional faza viitoare |

---

## FAZA 2 — Picking Order (Comandă Internă de Pregătire)
**Obiectiv:** Fiecare comandă client generează un job de picking cu prioritate și traseu.

| # | Funcționalitate | Status | Detalii |
|---|---|---|---|
| 2.1 | Generare automată job picking dintr-o comandă | ✅ | `POST /orders/:id/allocate` |
| 2.2 | Statusuri: NEW → ACCEPTED → PICKING → COMPLETED | ✅ | `picking_jobs.status` |
| 2.3 | Picking engine (selecție batch FIFO/FEFO/lot) | ✅ | `warehouse-config` engine integrat |
| 2.4 | Afișare prioritate comandă pe job | ❌ | **[SPRINT 3]** Necesită câmp `priority` |
| 2.5 | Sortare joburi după termen livrare | ❌ | **[SPRINT 3]** `delivery_date` necesar |
| 2.6 | Indicator „URGENT" / „ÎNTÂRZIAT" pe job | ❌ | **[SPRINT 3]** Logică dată + priority |
| 2.7 | Bon picking PDF | ✅ | `GET /orders/:id/pick-note.pdf` |

---

## FAZA 3 — Repartizarea comenzilor către lucrători
**Obiectiv:** Lucrătorul potrivit primește jobul potrivit.

| # | Funcționalitate | Status | Detalii |
|---|---|---|---|
| 3.1 | Lucrătorul acceptă jobul (auto-assign la sine) | ✅ | `POST /pick-jobs/:id/accept` |
| 3.2 | Accept/Release per item (multi-picker) | ✅ | `/items/:itemId/accept`, `/release` |
| 3.3 | Filtrare joburi proprii pe scanner | ✅ | `GET /pick-items?mine=1` |
| 3.4 | Reasignare manuală supervisor | ❌ | **[SPRINT 4]** `POST /pick-jobs/:id/reassign` + UI |
| 3.5 | Notificare scanner la job nou | ❌ | Viitor — push/polling |

---

## FAZA 4 — Traseu optim în depozit *(opțional)*
**Obiectiv:** Lucrătorul parcurge depozitul în ordinea optimă.

| # | Funcționalitate | Status | Detalii |
|---|---|---|---|
| 4.1 | Ordonare locații în job (A→Z pe raft) | ❌ | Backend sort by location code |
| 4.2 | Grupare produse pe zone | ❌ | Necesită zone configurate |
| 4.3 | Afișare traseu pe scanner | ❌ | UI mobil |

---

## FAZA 5 — Picking pe scanner mobil
**Obiectiv:** Lucrătorul știe exact ce să ia, de unde și în ce cantitate.

| # | Funcționalitate | Status | Detalii |
|---|---|---|---|
| 5.1 | Listare iteme de picking pe scanner | ✅ | `ScanPage` + `/pick-items?mine=1` |
| 5.2 | Confirmare cantitate culeasă | ✅ | `POST /pick-jobs/:id/pick` |
| 5.3 | Afișare produs + locație + cantitate | ✅ | `PickJobDetailsDialog` |
| 5.4 | Etichete QR job (`labels.pdf`) | ✅ | `GET /pick-jobs/:id/labels.pdf` |
| 5.5 | Etichete rezervări (`labels-reserved.pdf`) | ✅ | `GET /pick-jobs/:id/labels-reserved.pdf` |
| 5.6 | Validare produs scanat vs. produs așteptat | ❌ | Logică validare SKU |
| 5.7 | Avertizare cantitate insuficientă (la pick) | ❌ | Check stoc la confirmare |

---

## FAZA 6 — Finalizare + documente
**Obiectiv:** Comanda e gata de livrare, documentele generate.

| # | Funcționalitate | Status | Detalii |
|---|---|---|---|
| 6.1 | Finalizare job picking | ✅ | `POST /pick-jobs/:id/complete` |
| 6.2 | Bon picking PDF | ✅ | `orders/:id/pick-note.pdf` |
| 6.3 | Etichete colete (separate de etichete picking) | ❌ | Endpoint + template PDF |
| 6.4 | Actualizare status comandă → PACKED după complete | ❌ | Trigger în `completeJob` controller |

---

## FAZA 7 — Sincronizare cu ERP (facturare + livrare)
**Obiectiv:** ERP-ul știe că marfa e pregătită și poate factura.

| # | Funcționalitate | Status | Detalii |
|---|---|---|---|
| 7.1 | Pagina Expedieri (Shipments) | ✅ | `ShipmentsPage` cu statusuri |
| 7.2 | Actualizare status ERP după picking | ❌ | Webhook / API push |
| 7.3 | Trimitere loturi / lungimi reale la ERP | ❌ | Payload detaliat |
| 7.4 | Trigger facturare automat | ❌ | Depinde de ERP extern |

---

## FAZA 8 — Dashboard și monitorizare
**Obiectiv:** Supervizorul vede tot ce se întâmplă în depozit în timp real.

| # | Funcționalitate | Status | Detalii |
|---|---|---|---|
| 8.1 | Widget PO Active (comenzi furnizori) | ✅ | `DashboardPage` |
| 8.2 | Widget Putaway Pending | ✅ | `DashboardPage` |
| 8.3 | Widget Comenzi client active | ✅ | `DashboardPage` (count) |
| 8.4 | Widget Comenzi Întârziate clienți | ❌ | **[SPRINT 5]** Filtrare după `delivery_date` |
| 8.5 | Panel lucrători activi cu job în curs | ❌ | Join picking_jobs + user |
| 8.6 | Timp mediu picking per job | ❌ | `started_at` / `completed_at` |

---

## PROGRESS SESIUNEA CURENTĂ

### Sprint 1 — Baza de date (Faza 1.4, 1.5, 1.6)
- [ ] Migration SQL: `ALTER TABLE sales_orders ADD delivery_date, priority, erp_ref`

### Sprint 2 — Backend API (Faza 1.7, 3.4)  
- [ ] `listOrders`: filtrare `?status=&priority=&overdue=true`
- [ ] `POST /pick-jobs/:id/reassign` — endpoint reasignare supervisor

### Sprint 3 — Frontend OrdersPage (Faza 1.7, 2.4–2.6)
- [ ] Chip prioritate (URGENT=roșu, HIGH=portocaliu, NORMAL=gri)
- [ ] Coloană `Termen Livrare` cu indicator roșu dacă e depășit
- [ ] Filtre: Status + Prioritate în header
- [ ] Buton „Sync ERP" (URL configurabil în localStorage)

### Sprint 4 — Frontend PickJobsPage (Faza 3.4)
- [ ] Dialog reasignare lucrător pe job (supervisor only)

### Sprint 5 — Dashboard (Faza 8.4)
- [ ] Widget „Comenzi Întârziate" cu count + preview list

---
*Plan generat automat de GitHub Copilot pe baza codebazei existente.*