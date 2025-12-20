---
title: "CO.RA.PAN Development Setup"
status: active
owner: devops
updated: "2025-11-28"
tags: [development, setup, postgres, blacklab, docker]
---

# CO.RA.PAN Development Setup

Lokale Entwicklungsumgebung: Flask + PostgreSQL + BlackLab

## Empfohlener Quick Start (Ein Befehl)

```powershell
# Im Repository-Root ausführen
.\scripts\dev-setup.ps1
```

Dieser Befehl:
1. Richtet `.venv` + Python-Dependencies ein
2. Startet PostgreSQL + BlackLab via Docker
3. Führt die Auth-DB-Migration aus
4. Startet den Flask Dev-Server unter `http://localhost:8000`

**Login:** `admin` / `change-me`

### Voraussetzungen

- **Docker Desktop** (für PostgreSQL + BlackLab)
- **Python 3.12+**
- **PowerShell 5.1+** (Windows)

---

## Tägliches Starten

Wenn alles bereits eingerichtet ist:

```powershell
.\scripts\dev-start.ps1
```

---

## SQLite-Fallback (nur für schnelle Tests)

```powershell
.\scripts\dev-setup.ps1 -UseSQLite
```

> ⚠️ **Hinweis:** SQLite ist nicht produktionsrepräsentativ. Für Integrations-/Release-Tests immer Postgres verwenden.

---

## Docker-Stack

Der Dev-Stack verwendet `docker-compose.dev-postgres.yml`:

| Service | Container | Port | Beschreibung |
|---------|-----------|------|-------------|
| PostgreSQL | `corapan_auth_db` | `54320` | Auth-Datenbank |
| BlackLab | `blacklab-server-v3` | `8081` | Corpus-Suchserver |

### Manuell starten/stoppen

```powershell
# Starten
docker compose -f docker-compose.dev-postgres.yml up -d

# Stoppen
docker compose -f docker-compose.dev-postgres.yml down

# Logs ansehen
docker compose -f docker-compose.dev-postgres.yml logs -f
```

---

## Environment-Variablen

Die Dev-Skripte setzen automatisch:

| Variable | Wert |
|----------|------|
| `AUTH_DATABASE_URL` | `postgresql+psycopg://corapan_auth:corapan_auth@localhost:54320/corapan_auth` |
| `JWT_SECRET_KEY` | `dev-jwt-secret-change-me` |
| `FLASK_SECRET_KEY` | `dev-secret-change-me` |
| `BLACKLAB_BASE_URL` | `http://localhost:8081/blacklab-server` |

---

## Directory Structure

```
.
├── src/app/                          # Flask application
│   ├── __init__.py                  # App factory: create_app()
│   ├── main.py                      # Entry point
│   ├── routes/
│   │   ├── bls_proxy.py            # /bls/** → 127.0.0.1:8081
│   │   ├── auth.py, corpus.py, ... # Other routes
│   ├── extensions/
│   │   ├── __init__.py             # JWT, Cache, Limiter
│   │   ├── http_client.py          # httpx singleton
│   └── services/
│       └── database.py             # DB models, queries
│
├── src/scripts/
│   └── blacklab_index_creation.py  # JSON→TSV+Docmeta exporter
│
├── config/blacklab/
│   └── corapan.blf.yaml            # Index configuration
│
├── scripts/
│   ├── dev-setup.ps1               # Full dev setup (recommended)
│   ├── dev-start.ps1               # Quick start for daily use
│   ├── build_blacklab_index.ps1    # Build corpus index
│   └── blacklab/                   # BlackLab helper scripts
│
├── docker-compose.dev-postgres.yml # Dev stack (Postgres + BlackLab)
│
├── data/
│   ├── db/postgres_dev/            # PostgreSQL data (Docker volume)
│   ├── blacklab_index/             # Lucene index (don't edit manually)
│   └── blacklab_export/            # TSV export files
│
├── media/transcripts/               # JSON corpus by country
│   ├── ARG/, MEX/, CHL/, ...
│
└── requirements.txt                # Python dependencies
```

---

## Make Targets (Alternative)

```bash
make help                   # Show all targets

# Setup & Development
make install                # Install Python dependencies
make dev                    # Start Flask (http://localhost:8000)
make test                   # Run pytest suite
make clean                  # Remove cache/__pycache__

# BlackLab Indexing
make index                  # Full index build (5-30 min)
make index-dry              # Dry-run: show sample (2 sec)
make bls                    # Start BlackLab Server (port 8081)
make proxy-test             # Quick health check (/bls/)

# Docs
make docs                   # Open documentation
```

---

## BlackLab Stack

### 3-Stage Pipeline

