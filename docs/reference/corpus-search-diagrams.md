---
title: "Corpus Search System Diagrams (Legacy)"
status: archived
owner: documentation
updated: "2025-11-26"
tags: [corpus, diagrams, architecture, flow, archived]
links:
  - ../reference/corpus-search-architecture.md
  - ../how-to/corpus-advanced-search-planning.md
---

# Corpus Search System Diagrams (Legacy)

> **⚠️ ARCHIVED**: These diagrams describe the legacy SQLite-based search architecture.
> The application has migrated to **BlackLab-based search**. The `transcription.db`
> no longer exists. For current architecture, corpus search flows through BlackLab
> Server (`blacklab_search.py`) instead of the SQLite-based `corpus_search.py`.

Visuelle Darstellungen der CO.RA.PAN Corpus-Sucharchitektur.

---

## 1. Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CORPUS SEARCH SYSTEM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ FRONTEND (Browser)                                           │   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  corpus.html (Template)                              │   │   │
│  │  │  ┌─────────────────────────────────────────────┐    │   │   │
│  │  │  │ Tab: Búsqueda simple  │ Búsqueda avanzada │    │   │   │
│  │  │  │ Tab: Token            │ Estadísticas      │    │   │   │
│  │  │  └─────────────────────────────────────────────┘    │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                           │                                  │   │
│  │  ┌──────────────────────┴───────────────────────────┐     │   │
│  │  │  ES6 Modules                                      │     │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌──────────┐          │     │   │
│  │  │  │ filters │  │ search  │  │ tokens   │          │     │   │
│  │  │  │(Select2)│  │(Form)   │  │(TokenTab)│          │     │   │
│  │  │  └─────────┘  └─────────┘  └──────────┘          │     │   │
│  │  │                   │                               │     │   │
│  │  │  ┌─────────┐  ┌───┴─────┐  ┌──────────┐          │     │   │
│  │  │  │datatables  │ config  │  │ audio    │          │     │   │
│  │  │  │(DataTables)│         │  │          │          │     │   │
│  │  │  └─────────┘  └─────────┘  └──────────┘          │     │   │
│  │  └──────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓ HTTP AJAX                          │
└───────────────────────────┼──────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  REST API       │
                    │  Flask          │
                    └────────┬────────┘
┌────────────────────────────▼────────────────────────────────────────┐
│                         BACKEND (Server)                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │ Routes (corpus.py)                                            │   │
│  │  • GET  /corpus                                               │   │
│  │  • GET|POST /corpus/search                                    │   │
│  │  • GET  /corpus/search/datatables  ← Server-Side Processing  │   │
│  │  • GET  /corpus/tokens                                        │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                            │                                         │
│                    ┌───────▼────────┐                               │
│                    │  SearchParams  │                               │
│                    │  (dataclass)   │                               │
│                    └───────┬────────┘                               │
│                            │                                         │
│  ┌───────────────────────┬─▼─────────────────────────────────┐    │
│  │ Service Layer (corpus_search.py)                          │    │
│  │  • search_tokens()                                        │    │
│  │    ├─ _build_word_query()     [text/lemma]               │    │
│  │    ├─ _build_sequence_query() [advanced, geplant]        │    │
│  │    ├─ _append_in_clause()     [filters]                  │    │
│  │    └─ SQL Execution + Pagination                         │    │
│  │                                                           │    │
│  │  Returns: dict {items, total, unique_countries, ...}    │    │
│  └───────────────────────┬─────────────────────────────────┘    │
│                          │                                        │
└──────────────────────────┼────────────────────────────────────────┘
                           │
                   ┌───────▼───────┐
                   │  SQLite       │
                   │  transcription.db
                   │               │
                   │  ┌──────────┐ │
                   │  │ tokens   │ │
                   │  │ (16+ col)│ │
                   │  └──────────┘ │
                   └───────────────┘
