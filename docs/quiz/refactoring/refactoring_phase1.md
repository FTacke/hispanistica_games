# Refactoring Phase 1 (Mechanik v2 + Content + Schema + Tokens soft removal)

Stand: 2026-01-29

## Summary
- Mechanik v2 hinter `QUIZ_MECHANICS_VERSION=v2` implementiert (3 Level, 4/4/2).
- Tokens sind soft entfernt: Backend liefert immer `tokens_count=0`, Frontend ignoriert Tokens.
- Validatoren akzeptieren nur Difficulty 1–3 und erzwingen 4/4/2 pro Unit.
- Migration-Script für Content-Difficulties (1–5 ➜ 1–3) ergänzt.
- DEV-Safety-Guard für `quiz_dev_migrate.py` (nur `ENV=dev` + lokale DB-Hosts).

## Geänderte Dateien
- game_modules/quiz/services.py
- game_modules/quiz/validation.py
- scripts/quiz_dev_migrate.py
- scripts/quiz_content_migrate_difficulty_1_3.py
- static/js/games/quiz-play.js
- tests/test_quiz_module.py
- tests/test_quiz_scoring_ui.py
- tests/test_quiz_mechanics_phase1.py
- docs/quiz/refactoring/refactoring_phase1.md

## Neue Regeln (Invariants)
### Mechanics v2 (Flag: `QUIZ_MECHANICS_VERSION=v2`)
- **10 Fragen pro Run** bleiben fix.
- **Difficulty-Range**: nur 1–3.
- **Distribution**: 4 Fragen (D1), 4 Fragen (D2), 2 Fragen (D3).
- **Level-Ende**: nach Frageindex 3, 7, 9 (0-based) bzw. wenn `required_count` für die Difficulty erreicht ist.
- **Perfect Level Bonus** (deterministisch):
  - Bonus = `required_count * POINTS_PER_DIFFICULTY[difficulty]`.
  - Für v2: D1=4×10=40, D2=4×20=80, D3=2×30=60.

### Mechanics v1 (Flag: `QUIZ_MECHANICS_VERSION=v1`)
- Verhalten wie bisher (5 Level, 2 Fragen pro Level).
- Punktewerte bleiben v1-konform (1–5).

### Tokens (soft removal)
- Backend liefert **immer** `tokens_count = 0` (int, nie null).
- `breakdown` darf token-Felder enthalten, aber **immer**:
  - `token_earned = false`
  - `token_bonus = 0`
- Frontend ignoriert Tokens (keine Anzeige, toleriert 0).

### Validation (Content)
- Difficulty **nur 1–3** (strict).
- Required counts pro Unit: **D1 ≥ 4**, **D2 ≥ 4**, **D3 ≥ 2**.
- Admin-Import verwendet diese Regeln (via `validate_quiz_unit`).

### DEV Safety Guard
- `scripts/quiz_dev_migrate.py` bricht ab, wenn:
  - `ENV != dev`
  - DB-Host nicht `localhost` oder `127.0.0.1`

## v2 aktivieren
- Windows PowerShell:
  - `setx QUIZ_MECHANICS_VERSION v2`
  - oder temporär: `$env:QUIZ_MECHANICS_VERSION = "v2"`

## Content-Migration (Difficulty 1–5 ➜ 1–3)
- Script: `scripts/quiz_content_migrate_difficulty_1_3.py`
- Mapping (fix): `1→1, 2→1, 3→2, 4→3, 5→3`
- In-Place (mit .bak):
  - `python scripts/quiz_content_migrate_difficulty_1_3.py --input-dir content/quiz/topics`
- Output-Dir:
  - `python scripts/quiz_content_migrate_difficulty_1_3.py --input-dir content/quiz/topics --output-dir content/quiz/topics_v2`

## Verifikation
### Pytest (relevante Tests)
- `pytest tests/test_quiz_mechanics_phase1.py -v`
- `pytest tests/test_quiz_module.py -v`
- `pytest tests/test_quiz_scoring_ui.py -v`

### Manuelle Checks
1. **v1 (Default)**
   - `QUIZ_MECHANICS_VERSION` unset → Verhalten wie bisher.
2. **v2**
   - `QUIZ_MECHANICS_VERSION=v2` → 3 Level, 4/4/2 Distribution, Level-Ende nach Index 3/7/9.
   - `/finish` Response: `tokens_count = 0`.
3. **DEV Start**
   - `dev-start.ps1 -UsePostgres` läuft weiterhin ohne 500.