```
JSON Corpus (media/transcripts/)
        ↓
[1] EXPORT: JSON → TSV + docmeta.jsonl (idempotent)
        ↓
/data/bl_input/ → *.tsv + docmeta.jsonl
        ↓
[2] INDEX: Lucene indexing + atomic switch
        ↓
/data/blacklab_index/ (read-only after build)
        ↓
[3] PROXY: Flask /bls/** → http://127.0.0.1:8081/blacklab-server/**
        ↓
http://localhost:8000/bls/ (streaming, pooled connections)
```

### Commands Reference

```bash
# Export JSON to TSV (dry-run)
make index-dry

# Export + Build Index (full)
make index

# Start BLS on port 8081
make bls

# Test proxy connectivity
make proxy-test

# Manual export with options
python -m src.scripts.blacklab_index_creation \
  --in media/transcripts \
  --out /data/bl_input \
  --format tsv \
  --workers 4 \
  --docmeta /data/bl_input/docmeta.jsonl

# Manual index build
bash scripts/blacklab/build_blacklab_index.sh tsv 4

# Manual BLS start
bash scripts/blacklab/run_bls.sh 8081 2g 512m
```

---

## Development Workflow

### 1️⃣ Start Dev Server

```bash
make dev
# Output: Running on http://0.0.0.0:8000/
```

Flask reloads on code changes. Check `logs/app.log` for errors.

### 2️⃣ Build & Test Index (separate terminal)

```bash
# First time: full build (5-30 min)
make index

# Output:
# [INFO] === BlackLab Index Build Started ===
# [INFO] Export complete: 1247 files
# [INFO] Index build successful
# [INFO] Index size: 2.3G
# [INFO] === Build Complete ===
```

### 3️⃣ Start BlackLab Server (separate terminal)

```bash
make bls
# Output:
# [INFO] BlackLab Server started (PID: 12345)
# [INFO] Health check: curl -s http://127.0.0.1:8081/blacklab-server/
# [INFO] Web UI: http://localhost:8081/blacklab-server/
```

### 4️⃣ Test Search

```bash
# Via proxy
curl -s 'http://localhost:8000/bls/corapan/hits?patt=[word="test"]&maxhits=5' \
  | jq '.summary.numberOfHits'

# Or use debug dashboard
open http://localhost:8000/search/debug_bls/
```

---

## Environment Variables

```bash
# Set before running make/scripts

# Flask
export FLASK_ENV=development
export FLASK_DEBUG=1

# BlackLab Server URL (proxy target)
export BLS_BASE_URL=http://localhost:8081/blacklab-server

# Input corpus directory (default: media/transcripts)
export CORAPAN_JSON_DIR=/custom/path/to/json

# Index directory (default: /data/blacklab_index)
export BLS_INDEX_DIR=/custom/path/to/index

# Java memory for indexing
export _JAVA_OPTIONS="-Xms512m -Xmx4g"

# Then run:
make index
make bls
make dev
```

---

## Troubleshooting

### "Flask not starting"

```bash
# Check port 8000 in use
lsof -i :8000
ss -tlnp | grep 8000

# Kill existing process
kill -9 <PID>

# Try different port
FLASK_PORT=8001 make dev
```

### "BlackLab Server won't start"

```bash
# Check Java
java -version
# If missing: apt-get install openjdk-11-jre-headless

# Check port 8081 in use
lsof -i :8081

# Check logs
tail -50 logs/bls/server.log
```

### "Index build fails"

```bash
# Dry-run first
make index-dry

# Check disk space
df -h /data/

# Check JSON files
ls -la media/transcripts/ARG/ | head -3

# Check encoding
file -i media/transcripts/ARG/*.json
```

### "Proxy returns 502"

```bash
# Check BLS is running
curl http://127.0.0.1:8081/blacklab-server/

# Check Flask app
tail -20 logs/app.log

# Test Flask directly
curl http://localhost:8000/

# Start BLS
make bls
```

---

## Performance Tips

### Index Build

```bash
# Use more workers (if multi-core)
bash scripts/blacklab/build_blacklab_index.sh tsv 8

# Or limit corpus for testing
python -m src.scripts.blacklab_index_creation \
  --limit 100  # First 100 files only
```

### Search Queries

```bash
# Limit results
query=[word="the"]&number=100

# Filter by country (faster)
query=[word="the"]&filter=country_code:ARG

# Use lemma/pos instead of wildcard
query=[lemma="ser"]     # Good
query=[word=".*"]       # Slow (matches all)
```

### Memory

```bash
# Monitor Flask memory
watch -n 1 'ps aux | grep python'

# Increase if needed
export _JAVA_OPTIONS="-Xmx4g"  # For BLS
```

