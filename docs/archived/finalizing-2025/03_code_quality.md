# Code Quality & Dead Code Report (Phase 3)

**Datum:** 21.11.2025
**Status:** Complete

## 1. Verwendete Tools

- **Python:**
  - Formatter: `ruff format` (konfiguriert in `pyproject.toml`)
  - Linter: `ruff check`
  - Dead Code: `vulture` (optional/manuell)
- **Frontend:**
  - Formatter: `prettier` (via npx)
  - Linter: `eslint` (nicht aktiv konfiguriert, Fokus auf Formatting)

## 2. Bearbeitete Verzeichnisse

| Verzeichnis | Status | Anmerkungen |
|-------------|--------|-------------|
| `src/` | Done | Backend Code formatiert & gelintet |
| `scripts/` | Done | Hilfsskripte formatiert & gelintet |
| `tests/` | Done | Tests formatiert & gelintet |
| `static/js/` | Done | Frontend Logic formatiert (Prettier) |
| `static/css/` | Done | Styles formatiert (Prettier) |

## 3. Konfiguration & Regeln

- **Python:** Standard `ruff` Konfiguration (Line Length 88/100, Python 3.12).
- **Frontend:** Standard `prettier` Konfiguration.

## 4. Entfernte Dead-Code-Elemente

| Pfad | Element | Grund |
|------|---------|-------|
| `static/js/_legacy_backup/` | Ordner | Veraltetes Backup |
| `src/app/routes/corpus.py` | Code nach return | Unreachable Code |
| Diverse Dateien | Unused Imports | Cleanup durch Ruff |

## 5. Offene Probleme / TODOs

- Keine kritischen offenen Probleme im Scope von Phase 3.

## 6. Logging

| Verzeichnis | Formatted | `ruff format` angewendet | Linted | `ruff check --fix` angewendet (Imports sortiert, Syntax modernisiert) |
|-------------|-----------|--------------------------|--------|--------------------------------------------------------|
| `src/` | Formatted | `ruff format` angewendet | Linted | `ruff check --fix` angewendet (Imports sortiert, Syntax modernisiert) |
| `scripts/` | Formatted | `ruff format` angewendet | Linted | `ruff check --fix` angewendet |
| `tests/` | Formatted | `ruff format` angewendet | Linted | `ruff check --fix` angewendet |
| src/app/routes/corpus.py | Fixed | Dead Code nach `return` entfernt (F821) |
| tests/test_advanced_api_enrichment.py | Fixed | Doppelten Key im Dict korrigiert (F601) |
| scripts/check_tokens.py | Fixed | Import-Reihenfolge korrigiert (E402) |
| src/app/extensions/__init__.py | Fixed | Unused import `current_app` entfernt |
| src/app/routes/editor.py | Fixed | Unused variable `pattern` entfernt |
| src/app/search/advanced_api.py | Fixed | Unused variables `context_size`, `bls_url`, `http_client`, `mode`, `query`, `sensitive` entfernt |
| src/app/services/blacklab_search.py | Fixed | Unused variable `pos` entfernt |
| src/app/services/corpus_search.py | Fixed | Unused variable `bindings_for_all` entfernt |
| tests/test_cql_country_constraint.py | Fixed | Unused variable `filters` entfernt |
| static/js/ | Formatted | `npx prettier` angewendet |
| static/css/ | Formatted | `npx prettier` angewendet |
| static/js/_legacy_backup/ | Deleted | Veraltetes Backup entfernt |

## Status nach Phase 3

- **Backend:** Code ist mit `ruff` formatiert und gelintet. Import-Fehler und unbenutzte Variablen wurden bereinigt.
- **Frontend:** Code ist mit `prettier` formatiert.
- **Dead Code:** Offensichtliche Leichen (`_legacy_backup`) entfernt.
- **Tests:** `ruff` Checks laufen auch über Tests.

**Offene Punkte für Phase 4:**
- `requirements.txt` Bereinigung.
- `passwords.env` Standardisierung.
- CI/CD Pipeline Setup.
