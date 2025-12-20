---
title: "Runbook: Advanced Search Incident Response"
status: active
owner: devops
updated: "2025-11-10"
tags: [runbook, incident-response, troubleshooting, advanced-search, blacklab]
links:
  - production-deployment.md
  - ../troubleshooting/blacklab-issues.md
  - ../reference/blacklab-api-proxy.md
---

# Runbook: Advanced Search Incident Response

Incident-Response-Prozeduren für Advanced Search (BlackLab-Integration).

---

## Quick Reference

| Symptom | Diagnose | Fix | Escalation |
|---------|----------|-----|------------|
| `/bls/` → 502 Bad Gateway | BLS Server down | Restart BLS | Nach 3 Restarts: Check Index |
| `/bls/` → 504 Gateway Timeout | BLS überlastet | Check Query, restart BLS | Nach 5min: Scale BLS |
| Advanced Search → No results | CQL-Syntax | Check Logs, retry with `patt=` | Invalid Filter: Notify User |
| 429 Too Many Requests | Rate-Limit | Whitelist IP oder erhöhe Limit | Check for DDoS |
| 500 Internal Server Error | Flask Exception | Check Flask Logs | Code Issue: Rollback |

---

## Incident 1: BlackLab Server nicht erreichbar

### Symptome
- `/bls/` → `502 Bad Gateway`
- Flask Logs: `httpcore.ConnectError: [Errno 111] Connection refused`
- Advanced Search → "Ein Fehler ist aufgetreten"

### Diagnose
```bash
# Check BLS Process
ps aux | grep blacklab-server

# Check BLS Port
netstat -tuln | grep 8081

# Check BLS Health (direkt)
curl -s http://localhost:8081/blacklab-server/ | jq .blacklabVersion
```

**Falls keine Response:**
```bash
# Check Logs (Linux)
sudo journalctl -u blacklab-server -n 50

# Check Logs (Windows)
tail -f logs/blacklab-server.log
```

### Lösung

**Linux (systemd):**
```bash
sudo systemctl restart blacklab-server
sleep 10
curl -s http://localhost:8081/blacklab-server/ | jq .blacklabVersion
```

**Windows:**
```bash
# Beende Java-Prozess
taskkill /F /IM java.exe

# Neustart
bash scripts/blacklab/run_bls.sh 8081 2g 512m

# Validierung
Start-Sleep -Seconds 10
curl.exe -s http://localhost:8081/blacklab-server/ | jq .blacklabVersion
```

**Falls weiterhin fehlschlägt:**
- Check Index-Integrität: `ls -lh data/blacklab_index/`
- Falls korrupt: Restore Backup oder Rebuild
- Siehe: [Troubleshooting: BlackLab Index Corruption](../troubleshooting/blacklab-issues.md#problem-3-index-corruption)

### Prävention
- Monitoring: Healthcheck `/bls/` alle 60s
- Alert: BLS down > 2min

---

## Incident 2: BlackLab Server Timeout

### Symptome
- `/bls/corapan/hits` → `504 Gateway Timeout`
- Flask Logs: `httpcore.ReadTimeout: timed out`
- Response Time > 180s

### Diagnose
```bash
# Check BLS Load (direkt)
curl -s http://localhost:8081/blacklab-server/corapan/status | jq .status

# Check BLS Memory
ps aux | grep blacklab-server | awk '{print $6/1024 " MB"}'

# Test simple query (direkt)
time curl -s 'http://localhost:8081/blacklab-server/corapan/hits?patt=[word="test"]&maxhits=1' > /dev/null
```

**Falls Timeout > 10s für simple query:**
- BLS überlastet oder Index-Problem

### Lösung

**1. Restart BLS (Quick Fix):**
```bash
sudo systemctl restart blacklab-server
```

**2. Erhöhe Memory/Timeout (falls wiederkehrend):**
```bash
# Erhöhe Heap von 2g auf 4g
# Erhöhe Heap von 2g auf 4g
bash scripts/blacklab/run_bls.sh 8081 4g 512m

# Oder in systemd-Unit (Production):
# Edit /etc/systemd/system/blacklab-server.service
# Change ExecStart: -Xmx2g → -Xmx4g
sudo systemctl daemon-reload
sudo systemctl restart blacklab-server
```

**Memory-Empfehlung:** Siehe [Production Deployment: Memory-Empfehlung](production-deployment.md#1-blacklab-server-starten)

**3. Index-Rebuild (falls Corruption vermutet):**
```bash
# Index neu bauen (bash helper)
bash scripts/blacklab/build_blacklab_index.sh tsv 4
```

### Prävention
- Monitoring: P95 Response Time > 5s (Alert)
- Optimize Queries: Limit `maxhits`, avoid `[]*` wildcard
- Heap-Size: 4g für Production (>1M Tokens Corpus)

---

## Incident 3: Advanced Search No Results (False Negative)

### Symptome
- Query liefert 0 Hits, obwohl Daten vorhanden
- UI zeigt "0 concordancias"
- Keine Error-Message

### Diagnose
```bash
# 1. Test query direkt gegen BLS
curl -s 'http://localhost:8081/blacklab-server/corapan/hits?patt=[word="test"]&maxhits=5' | jq .summary.numberOfHits

# 2. Test über Proxy
curl -s 'http://localhost:8000/bls/corapan/hits?patt=[word="test"]&maxhits=5' | jq .summary.numberOfHits

# 3. Check CQL-Syntax
curl -s 'http://localhost:8000/bls/corapan/hits?cql=[word="test"]&maxhits=5' | jq .summary.numberOfHits
```

**Falls BLS direkt funktioniert, Proxy nicht:**
- Check Flask Logs für CQL-Param-Normalisierung
- Check Serverfilter (möglicherweise zu restriktiv)

**Falls BLS direkt auch 0 Hits:**
- Prüfe CQL-Syntax
- Prüfe Feldnamen (`word`, `lemma`, `pos`, `norm`)

### Lösung

**A) Falsche CQL-Syntax:**
```bash
# Falsch: [word="México"] (case-sensitive)
# Richtig: [word="(?i)méxico"]  # Case-insensitive

# Falsch: [lemma="ser" & pos="V.*"]
# Richtig: [lemma="ser" & pos="V.*"]  # BLS unterstützt & nicht &&
```

**B) Serverfilter zu restriktiv:**
```bash
# Check Filter
curl -s 'http://localhost:8000/bls/corapan/hits?filter=country:"ZZZ"&patt=[word="test"]&maxhits=1' | jq .summary

# Falls docsRetrieved=0 → Filter ungültig
# Lösung: Remove Filter oder adjust
```

