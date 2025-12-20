# CSS Background Token Validation

Dieses Script validiert, dass alle CSS-Dateien die kanonischen MD3-Token verwenden.

## Quick Check

```powershell
# Suche nach hardcodierten Background-Farben in CSS
Get-ChildItem -Path static/css -Recurse -Filter *.css | 
  Select-String -Pattern "background:\s*#[0-9A-Fa-f]{6}" | 
  Where-Object { $_.Line -notmatch "comment|/\*" }

# Suche nach hardcodierten Farben in Templates  
Get-ChildItem -Path templates -Recurse -Filter *.html | 
  Select-String -Pattern 'style=".*background.*#[0-9A-Fa-f]{6}' | 
  Where-Object { $_.Line -notmatch "comment" }
```

## Erwartetes Ergebnis

Keine Matches - alle Backgrounds sollten Token verwenden!

## Erlaubte Exceptions

- Critical CSS in `base.html` (FOUC-Prevention)
- Fallback-Werte in `var(--token, #fallback)` Syntax
- Kommentare und Dokumentation

## Theme-Mode Validation

```powershell
# Prüfe Default Theme
$baseHtml = Get-Content "templates/base.html" -Raw
if ($baseHtml -match 'data-theme="([^"]*)"') {
    Write-Host "Default Theme: $($matches[1])" -ForegroundColor Cyan
    if ($matches[1] -eq "light") {
        Write-Host "✓ Korrekt: App startet im Light Mode" -ForegroundColor Green
    } else {
        Write-Host "✗ WARNUNG: App startet nicht im Light Mode!" -ForegroundColor Red
    }
}
```

## CSS-Cascade Validation

```powershell
# Zeige alle --app-background Definitionen
Write-Host "`n=== Critical CSS (base.html) ===" -ForegroundColor Yellow
Get-Content "templates/base.html" | Select-String -Pattern "--app-background:" -Context 1,1

Write-Host "`n=== App Tokens ===" -ForegroundColor Yellow  
Get-Content "static/css/app-tokens.css" | Select-String -Pattern "--app-background:" -Context 1,1

Write-Host "`n=== Branding Override ===" -ForegroundColor Yellow
Get-Content "static/css/branding.css" | Select-String -Pattern "--app-background:" -Context 1,1
```

## Komponenten-Check

```powershell
# Liste alle Komponenten, die --app-background verwenden
Write-Host "`n=== Komponenten mit --app-background ===" -ForegroundColor Yellow
Get-ChildItem -Path static/css/md3/components -Filter *.css | ForEach-Object {
    $matches = Select-String -Path $_.FullName -Pattern "background:\s*var\(--app-background\)"
    if ($matches) {
        Write-Host "  ✓ $($_.Name)" -ForegroundColor Green
    }
}
```

## Full Validation Script

```powershell
# scripts/validate-backgrounds.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== MD3 Background Token Validation ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check Theme Default
$baseHtml = Get-Content "templates/base.html" -Raw
if ($baseHtml -match 'data-theme="([^"]*)"') {
    $theme = $matches[1]
    Write-Host "1. Default Theme: $theme" -ForegroundColor Cyan
    if ($theme -eq "light") {
        Write-Host "   ✓ Korrekt" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Erwartet: light" -ForegroundColor Red
        exit 1
    }
}

# 2. Check für hardcodierte Backgrounds in CSS
Write-Host "`n2. CSS Background Check" -ForegroundColor Cyan
$hardcoded = Get-ChildItem -Path static/css -Recurse -Filter *.css | 
    Select-String -Pattern "background:\s*#[0-9A-Fa-f]{6}(?!.*var\()" |
    Where-Object { 
        $_.Line -notmatch "/\*" -and 
        $_.Line -notmatch "Critical CSS" -and
        $_.Filename -ne "branding.css" -and
        $_.Filename -ne "tokens.css"
    }

if ($hardcoded) {
    Write-Host "   ✗ Hardcodierte Backgrounds gefunden:" -ForegroundColor Red
    $hardcoded | ForEach-Object { Write-Host "     $($_.Filename):$($_.LineNumber)" }
    exit 1
} else {
    Write-Host "   ✓ Keine problematischen Hardcodes" -ForegroundColor Green
}

# 3. Check Token-Kette
Write-Host "`n3. Token-Kette Validation" -ForegroundColor Cyan

$tokensOk = (Get-Content "static/css/md3/tokens.css" -Raw) -match "--md-sys-color-background:\s*#F3F6F7"
$appTokensOk = (Get-Content "static/css/app-tokens.css" -Raw) -match "--app-background:\s*var\(--md-sys-color-background\)"
$brandingOk = (Get-Content "static/css/branding.css" -Raw) -match "--app-background:\s*var\(--brand-background\)"

if ($tokensOk -and $appTokensOk -and $brandingOk) {
    Write-Host "   ✓ Token-Kette korrekt" -ForegroundColor Green
} else {
    Write-Host "   ✗ Token-Kette unterbrochen" -ForegroundColor Red
    Write-Host "     tokens.css: $tokensOk"
    Write-Host "     app-tokens.css: $appTokensOk"
    Write-Host "     branding.css: $brandingOk"
    exit 1
}

# 4. Check Dark Mode Selectors
Write-Host "`n4. Dark Mode Selector Check" -ForegroundColor Cyan
$brandingContent = Get-Content "static/css/branding.css" -Raw
$hasMediaQuery = $brandingContent -match "@media \(prefers-color-scheme: dark\)"
$hasDataTheme = $brandingContent -match ":root\[data-theme=""dark""\]"

if ($hasMediaQuery -and $hasDataTheme) {
    Write-Host "   ✓ Beide Selektoren vorhanden" -ForegroundColor Green
} else {
    Write-Host "   ✗ Selektoren fehlen" -ForegroundColor Red
    Write-Host "     @media: $hasMediaQuery"
    Write-Host "     data-theme: $hasDataTheme"
    exit 1
}

Write-Host "`n=== ✓ Alle Validierungen bestanden ===" -ForegroundColor Green
```
