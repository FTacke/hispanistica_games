---
title: "Case/Accent-Insensitive Search: Specification (Legacy)"
status: archived
owner: backend-team
updated: "2025-11-26"
tags: [search, api, database, sql, reference, archived]
links:
  - decisions/ADR-0005-sensitive-search.md
  - how-to/enable-sensitive-search.md
  - reference/corpus-search-architecture.md
---

# Case/Accent-Insensitive Search: Technical Specification (Legacy)

> **⚠️ ARCHIVED**: This specification describes the legacy SQLite-based sensitive search.
> The application has migrated to **BlackLab-based search** which handles case/accent
> sensitivity via CQL query modifiers. The `transcription.db` no longer exists.

Complete technical reference for sensitive/insensitive search implementation.

---

## API Contract

### Request Parameters

#### GET /corpus/search

```
GET /corpus/search?query=mexicano&sensitive=1&search_mode=text&country_code=MEX&...
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | (required) | Search term(s) |
| `search_mode` | string | "text" | "text", "text_exact", "lemma", "lemma_exact" |
| **`sensitive`** | int | 1 | 1=case/accent-sensitive, 0=indifferent |
| `country_code[]` | array | all | Filter by country |
| `speaker_type[]` | array | all | Filter by speaker type |
| `sex[]` | array | all | Filter by sex |
| `speech_mode[]` | array | all | Filter by speech mode |
| `discourse[]` | array | all | Filter by discourse |
| `include_regional` | int | 0 | Include regional stations |
| `page` | int | 1 | Page number |
| `page_size` | int | 25 | Results per page |

#### POST /corpus/search/datatables

DataTables Server-Side AJAX Request:

```json
{
  "draw": 1,
  "start": 0,
  "length": 25,
  "search[value]": "",
  "order[0][column]": 2,
  "order[0][dir]": "asc",
  "query": "mexicano",
  "search_mode": "text",
  "sensitive": 1,
  "country_code[]": ["MEX", "ARG"],
  "speaker_type[]": ["pro"],
  "sex[]": [],
  "speech_mode[]": [],
  "discourse[]": [],
  "include_regional": "0"
}
```

### Response Format

**No changes** - Response bleibt identisch. `norm` wird nicht exponiert.

```json
{
  "draw": 1,
  "recordsTotal": 5234,
  "recordsFiltered": 1024,
  "data": [
    {
      "token_id": "MEX_RN_20050101_001_00000042",
      "text": "mexicano",
      "lemma": "mexicano",
      "country_code": "MEX",
      "speaker_type": "pro",
      "sex": "m",
      "mode": "lectura",
      "discourse": "general",
      "filename": "MEX_RN_20050101_001.mp3",
      "start": 12.5,
      "end": 13.1,
      "context_left": "fue el señor",
      "context_right": "de la ciudad",
      ...
    },
    ...
  ]
}
```

---

## Database Schema

### Column: norm

```sql
-- Required in tokens table
ALTER TABLE tokens ADD COLUMN norm TEXT;
```

**Properties:**
- Type: TEXT
- Nullable: YES (for legacy data)
- Usage: Case/accent-insensitive search
- Content: Normalized form of `text` field

**Examples:**
```sql
SELECT text, norm FROM tokens LIMIT 5;
-- text: "México"       norm: "mexico"
-- text: "ESPAÑA"       norm: "espana"
-- text: "está"         norm: "esta"
-- text: "señor"        norm: "senor"
-- text: "café"         norm: "cafe"
```

### Index: idx_tokens_norm

```sql
-- Created automatically on app startup if missing
CREATE INDEX IF NOT EXISTS idx_tokens_norm ON tokens(norm);
```

**Performance:**
- LIKE queries on `norm`: ~0.1-0.5s per 1M tokens
- Comparable to `idx_tokens_text`

**Verification:**
```sql
PRAGMA index_list('tokens');
-- Should show: idx_tokens_norm | 1 | ... | 0

