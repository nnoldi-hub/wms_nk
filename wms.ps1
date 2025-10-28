# WMS-NKS Management Script pentru Windows PowerShell
# Usage: .\wms.ps1 <command>

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Blue($message) { Write-Host $message -ForegroundColor Blue }
function Write-Green($message) { Write-Host $message -ForegroundColor Green }
function Write-Yellow($message) { Write-Host $message -ForegroundColor Yellow }
function Write-Red($message) { Write-Host $message -ForegroundColor Red }

function Show-Help {
    Write-Blue "╔════════════════════════════════════════╗"
    Write-Blue "║   WMS-NKS Management Commands          ║"
    Write-Blue "╚════════════════════════════════════════╝"
    Write-Host ""
    Write-Green "Development:"
    Write-Host "  .\wms.ps1 init              - Initialize project (first time setup)"
    Write-Host "  .\wms.ps1 up                - Start all services"
    Write-Host "  .\wms.ps1 down              - Stop all services"
    Write-Host "  .\wms.ps1 restart           - Restart all services"
    Write-Host "  .\wms.ps1 logs              - View logs (all services)"
    Write-Host "  .\wms.ps1 logs <service>    - View specific service logs"
    Write-Host "  .\wms.ps1 health            - Check service health"
    Write-Host "  .\wms.ps1 ps                - Show running containers"
    Write-Host ""
    Write-Green "Database:"
    Write-Host "  .\wms.ps1 db-shell          - Connect to PostgreSQL shell"
    Write-Host "  .\wms.ps1 db-backup         - Backup database"
    Write-Host "  .\wms.ps1 db-restore        - Restore latest backup"
    Write-Host "  .\wms.ps1 db-reset          - Reset database (DANGER!)"
    Write-Host ""
    Write-Green "Monitoring:"
    Write-Host "  .\wms.ps1 grafana           - Open Grafana in browser"
    Write-Host "  .\wms.ps1 prometheus        - Open Prometheus in browser"
    Write-Host "  .\wms.ps1 kong-ui           - Open Kong admin UI"
    Write-Host "  .\wms.ps1 rabbitmq-ui       - Open RabbitMQ management"
    Write-Host ""
    Write-Green "User Management:"
    Write-Host "  .\wms.ps1 create-admin      - Create admin user"
    Write-Host ""
    Write-Green "Testing:"
    Write-Host "  .\wms.ps1 test-login        - Test login endpoint"
    Write-Host "  .\wms.ps1 test-health       - Test all health endpoints"
    Write-Host ""
    Write-Green "Cleanup:"
    Write-Host "  .\wms.ps1 clean             - Remove all containers & volumes"
    Write-Host "  .\wms.ps1 clean-logs        - Remove log files"
    Write-Host ""
}

