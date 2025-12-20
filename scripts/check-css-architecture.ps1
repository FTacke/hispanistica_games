# CSS Architecture Checker
# Erzwingt Layer-Separation: branding.css darf nur Variablen enthalten

Write-Host "CSS Architecture Check - Layer Validation" -ForegroundColor Cyan
Write-Host "=" -NoNewline
1..60 | ForEach-Object { Write-Host "=" -NoNewline }
Write-Host ""
Write-Host ""

$rootPath = Split-Path -Parent $PSScriptRoot
$hasErrors = $false

# Test 1: branding.css darf nur Variablen enthalten (keine Klassen/IDs)
Write-Host "[CHECK 1] branding.css: Nur Variablen erlaubt (keine Komponenten-Regeln)..." -ForegroundColor Yellow

$brandingFile = "$rootPath\static\css\branding.css"
$brandingContent = Get-Content $brandingFile -Raw

# Erlaubte Selektoren (Variablen-Definitionen)
$allowedSelectors = @(
    ':root',
    ':root\[data-theme="dark"\]',
    ':root\[data-theme="auto"\]\[data-system-dark="true"\]'
)

# Suche nach Klassen-Selektoren (.class) oder ID-Selektoren (#id)
$classSelectors = Select-String -Path $brandingFile -Pattern '^\.[a-zA-Z]|^#[a-zA-Z]|^\s+\.[a-zA-Z]|^\s+#[a-zA-Z]' -AllMatches

if ($classSelectors) {
    Write-Host "  ❌ FEHLER: branding.css enthält Komponenten-Regeln (Klassen/IDs):" -ForegroundColor Red
    $classSelectors | ForEach-Object {
        Write-Host "     Zeile $($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "  REGEL: branding.css darf nur enthalten:" -ForegroundColor Yellow
    Write-Host "    - :root { --brand-* }" -ForegroundColor Yellow
    Write-Host "    - :root { --md-sys-* : var(--brand-*) }" -ForegroundColor Yellow
    Write-Host "    - :root[data-theme='dark'] { ... }" -ForegroundColor Yellow
    Write-Host "  KEINE .class oder #id Selektoren erlaubt!" -ForegroundColor Yellow
    $hasErrors = $true
} else {
    Write-Host "  ✅ branding.css enthält nur Variablen-Definitionen" -ForegroundColor Green
}
Write-Host ""

# Test 2: branding.css: Keine Pixel-Werte außer in Variablen
Write-Host "[CHECK 2] branding.css: Keine Layout-Werte (width, height, padding außer in Variablen)..." -ForegroundColor Yellow

$layoutProperties = Select-String -Path $brandingFile -Pattern '\s+(width|height|padding|margin|font-size):\s+[0-9]' -AllMatches

if ($layoutProperties) {
    # Filter: Nur melden, wenn NICHT in Variablen-Definition (--*)
    $nonVarLayout = $layoutProperties | Where-Object { $_.Line -notmatch '--[a-zA-Z]' }
    
    if ($nonVarLayout) {
        Write-Host "  ❌ FEHLER: branding.css enthält Layout-Properties außerhalb von Variablen:" -ForegroundColor Red
        $nonVarLayout | ForEach-Object {
            Write-Host "     Zeile $($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "  REGEL: Layout-Properties gehören in Component-Dateien!" -ForegroundColor Yellow
        $hasErrors = $true
    } else {
        Write-Host "  ✅ Keine Layout-Properties außerhalb von Variablen" -ForegroundColor Green
    }
} else {
    Write-Host "  ✅ Keine Layout-Properties gefunden" -ForegroundColor Green
}
Write-Host ""

# Test 3: Keine Komponenten-spezifischen Klassen in branding.css
Write-Host "[CHECK 3] branding.css: Keine md3-* oder app-* Komponentenklassen..." -ForegroundColor Yellow

$componentClasses = Select-String -Path $brandingFile -Pattern '\.(md3-|app-)[a-zA-Z-_]+\s*\{' -AllMatches

if ($componentClasses) {
    Write-Host "  ❌ FEHLER: branding.css enthält Komponenten-Klassen:" -ForegroundColor Red
    $componentClasses | ForEach-Object {
        Write-Host "     Zeile $($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "  Diese Regeln gehören in:" -ForegroundColor Yellow
    Write-Host "    - .md3-navigation-* → md3/components/navigation-drawer.css" -ForegroundColor Yellow
    Write-Host "    - .md3-index-* → md3/components/index.css" -ForegroundColor Yellow
    Write-Host "    - .md3-footer-* → md3/components/footer.css" -ForegroundColor Yellow
    $hasErrors = $true
} else {
    Write-Host "  ✅ Keine Komponenten-Klassen in branding.css" -ForegroundColor Green
}
Write-Host ""

# Test 4: CSS-Ladereihenfolge in base.html validieren
Write-Host "[CHECK 4] base.html: CSS-Ladereihenfolge korrekt..." -ForegroundColor Yellow

$baseHtml = Get-Content "$rootPath\templates\base.html" -Raw

# Extrahiere CSS-Links (vereinfacht)
$cssLinks = [regex]::Matches($baseHtml, 'href="[^"]*\.css"') | ForEach-Object { $_.Value }

# Prüfe kritische Reihenfolge: tokens.css BEFORE branding.css BEFORE components
$tokensIndex = 0
$brandingIndex = 0
$componentsIndex = 0

for ($i = 0; $i -lt $cssLinks.Count; $i++) {
    if ($cssLinks[$i] -match 'md3/tokens\.css') { $tokensIndex = $i }
    if ($cssLinks[$i] -match 'branding\.css') { $brandingIndex = $i }
    if ($cssLinks[$i] -match 'components/.*\.css') { 
        if ($componentsIndex -eq 0) { $componentsIndex = $i }
    }
}

if ($tokensIndex -gt 0 -and $brandingIndex -gt $tokensIndex -and $componentsIndex -gt $brandingIndex) {
    Write-Host "  ✅ CSS-Ladereihenfolge korrekt: tokens → branding → components" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  WARNUNG: CSS-Ladereihenfolge könnte problematisch sein" -ForegroundColor Yellow
    Write-Host "     tokens.css: Position $tokensIndex" -ForegroundColor Yellow
    Write-Host "     branding.css: Position $brandingIndex" -ForegroundColor Yellow
    Write-Host "     components: Position $componentsIndex" -ForegroundColor Yellow
    # Nicht kritisch, aber erwähnenswert
}
Write-Host ""

# Summary
Write-Host ""
Write-Host "=" -NoNewline
1..60 | ForEach-Object { Write-Host "=" -NoNewline }
Write-Host ""
if ($hasErrors) {
    Write-Host "CSS ARCHITECTURE VALIDATION FEHLGESCHLAGEN ❌" -ForegroundColor Red
    Write-Host "Bitte behebe die Layer-Violations oben." -ForegroundColor Red
    Write-Host ""
    Write-Host "Siehe docs/md3/css-architecture.md für Details." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "CSS ARCHITECTURE VALIDATION ERFOLGREICH ✅" -ForegroundColor Green
    Write-Host "Alle Layer-Regeln werden eingehalten." -ForegroundColor Green
    exit 0
}
