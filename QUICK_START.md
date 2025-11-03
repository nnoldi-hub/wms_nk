# 🚀 WMS NK - Quick Start Guide

## Pornire Rapidă

### Opțiunea 1: Start Complet (Prima Dată)
```powershell
.\start-wms.ps1
```
Acest script va:
- Verifica Docker
- Șterge containerele vechi
- Face rebuild la toate imaginile
- Porni toate serviciile
- Deschide browserul automat

### Opțiunea 2: Start Rapid (Dezvoltare)
```powershell
.\quick-start.ps1
```
Pentru restart rapid fără rebuild. Mai rapid pentru dezvoltare zilnică.

### Oprire
```powershell
.\stop-wms.ps1
```

---

## 🌐 Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Web UI** | http://localhost:5173 | admin / password123 |
| Auth Service | http://localhost:3001 | - |
| Inventory Service | http://localhost:3002 | - |
| Kong Gateway | http://localhost:8000 | - |
| Kong Admin | http://localhost:8001 | - |
| Konga UI | http://localhost:1337 | - |
| RabbitMQ UI | http://localhost:15672 | wms_queue / queue_pass_2025 |
| Grafana | http://localhost:3001 | admin / grafana_admin_2025 |
| Prometheus | http://localhost:9090 | - |

---

## 📦 Servicii Incluse

### Infrastructure
- ✅ PostgreSQL 15 (port 5432)
- ✅ Redis 7 (port 6379)
- ✅ RabbitMQ 3.12 (ports 5672, 15672)

### Monitoring
- ✅ Prometheus (port 9090)
- ✅ Grafana (port 3001)
- ✅ Loki (port 3100)

### API Gateway
- ✅ Kong Gateway (ports 8000, 8001)
- ✅ Konga Admin (port 1337)

### Microservices
- ✅ Auth Service (port 3001)
- ✅ Inventory Service (port 3002)
- ✅ Scanner Service (port 3012)
- ✅ Cutting Service (port 3013)
- ✅ Sewing Service (port 3014)
- ✅ QC Service (port 3015)
- ✅ Shipments Service (port 3016)
- ✅ Notifications Service (port 3017)
- ✅ Reports Service (port 3018)
- ✅ Scheduler Service (port 3019)

### Frontend
- ✅ Web UI (Vite + React) (port 5173)

---

## 🛠️ Comenzi Utile

### Docker Compose
```powershell
# Vezi statusul serviciilor
docker-compose ps

# Vezi logs pentru toate serviciile
docker-compose logs -f

# Vezi logs pentru un serviciu specific
docker-compose logs -f web-ui
docker-compose logs -f auth-service
docker-compose logs -f inventory-service

# Restart un serviciu specific
docker-compose restart web-ui

# Stop toate serviciile
docker-compose down

# Stop și șterge volumes (ATENȚIE: șterge datele!)
docker-compose down -v

# Rebuild un serviciu specific
docker-compose build web-ui
docker-compose up -d web-ui
```

### Database
```powershell
# Conectare la PostgreSQL
docker exec -it wms-postgres psql -U wms_admin -d wms_nks

# Run migration
docker exec -i wms-postgres psql -U wms_admin -d wms_nks < infrastructure/database/migrations/001_initial_schema.sql

# Backup database
docker exec wms-postgres pg_dump -U wms_admin wms_nks > backup.sql

# Restore database
docker exec -i wms-postgres psql -U wms_admin wms_nks < backup.sql
```

### Redis
```powershell
# Conectare la Redis CLI
docker exec -it wms-redis redis-cli -a redis_pass_2025

# Vezi toate keys
docker exec -it wms-redis redis-cli -a redis_pass_2025 KEYS "*"

# Flush all data (ATENȚIE!)
docker exec -it wms-redis redis-cli -a redis_pass_2025 FLUSHALL
```

---

## 🐛 Troubleshooting

### Serviciile nu pornesc
```powershell
# Check Docker status
docker info

# Check logs pentru erori
docker-compose logs

# Rebuild complet
docker-compose down -v
.\start-wms.ps1
```

### Port-uri ocupate
```powershell
# Vezi ce folosește un port
netstat -ano | findstr "5173"

# Oprește procesul (înlocuiește PID)
Stop-Process -Id <PID> -Force
```

### Frontend nu se actualizează
```powershell
# Rebuild doar frontend
docker-compose build web-ui
docker-compose up -d web-ui

# Sau oprește și pornește manual
docker-compose stop web-ui
docker-compose start web-ui
```

### Erori de permisiuni în Windows
Asigură-te că Docker Desktop are acces la drive-ul C:\ în Settings → Resources → File Sharing.

---

## 🔧 Development Mode

Pentru dezvoltare activă pe frontend:

1. **Oprește containerul web-ui:**
```powershell
docker-compose stop web-ui
```

2. **Pornește Vite local:**
```powershell
cd frontend/web_ui
npm run dev
```

3. **Accesează:** http://localhost:5173

Astfel ai hot-reload instant fără Docker overhead.

---

## 📱 Test Users

| Username | Password | Role |
|----------|----------|------|
| admin | password123 | Admin |
| manager | password123 | Manager |
| operator | password123 | Operator |

---

## 🎯 Next Steps

1. ✅ Pornește aplicația cu `.\start-wms.ps1`
2. ✅ Deschide http://localhost:5173
3. ✅ Login cu admin / password123
4. ✅ Testează Products page
5. 🔨 Continuă cu Orders workflow pages
6. 🔨 Adaugă Users management
7. 🔨 Implementează Reports

---

## 📚 Documentation

- [Architecture](./docs/architecture.md) (TBD)
- [API Documentation](./docs/api.md) (TBD)
- [Database Schema](./infrastructure/database/README.md) (TBD)

---

## 💡 Tips

- Folosește `docker-compose logs -f [service]` pentru debugging
- RabbitMQ UI e util pentru monitorizare queue-uri
- Grafana vine cu dashboard-uri pre-configurate
- Kong Admin API permite configurare rutare avansată
- Hot reload funcționează în development mode

---

**Happy Coding! 🎉**
