---
title: "Docker & Deployment Troubleshooting"
status: active
owner: devops
updated: "2025-11-07"
tags: [docker, deployment, troubleshooting, containers]
links:
  - ../operations/deployment.md
  - database-issues.md
---

# Docker & Deployment Troubleshooting

Häufige Docker- und Deployment-Probleme und deren Lösungen.

---

## 🐳 Server-Probleme

### Problem: Server startet nicht

#### Error: "Address already in use"

**Lösung:**
```powershell
# Port 8000 freigeben
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
```

#### Error: "ModuleNotFoundError: No module named 'flask'"

**Lösung:**
```bash
.\.venv\Scripts\activate
pip install -r requirements.txt
```

#### Error: "Failed to find application in module 'src.app.main'"

**Lösung:**
```powershell
# Korrekte Umgebungsvariable setzen
$env:FLASK_APP="src.app.main"
.\.venv\Scripts\python.exe -m flask run --port=8000
```

---

### Problem: 500 Internal Server Error bei Search

**Diagnose:** Logs prüfen
```bash
# In separatem Terminal
Get-Content logs/application.log -Wait -Tail 50
```

**Häufige Fehler:**

#### TypeError: 'Counter' object is not callable
```python
# FALSCH:
counter_search()

# RICHTIG:
counter_search.increment()
```

#### TypeError: 'NoneType' object is not iterable
```python
# FALSCH:
def _normalise(values):
    return [v.strip() for v in values]

# RICHTIG:
def _normalise(values):
    if values is None:
        return []
    return [v.strip() for v in values if v]
```

---

## 🛠️ Debug-Modus aktivieren

### Flask Debug Mode
```powershell
$env:FLASK_DEBUG="1"
.\.venv\Scripts\python.exe -m flask run --port=8000
```

**Zeigt:**
- Detaillierte Error-Messages
- Auto-Reload bei Code-Änderungen
- Interactive Debugger im Browser

**⚠️ NUR für Development!**

---

### SQL-Queries loggen

```python
# src/app/services/corpus_search.py
import logging

def search_tokens(params: SearchParams):
    # ...
    logging.debug(f"SQL Query: {data_sql}")
    logging.debug(f"Bindings: {bindings_for_data}")
    cursor.execute(data_sql, bindings_for_data)
```

**In Console:**
```bash
# Logging-Level setzen
$env:FLASK_LOG_LEVEL="DEBUG"
```

---

## 📞 Letzte Rettung: Clean Reset

> **Note:** The `transcription.db` references below are legacy. The current
> architecture uses BlackLab indexes instead. For corpus issues, rebuild the
> BlackLab index using `scripts/build_blacklab_index.ps1`.

Wenn nichts hilft:

```bash
# 1. Server stoppen
Get-Process -Name python | Stop-Process -Force

# 2. Backup erstellen
copy data\db\transcription.db data\db\transcription_emergency_backup.db

# 3. Datenbank neu erstellen
cd LOKAL\database
python database_creation_v2.py

# 4. Cache leeren
# Browser: Strg+Shift+Delete → Alles löschen

# 5. Server neu starten
cd ..\..
$env:FLASK_APP="src.app.main"
.\.venv\Scripts\python.exe -m flask run --port=8000

# 6. Hard Reload
# Browser: Strg+Shift+R
```

---

## 📊 Health Check Script

> **Note:** The database health check below references the legacy `transcription.db`
> which no longer exists. Use `/health/bls` endpoint to check BlackLab status.

```python
# health_check.py (legacy - for reference only)
import sqlite3
import requests
from pathlib import Path

def check_database():
    """Datenbank-Status prüfen"""
    db = Path("data/db/transcription.db")
    if not db.exists():
        print("❌ Datenbank nicht gefunden!")
        return False
    
    conn = sqlite3.connect(db)
    cursor = conn.cursor()
    
    # Indizes prüfen
    cursor.execute("PRAGMA index_list('tokens')")
    indices = cursor.fetchall()
    if len(indices) < 7:
        print(f"⚠️  Nur {len(indices)}/7 Indizes gefunden!")
        return False
    
    print("✅ Datenbank OK")
    return True

def check_server():
    """Server erreichbar?"""
    try:
        r = requests.get("http://127.0.0.1:8000", timeout=5)
        if r.status_code == 200:
            print("✅ Server läuft")
            return True
    except:
        print("❌ Server nicht erreichbar!")
        return False

def check_search():
    """Search-Endpoint testen"""
    try:
        r = requests.get(
            "http://127.0.0.1:8000/corpus/search/datatables",
            params={
                "query": "test",
                "search_mode": "text",
                "start": 0,
                "length": 25,
                "draw": 1
            },
            timeout=10
        )
        if r.status_code == 200:
            print("✅ Search-Endpoint OK")
            return True
        else:
            print(f"⚠️  Search-Endpoint: Status {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Search-Endpoint Fehler: {e}")
        return False

if __name__ == "__main__":
    print("🔍 CO.RA.PAN Health Check\n")
    
    db_ok = check_database()
    server_ok = check_server()
    search_ok = check_search() if server_ok else False
    
    print(f"\n{'✅' if all([db_ok, server_ok, search_ok]) else '❌'} Gesamtstatus")
```

**Ausführen:**
```bash
python health_check.py
```

---

## Siehe auch

- [Deployment Guide](../operations/deployment.md) - Production-Setup
- [Database Issues](database-issues.md) - DB-spezifische Probleme
- [Frontend Issues](frontend-issues.md) - UI-Probleme