---

---

## Production Deployment (WSGI)

### Architecture

**Development:** Flask dev server with hot-reload (Werkzeug)  
**Production:** WSGI server (Gunicorn/Waitress) with stable process management

**No Docker/Nginx required.** Flask BLS proxy handles `/bls/**` routing in both environments.

### Gunicorn Setup

**Install:**
```bash
pip install gunicorn
```

**Start:**
```bash
gunicorn --bind 0.0.0.0:8000 \
  --workers 4 \
  --timeout 180 \
  --keep-alive 5 \
  --worker-class sync \
  --access-logfile logs/gunicorn-access.log \
  --error-logfile logs/gunicorn-error.log \
  --log-level info \
  src.app.main:app
```

**Parameter Rationale:**
- `--timeout 180`: Matches `httpx` read timeout (long CQL queries)
- `--keep-alive 5`: Matches `httpx` pool timeout (connection reuse)
- `--workers 4`: Multi-process (avoids hot-reload conflicts)
- `--worker-class sync`: Synchronous workers (stable for proxy)

### Known Limitations (Development Only)

**Issue:** "httpcore.ReadError: peer closed connection" when using Flask dev server with mock BLS.

**Cause:** Werkzeug hot-reload kills child processes during code changes, dropping active connections.

**Mitigation:**
- **Dev:** Expected behavior, non-blocking (retry request or use direct tests)
- **Prod:** Use Gunicorn/Waitress (no hot-reload, stable connections)

**Workaround:**
```bash
# Test mock BLS directly (bypasses Flask proxy)
python scripts/test_mock_bls_direct.py
```

### Systemd Service (Production)

**File:** `/etc/systemd/system/corapan-gunicorn.service`
```ini
[Unit]
Description=CO.RA.PAN Flask Application
After=network.target

[Service]
Type=notify
User=corapan
Group=corapan
WorkingDirectory=/opt/corapan
Environment="PATH=/opt/corapan/.venv/bin"
Environment="BLS_BASE_URL=http://localhost:8081/blacklab-server"
ExecStart=/opt/corapan/.venv/bin/gunicorn \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --timeout 180 \
  --keep-alive 5 \
  --access-logfile /var/log/corapan/gunicorn-access.log \
  --error-logfile /var/log/corapan/gunicorn-error.log \
  src.app.main:app
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

**Enable:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable corapan-gunicorn
sudo systemctl start corapan-gunicorn
sudo systemctl status corapan-gunicorn
```

---

## Links

- **Docs:** [BlackLab Indexing](docs/concepts/blacklab-indexing.md)
- **How-To:** [Build BlackLab Index](docs/how-to/build-blacklab-index.md), [Advanced Search](docs/how-to/advanced-search.md)
- **API Reference:** [BlackLab Proxy](docs/reference/blacklab-api-proxy.md), [Search Parameters](docs/reference/search-params.md)
- **Schema:** [BLF YAML](docs/reference/blf-yaml-schema.md)
- **Troubleshooting:** [BlackLab Issues](docs/troubleshooting/blacklab-issues.md)

---

## Production Deployment

**Für Produktivsetzung siehe:**
- [Production Deployment Guide](production-deployment.md) - Vollständige Prod-Setup-Anleitung
- [Runbook: Advanced Search](runbook-advanced-search.md) - Incident Response

**WSGI-Server:**
- **Linux:** Gunicorn (siehe `ops/corapan-gunicorn.service`)
- **Windows:** Waitress (`python scripts/start_waitress.py`)

**Quick Prod Start (Linux):**
```bash
# 1. Start BlackLab Server
sudo systemctl start blacklab-server

# 2. Start Flask with Gunicorn
export BLS_BASE_URL=http://localhost:8081/blacklab-server
gunicorn --bind 0.0.0.0:8000 --workers 4 --timeout 180 --keep-alive 5 src.app.main:app
```

**Quick Prod Start (Windows):**
```bash
# 1. Start BlackLab Server
bash scripts/blacklab/run_bls.sh 8081 2g 512m

# 2. Start Flask with Waitress
$env:BLS_BASE_URL="http://localhost:8081/blacklab-server"
python scripts/start_waitress.py
```

---

## Next Steps

1. **Explore code:** `src/app/routes/bls_proxy.py` (Flask-Proxy implementation)
2. **Try queries:** `http://localhost:8000/search/advanced`
3. **Read docs:** See `docs/concepts/search-architecture.md` for architecture overview
4. **Production deploy:** See [Production Deployment](production-deployment.md)
5. **Contribute:** Follow [CONTRIBUTING.md](/CONTRIBUTING.md)