PRAGMA index_info('idx_tokens_norm');
-- Should show: seqno=0, cid=<column_id>, name='norm'
```

---

## SQL Query Examples

### Single-Word Search

#### sensitive=1 (Default)
```sql
SELECT token_id, text, norm, ... 
FROM tokens 
WHERE text LIKE '%mexicano%'
-- Uses: idx_tokens_text
-- Matches: "mexicano", "Mexicano" (if in DB)
-- NOT: "mexicano_var", "mexicanO"
```

#### sensitive=0
```sql
SELECT token_id, text, norm, ... 
FROM tokens 
WHERE norm LIKE '%mexicano%'
-- Uses: idx_tokens_norm
-- Matches: "mexicano", "Mexicano", "MEXICANO", etc.
-- All normalize to: "mexicano"
```

### Exact Match

#### sensitive=1
```sql
SELECT token_id, text, norm, ... 
FROM tokens 
WHERE text = 'mexicano'
```

#### sensitive=0
```sql
SELECT token_id, text, norm, ... 
FROM tokens 
WHERE norm = 'mexicano'
```

### Multi-Word Sequence

#### sensitive=1: "el gato"
```sql
SELECT t1.token_id, (t1.text || ' ' || t2.text) as text, ...
FROM tokens t1
JOIN tokens t2 ON t2.filename = t1.filename AND t2.id = t1.id + 1
WHERE t1.text LIKE '%el%' AND t2.text LIKE '%gato%'
-- Uses: idx_tokens_text (both)
```

#### sensitive=0: "el gato"
```sql
SELECT t1.token_id, (t1.text || ' ' || t2.text) as text, ...
FROM tokens t1
JOIN tokens t2 ON t2.filename = t1.filename AND t2.id = t1.id + 1
WHERE t1.norm LIKE '%el%' AND t2.norm LIKE '%gato%'
-- Uses: idx_tokens_norm (both)
-- Also matches: "El Gato", "EL gato", etc.
```

### With Filters

```sql
-- sensitive=1 with country filter
SELECT ... FROM tokens 
WHERE text LIKE '%méxico%' 
  AND country_code IN ('MEX', 'ARG')
  AND speaker_type = 'pro'
-- Uses: idx_tokens_text, (+ country/speaker indexes)

-- sensitive=0 with same filters
SELECT ... FROM tokens 
WHERE norm LIKE '%mexico%'  -- Note: normalized input
  AND country_code IN ('MEX', 'ARG')
  AND speaker_type = 'pro'
-- Uses: idx_tokens_norm, (+ country/speaker indexes)
```

---

## Python API

### SearchParams Dataclass

```python
from src.app.services.corpus_search import SearchParams

params = SearchParams(
    query="mexicano",
    search_mode="text",           # "text", "text_exact", "lemma", "lemma_exact"
    sensitive=1,                   # NEW: 1=sensitive, 0=indifferent
    token_ids=[],
    countries=["MEX"],
    speaker_types=["pro"],
    sexes=[],
    speech_modes=[],
    discourses=[],
    page=1,
    page_size=25,
    sort="text",
    order="asc",
    table_search=""
)

result = search_tokens(params)
# Returns: {"items": [...], "total": X, ...}
```

### Normalization Function

```python
from src.app.services.corpus_search import _normalize_for_search

_normalize_for_search("México")      # → "mexico"
_normalize_for_search("ESPAÑA")      # → "espana"
_normalize_for_search("está")        # → "esta"
_normalize_for_search("café")        # → "cafe"
_normalize_for_search("señor")       # → "senor"
```

**Implementation:**
```python
import unicodedata

def _normalize_for_search(text: str) -> str:
    """Normalize for case/accent-insensitive search."""
    text = text.lower()
    # NFD decomposition: "é" → "e" + combining acute
    nfkd = unicodedata.normalize('NFD', text)
    # Remove combining marks (category Mn)
    return ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')
```

### Query Building

```python
from src.app.services.corpus_search import _build_word_query

# sensitive=1 (default)
sql1, params1 = _build_word_query(
    words=["mexicano"],
    column="text",
    exact=False,
    sensitive=1
)
# → "SELECT ... FROM tokens WHERE text LIKE ?"
# → ["mexicano%"] (not normalized)

# sensitive=0 (indifferent)
sql0, params0 = _build_word_query(
    words=["mexicano"],
    column="text",  # ignored, switches to "norm"
    exact=False,
    sensitive=0
)
# → "SELECT ... FROM tokens WHERE norm LIKE ?"
# → ["mexicano%"] (normalized)
```

---

## Frontend Integration

### Checkbox State

```html
<!-- In corpus.html -->
<input type="checkbox" id="sensitive-search" name="sensitive" value="1">
```

### localStorage

```javascript
// Get current state
const isSensitive = localStorage.getItem('corapan_sensitive') === '1';
document.getElementById('sensitive-search').checked = isSensitive;

