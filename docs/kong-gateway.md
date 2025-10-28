# Kong Gateway Configuration - WMS-NKS

## Overview
Kong Gateway serveste ca API Gateway centralizat pentru toate microserviciile WMS-NKS, oferind routing, rate limiting, CORS, logging si monitorizare.

## Architecture

```
┌─────────────┐
│ Mobile App  │
└──────┬──────┘
       │
┌──────▼──────────────┐
│  Kong Gateway       │
│  Port: 8000 (Proxy) │
│  Port: 8001 (Admin) │
└──────┬──────────────┘
       │
       ├─────────────┬─────────────┐
       │             │             │
┌──────▼──────┐ ┌────▼─────┐ ┌────▼─────┐
│Auth Service │ │Inventory │ │Scanner   │
│Port: 3010   │ │Port: 3011│ │Port: 3012│
└─────────────┘ └──────────┘ └──────────┘
```

## Endpoints

### Kong Gateway
- **Proxy HTTP**: http://localhost:8000
- **Proxy HTTPS**: https://localhost:8443
- **Admin API**: http://localhost:8001
- **Admin HTTPS**: https://localhost:8444

### Configured Services

#### 1. Auth Service
- **Kong Service**: `auth-service`
- **Upstream**: http://auth-service:3000
- **Routes**: `/api/v1/auth/*`
- **Rate Limit**: 100 requests/minute
- **Plugins**: CORS, Rate Limiting

**Public Endpoints** (no auth required):
- POST `/api/v1/auth/login`
- POST `/api/v1/auth/register`
- POST `/api/v1/auth/refresh`

#### 2. Inventory Service
- **Kong Service**: `inventory-service`
- **Upstream**: http://inventory-service:3000
- **Routes**: `/api/v1/products/*`, `/api/v1/locations/*`, `/api/v1/movements/*`
- **Rate Limit**: 200 requests/minute
- **Plugins**: CORS, Rate Limiting, File Logging

## Plugins Configuration

### 1. Rate Limiting
Limitează numărul de cereri per client:
- Auth Service: 100 requests/minute
- Inventory Service: 200 requests/minute

**Note**: Rate limiting by `consumer` necesită definirea de consumeri Kong.
Pentru rate limiting by `ip`, modificați configurația:
```bash
"limit_by": "ip"
```

### 2. CORS
Permite cereri cross-origin pentru aplicația mobile:
- Origins: `*` (toate - schimbați în producție)
- Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
- Headers: Accept, Authorization, Content-Type
- Credentials: true

### 3. File Logging
Loguri pentru Inventory Service salvate în `/tmp/kong-access.log`.

## Usage Examples

### 1. Login prin Kong Gateway
```powershell
$body = @{ 
    username = "admin"
    password = "Admin123!" 
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "http://localhost:8000/api/v1/auth/login" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"

# Save token
$token = $response.accessToken
```

### 2. Get Products prin Kong
```powershell
$headers = @{ 
    Authorization = "Bearer $token" 
}

Invoke-RestMethod `
    -Uri "http://localhost:8000/api/v1/products" `
    -Method Get `
    -Headers $headers
