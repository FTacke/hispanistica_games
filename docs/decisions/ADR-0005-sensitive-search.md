---
title: "ADR-0005: Case/Accent-Insensitive Search Implementation"
status: active
owner: backend-team
updated: "2025-11-09"
tags: [search, database, query-branching, feature]
links:
  - reference/sensitive-search-specification.md
  - how-to/enable-sensitive-search.md
  - concepts/authentication-flow.md
---

# ADR-0005: Case/Accent-Insensitive Search Implementation

**Status:** Accepted  
**Date:** 2025-11-09  
**Deciders:** Backend Team, Documentation  
**Supersedes:** None

---

## Context

### Problem
Benutzer möchten flexibel zwischen zwei Such-Modi wechseln:

1. **Case/Accent-Sensitive (Standard):** Findet nur exakte Treffer
   - Suche "méxico" → findet "méxico", "México" (existiert in DB)
   - Suche "méxico" → findet NICHT "mexico", "MEXICO"

2. **Case/Accent-Insensitive:** Findet variante Formen
   - Suche "méxico" → findet "méxico", "Mexico", "MÉXICO", etc.
   - Suche "está" → findet "está", "esta" (beide)

### Current State
- Nur sensitive-Search unterstützt (bisheriges Verhalten)
- Nutzt `text`/`lemma`-Spalten
- Keine Option für indifferente Suche

### Requirement
- User-wählbarer Toggle (Checkbox) im Corpus-UI
- **Default: aktiv** (sensitive = 1) → Backwards-Compatible
- Persistierung der Benutzer-Preference (localStorage)
- Backend-Branching: unterschiedliche SQL-Queries
- **Keine API-Response-Änderung** (norm nicht exponiert)

---

## Decision

### Implementierung

#### 1. Frontend Layer

**Checkbox in corpus.html:**
```html
<label class="md3-checkbox-container">
    <input type="checkbox" id="sensitive-search" name="sensitive" value="1" 
           {% if request.args.get('sensitive', '1') == '1' %}checked{% endif %}>
    <span class="md3-checkbox">...</span>
    <span class="md3-checkbox__label">Sensibilidad a mayúsculas y acentos</span>
</label>
```

**localStorage Persistierung:**
```javascript
localStorage.getItem('corapan_sensitive')   // '1' oder '0'
localStorage.setItem('corapan_sensitive', value)  // Speichern
```

#### 2. DataTables AJAX Integration

**Parameter-Passing:**
```javascript
d.sensitive = sensitiveCheckbox.checked ? 1 : 0
// Sent to /corpus/search/datatables
```

#### 3. Backend Query-Branching

**SearchParams:**
```python
@dataclass
class SearchParams:
    sensitive: int = 1  # 1=sensitive, 0=indifferent
    # ...
```

**Query Construction:**
```python
def _build_word_query(words, column, exact, sensitive=1):
    if sensitive == 0:
        column = "norm"  # Use normalized column
        words = [_normalize_for_search(w) for w in words]
    # SQL generated based on column choice
```

**SQL Queries:**
- **sensitive=1:** `WHERE text LIKE '%...'` → uses `idx_tokens_text`
- **sensitive=0:** `WHERE norm LIKE '%...'` → uses `idx_tokens_norm`

#### 4. Database Support

**Spalte:** `norm TEXT` (muss in DB existieren)
- Enthält normalisierte Form jedes Tokens
- Ermöglicht accent/case-insensitive Matching
- Wird bei DB-Rebuild mit Daten gefüllt

**Index:** `idx_tokens_norm`
- Erstellt automatisch beim App-Startup (falls nicht vorhanden)
- Sorgt für Performance parity mit `idx_tokens_text`

#### 5. Normalisierung

**Funktion:** `_normalize_for_search(text: str) → str`
- Zu lowercase: "México" → "mexico"
- Akzente entfernen (NFD): "españa" → "espana"
- Beispiele:
  - "SEÑOR" → "senor"
  - "está" → "esta"
  - "México" → "mexico"

---

## Consequences

### ✅ Positive

