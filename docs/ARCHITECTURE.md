# WMS NK — Arhitectură Completă

> **Warehouse Management System** pentru industria textilă și cabluri — NKS  
> Stack: Node.js microservices · PostgreSQL · Redis · RabbitMQ · React · React Native · Kong

---

## Cuprins

1. [Viziune de ansamblu](#1-viziune-de-ansamblu)
2. [Stivă tehnologică](#2-stivă-tehnologică)
3. [Arhitectura serviciilor](#3-arhitectura-serviciilor)
4. [Fluxul de date principal](#4-fluxul-de-date-principal)
5. [Infrastructură și monitorizare](#5-infrastructură-și-monitorizare)
6. [API Gateway (Kong)](#6-api-gateway-kong)
7. [Frontend Web](#7-frontend-web)
8. [Aplicație Mobilă](#8-aplicație-mobilă)
9. [Baza de date](#9-baza-de-date)
10. [Porturi și rețea](#10-porturi-și-rețea)
11. [Structura proiectului](#11-structura-proiectului)
12. [Ghid de dezvoltare](#12-ghid-de-dezvoltare)

---

## 1. Viziune de ansamblu

WMS NK este un sistem de management al depozitului construit pe o arhitectură **microservicii** cu comunicare asincronă prin **RabbitMQ** și comunicare sincronă prin REST/HTTP. Sistemul acoperă întreg ciclul de viață al mărfii:

```
Recepție → Putaway → Stoc → Picking → Tăiere → Cusut → QC → Expediere
```

Integrarea cu ERP-ul **Pluriva** asigură sincronizarea bidirecțională a produselor, comenzilor și stocului.

### Caracteristici principale
- **Scanare QR/bare-code** în toate operațiunile (web + dispozitive mobile)
- **Urmărire loturi** (batch tracking) pe toată lanțul de producție
- **Rule engine dinamic** pentru strategii de picking și putaway
- **Notificări real-time** prin WebSocket (Socket.io)
- **Transformări produs** (ex: tambure → lungimi de cablu)
- **Import bulk** CSV/Excel pentru produse și comenzi
- **Rapoarte** și **KPI** integrate în dashboard

---

## 2. Stivă tehnologică

| Nivel | Tehnologie | Versiune |
|-------|-----------|---------|
| **Runtime servicii** | Node.js | LTS |
| **Framework HTTP** | Express.js | 4.x |
| **Bază de date** | PostgreSQL | 15 (Alpine) |
| **Cache / Sesiuni** | Redis | 7 (Alpine) |
| **Message queue** | RabbitMQ | 3.12 |
| **API Gateway** | Kong | 3.8 |
| **Kong UI** | Konga | latest |
| **Frontend** | React + TypeScript | 19 + 5 |
| **UI components** | Material UI | 7 |
| **Bundler** | Vite | 6 |
| **Mobile** | React Native (Expo) | ~51 |
| **Monitorizare** | Prometheus + Grafana | latest |
| **Logging** | Loki + Promtail | latest |
| **Containerizare** | Docker + Docker Compose | 3.9 |

---

## 3. Arhitectura serviciilor

### 3.1 Hartă servicii

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│   Browser (React)          Mobile (React Native / Expo)         │
└──────────────┬──────────────────────────┬───────────────────────┘
               │ HTTP/REST                │ HTTP/REST
               ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    KONG API GATEWAY :8000                        │
│                 Rate limiting · Auth · Routing                   │
└──┬────────┬──────────┬──────────┬──────────┬────────┬───────────┘
   │        │          │          │          │        │
   ▼        ▼          ▼          ▼          ▼        ▼
 auth   inventory  scanner  warehouse   erp-   shipments
:3010    :3011      :3012   -config    conn.    :3016
                             :3020     :3018
   │        │          │          │          │        │
   └────────┴──────────┴──────────┴──────────┴────────┘
                            │
                     ┌──────┴──────┐
                     │  RabbitMQ   │
                     │   :5672     │
                     └──────┬──────┘
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
           cutting       sewing       notifications
           :3013         :3014          :3017
              │             │
              ▼             ▼
           qc-service   (→ shipments)
            :3015
```

### 3.2 Descrierea fiecărui serviciu

#### `auth` (port 3010)
**Responsabilitate:** Autentificare și autorizare centralizată.

| Fișier | Rol |
|--------|-----|
| `src/controllers/authController.js` | Login, refresh token, logout |
| `src/controllers/userController.js` | CRUD utilizatori |
| `src/routes/auth.js` | POST /login, /refresh, /logout |
| `src/routes/users.js` | GET/POST/PUT/DELETE /users |
| `src/middleware/auth.js` | Verificare JWT |
| `src/middleware/validation.js` | Validare Joi |

**Dependențe:** PostgreSQL (utilizatori), Redis (sesiuni/blacklist token-uri)  
**Securitate:** bcryptjs pentru parole, JWT cu refresh tokens, rate limiting, helmet

---

#### `inventory` (port 3011)
**Responsabilitate:** Serviciul central — gestionează toată logica de inventar.

| Modul | Controllere principale |
|-------|----------------------|
| Stoc | `inventoryController.js` — locuri, cantități, mișcări |
| Produse | `productController.js`, `productImportController.js` |
| Loturi | `batchController.js` — urmărire lot, FEFO/FIFO |
| Picking | `pickingController.js`, `pickNotesController.js` (PDF) |
| Recepție | `goodsReceiptController.js`, `receptieController.js` |
| Locații | `locationController.js` |
| Import | `importController.js` — CSV/Excel (multer + papaparse) |
| Comenzi | `ordersController.js`, `purchaseOrderController.js` |
| Cabluri | `stocCabluriController.js`, `drumTypesController.js` |
| Transform. | `transformationController.js` — tambure → lungimi |

**Dependențe:** PostgreSQL, Redis, RabbitMQ, auth-service  
**Biblioteci speciale:** PDFKit (note culegere), xlsx, multer, qrcode

---

#### `warehouse-config` (port 3020)
**Responsabilitate:** Configurarea și regulile de business ale depozitului.

| Modul | Descriere |
|-------|-----------|
| Zone/Locații | Configurare structură fizică depozit |
| Rule Engine | Reguli dinamice picking/putaway/cutting |
| Audit | Log complet operațiuni |
| Transportatori | Managementul carrier-ilor și vehiculelor |
| Ambalaje | Tipuri și configurații ambalaje |
| WebSocket | Notificări real-time (`wsNotifications.js`) |
| Swagger UI | Documentație API auto-generată (`/api-docs`) |

**Engines incluse:** `pickingEngine.js`, `putawayEngine.js`, `cuttingEngine.js`, `ruleEngine.js`  
**Dependențe:** PostgreSQL, Redis  
**Extra:** Suite completă teste Jest (9 fișiere)

---

#### `scanner-service` (port 3012)
**Responsabilitate:** Procesarea scanărilor de cod QR/bare-code.

Primește scanări de la dispozitive (mobile/PDA), identifică contextul operației (primire, picking, putaway, transfer) și publică event-uri în RabbitMQ. Confirmă operația în PostgreSQL.

---

#### `cutting-service` (port 3013)
**Responsabilitate:** Comenzi de tăiere (croitorie).

Urmărește materialul introdus la tăiat, consumul și resturile. Consumă event-uri de la inventory și publică în RabbitMQ pentru sewing-service.

---

#### `sewing-service` (port 3014)
**Responsabilitate:** Operațiuni de cusut.

Preia materialele tăiate de la cutting-service și înregistrează producția. Publică rezultatele pentru qc-service.

---

#### `quality-control-service` (port 3015)
**Responsabilitate:** Inspecții de calitate pe produsele finite.

Înregistrează defecte, aprobă/respinge loturi de producție. Consumă de la sewing-service, publică aprobările pentru shipments-service.

---

#### `shipments-service` (port 3016)
**Responsabilitate:** Gestionarea expedierii comenzilor.

Creare expeditii, alocare colete, generare documente de expeditie (PDF via PDFKit), tracking stare. Consumă aprobările QC și stocul din inventory.

---

#### `notifications-service` (port 3017)
**Responsabilitate:** Hub de notificări real-time.

Consumă mesaje din **toate** cozile RabbitMQ și le broadcastează prin **Socket.io** către clienții conectați (web + mobile). Nu are bază de date proprie — stateless.

---

#### `erp-connector` (port 3018)
**Responsabilitate:** Integrare cu ERP Pluriva.

| Componenta | Descriere |
|-----------|-----------|
| `plurivaClient.js` | Client HTTP pentru Pluriva REST API |
| `syncService.js` | Sincronizare periodică (default: 5 min) produse/comenzi/stoc |
| `syncController.js` | Endpoint `/sync` pentru triggering manual |
| `webhookController.js` | Primire webhooks de la Pluriva |

**Variabile de mediu critice:** `PLURIVA_API_URL`, `PLURIVA_API_KEY`, `SYNC_INTERVAL`

---

## 4. Fluxul de date principal

### 4.1 Recepție marfă
```
Furnizor → Livrare
    ↓
Recepție NIR (inventory: POST /receptie)
    ↓
Scanare coduri QR pe colete (scanner-service)
    ↓
RabbitMQ event: goods.received
    ↓
Putaway (warehouse-config: picking engine determină locația)
    ↓
Stoc actualizat în inventory
```

### 4.2 Picking și livrare
```
Comandă client (inventory: POST /orders)
    ↓
warehouse-config: rule engine → generare pick jobs
    ↓
Picking (inventory: POST /picking)
    ↓
Scanare confirmare locație (scanner-service)
    ↓
Notificare real-time (notifications-service → WebSocket)
    ↓
Generare notă de culegere PDF (inventory: GET /pick-notes/:id/pdf)
    ↓
Expediere (shipments-service: POST /shipments)
```

### 4.3 Producție (textile/cabluri)
```
Stoc materie primă
    ↓
Comandă tăiere (cutting-service)
    ↓ RabbitMQ: cutting.completed
Comandă cusut (sewing-service)
    ↓ RabbitMQ: sewing.completed
Inspecție QC (quality-control-service)
    ↓ RabbitMQ: qc.approved
Produse finite → stoc inventory
    ↓
Expediere (shipments-service)
```

### 4.4 Sincronizare ERP
```
Pluriva ERP ←→ erp-connector (sync la 5 min)
    ↓ RabbitMQ: erp.products.synced / erp.orders.synced
inventory-service (actualizare stoc și comenzi)
```

---

## 5. Infrastructură și monitorizare

### 5.1 Infrastructură de bază

| Serviciu | Container | Port | Rol |
|---------|-----------|------|-----|
| PostgreSQL 15 | wms-postgres | 5432 | Baza de date principală (toate serviciile) |
| Redis 7 | wms-redis | 6379 | Cache, sesiuni JWT, rate limiting |
| RabbitMQ 3.12 | wms-rabbitmq | 5672 / 15672 | Message broker inter-servicii |

### 5.2 Monitorizare

| Serviciu | Container | Port | Rol |
|---------|-----------|------|-----|
| Prometheus | wms-prometheus | 9090 | Colectare metrici |
| Grafana | wms-grafana | 3001 | Vizualizare dashboards |
| Loki | wms-loki | 3100 | Agregare log-uri |
| Promtail | wms-promtail | — | Shipper log-uri Docker → Loki |

**Metrici expuse:** Fiecare serviciu expune `/metrics` (endpoint Prometheus standard via `prom-client`).

**Grafana login:** admin / grafana_admin_2025

---

## 6. API Gateway (Kong)

Kong 3.8 acționează ca punct unic de intrare pentru toate serviciile backend.

| Port | Rol |
|------|-----|
| 8000 | Proxy HTTP (trafic public) |
| 8443 | Proxy HTTPS |
| 8001 | Admin API Kong |
| 8444 | Admin API HTTPS |
| 1337 | Konga UI (Kong Admin Interface) |

**Configurare:** `scripts/configure-kong.ps1`  
**Testare:** `scripts/test-kong.ps1`  
**Documentație:** `docs/kong-gateway.md`

---

## 7. Frontend Web

**Locație:** `frontend/web_ui/`  
**Port dev:** 5173 (Vite dev server)  
**Stack:** React 19 + TypeScript + Vite + Material UI 7

### 7.1 Structura src/

```
src/
├── App.tsx                  ← Router principal (React Router 7)
├── theme.ts                 ← Tema MUI customizată NKS
├── main.tsx                 ← Entry point
│
├── pages/ (40 pagini)       ← O pagină per funcționalitate WMS
├── components/ (16)         ← Componente reutilizabile (dialogs, guards)
├── services/ (19)           ← Axios API clients per serviciu backend
├── contexts/                ← AuthContext (Provider + Shared types)
├── hooks/                   ← useAuth, usePermissions, useWebSocket, useActivityLog
└── utils/                   ← Utilitare generale
```

### 7.2 Pagini principale

| Pagină | Rută | Serviciu backend |
|--------|------|-----------------|
| `LoginPage` | /login | auth |
| `DashboardPage` | / | inventory, warehouse-config |
| `ProductsPage` | /products | inventory |
| `InventoryMovementsPage` | /movements | inventory |
| `OrdersPage` | /orders | inventory |
| `PickJobsPage` | /pick-jobs | inventory |
| `PickNotesPage` | /pick-notes | inventory |
| `BatchesPage` | /batches | inventory |
| `CuttingOrdersPage` | /cutting | cutting-service |
| `SewingOrdersPage` | /sewing | sewing-service |
| `QCInspectionsPage` | /qc | quality-control-service |
| `ShipmentsPage` | /shipments | shipments-service |
| `ReceptieMarfaPage` | /receptie | inventory |
| `WarehouseConfigPage` | /warehouse | warehouse-config |
| `DynamicRulesPage` | /rules | warehouse-config |
| `ERPIntegrationPage` | /erp | erp-connector |
| `UsersPage` | /users | auth |
| `ReportsPage` / `StockReportsPage` | /reports | inventory |

### 7.3 Autentificare frontend

```
AuthContext.tsx (Provider)
    ↑ importă tipurile din
AuthContextShared.ts (createContext + interfețe)
    ↑ folosit de
useAuth.ts (hook pentru consum context)
    +
ProtectedRoute.tsx (redirect dacă neautentificat)
PermissionGuard.tsx (verificare rol)
```

---

## 8. Aplicație Mobilă

**Locație:** `mobile/`  
**Stack:** React Native + Expo ~51

### 8.1 Structura

```
mobile/src/
├── config/config.js          ← Base URL API (configurat per mediu)
├── context/AuthContext.js    ← Context autentificare JWT
├── navigation/AppNavigator.js ← Stack + Tab navigator
├── services/api.js           ← Axios cu interceptori JWT auto-refresh
└── screens/ (13 ecrane)
```

### 8.2 Ecrane mobile

| Ecran | Funcționalitate |
|-------|----------------|
| `LoginScreen` | Autentificare JWT |
| `HomeScreen` | Dashboard cu statistici rapide |
| `ScannerScreen` | Scanare QR/bare-code (expo-camera) |
| `ProductsScreen` | Lista și căutare produse |
| `ProductDetailsScreen` | Detalii produs + stoc per locație |
| `LocationsScreen` | Lista locații depozit |
| `LocationDetailsScreen` | Detalii + inventar locație |
| `MovementsScreen` | Istoricul mișcărilor de stoc |
| `ReceivingScreen` | Recepție marfă pe mobil |
| `PutawayScreen` | Alocare produs la locație |
| `PickJobsScreen` | Lista joburi picking active |
| `PickJobDetailsScreen` | Detalii + confirmare picking |
| `HistoryScreen` | Istoric operații utilizator |

---

## 9. Baza de date

### 9.1 Structura migrațiilor (`database/migrations/`)

Migrațiile sunt fișiere SQL numerotate secvențial. Conventia de numerotare: `NNN[a|b|c]_descriere.sql`.

| Index | Tabel/Operație |
|-------|---------------|
| 006a | `warehouse_configuration` v1 |
| 006b | `warehouse_configuration` v2 (actual) |
| 007 | `cutting_orders` |
| 008 | `sewing_orders` |
| 009 | `qc_inspections` |
| 010 | `product_units` |
| 011 | `product_batches` |
| 012 | `product_transformations` |
| 013 | `batch_selection_rules` |
| 014 | Adaugare batch tracking la cutting_orders |
| 015 | `inventory_items` (enhanced) |
| 015b | `location_types` |
| 015c | Date inițiale `location_types` |
| 016 | `lot_metadata` |
| 016b | Generare locații test |
| 016c | Generare locații test v2 |
| 017 | `sales_orders` |
| 018 | `picking_jobs` |
| 019 | Fix UUID defaults picking |
| 020 | Multi-picker per item |
| 021 | Extindere rule engine |
| 022 | Constrângeri locații |
| 023 | Reguli aplicate la picking |
| 024 | `rule_audit_log` |
| 025 | `rule_versions` |
| 025b | Generare locații cabluri QR |
| 026 | Strategie default zonă |
| 027 | Coordonate locații |
| 028 | `supplier_orders` |
| 029 | `drum_types` |
| 030 | `goods_receipts` |
| 031 | Prioritate livrare sales_orders |
| 032 | `pick_notes` |
| 033 | Câmpuri expediere în orders |
| 034 | `wms_ops_audit` |
| 035 | `user_operation_permissions` |
| 036 | `erp_integration` |

### 9.2 Aplicare migrații

Inițializarea bazei de date se face prin `docker/init-scripts/` (run la primul start PostgreSQL).  
Migrațiile sunt aplicate cu `node scripts/migrate.js` din `services/warehouse-config/`.

---

## 10. Porturi și rețea

Toată comunicarea inter-servicii se face pe rețeaua Docker `wms-nks-network`.

| Serviciu | Container | Port extern | Port intern |
|---------|-----------|-------------|-------------|
| **Infrastructura** | | | |
| PostgreSQL | wms-postgres | 5432 | 5432 |
| Redis | wms-redis | 6379 | 6379 |
| RabbitMQ AMQP | wms-rabbitmq | 5672 | 5672 |
| RabbitMQ UI | wms-rabbitmq | 15672 | 15672 |
| **Monitorizare** | | | |
| Prometheus | wms-prometheus | 9090 | 9090 |
| Grafana | wms-grafana | 3001 | 3000 |
| Loki | wms-loki | 3100 | 3100 |
| **API Gateway** | | | |
| Kong Proxy | wms-kong | 8000 | 8000 |
| Kong HTTPS | wms-kong | 8443 | 8443 |
| Kong Admin | wms-kong | 8001 | 8001 |
| Konga UI | wms-konga | 1337 | 1337 |
| **Servicii aplicație** | | | |
| auth-service | wms-auth | 3010 | 3000 |
| inventory-service | wms-inventory | 3011 | 3000 |
| scanner-service | wms-scanner | 3012 | 3000 |
| cutting-service | wms-cutting | 3013 | 3014 |
| sewing-service | wms-sewing | 3014 | 3014 |
| qc-service | wms-qc | 3015 | 3015 |
| shipments-service | wms-shipments | 3016 | 3016 |
| notifications-service | wms-notifications | 3017 | 3017 |
| erp-connector | wms-erp-connector | 3018 | 3000 |
| warehouse-config | wms-warehouse-config | 3020 | 3000 |
| **Frontend** | | | |
| web-ui (Vite dev) | wms-web-ui | 5173 | 5173 |

---

## 11. Structura proiectului

```
WMS NK/
├── README.md                    ← Punct de intrare principal
├── QUICK_START.md               ← Pornire rapidă sistem
├── QUICKSTART-MOBILE.md         ← Pornire aplicație mobilă
├── docker-compose.yml           ← Orchestrare Docker completă
├── Makefile                     ← Comenzi utilitare (make up/down/logs...)
├── .env.example                 ← Template variabile mediu
├── .gitignore
│
├── services/                    ← Microservicii backend
│   ├── auth/                    ← Autentificare JWT
│   ├── inventory/               ← Inventar central (serviciu principal)
│   ├── warehouse-config/        ← Configurare depozit + rule engine
│   ├── scanner-service/         ← Procesare scanări QR/barcode
│   ├── cutting-service/         ← Comenzi tăiere
│   ├── sewing-service/          ← Comenzi cusut
│   ├── quality-control-service/ ← Inspecții calitate
│   ├── shipments-service/       ← Expediții
│   ├── notifications-service/   ← Notificări real-time (WebSocket)
│   └── erp-connector/           ← Integrare Pluriva ERP
│
├── frontend/
│   └── web_ui/                  ← React 19 + TypeScript + MUI 7
│       └── src/
│           ├── pages/           ← 40 pagini (una per feature)
│           ├── components/      ← 16 componente reutilizabile
│           ├── services/        ← 19 Axios API clients
│           ├── contexts/        ← AuthContext
│           └── hooks/           ← useAuth, usePermissions, useWebSocket
│
├── mobile/                      ← React Native + Expo ~51
│   └── src/
│       ├── screens/             ← 13 ecrane mobile
│       ├── navigation/          ← Stack/Tab navigator
│       ├── services/            ← Axios cu JWT interceptors
│       └── context/             ← AuthContext mobil
│
├── database/
│   └── migrations/              ← 36 fișiere SQL secvențiale (006a → 036)
│
├── docker/                      ← Config containere infrastructura
│   ├── init-scripts/            ← SQL inițializare PostgreSQL
│   ├── prometheus/              ← prometheus.yml
│   ├── grafana/                 ← Dashboards + datasources
│   ├── loki/                    ← Configurare Loki
│   └── promtail/                ← Configurare Promtail
│
├── kong/                        ← Scripturi configurare Kong
├── scripts/                     ← Scripturi utilitare (init, admin, kong)
├── docs/                        ← Documentație tehnică și de business
│   ├── ARCHITECTURE.md          ← (acest fișier)
│   ├── BATCH_WORKFLOW_AMBALAJE.md
│   ├── CSV_IMPORT_FIX.md
│   ├── EXCEL_TO_CSV_GUIDE.md
│   ├── FLUX_AUTOMATIZARE_RECEPTIE.md
│   ├── FLUX_COMENZI_CLIENTI.md
│   ├── IMPORT_SYSTEM_COMPLETE.md
│   ├── kong-gateway.md
│   ├── NIVEL_ENTERPRISE.md
│   ├── ORDER_IMPORT.md
│   ├── PRODUCT_IMPORT_IMPLEMENTATION.md
│   ├── PRODUCT_LOCATION_IMPLEMENTATION.md
│   ├── PRODUCT_LOCATION_WORKFLOW.md
│   ├── SMART_LOT_PARSING.md
│   └── WMS_SETUP_CONFIGURATION_SYSTEM.md
│
├── MODELE/                      ← Documente de business PDF (facturi, NIR, avize)
└── STOC PRODUSE/                ← Fișiere CSV cu date stoc inițial
```

---

## 12. Ghid de dezvoltare

### 12.1 Pornire sistem complet

```bash
# Copiere și configurare variabile mediu
cp .env.example .env
# Editare .env (DB, Redis, RabbitMQ, JWT, Pluriva API key)

# Pornire toate serviciile
docker-compose up -d

# Sau cu Makefile
make up
```

### 12.2 Comenzi Makefile utile

```bash
make up           # Pornire sistem
make down         # Oprire sistem
make logs         # Urmărire log-uri toate serviciile
make db-shell     # Deschide psql shell
make db-backup    # Backup baza de date
```

### 12.3 Pornire serviciu individual (development)

```bash
cd services/<serviciu>
cp .env.example .env
npm install
npm run dev   # sau: node src/index.js
```

### 12.4 Frontend development

```bash
cd frontend/web_ui
npm install
npm run dev   # Vite dev server pe port 5173
```

### 12.5 Aplicație mobilă

```bash
cd mobile
npm install
npx expo start   # QR code pentru Expo Go
```

Detalii complete în [QUICKSTART-MOBILE.md](../QUICKSTART-MOBILE.md).

### 12.6 Variabile de mediu critice

| Variabilă | Serviciu | Descriere |
|-----------|---------|-----------|
| `JWT_SECRET` | auth, warehouse-config | Secretul de semnare JWT — **schimbă în producție!** |
| `DB_PASSWORD` | toate | Parola PostgreSQL |
| `REDIS_PASSWORD` | toate | Parola Redis |
| `PLURIVA_API_KEY` | erp-connector | Cheia API Pluriva ERP |
| `PLURIVA_API_URL` | erp-connector | URL-ul API Pluriva |
| `SYNC_INTERVAL` | erp-connector | Interval sync ERP în ms (default: 300000 = 5 min) |

### 12.7 Teste

```bash
# Teste warehouse-config (Jest)
cd services/warehouse-config
npm test

# Test lot parser (inventory)
cd services/inventory
node test-lot-parser.js
```

---

*Document generat: 2026-03-15 | WMS NK — NKS*
