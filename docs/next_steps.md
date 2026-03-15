# Next Steps - Ce să implementezi

## ⚠️ IMPORTANT: Windows Users

Acest proiect folosește Docker și poate fi rulat pe Windows în 2 moduri:

### Opțiunea 1: PowerShell Script (Recomandat pentru Windows)
```powershell
# În loc de 'make', folosește:
.\wms.ps1 init              # Inițializare proiect
.\wms.ps1 up                # Start servicii
.\wms.ps1 create-admin      # Creează admin
.\wms.ps1 health            # Verifică starea
.\wms.ps1 help              # Vezi toate comenzile
```

### Opțiunea 2: Instalează Make pentru Windows
- Instalează Chocolatey: https://chocolatey.org/install
- Apoi: `choco install make`

---

## Săptămâna 1-2: Setup & Auth

✅ **Gata:** Infrastructure + Auth service complet implementat

📋 **TODO:**
- [ ] Testează Auth endpoints cu Postman/curl
- [ ] Configurează Kong routes și plugins
- [ ] Setup Grafana dashboards pentru monitoring

---

## Săptămâna 3-4: Inventory Service

```javascript
// services/inventory/src/index.js
// Template similar cu auth-service
// Endpoints:
// GET /api/v1/inventory/sku/:sku
// POST /api/v1/inventory/move
// GET /api/v1/inventory/locations
// POST /api/v1/inventory/adjust
```

---

## Săptămâna 5-6: Scanner Service

```javascript
// services/scanner-service/src/index.js
// Endpoints:
// POST /api/v1/scanner/sync
// GET /api/v1/scanner/pending/:device_id
// POST /api/v1/scanner/conflict/resolve
```

---

## Săptămâna 7-8: Mobile App

- React Native sau Flutter
- Offline sync cu SQLite/Realm
- Barcode scanning
- WebSocket pentru real-time updates

---

## 🔑 Credențiale Default

| Serviciu | Username | Password |
|----------|----------|----------|
| PostgreSQL | `wms_admin` | `wms_secure_pass_2025` |
| Redis | - | `redis_pass_2025` |
| RabbitMQ | `wms_queue` | `queue_pass_2025` |
| Grafana | `admin` | `grafana_admin_2025` |
| Admin User | `admin` | `Admin123!` |

⚠️ **Schimbă-le în producție!**

---

## 📊 Structura finală a proiectului

```
wms-nks/
├── docker-compose.yml          ✅ COMPLET
├── Makefile                    ✅ COMPLET (Linux/Mac)
├── wms.ps1                     ✅ COMPLET (Windows)
├── .env                        ✅ AUTO-GENERAT
├── README.md                   ✅ AUTO-GENERAT
├── docker/                     ✅ TOATE CONFIGS
├── services/
│   ├── auth/                   ✅ IMPLEMENTAT 100%
│   ├── inventory/              🔨 Template gata
│   ├── scanner-service/        🔨 Template gata
│   └── ...                     🔨 Templates gata
├── scripts/
│   ├── init-project.sh         ✅ COMPLET (Linux/Mac)
│   ├── health-check.sh         ✅ COMPLET
│   ├── create-admin.sh         ✅ COMPLET (Linux/Mac)
│   └── seed-data.sh            ✅ COMPLET
└── docs/                       📝 De completat
```

---

## 💡 Tips pentru dezvoltare

### 1. Development workflow

**Windows PowerShell:**
```powershell
# Pornește toate serviciile
.\wms.ps1 up

# Vezi logs
.\wms.ps1 logs auth-service

# Dezvoltă local (fără Docker)
cd services\auth
npm install
npm run dev
```

**Linux/Mac cu Make:**
```bash
# Pornește doar infra pentru development local
make up-infra

# Dezvoltă local (fără Docker)
cd services/auth
npm install
npm run dev

# Sau în Docker cu hot-reload
make up
make logs SERVICE=auth-service
```

### 2. Debugging

**Windows PowerShell:**
```powershell
# Shell în container
docker-compose exec auth-service sh

# Vezi variabilele de environment
docker-compose exec auth-service env

# Tail specific logs
.\wms.ps1 logs auth-service
```

**Linux/Mac:**
```bash
# Shell în container
make shell SERVICE=auth-service

# Vezi variabilele de environment
docker-compose exec auth-service env

# Tail specific logs
make logs SERVICE=auth-service
```

### 3. Testing

**Windows PowerShell:**
```powershell
# Test login rapid
.\wms.ps1 test-login

# Test manual cu Invoke-RestMethod
$body = @{username="admin"; password="Admin123!"} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/login" -Method Post -ContentType "application/json" -Body $body

# Verifică database
.\wms.ps1 db-shell
# Apoi: SELECT * FROM users;
```

**Linux/Mac:**
```bash
# Test un endpoint
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'

# Verifică database
make db-shell
SELECT * FROM users;
```

---

## ⚠️ Common Issues & Solutions

### Port already in use:

**Windows:**
```powershell
# Verifică ce folosește portul
netstat -ano | findstr :3000

# Oprește procesul (găsește PID din comanda de mai sus)
taskkill /PID <PID> /F

# Sau schimbă portul în docker-compose.yml
```

**Linux/Mac:**
```bash
# Verifică ce folosește portul
lsof -i :3000

# Schimbă portul în docker-compose.yml
```

### Services not starting:

**Windows:**
```powershell
.\wms.ps1 logs auth-service
.\wms.ps1 restart
```

**Linux/Mac:**
```bash
make logs SERVICE=<service-name>
make restart
```

### Database connection failed:

**Windows:**
```powershell
.\wms.ps1 db-shell  # Testează conexiunea
docker-compose restart postgres
```

**Linux/Mac:**
```bash
make db-shell  # Testează conexiunea
docker-compose restart postgres
```

---

## 🚀 Quick Start pentru Windows

```powershell
# 1. Verifică că ai Docker Desktop instalat și pornit
docker --version

# 2. Clonează repository (dacă nu l-ai făcut)
git clone https://github.com/nnoldi-hub/wms_nk.git
cd wms_nk

# 3. Inițializează proiectul
.\wms.ps1 init

# 4. Creează admin user
.\wms.ps1 create-admin

# 5. Verifică starea
.\wms.ps1 health

# 6. Vezi toate comenzile disponibile
.\wms.ps1 help
```

---

## 📚 Resurse utile

- [Docker Desktop pentru Windows](https://docs.docker.com/desktop/install/windows-install/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Kong Gateway Documentation](https://docs.konghq.com/)
