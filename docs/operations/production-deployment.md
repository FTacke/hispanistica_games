---
title: "Production Deployment Guide"
status: active
owner: devops
updated: "2025-11-10"
tags: [deployment, production, gunicorn, waitress, wsgi, blacklab]
links:
  - ../how-to/build-blacklab-index.md
  - development-setup.md
  - runbook-advanced-search.md
  - ../reference/blacklab-api-proxy.md
---

# Production Deployment Guide

Schritt-für-Schritt-Anleitung zur Produktivsetzung von CO.RA.PAN mit BlackLab-Integration.

---

## Überblick

**Architektur:**
- **Flask App** (WSGI: Gunicorn/Linux oder Waitress/Windows)
- **BlackLab Server** (Java, Port 8081)
- **SQLite DB** (Tokens-Tabelle)
- **Lucene Index** (data/blacklab_index/)

**Ports:**
- `8000` - Flask (öffentlich)
- `8081` - BlackLab Server (intern, nur Flask-Zugriff)

---

## Voraussetzungen

### System

**Linux/Production:**
- Python 3.11+
- Java 11+ (für BlackLab Server)
- Gunicorn
- systemd (für Services)

**Windows/Development:**
- Python 3.11+
- Java 11+
- Waitress (statt Gunicorn)

### Daten

- ✅ TSV-Export vorhanden (`data/blacklab_index/tsv/`)
- ✅ docmeta.jsonl vorhanden (`data/blacklab_index/docmeta.jsonl`)
- ✅ Lucene-Index gebaut (`data/blacklab_index/`)

**Falls nicht vorhanden:**
```bash
# Stage 1: Export (JSON → TSV)
python -m src.scripts.blacklab_index_creation \
  --in media/transcripts \
  --out data/blacklab_index/tsv \
  --docmeta data/blacklab_index/docmeta.jsonl \
  --format tsv \
  --workers 4

# Stage 2: Index-Build (TSV → Lucene)
bash scripts/blacklab/build_blacklab_index.sh tsv 4
```

**Siehe:** [How-To: Build BlackLab Index](../how-to/build-blacklab-index.md)

---

## Deployment-Schritte

### 1. BlackLab Server starten

**Linux (systemd):**
```bash
# Install Service
sudo cp ops/blacklab-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable blacklab-server
sudo systemctl start blacklab-server

# Verify
sudo systemctl status blacklab-server
curl -s http://localhost:8081/blacklab-server/ | jq .blacklabBuildTime
```

**Windows/Development:**
```bash
# Standard: 2g Heap, 512m Metaspace
bash scripts/blacklab/run_bls.sh 8081 2g 512m

# Falls Timeout-Probleme auftreten (siehe Runbook):
bash scripts/blacklab/run_bls.sh 8081 4g 512m
```

**Erwartete Ausgabe:**
```json
{
  "blacklabVersion": "4.0.0",
  "blacklabBuildTime": "2024-XX-XX XX:XX:XX",
  "indices": {
    "corapan": {...}
  }
}
```

**Memory-Empfehlung:**
- **Development/Small Corpus (<50k tokens):** 2g Heap
- **Production/Full Corpus (>1M tokens):** 4g Heap (siehe [Runbook: BLS Timeout](runbook-advanced-search.md#incident-2-blacklab-server-timeout))

---

### 2. Flask App starten

#### Linux (Gunicorn + systemd)

**a) Service installieren:**
```bash
# Copy unit file
sudo cp ops/corapan-gunicorn.service /etc/systemd/system/

# Adjust paths in unit file if needed:
# - WorkingDirectory=/var/www/corapan
# - User/Group=www-data
# - Environment vars (BLS_BASE_URL, etc.)

# Enable & Start
sudo systemctl daemon-reload
sudo systemctl enable corapan-gunicorn
sudo systemctl start corapan-gunicorn

# Verify
sudo systemctl status corapan-gunicorn
curl -s http://localhost:8000/corpus | head -n 5
```

**b) Manuelle Gunicorn-Start (für Debugging):**
```bash
cd /var/www/corapan
source .venv/bin/activate
export FLASK_ENV=production
export BLS_BASE_URL=http://localhost:8081/blacklab-server

gunicorn \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --worker-class sync \
  --timeout 180 \
  --keep-alive 5 \
  --max-requests 1000 \
  --max-requests-jitter 50 \
  --access-logfile /var/log/corapan/access.log \
  --error-logfile /var/log/corapan/error.log \
  --log-level info \
  src.app.main:app
```

