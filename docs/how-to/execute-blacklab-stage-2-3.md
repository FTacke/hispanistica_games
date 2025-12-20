---
title: "Execute BlackLab Stage 2-3 Build & Test"
status: active
owner: devops
updated: "2025-11-10"
tags: [blacklab, how-to, index-build, deployment, testing]
links:
  - operations/blacklab-stage-2-3-implementation.md
  - operations/blacklab-minimalplan.md
  - operations/blacklab-quick-reference.md
  - reference/blf-yaml-schema.md
---

# How-To: Execute BlackLab Stage 2-3 Build & Test

## Ziel

Nach dieser Anleitung haben Sie einen aktiven Lucene-Index gebaut, BlackLab Server gestartet und alle Proxy-Endpoints verifiziert.

---

## Voraussetzungen

### Erforderliches Wissen
- Bash/PowerShell Befehle
- HTTP-Request Grundlagen
- Lucene Index Konzepte (empfohlen)

### Benötigte Tools
- **Java JDK 11+** - Für Index-Build und BlackLab Server
- **BlackLab Server 4.0+** - Binary oder Docker
- **curl** - HTTP-Testing
- **Python 3.8+** - Test-Skripte

### Systemzustand
- Stage 1 (Export) ✓ abgeschlossen
- 146 TSV-Dateien vorhanden: `data/blacklab_index/tsv/`
- Flask App einsatzbereit: `src/app/main.py`
- Config vorhanden: `config/blacklab/corapan-tsv.blf.yaml`

---

## Schritte

### Schritt 1: Index Build Ausführen

**Befehl:**
```bash
bash scripts/blacklab/build_blacklab_index.sh tsv 4
```

**Parameter:**
- `tsv` - Input-Format (TSV-only, kein WPL)
- `4` - Anzahl Worker-Threads

**Was passiert:**
1. Prüft ob TSV-Dateien existieren
2. Erstellt neue Lucene-Segmente in `data/blacklab_index.new`
3. Führt atomaren Switch durch: `.new` → aktuell
4. Backuped alten Index: `data/blacklab_index.backup`

**Erwartete Ausgabe:**
```
Index build completed in 0.53s
Index Size: 15.89 MB
Documents: 146
Tokens: 1487120
Status: SUCCESS
```

**Prüfung (Shell):**
```bash
# Linux/macOS
ls -la data/blacklab_index/_segments/

# Windows PowerShell
Get-ChildItem -Path "data\blacklab_index\_segments\"
```

**Erwartete Dateien:**
- `segment_1.cfs` - 1.49 MB
- `segment_2.cfs` - 3.74 MB
- `segment_3.cfs` - 4.78 MB
- `segment_4.cfs` - 1.86 MB
- `segment_5.cfs` - 4.01 MB
- `segments.gen` - Lucene metadata
- `index.json` - CO.RA.PAN metadata

---

### Schritt 2: Build-Log Überprüfen

**Befehl:**
```bash
# Linux/macOS
tail -20 logs/bls/index_build.log

# Windows PowerShell
Get-Content logs\bls\index_build.log -Tail 20
```

**Auf Fehler prüfen:**
```bash
# Sollte 0 Fehler zeigen
grep -i error logs/bls/index_build.log
```

**Erwartete Ausgabe:** (leere Zeile = ✓ OK)

---

### Schritt 3: BlackLab Server Starten

**Option A: Mit Script (lokal)**
```bash
bash scripts/blacklab/run_bls.sh 8081 2g 512m
```

**Parameter:**
- `8081` - HTTP Port
- `2g` - Heap-Memory (2 GB)
- `512m` - Direct-Memory (512 MB)

**Option B: Mit Docker (empfohlen für Production)**
```bash
docker run -d \
  --name blacklab-server \
  -p 8081:8081 \
  -v $(pwd)/data/blacklab_index:/app/data/blacklab_index \
  -e BLS_INDEX_DIR=/app/data/blacklab_index \
  blacklab-server:4.0
```

**Option C: Mock-Server (für Testing)**
```bash
python scripts/mock_bls_server.py 8081 &
```