- **Flexible Search:** User-Kontrolle über Match-Strategie
- **Persistent Preference:** localStorage speichert Benutzer-Wahl
- **Backwards Compatible:** Default=1 (bisheriges Verhalten)
- **Performance:** Beide Modi nutzen Indizes (ähnliche Geschwindigkeit)
- **No API Changes:** Response-Format bleibt stabil
- **Deterministic:** SQL-Queries sind klar verzweigt

### ⚠️ Negative

- **Database Prerequisite:** `norm`-Spalte muss existieren
- **Index Maintenance:** Neuer Index `idx_tokens_norm` zu pflegen
- **Data Preparation:** `norm` muss mit Daten gefüllt sein
- **API Complexity:** Additional parameter handling in routes

### 🔄 Neutral

- **User Education:** UI-Text auf Spanisch für Benutzerfreundlichkeit
- **Testing Overhead:** Zusätzliche Test-Cases (sensitive=0/1)
- **Monitoring:** Tracking welcher Modus verwendet wird

---

## Alternatives Considered

### Alternative 1: Full-Text Search (FTS5)
**Pros:**
- Native Accent-Insensitive mit SQLite FTS5
- Bessere Multi-Word Performance

**Cons:**
- Komplexere Migrationen (Virtual Table)
- FTS5 hat andere Query-Syntax
- Höherer Speicherverbrauch
- Zeitaufwendigere Implementation

**Decision:** ❌ Abgelehnt (zu komplex, `norm`-Spalte genügt)

---

### Alternative 2: Application-Layer Normalization
**Pros:**
- Keine DB-Changes erforderlich
- Python-basierte Normalisierung einfach

**Cons:**
- Keine Index-Unterstützung → Full-Table-Scan
- Langsam bei 1.3M Tokens
- Speicherintensiv (all results normalized)

**Decision:** ❌ Abgelehnt (Performance-Problems)

---

### Alternative 3: COLLATE NOCASE + Regex
**Pros:**
- SQLite-native COLLATE NOCASE
- Kein Normalisierungs-Code nötig

**Cons:**
- NOCASE funktioniert nicht mit Akzenten
- Regex für Akzente ist langsam
- Keine Indizes für Regex

**Decision:** ❌ Abgelehnt (unzureichend für spanische Akzente)

---

## Implementation

### Implemented (2025-11-09)

✅ **Frontend:**
- Checkbox UI in corpus.html
- localStorage-Persistierung
- DataTables Parameter-Passing

✅ **Backend:**
- SearchParams mit `sensitive` Parameter
- `_normalize_for_search()` Normalisierungsfunktion
- `_build_word_query()` Query-Branching
- Route-Parameter-Parsing (/corpus/search + /corpus/search/datatables)

✅ **Database:**
- Schema-Validierung prüft `norm`-Spalte
- Index Auto-Creation beim Startup

✅ **Documentation:**
- Diese ADR
- Technische Spezifikation (reference)
- How-To Guide (how-to)
- Test-Checkliste (archived)

### Files Modified
- `templates/pages/corpus.html`
- `static/js/modules/corpus/datatables.js`
- `src/app/services/corpus_search.py`
- `src/app/routes/corpus.py`
- `src/app/__init__.py`

### Testing
- ✅ Unit tests für `_normalize_for_search()`
- ✅ Integration tests für Query-Branching
- ✅ Browser tests für localStorage + UI
- ✅ Performance tests (Index usage)

---

## References

- [Database Schema v3](../reference/database-creation-v3.md) - norm column definition
- [Corpus Search Architecture](../reference/corpus-search-architecture.md) - Search flow
- [Sensitive Search Specification](../reference/sensitive-search-specification.md) - Technical details
- [Enable Sensitive Search How-To](../how-to/enable-sensitive-search.md) - Deployment guide

---

## Siehe auch

- [ADR-0001: Docs Reorganization](ADR-0001-docs-reorganization.md) - Dokumentations-Struktur
- [reference/sensitive-search-specification.md](../reference/sensitive-search-specification.md) - API & SQL Details
- [how-to/enable-sensitive-search.md](../how-to/enable-sensitive-search.md) - Deployment & Testing
- [operations/deployment.md](../operations/deployment.md) - Production Deployment
