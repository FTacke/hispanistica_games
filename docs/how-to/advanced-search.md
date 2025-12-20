---
title: "Advanced Search Usage Guide"
status: active
owner: frontend-team
updated: "2025-11-10"
tags: [search, blacklab, cql, flask-proxy, howto]
links:
  - ../reference/search-params.md
  - ../concepts/search-architecture.md
  - ../troubleshooting/blacklab-issues.md
---

# Advanced Search Usage Guide

Anleitung zur Verwendung der erweiterten Korpussuche mit BlackLab (CQL).

---

## Ziel

Nach dieser Anleitung kannst du:
- Komplexe Suchanfragen mit CQL (Corpus Query Language) erstellen
- Wortsequenzen und POS-Tags kombinieren
- Ergebnisse nach Metadaten filtern (Land, Sprecher, Datum)
- KWIC-Treffer navigieren und im Player öffnen

---

## Voraussetzungen

- **CO.RA.PAN Web App** läuft (Entwicklung oder Produktion)
- **BlackLab Server** läuft und ist erreichbar (siehe [BlackLab Stage 2-3 Implementation](../operations/blacklab-stage-2-3-implementation.md))
- **Index** gebaut und verfügbar unter `data/blacklab_index/`
- Browser mit aktiviertem JavaScript

---

## Zugriff

### Navigation

