# Kong Gateway Integration Tests
# Tests all Kong routes, plugins, and functionality

$KONG_PROXY = "http://localhost:8000"
$KONG_ADMIN = "http://localhost:8001"

Write-Host "`n=== KONG GATEWAY INTEGRATION TESTS ===`n" -ForegroundColor Cyan

$totalTests = 0
$passedTests = 0
$failedTests = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [scriptblock]$Test
    )
    
    $script:totalTests++
    Write-Host "`n[$script:totalTests] Testing: $Name" -ForegroundColor Yellow
    
    try {
        & $Test
        $script:passedTests++
        Write-Host "  [PASS]" -ForegroundColor Green
        return $true
    } catch {
        $script:failedTests++
        Write-Host "  [FAIL] $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ============================================
# 1. KONG ADMIN API TESTS
# ============================================
Write-Host "`n[1/5] Kong Admin API Tests" -ForegroundColor Cyan

Test-Endpoint "Kong Admin API is accessible" {
    $info = Invoke-RestMethod -Uri "$KONG_ADMIN" -Method Get
    if($info.version -ne "3.8.0") { throw "Unexpected Kong version" }
}

Test-Endpoint "Auth Service is registered" {
    $services = Invoke-RestMethod -Uri "$KONG_ADMIN/services" -Method Get
    $authService = $services.data | Where-Object { $_.name -eq "auth-service" }
    if(!$authService) { throw "Auth Service not found" }
}

Test-Endpoint "Inventory Service is registered" {
    $services = Invoke-RestMethod -Uri "$KONG_ADMIN/services" -Method Get
    $invService = $services.data | Where-Object { $_.name -eq "inventory-service" }
    if(!$invService) { throw "Inventory Service not found" }
}

Test-Endpoint "Routes are configured" {
    $routes = Invoke-RestMethod -Uri "$KONG_ADMIN/routes" -Method Get
    if($routes.data.Count -lt 2) { throw "Expected at least 2 routes" }
}

# ============================================
# 2. AUTH SERVICE TESTS (through Kong)
# ============================================
Write-Host "`n[2/5] Auth Service Tests (via Kong)" -ForegroundColor Cyan

$global:token = $null

Test-Endpoint "Health check via Kong" {
    $health = Invoke-RestMethod -Uri "$KONG_PROXY/api/v1/auth/health" -Method Get
    if($health.status -ne "healthy") { throw "Service not healthy" }
}

Test-Endpoint "Login via Kong" {
    $body = @{ 
        username = "admin"
        password = "Admin123!" 
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod `
        -Uri "$KONG_PROXY/api/v1/auth/login" `
        -Method Post `
        -Body $body `
        -ContentType "application/json"
    
    if(!$response.accessToken) { throw "No access token received" }
    $global:token = $response.accessToken
}

Test-Endpoint "Invalid credentials rejected" {
    $body = @{ 
        username = "admin"
        password = "WrongPassword" 
    } | ConvertTo-Json
    
    try {
        Invoke-RestMethod `
            -Uri "$KONG_PROXY/api/v1/auth/login" `
            -Method Post `
            -Body $body `
            -ContentType "application/json"
        throw "Should have failed with 401"
    } catch {
        if($_.Exception.Response.StatusCode -ne 401) { throw $_ }
    }
}

# ============================================
# 3. INVENTORY SERVICE TESTS (through Kong)
# ============================================
Write-Host "`n[3/5] Inventory Service Tests (via Kong)" -ForegroundColor Cyan

$headers = @{ Authorization = "Bearer $global:token" }

Test-Endpoint "Get all products via Kong" {
    $response = Invoke-RestMethod `
        -Uri "$KONG_PROXY/api/v1/products?limit=5" `
        -Method Get `
        -Headers $headers
    
    if(!$response.success) { throw "Request failed" }
    if($response.data.Count -eq 0) { throw "No products returned" }
}

Test-Endpoint "Get product by SKU via Kong" {
    $response = Invoke-RestMethod `
        -Uri "$KONG_PROXY/api/v1/products/sku/PROD-001" `
        -Method Get `
        -Headers $headers
    
    if(!$response.success) { throw "Request failed" }
    if($response.data.sku -ne "PROD-001") { throw "Wrong product returned" }
}

Test-Endpoint "Get all locations via Kong" {
    $response = Invoke-RestMethod `
        -Uri "$KONG_PROXY/api/v1/locations" `
        -Method Get `
        -Headers $headers
    
    if(!$response.success) { throw "Request failed" }
}

Test-Endpoint "Get movement history via Kong" {
    $response = Invoke-RestMethod `
        -Uri "$KONG_PROXY/api/v1/movements?limit=5" `
        -Method Get `
        -Headers $headers
    
    if(!$response.success) { throw "Request failed" }
}

Test-Endpoint "Unauthorized access rejected" {
    try {
        Invoke-RestMethod `
            -Uri "$KONG_PROXY/api/v1/products" `
            -Method Get
        throw "Should have failed with 401"
    } catch {
        if($_.Exception.Response.StatusCode -ne 401) { throw $_ }
    }
}

# ============================================
# 4. CORS TESTS
# ============================================
Write-Host "`n[4/5] CORS Plugin Tests" -ForegroundColor Cyan

Test-Endpoint "CORS headers present on OPTIONS" {
    $response = Invoke-WebRequest `
        -Uri "$KONG_PROXY/api/v1/products" `
        -Method Options `
        -Headers @{ Origin = "http://localhost:3000" }
    
    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if(!$corsHeader) { throw "CORS header missing" }
}

# ============================================
# 5. PLUGIN TESTS
# ============================================
Write-Host "`n[5/5] Plugin Configuration Tests" -ForegroundColor Cyan

Test-Endpoint "Rate Limiting plugin configured for Auth" {
    $plugins = Invoke-RestMethod -Uri "$KONG_ADMIN/services/auth-service/plugins" -Method Get
    $rateLimit = $plugins.data | Where-Object { $_.name -eq "rate-limiting" }
    if(!$rateLimit) { throw "Rate limiting not configured" }
    if($rateLimit.config.minute -ne 100) { throw "Wrong rate limit value" }
}

Test-Endpoint "Rate Limiting plugin configured for Inventory" {
    $plugins = Invoke-RestMethod -Uri "$KONG_ADMIN/services/inventory-service/plugins" -Method Get
    $rateLimit = $plugins.data | Where-Object { $_.name -eq "rate-limiting" }
    if(!$rateLimit) { throw "Rate limiting not configured" }
    if($rateLimit.config.minute -ne 200) { throw "Wrong rate limit value" }
}

Test-Endpoint "CORS plugin configured" {
    $plugins = Invoke-RestMethod -Uri "$KONG_ADMIN/services/auth-service/plugins" -Method Get
    $cors = $plugins.data | Where-Object { $_.name -eq "cors" }
    if(!$cors) { throw "CORS not configured" }
}

Test-Endpoint "File logging configured for Inventory" {
    $plugins = Invoke-RestMethod -Uri "$KONG_ADMIN/services/inventory-service/plugins" -Method Get
    $logging = $plugins.data | Where-Object { $_.name -eq "file-log" }
    if(!$logging) { throw "Logging not configured" }
}

# ============================================
# SUMMARY
# ============================================
Write-Host "`n" -NoNewline
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "Total Tests:  $totalTests" -ForegroundColor White
Write-Host "Passed:       $passedTests" -ForegroundColor Green
Write-Host "Failed:       $failedTests" -ForegroundColor $(if($failedTests -eq 0){"Green"}else{"Red"})
Write-Host "Success Rate: $([math]::Round(($passedTests/$totalTests)*100, 2))%" -ForegroundColor $(if($failedTests -eq 0){"Green"}else{"Yellow"})
Write-Host "=" * 50 -ForegroundColor Cyan

if($failedTests -eq 0) {
    Write-Host "`n[SUCCESS] All Kong Gateway tests passed!" -ForegroundColor Green
    Write-Host "`nKong Gateway is ready for production use." -ForegroundColor Green
    Write-Host "Proxy Endpoint: $KONG_PROXY" -ForegroundColor White
    Write-Host "Admin Endpoint: $KONG_ADMIN" -ForegroundColor White
} else {
    Write-Host "`n[WARNING] Some tests failed. Review configuration." -ForegroundColor Yellow
}
