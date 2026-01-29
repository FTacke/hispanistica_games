# Quiz Refactoring – Phase DEV-Unblock (DEV 500 Fix)

Date: 2026-01-29

## Summary
- DEV returned 500 when starting a quiz run because the local Postgres schema was missing server-timer columns on `quiz_runs`.
- Added a DEV-only migration runner and wired it into `dev-start.ps1` before seeding.
- Added a regression test ensuring the run start endpoint responds 200 and returns 10 questions.

## Repro (before fix)
1. Start DEV with Postgres:
   - `docker compose -f docker-compose.dev-postgres.yml up -d`
   - `./scripts/dev-start.ps1 -UsePostgres`
2. Repro call (after loading `/quiz/<topic>/play` to set session):
   - `POST http://127.0.0.1:8000/api/quiz/<topic_id>/run/start`
3. Result: `500 Internal server error`

**Request context**
- Method: `POST`
- URL: `/api/quiz/variation_aussprache/run/start`
- Body: `{}` (Content-Type `application/json`)

## Root Cause
**Missing DB columns** introduced by the server-based timer migration.

Stacktrace excerpt (first cause):
```
psycopg.errors.UndefinedColumn: column quiz_runs.question_started_at does not exist
HINT:  Perhaps you meant to reference the column "quiz_runs.question_started_at_ms".
```

File/Location:
- Query executed in [game_modules/quiz/services.py](../../../game_modules/quiz/services.py) via `get_current_run()` (used by `start_run()`)
- Migration file: [migrations/0012_add_server_based_timer.sql](../../../migrations/0012_add_server_based_timer.sql)

## Fix
### 1) DEV-only migration runner
- Added [scripts/quiz_dev_migrate.py](../../../scripts/quiz_dev_migrate.py)
  - Executes `migrations/0012_add_server_based_timer.sql` against `AUTH_DATABASE_URL`
  - Idempotent (uses `ADD COLUMN IF NOT EXISTS`)

### 2) Run it automatically in DEV start
- Updated [scripts/dev-start.ps1](../../../scripts/dev-start.ps1)
  - Executes `quiz_dev_migrate.py` before seeding
  - Fails fast if migration fails

### 3) Regression test
- Added [tests/test_quiz_dev_unblock.py](../../../tests/test_quiz_dev_unblock.py)
  - Ensures `/api/quiz/<topic_id>/run/start` returns 200 and yields 10 questions

## Risks / Tradeoffs
- The migration runner is **DEV-only** and is invoked only by `dev-start.ps1` in Postgres mode.
- No production code paths or deployment workflows were modified.
- The migration is idempotent and safe to re-run locally.

## Verification
### DEV DB setup
- `docker compose -f docker-compose.dev-postgres.yml up -d`

### Start DEV server (now includes migration)
- `./scripts/dev-start.ps1 -UsePostgres`

### Manual smoke
- Open: `http://127.0.0.1:8000/quiz`
- Start a run for any topic and answer at least one question

### Tests
- `pytest tests/test_quiz_dev_unblock.py`

## Files changed / added
- Added: [scripts/quiz_dev_migrate.py](../../../scripts/quiz_dev_migrate.py)
- Changed: [scripts/dev-start.ps1](../../../scripts/dev-start.ps1)
- Added: [tests/test_quiz_dev_unblock.py](../../../tests/test_quiz_dev_unblock.py)
