---
title: "Corpus Search Column Robustness Refactoring"
status: active
owner: backend-team
updated: "2025-11-08"
tags: [corpus, api-design, database, refactoring, column-stability]
links:
  - ../reference/corpus-search-architecture.md
  - ../reference/database-schema.md
  - ../decisions/ADR-0001-docs-reorganization.md
---

# Corpus Search Column Robustness Refactoring

## Problem

Die bisherige Corpus-Search-API war **abhängig von DB-Spaltenreihenfolge**:

- Frontend nutzte **Array-Indizes** (`row[4]`, `row[11]`, etc.) statt stabiler Keys
- Backend nutzte `SELECT *` ohne explizite Spaltenlisten
- Kleine DB-Schema-Änderungen (z.B. neue Spalte) **brachen das Frontend**
- Keine Validierung bei App-Start: Fehler erst bei Laufzeit

**Risiko:** Production-Fehler bei DB-Upgrades

---

## Lösung

Umstellung auf **spaltenrobusten, namenbasierten API-Design**:

### Backend-Änderungen

#### 1. Kanonische Spaltenliste (CANON_COLS)

```python
# src/app/services/corpus_search.py
CANON_COLS = [
    "token_id",           # Eindeutige Token-ID
    "filename",           # MP3-Datei
    "country_code",       # Land
    "radio",              # Sender
    "date",               # Datum
    "speaker_type",       # "pro" oder "otro"
    "sex",                # "m" oder "f"
    "mode",               # Registermodus
    "discourse",          # Diskurs-Typ
    "text",               # Suchresultat
    "start",              # Start-Zeit (Sekunden/Frames)
    "end",                # End-Zeit
    "context_left",       # Kontext davor
    "context_right",      # Kontext danach
    "context_start",      # Context-Start
    "context_end",        # Context-End
    "lemma",              # Lemma (für Suche)
]
```

**Garantie:** Diese Keys sind **für immer** stabil in der JSON-Response.

#### 2. Row-Factory aktiviert

```python
# search_tokens() in corpus_search.py
with open_db("transcription") as connection:
    import sqlite3
    connection.row_factory = sqlite3.Row  # AKTIVIERT
    cursor = connection.cursor()
```

**Effekt:** `row["fieldname"]` statt `row[index]`

#### 3. Explizite SELECT-Spaltenlisten

**Vorher (unsicher):**
```python
cursor.execute("SELECT * FROM tokens WHERE ...")
```

**Nachher (robust):**
```python
select_cols = _get_select_columns()  # "token_id AS token_id, filename AS filename, ..."
cursor.execute(f"SELECT {select_cols} FROM tokens WHERE ...")
```

**Vorteil:** Reihenfolge irrelevant, Keywords stabil

#### 4. Objektausgabe statt Tupel

**Vorher (Array-basiert):**
```python
data = [
    [idx, row[1], row[2], row[3], ...]  # Array-Index magisch
]
```

**Nachher (Objekt-basiert):**
```python
data = [
    {
        "row_number": idx,
        "context_left": row["context_left"],
        "text": row["text"],
        "country_code": row["country_code"],
        # ... alle Keys aus CANON_COLS
    }
]
```

#### 5. Schema-Validierung beim Start

```python
# src/app/__init__.py
def _validate_db_schema_on_startup(app: Flask) -> None:
    """Prüft: Sind alle CANON_COLS in der DB vorhanden?"""
    with open_db("transcription") as conn:
        cursor = conn.cursor()
        _validate_db_schema(cursor, CANON_COLS)
    # → 500-Error beim Start, nicht erst bei Abfrage
```

**Sicherheit:** Fehler früh erkannt (Development, nicht Production)

#### 6. Whitelisting für Sortierung

**Vorher (unsicher):**
```python
sort_field = user_input  # "DROP TABLE tokens;" möglich!
```

**Nachher (sicher):**
```python
ALLOWED_SORT_FIELDS = set(CANON_COLS) - {"context_left", "context_right"}

if sort_field not in ALLOWED_SORT_FIELDS:
    logger.warning(f"Invalid sort field: {sort_field}")
    sort_field = "text"  # Fallback
```

### Frontend-Änderungen

#### Objektmodus in DataTables

**Vorher (Array-Indizes):**
```javascript
columns: [
    { data: 0 },      // Zeilennummer
    { data: 1 },      // Context Left
    { data: 2 },      // Text
    { data: 11 },     // Filename
]
```

**Nachher (Objektkeys):**
```javascript
columns: [
    { data: 'row_number' },
    { data: 'context_left' },
    { data: 'text' },
    { data: 'filename' },
]
```

**Render-Funktionen aktualisiert:**