function Initialize-Project {
    Write-Blue "╔════════════════════════════════════════╗"
    Write-Blue "║   WMS-NKS Project Initialization       ║"
    Write-Blue "╚════════════════════════════════════════╝"
    Write-Host ""

    # Check Docker
    try {
        docker --version | Out-Null
        Write-Green "✓ Docker is installed"
    } catch {
        Write-Red "✗ Docker is not installed. Please install Docker Desktop for Windows."
        exit 1
    }

    # Check Docker Compose
    try {
        docker-compose --version | Out-Null
        Write-Green "✓ Docker Compose is installed"
    } catch {
        Write-Red "✗ Docker Compose is not installed."
        exit 1
    }

    # Create .env file
    if (-not (Test-Path ".env")) {
        Write-Blue "Creating .env file from .env.example..."
        Copy-Item ".env.example" ".env"
        Write-Green "✓ .env file created"
        Write-Yellow "⚠ Please review and update passwords in .env file"
    } else {
        Write-Yellow "⚠ .env file already exists"
    }

    # Create directories
    Write-Blue "Creating necessary directories..."
    @("backups", "logs", "data\postgres", "data\redis", "data\grafana") | ForEach-Object {
        if (-not (Test-Path $_)) {
            New-Item -ItemType Directory -Path $_ -Force | Out-Null
        }
    }
    Write-Green "✓ Directories created"

    # Pull images
    Write-Blue "Pulling Docker images..."
    docker-compose pull

    # Start infrastructure
    Write-Blue "Starting infrastructure services..."
    docker-compose up -d postgres redis rabbitmq

    # Wait for PostgreSQL
    Write-Blue "Waiting for PostgreSQL to be ready..."
    $maxAttempts = 30
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            docker-compose exec -T postgres pg_isready -U wms_admin 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                break
            }
        } catch {}
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 1
        $attempt++
    }
    Write-Host ""
    Write-Green "✓ PostgreSQL is ready"

    # Wait for Redis
    Write-Blue "Waiting for Redis to be ready..."
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            docker-compose exec -T redis redis-cli -a redis_pass_2025 ping 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                break
            }
        } catch {}
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 1
        $attempt++
    }
    Write-Host ""
    Write-Green "✓ Redis is ready"

    # Start all services
    Write-Blue "Starting all services..."
    docker-compose up -d

    Write-Host ""
    Write-Green "╔════════════════════════════════════════╗"
    Write-Green "║   WMS-NKS Initialized Successfully!    ║"
    Write-Green "╚════════════════════════════════════════╝"
    Write-Host ""
    Write-Blue "Available Services:"
    Write-Host "  Kong Gateway:      http://localhost:8000"
    Write-Host "  Konga Admin UI:    http://localhost:1337"
    Write-Host "  Grafana:           http://localhost:3001 (admin/grafana_admin_2025)"
    Write-Host "  Prometheus:        http://localhost:9090"
    Write-Host "  RabbitMQ UI:       http://localhost:15672 (wms_queue/queue_pass_2025)"
    Write-Host ""
    Write-Blue "Next Steps:"
    Write-Host "  1. Run: " -NoNewline; Write-Yellow ".\wms.ps1 create-admin" -NoNewline; Write-Host " to create admin user"
    Write-Host "  2. Run: " -NoNewline; Write-Yellow ".\wms.ps1 health" -NoNewline; Write-Host " to check service health"
    Write-Host "  3. Run: " -NoNewline; Write-Yellow ".\wms.ps1 logs" -NoNewline; Write-Host " to view logs"
    Write-Host ""
}

function Start-Services {
    Write-Blue "Starting all services..."
    docker-compose up -d
    Write-Green "✓ All services started!"
    Write-Yellow "Run '.\wms.ps1 health' to check status"
}

function Stop-Services {
    Write-Blue "Stopping all services..."
    docker-compose down
    Write-Green "✓ All services stopped!"
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
    Write-Blue "Checking service health..."
    Write-Host ""
    
    Write-Yellow "Auth Service:"
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3010/health" -Method Get -ErrorAction Stop
        $response | ConvertTo-Json
    } catch {
        Write-Red "✗ Auth service not responding"
    }
    
    Write-Host ""
    Write-Yellow "Inventory Service:"
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3011/health" -Method Get -ErrorAction Stop
        $response | ConvertTo-Json
    } catch {
        Write-Red "✗ Inventory service not responding"
    }
    
    Write-Host ""
    Write-Yellow "PostgreSQL:"
    try {
        docker-compose exec -T postgres pg_isready -U wms_admin | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Green "✓ PostgreSQL is ready"
        }
    } catch {
        Write-Red "✗ PostgreSQL not ready"
    }
    
    Write-Host ""
    Write-Yellow "Redis:"
    try {
        docker-compose exec -T redis redis-cli -a redis_pass_2025 ping | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Green "✓ Redis is ready"
        }
    } catch {
        Write-Red "✗ Redis not ready"
    }
}

function Show-Containers {
    docker-compose ps
}

function Database-Shell {
    docker-compose exec postgres psql -U wms_admin -d wms_nks
}

function Backup-Database {
    Write-Blue "Backing up database..."
    if (-not (Test-Path "backups")) {
        New-Item -ItemType Directory -Path "backups" -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    docker-compose exec -T postgres pg_dump -U wms_admin wms_nks > "backups\wms_nks_$timestamp.sql"
    Write-Green "✓ Database backed up to backups\wms_nks_$timestamp.sql"
}

function Restore-Database {
    $latestBackup = Get-ChildItem "backups\*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestBackup) {
        Write-Yellow "This will restore from: $($latestBackup.Name)"
        $confirm = Read-Host "Continue? (y/N)"
        if ($confirm -eq "y") {
            Get-Content $latestBackup.FullName | docker-compose exec -T postgres psql -U wms_admin wms_nks
            Write-Green "✓ Database restored from $($latestBackup.Name)"
        }
    } else {
        Write-Red "✗ No backup files found in backups\"
    }
}

