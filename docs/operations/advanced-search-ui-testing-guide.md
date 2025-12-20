---
title: "Advanced Search UI - Testing & Validation"
status: active
owner: qa-team
updated: "2025-11-10"
tags: [frontend, testing, ui, advanced-search, validation, security]
links:
  - advanced-search-live-testing.md
  - ../reference/cql-escaping-rules.md
  - ../how-to/advanced-search.md
---

# Advanced Search UI - Testing Guide

## Quick Start

### 1. Launch
```bash
export FLASK_ENV=production
export BLS_BASE_URL=http://127.0.0.1:8081/blacklab-server
python -m src.app.main
```

**URL**: http://localhost:5000/search/advanced

### 2. Run Tests
```bash
# Backend tests (bestehend)
python scripts/test_advanced_search_real.py

# Manual UI tests (siehe unten)
```

---

## Manual UI Tests

### Test Suite 1: Form Input & Controls

#### Test 1.1: Q-Input + Mode + Sensitive
**Aktion**:
```
1. Gebe "palabra" in Q-Input
2. Wähle Mode = "Forma exacta"
3. Wähle Sensitive = "Insensible"
4. Öffne Browser DevTools → Network
5. Klicke "Buscar"
```

**Erwartung**:
- Request zu `/search/advanced/data?q=palabra&mode=forma_exacta&sensitive=0&...`
- Network-Tab zeigt Status 200
- Response hat `recordsTotal`, `recordsFiltered`, `data[]`

**Bestanden wenn**: ✅ Request-URL korrekt, Response gültig

---

#### Test 1.2: Multi-Select Filter
**Aktion**:
```
1. Öffne Country-Dropdown, wähle ARG + CHL
2. Öffne Speaker-Dropdown, wähle "Profesional"
3. Öffne Sex-Dropdown, wähle "Femenino"
4. Öffne Mode-Dropdown, wähle "Lectura"
5. Öffne Discourse-Dropdown, wähle "General"
6. Klicke "Buscar"
```

**Erwartung**:
- Request enthält:
  ```
  country_code=ARG&country_code=CHL
  &speaker_type=pro
  &sex=f
  &speech_mode=lectura
  &discourse=general
  ```
- Summary zeigt `recordsFiltered < recordsTotal` (weil Filter aktiv)
- Badge "Filtro activo" sichtbar

**Bestanden wenn**: ✅ Alle Filter im Request, Badge sichtbar

---

#### Test 1.3: Include Regional Checkbox
**Aktion**:
```
1. Wähle Country = ARG
2. Markiere "Incluir emisoras regionales"
3. Klicke "Buscar"
```

**Erwartung**:
- Request: `country_code=ARG&include_regional=1`
- Zusätzliche Ergebnisse (da regionale Sender miteinbezogen)

**Bestanden wenn**: ✅ `include_regional=1` im Request

---

### Test Suite 2: DataTables & Pagination

#### Test 2.1: Tabelle wird geladen
**Aktion**:
```
1. Suche "el"
2. Warte auf Tabelle
```

**Erwartung**:
- Tabelle mit 12 Spalten sichtbar
- Mindestens 25 Zeilen gerendert
- Spalten: #, Contexto ←, Resultado, Contexto →, Audio, País, Hablante, Sexo, Modo, Discurso, Token-ID, Archivo
- Alle Werte in Cells vorhanden (oder "-" wenn null)

**Bestanden wenn**: ✅ Tabelle komplett sichtbar, KWIC bold

---

#### Test 2.2: KWIC Rendering
**Aktion**:
```
1. Inspiziere eine Tabellenzeile (DevTools)
2. Schaue auf "Resultado" Column
```

**Erwartung**:
- Match-Text ist `<mark>`-Element (bold/highlighted)
- Links-Kontext normal
- Rechts-Kontext normal
- Beispiel: `... context <mark>palabra</mark> context ...`

**Bestanden wenn**: ✅ `<mark>` Element vorhanden, styling aktiv

---

#### Test 2.3: Pagination Controls
**Aktion**:
```
1. Suche "el"
2. Scrolle zur Bottom der Tabelle
3. Sehe Pagination Controls
4. Klicke "50" in Length-Menu
5. Warte auf Re-Load
```

