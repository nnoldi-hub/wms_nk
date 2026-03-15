# 🏭 WMS NK Smart Cables  
**Warehouse Management System pentru cabluri, echipamente electrice și accesorii**

WMS NK Smart Cables este un sistem enterprise complet pentru gestionarea depozitelor, optimizat pentru industria cablurilor și echipamentelor electrice.  
Include fluxuri end‑to‑end, reguli inteligente, hartă depozit, analitică avansată și integrare ERP.

---

## 📦 Caracteristici principale

### 🔹 1. Configurare Depozit
- Creare depozit
- Zone depozit (recepție, depozitare, expediere, exterior, carantină)
- Tipuri de locații (raft, palet, cutie, tambur, platformă)
- Generare locații în masă
- Codificare automată locații
- Etichete QR pentru locații

---

### 🔹 2. Reguli WMS (Motor inteligent)
- FIFO
- Preferă resturi înaintea tamburilor întregi
- Minimize Waste
- Location Proximity
- Preferă loturi parțiale
- Zone dedicate pentru tipuri de marfă
- Priorități configurabile

---

### 🔹 3. Hartă Depozit
- Vizualizare grafică a depozitului
- Editare locații
- Filtrare după zone, tipuri, ocupare
- Mod vizualizare / mod editare

---

### 🔹 4. Operațiuni Inbound
- Recepție PO din ERP
- NIR
- Verificare fizică
- Putaway automat / manual
- Stoc granular pe lot, tambur, rolă, rest

---

### 🔹 5. Operațiuni Outbound
- Comenzi clienți din ERP
- Note de culegere
- Picking job
- Tăiere cabluri + generare resturi
- Mutare în zona expediere
- Încărcare
- Livrare șofer

---

### 🔹 6. Analitică & Predicții
- Mișcări inventar
- Stoc & loturi
- Performanță operatori
- Predicții consum
- Forecast rotație produse

---

### 🔹 7. Integrare ERP
- Import PO
- Import comenzi clienți
- Export livrări
- Webhook-uri pentru facturare

---

## 🧱 Arhitectură Sistem

- **Frontend:** React + TypeScript  
- **Backend:** Node.js / Express  
- **DB:** PostgreSQL  
- **API:** REST  
- **Autentificare:** JWT  
- **QR:** generare PDF + coduri unice  

---

## 🚀 Roadmap Enterprise

### ✔ Faza 1 — Fundament WMS  
Finalizată: recepție, putaway, picking, tăiere, expediere, analitică.

### 🔜 Faza 2 — Motor inteligent  
Legătura reguli ↔ hartă, capacități locații.

### 🔜 Faza 3 — Configurator Enterprise  
Wizard pe nivele, validator configurare, template-uri depozit.

### 🔜 Faza 4 — Optimizare avansată  
Reguli dinamice, hartă inteligentă, simulator picking.

### 🔜 Faza 5 — Multi-depozit  
Transferuri, dashboard global.

### 🔜 Faza 6 — Audit & securitate  
Audit trail, permisiuni avansate.

### 🔜 Faza 7 — Integrare ERP completă  
Inbound + outbound + webhook-uri.

---

## 🧪 Testare

- Teste unitare (Jest)
- Teste API (Supertest)
- Teste E2E (Playwright)
- Teste de performanță (k6)

---


# 📁 Structura proiectului

/src
/api
/controllers
/services
/models
/routes
/utils
/config
/frontend
/components
/pages
/hooks
/context
/assets
/docs
README.md
roadmap.pdf
architecture.md