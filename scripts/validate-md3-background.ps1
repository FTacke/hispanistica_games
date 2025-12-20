# MD3 Background Validation Script
# Überprüft, ob hardcodierte Background-Werte (außer in Token-Definitionen) existieren

Write-Host "MD3 Background Standardization - Validation Check" -ForegroundColor Cyan
Write-Host "=" -NoNewline
1..60 | ForEach-Object { Write-Host "=" -NoNewline }
Write-Host ""
Write-Host ""

$rootPath = Split-Path -Parent $PSScriptRoot
$hasErrors = $false

# Test 1: Hardcodierte Hex Background-Werte (außer in Token-Dateien)
Write-Host "[CHECK 1] Hardcodierte Background Hex-Werte..." -ForegroundColor Yellow
$hexBackgrounds = Get-ChildItem -Path "$rootPath\static\css" -Recurse -Filter "*.css" | 
    Where-Object { $_.FullName -notmatch "tokens\.css|branding\.css|transcription-shared\.css" } |
    Select-String -Pattern "background(-color)?:\s*#[0-9A-Fa-f]{6}"

if ($hexBackgrounds) {
    Write-Host "  ❌ FEHLER: Hardcodierte Hex-Werte gefunden:" -ForegroundColor Red
    $hexBackgrounds | ForEach-Object {
        Write-Host "     $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Red
    }
    $hasErrors = $true
} else {
    Write-Host "  ✅ Keine problematischen Hex-Werte gefunden" -ForegroundColor Green
}
Write-Host ""

# Test 2: @media (prefers-color-scheme: dark) außer in Critical CSS
Write-Host "[CHECK 2] @media prefers-color-scheme Dark Mode Selektoren..." -ForegroundColor Yellow
$mediaSelectors = Get-ChildItem -Path "$rootPath\static\css" -Recurse -Filter "*.css" |
    Where-Object { $_.FullName -notmatch "tokens\.css" } |
    Select-String -Pattern "@media.*prefers-color-scheme:\s*dark"

if ($mediaSelectors) {
    Write-Host "  ⚠️  WARNUNG: @media Dark Mode gefunden (sollte nur in Critical CSS sein):" -ForegroundColor Yellow
    $mediaSelectors | ForEach-Object {
        Write-Host "     $($_.Path):$($_.LineNumber)" -ForegroundColor Yellow
    }
    # Not critical, but should be checked
} else {
    Write-Host "  ✅ Keine unerwünschten @media Dark Mode Selektoren" -ForegroundColor Green
}
Write-Host ""

# Test 3: data-theme="light" in base.html
Write-Host "[CHECK 3] Light Mode Default in base.html..." -ForegroundColor Yellow
$baseHtml = Get-Content "$rootPath\templates\base.html" -Raw
if ($baseHtml -match 'data-theme="light"') {
    Write-Host "  ✅ data-theme='light' gefunden" -ForegroundColor Green
} else {
    Write-Host "  ❌ FEHLER: data-theme='light' fehlt in base.html" -ForegroundColor Red
    $hasErrors = $true
}
Write-Host ""

# Test 4: theme.js Default
Write-Host "[CHECK 4] theme.js Default-Logik..." -ForegroundColor Yellow
$themeJs = Get-Content "$rootPath\static\js\theme.js" -Raw
if ($themeJs -match 'return "light"') {
    Write-Host "  ✅ Light Mode als Fallback in theme.js gesetzt" -ForegroundColor Green
} else {
    Write-Host "  ❌ FEHLER: theme.js Default nicht auf 'light' gesetzt" -ForegroundColor Red
    $hasErrors = $true
}
Write-Host ""

# Test 5: Token-Hierarchie (branding.css sollte keine --app-background Overrides haben)
Write-Host "[CHECK 5] Token-Hierarchie (branding.css sollte --app-background nicht überschreiben)..." -ForegroundColor Yellow
$brandingCss = Get-Content "$rootPath\static\css\branding.css" -Raw
if ($brandingCss -match '--app-background:\s*var\(--brand-background\)') {
    Write-Host "  ❌ FEHLER: branding.css überschreibt --app-background (sollte nur in app-tokens.css sein)" -ForegroundColor Red
    $hasErrors = $true
} else {
    Write-Host "  ✅ branding.css überschreibt --app-background nicht" -ForegroundColor Green
}
Write-Host ""

# Test 6: Critical CSS nutzt data-theme Selektoren
Write-Host "[CHECK 6] Critical CSS nutzt data-theme statt @media..." -ForegroundColor Yellow
if ($baseHtml -match ':root\[data-theme="dark"\]') {
    Write-Host "  ✅ Critical CSS nutzt data-theme Selektoren" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  WARNUNG: Critical CSS nutzt möglicherweise @media statt data-theme" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host ""
Write-Host "=" -NoNewline
1..60 | ForEach-Object { Write-Host "=" -NoNewline }
Write-Host ""
if ($hasErrors) {
    Write-Host "VALIDIERUNG FEHLGESCHLAGEN ❌" -ForegroundColor Red
    Write-Host "Bitte behebe die Fehler oben." -ForegroundColor Red
    exit 1
} else {
    Write-Host "VALIDIERUNG ERFOLGREICH ✅" -ForegroundColor Green
    Write-Host "MD3 Background-Standardisierung ist konsistent." -ForegroundColor Green
    exit 0
}