**Erwartung**:
- Length-Menu: [25, 50, 100] Optionen
- Seite zeigt 50 Einträge
- Pagination Buttons: Erste, Vorherige, 1 2 3..., Nächste, Letzte
- "Info" zeigt: "Mostrando 1 a 50 de X resultados"

**Bestanden wenn**: ✅ Pagination funktioniert, Seitenwechsel erfolgt

---

#### Test 2.4: No Client-Side Search
**Aktion**:
```
1. Öffne DevTools
2. Schaue nach einer "Search"-Box in Tabelle
```

**Erwartung**:
- **KEINE** Suchbox für "Filter this table" sichtbar
- Nur Server-Side-Pagination vorhanden

**Bestanden wenn**: ✅ Client-Search deaktiviert (searching: false)

---

### Test Suite 3: Summary Box & Filters

#### Test 3.1: Summary anzeigen
**Aktion**:
```
1. Suche "casa"
2. Schaue auf Summary-Box (unter Filter-Buttons)
```

**Erwartung**:
- Summary-Box sichtbar mit Text: "Resultados: X de Y documentos"
- X = recordsFiltered, Y = recordsTotal
- Border-left ist Primärfarbe

**Bestanden wenn**: ✅ Summary-Box vorhanden, Zahlen korrekt

---

#### Test 3.2: Filter Badge
**Aktion**:
```
1. Suche "el" ohne Filter
2. Merke recordsTotal (z.B. 1000)
3. Suche erneut mit Country=ARG
4. Merke recordsFiltered (z.B. 500)
```

**Erwartung**:
- Ohne Filter: Badge **nicht** sichtbar
- Mit Filter (500 < 1000): Badge "Filtro activo" **sichtbar**

**Bestanden wenn**: ✅ Badge nur bei Filter-Reduktion

---

### Test Suite 4: Export Buttons

#### Test 4.1: CSV Export
**Aktion**:
```
1. Suche "palabra" (mindestens 5 Treffer)
2. Klicke "Exportar CSV"
3. Öffne heruntergeladene Datei (z.B. in Excel)
```

**Erwartung**:
- Download startet automatisch
- Dateiname: `export_<timestamp>.csv`
- Header: `left,match,right,country,speaker_type,sex,mode,discourse,filename,tokid,start_ms,end_ms`
- Zeilen: Für jeden Treffer eine Zeile
- Encoding: UTF-8 (keine Zeichen-Probleme mit Ä, é, etc.)

**Bestanden wenn**: ✅ CSV öffnet sich in Excel, Header + Daten vorhanden

---

#### Test 4.2: TSV Export
**Aktion**:
```
1. Klicke "Exportar TSV"
2. Öffne heruntergeladene Datei
```

**Erwartung**:
- Dateiname: `export_<timestamp>.tsv`
- Spalten-Trennzeichen: Tab (\t)
- Keine Komma-Trennzeichen
- Datengröße > CSV-Größe (weil mehr Platz für längere Werte)

**Bestanden wenn**: ✅ TSV mit Tab-Trennung, öffnet in Excel

---

### Test Suite 5: Reset Button

#### Test 5.1: Reset Functionality
**Aktion**:
```
1. Suche "palabra" mit Filtern
2. Verifiziere Tabelle sichtbar
3. Klicke "Restablecer"
4. Warte 1 Sekunde
5. Überprüfe alle Werte
```

**Erwartung**:
- Q-Input: leer
- POS-Input: leer
- Mode-Select: "Forma" (default)
- Sensitive-Select: "Sensible" (default)
- Country-Select: leer
- Speaker-Select: leer
- Sex-Select: leer
- Mode-Select (Filter): leer
- Discourse-Select: leer
- Regional-Checkbox: unchecked
- Tabelle: **nicht** sichtbar
- Summary-Box: **nicht** sichtbar

**Bestanden wenn**: ✅ Alle Felder auf Defaults zurückgesetzt

---

