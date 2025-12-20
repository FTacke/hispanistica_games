---
title: "Database Troubleshooting (Legacy)"
status: archived
owner: backend-team
updated: "2025-11-26"
tags: [database, sqlite, troubleshooting, performance, archived]
links:
  - ../reference/database-maintenance.md
  - docker-issues.md
---

# Database Troubleshooting (Legacy)

> **⚠️ ARCHIVED**: This document describes troubleshooting for the legacy `transcription.db`.
> The application has migrated to **BlackLab-based search**; `transcription.db` no longer exists.
> For current issues, see BlackLab troubleshooting documentation.
> Auth database issues can be resolved using `auth.db` directly.

Häufige Datenbank-Probleme und Performance-Issues.

---

## 🔍 Performance-Probleme

### Problem: Suche ist langsam (> 1 Sekunde)

#### Diagnose 1: Indizes vorhanden?
```bash
sqlite3 data/db/transcription.db "PRAGMA index_list('tokens');"
```

**Erwartete Ausgabe:**
```
0|idx_tokens_token_id|1|u|0
1|idx_tokens_text|0|c|0
2|idx_tokens_lemma|0|c|0
3|idx_tokens_country_code|0|c|0
4|idx_tokens_speaker_type|0|c|0
5|idx_tokens_mode|0|c|0
6|idx_tokens_filename_id|0|c|0
```

**Falls leer:** Indizes erstellen
```bash
cd LOKAL\database
python database_creation_v2.py
```

#### Diagnose 2: ANALYZE ausgeführt?
```bash
sqlite3 data/db/transcription.db "SELECT COUNT(*) FROM sqlite_stat1;"
```

**Falls 0:** ANALYZE ausführen
```sql
sqlite3 data/db/transcription.db
ANALYZE;
.quit
```

#### Diagnose 3: Query nutzt Index?
```sql
sqlite3 data/db/transcription.db
EXPLAIN QUERY PLAN SELECT * FROM tokens WHERE text = 'casa';
.quit
```

**Sollte zeigen:**
```
SEARCH TABLE tokens USING INDEX idx_tokens_text (text=?)
```

**Falls "SCAN TABLE":** Index nicht genutzt
```sql
REINDEX;
ANALYZE;
```

---

### Problem: "de" oder "la" lädt endlos

**Ursache:** Client-Side DataTables lädt alle 80.000 Rows

**Lösung prüfen:**
```bash
# Prüfen ob Server-Side Script geladen wird
curl http://127.0.0.1:8000/corpus/ | findstr "corpus_datatables_serverside"
```

**Sollte zeigen:**
```html
<script src="/static/js/corpus_datatables_serverside.js"></script>
```

---

### Problem: Sortierung funktioniert nicht

**Diagnose:** Browser-Console öffnen (F12), "Network" Tab

**Klick auf Spaltenheader "País"**, sollte zeigen:
```
GET /corpus/search/datatables?...&order[0][column]=5&order[0][dir]=asc...
```

**Falls `order[0][column]=0` immer:** Frontend-Problem

**Lösung:** Cache leeren
```
Strg+Shift+R (Hard Reload)
```

**Falls Backend-Error 500:** `SUPPORTED_SORTS` prüfen

```python
# src/app/services/corpus_search.py
SUPPORTED_SORTS = {
    "country_code": "country_code",  # ← Muss existieren!
    "speaker_type": "speaker_type",
    "text": "text",
    # ...
}
```

---

## 🗄️ Datenbank-Probleme

### Problem: "Database is locked"

**Ursache:** Server läuft noch (WAL-Modus)

**Lösung:**
```powershell
# Alle Python-Prozesse stoppen
Get-Process -Name python | Where-Object { $_.Path -like "*CO.RA.PAN*" } | Stop-Process -Force

# WAL-Dateien löschen
cd data\db
del transcription.db-wal
del transcription.db-shm
```

---

### Problem: "No such table: tokens"

**Ursache:** Datenbank nicht erstellt oder beschädigt

**Lösung:**
```bash
cd LOKAL\database
python database_creation_v2.py
```

---

### Problem: Datenbank sehr groß (> 500 MB)

**Diagnose:**
```sql
sqlite3 data/db/transcription.db
SELECT page_count * page_size / 1024.0 / 1024.0 AS size_mb 
FROM pragma_page_count(), pragma_page_size();
.quit
```

**Sollte:** ~350 MB sein

**Falls > 500 MB:** VACUUM ausführen
```sql
sqlite3 data/db/transcription.db
VACUUM;
.quit
```

**⚠️ Dauer:** Kann 5-10 Minuten dauern!

---

## Siehe auch

- [Database Maintenance](../reference/database-maintenance.md) - DB-Wartung & Operationen
- [Docker Issues](docker-issues.md) - Server & Deployment
