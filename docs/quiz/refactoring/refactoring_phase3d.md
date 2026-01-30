# Refactoring Phase 3d — DEV: Separate Quiz Postgres + Defaults + Guard

## Problem
DEV used a single Postgres instance (Auth only). Quiz defaults pointed to the auth DB, so “Quiz DB != Auth DB” was not satisfiable and quiz data could land in auth.

## Fix Summary
- **DEV Compose** now starts **two Postgres services**:
  - `hispanistica_auth_db` on port **54321** with volume `data/db/postgres_dev_auth`
  - `hispanistica_quiz_db` on port **54322** with volume `data/db/postgres_dev_quiz`
- **Defaults**:
  - `scripts/dev-start.ps1 -UsePostgres` sets `AUTH_DATABASE_URL` → auth DB and `QUIZ_DATABASE_URL` → quiz DB.
  - `scripts/dev_release_flow_v2.ps1` sets the same defaults (or honors existing values).
- **Guard**: in non-test environments, quiz DB cannot point to auth DB (fail-fast).

## Evidence (commands + outputs)

> Note: Outputs should be captured by running the commands below in the repo root.

### 1) Start dev-postgres (two DBs)
```powershell
docker compose -f docker-compose.dev-postgres.yml up -d
```
**Output:**
```
[+] Running 2/2
 ✔ Container hispanistica_auth_db  Running                                                                                                        0.0s 
 ✔ Container hispanistica_quiz_db  Running                                                                                                        0.0s 
```

### 2) Verify both containers are up
```powershell
docker ps
```
**Output:**
```
CONTAINER ID   IMAGE          COMMAND                  CREATED         STATUS                    PORTS                                           NAMES
cb21c01c8682   postgres:15    "docker-entrypoint.s…"   7 minutes ago   Up 7 minutes (healthy)    0.0.0.0:54321->5432/tcp, [::]:54321->5432/tcp   hispanistica_auth_db
63697136b768   postgres:15    "docker-entrypoint.s…"   7 minutes ago   Up 7 minutes (healthy)    0.0.0.0:54322->5432/tcp, [::]:54322->5432/tcp   hispanistica_quiz_db
```

### 3) Verify DB targets
```powershell
python manage.py quiz-db-report
```
**Output:**
```
[2026-01-30 14:42:10] INFO: Auth DB connection verified: postgresql+psycopg://hispanistica_auth:***@127.0.0.1:54321/hispanistica_auth
[2026-01-30 14:42:10] INFO: Quiz DB connection verified: postgresql+psycopg://hispanistica_quiz:***@127.0.0.1:54322/hispanistica_quiz
[2026-01-30 14:42:10] INFO: games_hispanistica application startup
Quiz DB Report (read-only)
DB dialect: postgresql
==============================
Counts:
  quiz_topics: 0
  quiz_questions: 0
  quiz_content_releases: 0
  quiz_runs: 0
  quiz_scores: 0

Published Releases:
  (none)

Current release id: None
```
Expected: Auth + Quiz both **postgresql**, different **host/port/db**.

### 4) Dev start works without ENV
```powershell
.\scripts\dev-start.ps1 -UsePostgres
```
**Output:**
```
Database mode: PostgreSQL
Starting Hispanistica Games dev server...
AUTH_DATABASE_URL = postgresql+psycopg:*****@127.0.0.1:54321/hispanistica_auth
QUIZ_DATABASE_URL = postgresql+psycopg:*****@127.0.0.1:54322/hispanistica_quiz
QUIZ_MECHANICS_VERSION = v2 (default)
QUIZ_DEV_SEED_MODE = none (default)
Docker PostgreSQL already running.
Activating Python virtual environment...

Ensuring Quiz DB schema...
Initializing Quiz database (PostgreSQL)...
URL: 127.0.0.1:54322/hispanistica_quiz
[OK] Quiz database tables initialized.

[OK] Quiz module initialization complete.
[OK] Quiz DB schema ready

Applying DEV-only quiz migrations...
[2026-01-30 14:40:27] INFO: Quiz DEV migration runner starting...
[2026-01-30 14:40:28] INFO: Applying migration: C:\dev\hispanistica_games\migrations\0012_add_server_based_timer.sql
[2026-01-30 14:40:28] INFO: ✓ Migration applied (idempotent)
[OK] Quiz DEV migrations applied


Running quiz content pipeline...
  Seed mode: none
[SKIP] Quiz seeding skipped (QUIZ_DEV_SEED_MODE=none)
[OK] Quiz content ready

Starting Flask dev server at http://localhost:8000
Login: admin / change-me

[2026-01-30 14:40:30,632] INFO in __init__: Auth DB connection verified: postgresql+psycopg://hispanistica_auth:***@127.0.0.1:54321/hispanistica_auth
[2026-01-30 14:40:30,673] INFO in __init__: Quiz DB connection verified: postgresql+psycopg://hispanistica_quiz:***@127.0.0.1:54322/hispanistica_quiz
 * Serving Flask app 'src.app'
 * Debug mode: off
WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:8000
 * Running on http://192.168.2.33:8000
Press CTRL+C to quit
```

### 5) Optional release flow evidence
```powershell
.\scripts\dev_release_flow_v2.ps1
```
**Output:**
```
<capture output here>
```

## Files Updated
- docker-compose.dev-postgres.yml
- scripts/dev-start.ps1
- scripts/dev_release_flow_v2.ps1
- src/app/extensions/sqlalchemy_ext.py
- docs/quiz/OPERATIONS.md
- docs/components/quiz/OPERATIONS.md
