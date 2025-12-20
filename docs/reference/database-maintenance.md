# CO.RA.PAN - Datenbank-Wartung & Updates (Legacy)

> **⚠️ ARCHIVED**: This document describes maintenance for the legacy `transcription.db`.
> The application has migrated to **BlackLab-based search**; `transcription.db` no longer exists.
> For current corpus maintenance, rebuild the BlackLab index using:
> - Export: `python scripts/blacklab/run_export.py`
> - Build: `.\\scripts\\build_blacklab_index.ps1`
>
> For auth database (`auth.db`) maintenance, use standard SQLite tools.

**Zielgruppe:** Entwickler, Administratoren  
**Voraussetzungen:** Python 3.12+, SQLite 3.35+

---

## 📋 Übersicht

Dieses Dokument beschreibt, wie die optimierte Datenbank gewartet, aktualisiert und neu erstellt wird.

---

## 🔧 Datenbank neu erstellen

### Wann ist ein Rebuild nötig?

- ✅ Neue Transkriptions-Dateien hinzugefügt
- ✅ JSON-Struktur hat sich geändert
- ✅ Datenbank ist beschädigt
- ✅ Performance-Probleme trotz Indizes
- ❌ **NICHT nötig** nur für Code-Änderungen

### Schritt-für-Schritt Anleitung

#### 1. Vorbereitung
```bash
# Projekt-Root öffnen
cd "C:\Users\Felix Tacke\OneDrive\00 - MARBURG\DH-PROJEKTE\CO.RA.PAN\CO.RA.PAN-WEB_new"

# Virtual Environment aktivieren (falls nötig)
.\.venv\Scripts\activate
```

#### 2. Datenbank neu erstellen
```bash
cd LOKAL\database
python database_creation_v2.py
```

**Erwartete Ausgabe:**
```
🔧 CO.RA.PAN Database Builder v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Backup erstellen...
✓ Backup gespeichert: backups/20251018_143022/transcription.db

📊 JSON-Dateien parsen...
✓ 1,351,207 Tokens geladen (6m 32s)

🗄️  Datenbank erstellen...
✓ Schema erstellt
✓ 1,351,207 Rows eingefügt

📈 Performance-Indizes erstellen...
  1/7  idx_tokens_text          ... ✓ (2.1s)
  2/7  idx_tokens_lemma         ... ✓ (1.9s)
  3/7  idx_tokens_country_code  ... ✓ (1.2s)
  4/7  idx_tokens_speaker_type  ... ✓ (1.3s)
  5/7  idx_tokens_mode          ... ✓ (1.1s)
  6/7  idx_tokens_filename_id   ... ✓ (3.2s)
  7/7  idx_tokens_token_id      ... ✓ (3.3s)
✓ Alle Indizes erstellt (14.1s)

🎯 ANALYZE ausführen...
✓ Query-Optimizer-Statistiken aktualisiert (0.9s)

✓ Datenbank erfolgreich erstellt!
   Größe: 348.97 MB
   Tokens: 1,351,207
   Dauer: 7m 47s
```

#### 3. Überprüfung
```bash
# Zurück zum Projekt-Root
cd ..\..

# Server starten
$env:FLASK_APP="src.app.main"
.\.venv\Scripts\python.exe -m flask run --host=127.0.0.1 --port=8000
```

**Test durchführen:**
1. Browser öffnen: http://127.0.0.1:8000
2. Zur Corpus-Seite navigieren
3. Nach "casa" suchen
4. Ergebnis sollte < 0.1s erscheinen

---

## 🗂️ Backup-Strategie

### Automatisches Backup

`database_creation_v2.py` erstellt **automatisch** ein Backup vor jedem Rebuild:

```
LOKAL/database/backups/
  ├── 20251018_135510/
  │   ├── transcription.db      (348 MB)
  │   └── metadata.json
  ├── 20251018_143022/
  │   ├── transcription.db
  │   └── metadata.json
  └── ...
```

**metadata.json enthält:**
```json
{
  "timestamp": "2025-10-18T14:30:22",
  "original_size_mb": 348.97,
  "row_count": 1351207,
  "reason": "pre_rebuild"
}
```

### Manuelles Backup erstellen

```bash
cd data\db
copy transcription.db transcription_backup_$(Get-Date -Format "yyyyMMdd_HHmmss").db
```

### Backup wiederherstellen

```bash
cd data\db
copy ..\..​LOKAL\database\backups\20251018_135510\transcription.db transcription.db
```

**⚠️ Achtung:** Server muss gestoppt sein (WAL-Modus)!

---

## 📊 Datenbank-Status überprüfen

### SQLite CLI verwenden

