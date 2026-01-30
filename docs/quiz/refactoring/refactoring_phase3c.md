# Refactoring Phase 3c – v2 Default, Dev-Start Defaults, Evidence

Date: 2026-01-30

## Summary
- v2 is now the default mechanics version when `QUIZ_MECHANICS_VERSION` is unset.
- `QUIZ_DEV_SEED_MODE` defaults to `none` for safe dev starts (explicit seeding remains opt-in).
- `dev-start.ps1` logs effective defaults (no manual env required).
- Postgres-only enforcement remains unchanged from Phase 3b.

Baseline reference: [docs/quiz/refactoring/refactoring_baseline.md](docs/quiz/refactoring/refactoring_baseline.md)

## Default rules (source of truth = Python config)
- Mechanics: `QUIZ_MECHANICS_VERSION` defaults to `v2` if not set.
- Seed mode: `QUIZ_DEV_SEED_MODE` defaults to `none` if not set.
- Scripts may log (and optionally set) defaults, but Python config is authoritative.

## Code search: where values are read / set

### `QUIZ_MECHANICS_VERSION`
- [game_modules/quiz/config.py](game_modules/quiz/config.py#L10) - env key constant.
- [game_modules/quiz/config.py](game_modules/quiz/config.py#L14) - `get_quiz_mechanics_version()`.
- [game_modules/quiz/config.py](game_modules/quiz/config.py#L18) - docstring (config/env sources).
- [game_modules/quiz/config.py](game_modules/quiz/config.py#L19) - docstring (config/env sources).
- [game_modules/quiz/config.py](game_modules/quiz/config.py#L27) - reads Flask config.
- [game_modules/quiz/config.py](game_modules/quiz/config.py#L32) - env fallback to `v2`.
- [src/app/config/__init__.py](src/app/config/__init__.py#L103) - BaseConfig default `v2`.
- [scripts/dev-start.ps1](scripts/dev-start.ps1#L60) - default set + log.
- [scripts/dev-start.ps1](scripts/dev-start.ps1#L73) - log output.
- [scripts/dev_release_flow_v2.ps1](scripts/dev_release_flow_v2.ps1#L20) - explicit set for release flow.
- [scripts/dev_release_flow_v2.ps1](scripts/dev_release_flow_v2.ps1#L53) - report line.
- [scripts/quiz_dev_reset_v2.ps1](scripts/quiz_dev_reset_v2.ps1#L21) - explicit dev reset.
- [tests/test_quiz_mechanics_phase0.py](tests/test_quiz_mechanics_phase0.py#L33) - test clears env.
- [tests/test_quiz_mechanics_phase0.py](tests/test_quiz_mechanics_phase0.py#L37) - asserts default.

### `QUIZ_DEV_SEED_MODE`
- [src/app/config/__init__.py](src/app/config/__init__.py#L106) - BaseConfig default `none`.
- [scripts/dev-start.ps1](scripts/dev-start.ps1#L66) - default set + log.
- [scripts/dev-start.ps1](scripts/dev-start.ps1#L74) - log output.
- [scripts/dev-start.ps1](scripts/dev-start.ps1#L128) - seed pipeline uses env.
- [scripts/dev-start.ps1](scripts/dev-start.ps1#L134) - skip log.
- [scripts/dev_release_flow_v2.ps1](scripts/dev_release_flow_v2.ps1#L21) - explicit set for release flow.
- [scripts/dev_release_flow_v2.ps1](scripts/dev_release_flow_v2.ps1#L54) - report line.
- [scripts/quiz_dev_reset_v2.ps1](scripts/quiz_dev_reset_v2.ps1#L22) - explicit dev reset.

## Changed files (file + line)
- [game_modules/quiz/config.py](game_modules/quiz/config.py#L18-L41) - default fallback changed to `v2`.
- [src/app/config/__init__.py](src/app/config/__init__.py#L103-L106) - BaseConfig defaults updated (`v2`, `none`).
- [scripts/dev-start.ps1](scripts/dev-start.ps1#L60-L74) - defaulting + logging in dev-start.
- [tests/test_quiz_mechanics_phase0.py](tests/test_quiz_mechanics_phase0.py#L33-L37) - default expectation updated.
- [startme.md](startme.md#L17-L36) - docs updated for v2 default + dynamic port.

## Evidence

### Test 1: dev-start without env (no `QUIZ_MECHANICS_VERSION`, no `QUIZ_DEV_SEED_MODE`)
```text
PS C:\dev\hispanistica_games> Remove-Item Env:QUIZ_MECHANICS_VERSION -ErrorAction SilentlyContinue; Remove-Item Env:QUIZ_DEV_SEED_MODE -ErrorAction SilentlyContinue; .\scripts\dev-start.ps1 -UsePostgres
Database mode: PostgreSQL
Starting Hispanistica Games dev server...
AUTH_DATABASE_URL = postgresql+psycopg://hispanistica_auth:hispanistica_auth@127.0.0.1:54321/hispanistica_auth
QUIZ_MECHANICS_VERSION = v2 (default)
QUIZ_DEV_SEED_MODE = none (default)
...
Running quiz content pipeline...
  Seed mode: none
[SKIP] Quiz seeding skipped (QUIZ_DEV_SEED_MODE=none)
...
Starting Flask dev server at http://localhost:8002
```

### Test 2: DB report (PostgreSQL dialects)
```text
PS C:\dev\hispanistica_games> python manage.py quiz-db-report
[2026-01-30 12:02:31] INFO: Auth DB connection verified: postgresql+psycopg://hispanistica_auth:***@127.0.0.1:54321/hispanistica_auth
[2026-01-30 12:02:31] INFO: Quiz DB connection verified: postgresql+psycopg://hispanistica_auth:***@127.0.0.1:54321/hispanistica_auth
Quiz DB Report (read-only)
DB dialect: postgresql
```

### Test 3: Import/Publish flow (short evidence)
Source: [docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt](docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt)
```text
Command: python manage.py import-content --units-path media/current/units --audio-path media/current/audio --release release_20260130_120235_dev
[OK] Import successful
  Units: 1
  Questions: 18

Command: python manage.py publish-release --release release_20260130_120235_dev
[OK] Release 'release_20260130_120235_dev' published
  Units affected: 1
```

## Notes
- Phase 3b remains the authoritative reference for Postgres-only enforcement and release semantics: [docs/quiz/refactoring/refactoring_phase3b.md](docs/quiz/refactoring/refactoring_phase3b.md).
