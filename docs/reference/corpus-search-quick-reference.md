---
title: "Corpus Search Quick Reference (Legacy)"
status: archived
owner: backend-team
updated: "2025-11-26"
tags: [corpus, quick-reference, api, parameters, archived]
links:
  - ../reference/corpus-search-architecture.md
  - ../how-to/corpus-advanced-search-planning.md
---

# Corpus Search Quick Reference (Legacy)

> **⚠️ ARCHIVED**: This reference describes the legacy SQLite-based search API.
> The application has migrated to **BlackLab-based search** via `/advanced-api/*` endpoints.
> The `transcription.db` no longer exists; corpus data is served from BlackLab indexes.
> For current API reference, see the advanced-api endpoints documentation.

Schnelle Nachschlage-Tabellen und Code-Snippets für das CO.RA.PAN Corpus-Search-System.

---

## API Endpoints

### GET /corpus
**Corpus-Startseite**
```
Keine Parameter erforderlich
Response: HTML (corpus.html) mit leeren Resultaten
```

### GET|POST /corpus/search
**Suchendpoint für einfache und Token-Suche**
```
GET /corpus/search?query=palabra&search_mode=text&country_code=ARG

Parameter (all URL-encoded):
  query: string                    # Suchtext
  search_mode: string              # text | text_exact | lemma | lemma_exact | token_ids
  search_mode_override: string     # (intern für Token-Suche)
  token_ids: string                # Komma-getrennte Token-IDs
  country_code[]: string[]         # Multiple: country_code=ARG&country_code=MEX
  include_regional: 0 | 1
  speaker_type[]: string[]
  sex[]: string[]
  speech_mode[]: string[]
  discourse[]: string[]
  page: int                        # 1-based
  page_size: int                   # 20-100
  sort: string                     # text | country_code | speaker_type | ...
  order: string                    # asc | desc
  active_tab: string               # tab-simple | tab-token (hidden field)

Response: HTML (corpus.html) mit gefüllten Resultaten
```

### GET /corpus/search/datatables
**Server-Side DataTables Endpoint (AJAX)**
```
GET /corpus/search/datatables?draw=1&start=0&length=25&...

DataTables Parameters:
  draw: int                        # Für Sync
  start: int                       # Offset (0-based)
  length: int                      # Page size
  search[value]: string            # Search-box Inhalt
  order[0][column]: int            # Sort column index
  order[0][dir]: string            # asc | desc

Plus alle Parameter aus /corpus/search

Response: JSON
{
  "draw": 1,
  "recordsTotal": 12345,
  "recordsFiltered": 234,
  "data": [
    [idx, ctx_left, text, ctx_right, audio_bool, country, speaker, sex, mode, discourse, token_id, filename, start, end, ctx_start, ctx_end],
    ...
  ]
}
```

### GET /corpus/tokens
**Token-ID Lookup (für Info-Panels)**
```
GET /corpus/tokens?token_ids=TOKEN1,TOKEN2,TOKEN3

Response: JSON
[
  {
    "token_id": "TOKEN1",
    "filename": "ARG_RN_20050101_001.mp3",
    "country": "ARG",
    "sex": "m",
    "speaker": "pro",
    "mode": "lectura",
    "word": "palabra",
    "context_left": "la",
    "context_right": "siguiente",
    "start": 45.123,
    "end": 45.567
  },
  ...
]
```

---

## Search Modes

| Mode | DB-Spalte | Operator | Beispiel Query | Matches |
|------|----------|----------|----------------|---------|
| `text` | `text` | `LIKE` | "ar" | "aro", "palabra", "arco" |
| `text_exact` | `text` | `=` | "ar" | nur "ar" |
| `lemma` | `lemma` | `LIKE` | "ser" | "ser", "soy", "eres", "somos" (mit Lemma DB) |
| `lemma_exact` | `lemma` | `=` | "ser" | nur "ser" |
| `token_ids` | `token_id` | `IN` | "TOK1,TOK2" | Exakte Token-IDs |

---

## Filter-Optionen

### Länder (country_code)

**Nationale (19):**
```
ARG, BOL, CHL, COL, CRI, CUB, ECU, ESP, GTM, HND, MEX, NIC, PAN, PRY, PER, DOM, SLV, URY, USA, VEN
```

**Regional (5):**
```
ARG-CHU (Chubut, Argentinien)
ARG-CBA (Córdoba, Argentinien)
ARG-SDE (Santiago del Estero, Argentinien)
ESP-CAN (Kanarische Inseln, Spanien)
ESP-SEV (Sevilla, Spanien)
```

