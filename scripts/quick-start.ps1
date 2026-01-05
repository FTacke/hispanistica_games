<#
.SYNOPSIS
    Ultra-quick start for hispanistica_games development.

.DESCRIPTION
    Minimal setup script that:
    1. Activates venv (creates if needed)
    2. Starts dev server with SQLite

    For first-time setup with dependencies, use: .\scripts\dev-setup.ps1
#>

$ErrorActionPreference = 'Stop'

# Ensure we're in repo root
$repoRoot = $PSScriptRoot
Set-Location $repoRoot

Write-Host "`nHispanistica Games - Quick Start" -ForegroundColor Cyan
Write-Host "=================================`n" -ForegroundColor Cyan

# Check/create venv
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
}

# Activate venv
$activateScript = ".\.venv\Scripts\Activate.ps1"
if (Test-Path $activateScript) {
    Write-Host "Activating virtual environment..." -ForegroundColor Gray
    & $activateScript
}

# Set environment variables
$dbPath = "data/db/auth.db"
$env:AUTH_DATABASE_URL = "sqlite:///$dbPath"
$env:FLASK_SECRET_KEY = "dev-secret-change-me"
$env:JWT_SECRET_KEY = "dev-jwt-secret-change-me"
$env:FLASK_ENV = "development"

Write-Host "Database: SQLite ($dbPath)" -ForegroundColor Green

# Check if SQLite DB exists
if (-not (Test-Path $dbPath)) {
    Write-Host "`nWARN: Auth database not found!" -ForegroundColor Yellow
    Write-Host "Run first-time setup: .\scripts\dev-setup.ps1`n" -ForegroundColor Yellow
    exit 1
}

# Start server
Write-Host "`nStarting dev server at http://localhost:8000" -ForegroundColor Cyan
Write-Host "Login: admin / change-me`n" -ForegroundColor Cyan

$venvPython = ".\.venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    & $venvPython -m src.app.main
} else {
    python -m src.app.main
}
