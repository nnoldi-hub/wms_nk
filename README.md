# WMS-NKS — Warehouse Management System

> **Enterprise-grade WMS** pentru gestiunea depozitelor de cablu și echipamente electrice, construit pe arhitectură microservicii cu React + Node.js + PostgreSQL.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## Cuprins

- [Prezentare generală](#prezentare-generală)
- [Funcționalități](#funcționalități)
- [Arhitectură](#arhitectură)
- [Quick Start](#quick-start)
- [Comenzi disponibile](#comenzi-disponibile)
- [URL-uri și porturi](#url-uri-și-porturi)
- [Stack tehnologic](#stack-tehnologic)
- [Structura proiectului](#structura-proiectului)
- [API Reference](#api-reference)
- [Credențiale implicite](#credențiale-implicite-dev)
- [Troubleshooting](#troubleshooting)

---

## Prezentare generală

WMS-NKS este un sistem de management al depozitului construit complet pe microservicii, destinat operațiunilor cu cabluri electrice, echipamente și materiale de sewing/croitorie industrială. Sistemul acoperă întregul flux: recepție marfă → putaway inteligent → picking → expediere, cu integrare ERP, trasabilitate completă pe loturi și audit trail detaliat.

**Stare curentă:** Faze 1–4, 6, 7 complet implementate. Faza 5 (multi-depozit) în roadmap.

---

## Funcționalități

### Faza 1 — Fundament WMS ✅
| Modul | Detalii |
|---|---|
| **Configurare depozit** | Depozite, zone, tipuri locații, generare locații bulk, coduri QR |
| **Inbound** | Recepție PO, NIR, putaway auto/manual, stoc granular (loturi, resturi, tamburi) |
| **Outbound** | Comenzi clienți, note culegere, picking job, tăiere cabluri, resturi automate |
| **Livrări** | Board Shipments (Pregătire / Încărcare / Livrate), UI șofer, etichete PDF |
| **Rapoarte v2** | Mișcări inventar, stoc & loturi, performanță KPI, predicții, audit log |

### Faza 2 — Motor inteligent WMS ✅
| Modul | Detalii |
|---|---|
| **Reguli WMS** | FIFO, Minimize Waste, Preferă resturi, Proximitate, Zone dedicate |
| **Audit reguli** | Versiuni reguli, simulare, detectare conflicte (`wms_rule_audit_log`) |
| **Hartă depozit** | Vizualizare interactivă, editare locații pe hartă, zone colorate |
| **Validare REGULI ↔ HARTĂ** | Badge OK/WARNING/ERROR per zonă (`RulesValidationPage`) |
| **Capacități locații** | Greutate, volum, categorii permise, restricții (`LocationCapacitiesPage`) |

### Faza 3 — Configurator Enterprise ✅
| Modul | Detalii |
|---|---|
| **Wizard configurare** | Stepper 7 pași: date generale → zone → tipuri locații → reguli → bulk generate → finalizare |
| **Validator configurare** | Scor 0-100, erori/avertismente/info, verificare compatibilitate reguli (`ConfigValidatorPage`) |
| **Template-uri depozit** | 4 template-uri predefinite (cabluri, echipamente, mixt, exterior) cu creare automată |

### Faza 4 — Optimizare avansată AI ✅
| Modul | Detalii |
|---|---|
| **Reguli dinamice** | Zone pline → fallback, tambur aproape gol, rotație mare → relocare, lot expirat → carantină |
| **Simulator** | Simulare putaway/picking step-by-step, comparare strategii FIFO vs MIN_WASTE |
| **Hartă inteligentă** | Heatmap ocupare, colorare per tip marfă, traseu picking animat |

### Faza 6 — Audit & Securitate ✅
| Modul | Detalii |
|---|---|
| **Audit trail complet** | Reguli, locații, marfă, configurație depozit → tabel `wms_ops_audit` |
| **Permisiuni avansate** | Matrice resource × acțiune per user, `PermissionGuard` UI component, `usePermissions` hook |
| **Notificări real-time** | WebSocket server, `NotificationBell` cu badge CRITICAL/WARNING, `StockAlertsPage` |
| **Log acțiuni UI** | `useActivityLog` hook + POST `/api/v1/audit/ui-event` + tab "Acțiuni UI" |

### Faza 7 — Integrare ERP Pluriva ✅
| Modul | Detalii |
|---|---|
| **Inbound sync** | Preluare PO din ERP, upsert `erp_po_mappings`, sincronizare loturi |
| **Outbound sync** | Trimitere NIR, confirmare livrări, facturare prin webhook |
| **Webhooks** | `PO_CONFIRMED`, `PO_CANCELLED`, `INVOICE_CREATED` cu HMAC-SHA256 |
| **Dashboard** | Status ERP, PO-uri, istoric joburi, webhook log (`/erp-integrare`) |

---

## Arhitectură

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / MOBILE                         │
│              React 18 + TypeScript + Material UI                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                    Kong API Gateway :8000                        │
│              Rate limiting · JWT auth · Routing                  │
└──┬───────┬────────┬───────┬────────┬────────┬────────┬──────────┘
   │       │        │       │        │        │        │
┌──▼──┐ ┌──▼──┐ ┌───▼──┐ ┌──▼──┐ ┌──▼───┐ ┌──▼──┐ ┌──▼────────┐
│Auth │ │Inv. │ │W-Cfg │ │Scnr │ │Ships │ │Rpts │ │ERP Conn.  │
│3010 │ │3011 │ │3020  │ │3012 │ │3016  │ │3018 │ │3019       │
└──┬──┘ └──┬──┘ └───┬──┘ └──┬──┘ └──┬───┘ └──┬──┘ └──┬────────┘
   │       │        │       │        │        │        │
┌──▼───────▼────────▼───────▼────────▼────────▼────────▼────────┐
│  PostgreSQL :5432  │  Redis :6379  │  RabbitMQ :5672           │
│  wms_nks DB        │  Cache/Sess.  │  Message Queue            │
└────────────────────┴───────────────┴───────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│         Monitoring: Prometheus :9090 · Grafana :3001           │
│         Logging:    Loki :3100 · Promtail                      │
└───────────────────────────────────────────────────────────────┘
```

### Microservicii

| Serviciu | Port | Responsabilitate |
|---|---|---|
| `auth` | 3010 | Autentificare JWT, utilizatori, permisiuni |
| `inventory-service` | 3011 | Stoc, loturi, locații, receptie, picking |
| `warehouse-config` | 3020 | Configurare depozit, reguli, audit ops, validare |
| `scanner-service` | 3012 | Scanare coduri de bare / QR |
| `cutting-service` | 3013 | Ordine tăiere cabluri |
| `sewing-service` | 3014 | Ordine de productie sewing |
| `quality-control-service` | 3015 | Inspecții QC |
| `shipments-service` | 3016 | Expedieri și livrări |
| `shipping-service` | 3017 | Documente și rute livrare |
| `reports-service` | 3018 | Rapoarte și analiză |
| `erp-connector` | 3019 | Integrare ERP Pluriva |
| `notifications-service` | 3021 | WebSocket, alerte real-time |
| `scheduler-service` | 3022 | Joburi periodice (cron) |

---

## Quick Start

### Cerințe

- Docker Desktop ≥ 24.x
- Docker Compose ≥ 2.x
- (Opțional pentru frontend dev) Node.js ≥ 20.x, npm ≥ 10.x

### Pornire cu Docker (mod producție / demo)

```bash
# 1. Clonează repository-ul
git clone https://github.com/nnoldi-hub/wms_nk.git
cd wms_nk

# 2. Inițializează proiectul (migrări DB, configurare Kong)
make init

# 3. Pornește toate serviciile
make up

# 4. Creează utilizatorul admin
make create-admin

# 5. Verifică starea serviciilor
make health
```

**Frontend web** se află la `http://localhost:5173` (dev) sau configurat prin Kong la `http://localhost:8000`.

### Pornire frontend în modul development

```bash
cd frontend/web_ui
npm install
npm run dev
# → http://localhost:5173
```

---

## Comenzi disponibile

### Docker / Servicii

```bash
make up              # Pornește toate containerele
make down            # Oprește toate containerele
make restart         # Restart complet
make ps              # Afișează containerele active
make logs            # Urmărește log-urile tuturor serviciilor
make logs-auth       # Log-uri auth service
make logs-inventory  # Log-uri inventory service
make health          # Verifică health check-urile
```

### Baza de date

```bash
make db-shell        # Conectare la PostgreSQL (psql)
make db-backup       # Backup complet
make db-restore      # Restaurare ultimul backup
make db-reset        # ⚠️ Reset complet DB (șterge date!)
```

### Monitorizare

```bash
make grafana         # Deschide Grafana
make prometheus      # Deschide Prometheus
make kong-ui         # Deschide Konga (Kong Admin UI)
make rabbitmq-ui     # Deschide RabbitMQ Management
```

### Testare API

```bash
make api-test-login  # Testează endpoint login
make api-test-health # Testează health endpoints
```

### Curățare

```bash
make clean           # Șterge containere + volume (⚠️ pierde date)
make clean-logs      # Șterge fișierele de log
```

---

## URL-uri și porturi

| Serviciu | URL | Credențiale |
|---|---|---|
| **Frontend Web** | http://localhost:5173 | admin / Admin123! |
| **Kong Proxy** | http://localhost:8000 | — |
| **Kong Admin API** | http://localhost:8001 | — |
| **Konga UI** | http://localhost:1337 | setup la prima rulare |
| **Grafana** | http://localhost:3001 | admin / grafana_admin_2025 |
| **Prometheus** | http://localhost:9090 | — |
| **RabbitMQ UI** | http://localhost:15672 | wms_queue / queue_pass_2025 |
| **PostgreSQL** | localhost:5432 | wms_admin / wms_secure_pass_2025 |
| **Redis** | localhost:6379 | redis_pass_2025 |

---

## Stack tehnologic

### Frontend
- **React 18** cu TypeScript strict
- **Material UI v6** (Grid2 API)
- **Vite** — bundler + dev server
- **Axios** — HTTP client
- **React Router v6** — routing cu protected routes
- **Hooks custom**: `usePermissions`, `useActivityLog`, `useWebSocket`

### Backend (per serviciu)
- **Node.js 20 + Express 4** — REST API
- **PostgreSQL 15** — baza de date principală
- **Redis 7** — cache, sesiuni, rate limiting
- **RabbitMQ 3.12** — message queue asincron
- **JWT** (access 15m + refresh 7d) — autentificare

### Infrastructură
- **Docker + Docker Compose** — containerizare
- **Kong 3.8** — API Gateway (routing, rate limiting, auth plugin)
- **Prometheus + Grafana** — metrici și dashboarduri
- **Loki + Promtail** — agregare log-uri

---

## Structura proiectului

```
wms-nks/
├── services/                        # Microservicii backend
│   ├── auth/                        # Auth & users (JWT, permisiuni)
│   ├── inventory-service/           # Stoc, loturi, picking, receptie
│   ├── warehouse-config/            # Config depozit, reguli WMS, audit
│   │   └── src/controllers/
│   │       ├── warehouseSettingsController.js
│   │       ├── locationController.js
│   │       ├── rulesController.js
│   │       ├── opsAuditController.js
│   │       ├── validationController.js
│   │       └── dynamicRulesController.js
│   ├── cutting-service/             # Ordine tăiere
│   ├── sewing-service/              # Ordine sewing
│   ├── quality-control-service/     # QC inspections
│   ├── shipments-service/           # Expedieri
│   ├── shipping-service/            # Livrări & documente
│   ├── reports-service/             # Rapoarte & analiză
│   ├── erp-connector/               # Integrare ERP Pluriva
│   ├── notifications-service/       # WebSocket & alerte
│   └── scheduler-service/           # Joburi cron
│
├── frontend/
│   └── web_ui/
│       └── src/
│           ├── pages/               # ~40 pagini React
│           │   ├── DashboardPage.tsx
│           │   ├── InventoryMovementsPage.tsx
│           │   ├── OrdersPage.tsx
│           │   ├── PickJobsPage.tsx
│           │   ├── ReceptieMarfaPage.tsx
│           │   ├── ShipmentsPage.tsx
│           │   ├── ActivityLogPage.tsx
│           │   ├── ConfigValidatorPage.tsx
│           │   ├── DynamicRulesPage.tsx
│           │   ├── SimulatorPage.tsx
│           │   ├── ERPIntegrationPage.tsx
│           │   ├── StockAlertsPage.tsx
│           │   └── ...
│           ├── components/          # Componente reutilizabile
│           │   ├── Layout.tsx       # Sidebar + AppBar
│           │   ├── PermissionGuard.tsx
│           │   ├── PermissionsDialog.tsx
│           │   └── NotificationBell.tsx
│           ├── hooks/               # Hook-uri custom
│           │   ├── usePermissions.ts
│           │   ├── useActivityLog.ts
│           │   └── useWebSocket.ts
│           └── services/
│               └── warehouseConfig.service.ts
│
├── database/
│   └── migrations/                  # 036+ migrări SQL secvențiale
│
├── docker/
│   ├── init-scripts/                # Inițializare DB
│   ├── prometheus/
│   ├── grafana/
│   ├── loki/
│   └── promtail/
│
├── kong/                            # Configurare Kong routes & services
├── scripts/                         # Scripts utilitare
├── docker-compose.yml               # Orchestrare completă
└── Makefile                         # Comenzi shortcut
```

---

## API Reference

### Autentificare

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'
# → { "accessToken": "...", "refreshToken": "...", "user": {...} }

# Refresh token
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"..."}'
```

### Permisiuni utilizator

```bash
# Citire permisiuni
GET /api/v1/users/:id/permissions

# Actualizare permisiuni (admin)
PUT /api/v1/users/:id/permissions
Body: { "permissions": [{ "resource": "orders", "can_view": true, "can_create": true, ... }] }
```

### Reguli WMS

```bash
GET  /api/v1/rules              # Lista reguli active
POST /api/v1/rules              # Creare regulă nouă
GET  /api/v1/rules/validate     # Validare reguli ↔ hartă
GET  /api/v1/rules/dynamic/alerts  # Alerte reguli dinamice
POST /api/v1/rules/simulate     # Simulare regulă
```

### Audit & Validare

```bash
GET  /api/v1/audit/events       # Eveniment audit motor reguli
GET  /api/v1/audit/ops          # Operațiuni WMS (locații, marfă, setări)
GET  /api/v1/audit/ops/stats    # Statistici audit
POST /api/v1/audit/ui-event     # Log acțiune UI utilizator
GET  /api/v1/validate/setup-check  # Validator configurare depozit (scor 0-100)
```

### Inventar & Receptie

```bash
GET  /api/v1/inventory/items    # Stoc curent
POST /api/v1/inventory/receive  # Receptie marfă
GET  /api/v1/picking/jobs       # Joburi picking
GET  /api/v1/locations          # Locații depozit
PATCH /api/v1/locations/:id/capacity  # Capacitate locație
```

---

## Credențiale implicite (dev)

> ⚠️ **Schimbați toate parolele înainte de deployment în producție!**

| Serviciu | User | Parolă |
|---|---|---|
| Admin WMS | `admin` | `Admin123!` |
| PostgreSQL | `wms_admin` | `wms_secure_pass_2025` |
| Redis | — | `redis_pass_2025` |
| RabbitMQ | `wms_queue` | `queue_pass_2025` |
| Grafana | `admin` | `grafana_admin_2025` |
| Kong DB | `kong` | `kong_pass_2025` |

**JWT_SECRET** implicit (`.env`): `your_super_secret_jwt_key_change_in_production`

---

## Troubleshooting

### Serviciile nu pornesc

```bash
# Verificare versiuni
docker --version
docker compose version

# Log-uri detaliate
make logs

# Restart serviciu specific
docker compose restart auth-service
docker compose restart warehouse-config-service
```

### Eroare conexiune baza de date

```bash
# Status PostgreSQL
docker compose ps postgres

# Log-uri PostgreSQL
docker compose logs postgres

# Reset complet (⚠️ pierde date!)
make db-reset
```

### Conflicte de porturi

```bash
# Windows — verificare porturi ocupate
netstat -ano | findstr :8000
netstat -ano | findstr :5432

# Alternativ, schimbați porturile în docker-compose.yml
```

### Frontend nu se conectează la backend

1. Verificati `VITE_API_BASE_URL` din `frontend/web_ui/.env`
2. Asigurați-vă că Kong rulează: `docker compose ps kong`
3. Testați direct: `curl http://localhost:8000/api/v1/auth/health`

### Migrări DB lipsă

```bash
# Aplicare manuală migrare
docker compose exec postgres psql -U wms_admin -d wms_nks -f /migrations/036_erp_integration.sql
```

---

## Roadmap

| Faza | Status |
|---|---|
| 1 — Fundament WMS | ✅ DONE |
| 2 — Motor inteligent WMS | ✅ DONE |
| 3 — Configurator Enterprise Wizard | ✅ DONE |
| 4 — Optimizare avansată AI | ✅ DONE |
| 6 — Audit & Securitate | ✅ DONE |
| 7 — Integrare ERP Pluriva | ✅ DONE |
| 5 — Multi-depozit & Scalare | ⏳ Planificat |

---

## Licență

Proiect proprietar. Toate drepturile rezervate © 2025–2026 NK Systems.


```bash
# 1. Clone the repository
git clone https://github.com/nnoldi-hub/wms_nk.git
cd wms_nk

# 2. Initialize project
make init

# 3. Start all services
make up

# 4. Create admin user
make create-admin

# 5. Check health
make health
```

## 📋 Available Commands

### Development
```bash
make up              # Start all services
make down            # Stop all services
make restart         # Restart all services
make logs            # View logs in real-time
make logs-auth       # View auth service logs
make logs-inventory  # View inventory service logs
make health          # Check service health
make ps              # Show running containers
```

### Database
```bash
make db-shell        # Connect to PostgreSQL shell
make db-backup       # Backup database
make db-restore      # Restore latest backup
make db-reset        # Reset database (DANGER!)
```

### Monitoring
```bash
make grafana         # Open Grafana dashboard
make prometheus      # Open Prometheus
make kong-ui         # Open Kong admin UI
make rabbitmq-ui     # Open RabbitMQ management
```

### Testing
```bash
make api-test-login  # Test login endpoint
make api-test-health # Test health endpoints
make test            # Run all tests
```

### Cleanup
```bash
make clean           # Remove all containers & volumes
make clean-logs      # Remove log files
```

## 🌐 Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Kong Gateway** | http://localhost:8000 | - |
| Kong Admin | http://localhost:8001 | - |
| Konga UI | http://localhost:1337 | Setup required |
| **Auth Service** | http://localhost:3010 | - |
| **Inventory** | http://localhost:3011 | - |
| **Scanner** | http://localhost:3012 | - |
| **Grafana** | http://localhost:3001 | admin / grafana_admin_2025 |
| **Prometheus** | http://localhost:9090 | - |
| **RabbitMQ UI** | http://localhost:15672 | wms_queue / queue_pass_2025 |
| **PostgreSQL** | localhost:5432 | wms_admin / wms_secure_pass_2025 |
| **Redis** | localhost:6379 | redis_pass_2025 |

## 🏗️ Architecture

```
wms-nks/
├── services/               # Microservices
│   ├── auth/              # Authentication & Authorization
│   ├── inventory/         # Inventory Management
│   ├── scanner-service/   # Barcode Scanning
│   ├── cutting-service/   # Material Cutting
│   ├── shipping-service/  # Shipping Management
│   ├── erp-connector/     # ERP Integration
│   ├── notifications/     # Notifications & WebSocket
│   ├── reports/           # Reports Generation
│   └── scheduler/         # Scheduled Tasks
├── docker/                # Docker configurations
│   ├── init-scripts/      # Database initialization
│   ├── prometheus/        # Prometheus config
│   ├── grafana/          # Grafana config
│   ├── loki/             # Loki config
│   └── promtail/         # Promtail config
├── scripts/              # Utility scripts
└── frontend/             # Frontend applications
```

## 🔐 Default Credentials

**Admin User:**
- Username: `admin`
- Password: `Admin123!`

**Database:**
- User: `wms_admin`
- Password: `wms_secure_pass_2025`
- Database: `wms_nks`

**Redis:**
- Password: `redis_pass_2025`

**RabbitMQ:**
- User: `wms_queue`
- Password: `queue_pass_2025`

## 🛠️ Technologies

- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Cache:** Redis
- **Message Queue:** RabbitMQ
- **API Gateway:** Kong
- **Monitoring:** Prometheus, Grafana, Loki
- **Container:** Docker, Docker Compose

## 📝 API Documentation

### Authentication
```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'

# Get current user
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Users Management
```bash
# Get all users (admin only)
curl http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get user by ID
curl http://localhost:8000/api/v1/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🐛 Troubleshooting

### Services not starting
```bash
# Check Docker status
docker --version
docker-compose --version

# View detailed logs
make logs

# Restart specific service
docker-compose restart auth-service
```

### Database connection failed
```bash
# Check PostgreSQL status
docker-compose ps postgres

# View database logs
docker-compose logs postgres

# Reset database
make db-reset
```

### Port conflicts
```bash
# Check which ports are in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # macOS/Linux

# Stop conflicting services or change ports in docker-compose.yml
```

## 📚 Documentation

- [Setup Guide](setup-config.md) - Detailed setup instructions
- [Auth Service](services/auth/README.md) - Authentication service docs
- [API Reference](docs/api.md) - Complete API documentation (coming soon)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 👥 Team

- Development: WMS-NKS Team
- Contact: admin@wms-nks.local

## 🔄 Updates

Check the [CHANGELOG.md](CHANGELOG.md) for version history and updates.