**C) Index-Field fehlt:**
```bash
# Check Index-Fields
curl -s http://localhost:8081/blacklab-server/corapan/ | jq '.annotatedFields | keys'

# Expected: ["word", "lemma", "pos", "norm"]
# Falls fehlt: Rebuild Index mit korrekter BLF-Config
```

### Prävention
- UI-Validierung: Zeige CQL-Syntax-Hilfe
- Backend: Log invalid Queries (400 Bad Request)

---

## Incident 4: Rate-Limit 429 Too Many Requests

### Symptome
- `/search/advanced/results` → `429 Too Many Requests`
- UI zeigt: "Zu viele Anfragen"
- Logs: `flask_limiter: rate limit exceeded`

### Diagnose
```bash
# Check Limits (im Code: src/app/__init__.py)
grep "RATELIMIT_" src/app/__init__.py

# Default: 30 per minute per IP

# Check offending IP
grep "429" /var/log/corapan/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head
```

### Lösung

**A) Legitimer Traffic (z.B. Scraper, Researcher):**
```python
# Whitelist IP in src/app/__init__.py
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
    exempt_when=lambda: request.remote_addr in ["192.168.1.100", "10.0.0.5"]
)
```

**B) DDoS / Malicious:**
```bash
# Block IP (Linux)
sudo iptables -A INPUT -s <IP> -j DROP

# Windows (Firewall)
netsh advfirewall firewall add rule name="Block <IP>" dir=in action=block remoteip=<IP>
```

**C) Erhöhe Limit temporär:**
```python
# Edit src/app/__init__.py
@app.route("/search/advanced/results")
@limiter.limit("60 per minute")  # War: 30 per minute
def advanced_search_results():
    ...
```

### Prävention
- Monitoring: Spike in 429s > 100/min (Alert)
- CAPTCHA bei wiederholten 429s (optional)

---

## Incident 5: Flask 500 Internal Server Error

### Symptome
- `/search/advanced/results` → `500 Internal Server Error`
- UI zeigt: "Ein unerwarteter Fehler ist aufgetreten"
- Logs: Python Traceback

### Diagnose
```bash
# Check Flask Logs
sudo journalctl -u corapan-gunicorn -n 100 | grep "ERROR"

# Windows
tail -f logs/flask.log | grep "ERROR"

# Look for Traceback
```

**Häufige Ursachen:**
- DB-Fehler (SQLite locked)
- JSON-Parsing-Fehler (BLS Response invalid)
- Template-Rendering-Fehler (Jinja2)