function Reset-Database {
    Write-Red "WARNING: This will delete all data!"
    $confirm = Read-Host "Type 'yes' to confirm"
    if ($confirm -eq "yes") {
        docker-compose down -v
        docker-compose up -d postgres
        Start-Sleep -Seconds 5
        Write-Green "✓ Database reset complete"
    }
}

function Open-Grafana {
    Write-Blue "Opening Grafana..."
    Start-Process "http://localhost:3001"
    Write-Yellow "Username: admin | Password: grafana_admin_2025"
}

function Open-Prometheus {
    Write-Blue "Opening Prometheus..."
    Start-Process "http://localhost:9090"
}

function Open-KongUI {
    Write-Blue "Opening Konga (Kong Admin UI)..."
    Start-Process "http://localhost:1337"
}

function Open-RabbitMQUI {
    Write-Blue "Opening RabbitMQ Management..."
    Start-Process "http://localhost:15672"
    Write-Yellow "Username: wms_queue | Password: queue_pass_2025"
}

function Create-AdminUser {
    Write-Blue "╔════════════════════════════════════════╗"
    Write-Blue "║      Create Admin User                 ║"
    Write-Blue "╚════════════════════════════════════════╝"
    Write-Host ""

    $passwordHash = '$2a$10$YcGbJ5eLXZlNLPBD5qJ6FeGNdD1G8hYxJ5QGX5QJ8MZ5XQJ5XQJ5X'
    
    $sql = @"
INSERT INTO users (username, email, password_hash, role) 
VALUES (
    'admin',
    'admin@wms-nks.local',
    '$passwordHash',
    'admin'
) ON CONFLICT (username) DO NOTHING;
"@

    $sql | docker-compose exec -T postgres psql -U wms_admin -d wms_nks

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Green "✓ Admin user created successfully!"
        Write-Host ""
        Write-Blue "Login Credentials:"
        Write-Host "  Username: admin"
        Write-Host "  Password: Admin123!"
        Write-Host ""
    } else {
        Write-Red "✗ Failed to create admin user"
    }
}

function Test-Login {
    Write-Blue "Testing login endpoint..."
    $body = @{
        username = "admin"
        password = "Admin123!"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/login" `
            -Method Post `
            -ContentType "application/json" `
            -Body $body
        $response | ConvertTo-Json
    } catch {
        Write-Red "✗ Login test failed: $($_.Exception.Message)"
    }
}

function Test-HealthEndpoints {
    Write-Blue "Testing health endpoints..."
    
    Write-Host "Auth: "
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3010/health"
        $response | ConvertTo-Json
    } catch {
        Write-Red "Failed"
    }
    
    Write-Host "Inventory: "
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3011/health"
        $response | ConvertTo-Json
    } catch {
        Write-Red "Failed"
    }
}

function Clean-All {
    Write-Red "WARNING: This will remove all containers, volumes, and networks!"
    $confirm = Read-Host "Type 'yes' to confirm"
    if ($confirm -eq "yes") {
        docker-compose down -v --remove-orphans
        Write-Green "✓ Cleanup complete"
    }
}

function Clean-Logs {
    Write-Blue "Removing log files..."
    Get-ChildItem -Recurse -Filter "*.log" | Remove-Item -Force
    Write-Green "✓ Log files removed"
}

# Main command router
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
    "db-restore" { Restore-Database }
    "db-reset" { Reset-Database }
    "grafana" { Open-Grafana }
    "prometheus" { Open-Prometheus }
    "kong-ui" { Open-KongUI }
    "rabbitmq-ui" { Open-RabbitMQUI }
    "create-admin" { Create-AdminUser }
    "test-login" { Test-Login }
    "test-health" { Test-HealthEndpoints }
    "clean" { Clean-All }
    "clean-logs" { Clean-Logs }
    default {
        Write-Red "Unknown command: $Command"
        Write-Host ""
        Show-Help
    }
}