1. Öffne die [Corpus-Seite](http://localhost:5000/corpus)
2. Klicke auf den Tab **"Búsqueda avanzada"**
3. Du wirst zu `/search/advanced` weitergeleitet

**Direkt-URL:** `http://localhost:5000/search/advanced`

---

## Suchformular

### Pflichtfelder

#### Consulta (Query)
- **Eingabe:** Wort(e) oder Lema(ta)
- **Beispiele:**
  - Einzelwort: `México`
  - Mehrwort (Sequenz): `ir a`
  - Lemma: `ir` (bei Modus "Lema")

#### Modo (Modus)
Wähle einen der Modi:

| Modus | Beschreibung | Feld in BlackLab |
|-------|--------------|------------------|
| **Forma** | Normalisierte Form (ci/da aktiv) | `norm` |
| **Forma exacta** | Exakte Form (case-sensitive) | `word` |
| **Lema** | Lemma-Suche | `lemma` |

**Standard:** Forma (normalisiert)

---

### Optionen (Switches)

#### Case Insensitive (ci)
- **Aktiv** (Standard): Groß-/Kleinschreibung ignorieren
- **Inaktiv:** Case-sensitive Suche

#### Diacritics Agnostic (da)
- **Aktiv** (Standard): Diakritika ignorieren (á = a)
- **Inaktiv:** Diakritik-sensitive Suche

**Hinweis:** Wenn `ci` ODER `da` aktiv ist, wird automatisch das Feld `norm` verwendet (normalisierte Form).

---

### POS-Tags (optional)

- **Format:** Komma-separierte Liste (z.B., `VERB,ADP`)
- **Anwendung:** Pro Token in der Reihenfolge
- **Beispiel:** Query `ir a` + POS `VERB,ADP` → `[lemma="ir" & pos="VERB"] [pos="ADP"]`

**Verfügbare Tags:** NOUN, VERB, ADJ, ADP, ADV, PRON, DET, CONJ, NUM, etc. (Universal Dependencies)

---

### Metadaten-Filter

Filter nach Dokumenteigenschaften:

| Filter | Beschreibung | Beispiel |
|--------|--------------|----------|
| **País (código ISO)** | Ländercode (3-stellig) | `ARG`, `MEX`, `ESP` |
| **Emisora** | Radiostationskennung | `LRA1`, `XEQK` |
| **Hablante (código)** | Sprecher-ID | `SPK001` |
| **Fecha desde/hasta** | Datumsbereich | `2020-01-01` bis `2020-12-31` |

**Hinweis:** Filter werden via BlackLab `filter`-Parameter übertragen (sofern vom Server unterstützt).

---

## Beispiele

### Beispiel 1: Einzelwort (Forma)

**Ziel:** Finde alle Vorkommen von "méxico" (normalisiert, unabhängig von Groß-/Kleinschreibung)

**Eingabe:**
- Consulta: `méxico`
- Modo: `Forma`
- ci: ✅ (aktiv)
- da: ✅ (aktiv)

**Generierte CQL:**
```cql
[norm="mexico"]
```

**Erwartung:** Trifft `México`, `méxico`, `MÉXICO`, `Méxicó`, etc.

---

### Beispiel 2: Exakte Form

**Ziel:** Finde nur "México" (exakt mit Großbuchstaben + Akzent)

**Eingabe:**
- Consulta: `México`
- Modo: `Forma exacta`
- ci: ❌ (inaktiv)
- da: ❌ (inaktiv)

**Generierte CQL:**
```cql
[word="México"]
```

**Erwartung:** Nur exakte Übereinstimmung

---

### Beispiel 3: Lemma + POS

**Ziel:** Finde Verb "ir" in infiniter oder konjugierter Form

**Eingabe:**
- Consulta: `ir`
- Modo: `Lema`
- POS: `VERB`

**Generierte CQL:**
```cql
[lemma="ir" & pos="VERB"]
```

**Erwartung:** Trifft `ir`, `voy`, `fue`, `iba`, etc. (alle Formen von "ir" als Verb)

---

### Beispiel 4: Sequenz (Mehrwort)

**Ziel:** Finde Phrase "ir a" (Verb + Präposition)

**Eingabe:**
- Consulta: `ir a`
- Modo: `Lema`
- POS: `VERB,ADP`

**Generierte CQL:**
```cql
[lemma="ir" & pos="VERB"] [lemma="a" & pos="ADP"]
```

**Erwartung:** Findet z.B. `voy a`, `fue a`, `ir a`

---

### Beispiel 5: Filter nach Land + Datum

**Ziel:** Finde "covid" in argentinischen Aufnahmen aus 2020

**Eingabe:**
- Consulta: `covid`
- Modo: `Forma`
- País: `ARG`
- Fecha desde: `2020-01-01`
- Fecha hasta: `2020-12-31`

**Filter:**
```
country_code:"ARG" AND date >= "2020-01-01" AND date <= "2020-12-31"
```

---

## Ergebnisanzeige (KWIC)

### Format

Jeder Treffer wird als **KWIC** (Key Word In Context) angezeigt:

```
[linker Kontext] TREFFER [rechter Kontext]
```

**Beispiel:**
```
... en el país de México y ...
```

- **Linker Kontext:** `en el país de` (grau)
- **Treffer:** `México` (hervorgehoben, fett)
- **Rechter Kontext:** `y ...` (grau)

### Metadaten

Unter jedem Treffer werden angezeigt:
- 📄 **Dokument:** PID (z.B., `ESP_20200315_...`)
- 🏷️ **Lemma:** Grundform (z.B., `méxico`)
- 🏷️ **POS:** Wortart (z.B., `PROPN`)
- 🕒 **Timestamp:** Startzeit in Sekunden (z.B., `42.5s`)

### Aktionen

- **▶️ Abrir en Player:** Öffnet den Treffer im Audio-Player mit automatischem Zeitsprung

---

## Pagination

- **Standard:** 50 Treffer pro Seite
- **Navigation:** Buttons "Anterior" / "Siguiente"
- **Anzeige:** `Resultados 1 – 50 de 1,487`

**Hinweis:** Pagination verwendet `hitstart` + `maxhits` Parameter (wird automatisch verwaltet via htmx).

---

## Validierung & Fehlermeldungen

### Client-seitig (JavaScript)

- **Leere Query:** "La consulta no puede estar vacía"
- **Keine Tokens:** "La consulta no contiene tokens válidos"

### Server-seitig (Flask)

- **CQL-Fehler:** Wird als Alert angezeigt
- **BlackLab-Timeout:** "Search timed out. Please try a more specific query."
- **Server-Fehler:** "BlackLab server error: 502"

---

## Performance-Tipps

### Optimierung

1. **Spezifische Queries:** Je genauer, desto schneller
   - ✅ `México` → schnell
   - ❌ `[pos="NOUN"]` → sehr langsam (alle Nomen)

2. **Filter nutzen:** Schränke via Metadaten ein
   - ✅ Land + Datum → reduziert Dokumente
   - ❌ Keine Filter → durchsucht alle 146 Transkripte

3. **Sequenzen:** Halten Suche schnell (spezifischer)
   - ✅ `[lemma="ir"] [pos="ADP"]` → schnell
   - ❌ `[pos="VERB"]` → langsam

### Timeouts

- **Read-Timeout:** 180 Sekunden (3 Minuten)
- **Bei Timeout:** Query vereinfachen oder Filter setzen

---

## Bekannte Einschränkungen

### Index-Format

- **TSV-only:** Nur TSV-Format indiziert (kein WPL)
- **Felder:** `word`, `norm`, `lemma`, `pos`, `tokid`, `start_ms`, `end_ms`

### Filter-Unterstützung

- **Primär:** BlackLab `filter`-Parameter (falls Server-seitig unterstützt)
- **Fallback:** Client-seitige Postfilterung (markiert als "postfiltrado")

### Highlighting

- Treffer werden via `<mark>` hervorgehoben
- Keine Snippet-Breakpoints innerhalb von Sätzen

---

## Ergebnisse exportieren

### Alle Treffer als CSV/TSV herunterladen

Die Advanced Search bietet einen **Export-alles-Endpoint**, mit dem du alle Suchergebnisse als CSV oder TSV-Datei herunterladen kannst. Der Export läuft **Server-Side Streaming**, d.h. der Server fetcht die Daten in Chunks vom BLS und sendet sie direkt an deinen Browser, ohne sie im RAM zu puffern.

### Verwendung

#### API direkt

```bash
# CSV exportieren
curl 'http://localhost:8000/search/advanced/export?q=radio&mode=forma&sensitive=1&format=csv' \
  -o results.csv

# TSV exportieren
curl 'http://localhost:8000/search/advanced/export?q=radio&mode=forma&sensitive=1&format=tsv' \
  -o results.tsv

# Mit Filtern
curl 'http://localhost:8000/search/advanced/export?q=radio&mode=forma&country_code=ARG&format=csv' \
  -o results_arg.csv
```

### CSV-Struktur

Spalten (Header):
```
left,match,right,country,speaker_type,sex,mode,discourse,filename,radio,tokid,start_ms,end_ms
```

Beispiel-Zeile:
```
para que hablen,radio,en directo,ARG,pro,m,lectura,general,20250110_ARG_LRA1_001.mp3,national,tok_12345,125000,135000
```

### Parameter

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `q` oder `query` | string | Suchstring (erforderlich) |
| `mode` | string | `forma_exacta` \| `forma` \| `lemma` (default: `forma`) |
| `sensitive` | bool | `1` = case-sensitive, `0` = insensitive (default: `1`) |
| `country_code[]` | list | Liste von Ländercodes (optional) |
| `speaker_type[]` | list | Liste: `pro`, `otro` (optional) |
| `sex[]` | list | Liste: `m`, `f` (optional) |
| `speech_mode[]` | list | Liste: `pre`, `lectura`, `libre` (optional) |
| `discourse[]` | list | Liste: `general`, `tiempo`, `tránsito` (optional) |
| `include_regional` | bool | `1` = regionale Sender, `0` = nur national (default: `0`) |
| `format` | string | `csv` (default) \| `tsv` |

### Grenzen

- **Maximale Zeilen pro Export:** 50.000 (GLOBAL_HITS_CAP)
- **Chunk-Größe:** 1.000 Hits (intern, transparent)
- **Timeout:** 60 Sekunden

### Fehlerbehandlung

Wenn der Export fehlschlägt (z.B. CQL-Fehler), erhältst du ein JSON-Response:

```json
{
  "error": "invalid_cql",
  "message": "CQL syntax error: ..."
}
```

**Status-Codes:**
- `200 OK`: Erfolgreich, CSV-Stream folgt
- `400 Bad Request`: Ungültiger Query (CQL-Fehler)
- `504 Gateway Timeout`: BLS antwortet nicht schnell genug
- `502 Bad Gateway`: BLS nicht erreichbar

---

## Troubleshooting

### Problem 1: "No se encontraron resultados"

**Ursachen:**
- Query zu spezifisch (exakte Form nicht im Corpus)
- Filter zu restriktiv (kein Dokument erfüllt Bedingungen)
- Rechtschreibfehler in Query

**Lösung:**
- Wechsel zu "Forma" (normalisiert) statt "Forma exacta"
- Entferne Filter schrittweise
- Prüfe Schreibweise (z.B., `méxico` vs `mejico`)

---

### Problem 2: Timeout

**Ursache:**
- Query zu generisch (z.B., `[pos="VERB"]` → Millionen Treffer)

**Lösung:**
- Füge Wortbeschränkung hinzu: `[lemma="ir" & pos="VERB"]`
- Setze Filter (Land, Datum)

---

### Problem 3: "BlackLab server error: 502"

**Ursache:**
- BlackLab Server nicht erreichbar (nicht gestartet oder abgestürzt)

**Diagnose:**
```bash
curl http://localhost:8081/blacklab-server/
```

**Lösung:**
```bash
bash scripts/blacklab/run_bls.sh 8081 2g 512m
```

---

### Problem 4: Player-Link funktioniert nicht

**Ursache:**
- `start_ms` fehlt in Index-Metadaten
- Audio-Datei nicht vorhanden

**Diagnose:**
- Prüfe KWIC-Metadaten: Ist `start_ms` angezeigt?
- Prüfe `media/mp3-full/`: Existiert `{doc_pid}.mp3`?

**Lösung:**
- Re-Index mit `listvalues=start_ms,end_ms`
- Audio-Dateien nachladen

---

### Problem 5: Tab-Link führt zu 404

**Symptom:**
- Klick auf "Búsqueda simple" → `BuildError: Could not build url for endpoint 'corpus.index'`

**Ursache:**
- Template nutzt falschen Blueprint-Endpoint (`corpus.index` existiert nicht)

**Lösung (Fixed in v2.3.1):**
```html
<!-- Vorher (falsch) -->
<a href="{{ url_for('corpus.index') }}">Búsqueda simple</a>

<!-- Nachher (korrekt) -->
<a href="{{ url_for('corpus.search') }}">Búsqueda simple</a>
```

**Betroffene Dateien:**
- `templates/search/advanced.html` (Lines 45, 47)

---

### Problem 6: Rate Limit Exceeded (429)

**Symptom:**
- HTTP 429 nach mehreren Suchen: `"Rate limit exceeded: 30 per minute"`

**Ursache:**
- Zu viele Anfragen innerhalb 60 Sekunden (Schutz gegen Abuse)

**Diagnose:**
```bash
curl -i http://localhost:8000/search/advanced/results?q=test
# HTTP/1.1 429 TOO MANY REQUESTS
# X-RateLimit-Limit: 30
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: 1699635600
```

**Lösung:**
- Warte 60 Sekunden
- Entwicklung: Erhöhe Limit in `src/app/search/advanced.py`:
  ```python
  @limiter.limit("60 per minute")  # Erhöht von 30
  def results():
  ```
- Produktion: Limit beibehalten (verhindert DoS)

---

### Problem 7: BlackLab CQL Parameter nicht akzeptiert

**Symptom:**
- HTTP 400: `"Unknown parameter: patt"` ODER `"Unknown parameter: cql"`

**Ursache:**
- Unterschiedliche BlackLab-Versionen nutzen verschiedene Parameter-Namen:
  - **Standard (4.0+):** `patt` (pattern)
  - **Legacy (3.x):** `cql` (Corpus Query Language)
  - **Alternative:** `cql_query`

**Lösung (Automatisch in v2.3.1):**
Das Backend versucht automatisch alle Parameter-Namen in dieser Reihenfolge:
```python
# src/app/search/advanced.py (Lines 84-96)
cql_param_names = ["patt", "cql", "cql_query"]
for param_name in cql_param_names:
    try:
        test_params = {**bls_params, param_name: cql_pattern}
        response = client.get(bls_url, params=test_params)
        response.raise_for_status()
        # Success - use this parameter name
        break
```

**Manuelle Überprüfung:**
```bash
# Test which parameter works
curl "http://localhost:8081/blacklab-server/corapan/hits?patt=[word=\"test\"]"
curl "http://localhost:8081/blacklab-server/corapan/hits?cql=[word=\"test\"]"
curl "http://localhost:8081/blacklab-server/corapan/hits?cql_query=[word=\"test\"]"
```

---

## CQL-Referenz (Kurzform)

Vollständige Referenz: [Search Parameters Reference](../reference/search-params.md)

### Syntax

```cql
[field="value" & field2="value2"] [field3="value3"]
```

### Felder

| Feld | Beschreibung | Beispiel |
|------|--------------|----------|
| `word` | Exakte Form (case-sensitive) | `[word="México"]` |
| `norm` | Normalisierte Form (ci/da) | `[norm="mexico"]` |
| `lemma` | Lemma | `[lemma="ir"]` |
| `pos` | POS-Tag (Universal Dependencies) | `[pos="VERB"]` |

### Operatoren

- **`&`:** Und (innerhalb eines Tokens)
- **Leerzeichen:** Sequenz (zwischen Tokens)

### Escaping

Escapen via `\`:
- `"` → `\"`
- `\` → `\\`
- `[` → `\[`
- `]` → `\]`

---

---

## Flask Proxy Architecture (Development & Production)

### Development Setup (Flask-Only, No Docker/Nginx)

**Start Flask app:**
```powershell
$env:FLASK_ENV="development"
python -m src.app.main
```

**Start Mock BLS (for testing without Java):**
```powershell
python scripts/mock_bls_server.py
```

**Verify proxy:**
```bash
curl -s http://localhost:8000/bls/ | jq .blacklabBuildTime
```

**Expected:** JSON with `blacklabVersion`, `blacklabBuildTime`

### Production Deployment (WSGI)

**Gunicorn setup:**
```bash
gunicorn --bind 0.0.0.0:8000 \
  --workers 4 \
  --timeout 180 \
  --keep-alive 5 \
  --access-logfile logs/gunicorn-access.log \
  --error-logfile logs/gunicorn-error.log \
  src.app.main:app
```

**Key parameters:**
- `--timeout 180`: Matches `httpx` read timeout (long CQL queries)
- `--keep-alive 5`: Matches `httpx` pool timeout (connection reuse)
- `--workers 4`: Multi-process (avoids Werkzeug hot-reload conflicts)

---

## Live Tests

### Test 1: Proxy Connectivity

```bash
curl -s 'http://localhost:8000/bls/'
```

**Expected:** JSON with `blacklabVersion`

### Test 2: CQL Auto-Detection

Try all three parameter variants:

```bash
# Variant 1: patt (standard)
curl -s 'http://localhost:8000/bls/corapan/hits?patt=[lemma="ser"]&maxhits=3' | jq '.summary.numberOfHits'

# Variant 2: cql (legacy BlackLab 3.x)
curl -s 'http://localhost:8000/bls/corapan/hits?cql=[lemma="ser"]&maxhits=3' | jq '.summary.numberOfHits'

# Variant 3: cql_query (alternative)
curl -s 'http://localhost:8000/bls/corapan/hits?cql_query=[lemma="ser"]&maxhits=3' | jq '.summary.numberOfHits'
```

**Expected:** All return `numberOfHits` > 0

### Test 3: Server-Side Filtering

**Without filter:**
```bash
curl -s 'http://localhost:8000/bls/corapan/hits?patt=[word="test"]&maxhits=1' | \
  jq '.summary | {docsRetrieved, numberOfDocs}'
```

**Expected:**
```json
{
  "docsRetrieved": 146,
  "numberOfDocs": 146
}
```

**With filter (country=ARG):**
```bash
curl -s 'http://localhost:8000/bls/corapan/hits?filter=country:"ARG"&patt=[word="test"]&maxhits=1' | \
  jq '.summary | {docsRetrieved, numberOfDocs}'
```

**Expected:**
```json
{
  "docsRetrieved": 42,
  "numberOfDocs": 146
}
```

**Interpretation:** Server filtered 146 → 42 documents before querying.

---

## Live Testing (Production)

**Voraussetzungen:**
- BlackLab Server läuft (`bash scripts/blacklab/run_bls.sh 8081 2g 512m`)
- Flask läuft (Gunicorn/Waitress auf Port 8000)

### Test 1: Proxy Health
```bash
curl -s http://localhost:8000/bls/ | jq .blacklabBuildTime
```
**Erwartung:** `"2024-XX-XX XX:XX:XX"` (Build-Timestamp)

### Test 2: CQL Autodetect (alle Varianten)
```bash
# patt= (bevorzugt)
curl -s 'http://localhost:8000/bls/corapan/hits?patt=[lemma="ser"]&maxhits=3' | jq '.summary.numberOfHits'

# cql= (alias)
curl -s 'http://localhost:8000/bls/corapan/hits?cql=[lemma="ser"]&maxhits=3' | jq '.summary.numberOfHits'

# cql_query= (legacy)
curl -s 'http://localhost:8000/bls/corapan/hits?cql_query=[lemma="ser"]&maxhits=3' | jq '.summary.numberOfHits'
```
**Erwartung:** Alle drei liefern `numberOfHits > 0`

### Test 3: Serverfilter
```bash
# Ohne Filter
curl -s 'http://localhost:8000/bls/corapan/hits?patt=[word="test"]&maxhits=1' \
  | jq '.summary | {docsRetrieved, numberOfDocs}'

# Mit Land-Filter
curl -s 'http://localhost:8000/bls/corapan/hits?filter=country:"ARG"&patt=[word="test"]&maxhits=1' \
  | jq '.summary | {docsRetrieved, numberOfDocs}'
```
**Erwartung:** `docsRetrieved` mit Filter < ohne Filter (Reduction)

### Test 4: Advanced Search UI
```bash
curl -s 'http://localhost:8000/search/advanced/results?q=M%C3%A9xico&mode=forma_exacta' \
  | head -c 500
```
**Erwartung:** HTML mit `<div class="md3-search-summary" aria-live="polite">`

---

## Troubleshooting

### Issue 1: "httpcore.ReadError: peer closed connection"

**Symptom:** Flask dev server with hot-reload drops connections to mock BLS.

**Cause:** Werkzeug reloader kills child processes during code changes.

**Mitigation:**
1. **Dev:** Expected behavior, non-blocking (retry request)
2. **Prod:** Use Gunicorn/Waitress (no hot-reload, stable connections)

**Workaround:**
```bash
# Test mock BLS directly (bypasses Flask proxy)
python scripts/test_mock_bls_direct.py
```

### Issue 2: Filter not applied

**Check 1:** Verify `filter=` parameter in browser DevTools Network tab.

**Check 2:** Test with curl (see Test 3 above).

**Check 3:** Review Flask logs:
```bash
tail -f logs/app.log | grep "filter="
```

### Issue 3: "Bad Gateway (502)"

**Cause:** BlackLab Server not running.

**Solution:**
```bash
# Check if BLS is running
curl http://localhost:8081/blacklab-server/

# Start BLS
bash scripts/blacklab/run_bls.sh 8081 2g 512m
```

### Issue 4: 500 Internal Server Error

**Check Flask Logs:**
```bash
# Linux
sudo journalctl -u corapan-gunicorn -n 50

# Windows
tail -f logs/flask.log
```

**Common Causes:**
- DB locked (SQLite)
- BLS invalid JSON response
- Template rendering error

**See:** [Runbook: Advanced Search](../operations/runbook-advanced-search.md)

---

## Siehe auch

- [Search Parameters Reference](../reference/search-params.md) - CQL parameter fallback table
- [Search Architecture Concept](../concepts/search-architecture.md) - Flask-Proxy architecture diagram
- [BlackLab Issues Troubleshooting](../troubleshooting/blacklab-issues.md) - Common problems
- [Development Setup](../operations/development-setup.md) - Environment configuration
- [BlackLab Official Documentation](https://inl.github.io/BlackLab/) - External CQL reference