```bash
cd data\db
sqlite3 transcription.db
```

**Wichtige Queries:**

```sql
-- 1. Tabellenstruktur
.schema tokens

-- 2. Indizes auflisten
PRAGMA index_list('tokens');

-- 3. Index-Details
PRAGMA index_info('idx_tokens_text');

-- 4. ANALYZE-Status
SELECT * FROM sqlite_stat1;

-- 5. Datenbankgröße
SELECT page_count * page_size / 1024.0 / 1024.0 AS size_mb 
FROM pragma_page_count(), pragma_page_size();

-- 6. Token-Anzahl
SELECT COUNT(*) FROM tokens;

-- 7. Indizes-Größe
SELECT name, (pgsize / 1024.0 / 1024.0) AS size_mb 
FROM dbstat 
WHERE name LIKE 'idx_%' 
GROUP BY name;

-- 8. Query-Performance testen
.timer ON
SELECT * FROM tokens WHERE text LIKE '%casa%' LIMIT 25;

-- 9. Query-Plan analysieren
EXPLAIN QUERY PLAN 
SELECT * FROM tokens WHERE country_code = 'ARG';
```

### Python-Script für Checks

```python
# check_db_health.py
import sqlite3
from pathlib import Path

DB_PATH = Path("data/db/transcription.db")

def check_db_health():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Indizes prüfen
    cursor.execute("PRAGMA index_list('tokens')")
    indices = cursor.fetchall()
    print(f"✓ {len(indices)} Indizes gefunden")
    
    # 2. ANALYZE-Status
    cursor.execute("SELECT COUNT(*) FROM sqlite_stat1")
    stats = cursor.fetchone()[0]
    print(f"✓ {stats} ANALYZE-Statistiken vorhanden")
    
    # 3. Row Count
    cursor.execute("SELECT COUNT(*) FROM tokens")
    rows = cursor.fetchone()[0]
    print(f"✓ {rows:,} Tokens in Datenbank")
    
    # 4. WAL-Modus
    cursor.execute("PRAGMA journal_mode")
    mode = cursor.fetchone()[0]
    print(f"✓ Journal-Modus: {mode}")
    
    conn.close()
    print("\n✅ Datenbank-Status: OK")

if __name__ == "__main__":
    check_db_health()
```

**Ausführen:**
```bash
python LOKAL\database\check_db_health.py
```

---

## 🔄 Neue Daten hinzufügen

### Szenario: Neue Aufnahme-Session

#### 1. JSON-Dateien vorbereiten

Neue Dateien in `LOKAL/JSON-roh/` ablegen:
```
LOKAL/JSON-roh/
  ├── 2025-10-20_MEX_CDMX.json
  ├── 2025-10-21_MEX_CDMX.json
  └── ...
```

**JSON-Struktur prüfen:**
```json
{
  "tokens": [
    {
      "id": 1,
      "text": "casa",
      "lemma": "casa",
      "start": 1.234,
      "end": 1.567,
      // ... weitere Felder
    }
  ]
}
```

#### 2. Audio-Dateien kopieren

```bash
# Full MP3s
copy \\Quelle\*.mp3 media\mp3-full\MEX\

# Transkripte (falls vorhanden)
copy \\Quelle\*.json media\transcripts\MEX\
```

#### 3. Datenbank neu erstellen

```bash
cd LOKAL\database
python database_creation_v2.py
```

**⏱️ Erwartete Dauer:**
- 1.000.000 Tokens: ~6 Minuten
- 1.500.000 Tokens: ~9 Minuten
- 2.000.000 Tokens: ~12 Minuten

#### 4. Testen

```bash
cd ..\..
$env:FLASK_APP="src.app.main"
.\.venv\Scripts\python.exe -m flask run --port=8000
```

Neue Daten sollten sofort durchsuchbar sein!

---

## 🛠️ Indizes manuell neu erstellen

**Wann nötig?**
- Indizes beschädigt
- Performance-Degradation
- Nach großem UPDATE/DELETE

### Methode 1: REINDEX (schnell)

```sql
sqlite3 data/db/transcription.db
REINDEX;
ANALYZE;
.quit
```

**Dauer:** ~5 Sekunden

### Methode 2: Drop & Recreate (gründlich)