**Verifikation:**
```bash
# Check ob Port 8081 antwortet
curl -s http://localhost:8081/blacklab-server/ | json_pp

# Erwartete Antwort:
# {
#   "blacklabVersion": "4.0.0",
#   "buildDate": "2025-11-10",
#   "indexDir": "data/blacklab_index"
# }
```

**Status prüfen (Linux):**
```bash
ps aux | grep blacklab
netstat -tlnp | grep 8081
```

---

### Schritt 4: Flask App Starten

**In separatem Terminal:**
```bash
export FLASK_ENV=development  # Linux/macOS
set FLASK_ENV=development      # Windows
python -m src.app.main
```

**Erwartete Ausgabe:**
```
WARNING: This is a development server. Do not use it in production deployment.
* Running on http://127.0.0.1:8000
```

**Verifikation:**
```bash
curl http://localhost:8000/
# Sollte HTML-Response zurückgeben (Status 200)
```

---

### Schritt 5: Proxy-Verbindung Testen

**Test 1: Direct BLS Endpoint**
```bash
curl -v http://localhost:8081/blacklab-server/
```

**Erwartete Antwort:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "blacklabVersion": "4.0.0",
  ...
}
```

**Test 2: Proxy-Forwarding**
```bash
curl -v http://localhost:8000/bls/
```

**Erwartete Antwort:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "blacklabVersion": "4.0.0",
  ...
}
```

**Test 3: CQL Query über Proxy**
```bash
curl -v 'http://localhost:8000/bls/corpus/corapan/1/hits?cql_query=[lemma="ser"]'
```

**Erwartete Antwort:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "corpus": "corapan",
  "query": "[lemma=\"ser\"]",
  "hits": [
    {
      "hitStart": 0,
      "hitEnd": 5,
      "match": {"word": ["ser", "es", ...]}
    }
  ],
  "hitCount": 147,
  "totalTokens": 1487120
}
```

---

### Schritt 6: Smoke Tests Ausführen

**Alle Tests auf einmal:**
```bash
python scripts/smoke_tests.py
```

**Einzelne Tests (optional):**
```bash
# Test nur BLS
curl http://localhost:8081/blacklab-server/ | json_pp

# Test nur Proxy
curl http://localhost:8000/bls/ | json_pp

# Test mit CQL
curl 'http://localhost:8000/bls/corpus/corapan/1/hits?cql_query=[pos="V"]'
```

**Erwartete Ausgabe:**
```
======================================================================
RESULT: 3/3 tests passed

[OK] ALL TESTS PASSED - Ready for UI Implementation
```

---

## Validierung

### Wie prüft man, dass es funktioniert hat?

**1. Index-Struktur validieren:**
```bash
# Segmente sollten mindestens 1 MB sein
du -sh data/blacklab_index/_segments/
# Erwartung: ~16 MB total
```

**2. BLS-Liveness prüfen:**
```bash
curl -I http://localhost:8081/blacklab-server/
# HTTP/1.1 200 OK
```

**3. Proxy-Latenz messen:**
```bash
time curl -s 'http://localhost:8000/bls/corpus/corapan/1/hits?cql_query=[word="el"]' > /dev/null
# Sollte <1000ms sein
```

**4. Query-Ergebnisse validieren:**
```bash
curl 'http://localhost:8000/bls/corpus/corapan/1/hits?cql_query=[lemma="ser"]' | \
  json_pp | grep -E "hitCount|totalTokens"

# Erwartung:
# "hitCount": 147
# "totalTokens": 1487120
```

**5. Alle HTTP-Methoden prüfen:**
```bash
curl -X GET http://localhost:8000/bls/        # OK
curl -X POST http://localhost:8000/bls/       # OK (204 oder 405)
curl -X PUT http://localhost:8000/bls/        # OK (204 oder 405)
curl -X DELETE http://localhost:8000/bls/     # OK (204 oder 405)
```

---

## Rollback (optional)

Falls der neue Index Probleme verursacht:

```bash
# Alten Index wiederherstellen
rm -rf data/blacklab_index
mv data/blacklab_index.backup data/blacklab_index

# BLS neu starten
bash scripts/blacklab/run_bls.sh 8081 2g 512m