**Filter-Verhalten:**
```
include_regional=0 (default) → Nur nationale Codes
include_regional=1           → Nationale + regionale Codes
```

### Hablante (speaker_type)

```
pro    → Profesional
otro   → Otro
```

### Sexo (sex)

```
m      → Masculino
f      → Femenino
```

### Modo (speech_mode)

```
pre    → Anuncio
lectura → Lectura
libre  → Habla libre
```

### Discurso (discourse)

```
general → General
tiempo  → Tiempo
tránsito → Tránsito
```

---

## Code Snippets

### Python: SearchParams bauen

```python
from src.app.services.corpus_search import SearchParams, search_tokens

# Einfache Suche
params = SearchParams(
    query="palabra",
    search_mode="text",
    countries=["ARG", "MEX"],
    speaker_types=["pro"],
    page=1,
    page_size=25
)

# Token-Suche
params = SearchParams(
    query="",
    search_mode="token_ids",
    token_ids=["TOKEN1", "TOKEN2", "TOKEN3"],
    countries=["ARG", "MEX"],
    page=1,
    page_size=25
)

# Ausführen
result = search_tokens(params)
print(f"Total: {result['total']}, Items: {len(result['items'])}")
```

### Python: Direkte DB-Query

```python
from src.app.services.database import open_db

with open_db("transcription") as conn:
    cursor = conn.cursor()
    
    # Wort-Suche
    cursor.execute(
        "SELECT * FROM tokens WHERE text LIKE ? AND country_code IN (?, ?) LIMIT 10",
        ("%palabra%", "ARG", "MEX")
    )
    rows = cursor.fetchall()
    for row in rows:
        print(f"{row[1]}: {row[10]}")  # token_id: text
```

### JavaScript: DataTables AJAX Trigger

```javascript
// DataTables aktualisieren
const table = document.querySelector('#corpus-table').DataTable()

// Neue Seite laden
table.page(2).draw(false)

// Sortieren
table.order([2, 'asc']).draw()  // Column 2 (Palabra), ascending

// Suche
table.search('palabra').draw()  // DataTables search-box
```

### JavaScript: Filter-Werte auslesen

```javascript
import { CorpusFiltersManager } from './modules/corpus/filters.js'

const filters = new CorpusFiltersManager()
const values = filters.getFilterValues()

console.log(values)
// {
//   countries: ["ARG", "MEX"],
//   includeRegional: false,
//   speaker: ["pro"],
//   sex: ["f"],
//   mode: ["lectura"],
//   discourse: ["general"]
// }
```

### Bash: DataTables API Test

```bash
# Simple Search
curl -s "http://localhost:5000/corpus/search/datatables?draw=1&start=0&length=10&query=palabra&search_mode=text&country_code=ARG" | jq '.data | length'

# Token Search
curl -s "http://localhost:5000/corpus/search/datatables?draw=1&start=0&length=10&search_mode=token_ids&token_ids=TOK1%2CTOK2" | jq '.recordsTotal'

# Mit Filter
curl -s "http://localhost:5000/corpus/search/datatables?draw=1&start=0&length=10&query=palabra&speaker_type=pro&sex=f&country_code=ARG&country_code=MEX" | jq '.data[0]'
```

---

## URL-Parameter-Kombinationen

### Minimal Query
```
/corpus/search?query=palabra
→ Simple Search, Mode=text, alle Länder (national only), keine anderen Filter
```

### Mit Filtern
```
/corpus/search?query=palabra&country_code=ARG&country_code=MEX&speaker_type=pro&sex=f
→ Simple Search mit Länder-, Speaker-, Sexo-Filtern
```

### Mit Regionalcodes
```
/corpus/search?query=palabra&include_regional=1&country_code=ARG&country_code=ARG-CHU
→ Nationale + regionale Codes
```

### Token-Suche
```
/corpus/search?search_mode=token_ids&token_ids=TOK1%2CTOK2%2CTOK3
→ Direkte Token-IDs (komma-getrennt, URL-encoded: %2C = Komma)
```

### Pagination
```
/corpus/search?query=palabra&page=2&page_size=50
→ Seite 2, 50 Einträge pro Seite
```

### Sorting
```
/corpus/search?query=palabra&sort=country_code&order=desc
→ Nach Land, absteigend
```