```sql
DROP INDEX IF EXISTS idx_tokens_text;
DROP INDEX IF EXISTS idx_tokens_lemma;
DROP INDEX IF EXISTS idx_tokens_country_code;
DROP INDEX IF EXISTS idx_tokens_speaker_type;
DROP INDEX IF EXISTS idx_tokens_mode;
DROP INDEX IF EXISTS idx_tokens_filename_id;
DROP INDEX IF EXISTS idx_tokens_token_id;

-- Neu erstellen
CREATE INDEX idx_tokens_text ON tokens(text);
CREATE INDEX idx_tokens_lemma ON tokens(lemma);
CREATE INDEX idx_tokens_country_code ON tokens(country_code);
CREATE INDEX idx_tokens_speaker_type ON tokens(speaker_type);
CREATE INDEX idx_tokens_mode ON tokens(mode);
CREATE INDEX idx_tokens_filename_id ON tokens(filename, id);
CREATE UNIQUE INDEX idx_tokens_token_id ON tokens(token_id);

ANALYZE;
```

**Dauer:** ~15 Sekunden

---

## 🚨 Troubleshooting

### Problem: "Database is locked"

**Ursache:** WAL-Modus, Server läuft noch

**Lösung:**
```powershell
# 1. Server stoppen
Get-Process -Name python | Where-Object { $_.Path -like "*CO.RA.PAN*" } | Stop-Process -Force

# 2. WAL-Dateien aufräumen
cd data\db
del transcription.db-wal
del transcription.db-shm

# 3. Rebuild durchführen
cd ..\..\LOKAL\database
python database_creation_v2.py
```

### Problem: Query langsam trotz Indizes

**Diagnose:**
```sql
EXPLAIN QUERY PLAN SELECT * FROM tokens WHERE text = 'casa';
```

**Sollte zeigen:**
```
SEARCH TABLE tokens USING INDEX idx_tokens_text (text=?)
```

**Falls "SCAN TABLE tokens" erscheint:**
```sql
ANALYZE;
REINDEX;
```

### Problem: "No such table: sqlite_stat1"

**Ursache:** ANALYZE wurde nie ausgeführt

**Lösung:**
```sql
ANALYZE;
```

### Problem: Datenbank größer als erwartet

**Diagnose:**
```sql
VACUUM;
```

**Effekt:**
- Entfernt gelöschte Daten
- Defragmentiert Datei
- Kann Größe um 10-30% reduzieren

**⚠️ Achtung:** Kann bei großen DBs lange dauern (>10 Min)!

---

## 📈 Performance-Monitoring

### Query-Zeiten loggen (Production)

In `src/app/services/corpus_search.py` hinzufügen:

```python
import time
import logging

def search_tokens(params: SearchParams) -> dict[str, object]:
    start_time = time.time()
    
    # ... existing code ...
    
    elapsed = time.time() - start_time
    if elapsed > 0.5:  # Log slow queries
        logging.warning(f"Slow query: {elapsed:.2f}s - {params.query}")
    
    return results
```

### Benchmark-Script

```python
# benchmark_queries.py
import time
import sqlite3

DB_PATH = "data/db/transcription.db"

queries = [
    ("Häufiges Wort", "SELECT * FROM tokens WHERE text = 'de' LIMIT 25"),
    ("LIKE Query", "SELECT * FROM tokens WHERE text LIKE '%casa%' LIMIT 25"),
    ("Token-ID", "SELECT * FROM tokens WHERE token_id = 'ARG001'"),
    ("Filter", "SELECT * FROM tokens WHERE country_code = 'ARG' AND mode = 'libre' LIMIT 25"),
]

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("📊 Performance Benchmark\n")
for name, query in queries:
    start = time.time()
    cursor.execute(query)
    cursor.fetchall()
    elapsed = time.time() - start
    print(f"{name:20s}: {elapsed*1000:6.2f} ms")

conn.close()
```

**Erwartete Ausgabe:**
```
📊 Performance Benchmark

Häufiges Wort        :   1.23 ms
LIKE Query           :  83.45 ms
Token-ID             :   2.01 ms
Filter               :   5.67 ms
```

---

## 🔐 Best Practices

### ✅ DO:
- Backup vor jedem Rebuild erstellen
- ANALYZE nach Index-Änderungen ausführen
- WAL-Modus für Concurrency nutzen
- Query-Performance regelmäßig testen
- Indizes auf häufig gefilterten Spalten

### ❌ DON'T:
- Datenbank direkt editieren während Server läuft
- VACUUM ohne Backup
- Indizes auf jede Spalte (Overhead!)
- Transaction ohne COMMIT laufen lassen
- Manuelle Schema-Änderungen (immer via Script!)

---

## 📞 Support

Bei Problemen:
1. Logs prüfen: `logs/application.log`
2. DB-Health-Check ausführen
3. Backup wiederherstellen falls nötig
4. Rebuild als letztes Mittel

---

**Erstellt:** 18. Oktober 2025  
**Version:** 1.0  
**Nächste Review:** Bei Schema-Änderungen
