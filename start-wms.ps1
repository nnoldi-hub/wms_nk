# WMS NK - Start All Services
# PowerShell script pentru pornire rapidă

Write-Host "🚀 Starting WMS NK - Warehouse Management System" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "📦 Checking Docker..." -ForegroundColor Yellow
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker nu rulează! Te rog pornește Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Stop și șterge containerele vechi
Write-Host "🧹 Cleaning up old containers..." -ForegroundColor Yellow
docker-compose down -v 2>$null
Write-Host ""

# Build imaginile
Write-Host "🏗️  Building Docker images..." -ForegroundColor Yellow
docker-compose build --parallel
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build completed" -ForegroundColor Green
Write-Host ""

# Pornește toate serviciile
Write-Host "🚀 Starting all services..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start services!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Așteaptă ca serviciile să fie ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service health
Write-Host ""
Write-Host "🏥 Checking service health..." -ForegroundColor Yellow
docker-compose ps

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "✅ WMS NK is running!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Access points:" -ForegroundColor Cyan
Write-Host "   🌐 Web UI:           http://localhost:5173" -ForegroundColor White
Write-Host "   🔐 Auth Service:     http://localhost:3001" -ForegroundColor White
Write-Host "   📦 Inventory:        http://localhost:3002" -ForegroundColor White
Write-Host "   🗄️  PostgreSQL:       localhost:5432" -ForegroundColor White
Write-Host "   🚪 Kong Gateway:     http://localhost:8000" -ForegroundColor White
Write-Host "   📊 Grafana:          http://localhost:3001" -ForegroundColor White
Write-Host "   🐰 RabbitMQ:         http://localhost:15672" -ForegroundColor White
Write-Host ""
Write-Host "📋 Useful commands:" -ForegroundColor Cyan
Write-Host "   View logs:           docker-compose logs -f [service-name]" -ForegroundColor Gray
Write-Host "   Stop all:            docker-compose down" -ForegroundColor Gray
Write-Host "   Restart service:     docker-compose restart [service-name]" -ForegroundColor Gray
Write-Host "   View status:         docker-compose ps" -ForegroundColor Gray
Write-Host ""
Write-Host "🎯 Default credentials:" -ForegroundColor Cyan
Write-Host "   Username: admin" -ForegroundColor Gray
Write-Host "   Password: password123" -ForegroundColor Gray
Write-Host ""

# Deschide browserul automat
Write-Host "🌐 Opening Web UI in browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "✨ Ready to go! Happy coding! 🎉" -ForegroundColor Green