#### Test 5.2: Keyboard Navigation
**Aktion**:
```
1. Gebe "palabra" ein
2. Klicke "Buscar"
3. Beobachte: Browser springt zur Summary-Box
4. Drücke Tab mehrmals
5. Verifiziere: Fokus bewegt sich zu Export-Buttons, dann Tabelle
```

**Erwartung**:
- Nach Submit: Fokus auf Summary-Box (role="status")
- Summary-Box scrollt in Sicht
- Tab-Reihenfolge: Export CSV → Export TSV → Tabelle
- Tab-Fokus sichtbar (Outline oder Focus-Ring)

**Bestanden wenn**: ✅ Fokus bewegt sich zu Summary, Tab-Reihenfolge sinnvoll

---

### Test Suite 6: Audio Player (abhängig von Media-Endpoint)

#### Test 6.1: Audio Controls in Tabelle
**Aktion**:
```
1. Suche "el"
2. Schaue auf "Audio" Column
3. Versuche, play-Button zu klicken
```

**Erwartung**:
- Audio-Player sichtbar (HTML5 `<audio controls>`)
- Play/Pause/Volume-Controls vorhanden
- Falls `/media/segment/` endpoint verfügbar: Audio spielt
- Falls nicht: Browser zeigt Error-Icon

**Bestanden wenn**: ✅ Audio-Player sichtbar, Controls funktionieren

---

## Integrations-Tests (gegen realen BLS)

### Pre-Requisites
- BLS läuft auf `http://127.0.0.1:8081`
- Index hat Daten: mindestens 100 Tokens, 10 Dokumente

### Test A: Backend API Contract
```bash
# Fetch Daten
curl "http://localhost:5000/search/advanced/data?q=el&mode=forma&country_code=ARG&sensitive=1"

# Überprüfe Response:
# - Status 200 OK
# - draw, recordsTotal, recordsFiltered, data[] vorhanden
# - data[0] hat: left, match, right, country, speaker_type, sex, mode, discourse, tokid, filename
```

### Test B: Export Streaming
```bash
# CSV export
curl -o /tmp/export.csv "http://localhost:5000/search/advanced/export?q=palabra&format=csv"

# Überprüfe:
# - Status 200 OK
# - Content-Type: text/csv
# - Datei > 0 bytes
# - wc -l /tmp/export.csv > 2 (mind. Header + 1 Datensatz)
```

### Test C: Filter Logic
```bash
# Ohne Filter
TOTAL=$(curl -s "http://localhost:5000/search/advanced/data?q=el" | jq '.recordsTotal')

# Mit Filter
FILTERED=$(curl -s "http://localhost:5000/search/advanced/data?q=el&country_code=ARG" | jq '.recordsFiltered')

# Verifiziere: FILTERED <= TOTAL
if [ $FILTERED -le $TOTAL ]; then
  echo "✅ Filter works"
fi
```

---

## Acceptance Checklist

### Frontend-Seite
- [ ] Q-Input, Mode-Select, Sensitive-Select funktionieren
- [ ] Multi-Select Filter (Select2) funktionieren
- [ ] Include_Regional Checkbox funktioniert
- [ ] DataTables zeigt 50 Einträge pro Seite (default)
- [ ] Pagination funktioniert (25/50/100 Einträge)
- [ ] KWIC ist bold/markiert
- [ ] Summary-Box zeigt Zahlen und Badge
- [ ] Export CSV + TSV funktioniert
- [ ] Reset setzt alle Felder auf Default
- [ ] Fokus springt zu Summary nach Submit
- [ ] Keine Client-Side-Search-Box sichtbar
- [ ] Responsive: 4-spaltig (Desktop), 2-spaltig (Tablet), 1-spaltig (Mobile)

### Backend-Seite (bestehend)
- [ ] `/search/advanced/data` liefert gültige DataTables-Response
- [ ] `/search/advanced/export?format=csv|tsv` streamt Daten
- [ ] Filter-Logik: AND zwischen Facets, OR innerhalb
- [ ] CQL-Parameter-Fallback: patt → cql → cql_query
- [ ] Timeouts: read=180s, pool=5s

---

## Fehler-Behebung

