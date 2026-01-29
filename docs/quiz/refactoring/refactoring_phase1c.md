# Refactoring Phase 1c (Execution + Verification + Mapping Drift Fix)

Stand: 2026-01-29

## Summary
- Mapping-Drift korrigiert (Docs + Script konsistent: 1→1, 2→1, 3→2, 4→2, 5→3).
- DEV Hard-Prune ausgeführt (Counts dokumentiert).
- Migration ausgeführt (nur `variation_aussprache_v2.json` valid und erzeugt; andere Units failen Mindest-Check).
- Single-Seed ausgeführt (nur `variation_aussprache_v2.json` in DB).
- Runtime-Check via Flask Test-Client (GET /games/quiz → 200 nach Redirect; Run/Answer OK). dev-start schlägt wegen invaliden Nicht-v2 Units fehl (erwartet).

## Step 1 — Mapping Drift Fix (Code + Docs)
- Mapping ist nun konsistent:
  - `1→1, 2→1, 3→2, 4→2, 5→3`
- Doku angepasst: [docs/quiz/refactoring/refactoring_phase1.md](docs/quiz/refactoring/refactoring_phase1.md)

## Step 2 — DEV Hard Prune (Ausgeführt)
**Command:**
```
$env:FLASK_SECRET_KEY='dev'; $env:AUTH_DATABASE_URL='postgresql+psycopg2://hispanistica_auth:hispanistica_auth@localhost:54321/hispanistica_auth'; $env:ENV='dev'; C:/dev/hispanistica_games/.venv/Scripts/python.exe scripts/quiz_dev_prune.py --i-know-what-im-doing
```

**Output (stdout):**
```
[2026-01-29 19:24:40] INFO: Auth DB connection verified: postgresql+psycopg2://hispanistica_auth:***@localhost:54321/hispanistica_auth
[2026-01-29 19:24:40] INFO: games_hispanistica application startup
[2026-01-29 19:24:40] INFO: Counts BEFORE prune:
[2026-01-29 19:24:40] INFO:   quiz_run_answers: 8
[2026-01-29 19:24:40] INFO:   quiz_runs: 2
[2026-01-29 19:24:40] INFO:   quiz_scores: 0
[2026-01-29 19:24:40] INFO:   quiz_questions: 33
[2026-01-29 19:24:40] INFO:   quiz_topics: 7
[2026-01-29 19:24:40] INFO:   quiz_content_releases: 13
[2026-01-29 19:24:40] INFO:   quiz_question_stats: 0
[2026-01-29 19:24:40] INFO:   quiz_sessions: 4
[2026-01-29 19:24:40] INFO:   quiz_players: 2
[2026-01-29 19:24:40] INFO: Counts AFTER prune:
[2026-01-29 19:24:40] INFO:   quiz_run_answers: 0
[2026-01-29 19:24:40] INFO:   quiz_runs: 0
[2026-01-29 19:24:40] INFO:   quiz_scores: 0
[2026-01-29 19:24:40] INFO:   quiz_questions: 0
[2026-01-29 19:24:40] INFO:   quiz_topics: 0
[2026-01-29 19:24:40] INFO:   quiz_content_releases: 0
[2026-01-29 19:24:40] INFO:   quiz_question_stats: 0
[2026-01-29 19:24:40] INFO:   quiz_sessions: 0
[2026-01-29 19:24:40] INFO:   quiz_players: 0
[2026-01-29 19:24:40] INFO: ✓ DEV hard prune complete
```

**Hinweis Guards:**
- Initialer Run scheiterte ohne `FLASK_SECRET_KEY` und mit falschem Port (54320). Korrigiert auf Port **54321** (siehe docker-compose.dev-postgres.yml) und `FLASK_SECRET_KEY=dev` gesetzt.

## Step 3 — Migration ausführen (Ergebnis & Logs)
**Command:**
```
C:/dev/hispanistica_games/.venv/Scripts/python.exe scripts/quiz_content_migrate_difficulty_1_3.py
```