---

#### Windows (Waitress)

**a) Start-Skript:**
```bash
python scripts/start_waitress.py --host 0.0.0.0 --port 8000 --threads 4
```

**b) Manuell:**
```bash
$env:FLASK_ENV="production"
$env:BLS_BASE_URL="http://localhost:8081/blacklab-server"
python -c "from src.app.main import app; from waitress import serve; serve(app, host='0.0.0.0', port=8000, threads=4)"
```

**Erwartete Ausgabe:**
```
[2025-11-10 18:42:10] INFO in __init__: CO.RA.PAN application startup
[2025-11-10 18:42:10] INFO in __init__: [STARTUP] DB schema validation passed
INFO:waitress:Serving on http://0.0.0.0:8000
```

---

### 3. Validierung

#### Smoke Tests

```bash
# 1. Flask Health
curl -s http://localhost:8000/corpus | head -n 5

# 2. Proxy Health
curl -s http://localhost:8000/bls/ | jq .blacklabBuildTime

# 3. CQL Autodetect (alle drei Parameter-Varianten)
for PARAM in patt cql cql_query; do
  echo "Testing $PARAM:"
  curl -s "http://localhost:8000/bls/corapan/hits?${PARAM}=[lemma=\"ser\"]&maxhits=3" \
    | jq '.summary.numberOfHits'
done

# 4. Serverfilter
echo "No filter:"
curl -s 'http://localhost:8000/bls/corapan/hits?patt=[word="test"]&maxhits=1' \
  | jq '.summary | {docsRetrieved, numberOfDocs}'

echo "With country:ARG filter:"
curl -s 'http://localhost:8000/bls/corapan/hits?filter=country:"ARG"&patt=[word="test"]&maxhits=1' \
  | jq '.summary | {docsRetrieved, numberOfDocs}'

# Expected: docsRetrieved < numberOfDocs when filter active

# 5. Advanced Search UI
curl -s 'http://localhost:8000/search/advanced/results?q=M%C3%A9xico&mode=forma_exacta' \
  | grep -o 'md3-search-summary' | head -n 1
```

**Erwartete Ergebnisse:**
- ✅ Proxy: `blacklabBuildTime` vorhanden
- ✅ CQL: Alle drei Varianten (`patt`, `cql`, `cql_query`) liefern Hits
- ✅ Serverfilter: `docsRetrieved` reduziert bei aktivem Filter
- ✅ UI: `md3-search-summary` DIV vorhanden

---

#### Load Test (Sanity)

**Simple Load (ab/Apache Bench):**
```bash
# 20 req/s für 30s
ab -n 600 -c 20 -t 30 'http://localhost:8000/search/advanced/results?q=test&mode=forma_exacta'
```

**Erwartung:**
- 0% Failed Requests
- <5xx Errors in Logs

---

### 4. Logging

**Linux (systemd):**
```bash
# Flask App Logs
sudo journalctl -u corapan-gunicorn -f

# BlackLab Server Logs
sudo journalctl -u blacklab-server -f

# Access/Error Logs (falls konfiguriert)
tail -f /var/log/corapan/access.log
tail -f /var/log/corapan/error.log
```

**Windows:**
```bash
# Flask console output (wenn im Foreground)
# Oder redirect:
python scripts/start_waitress.py > logs/flask.log 2>&1
```

---

## Umgebungsvariablen

**Pflicht:**
- `FLASK_ENV=production` - Schaltet Debug-Modus aus
- `BLS_BASE_URL=http://localhost:8081/blacklab-server` - BlackLab Server Endpoint

