<#
.SYNOPSIS
    Quick dev server start (assumes setup is already complete).

.DESCRIPTION
    Use this script for daily development after initial setup with dev-setup.ps1.
    - Checks if Docker services (Postgres + BlackLab) are running, starts them if not
    - Starts the Flask dev server

    For first-time setup or full reinstall, use: .\scripts\dev-setup.ps1

.EXAMPLE
    # Default: Postgres mode (starts Docker services if needed)
    .\scripts\dev-start.ps1

.EXAMPLE
    # SQLite mode (no Docker DB needed)
    .\scripts\dev-start.ps1 -UseSQLite

.EXAMPLE
    # Skip BlackLab (if you only need auth/basic features)
    .\scripts\dev-start.ps1 -SkipBlackLab
#>

[CmdletBinding()]
param(
    [switch]$UseSQLite,
    [switch]$SkipBlackLab
)

$ErrorActionPreference = 'Stop'

# Repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Determine database mode
if ($UseSQLite) {
    $dbMode = "sqlite"
    $dbPath = "data/db/auth.db"
    $env:AUTH_DATABASE_URL = "sqlite:///$dbPath"
    Write-Host "Database mode: SQLite" -ForegroundColor Yellow
} else {
    $dbMode = "postgres"
    # Use 127.0.0.1 instead of localhost to avoid DNS resolution issues with psycopg3 on Windows
    $env:AUTH_DATABASE_URL = "postgresql+psycopg://corapan_auth:corapan_auth@127.0.0.1:54320/corapan_auth"
    Write-Host "Database mode: PostgreSQL" -ForegroundColor Green
}

# Set common environment variables
$env:FLASK_SECRET_KEY = "dev-secret-change-me"
$env:JWT_SECRET_KEY = "dev-jwt-secret-change-me"
$env:FLASK_ENV = "development"
$env:BLACKLAB_BASE_URL = "http://localhost:8081/blacklab-server"

Write-Host "Starting CO.RA.PAN dev server..." -ForegroundColor Cyan
Write-Host "AUTH_DATABASE_URL = $($env:AUTH_DATABASE_URL)"

# Check and start Docker services if needed
$dockerAvailable = Get-Command docker -ErrorAction SilentlyContinue

if ($dockerAvailable) {
    $needsStart = @()

    # Check Postgres (unless SQLite mode)
    if ($dbMode -eq "postgres") {
        $pgRunning = docker ps --filter "name=corapan_auth_db" --format "{{.Names}}" 2>$null
        if (-not $pgRunning) {
            $needsStart += "corapan_auth_db"
        }
    }

    # Check BlackLab (unless skipped)
    if (-not $SkipBlackLab) {
        $blRunning = docker ps --filter "name=blacklab-server-v3" --format "{{.Names}}" 2>$null
        if (-not $blRunning) {
            $needsStart += "blacklab-server-v3"
        }
    }

    if ($needsStart.Count -gt 0) {
        $servicesStr = $needsStart -join ", "
        Write-Host "Starting Docker services: $servicesStr" -ForegroundColor Yellow
        & docker compose -f docker-compose.dev-postgres.yml up -d @needsStart

        # Wait briefly for Postgres if starting
        if ($needsStart -contains "corapan_auth_db") {
            Write-Host "Waiting for PostgreSQL..." -ForegroundColor Gray
            Start-Sleep -Seconds 5
        }
    } else {
        Write-Host "Docker services already running." -ForegroundColor Gray
    }
} elseif ($dbMode -eq "postgres") {
    Write-Host "WARN: Docker not available but Postgres mode selected. Use -UseSQLite if needed." -ForegroundColor Yellow
}

# Run the dev server
Write-Host "`nStarting Flask dev server at http://localhost:8000" -ForegroundColor Cyan

# Use venv Python if available, otherwise fall back to system Python
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    & $venvPython -m src.app.main
} else {
    python -m src.app.main
}