### Symptom: DataTables zeigt "No data available"
**Ursache**: Backend antwortet mit leeren `data[]`
**Lösung**: 
1. Überprüfe Query-String im Network-Tab
2. Teste manuell: `curl "http://localhost:5000/search/advanced/data?q=el"`
3. Überprüfe BLS-Status: `curl http://127.0.0.1:8081/blacklab-server`

### Symptom: Select2 funktioniert nicht
**Ursache**: jQuery/Select2 nicht geladen
**Lösung**:
1. Überprüfe DevTools Console auf Fehler
2. Verifiziere: `window.jQuery` ist defined
3. Überprüfe: `window.jQuery.fn.select2` ist function

### Symptom: Export funktioniert nicht
**Ursache**: `/search/advanced/export` nicht registriert oder BLS offline
**Lösung**:
1. Überprüfe Flask-Routes: `python -c "from src.app.routes import BLUEPRINTS; print([b.name for b in BLUEPRINTS])"`
2. Verifiziere: `advanced_api` blueprint ist in Liste
3. Teste manuell: `curl "http://localhost:5000/search/advanced/export?q=casa&format=csv"`

### Symptom: Audio-Player zeigt Error
**Ursache**: `/media/segment/` endpoint nicht vorhanden oder invalid URL
**Lösung**:
1. Überprüfe Browser DevTools → Network
2. Klicke auf Audio-Request, schaue auf URL
3. Teste URL manuell: `curl "http://localhost:5000/media/segment/filename.mp3/0/5000"`
4. Falls 404: Media-Endpoint implementieren (zukünftig)

---

## Hardening Tests (Security & Robustness)

### Running Integration Tests

**Full Hardening Test Suite** (`scripts/test_advanced_hardening.py`):

```bash
# Run all 5 hardening tests
python scripts/test_advanced_hardening.py

# Expected output:
# ✅ Test 1: Export line count consistency
# ✅ Test 2: CQL variant consistency
# ✅ Test 3: Filter reduction detection
# ✅ Test 4: CQL validation rejection
# ✅ Test 5: Rate limiting enforcement
```

**What's Being Tested**:

#### Test 1: Export Line Count (CSV/TSV)
- ✅ CSV export: Header + numberOfHits rows
- ✅ TSV export: Tab-separated format
- ✅ UTF-8 BOM present (Excel compatibility)
- ✅ Cache-Control: no-store header
- ✅ Content-Disposition with timestamp

**Run Manually**:
```bash
curl -s http://localhost:5000/search/advanced/export?q=palabra&mode=forma&format=csv | head -5
# Should see: ﻿left,match,right,filename,...
#            (﻿ = UTF-8 BOM character)
```

#### Test 2: CQL Variant Consistency
- ✅ Forma: `palabra` → N hits
- ✅ Forma exacta: `"palabra"` → M hits (typically < N)
- ✅ Lemma: `palabra (lemma)` → L hits
- ✅ All variants return consistent `recordsTotal`

**Run Manually**:
```bash
# Test 3 modes return same numberOfHits
curl -s 'http://localhost:5000/search/advanced/data?q=palabra&mode=forma' | python -c "import sys,json; print(json.load(sys.stdin)['recordsTotal'])"
curl -s 'http://localhost:5000/search/advanced/data?q=palabra&mode=forma_exacta' | python -c "import sys,json; print(json.load(sys.stdin)['recordsTotal'])"
curl -s 'http://localhost:5000/search/advanced/data?q=palabra&mode=lemma' | python -c "import sys,json; print(json.load(sys.stdin)['recordsTotal'])"
```

#### Test 3: Filter Reduction
- ✅ Unfiltered hits: recordsTotal = X
- ✅ Filtered (country=ARG): recordsFiltered = Y (Y < X)
- ✅ Filter badge appears when active
- ✅ Summary message updates

**Run Manually**:
```bash
# Without filter
curl -s 'http://localhost:5000/search/advanced/data?q=palabra&mode=forma' | python -c "import sys,json; d=json.load(sys.stdin); print(f\"Total: {d['recordsTotal']}\")"

# With filter
curl -s 'http://localhost:5000/search/advanced/data?q=palabra&mode=forma&country_code=ARG' | python -c "import sys,json; d=json.load(sys.stdin); print(f\"Filtered: {d['recordsFiltered']}\")"
```

