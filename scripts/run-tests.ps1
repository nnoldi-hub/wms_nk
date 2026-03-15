#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Rulează toate suitele de teste WMS în mediul Docker de testare.

.DESCRIPTION
    1. Pornește docker-compose.test.yml (PostgreSQL + Redis izolat)
    2. Asteaptă ca serviciile să fie healthy
    3. Rulează jest pentru fiecare serviciu care are teste
    4. Opreste containerele la final
    5. Raportează rezultatele

.EXAMPLE
    .\scripts\run-tests.ps1
    .\scripts\run-tests.ps1 -Service auth
    .\scripts\run-tests.ps1 -KeepContainers
#>

param(
    [string]$Service = '',      # Runs a single service if specified; all if empty
    [switch]$KeepContainers,   # Do not stop docker-compose after tests
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Write-Step($msg) {
    Write-Host "`n$('=' * 60)" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "$('=' * 60)" -ForegroundColor Cyan
}

function Write-OK($msg)   { Write-Host "  [OK]  $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  [ERR] $msg" -ForegroundColor Red }

# ─── Start test infrastructure ────────────────────────────────────────────────

Write-Step "Pornire infrastructură test (docker-compose.test.yml)"
docker-compose -f "$Root\docker-compose.test.yml" up -d
if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker-compose up a eșuat"
    exit 1
}

Write-Host "  Aștept ca PostgreSQL și Redis să fie healthy..." -ForegroundColor Yellow

$maxWait = 60
$waited  = 0
do {
    Start-Sleep 3
    $waited += 3
    $pgHealth    = docker inspect wms-postgres-test --format '{{.State.Health.Status}}' 2>$null
    $redisHealth = docker inspect wms-redis-test    --format '{{.State.Health.Status}}' 2>$null
} while (($pgHealth -ne 'healthy' -or $redisHealth -ne 'healthy') -and $waited -lt $maxWait)

if ($pgHealth -ne 'healthy' -or $redisHealth -ne 'healthy') {
    Write-Fail "Containerele nu sunt healthy după $maxWait secunde (pg=$pgHealth, redis=$redisHealth)"
    docker-compose -f "$Root\docker-compose.test.yml" down -v 2>$null
    exit 1
}

Write-OK "PostgreSQL (wms-postgres-test) healthy"
Write-OK "Redis (wms-redis-test) healthy"

# ─── Test environment variables ───────────────────────────────────────────────

$env:NODE_ENV          = 'test'
$env:DB_HOST           = 'localhost'
$env:DB_PORT           = '5433'
$env:DB_NAME           = 'wms_nks_test'
$env:DB_USER           = 'wms_admin'
$env:DB_PASSWORD       = 'wms_secure_pass_2025'
$env:REDIS_HOST        = 'localhost'
$env:REDIS_PORT        = '6380'
$env:REDIS_PASSWORD    = 'redis_pass_2025'
$env:JWT_SECRET        = 'wms_jwt_secret_key_change_in_production'

# ─── Services to test ─────────────────────────────────────────────────────────

$services = @(
    @{ name = 'auth';           dir = "$Root\services\auth" },
    @{ name = 'inventory';      dir = "$Root\services\inventory" },
    @{ name = 'scanner-service';dir = "$Root\services\scanner-service" },
    @{ name = 'warehouse-config'; dir = "$Root\services\warehouse-config" }
)

if ($Service) {
    $services = $services | Where-Object { $_.name -eq $Service }
    if (-not $services) {
        Write-Fail "Serviciu necunoscut: $Service"
        exit 1
    }
}

# ─── Run tests ────────────────────────────────────────────────────────────────

$results = @()

foreach ($svc in $services) {
    Write-Step "Teste: $($svc.name)"

    if (-not (Test-Path $svc.dir)) {
        Write-Fail "Director lipsă: $($svc.dir)"
        $results += @{ name = $svc.name; success = $false; reason = 'Director lipsă' }
        continue
    }

    # Install devDependencies (supertest may not be installed yet)
    Push-Location $svc.dir
    npm install --silent 2>$null
    $testOutput = npm test 2>&1
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -eq 0) {
        Write-OK "$($svc.name) — toate testele au trecut"
        $results += @{ name = $svc.name; success = $true }
    } else {
        Write-Fail "$($svc.name) — unele teste au eșuat"
        if ($Verbose) { $testOutput | ForEach-Object { Write-Host "    $_" } }
        $results += @{ name = $svc.name; success = $false; reason = 'Test failures' }
    }
}

# ─── Cleanup ──────────────────────────────────────────────────────────────────

if (-not $KeepContainers) {
    Write-Step "Oprire containere test"
    docker-compose -f "$Root\docker-compose.test.yml" down -v
    Write-OK "Containere oprite și volume șterse"
}

# ─── Summary ──────────────────────────────────────────────────────────────────

Write-Host "`n$('═' * 60)" -ForegroundColor White
Write-Host "  REZULTATE TESTE" -ForegroundColor White
Write-Host "$('═' * 60)" -ForegroundColor White

$failed = 0
foreach ($r in $results) {
    if ($r.success) {
        Write-Host "  [PASS] $($r.name)" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $($r.name)  ($($r.reason))" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
if ($failed -eq 0) {
    Write-Host "  Toate testele au trecut! ($($results.Count)/$($results.Count))" -ForegroundColor Green
    exit 0
} else {
    Write-Host "  $failed din $($results.Count) servicii au eșuat." -ForegroundColor Red
    exit 1
}
