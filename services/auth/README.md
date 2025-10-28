# WMS Authentication Service

Service de autentificare și autorizare pentru sistemul WMS-NKS.

## Funcționalități

- 🔐 Autentificare cu JWT
- 👥 Managementul utilizatorilor
- 🔑 Refresh tokens cu Redis
- 📊 Metrics cu Prometheus
- 🛡️ Rate limiting
- 🔒 Role-based access control (RBAC)

## Endpoints

### Authentication
- `POST /api/v1/auth/login` - Autentificare utilizator
- `POST /api/v1/auth/register` - Înregistrare utilizator nou
- `POST /api/v1/auth/refresh` - Reîmprospătare access token
- `POST /api/v1/auth/logout` - Logout

### Users Management
- `GET /api/v1/users` - Lista utilizatori (admin)
- `GET /api/v1/users/:id` - Detalii utilizator
- `PUT /api/v1/users/:id` - Actualizare utilizator (admin)
- `DELETE /api/v1/users/:id` - Dezactivare utilizator (admin)
- `POST /api/v1/users/:id/change-password` - Schimbare parolă

### System
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

## Roluri

- `admin` - Acces complet la sistem
- `manager` - Management depozit și rapoarte
- `operator` - Operațiuni de bază în depozit

## Setup Local

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start service
npm run dev
```

## Environment Variables

Vezi fișierul `.env.example` pentru toate variabilele necesare.

## Docker

```bash
# Build
docker build -t wms-auth-service .

# Run
docker run -p 3000:3000 --env-file .env wms-auth-service
```

## Testing

```bash
# Login
curl -X POST http://localhost:3010/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}'

# Get user info
curl http://localhost:3010/api/v1/users/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```
