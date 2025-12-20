---
title: "Corpus API - Canonical Columns Specification"
status: active
owner: backend-team
updated: "2025-11-08"
tags: [corpus-api, columns, schema, reference, datatables]
links:
  - ../reference/corpus-search-architecture.md
  - ../reference/database-schema.md
  - ../migration/corpus-column-robustness-refactor.md
---

# Corpus API - Canonical Columns Specification

## Overview

Die **CANON_COLS** definieren die stabilen Ausgabe-Keys für alle Corpus-Search-Endpoints. Diese Spaltenliste ist **immutable** und garantiert Backwards-Compatibility auf API-Ebene, auch wenn die interne DB-Struktur sich ändert.

---

## Canonical Columns (CANON_COLS)

| # | Column | Type | Description | Example |
|----|--------|------|-------------|---------|
| 1 | `token_id` | string | Eindeutige Token-ID | `"ARG_pro_m_pre_general_001_00042"` |
| 2 | `filename` | string | Audio-Dateiname (ohne Pfad) | `"ARG_pro_m_pre_general_001.mp3"` |
| 3 | `country_code` | string | ISO 3-Buchstaben-Ländercode | `"ARG"`, `"MEX"`, `"ESP"` |
| 4 | `radio` | string | Sender/Broadcasts-Name | `"Radio 10"`, `"FM 100"` |
| 5 | `date` | string | Aufnahmedatum (ISO 8601) | `"2024-11-08"` |
| 6 | `speaker_type` | string | Sprecher-Kategorie | `"pro"` (Professional), `"otro"` (Other) |
| 7 | `sex` | string | Biologisches Geschlecht | `"m"` (Männlich), `"f"` (Weiblich) |
| 8 | `mode` | string | Registermodus / Sprechtyp | `"pre"` (Anuncio), `"lectura"` (Reading), `"libre"` (Free speech) |
| 9 | `discourse` | string | Diskurs-Kategorie | `"general"`, `"tiempo"` (Weather), `"tránsito"` (Traffic) |
| 10 | `text` | string | Suchresultat-Text | `"de"` oder `"de las"` (Multi-Word bei Sequenzen) |
| 11 | `start` | number | Start-Zeit des Resultat (Sekunden oder Frames) | `42.5` |
| 12 | `end` | number | End-Zeit des Resultat | `43.2` |
| 13 | `context_left` | string | Kontext **vor** dem Resultat (aus erstem Token) | `"en la"` |
| 14 | `context_right` | string | Kontext **nach** dem Resultat (aus letztem Token) | `"de la mañana"` |
| 15 | `context_start` | number | Start-Zeit des Kontexts | `40.0` |
| 16 | `context_end` | number | End-Zeit des Kontexts | `45.0` |
| 17 | `lemma` | string | Lemma (Grundform, für Suche relevant) | `"de"` |

---

## Multi-Word Behavior

Bei **Sequenzen von mehreren Wörtern** (z.B. "de las dos"):

| Field | Behavior |
|-------|----------|
| `text` | Kombiniert: `"de las dos"` (alle Tokens mit Leerzeichen) |
| `start` | Start von **erstem** Token |
| `end` | End von **letztem** Token |
| `context_left` | Context von **erstem** Token |
| `context_right` | Context von **letztem** Token |
| `context_start` | Context-Start von erstem Token |
| `context_end` | Context-End von letztem Token |

**Beispiel:**
```json
{
  "token_id": "ARG_001_00001",
  "text": "de las dos",
  "start": 42.5,
  "end": 44.2,
  "context_left": "está",
  "context_right": "de la tarde"
}
```

---

## Additional Fields (Not in CANON_COLS)

| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `row_number` | number | API | Zeilennummer (1-basiert) |
| `audio_available` | boolean | Backend | Audio-Datei existiert? |
| `transcript_available` | boolean | Backend | Transkript-JSON existiert? |
| `transcript_name` | string | Backend | Transkript-Dateiname |
| `word_count` | number | Backend | Anzahl Wörter in Sequenz (1 = Single-Word) |

---

## JSON Response Format

### Single Result

```json
{
  "token_id": "ARG_pro_m_pre_general_001_00042",
  "filename": "ARG_pro_m_pre_general_001.mp3",
  "country_code": "ARG",
  "radio": "Radio 10",
  "date": "2024-11-08",
  "speaker_type": "pro",
  "sex": "m",
  "mode": "pre",
  "discourse": "general",
  "text": "de",
  "start": 42.5,
  "end": 43.2,
  "context_left": "en la",
  "context_right": "madrugada",
  "context_start": 40.0,
  "context_end": 45.0,
  "lemma": "de",
  "row_number": 1,
  "audio_available": true,
  "transcript_available": true,
  "transcript_name": "ARG_pro_m_pre_general_001.json",
  "word_count": 1
}
```

### DataTables Response

```json
{
  "draw": 1,
  "recordsTotal": 5234,
  "recordsFiltered": 5234,
  "data": [
    { /* Result 1 */ },
    { /* Result 2 */ },
    { /* Result 3 */ }
  ]
}
```

---

## Endpoints

### GET /corpus/search/datatables

**Server-Side DataTables Endpoint**

