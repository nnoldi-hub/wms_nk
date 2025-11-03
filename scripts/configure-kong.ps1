# Kong Gateway Configuration Script for WMS-NKS
# Configures services, routes, and plugins

$KONG_ADMIN = "http://localhost:8001"

Write-Host "`n==> Configurare Kong Gateway pentru WMS-NKS`n" -ForegroundColor Cyan

# ============================================
# 1. AUTH SERVICE
# ============================================
Write-Host "[1/2] Configurare Auth Service..." -ForegroundColor Yellow

# Create Auth Service
$authService = @{
    name = "auth-service"
    url = "http://auth-service:3000"
    protocol = "http"
    host = "auth-service"
    port = 3000
    path = "/"
    retries = 5
    connect_timeout = 60000
    write_timeout = 60000
    read_timeout = 60000
} | ConvertTo-Json

try {
    $authSvc = Invoke-RestMethod -Uri "$KONG_ADMIN/services" -Method Post -Body $authService -ContentType "application/json"
    Write-Host "  [OK] Auth Service creat: $($authSvc.id)" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Auth Service exista deja sau eroare: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Create Auth Routes
$authRoute = @{
    name = "auth-routes"
    protocols = @("http", "https")
    paths = @("/api/v1/auth")
    strip_path = $false
    preserve_host = $false
} | ConvertTo-Json

try {
    $route = Invoke-RestMethod -Uri "$KONG_ADMIN/services/auth-service/routes" -Method Post -Body $authRoute -ContentType "application/json"
    Write-Host "  [OK] Auth Routes create: $($route.id)" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Auth Routes exista sau eroare" -ForegroundColor Yellow
}

# Add Rate Limiting to Auth (100 requests per minute)
$rateLimitAuth = @{
    name = "rate-limiting"
    config = @{
        minute = 100
        policy = "local"
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$KONG_ADMIN/services/auth-service/plugins" -Method Post -Body $rateLimitAuth -ContentType "application/json" | Out-Null
    Write-Host "  [OK] Rate Limiting adaugat (100 req/min)" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Rate Limiting exista sau eroare" -ForegroundColor Yellow
}

# Add CORS
$corsAuth = @{
    name = "cors"
    config = @{
        origins = @("*")
        methods = @("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
        headers = @("Accept", "Authorization", "Content-Type", "X-Auth-Token")
        exposed_headers = @("X-Auth-Token")
        credentials = $true
        max_age = 3600
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$KONG_ADMIN/services/auth-service/plugins" -Method Post -Body $corsAuth -ContentType "application/json" | Out-Null
    Write-Host "  [OK] CORS adaugat" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] CORS exista sau eroare" -ForegroundColor Yellow
}

# ============================================
# 2. INVENTORY SERVICE
# ============================================
Write-Host "`n[2/2] Configurare Inventory Service..." -ForegroundColor Yellow

# Create Inventory Service
$inventoryService = @{
    name = "inventory-service"
    url = "http://inventory-service:3000"
    protocol = "http"
    host = "inventory-service"
    port = 3000
    path = "/"
    retries = 5
    connect_timeout = 60000
    write_timeout = 60000
    read_timeout = 60000
} | ConvertTo-Json

try {
    $invSvc = Invoke-RestMethod -Uri "$KONG_ADMIN/services" -Method Post -Body $inventoryService -ContentType "application/json"
    Write-Host "  [OK] Inventory Service creat: $($invSvc.id)" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Inventory Service exista sau eroare" -ForegroundColor Yellow
}

# Create Inventory Routes
$inventoryRoute = @{
    name = "inventory-routes"
    protocols = @("http", "https")
    paths = @("/api/v1/products", "/api/v1/locations", "/api/v1/movements")
    strip_path = $false
    preserve_host = $false
} | ConvertTo-Json

try {
    $route = Invoke-RestMethod -Uri "$KONG_ADMIN/services/inventory-service/routes" -Method Post -Body $inventoryRoute -ContentType "application/json"
    Write-Host "  [OK] Inventory Routes create: $($route.id)" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Inventory Routes exista sau eroare" -ForegroundColor Yellow
}

# Add extra routes for Orders and Picking Jobs
$inventoryRoute2 = @{
    name = "inventory-orders-picking"
    protocols = @("http", "https")
    paths = @("/api/v1/orders", "/api/v1/pick-jobs")
    strip_path = $false
    preserve_host = $false
} | ConvertTo-Json

try {
    $route2 = Invoke-RestMethod -Uri "$KONG_ADMIN/services/inventory-service/routes" -Method Post -Body $inventoryRoute2 -ContentType "application/json"
    Write-Host "  [OK] Inventory Orders/Picking Routes create: $($route2.id)" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Inventory Orders/Picking Routes exista sau eroare" -ForegroundColor Yellow
}

# Add Rate Limiting to Inventory (200 requests per minute)
$rateLimitInv = @{
    name = "rate-limiting"
    config = @{
        minute = 200
        policy = "local"
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$KONG_ADMIN/services/inventory-service/plugins" -Method Post -Body $rateLimitInv -ContentType "application/json" | Out-Null
    Write-Host "  [OK] Rate Limiting adaugat (200 req/min)" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Rate Limiting exista sau eroare" -ForegroundColor Yellow
}

# Add CORS
$corsInv = @{
    name = "cors"
    config = @{
        origins = @("*")
        methods = @("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
        headers = @("Accept", "Authorization", "Content-Type")
        credentials = $true
        max_age = 3600
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$KONG_ADMIN/services/inventory-service/plugins" -Method Post -Body $corsInv -ContentType "application/json" | Out-Null
    Write-Host "  [OK] CORS adaugat" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] CORS exista sau eroare" -ForegroundColor Yellow
}

# Add Request/Response Logging
$logging = @{
    name = "file-log"
    config = @{
        path = "/tmp/kong-access.log"
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri "$KONG_ADMIN/services/inventory-service/plugins" -Method Post -Body $logging -ContentType "application/json" | Out-Null
    Write-Host "  [OK] Logging adaugat" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Logging exista sau eroare" -ForegroundColor Yellow
}

# ============================================
# SUMMARY
# ============================================
Write-Host "`n==> Configurare completa!`n" -ForegroundColor Green

Write-Host "[INFO] Kong Gateway Endpoints:" -ForegroundColor Cyan
Write-Host "  - Proxy:      http://localhost:8000" -ForegroundColor White
Write-Host "  - Admin API:  http://localhost:8001" -ForegroundColor White
Write-Host ""
Write-Host "[INFO] API Routes:" -ForegroundColor Cyan
Write-Host "  - Auth:       http://localhost:8000/api/v1/auth/*" -ForegroundColor White
Write-Host "  - Inventory:  http://localhost:8000/api/v1/products/*" -ForegroundColor White
Write-Host "  - Inventory:  http://localhost:8000/api/v1/locations/*" -ForegroundColor White
Write-Host "  - Inventory:  http://localhost:8000/api/v1/movements/*" -ForegroundColor White
Write-Host ""
Write-Host "[INFO] Security:" -ForegroundColor Cyan
Write-Host "  - Rate Limiting: Auth (100/min), Inventory (200/min)" -ForegroundColor White
Write-Host "  - CORS: Enabled for all origins" -ForegroundColor White
Write-Host "  - Logging: Enabled for Inventory Service" -ForegroundColor White
Write-Host ""

# List all services
Write-Host "[INFO] Services configurate:" -ForegroundColor Cyan
$services = Invoke-RestMethod -Uri "$KONG_ADMIN/services" -Method Get
$services.data | ForEach-Object {
    Write-Host "  - $($_.name) ==> $($_.protocol)://$($_.host):$($_.port)" -ForegroundColor White
}
