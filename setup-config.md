# WMS-NKS Complete Setup Guide

## 📁 Structura completă de fișiere necesare

```
wms-nks/
├── docker-compose.yml                    # ✅ Gata (vezi artifact anterior)
├── .env.example                          # Vezi mai jos
├── docker/
│   ├── init-scripts/
│   │   └── 01-init-databases.sql        # 📝 Schema inițială DB
│   ├── prometheus/
│   │   └── prometheus.yml               # 📝 Config Prometheus
│   ├── grafana/
│   │   └── provisioning/
│   │       ├── datasources/
│   │       │   └── datasource.yml
│   │       └── dashboards/
│   │           └── dashboard.yml
│   ├── loki/
│   │   └── loki-config.yml              # 📝 Config Loki
│   └── promtail/
│       └── promtail-config.yml          # 📝 Config Promtail
├── services/
│   ├── auth/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   ├── inventory/
│   ├── scanner-service/
│   └── ... (celelalte servicii)
└── frontend/
    └── web_ui/
```

---

## 🚀 Quick Start (3 pași simpli)

### Pas 1: Clone repository și pregătire

```bash
# Clone repo (sau creează structura)
git clone <your-repo> wms-nks
cd wms-nks

# Creează fișierele de configurare
mkdir -p docker/{init-scripts,prometheus,grafana/provisioning/{datasources,dashboards},loki,promtail}
```

### Pas 2: Copiază fișierele de configurare

Creează fișierele de mai jos în locațiile indicate.

### Pas 3: Pornește stack-ul

```bash
# Pornește toate serviciile
docker-compose up -d

# Verifică starea
docker-compose ps

# Vezi logs
docker-compose logs -f auth-service inventory-service
```

---

## 📝 Fișiere de configurare necesare

### 1. `.env.example` (ROOT)

```bash
# Database
POSTGRES_USER=wms_admin
POSTGRES_PASSWORD=wms_secure_pass_2025
POSTGRES_DB=wms_nks

# Redis
REDIS_PASSWORD=redis_pass_2025

# RabbitMQ
RABBITMQ_USER=wms_queue
RABBITMQ_PASS=queue_pass_2025

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Kong
KONG_PG_PASSWORD=kong_pass_2025

# Pluriva ERP
PLURIVA_API_URL=https://api.pluriva.com/v1
PLURIVA_API_KEY=your_api_key_here

# Email (pentru notificări)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# FCM (pentru push mobile)
FCM_SERVER_KEY=your_fcm_key_here

# Environment
NODE_ENV=development
```

### 2. `docker/init-scripts/01-init-databases.sql`

```sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create Konga database for Kong Admin UI
CREATE DATABASE konga;
GRANT ALL PRIVILEGES ON DATABASE konga TO wms_admin;

-- Use wms_nks database (default)
\c wms_nks;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    sku VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    weight_kg DECIMAL(10,3),
    length_cm DECIMAL(10,2),
    width_cm DECIMAL(10,2),
    height_cm DECIMAL(10,2),
    uom VARCHAR(20) DEFAULT 'm',
    lot_control BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(50) PRIMARY KEY,
    zone VARCHAR(50),
    rack VARCHAR(50),
    position VARCHAR(50),
    allowed_types TEXT[],
    capacity_m3 DECIMAL(10,3),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_sku VARCHAR(100) REFERENCES products(sku) ON DELETE CASCADE,
    location_id VARCHAR(50) REFERENCES locations(id) ON DELETE CASCADE,
    quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    reserved_qty DECIMAL(10,3) NOT NULL DEFAULT 0,
    lot_number VARCHAR(100),
    expiry_date DATE,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_sku, location_id, lot_number)
);

-- Movements table
CREATE TABLE IF NOT EXISTS movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_type VARCHAR(50) NOT NULL,
    product_sku VARCHAR(100) REFERENCES products(sku),
    from_location VARCHAR(50) REFERENCES locations(id),
    to_location VARCHAR(50) REFERENCES locations(id),
    quantity DECIMAL(10,3) NOT NULL,
    lot_number VARCHAR(100),
    user_id UUID REFERENCES users(id),
    device_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id),
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync conflicts table
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(100) NOT NULL,
    action_id VARCHAR(255) NOT NULL,
    conflict_type VARCHAR(50) NOT NULL,
    server_data JSONB,
    client_data JSONB,
    resolution VARCHAR(50) DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_inventory_product ON inventory_items(product_sku);
CREATE INDEX idx_inventory_location ON inventory_items(location_id);
CREATE INDEX idx_movements_sku ON movements(product_sku);
CREATE INDEX idx_movements_created ON movements(created_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Insert default admin user (password: Admin123!)
INSERT INTO users (username, email, password_hash, role) 
VALUES (
    'admin',
    'admin@wms-nks.local',
    '$2a$10$YourHashedPasswordHere', -- Hash using bcrypt
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Insert sample locations
INSERT INTO locations (id, zone, rack, position, capacity_m3) VALUES
    ('R01-A1', 'Zone-A', 'R01', 'A1', 10.5),
    ('R01-A2', 'Zone-A', 'R01', 'A2', 10.5),
    ('R02-B1', 'Zone-B', 'R02', 'B1', 15.0),
    ('R02-B2', 'Zone-B', 'R02', 'B2', 15.0),
    ('R03-C1', 'Zone-C', 'R03', 'C1', 12.0)
ON CONFLICT (id) DO NOTHING;

-- Insert sample products
INSERT INTO products (sku, name, weight_kg, uom) VALUES
    ('MAT-001', 'Material Textil A', 5.5, 'm'),
    ('MAT-002', 'Material Textil B', 7.2, 'm'),
    ('MAT-003', 'Material Textil C', 4.8, 'm')
ON CONFLICT (sku) DO NOTHING;
```

### 3. `docker/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'wms-nks-dev'
    environment: 'development'

# Alertmanager configuration (optional)
alerting:
  alertmanagers:
    - static_configs:
        - targets: []

# Load rules once and periodically evaluate them
rule_files:
  # - "alerts.yml"

# Scrape configurations
scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Node exporter (if you add it)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # Auth service
  - job_name: 'auth-service'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['auth-service:3000']
        labels:
          service: 'auth'

  # Inventory service
  - job_name: 'inventory-service'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['inventory-service:3000']
        labels:
          service: 'inventory'

  # Scanner service
  - job_name: 'scanner-service'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['scanner-service:3000']
        labels:
          service: 'scanner'

  # Cutting service
  - job_name: 'cutting-service'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['cutting-service:3000']
        labels:
          service: 'cutting'

  # Shipping service
  - job_name: 'shipping-service'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['shipping-service:3000']
        labels:
          service: 'shipping'

  # ERP connector
  - job_name: 'erp-connector'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['erp-connector:3000']
        labels:
          service: 'erp'

  # Notifications service
  - job_name: 'notifications-service'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['notifications-service:3000']
        labels:
          service: 'notifications'

  # Reports service
  - job_name: 'reports-service'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['reports-service:3000']
        labels:
          service: 'reports'

  # Scheduler service
  - job_name: 'scheduler-service'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['scheduler-service:3000']
        labels:
          service: 'scheduler'

  # PostgreSQL exporter (if you add it)
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis exporter (if you add it)
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # RabbitMQ
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
```

### 4. `docker/loki/loki-config.yml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093

limits_config:
  retention_period: 744h  # 31 days
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20
  per_stream_rate_limit: 5MB
  per_stream_rate_limit_burst: 20MB

chunk_store_config:
  max_look_back_period: 744h

table_manager:
  retention_deletes_enabled: true
  retention_period: 744h