```javascript
// Vorher
render: (data, type, row) => {
    const filename = row[11];
    const start = row[12];
}

// Nachher
render: (data, type, row) => {
    const filename = row.filename;
    const start = row.start;
}
```

---

## Änderungen (Dateien)

### Backend

| Datei | Typ | Änderung |
|-------|-----|----------|
| `src/app/services/corpus_search.py` | modify | CANON_COLS, Row-Factory, explizite SELECTs, Whitelisting |
| `src/app/routes/corpus.py` | modify | `search_datatables()` Objektausgabe, `token_lookup()` Objektkeys |
| `src/app/__init__.py` | modify | Schema-Check beim Start |

### Frontend

| Datei | Typ | Änderung |
|-------|-----|----------|
| `static/js/modules/corpus/datatables.js` | modify | Spalten zu Objektkeys, Render-Funktionen angepasst |

---

## Validierung

### App-Start
```
[STARTUP] Starting DB schema validation...
[STARTUP] DB schema validation passed - all CANON_COLS present
```

### Testfälle

✅ **CANON_COLS korrekt definiert:** 17 Spalten  
✅ **Row-Factory funktioniert:** `row["fieldname"]` works  
✅ **_get_select_columns():** Generiert explizite SELECT  
✅ **Objektausgabe:** Alle 17 Keys + Helper-Felder  
✅ **Whitelisting:** Ungültige Sort-Felder abgelehnt  
✅ **Frontend:** Objektkeys statt Array-Indizes  

### Edge Cases

- **Multi-Word-Sequenzen:** Start von erstem Token, End von letztem Token
- **Fehlende Spalte:** Fallback zu `None` statt Exception
- **Ungültiger Sort-Field:** Default auf "text", Log-Warnung
- **DB-Spaltenreihenfolge:** Völlig egal jetzt

---

## Backwards Compatibility

### Breaking Change

Die API-Response **ändert sich von Array zu Object**:

**Vorher:**
```json
{
  "data": [
    [1, "ctx_left", "word", "ctx_right", true, "ARG", ...],
    [2, "ctx_left", "word", "ctx_right", false, "MEX", ...],
  ]
}
```

**Nachher:**
```json
{
  "data": [
    {
      "row_number": 1,
      "context_left": "ctx_left",
      "text": "word",
      "context_right": "ctx_right",
      "audio_available": true,
      "country_code": "ARG",
      ...
    }
  ]
}
```

**Auswirkung:** Frontend muss auf Objektkeys umgestellt sein (bereits erledigt)

---

## Zukünftige Verbesserungen

- [ ] Optional: `norm`-Spalte für Case-Insensitive-Suche (Fallback zu `LOWER(text)`)
- [ ] Optional: Stabilitäts-View (`CREATE VIEW tokens_v1 AS SELECT ...`)
- [ ] Optional: API-Versionierung (`/api/v1/corpus/search`)
- [ ] Tests: DB-Spaltenreihenfolge permutieren (Robustness-Test)

---

## Implementierung

| Phase | Datei(en) | Status |
|-------|-----------|--------|
| 1. CANON_COLS | `corpus_search.py` | ✅ Done |
| 2. Row-Factory | `corpus_search.py` | ✅ Done |
| 3. Explizite SELECTs | `corpus_search.py` | ✅ Done |
| 4. Objektausgabe Backend | `corpus_search.py`, `corpus.py` | ✅ Done |
| 5. Schema-Check | `__init__.py` | ✅ Done |
| 6. Whitelisting | `corpus_search.py` | ✅ Done |
| 7. Frontend Objektkeys | `datatables.js` | ✅ Done |
| 8. Tests | `tests/` | ✅ Cleaned up |

---

## Performance-Auswirkung

- **Keine negativen Auswirkungen** (selbe Queries, nur andere Rückgabe-Format)
- **Marginal bessere Speichereffizienz** (Objektkeys vs. Tupel-Overhead)
- **Schema-Check beim Start:** ~50ms einmalig

---

## Sicherheit

✅ **Whitelisting für Sort-Felder:** SQL-Injection verhindert  
✅ **Schema-Validierung:** Falsche DB schlägt sofort fehl  
✅ **Explizite SELECTs:** Keine unerwarteten Spalten  
✅ **Row-Factory:** Sichere Spalten-Zugriffe  

---

## Siehe auch

- [Corpus Search Architecture](../reference/corpus-search-architecture.md) - Bestehende Architektur-Doku
- [Database Schema Reference](../reference/database-schema.md) - Vollständiges DB-Schema
- [DataTables Integration](../reference/corpus-search-quick-reference.md) - API-Referenz
- [ADR-0001: Docs Reorganization](../decisions/ADR-0001-docs-reorganization.md) - Dokumentations-Struktur