// Save on change
document.getElementById('sensitive-search').addEventListener('change', (e) => {
    localStorage.setItem('corapan_sensitive', e.target.checked ? '1' : '0');
});
```

### DataTables Parameter

```javascript
// In datatables.js buildAjaxData()
const sensitiveCheckbox = document.getElementById('sensitive-search');
if (sensitiveCheckbox) {
    d.sensitive = sensitiveCheckbox.checked ? 1 : 0;
}
// Sends to server: sensitive=1 or sensitive=0
```

---

## Performance Characteristics

### Query Performance

| Query Type | Index | 1M Tokens | 1.3M Tokens (Actual) |
|------------|-------|-----------|----------------------|
| `text LIKE '%word%'` | idx_tokens_text | ~0.08s | ~0.10s |
| `norm LIKE '%word%'` | idx_tokens_norm | ~0.09s | ~0.12s |
| `text = 'word'` | idx_tokens_text | ~0.02s | ~0.03s |
| `norm = 'word'` | idx_tokens_norm | ~0.02s | ~0.03s |

**Expected overhead (sensitive=0 vs sensitive=1):** 0-1.5x (acceptable)

### Memory Usage

| Component | Size |
|-----------|------|
| `norm` column (1.3M rows) | ~45 MB (estimated) |
| `idx_tokens_norm` index | ~50 MB |
| Total added | ~95 MB |

**Storage impact:** Negligible on 348 MB database (~27%)

---

## Error Handling

### Missing norm Column

**Error:**
```
RuntimeError: [DB SCHEMA] Missing columns ['norm']. Present: [...]
```

**Solution:**
```bash
# Rebuild database
cd LOKAL/database
python database_creation_v2.py
```

### Missing Index

**Status:** Auto-created on app startup

**Log:**
```
[STARTUP] Creating idx_tokens_norm index...
[STARTUP] idx_tokens_norm index created successfully
```

### Outdated norm Values

**Problem:** `norm` column exists but is NULL/empty

**Symptom:** `sensitive=0` returns same results as `sensitive=1`

**Solution:** Database rebuild

---

## Backwards Compatibility

| Scenario | Behavior |
|----------|----------|
| Old URL: `?query=...` (no sensitive param) | sensitive=1 (default) |
| New UI: Checkbox unchecked | sensitive=0 |
| New UI: Checkbox checked | sensitive=1 |
| Response format | Unchanged (no norm exposed) |

---

## Testing

### Unit Test: Normalization

```python
def test_normalize_for_search():
    assert _normalize_for_search("México") == "mexico"
    assert _normalize_for_search("ESPAÑA") == "espana"
    assert _normalize_for_search("está") == "esta"
    assert _normalize_for_search("café") == "cafe"
```

### Integration Test: Query Branching

```python
def test_sensitive_query_branching():
    # sensitive=1: text column
    params1 = SearchParams(query="méxico", sensitive=1)
    result1 = search_tokens(params1)
    
    # sensitive=0: norm column
    params0 = SearchParams(query="méxico", sensitive=0)
    result0 = search_tokens(params0)
    
    # Expect: result0 >= result1
    assert len(result0["items"]) >= len(result1["items"])
```

### Browser Test: localStorage

```javascript
// Test 1: Checkbox unchecked
document.getElementById('sensitive-search').checked = false;
assert(localStorage.getItem('corapan_sensitive') === '0');

// Test 2: Page reload
location.reload();
assert(document.getElementById('sensitive-search').checked === false);
```

### Performance Test

```sql
-- Verify index usage
EXPLAIN QUERY PLAN
SELECT * FROM tokens WHERE norm LIKE '%mexico%';
-- Should show: SEARCH TABLE tokens USING INDEX idx_tokens_norm
```

---

## Siehe auch

- [ADR-0005: Decision Record](../decisions/ADR-0005-sensitive-search.md) - Why and how
- [Enable Sensitive Search How-To](../how-to/enable-sensitive-search.md) - Deployment guide
- [Corpus Search Architecture](corpus-search-architecture.md) - Search flow
- [Database Creation v3](database-creation-v3.md) - DB schema