**Optional:**
- `RATE_LIMIT_ENABLED=1` - Rate-Limiting aktivieren (Standard: 1)
- `RATE_LIMIT_SEARCH=30 per minute` - Limit für `/search/**` (Standard: 30/min)
- `SECRET_KEY=<random>` - Flask Secret (falls Session-Cookies verwendet)

---

## Firewall / Ports

**Öffentlich:**
- Port `8000` (Flask) - HTTP-Traffic

**Intern (nur localhost):**
- Port `8081` (BlackLab Server) - NICHT öffentlich exponieren!

**Linux (ufw):**
```bash
sudo ufw allow 8000/tcp comment 'CO.RA.PAN Flask'
sudo ufw deny 8081/tcp comment 'BlackLab Server (internal only)'
```

**Windows (Firewall):**
```powershell
# Allow Flask (Port 8000)
netsh advfirewall firewall add rule name="CO.RA.PAN Flask" dir=in action=allow protocol=TCP localport=8000

# Block BlackLab Server (Port 8081) from external access
netsh advfirewall firewall add rule name="BlackLab Server Internal Only" dir=in action=block protocol=TCP localport=8081 remoteip=any
netsh advfirewall firewall add rule name="BlackLab Server Localhost" dir=in action=allow protocol=TCP localport=8081 remoteip=127.0.0.1
```

---

## Rollback / Recovery

**Falls Probleme auftreten:**

### 1. BlackLab Server Neustart
```bash
# Linux
sudo systemctl restart blacklab-server

# Windows
# Beende Java-Prozess, dann:
bash scripts/blacklab/run_bls.sh 8081 2g 512m
```

### 2. Flask App Neustart
```bash
# Linux
sudo systemctl restart corapan-gunicorn

# Windows
# Ctrl+C, dann:
python scripts/start_waitress.py
```

### 3. Index-Fallback
```bash
# Falls neuer Index defekt, zurück zum Backup:
cd data/blacklab_index
mv current current.bad
mv current.backup current
sudo systemctl restart blacklab-server
```

**Siehe:** [Runbook Advanced Search](runbook-advanced-search.md)

---

## Monitoring

**Healthchecks (empfohlen):**
- `/bls/` (Proxy Health)
- `/corpus` (Flask Health)

**Alerts:**
- 5xx Errors > 1% (15min)
- Response Time > 5s (P95)
- BlackLab Server down

**Logs:**
- `httpcore.ReadError` → BLS Server Timeout (erhöhe `--timeout` in `run_bls.sh`)
- `429 Too Many Requests` → Rate-Limit überschritten (prüfe IP)

---

## Checkliste Produktivsetzung

**Pre-Deployment:**
- [ ] TSV-Export abgeschlossen (146 Dateien)
- [ ] Lucene-Index gebaut (`data/blacklab_index/`)
- [ ] systemd-Unit-Files kopiert (`scripts/ops/*.service`)
- [ ] Umgebungsvariablen gesetzt (`FLASK_ENV`, `BLS_BASE_URL`)
- [ ] Firewall-Regeln konfiguriert (Port 8000 offen, 8081 geschlossen)

**Deployment:**
- [ ] BlackLab Server gestartet (`systemctl start blacklab-server`)
- [ ] Flask App gestartet (`systemctl start corapan-gunicorn`)
- [ ] Smoke Tests erfolgreich (siehe oben)

**Post-Deployment:**
- [ ] Logs ohne Errors (`journalctl -u corapan-gunicorn`)
- [ ] Load Test bestanden (ab)
- [ ] Monitoring Healthchecks aktiv

---

## Siehe auch

- [Development Setup](development-setup.md) - Dev-Environment
- [Build BlackLab Index](../how-to/build-blacklab-index.md) - Index-Erstellung
- [Runbook: Advanced Search](runbook-advanced-search.md) - Incident-Response
- [BlackLab API Proxy](../reference/blacklab-api-proxy.md) - API-Referenz
- [Troubleshooting: BlackLab Issues](../troubleshooting/blacklab-issues.md) - Problem-Lösungen
