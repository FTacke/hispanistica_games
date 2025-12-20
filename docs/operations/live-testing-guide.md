---
title: "Live Testing Guide - Advanced Search"
status: active
owner: qa-team
updated: "2025-11-11"
tags: [testing, live-tests, advanced-search, windows, setup]
links:
  - production-deployment.md
  - runbook-advanced-search.md
  - ../how-to/advanced-search.md
---

# Live Testing Guide

## Quick Start (Windows)

### 1. Start Flask (separates Terminal)
```powershell
# Öffne neues PowerShell-Terminal und führe aus:
.\start_flask.bat
```

**Oder manuell:**
```powershell
$env:FLASK_ENV="production"
$env:BLS_BASE_URL="http://localhost:8081/blacklab-server"
$env:PYTHONPATH="$PWD"
python scripts/start_waitress.py
```

**Erwartete Ausgabe:**
```
Starting Waitress WSGI server on 0.0.0.0:8000 (threads=4)
BLS_BASE_URL: http://localhost:8081/blacklab-server
Press Ctrl+C to stop
```

---

### 2. Run Automated Tests (zweites Terminal)
```powershell
# In diesem Terminal (Flask läuft im anderen):
python scripts/live_tests.py
```

**Erwartete Ausgabe:**
```
============================================================
CO.RA.PAN Live Tests - Advanced Search
============================================================

Flask URL: http://localhost:8000
BLS URL: http://localhost:8081/blacklab-server

[1/4] Proxy Health Check...
✅ Proxy OK - BlackLab BuildTime: 2024-XX-XX XX:XX:XX

[2/4] CQL Autodetect (patt/cql/cql_query)...
✅ patt → X hits
✅ cql → X hits
✅ cql_query → X hits

[3/4] Serverfilter (with/without country filter)...
✅ No filter: docsRetrieved=146 / numberOfDocs=146
✅ ARG filter: docsRetrieved=42 / numberOfDocs=146
✅ Filter reduction confirmed (server-side filtering active)

[4/4] Advanced Search UI (HTML with A11y)...
✅ UI renders with md3-search-summary
✅ A11y attributes present (aria-live)

============================================================
Test Summary
============================================================
  Proxy Health: PASS
  CQL Autodetect: PASS
  Serverfilter: PASS
  UI Rendering: PASS

Total: 4/4 tests passed

✅ All tests passed! System is production-ready.
```

---

### 3. Manual UI Testing (Browser)

**Open:** http://localhost:8000/search/advanced

**Test Cases:**

1. **forma_exacta:**
   - Query: `México`
   - Mode: `Forma (exacto)`
   - Expected: Case-sensitive hits

2. **forma (case-insensitive):**
   - Query: `méxico`
   - Mode: `Forma`
   - Expected: Case-insensitive hits

3. **lemma:**
   - Query: `ser`
   - Mode: `Lema`
   - Expected: All forms of "ser" (soy, es, fue, era, ...)

4. **lemma + POS:**
   - Query: `ir`
   - Mode: `Lema`
   - POS: `VERB`
   - Expected: Only verb forms of "ir"

5. **Serverfilter (Country):**
   - Query: `test`
   - Mode: `Forma`
   - Country: `ARG` (Argentina)
   - Expected: Badge "filtrado activo" visible

6. **Serverfilter (Date Range):**
   - Query: `covid`
   - Mode: `Forma`
   - Date from: `2020-01-01`
   - Date to: `2020-12-31`
   - Expected: Badge "filtrado activo" visible

---

## Troubleshooting

### Flask not starting
```powershell
# Check port 8000 in use
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

# Kill process if needed
Stop-Process -Id <PID> -Force
```

### BLS not responding
```powershell
# Check if BLS running
curl.exe -s http://localhost:8081/blacklab-server/ | jq .blacklabVersion

# Restart if needed
bash scripts/blacklab/run_bls.sh 8081 2g 512m
```

### Tests failing
```powershell
# Check Flask logs (if redirected)
Get-Content logs/flask.log -Tail 50

# Check BLS logs
Get-Content logs/blacklab-server.log -Tail 50

# Retry tests with verbose output
python scripts/live_tests.py --flask-url http://localhost:8000
```

---

## Siehe auch

- [Production Deployment Guide](production-deployment.md)
- [Runbook: Advanced Search](runbook-advanced-search.md)
- [How-To: Advanced Search](../how-to/advanced-search.md)
