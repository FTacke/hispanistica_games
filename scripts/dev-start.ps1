<#
.SYNOPSIS
    Quick dev server start (assumes setup is already complete).

.DESCRIPTION
    Use this script for daily development after initial setup with dev-setup.ps1.
    - Starts Docker PostgreSQL (Auth + Quiz)
    - Starts the Flask dev server

    For first-time setup or full reinstall, use: .\scripts\dev-setup.ps1

.EXAMPLE
    # PostgreSQL mode (default)
    .\scripts\dev-start.ps1
#>

[CmdletBinding()]
param(
    [switch]$UsePostgres
)

$ErrorActionPreference = 'Stop'

# Repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Determine database mode (PostgreSQL default)
$dbMode = "postgres"
if ($UsePostgres) {
    Write-Host "[DEPRECATED] -UsePostgres is no longer needed; PostgreSQL is the default." -ForegroundColor Yellow
}

# Use 127.0.0.1 instead of localhost to avoid DNS resolution issues with psycopg3 on Windows
$env:AUTH_DATABASE_URL = "postgresql+psycopg://hispanistica_auth:hispanistica_auth@127.0.0.1:54321/hispanistica_auth"
if (-not $env:QUIZ_DB_HOST) { $env:QUIZ_DB_HOST = "127.0.0.1" }
if (-not $env:QUIZ_DB_PORT) { $env:QUIZ_DB_PORT = "54322" }
if (-not $env:QUIZ_DB_USER) { $env:QUIZ_DB_USER = "hispanistica_quiz" }
if (-not $env:QUIZ_DB_PASSWORD) { $env:QUIZ_DB_PASSWORD = "hispanistica_quiz" }
if (-not $env:QUIZ_DB_NAME) { $env:QUIZ_DB_NAME = "hispanistica_quiz" }
$env:QUIZ_DATABASE_URL = "postgresql+psycopg://$($env:QUIZ_DB_USER):$($env:QUIZ_DB_PASSWORD)@$($env:QUIZ_DB_HOST):$($env:QUIZ_DB_PORT)/$($env:QUIZ_DB_NAME)"
Write-Host "Database mode: PostgreSQL" -ForegroundColor Green

# Set common environment variables
$env:FLASK_SECRET_KEY = "dev-secret-change-me"
$env:JWT_SECRET_KEY = "dev-jwt-secret-change-me"
$env:FLASK_ENV = "development"
if (-not $env:ENV) {
    $env:ENV = "dev"
}

$quizMechanicsNote = ""
if (-not $env:QUIZ_MECHANICS_VERSION) {
    $env:QUIZ_MECHANICS_VERSION = "v2"
    $quizMechanicsNote = " (default)"
}

$quizSeedNote = ""
if (-not $env:QUIZ_DEV_SEED_MODE) {
    $env:QUIZ_DEV_SEED_MODE = "none"
    $quizSeedNote = " (default)"
}

Write-Host "Starting Hispanistica Games dev server..." -ForegroundColor Cyan
$maskedAuthUrl = $env:AUTH_DATABASE_URL -replace ':(.+?)@', ':*****@'
$maskedQuizUrl = $env:QUIZ_DATABASE_URL -replace ':(.+?)@', ':*****@'
Write-Host "AUTH_DATABASE_URL = $maskedAuthUrl"
Write-Host "QUIZ_DATABASE_URL = $maskedQuizUrl"
Write-Host "QUIZ_MECHANICS_VERSION = $($env:QUIZ_MECHANICS_VERSION)$quizMechanicsNote"
Write-Host "QUIZ_DEV_SEED_MODE = $($env:QUIZ_DEV_SEED_MODE)$quizSeedNote"

# Check and start Docker PostgreSQL if needed
$dockerAvailable = Get-Command docker -ErrorAction SilentlyContinue

if ($dockerAvailable) {
    $pgRunning = docker ps --filter "name=hispanistica_auth_db" --format "{{.Names}}" 2>$null
    $quizPgRunning = docker ps --filter "name=hispanistica_quiz_db" --format "{{.Names}}" 2>$null
    if (-not $pgRunning -or -not $quizPgRunning) {
        Write-Host "Starting Docker PostgreSQL..." -ForegroundColor Yellow
        docker compose -f docker-compose.dev-postgres.yml up -d hispanistica_auth_db hispanistica_quiz_db

        Write-Host "Waiting for PostgreSQL..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
    } else {
        Write-Host "Docker PostgreSQL already running." -ForegroundColor Gray
    }
} else {
    Write-Host "ERROR: Docker not available. PostgreSQL dev stack is required." -ForegroundColor Red
    exit 1
}

# Activate venv if available
$venvActivate = Join-Path $repoRoot ".venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    Write-Host "Activating Python virtual environment..." -ForegroundColor Gray
    & $venvActivate
    $venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
} else {
    $venvPython = "python"
}

# Quiz content pipeline (DEV only, PostgreSQL only)
Write-Host "`nEnsuring Auth DB schema..." -ForegroundColor Cyan
$authInitScript = Join-Path $repoRoot "scripts\init_auth_db.py"
& $venvPython $authInitScript
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Auth DB initialization failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Auth DB schema ready`n" -ForegroundColor Green

Write-Host "Ensuring DEV admin (admin_dev/0000)..." -ForegroundColor Cyan
& $venvPython (Join-Path $repoRoot "manage.py") ensure-dev-admin
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: DEV admin provisioning failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] DEV admin ensured`n" -ForegroundColor Green

