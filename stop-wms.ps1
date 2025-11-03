# WMS NK - Stop All Services
# PowerShell script pentru oprire

Write-Host "Stopping WMS NK Services" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Yellow
Write-Host ""

# Stop all containers
docker-compose down

Write-Host ""
Write-Host "OK: All services stopped!" -ForegroundColor Green
Write-Host ""
Write-Host "TIP: To start again, run:" -ForegroundColor Cyan
Write-Host "   .\quick-start.ps1     (fast)" -ForegroundColor Gray
Write-Host "   .\start-wms.ps1       (rebuild)" -ForegroundColor Gray