```

---

## 2. Datenfluss: Einfache Suche

```
USER
 │
 └─→ Gibt "palabra" ein
      + Wählt Land "ARG"
      + Klickt "Buscar"
           │
           ▼
    ┌──────────────────┐
    │ Form Submit      │
    │ (JavaScript)     │
    └──────────────────┘
           │
           ├─ buildSearchParams()
           │  → URL: /corpus/search?query=palabra&country_code=ARG&search_mode=text
           │
           ▼
    ┌──────────────────────────────┐
    │ Browser Navigation            │
    │ GET /corpus/search?...        │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ Backend: corpus.search()      │
    │ • ParseParameter              │
    │ • SearchParams bauen          │
    │ • search_tokens() aufrufen    │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ SQL Query Builder             │
    │ WHERE text LIKE '%palabra%'   │
    │ AND country_code IN ("ARG")   │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ SQLite Query Execution        │
    │ SELECT * FROM tokens WHERE... │
    │ LIMIT 25                      │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ Result Conversion             │
    │ {items, total, page, ...}    │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ Template Render              │
    │ corpus.html mit Daten        │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ Browser: HTML Response        │
    │ <table id="corpus-table">    │
    │ mit Ergebnissen              │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ DataTables Initialization    │
    │ serverSide: true             │
    │ ajax: /corpus/search/datatables
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ AJAX Request (Backend)       │
    │ /corpus/search/datatables    │
    │ draw=1, start=0, length=25   │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ JSON Response                │
    │ {draw, recordsTotal, data}   │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ DataTables: Render Table     │
    │ Bind Event-Handler (Audio)   │
    └──────────────────────────────┘
           │
           ▼
    USER SIEHT ERGEBNISSE
    (Tabelle mit 12 Spalten, sortierbar)
```

---

## 3. Datenfluss: Token-Suche

```
USER
 │
 └─→ Klickt auf Tab "Token"
      + Gibt Token-IDs ein: "TOKEN1, TOKEN2, TOKEN3"
      + Klickt "Buscar"
           │
           ▼
       ┌──────────────────────────────┐
       │ TokenTab: Token-Validierung  │
    │ • Parse: ',;\\s' Delimiters   │
    │ • Pattern: ^[A-Za-z0-9-]+$   │
    │ • Max: 2000 Tokens           │
    │ • Drag-Drop: SortableJS      │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
       │ JS: onTokenApplyClick()      │
       │ • TokenTab.getTokenIds() → Array      │
    │ • Set: searchModeOverride    │
    │ • Form Submit (POST)         │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────┐
    │ POST /corpus/search              │
    │ token_ids=TOKEN1,TOKEN2,TOKEN3  │
    │ search_mode_override=token_ids   │
    └──────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ Backend: corpus.search()      │
    │ • _parse_token_ids()         │
    │ • SearchParams.search_mode   │
    │   = "token_ids"              │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ SQL Query Builder            │
    │ WHERE token_id IN (...)      │
    │ ORDER BY CASE ... END        │ ← Input-Reihenfolge!
    │ (TOKEN1 → 0, TOKEN2 → 1, ...) │
    └──────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────┐
    │ SQLite Query Execution       │
    │ SELECT * FROM tokens         │
    │ WHERE token_id IN (...)      │
    │ ORDER BY CASE ... LIMIT 25   │
    └──────────────────────────────┘
           │
           ▼
    RESULT: 3 Rows in gewünschter Reihenfolge
    (TOKEN1, TOKEN2, TOKEN3)
