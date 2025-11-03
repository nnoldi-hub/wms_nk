# Warehouse Config Service (Dockerized)

This service manages WMS configuration: warehouses, zones, locations (incl. bulk), packaging, and carriers.

## Run with Docker

- Build and start just this service (requires Postgres and Redis in the same compose):

```powershell
cd "c:\Proiecte\WMS NK"
docker-compose up -d warehouse-config
```

- Check health:

```powershell
Invoke-RestMethod http://localhost:3020/health | ConvertTo-Json
```

## Ports

- Host: 3020 → Container: 3000

## Environment

The container is configured via docker-compose. Key variables:

- DB_HOST=postgres
- DB_PORT=5432
- DB_NAME=wms_nks
- DB_USER=wms_admin
- DB_PASSWORD=wms_secure_pass_2025
- REDIS_HOST=redis
- REDIS_PORT=6379
- REDIS_PASSWORD=redis_pass_2025
- PORT=3000

Local development outside Docker can use the `.env` file in this folder.

## Healthcheck

Container exposes `GET /health`. Compose marks the service healthy once it returns HTTP 200.