```

### 5. `docker/promtail/promtail-config.yml`

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Docker container logs
  - job_name: docker
    static_configs:
      - targets:
          - localhost
        labels:
          job: docker
          __path__: /var/lib/docker/containers/*/*-json.log
    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs: attrs
      - json:
          expressions:
            tag: attrs.tag
          source: attrs
      - regex:
          expression: (?P<container_name>(?:[^|]*[^|]))
          source: tag
      - timestamp:
          format: RFC3339Nano
          source: time
      - labels:
          stream:
          container_name:
      - output:
          source: output

  # System logs
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: varlogs
          __path__: /var/log/*.log
```

### 6. `docker/grafana/provisioning/datasources/datasource.yml`

```yaml
apiVersion: 1

datasources:
  # Prometheus
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true

  # Loki
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
```

---

## 🐳 Dockerfile pentru servicii (template)

### `services/auth/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Install dev dependencies for development
RUN npm install --only=development

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "run", "dev"]
```

**Notă:** Același Dockerfile poate fi folosit pentru toate serviciile Node.js (inventory, scanner, etc.)

---

## 📦 Package.json minimal pentru servicii

### `services/auth/package.json`

```json
{
  "name": "wms-auth-service",
  "version": "1.0.0",
  "description": "WMS Authentication Service",
  "main": "src/index.js",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "test": "jest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "express": "^4.18.2",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "prom-client": "^15.1.0",
    "winston": "^3.11.0",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "eslint": "^8.55.0"
  }
}
```

---

## 🛠️ Comenzi utile

### Managementul stack-ului

```bash
# Pornește toate serviciile
docker-compose up -d

# Pornește doar infrastructura (DB, Redis, RabbitMQ)
docker-compose up -d postgres redis rabbitmq kong

# Pornește un singur serviciu
docker-compose up -d auth-service

# Oprește toate serviciile
docker-compose down

# Oprește și șterge volumele (ATENȚIE: șterge datele!)
docker-compose down -v

# Rebuild un serviciu
docker-compose up -d --build auth-service

# Vezi statusul
docker-compose ps

# Vezi logs
docker-compose logs -f
docker-compose logs -f auth-service inventory-service

# Execută comenzi într-un container
docker-compose exec auth-service sh
docker-compose exec postgres psql -U wms_admin -d wms_nks
```

### Database management

```bash
# Conectează-te la PostgreSQL
docker-compose exec postgres psql -U wms_admin -d wms_nks

# Backup database
docker-compose exec postgres pg_dump -U wms_admin wms_nks > backup.sql

# Restore database
cat backup.sql | docker-compose exec -T postgres psql -U wms_admin wms_nks

# Verifică conexiuni
docker-compose exec postgres psql -U wms_admin -d wms_nks -c "SELECT * FROM pg_stat_activity;"
```

### Redis management

```bash
# Conectează-te la Redis CLI
docker-compose exec redis redis-cli -a redis_pass_2025

# Verifică keys
docker-compose exec redis redis-cli -a redis_pass_2025 KEYS "*"

# Flush cache (ATENȚIE!)
docker-compose exec redis redis-cli -a redis_pass_2025 FLUSHALL
```

### RabbitMQ management

```bash
# Lista queues
docker-compose exec rabbitmq rabbitmqctl list_queues

# Lista exchanges
docker-compose exec rabbitmq rabbitmqctl list_exchanges