### DataTables Sub-Tab
```
/corpus/search?query=palabra&view=stats
→ Statistik-Tab statt Resultats-Tab
```

---

## Frontend Module

### Import Structure

```javascript
import { CorpusApp } from './modules/corpus/index.js'
import { CorpusDatatablesManager } from './modules/corpus/datatables.js'
import { CorpusFiltersManager } from './modules/corpus/filters.js'
import { CorpusSearchManager } from './modules/corpus/search.js'
// Token tab (MD3 native chip UI)
import './modules/corpus/token-tab.js'
import { CorpusAudioManager } from './modules/corpus/audio.js'

// Globale Instanz
window.corpusApp = new CorpusApp()
```

### Global Variables

```javascript
// Aus corpus.html gesetzt:
window.PLAYER_PATH = '/player'
window.ALLOW_PUBLIC_TEMP_AUDIO = 'true' | 'false'
window.IS_AUTHENTICATED = 'true' | 'false'
window.RESTORE_ACTIVE_TAB = 'tab-simple' | 'tab-token'
window.RESTORE_TOKEN_IDS = 'TOKEN1,TOKEN2,...'

// Corpus Module nutzt:
window.corpusApp          // CorpusApp Instanz
window.corpusApp.filters  // CorpusFiltersManager
window.corpusApp.datatables // CorpusDatatablesManager
```

---

## Performance Targets

| Operation | Target | Aktuell | Status |
|-----------|--------|---------|--------|
| Simple Search (1K matches) | < 200ms | ~100ms | ✅ |
| Token Search (10 tokens) | < 200ms | ~50ms | ✅ |
| DataTables Page Load | < 500ms | ~200ms | ✅ |
| Stats Tab Rendering | < 1000ms | ~800ms | ✅ |
| Sequence Search (2 words) | < 500ms | TBD | 🚧 |
| Regex Search | < 1000ms | TBD | 🚧 |

---

## Debugging

### Browser Console

```javascript
// Current state
console.log(window.corpusApp.isInitialized)

// DataTables API
const table = document.querySelector('#corpus-table').DataTable()
table.settings()[0].json  // Letzter AJAX Response

// Filters
window.corpusApp.filters.getFilterValues()

// Token Manager (TokenTab)
window.TokenTab.getTokenIds()  // Aktuelle Tokens

// Search Query
const params = new URLSearchParams(window.location.search)
params.get('query')
params.getAll('country_code')
```

### Backend Logging

```python
# In corpus.py
print(f"DEBUG: Query={query}, Mode={search_mode}, Countries={countries}")
print(f"DEBUG: Results: total={service_result['total']}, items={len(service_result['items'])}")

# In corpus_search.py
print(f"DEBUG: SQL={sql_words}")
print(f"DEBUG: Filters={filter_clause}")
print(f"DEBUG: Params={filter_params}")
```

### SQLite CLI

```bash
sqlite3 data/db/transcription.db

# Schema prüfen
.schema tokens

# Indizes anzeigen
SELECT * FROM sqlite_master WHERE type='index'

# Query planen
EXPLAIN QUERY PLAN SELECT * FROM tokens WHERE text LIKE '%palabra%' LIMIT 10

# Performance
.timer ON
SELECT COUNT(*) FROM tokens WHERE text LIKE '%palabra%'
```

---

## Häufige Fehler

| Problem | Ursache | Lösung |
|---------|--------|--------|
| "DataTable not found" | Modul nicht initialisiert | `DOMContentLoaded` warten, Dependencies prüfen |
| Filter funktionieren nicht | Select2 nicht geladen | jQuery + Select2 CDN Skripte prüfen |
| Token-Suche funktioniert nicht | TokenTab nicht initialisiert | Prüfen ob `token-tab.js` geladen ist oder fallback aktiv | 
| Sortierung funktioniert nicht | Column-Index falsch | Column-Index im column_map prüfen |
| Keine Ergebnisse | Query zu restriktiv | Mit weniger Filtern testen |
| Performance langsam | SQL-Index fehlt | Datenbankindizes prüfen: `CREATE INDEX idx_text ON tokens(text)` |

---

## Siehe auch

- [Corpus Search Architecture](../reference/corpus-search-architecture.md) - Detaillierte Architektur-Referenz
- [Advanced Search Planning](corpus-advanced-search-planning.md) - Planungs-Guide für erweiterte Suche
- [Database Schema](database-schema.md) - Tokens-Tabelle Struktur und Indizes
