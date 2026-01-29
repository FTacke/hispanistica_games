<#
.SYNOPSIS
    DEV-only reset for quiz v2 content.

.DESCRIPTION
    Hard prune quiz tables, migrate content to v2, seed single unit, and optionally start server.
#>

[CmdletBinding()]
param(
    [switch]$StartServer
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# ENV for DEV-only workflow
if (-not $env:ENV) { $env:ENV = 'dev' }
$env:QUIZ_MECHANICS_VERSION = 'v2'
$env:QUIZ_DEV_SEED_MODE = 'single'

# Ensure venv python
$venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    $venvPython = "python"
}

Write-Host "[1/4] Hard prune quiz tables" -ForegroundColor Cyan
& $venvPython scripts\quiz_dev_prune.py --i-know-what-im-doing
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "[2/4] Migrate content to v2" -ForegroundColor Cyan
& $venvPython scripts\quiz_content_migrate_difficulty_1_3.py
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "[3/4] Seed single unit (variation_aussprache_v2.json)" -ForegroundColor Cyan
$seedFile = Join-Path $repoRoot "content\quiz\topics\variation_aussprache_v2.json"
if (-not (Test-Path $seedFile)) {
    Write-Host "Missing: $seedFile" -ForegroundColor Red
    exit 1
}
& $venvPython scripts\quiz_seed_single.py --file $seedFile
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "[4/4] Done" -ForegroundColor Green
if ($StartServer) {
    Write-Host "Starting dev server..." -ForegroundColor Cyan
    & $venvPython -m src.app.main
} else {
    Write-Host "Start server with: .\scripts\dev-start.ps1 -UsePostgres" -ForegroundColor Gray
}