# Tests wiederholen
python scripts/smoke_tests.py
```

---

## Troubleshooting

### Problem 1: Build fehlgeschlagen

**Symptome:**
```
Error: TSV files not found
Status: FAIL
```

**Ursache:** Stage 1 (Export) nicht abgeschlossen

**Diagnose:**
```bash
ls -la data/blacklab_index/tsv/
# Sollte 146 .tsv Dateien zeigen
```

**Lösung:**
```bash
# TSV-Export erneut ausführen
python -m src.scripts.blacklab_index_creation \
  --in media/transcripts \
  --out data/blacklab_index/tsv \
  --format tsv \
  --workers 4
```

---

### Problem 2: BLS antwortet nicht (Port 8081)

**Symptome:**
```
curl: (7) Failed to connect to localhost port 8081: Connection refused
```

**Ursache:** BlackLab Server nicht gestartet

**Diagnose:**
```bash
# Port-Status prüfen
lsof -i :8081  # Linux/macOS
netstat -ano | grep 8081  # Windows

# Logs prüfen
tail -20 logs/bls/bls.log
```

**Lösung:**
```bash
# Option 1: Mit Script starten
bash scripts/blacklab/run_bls.sh 8081 2g 512m

# Option 2: Mit Mock-Server (für Testing)
python scripts/mock_bls_server.py 8081 &
```

---

### Problem 3: Proxy liefert 502 (Bad Gateway)

**Symptome:**
```
HTTP/1.1 502 Bad Gateway
```

**Ursache:** BLS nicht erreichbar auf Port 8081

**Diagnose:**
```bash
# BLS direkt testen
curl http://localhost:8081/blacklab-server/
# Sollte JSON zurückgeben

# Proxy-Code prüfen
grep "localhost:8081" src/app/routes/bls_proxy.py
```

**Lösung:**
```bash
# 1. BLS auf Port 8081 starten
bash scripts/blacklab/run_bls.sh 8081 2g 512m

# 2. Flask neu starten
python -m src.app.main

# 3. Proxy testen
curl http://localhost:8000/bls/
```

---

### Problem 4: CQL-Query liefert 0 Ergebnisse

**Symptome:**
```
"hitCount": 0
```

**Ursache:** Falsche CQL-Syntax oder keine Matches

**Diagnose:**
```bash
# Valide Lemmas prüfen
curl 'http://localhost:8000/bls/corpus/corapan/1/hits?cql_query=[lemma="el"]'
# "el" (Artikel) sollte viele Hits geben
```

**Lösung:**
```bash
# Syntax prüfen: [field="value"]
curl 'http://localhost:8000/bls/corpus/corapan/1/hits?cql_query=[lemma="ser"]'

# Wildcards probieren:
curl 'http://localhost:8000/bls/corpus/corapan/1/hits?cql_query=[lemma="ser.*"]'

# Word statt lemma:
curl 'http://localhost:8000/bls/corpus/corapan/1/hits?cql_query=[word="es"]'
```

---

## Nächste Schritte

Nach erfolgreichem Build & Test:

1. **UI Implementation vorbereiten:**
   - Create `src/app/routes/advanced.py` Blueprint
   - Create template `templates/pages/search-advanced.html`

2. **CQL Query Builder implementieren:**
   - JavaScript UI für Abfrage-Konstruktion
   - Syntax-Highlighting
   - Query-Vorlagen

3. **Integration Tests schreiben:**
   - E2E-Tests für Query-Workflow
   - Performance-Tests für Queries
   - Error-Handling Tests

---

## Siehe auch

- [BlackLab Stage 2-3 Implementation Report](blacklab-stage-2-3-implementation.md) - Technische Details
- [BlackLab Minimalplan](blacklab-minimalplan.md) - Vollständige Setup-Anleitung
- [BlackLab Quick Reference](blacklab-quick-reference.md) - Command Reference
- [BLF YAML Schema](../reference/blf-yaml-schema.md) - Index-Konfiguration
- [Troubleshooting BlackLab](../troubleshooting/blacklab-issues.md) - Erweiterte Problembehebung
