# WMS-NKS - Warehouse Management System

Modern, scalable warehouse management system built with microservices architecture.

## 🚀 Quick Start (3 minutes)

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