```

---

## 4. Backend Service-Flow

```
search_tokens(params: SearchParams)
│
├─ 1. FILTER-KLAUZELN BAUEN
│   │
│   ├─ IF token_ids:
│   │  └─ placeholders = ",".join(["?"] * len(token_ids))
│   │     filters.append(f"token_id IN ({placeholders})")
│   │
│   ├─ _append_in_clause(... country_code ...)
│   ├─ _append_in_clause(... speaker_type ...)
│   ├─ _append_in_clause(... sex ...)
│   ├─ _append_in_clause(... mode ...)
│   ├─ _append_in_clause(... discourse ...)
│   │
│   └─ IF table_search:  # DataTables search-box
│      └─ Add: (text LIKE ? OR context_left LIKE ? OR ...)
│
├─ 2. WORD-QUERY BAUEN
│   │
│   ├─ IF query:
│   │  └─ IF search_mode == "text":
│   │     └─ _build_word_query(words, "text", exact=False)
│   │        Returns: (SQL, params)
│   │
│   ├─ IF search_mode == "lemma":
│   │  └─ _build_word_query(words, "lemma", exact=False)
│   │
│   └─ IF search_mode == "text_exact":
│      └─ _build_word_query(words, "text", exact=True)
│
├─ 3. COMBINE: WHERE CLAUSE
│   │
│   └─ filter_clause = " AND ".join(filters)
│
├─ 4. ORDER BY AUFLÖSEN
│   │
│   ├─ IF token_ids:
│   │  └─ CASE WHEN token_id = ? THEN 0 ... END  ← Input-Reihenfolge
│   │
│   └─ ELSE:
│      └─ sort_column ASC|DESC
│
├─ 5. PAGINATION
│   │
│   └─ offset = (page - 1) * page_size
│      LIMIT page_size OFFSET offset
│
├─ 6. EXECUTE SQL
│   │
│   ├─ COUNT Query: SELECT COUNT(*) FROM (...) WHERE ...
│   │  └─ total_results = count_result
│   │
│   └─ DATA Query: SELECT * FROM (...) WHERE ... LIMIT/OFFSET
│      └─ rows = data_result
│
├─ 7. CONVERT ROWS
│   │
│   └─ FOR EACH row:
│      ├─ _row_to_dict(row_tuple)
│      ├─ Check: safe_audio_full_path()
│      ├─ Check: safe_transcript_path()
│      └─ {id, token_id, filename, country_code, ...}
│
├─ 8. COMPUTE AGGREGATES
│   │
│   ├─ unique_countries = len(set(row["country_code"] ...))
│   ├─ unique_files = len(set(row["filename"] ...))
│   └─ total_pages = ceil(total_results / page_size)
│
└─ 9. RETURN
    └─ {
       "items": row_dicts,           # Aktuelle Seite
       "all_items": row_dicts,       # (gleich wie items)
       "total": total_results,
       "page": page,
       "page_size": page_size,
       "total_pages": total_pages,
       "unique_countries": ...,
       "unique_files": ...
    }
```

---

## 5. DataTables Column Mapping

```
FRONTEND (HTML/JS)          BACKEND (Python)       RENDERING
─────────────────           ────────────────       ──────────
Column 0:  #                 ""                  Row Index
Column 1:  Ctx.←            ""                  context_left
Column 2:  Palabra          "text"              text (SORTIERBAR)
Column 3:  Ctx.→            ""                  context_right
Column 4:  Audio            ""                  audio_available (button)
Column 5:  País             "country_code"      country_code (SORTIERBAR)
Column 6:  Hablante         "speaker_type"      speaker_type (SORTIERBAR)
Column 7:  Sexo             "sex"               sex (SORTIERBAR)
Column 8:  Modo             "mode"              mode (SORTIERBAR)
Column 9:  Discurso         "discourse"         discourse (SORTIERBAR)
Column 10: Token-ID         "token_id"          token_id (SORTIERBAR)
Column 11: Archivo          "filename"          filename (SORTIERBAR)
Column 12: (hidden)         —                  start (time)
Column 13: (hidden)         —                  end (time)
Column 14: (hidden)         —                  context_start
Column 15: (hidden)         —                  context_end
```

**Benutzer klickt Spalte "Palabra" zum Sortieren:**
```
DataTables Event
 │
 ├─ User clicks column 2 (Palabra)
 │
 ├─ DataTables sendet: order[0][column]=2, order[0][dir]=asc
 │
 ├─ Backend: column_map[2] = "text"
 │
 └─ SQL: ORDER BY text ASC
