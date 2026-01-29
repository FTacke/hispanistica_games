<#
.SYNOPSIS
    Quick dev server start (assumes setup is already complete).

.DESCRIPTION
    Use this script for daily development after initial setup with dev-setup.ps1.
    - Checks if Docker PostgreSQL is running (if using -UsePostgres), starts it if not
    - Starts the Flask dev server

    For first-time setup or full reinstall, use: .\scripts\dev-setup.ps1

.EXAMPLE
    # Default: SQLite mode (no Docker needed)
    .\scripts\dev-start.ps1

.EXAMPLE
    # PostgreSQL mode (starts Docker DB if needed)
    .\scripts\dev-start.ps1 -UsePostgres
#>

[CmdletBinding()]
param(
    [switch]$UsePostgres
)

$ErrorActionPreference = 'Stop'

# Repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Determine database mode
if ($UsePostgres) {
    $dbMode = "postgres"
    # Use 127.0.0.1 instead of localhost to avoid DNS resolution issues with psycopg3 on Windows
    $env:AUTH_DATABASE_URL = "postgresql+psycopg://hispanistica_auth:hispanistica_auth@127.0.0.1:54321/hispanistica_auth"
    Write-Host "Database mode: PostgreSQL" -ForegroundColor Green
} else {
    $dbMode = "sqlite"
    $dbPath = "data/db/auth.db"
    $env:AUTH_DATABASE_URL = "sqlite:///$dbPath"
    Write-Host "Database mode: SQLite" -ForegroundColor Yellow
}

# Set common environment variables
$env:FLASK_SECRET_KEY = "dev-secret-change-me"
$env:JWT_SECRET_KEY = "dev-jwt-secret-change-me"
$env:FLASK_ENV = "development"

Write-Host "Starting Hispanistica Games dev server..." -ForegroundColor Cyan
Write-Host "AUTH_DATABASE_URL = $($env:AUTH_DATABASE_URL)"

# Check and start Docker PostgreSQL if needed
$dockerAvailable = Get-Command docker -ErrorAction SilentlyContinue

if ($dbMode -eq "postgres" -and $dockerAvailable) {
    $pgRunning = docker ps --filter "name=hispanistica_auth_db" --format "{{.Names}}" 2>$null
    if (-not $pgRunning) {
        Write-Host "Starting Docker PostgreSQL..." -ForegroundColor Yellow
        docker compose -f docker-compose.dev-postgres.yml up -d hispanistica_auth_db

        Write-Host "Waiting for PostgreSQL..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
    } else {
        Write-Host "Docker PostgreSQL already running." -ForegroundColor Gray
    }
} elseif ($dbMode -eq "postgres" -and -not $dockerAvailable) {
    Write-Host "WARN: Docker not available but Postgres mode selected. Use default SQLite mode." -ForegroundColor Yellow
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
if ($dbMode -eq "postgres") {
    Write-Host "`nApplying DEV-only quiz migrations..." -ForegroundColor Cyan
    $quizMigrateScript = Join-Path $repoRoot "scripts\quiz_dev_migrate.py"
    & $venvPython $quizMigrateScript

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nERROR: Quiz DEV migration failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "[OK] Quiz DEV migrations applied`n" -ForegroundColor Green

    Write-Host "`nRunning quiz content pipeline..." -ForegroundColor Cyan
    Write-Host "  1) Normalize JSON units (IDs + statistics)" -ForegroundColor Gray
    Write-Host "  2) Seed database (upsert)" -ForegroundColor Gray
    Write-Host "  3) Soft prune removed topics" -ForegroundColor Gray
    
    $quizSeedScript = Join-Path $repoRoot "scripts\quiz_seed.py"
    & $venvPython $quizSeedScript --prune-soft
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nERROR: Quiz seed pipeline failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[OK] Quiz content ready`n" -ForegroundColor Green
}

# Run the dev server
Write-Host "Starting Flask dev server at http://localhost:8000" -ForegroundColor Cyan
Write-Host "Login: admin / change-me`n" -ForegroundColor Cyan

& $venvPython -m src.app.main