Write-Host "Ensuring Quiz DB schema..." -ForegroundColor Cyan
$quizInitScript = Join-Path $repoRoot "scripts\init_quiz_db.py"
$prevAuthDbUrl = $env:AUTH_DATABASE_URL
$env:AUTH_DATABASE_URL = $env:QUIZ_DATABASE_URL
& $venvPython $quizInitScript
$initExit = $LASTEXITCODE
if ($prevAuthDbUrl) {
    $env:AUTH_DATABASE_URL = $prevAuthDbUrl
} else {
    Remove-Item env:AUTH_DATABASE_URL -ErrorAction SilentlyContinue
}

if ($initExit -ne 0) {
    Write-Host "`nERROR: Quiz DB initialization failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Quiz DB schema ready`n" -ForegroundColor Green

Write-Host "Applying DEV-only quiz migrations..." -ForegroundColor Cyan
$quizMigrateScript = Join-Path $repoRoot "scripts\quiz_dev_migrate.py"
& $venvPython $quizMigrateScript
$migrateExit = $LASTEXITCODE

if ($migrateExit -ne 0) {
    Write-Host "`nERROR: Quiz DEV migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Quiz DEV migrations applied`n" -ForegroundColor Green

if ($env:QUIZ_DEV_MIGRATE_CONTENT -eq "1") {
    Write-Host "`n[DEV] Migrating quiz content to v2..." -ForegroundColor Cyan
    $quizContentMigrate = Join-Path $repoRoot "scripts\quiz_content_migrate_difficulty_1_3.py"
    & $venvPython $quizContentMigrate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nERROR: Quiz content migration failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Quiz content migration complete`n" -ForegroundColor Green
}

$quizDevSeedMode = $env:QUIZ_DEV_SEED_MODE

Write-Host "`nRunning quiz content pipeline..." -ForegroundColor Cyan
Write-Host "  Seed mode: $quizDevSeedMode" -ForegroundColor Gray

if ($quizDevSeedMode -eq "none") {
    Write-Host "[SKIP] Quiz seeding skipped (QUIZ_DEV_SEED_MODE=none)" -ForegroundColor Yellow
} elseif ($quizDevSeedMode -eq "single") {
    $quizSeedSingleScript = Join-Path $repoRoot "scripts\quiz_seed_single.py"
    $quizSeedSingleFile = Join-Path $repoRoot "content\quiz\topics\variation_aussprache_v2.json"
    if (-not (Test-Path $quizSeedSingleFile)) {
        Write-Host "`nERROR: Missing $quizSeedSingleFile" -ForegroundColor Red
        Write-Host "Run: python scripts/quiz_content_migrate_difficulty_1_3.py" -ForegroundColor Yellow
        exit 1
    }
    & $venvPython $quizSeedSingleScript --file $quizSeedSingleFile
} else {
    Write-Host "  1) Normalize JSON units (IDs + statistics)" -ForegroundColor Gray
    Write-Host "  2) Seed database (upsert)" -ForegroundColor Gray
    Write-Host "  3) Soft prune removed topics" -ForegroundColor Gray
    
    $quizSeedScript = Join-Path $repoRoot "scripts\quiz_seed.py"
    & $venvPython $quizSeedScript --prune-soft
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Quiz seed pipeline failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Quiz content ready`n" -ForegroundColor Green

# Pick a free port (default 8000)
$port = 8000
while (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    $port++
    if ($port -gt 8100) {
        Write-Host "ERROR: No free port found in range 8000-8100." -ForegroundColor Red
        exit 1
    }
}
$env:PORT = $port

# Run the dev server
Write-Host "Starting Flask dev server at http://localhost:$port" -ForegroundColor Cyan
Write-Host "Login: admin_dev / 0000`n" -ForegroundColor Cyan

$serverProcess = Start-Process -FilePath $venvPython -ArgumentList "-m", "src.app.main" -NoNewWindow -PassThru

# Smoke check (DEV only)
if ($env:ENV -eq "dev") {
    $healthUrls = @(
        "http://127.0.0.1:$port/health",
        "http://127.0.0.1:$port/api/quiz/topics"
    )
    $smokeOk = $false
    for ($i = 0; $i -lt 15 -and -not $smokeOk; $i++) {
        Start-Sleep -Seconds 1
        foreach ($url in $healthUrls) {
            try {
                $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
                if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                    Write-Host "[OK] Smoke check: $url" -ForegroundColor Green
                    $smokeOk = $true
                    break
                }
            } catch {
                # try next URL
            }
        }
    }

    if (-not $smokeOk) {
        Write-Host "ERROR: Smoke check failed (server not reachable)." -ForegroundColor Red
        if ($serverProcess -and -not $serverProcess.HasExited) {
            Stop-Process -Id $serverProcess.Id -Force
        }
        exit 1
    }
}

Wait-Process -Id $serverProcess.Id

