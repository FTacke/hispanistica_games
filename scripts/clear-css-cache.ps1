# Quick CSS Cache Clear Script
# Fügt einen Versions-Parameter zu CSS-Dateien hinzu, um Browser-Cache zu umgehen

param(
    [string]$Version = (Get-Date -Format "yyyyMMddHHmm")
)

$ErrorActionPreference = "Stop"

Write-Host "=== CSS Cache Buster ===" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Yellow
Write-Host ""

# Dateien, die einen Cache-Bust benötigen
$cssFiles = @(
    "static/css/layout.css",
    "static/css/branding.css",
    "static/css/app-tokens.css"
)

Write-Host "Browser-Cache wird über diese Methoden geleert:" -ForegroundColor Cyan
Write-Host "1. Hard Refresh im Browser: Strg+Shift+R (Windows/Linux) oder Cmd+Shift+R (Mac)"
Write-Host "2. DevTools öffnen (F12) → Network Tab → 'Disable cache' aktivieren"
Write-Host "3. Private/Incognito-Modus verwenden"
Write-Host ""

Write-Host "Oder Server neu starten und folgende URL mit ?v Parameter aufrufen:" -ForegroundColor Cyan
Write-Host "http://localhost:8000/?v=$Version" -ForegroundColor Green
Write-Host ""

Write-Host "=== Schnell-Test ===" -ForegroundColor Cyan
Write-Host ""

# Prüfe, ob Server läuft
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000" -UseBasicParsing -TimeoutSec 2
    Write-Host "✓ Server läuft" -ForegroundColor Green
    
    # Öffne Browser mit Cache-Bust
    Write-Host ""
    Write-Host "Öffne Browser mit Cache-Bust..." -ForegroundColor Yellow
    Start-Process "http://localhost:8000/?v=$Version"
    
} catch {
    Write-Host "✗ Server läuft NICHT" -ForegroundColor Red
    Write-Host "  Bitte starten mit: .\scripts\dev-start.ps1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Nach dem Öffnen:" -ForegroundColor Cyan
Write-Host "1. F12 drücken (DevTools öffnen)"
Write-Host "2. Network Tab öffnen"
Write-Host "3. 'Disable cache' aktivieren"
Write-Host "4. F5 drücken (Neu laden)"
Write-Host ""
Write-Host "Erwartete Background-Farbe (Light Mode): #F3F6F7" -ForegroundColor Green