```

### 3. Create Movement prin Kong
```powershell
$body = @{
    product_sku = "PROD-001"
    from_location = "LOC-A01-R01-P01"
    to_location = "R01-A1"
    quantity = 5
    movement_type = "TRANSFER"
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:8000/api/v1/movements" `
    -Method Post `
    -Body $body `
    -ContentType "application/json" `
    -Headers $headers
```

## Testing

### Health Checks
```powershell
# Kong Admin API
Invoke-RestMethod -Uri "http://localhost:8001" | Select-Object version, hostname

# Auth Service prin Kong
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/health"

# Inventory Service prin Kong
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/inventory/health"
```

### Rate Limiting Test
```powershell
# Send 110 requests to test 100/min limit
$success = 0
$rateLimited = 0
for($i=1; $i -le 110; $i++){
    try {
        Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/health"
        $success++
    } catch {
        if($_.Exception.Response.StatusCode -eq 429){
            $rateLimited++
        }
    }
}
Write-Host "Success: $success, Rate Limited: $rateLimited"
```

## Kong Admin API Examples

### List All Services
```powershell
Invoke-RestMethod -Uri "http://localhost:8001/services"
```

### List All Routes
```powershell
Invoke-RestMethod -Uri "http://localhost:8001/routes"
```

### List Plugins for a Service
```powershell
Invoke-RestMethod -Uri "http://localhost:8001/services/inventory-service/plugins"
```

### Add Plugin to Service
```powershell
$plugin = @{
    name = "request-size-limiting"
    config = @{
        allowed_payload_size = 10
    }
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:8001/services/inventory-service/plugins" `
    -Method Post `
    -Body $plugin `
    -ContentType "application/json"
```

### Delete Plugin
```powershell
Invoke-RestMethod `
    -Uri "http://localhost:8001/plugins/{plugin-id}" `
    -Method Delete
```

## Reconfiguration

Dacă trebuie să reconfigurezi Kong complet:

```powershell
# 1. Stop Kong
docker-compose stop kong

# 2. Delete Kong data volume (ATENȚIE: șterge toate configurațiile!)
docker volume rm wms-kong-data

# 3. Restart Kong with fresh migration
docker-compose up -d kong-database
Start-Sleep -Seconds 5
docker-compose up -d kong-migration
Start-Sleep -Seconds 5
docker-compose up -d kong

# 4. Rerun configuration script
.\scripts\configure-kong.ps1
```

## Adding New Services

Pentru a adăuga un nou microservice (ex: Scanner Service):

1. **Create Kong Service**:
```powershell
$service = @{
    name = "scanner-service"
    url = "http://scanner-service:3000"
    protocol = "http"
    retries = 5
    connect_timeout = 60000
    write_timeout = 60000
    read_timeout = 60000
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:8001/services" `
    -Method Post `
    -Body $service `
    -ContentType "application/json"
```

2. **Create Route**:
```powershell
$route = @{
    name = "scanner-routes"
    protocols = @("http", "https")
    paths = @("/api/v1/scanner")
    strip_path = $false
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:8001/services/scanner-service/routes" `
    -Method Post `
    -Body $route `
    -ContentType "application/json"
```

3. **Add Plugins** (rate limiting, CORS, etc.)

## Security Best Practices

### For Production:

1. **CORS**: Restricționați origins la domeniile mobile app
```json
{
    "origins": ["https://app.wms-nks.com", "https://mobile.wms-nks.com"]
}
```

2. **JWT Plugin**: Adăugați JWT validation la Kong level
```json
{
    "name": "jwt",
    "config": {
        "secret_is_base64": false
    }
}
```

3. **IP Restriction**: Limitați Admin API la IPs interne
```json
{
    "name": "ip-restriction",
    "config": {
        "allow": ["10.0.0.0/8", "192.168.0.0/16"]
    }
}
```

4. **Rate Limiting by IP**:
```json
{
    "config": {
        "minute": 200,
        "limit_by": "ip"
    }
}
```

5. **Request Size Limiting**:
```json
{
    "name": "request-size-limiting",
    "config": {
        "allowed_payload_size": 10
    }
}
```

## Troubleshooting

### Kong nu pornește
```bash
# Check database connection
docker logs wms-kong-db

# Check Kong logs
docker logs wms-kong

# Verify migrations ran successfully
docker logs wms-kong-migration
```

### Routes nu funcționează
```powershell
# List all routes
Invoke-RestMethod -Uri "http://localhost:8001/routes" | 
    Select-Object -ExpandProperty data | 
    Format-Table name, @{L="Paths";E={$_.paths -join ", "}}, @{L="Service";E={$_.service.name}}
```

### Rate limiting nu funcționează
- Verificați `limit_by` config (consumer vs ip vs header)
- Pentru `consumer`, trebuie să creați consumeri Kong
- Pentru testing rapid, folosiți `limit_by: ip`

### CORS errors
```powershell
# Check CORS plugin configuration
Invoke-RestMethod -Uri "http://localhost:8001/services/{service-name}/plugins" | 
    Select-Object -ExpandProperty data | 
    Where-Object { $_.name -eq "cors" } | 
    Select-Object -ExpandProperty config
```

## Monitoring

### Kong Metrics
Kong expune metrici Prometheus la `/metrics`:
```powershell
Invoke-RestMethod -Uri "http://localhost:8001/metrics"
```

### Service Health
```powershell
# Check all services health through Kong
@("auth", "inventory") | ForEach-Object {
    $service = $_
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/$service/health"
        Write-Host "$service : OK" -ForegroundColor Green
    } catch {
        Write-Host "$service : FAILED" -ForegroundColor Red
    }
}
```

## Next Steps

1. ✅ Configure Kong Services and Routes
2. ✅ Add Rate Limiting and CORS plugins
3. ⏳ Configure JWT validation plugin
4. ⏳ Add Prometheus metrics collection
5. ⏳ Configure Grafana dashboard for Kong metrics
6. ⏳ Set up log aggregation with Loki
7. ⏳ Add health checks monitoring
8. ⏳ Configure alerting for service failures