### Lösung

**A) SQLite Locked:**
```python
# Symptom: "database is locked"
# Cause: Concurrent writes (kein WAL-Modus)

# Fix: Enable WAL in DB-Init (bereits umgesetzt in src/app/database.py)
```

**B) JSON-Parsing:**
```python
# Symptom: "Expecting value: line 1 column 1 (char 0)"
# Cause: BLS returned non-JSON (HTML error page)

# Debug: Log raw response
curl -v http://localhost:8081/blacklab-server/corapan/hits?patt=INVALID
```

**C) Template-Error:**
```python
# Symptom: "UndefinedError: 'results' is undefined"
# Cause: Missing variable in render_template()

# Fix: Always pass all required template vars
```

**Quick Rollback:**
```bash
# Linux
git revert HEAD
sudo systemctl restart corapan-gunicorn

# Windows
git revert HEAD
# Restart Waitress
```

### Prävention
- Unit-Tests für alle Routes
- Sentry/Error-Tracking (optional)

---

## Maintenance Mode

**Aktivieren:**
```bash
# Create maintenance flag
touch /var/www/corapan/data/maintenance.flag

# Flask checks this in middleware (optional feature)
```

**Banner (optional UI-Feature):**
```html
<!-- templates/base.html -->
{% if maintenance_mode %}
<div class="maintenance-banner" role="alert">
  🔧 Wartungsmodus: Advanced Search vorübergehend eingeschränkt
</div>
{% endif %}
```

---

## Incident 5: Export-Route hängt oder timeout

### Symptome
- `/search/advanced/export` → Download stoppt nach Minuten
- Flask Logs: `httpcore.ReadTimeout during export`
- BLS ist online, aber Export-Anfrage läuft Timeout

### Ursache
- Zu viele Treffer (> 50.000)
- BLS ist langsam beim Streaming von Chunks
- Netzwerkunterbrechung

### Diagnose
```bash
# Test Export mit kleinem Query
curl -v 'http://localhost:8000/search/advanced/export?q=a&mode=forma&format=csv' \
  -o /tmp/test.csv

# Check Dateisize
ls -lh /tmp/test.csv

# Test mit Timeout-Override (cURL)
curl --max-time 120 \
  'http://localhost:8000/search/advanced/export?q=radio&mode=forma&format=csv' \
  -o results.csv
```

### Lösung

**Für Benutzer:**
1. Mache Query spezifischer (z.B., mit Filtern)
2. Nutze DataTables `/search/advanced/data` für Pagination statt Export-alles
3. Erhöhe Client-Timeout (z.B., Browser-Download-Einstellung)

**Für Ops:**
```bash
# Check BLS Memory (sollte < 80% sein)
free -h

# Check I/O Bottleneck
iostat -x 1 5

# Scale BLS bei Bedarf
# Erhöhe -Xmx flag (z.B., 4g → 8g)
bash scripts/blacklab/run_bls.sh 8081 8g 1g

# Restart Flask/Gunicorn (erhöhe timeout)
# Edit /etc/systemd/system/corapan-gunicorn.service
# ExecStart=... --timeout 240 (statt 180)
sudo systemctl daemon-reload
sudo systemctl restart corapan-gunicorn
```

### Prävention
- Monitoring: Export Duration Histogram
- Alert: Export > 120s
- Hard-Cap GLOBAL_HITS_CAP = 50.000 durchsetzen

---

## Escalation Matrix

| Severity | Response Time | Escalate To |
|----------|---------------|-------------|
| P1 (Critical: Site Down) | 15min | DevOps Lead |
| P2 (Major: Feature Down) | 1h | Backend Team |
| P3 (Minor: Degraded Perf) | 4h | On-Call Dev |
| P4 (Low: Cosmetic) | 24h | Next Sprint |

---

## Post-Incident Review

**Template:**
```markdown
## Incident: [Title]
**Date:** YYYY-MM-DD HH:MM
**Duration:** Xmin
**Impact:** Y users affected

### Timeline
- HH:MM - First alert
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Mitigation applied
- HH:MM - Resolved

### Root Cause
...

### Fix
...

### Preventive Actions
- [ ] Action 1
- [ ] Action 2

### Lessons Learned
...
```

---

## Siehe auch

- [Production Deployment](production-deployment.md) - Deployment-Schritte
- [Troubleshooting: BlackLab Issues](../troubleshooting/blacklab-issues.md) - Detaillierte Problem-Lösungen
- [BlackLab API Proxy](../reference/blacklab-api-proxy.md) - API-Referenz
- [Development Setup](development-setup.md) - Dev-Environment
