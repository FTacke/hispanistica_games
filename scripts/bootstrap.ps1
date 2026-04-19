<#
.SYNOPSIS
    Idempotentes Windows-Bootstrap für lokale Entwicklung mit uv.

.DESCRIPTION
    - Prüft, ob uv verfügbar ist.
    - Erstellt .venv im Repo-Root (falls nicht vorhanden).
    - Installiert Runtime-Dependencies aus requirements.txt (+ constraints).
    - Installiert optional Dev-Dependencies mit -Dev (nur aus requirements-dev.txt, falls vorhanden).
    - Gibt bei fehlender .env nur einen Hinweis aus.

.EXAMPLE
    .\scripts\bootstrap.ps1

.EXAMPLE
    .\scripts\bootstrap.ps1 -Dev
#>

[CmdletBinding()]
param(
    [switch]$Dev
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "[bootstrap] Repository: $repoRoot"

$uv = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uv) {
    Write-Host "[bootstrap] ERROR: 'uv' wurde nicht gefunden." -ForegroundColor Red
    Write-Host "[bootstrap] Installiere uv zuerst:" -ForegroundColor Yellow
    Write-Host "powershell -ExecutionPolicy ByPass -c \"irm https://astral.sh/uv/install.ps1 | iex\""
    exit 1
}

$venvPath = Join-Path $repoRoot ".venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "[bootstrap] Erstelle virtuelle Umgebung: .venv"
    & uv venv .venv
} else {
    Write-Host "[bootstrap] Nutze bestehende virtuelle Umgebung: .venv"
}

$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Host "[bootstrap] ERROR: Python in .venv wurde nicht gefunden ($pythonExe)." -ForegroundColor Red
    exit 1
}

$requirementsFile = Join-Path $repoRoot "requirements.txt"
$constraintsFile = Join-Path $repoRoot "requirements\constraints.txt"
if (-not (Test-Path $requirementsFile)) {
    Write-Host "[bootstrap] ERROR: requirements.txt fehlt." -ForegroundColor Red
    exit 1
}

if (Test-Path $constraintsFile) {
    Write-Host "[bootstrap] Installiere Runtime-Dependencies aus requirements.txt + constraints.txt"
    & uv pip install --python $pythonExe -r $requirementsFile -c $constraintsFile
} else {
    Write-Host "[bootstrap] Installiere Runtime-Dependencies aus requirements.txt"
    & uv pip install --python $pythonExe -r $requirementsFile
}

Write-Host "[bootstrap] Stelle PostgreSQL-Driver fuer postgresql+psycopg sicher"
& uv pip install --python $pythonExe "psycopg[binary]"

if ($Dev) {
    $requirementsDevFile = Join-Path $repoRoot "requirements-dev.txt"
    if (Test-Path $requirementsDevFile) {
        if (Test-Path $constraintsFile) {
            Write-Host "[bootstrap] Installiere Dev-Dependencies aus requirements-dev.txt + constraints.txt"
            & uv pip install --python $pythonExe -r $requirementsDevFile -c $constraintsFile
        } else {
            Write-Host "[bootstrap] Installiere Dev-Dependencies aus requirements-dev.txt"
            & uv pip install --python $pythonExe -r $requirementsDevFile
        }
    } else {
        Write-Host "[bootstrap] Hinweis: -Dev gesetzt, aber keine requirements-dev.txt gefunden. Dev-Install wird übersprungen." -ForegroundColor Yellow
    }
}

$envFile = Join-Path $repoRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[bootstrap] Hinweis: .env fehlt. Vorlage: .env.example" -ForegroundColor Yellow
}

Write-Host "[bootstrap] Fertig." -ForegroundColor Green
