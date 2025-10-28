# WMS-NKS Management Script for Windows
param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"

function Write-Color {
    param([string]$Text, [string]$Color)
    Write-Host $Text -ForegroundColor $Color
}

function Show-Help {
    Write-Color "`n=== WMS-NKS Management Commands ===" "Cyan"
    Write-Host "`nDevelopment:"
    Write-Host "  .\wms.ps1 init       - Initialize project"
    Write-Host "  .\wms.ps1 up         - Start all services"
    Write-Host "  .\wms.ps1 down       - Stop all services"
    Write-Host "  .\wms.ps1 restart    - Restart all services"
    Write-Host "  .\wms.ps1 logs       - View logs"
    Write-Host "  .\wms.ps1 health     - Check service health"
    Write-Host "  .\wms.ps1 ps         - Show running containers"
    Write-Host "`nDatabase:"
    Write-Host "  .\wms.ps1 db-shell   - Connect to PostgreSQL"
    Write-Host "  .\wms.ps1 db-backup  - Backup database"
    Write-Host "`nUser Management:"
    Write-Host "  .\wms.ps1 create-admin - Create admin user"
    Write-Host "`nMonitoring:"
    Write-Host "  .\wms.ps1 grafana    - Open Grafana"
    Write-Host "  .\wms.ps1 prometheus - Open Prometheus"
    Write-Host "`nTesting:"
    Write-Host "  .\wms.ps1 test-login - Test login endpoint`n"
}

function Initialize-Project {
    Write-Color "`n=== Initializing WMS-NKS ===" "Cyan"
    
    # Check Docker
    try {
        docker --version | Out-Null
        Write-Color "Docker OK" "Green"
    } catch {
        Write-Color "Docker not found! Install Docker Desktop" "Red"
        exit 1
    }

    # Create .env
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Color ".env created" "Green"
    }

    # Create directories
    @("backups", "logs", "data\postgres", "data\redis", "data\grafana") | ForEach-Object {
        if (-not (Test-Path $_)) {
            New-Item -ItemType Directory -Path $_ -Force | Out-Null
        }
    }
    Write-Color "Directories created" "Green"

    # Pull images
    Write-Host "`nPulling Docker images..."
    docker-compose pull

    # Start infrastructure
    Write-Host "`nStarting infrastructure..."
    docker-compose up -d postgres redis rabbitmq

    # Wait for PostgreSQL
    Write-Host "Waiting for PostgreSQL..."
    $count = 0
    while ($count -lt 30) {
        try {
            docker-compose exec -T postgres pg_isready -U wms_admin 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { break }
        } catch {}
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 1
        $count++
    }
    Write-Host ""
    Write-Color "PostgreSQL ready" "Green"

    # Wait for Redis
    Write-Host "Waiting for Redis..."
    $count = 0
    while ($count -lt 30) {
        try {
            docker-compose exec -T redis redis-cli -a redis_pass_2025 ping 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { break }
        } catch {}
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 1
        $count++
    }
    Write-Host ""
    Write-Color "Redis ready" "Green"

    # Start all services
    Write-Host "`nStarting all services..."
    docker-compose up -d

    Write-Color "`n=== Initialization Complete! ===" "Green"
    Write-Host "`nServices:"
    Write-Host "  Kong Gateway: http://localhost:8000"
    Write-Host "  Grafana:      http://localhost:3001"
    Write-Host "  Auth Service: http://localhost:3010"
    Write-Host "`nNext steps:"
    Write-Host "  1. .\wms.ps1 create-admin"
    Write-Host "  2. .\wms.ps1 health`n"
}

function Start-Services {
    Write-Color "Starting services..." "Cyan"
    docker-compose up -d
    Write-Color "Services started" "Green"
}

function Stop-Services {
    Write-Color "Stopping services..." "Cyan"
    docker-compose down
    Write-Color "Services stopped" "Green"
}

function Restart-Services {
    Stop-Services
    Start-Sleep -Seconds 2
    Start-Services
}

function Show-Logs {
    if ($Service) {
        docker-compose logs -f $Service
    } else {
        docker-compose logs -f
    }
}

function Check-Health {
    Write-Color "`nChecking service health..." "Cyan"
    
    Write-Host "`nAuth Service:"
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3010/health" -ErrorAction Stop
        $response | ConvertTo-Json
    } catch {
        Write-Color "Not responding" "Red"
    }
    
    Write-Host "`nInventory Service:"
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3011/health" -ErrorAction Stop
        $response | ConvertTo-Json
    } catch {
        Write-Color "Not responding" "Red"
    }
}

function Show-Containers {
    docker-compose ps
}

function Database-Shell {
    docker-compose exec postgres psql -U wms_admin -d wms_nks
}

function Backup-Database {
    Write-Color "Backing up database..." "Cyan"
    if (-not (Test-Path "backups")) {
        New-Item -ItemType Directory -Path "backups" -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    docker-compose exec -T postgres pg_dump -U wms_admin wms_nks > "backups\wms_nks_$timestamp.sql"
    Write-Color "Backup saved to backups\wms_nks_$timestamp.sql" "Green"
}

function Open-Grafana {
    Write-Color "Opening Grafana..." "Cyan"
    Start-Process "http://localhost:3001"
    Write-Host "Username: admin | Password: grafana_admin_2025"
}

function Open-Prometheus {
    Write-Color "Opening Prometheus..." "Cyan"
    Start-Process "http://localhost:9090"
}

function Create-AdminUser {
    Write-Color "`nCreating admin user..." "Cyan"
    
    # Use simple approach with docker exec
    docker-compose exec -T postgres psql -U wms_admin -d wms_nks -c "INSERT INTO users (username, email, password_hash, role) VALUES ('admin', 'admin@wms-nks.local', '`$2a`$10`$YcGbJ5eLXZlNLPBD5qJ6FeGNdD1G8hYxJ5QGX5QJ8MZ5XQJ5XQJ5X', 'admin') ON CONFLICT (username) DO NOTHING;"

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Color "Admin user created successfully!" "Green"
        Write-Host "`nCredentials:"
        Write-Host "  Username: admin"
        Write-Host "  Password: Admin123!`n"
    } else {
        Write-Color "Failed to create admin user" "Red"
    }
}

function Test-Login {
    Write-Color "Testing login endpoint..." "Cyan"
    $body = @{
        username = "admin"
        password = "Admin123!"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/login" -Method Post -ContentType "application/json" -Body $body
        $response | ConvertTo-Json
    } catch {
        Write-Color "Login test failed" "Red"
    }
}

# Command router
switch ($Command.ToLower()) {
    "help" { Show-Help }
    "init" { Initialize-Project }
    "up" { Start-Services }
    "down" { Stop-Services }
    "restart" { Restart-Services }
    "logs" { Show-Logs }
    "health" { Check-Health }
    "ps" { Show-Containers }
    "db-shell" { Database-Shell }
    "db-backup" { Backup-Database }
    "grafana" { Open-Grafana }
    "prometheus" { Open-Prometheus }
    "create-admin" { Create-AdminUser }
    "test-login" { Test-Login }
    default {
        Write-Color "Unknown command: $Command" "Red"
        Show-Help
    }
}