**Output (stdout):**
```
[2026-01-29 19:25:37] INFO: Migrating aussprache.json
[2026-01-29 19:25:37] ERROR: aussprache.json: validation failed after migration
[2026-01-29 19:25:37] ERROR:   - Difficulty 1: need at least 4 questions in aussprache.json, got 1
[2026-01-29 19:25:37] ERROR:   - Difficulty 2: need at least 4 questions in aussprache.json, got 0
[2026-01-29 19:25:37] ERROR:   - Difficulty 3: need at least 2 questions in aussprache.json, got 0
[2026-01-29 19:25:37] INFO: Migrating kreativitaet.json
[2026-01-29 19:25:37] ERROR: kreativitaet.json: validation failed after migration
[2026-01-29 19:25:37] ERROR:   - Difficulty 1: need at least 4 questions in kreativitaet.json, got 1
[2026-01-29 19:25:37] ERROR:   - Difficulty 2: need at least 4 questions in kreativitaet.json, got 0
[2026-01-29 19:25:37] ERROR:   - Difficulty 3: need at least 2 questions in kreativitaet.json, got 0
[2026-01-29 19:25:37] INFO: Migrating orthographie.json
[2026-01-29 19:25:37] ERROR: orthographie.json: validation failed after migration
[2026-01-29 19:25:37] ERROR:   - Difficulty 1: need at least 4 questions in orthographie.json, got 1
[2026-01-29 19:25:37] ERROR:   - Difficulty 2: need at least 4 questions in orthographie.json, got 0
[2026-01-29 19:25:37] ERROR:   - Difficulty 3: need at least 2 questions in orthographie.json, got 0
[2026-01-29 19:25:37] INFO: Migrating test_quiz.json
[2026-01-29 19:25:37] ERROR: test_quiz.json: validation failed after migration
[2026-01-29 19:25:37] ERROR:   - Difficulty 1: need at least 4 questions in test_quiz.json, got 1
[2026-01-29 19:25:37] ERROR:   - Difficulty 2: need at least 4 questions in test_quiz.json, got 0
[2026-01-29 19:25:37] ERROR:   - Difficulty 3: need at least 2 questions in test_quiz.json, got 0
[2026-01-29 19:25:37] INFO: Migrating variation_aussprache.json
[2026-01-29 19:25:37] INFO: Wrote variation_aussprache_v2.json
[2026-01-29 19:25:37] INFO: Migrating variation_grammatik.json
[2026-01-29 19:25:37] ERROR: variation_grammatik.json: validation failed after migration
[2026-01-29 19:25:37] ERROR:   - Difficulty 1: need at least 4 questions in variation_grammatik.json, got 1
[2026-01-29 19:25:37] ERROR:   - Difficulty 2: need at least 4 questions in variation_grammatik.json, got 0
[2026-01-29 19:25:37] ERROR:   - Difficulty 3: need at least 2 questions in variation_grammatik.json, got 0
[2026-01-29 19:25:37] INFO: Migrating variation_test_quiz.json
[2026-01-29 19:25:37] ERROR: variation_test_quiz.json: validation failed after migration
[2026-01-29 19:25:37] ERROR:   - Difficulty 1: need at least 4 questions in variation_test_quiz.json, got 3
[2026-01-29 19:25:37] ERROR: Migration completed with 6 failures
```

**Erzeugte *_v2.json Dateien (aktuell):**
- variation_aussprache_v2.json

**Status:**
- `variation_aussprache_v2.json` valid (Min-Check 4/4/2 erfüllt).
- Andere Units failen Mindest-Check und werden nicht geschrieben (Exit-Code ≠ 0, wie gefordert).

## Step 4 — Single Seed (nur variation_aussprache_v2.json)
**Command:**
```
$env:FLASK_SECRET_KEY='dev'; $env:AUTH_DATABASE_URL='postgresql+psycopg2://hispanistica_auth:hispanistica_auth@localhost:54321/hispanistica_auth'; C:/dev/hispanistica_games/.venv/Scripts/python.exe scripts/quiz_seed_single.py --file content/quiz/topics/variation_aussprache_v2.json
```

**Output (stdout):**
```
[2026-01-29 19:26:04] INFO: Auth DB connection verified: postgresql+psycopg2://hispanistica_auth:***@localhost:54321/hispanistica_auth
[2026-01-29 19:26:04] INFO: games_hispanistica application startup
[2026-01-29 19:26:04] INFO: Importing quiz unit: variation_aussprache
[2026-01-29 19:26:04] INFO: Created new topic: variation_aussprache
[2026-01-29 19:26:04] INFO: Seeding topic variation_aussprache | questions: 18 | d1=8 | d2=7 | d3=3
[2026-01-29 19:26:05] INFO: ✓ Seeded variation_aussprache (18 questions, 0 media files)
```

## Step 4b — DB Verification (ORM/SQL)
**Check (Python snippet):**
```
[2026-01-29 19:27:09,123] INFO in __init__: games_hispanistica application startup
topics_total 1
topics_active 1
topics ['variation_aussprache']
difficulty_counts [(1, 8), (2, 7), (3, 3)]
```

## Step 5 — DEV Runtime Check
### dev-start.ps1 (fails due to non-v2 content)
**Command:**
```
$env:ENV='dev'; C:\dev\hispanistica_games\scripts\dev-start.ps1 -UsePostgres
```

**Output (stderr excerpt):**
```
ERROR: Validation failed for aussprache.json: ['Difficulty 1: need at least 4 questions in aussprache.json, got 1', ...]
ERROR: Validation failed for variation_aussprache.json: ["Field 'difficulty' must be 1-3 in variation_aussprache.json Question #13, got 4", ...]
ERROR: Seeding failed: ['aussprache.json: Quiz unit validation failed in aussprache.json - Difficulty 1: need at least 4 questions in aussprache.json, got 1; ...']
```

**Reason:** dev-start nutzt `scripts/quiz_seed.py` (seed all). Nicht-v2 Units sind aktuell invalid gegen die neuen Validatoren → seeding failt (erwartet).

### Runtime Check via Flask Test Client
**Check (Python snippet, v2 enabled):**
```
[2026-01-29 19:30:26,840] INFO in __init__: games_hispanistica application startup
GET /games/quiz (follow)  200 /quiz
```

**Run/Answer (API) Check:**
```
[2026-01-29 19:30:58,763] INFO in __init__: games_hispanistica application startup
register 200 True
start_run 200
question_start 200
answer 200 level_completed False
```

## Done Criteria Status
- Mapping konsistent (Code + Docs) ✅
- Hard prune gelaufen (Counts belegt) ✅
- Migration ausgeführt (variation_aussprache_v2 erstellt, andere Units failen Mindest-Check) ✅
- Single seed importiert nur variation_aussprache_v2 (DB belegt) ✅
- DEV spielbar via Flask Test Client (kein 500, Run/Answer OK) ✅