**Request:**
```
GET /corpus/search/datatables?
  draw=1
  start=0
  length=25
  query=de
  search_mode=text
  country_code=ARG
  country_code=MEX
  speaker_type=pro
  order[0][column]=2
  order[0][dir]=asc
```

**Response:** JSON mit `data` als Array von Objekten (CANON_COLS Keys)

### GET /corpus/tokens

**Token Lookup by IDs**

**Request:**
```
GET /corpus/tokens?token_ids=TOKEN1,TOKEN2,TOKEN3
```

**Response:** Array von Token-Objekten mit CANON_COLS Keys

```json
[
  { "token_id": "TOKEN1", "filename": "...", "text": "...", ... },
  { "token_id": "TOKEN2", "filename": "...", "text": "...", ... }
]
```

---

## Stability Guarantees

### Immutable Keys

Diese Keys ändern sich **nie**:
- `token_id`, `filename`, `country_code`, `text`, `start`, `end`, `lemma`

**Rationale:** Core-Daten der Corpus-Suche

### Extensible Keys

Diese Keys können hinzugefügt werden (neue Helper-Felder):
- `audio_available`, `transcript_available`, `row_number`, etc.

**Rationale:** Zusätzliche Metadaten für UI

### Deprecated Keys

Alte Tuple-indizierte Responses sind **nicht mehr unterstützt**:
- ❌ `data: [[1, "ctx", "word", ...]]`
- ✅ `data: [{"text": "word", "context_left": "ctx", ...}]`

---

## Versioning Strategy

### Current Version

- **API Version:** (implicit, stable)
- **CANON_COLS Version:** 1.0 (2025-11-08)
- **Response Format:** Object-based (immutable)

### Future Versions

Falls größere Änderungen nötig werden:
- Create `/api/v2/corpus/search/datatables` (separate Endpoint)
- CANON_COLS_V2 definieren
- Alte V1 für 6+ Monate unterstützen (Deprecation-Notice)

---

## Usage in Frontend

### DataTables Configuration

```javascript
const table = $('#corpus-table').DataTable({
  serverSide: true,
  ajax: { url: '/corpus/search/datatables', type: 'GET' },
  columns: [
    { data: 'row_number', width: '40px' },
    { data: 'context_left', width: '200px' },
    { data: 'text', width: '150px' },
    { data: 'context_right', width: '200px' },
    { data: 'audio_available', orderable: false },
    { data: 'country_code', width: '80px' },
    { data: 'speaker_type', width: '80px' },
    { data: 'sex', width: '80px' },
    { data: 'mode', width: '80px' },
    { data: 'discourse', width: '80px' },
    { data: 'token_id', width: '100px' },
    { data: 'filename', width: '80px' }
  ]
});
```

### Rendering Example

```javascript
{
  data: 'text',
  render: (data, type, row) => {
    return `<span class="keyword" data-start="${row.start}" data-end="${row.end}">
      ${data}
    </span>`;
  }
}
```

---

## Backend Implementation

### Column Selection

```python
from app.services.corpus_search import _get_select_columns

# Generiert: "token_id AS token_id, filename AS filename, ..."
select_cols = _get_select_columns()

# Mit Alias für Joins
select_cols = _get_select_columns(alias="t1")  # "t1.token_id AS token_id, ..."

# Mit Excludes
select_cols = _get_select_columns(exclude={"lemma", "context_left"})
```

### Row Conversion

```python
import sqlite3

connection.row_factory = sqlite3.Row
cursor = connection.cursor()

cursor.execute(f"SELECT {select_cols} FROM tokens WHERE ...")
rows = cursor.fetchall()

# rows[0]['token_id'] → Stabil!
# rows[0][0] → NEVER! (Array-Index ist fragil)
```

---

## Validation

### Startup Check

```python
from app.services.corpus_search import _validate_db_schema, CANON_COLS

_validate_db_schema(cursor, CANON_COLS)
# → RuntimeError wenn Spalten fehlen
# → App startet nicht mit falscher DB
```

### Whitelist for Sorting

```python
ALLOWED_SORT_FIELDS = set(CANON_COLS) - {"context_left", "context_right"}

if sort_field not in ALLOWED_SORT_FIELDS:
    logger.warning(f"Invalid sort field: {sort_field}")
    sort_field = "text"  # Fallback
```

---

## Migration Guide

### From Old API (Array-based)

**Old Code:**
```javascript
const filename = row[11];  // Magic number!
const token = row[10];     // Breaks if columns reordered
```

**New Code:**
```javascript
const filename = row.filename;  // Clear, stable
const token = row.token_id;     // Self-documenting
```

### From SELECT *

**Old SQL:**
```python
cursor.execute("SELECT * FROM tokens WHERE ...")
rows = cursor.fetchall()
# Brittle: Order can change anytime
```

**New SQL:**
```python
select_cols = _get_select_columns()
cursor.execute(f"SELECT {select_cols} FROM tokens WHERE ...")
rows = cursor.fetchall()
# Robust: Order irrelevant
```

---

## Siehe auch

- [Corpus Search Architecture](../reference/corpus-search-architecture.md) - System-Design
- [Database Schema Reference](../reference/database-schema.md) - Interne DB-Struktur
- [Corpus Column Robustness Refactor](../migration/corpus-column-robustness-refactor.md) - Implementierungs-Details
- [DataTables Integration](../reference/corpus-search-quick-reference.md) - API-Nutzung
