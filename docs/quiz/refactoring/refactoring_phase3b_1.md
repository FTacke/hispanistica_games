# Refactoring Phase 3b.1 – DEV Postgres Enforcement + Incremental Import Proof

Date: 2026-01-30

## Summary
- **DEV scripts now enforce Postgres** for quiz DB and abort on sqlite/failed Docker.
- **Quiz DB is separated from Auth DB** via `QUIZ_DB_*` / `QUIZ_DATABASE_URL` and dedicated quiz engine/session.
- **Incremental import proof not completed** because Docker/Postgres was unavailable (documented with report output).

---

## 1) Root Cause (Phase 3b)
- `manage.py` and Dashboard endpoints used the **auth** DB engine, which defaulted to **SQLite** in DEV.
- Quiz schema is PostgreSQL-only; thus SQLite failed on ARRAY/JSONB and missing columns.

---

## 2) Changes Implemented

### Quiz DB engine (separate from Auth)
- New quiz engine and session: [src/app/extensions/sqlalchemy_ext.py](src/app/extensions/sqlalchemy_ext.py)
- App init now verifies quiz DB separately: [src/app/__init__.py](src/app/__init__.py)
- Quiz routes and admin endpoints now use quiz DB session:
  - [game_modules/quiz/routes.py](game_modules/quiz/routes.py)
  - [src/app/routes/quiz_admin.py](src/app/routes/quiz_admin.py)

### CLI commands use quiz DB
- `import-content`, `publish-release`, `quiz-db-report` now use quiz session:
  [manage.py](manage.py)

### `quiz-db-report` hardened
- Logs DB dialect and **fails fast on sqlite**.
- `--minimal` option added to skip run/score counts when needed.

### DEV flow script hardened
- `scripts/dev_release_flow_v2.ps1` now:
  - sets/uses `QUIZ_DB_*` and `QUIZ_DATABASE_URL`
  - checks dialect and **aborts on sqlite**
  - optionally runs `docker compose -f docker-compose.dev-postgres.yml up -d`
  - initializes quiz schema via `scripts/init_quiz_db.py`
  - performs incremental import + publish
  - writes report to `dev_release_flow_report_phase3b_1.txt`

---

## 3) Evidence – Dev Flow Run (Postgres Enforcement)

Report file (includes docker failure):
- [docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt](docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt)

Key excerpt:
- Docker compose failed because Docker Desktop is not running → **script aborted** before any import.

---

## 4) Incremental Import Proof – Status

**Not completed** in this environment because Postgres was unreachable.

**Blocker:** Docker/Postgres not available on this machine at run time.

---

## 5) How to run (DEV)
```powershell
# 1) Start Docker Desktop (required)

# 2) Run dev flow with Postgres enforcement
./scripts/dev_release_flow_v2.ps1 -StartDocker

# 3) If you want only the report (no docker start), ensure QUIZ_DB_* are set and Postgres is reachable
$env:QUIZ_DB_HOST="localhost"
$env:QUIZ_DB_PORT="54321"
$env:QUIZ_DB_USER="hispanistica_auth"
$env:QUIZ_DB_PASSWORD="hispanistica_auth"
$env:QUIZ_DB_NAME="hispanistica_auth"
./scripts/dev_release_flow_v2.ps1
```

---

## What is verified
- Quiz DB enforcement exists and **prevents sqlite**.
- Quiz routes and admin endpoints use the quiz DB session.
- CLI commands target quiz DB (not auth DB).

## What is still missing
- Incremental import **proof on Postgres** (must be re-run with Docker/Postgres available).

## Next Step
- Start Docker Desktop, re-run `./scripts/dev_release_flow_v2.ps1 -StartDocker` and capture the report output.