# UI Management: http://localhost:15672
# User: wms_queue / Pass: queue_pass_2025
```

---

## 🌐 Endpoints și porturi

| Serviciu | Port | URL | Credențiale |
|----------|------|-----|-------------|
| **Kong Gateway** | 8000 | http://localhost:8000 | - |
| Kong Admin API | 8001 | http://localhost:8001 | - |
| Konga UI | 1337 | http://localhost:1337 | Setup la prima accesare |
| **PostgreSQL** | 5432 | localhost:5432 | wms_admin / wms_secure_pass_2025 |
| **Redis** | 6379 | localhost:6379 | redis_pass_2025 |
| **RabbitMQ** | 5672 | localhost:5672 | wms_queue / queue_pass_2025 |
| RabbitMQ UI | 15672 | http://localhost:15672 | wms_queue / queue_pass_2025 |
| **Prometheus** | 9090 | http://localhost:9090 | - |
| **Grafana** | 3001 | http://localhost:3001 | admin / grafana_admin_2025 |
| **Loki** | 3100 | http://localhost:3100 | - |
| **Auth Service** | 3010 | http://localhost:3010 | - |
| **Inventory** | 3011 | http://localhost:3011 | - |
| **Scanner** | 3012 | http://localhost:3012 | - |
| **Cutting** | 3013 | http://localhost:3013 | - |
| **Shipping** | 3014 | http://localhost:3014 | - |
| **ERP Connector** | 3015 | http://localhost:3015 | - |
| **Notifications** | 3016 | http://localhost:3016 | - |
| WS Notifications | 3017 | ws://localhost:3017 | - |
| **Reports** | 3018 | http://localhost:3018 | - |
| **Scheduler** | 3019 | http://localhost:3019 | - |
| **Web UI** | 3000 | http://localhost:3000 | - |

---

## 🧪 Testing the setup

### 1. Health checks

```bash
# Check all services
for port in 3010 3011 3012 3013 3014 3015 3016 3018 3019; do
  echo "Checking port $port..."
  curl -f http://localhost:$port/health || echo "Service on $port is down"
done
```

### 2. Test database connection

```bash
docker-compose exec postgres psql -U wms_admin -d wms_nks -c "SELECT COUNT(*) FROM users;"
```

### 3. Test Redis

```bash
docker-compose exec redis redis-cli -a redis_pass_2025 PING
```

### 4. Test RabbitMQ

```bash
curl -u wms_queue:queue_pass_2025 http://localhost:15672/api/overview
```

---

## 🔧 Troubleshooting

### Serviciile nu pornesc

```bash
# Verifică logs
docker-compose logs -f <service-name>

# Verifică resurse
docker stats

# Restart un serviciu
docker-compose restart <service-name>
```

### Database connection failed

```bash
# Verifică că PostgreSQL e healthy
docker-compose ps postgres

# Verifică conexiuni
docker-compose exec postgres psql -U wms_admin -d wms_nks -c "\conninfo"
```

### Port conflicts

```bash
# Verifică ce folosește un port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Schimbă portul în docker-compose.yml
ports:
  - "3050:3000"  # External:Internal
```

---

## 📊 Next Steps

1. **Configurează Kong Gateway** routes pentru fiecare serviciu
2. **Setup Grafana dashboards** pentru monitoring
3. **Implementează serviciile** (skeleton code în următorul artifact)
4. **Setup CI/CD** (GitHub Actions / GitLab CI)
5. **Documentează API-urile** (Swagger/OpenAPI)

---

## 🎯 Production Checklist

Când treci în producție, asigură-te că:

- [ ] Toate parolele sunt schimbate cu valori sigure
- [ ] JWT_SECRET este generat cu `openssl rand -base64 64`
- [ ] SSL/TLS este activat (HTTPS)
- [ ] Backup automat este configurat
- [ ] Monitoring alerts sunt active
- [ ] Rate limiting este ajustat
- [ ] Log retention este configurat
- [ ] Health checks sunt testate
- [ ] Disaster recovery plan este documentat
- [ ] Environment variables nu sunt hardcodate

---

## 📚 Resurse utile

- Docker Compose docs: https://docs.docker.com/compose/
- Kong Gateway docs: https://docs.konghq.com/
- Prometheus docs: https://prometheus.io/docs/
- Grafana docs: https://grafana.com/docs/
- PostgreSQL docs: https://www.postgresql.org/docs/