```

---

## 6. Filter-Logik: Länder

```
USER DECISION
│
├─ Checkbox "Incluir emisoras regionales" UNCHECKED
│  │
│  └─→ include_regional = False
│      │
│      └─→ countries = ["ARG", "BOL", "CHL", ...] (19)
│
└─ Checkbox "Incluir emisoras regionales" CHECKED
   │
   └─→ include_regional = True
       │
       └─→ countries = ["ARG", "BOL", ..., "ARG-CHU", "ARG-CBA", ...] (24)
           (19 national + 5 regional)

BACKEND LOGIC
│
├─ IF countries is EMPTY:
│  ├─ IF include_regional == True:
│  │  └─ countries = national_codes + regional_codes
│  └─ ELSE:
│     └─ countries = national_codes
│
├─ ELSE IF include_regional == False:
│  └─ countries = [c for c in countries if c not in regional_codes]
│     (Remove regional codes if unchecked)
│
└─ SQL FILTER:
   └─ WHERE country_code IN (countries)
```

---

## 7. Frontend Module Dependencies

```
┌──────────────────────────────────────────────────────────────┐
│                    index.js (CorpusApp)                      │
│                                                               │
│  Orchestrator: Koordiniert alle Module                       │
│  • initialize() → alle Komponenten starten                  │
│  • isInitialized (flag)                                     │
└────────────────────┬───────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────────┐  ┌────────────┐  ┌─────────────┐
│ filters.js  │  │ search.js  │  │ tokens.js   │
│             │  │            │  │             │
│ Select2     │  │ Form       │  │ TokenTab     │
│ MultiSelect │  │ Submit     │  │ Validation  │
│ Regional    │  │ Builder    │  │ Drag-Drop   │
│ Checkbox    │  │ Navigation │  │ Paste       │
└─────────────┘  └────────────┘  └─────────────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ datatables.js   │
            │                 │
            │ DataTables      │
            │ Server-Side     │
            │ AJAX            │
            │ Columns         │
            │ Buttons         │
            └─────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌──────────┐    ┌────────────┐   ┌─────────┐
│ audio.js │    │ config.js  │   │ api.js  │
│          │    │            │   │ (if any)│
│ Player   │    │ Constants  │   │         │
│ Button   │    │ Select2    │   │ Calls   │
│ Binding  │    │ Config     │   │         │
└──────────┘    └────────────┘   └─────────┘
```

---

## 8. Performance Flow

```
USER INTERACTION (Milliseconds)
│
├─ 0ms: Click "Buscar"
│
├─ 10ms: Form validation (frontend)
│
├─ 15ms: Navigation to /corpus/search
│
├─ 50-200ms: Backend processing (SQL query)
│  │
│  ├─ 50ms: SQL execution (fast, indexed)
│  ├─ 20ms: Result conversion
│  ├─ 80ms: Template rendering
│  └─ 50ms: Network transfer
│
├─ 250ms: HTML rendered, DataTables initialized
│
├─ 300ms: DataTables AJAX request sent
│  │
│  ├─ 50ms: Backend processes AJAX
│  ├─ 20ms: JSON serialization
│  └─ 20ms: Network transfer
│
├─ 390ms: JSON received, Table rendered
│
├─ 400ms: Event handlers bound (Audio buttons)
│
└─ 450ms: USER CAN INTERACT
   (Sorted, Paginated, Filtered Results)

TARGETS:
├─ Simple Search: < 200ms backend
├─ Token Search: < 200ms backend
├─ DataTables Page: < 500ms total
├─ Sequence Search (geplant): < 500ms backend
└─ Regex Search (geplant): < 1000ms backend
```

---

## Siehe auch

- [Corpus Search Architecture](../reference/corpus-search-architecture.md) - Detaillierte Dokumentation
- [Quick Reference](../reference/corpus-search-quick-reference.md) - Code-Snippets und Shortcuts
- [Advanced Search Planning](../how-to/corpus-advanced-search-planning.md) - Implementierungs-Guide
