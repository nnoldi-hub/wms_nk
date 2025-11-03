# WMS NK - Quick Start (Development Mode)
# PowerShell script pentru pornire rapida fara rebuild

Write-Host "Quick Starting WMS NK" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker nu ruleaza! Porneste Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "OK: Docker is running" -ForegroundColor Green
Write-Host ""

# Porneste serviciile (fara rebuild)
Write-Host "Starting services..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start services!" -ForegroundColor Red
    Write-Host "TIP: Try running start-wms.ps1 for full build" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Check status
Write-Host "Service status:" -ForegroundColor Yellow
docker-compose ps

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "OK: Services started!" -ForegroundColor Green
Write-Host ""
Write-Host "Web UI: http://localhost:5173" -ForegroundColor White
Write-Host ""

# Deschide browserul
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