#### Test 4: CQL Validation & Injection Prevention
- ❌ `palabra); DROP TABLE` → HTTP 400
- ❌ `palabra`id`.txt` → HTTP 400
- ❌ `${SHELL}` → HTTP 400
- ❌ Unmatched `(palabra` → HTTP 400
- ✅ `palabra AND (test OR verify)` → HTTP 200

**Run Manually**:
```bash
# Should fail (400)
curl -i 'http://localhost:5000/search/advanced/export?q=palabra);DROP&mode=forma'
# Expected: HTTP 400, error=invalid_cql

# Should succeed (200)
curl -i 'http://localhost:5000/search/advanced/export?q=palabra&mode=forma'
# Expected: HTTP 200, streaming CSV
```

#### Test 5: Rate Limiting Enforcement
- ✅ Requests 1-6 per minute: HTTP 200
- ❌ Request 7 per minute: HTTP 429
- ✅ Header: `Retry-After: 45`

**Run Manually**:
```bash
# Send 7 rapid requests
for i in {1..7}; do
  echo -n "Request $i: "
  curl -s -w "%{http_code}\n" -o /dev/null \
    'http://localhost:5000/search/advanced/export?q=palabra&mode=forma'
done

# Expected: 200 200 200 200 200 200 429
```

---

### Security Test Scenarios

#### Scenario: SQL Injection Attempt

**User Input**: `palabra; DROP TABLE index; --`

**Browser DevTools Network Tab**:
1. Request: GET `/search/advanced/data?q=palavra;%20DROP%20TABLE...`
2. Response: HTTP 400
3. JSON: `{"error": "invalid_cql", "message": "SQL comment injection detected"}`

**Frontend Display**:
```
🔴 Patrón sospechoso
Se detectó un patrón potencialmente peligroso en su búsqueda.
(Red error box)
```

**Security Status**: ✅ Attack prevented

#### Scenario: Shell Injection Attempt

**User Input**: `` `id`.txt ``

**Expected Response**: HTTP 400, error=invalid_cql

**Security Status**: ✅ Attack prevented

#### Scenario: Unmatched Quote

**User Input**: `"palabra`

**Expected Response**: HTTP 400 (unmatched quote)

**Security Status**: ✅ Attack prevented

---

### Performance Verification

#### Export Performance Check

```bash
# Export 1,000 rows (should be <1 second)
time curl -s 'http://localhost:5000/search/advanced/export?q=palabra&mode=forma&format=csv' > /tmp/export.csv

# Check file size and line count
wc -l /tmp/export.csv
ls -lh /tmp/export.csv

# Expected: ~50 lines for 1000 hits
# Expected duration: <1 second
# Expected size: <50KB
```

#### Memory & CPU During Export

```bash
# Terminal 1: Monitor system
watch 'ps aux | grep "python.*main" | head -3'

# Terminal 2: Start large export
curl 'http://localhost:5000/search/advanced/export?q=a&mode=forma&format=csv' > /tmp/big_export.csv

# Expected: CPU 20-30%, Memory stays <25MB even for 100K rows
```

---

## Performance Baselines

### Browser-seitig
- DataTables Init: < 500ms (mit 50 Zeilen)
- Page-Render: < 1s (nach AJAX-Response)
- Select2-Init: < 300ms (pro Select)
- Reset: < 200ms

### Server-seitig
- `/search/advanced/data` (50 hits): < 500ms
- `/search/advanced/export` (1000 hits): < 2s

**Monitoring**: BLS-Timeout, Datenbank-Locks überprüfen falls langsam

---

**Dokument**: Advanced Search UI Testing Guide v2.5.0  
**Datum**: 10. November 2025  
**Status**: ✅ Fertig für Live-Test (mit Hardening-Tests)  

**Siehe auch**: 
- docs/TESTING-advanced-search.md (Backend-Tests)
- docs/reference/cql-escaping-rules.md (Security Details)
- scripts/test_advanced_hardening.py (Automated Tests)
