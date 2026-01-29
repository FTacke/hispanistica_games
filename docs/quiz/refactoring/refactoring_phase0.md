# Quiz Refactoring – Phase 0 (Safety + Flag + Smoke Tests)

Date: 2026-01-29

## Summary
- Added infrastructure for a mechanics version flag (`QUIZ_MECHANICS_VERSION`) with strict validation and safe fallback to `v1`.
- Introduced a minimal mechanics gate in the quiz run question builder. Both `v1` and `v2` currently use the existing constants (no behavior change).
- Added backend smoke tests to guard defaults, run size, and leaderboard ordering.
- Documented manual frontend smoke checks.

## What was **not** changed
- No mechanics logic changes (scoring, timers, question counts, joker rules) were altered.
- No API changes.
- No database schema changes or migrations.

## Files changed / added
- Changed: [src/app/config/__init__.py](../../../../src/app/config/__init__.py)
  - Added config default `QUIZ_MECHANICS_VERSION = "v1"`.
- Added: [game_modules/quiz/config.py](../../../game_modules/quiz/config.py)
  - Helper `get_quiz_mechanics_version()` with validation and fallback.
- Changed: [game_modules/quiz/services.py](../../../game_modules/quiz/services.py)
  - Added minimal mechanics gate inside `_build_run_questions()` (v1/v2 both use existing constants).
- Added: [tests/test_quiz_mechanics_phase0.py](../../../tests/test_quiz_mechanics_phase0.py)
  - Smoke tests for flag default, run size, leaderboard ordering.

## Feature-Flag / Mechanics Version

### Source of flag
- **Flask config**: `QUIZ_MECHANICS_VERSION` (loaded from environment in `BaseConfig`).
- **Environment variable**: `QUIZ_MECHANICS_VERSION` (fallback if not in config).

### Allowed values
- `v1` (default)
- `v2`

### Helper
- `get_quiz_mechanics_version()` returns `"v1"` or `"v2"` and falls back to `"v1"` on invalid input.

### How to set (DEV)
- PowerShell:
  - `$env:QUIZ_MECHANICS_VERSION = "v1"`
  - `$env:QUIZ_MECHANICS_VERSION = "v2"`

## Backend Verification

### Run tests (requires PostgreSQL)
These tests use the existing quiz test setup, which requires PostgreSQL:
- Start PG for tests:
  - `docker compose -f docker-compose.dev-postgres.yml up -d`
- Run Phase 0 tests:
  - `pytest tests/test_quiz_mechanics_phase0.py`

### What the tests assert
- `test_mechanics_flag_defaults_to_v1()`
  - The flag defaults to `v1` when not set.
- `test_start_run_creates_10_questions()`
  - `start_run()` creates a run with 10 questions.
- `test_leaderboard_ordering_is_score_desc_created_at_asc()`
  - Leaderboard ordering is score desc, created_at asc.

## Frontend Smoke Checklist (manual)
- Start run (topic entry)
- Answer a question and continue
- Finish run (see final screen)
- Use joker (50/50)
- Let the timer expire on a question

## No Behavior Change Confirmation
- The mechanics gate in `_build_run_questions()` uses existing constants for both `v1` and `v2`.
- No logic in scoring, timers, joker, or selection rules was modified.
- No schema or API contract changes were introduced.
