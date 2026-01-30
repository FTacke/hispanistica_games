# Refactoring Phase 3e — dev-start default Postgres + smoke test + DEV admin

## Motivation
- Ein Weg: `dev-start` ohne Flags soll immer den DEV Postgres-Stack starten.
- DEV-only Admin für schnelle Tests (`admin_dev/0000`).
- Smoke-Test belegt Erreichbarkeit der App.

## Changes (file + line)
- scripts/dev-start.ps1 (Postgres default + deprecated flag + smoke check): lines 31, 206
- manage.py (CLI `ensure-dev-admin`): line 268
- docs/quiz/OPERATIONS.md (start command + dev admin note): lines 18, 23
- startme.md (DEV login updated): line 34

## Evidence

### Run 1: dev-start ohne Parameter
```powershell
Remove-Item Env:QUIZ_MECHANICS_VERSION -ErrorAction SilentlyContinue
Remove-Item Env:QUIZ_DEV_SEED_MODE -ErrorAction SilentlyContinue
.\scripts\dev-start.ps1
```
**Output (excerpt):**
```
Database mode: PostgreSQL
Starting Hispanistica Games dev server...
AUTH_DATABASE_URL = postgresql+psycopg:*****@127.0.0.1:54321/hispanistica_auth
QUIZ_DATABASE_URL = postgresql+psycopg:*****@127.0.0.1:54322/hispanistica_quiz
QUIZ_MECHANICS_VERSION = v2 (default)
QUIZ_DEV_SEED_MODE = none (default)
Docker PostgreSQL already running.
...
[OK] ensured dev admin: admin_dev
[OK] DEV admin ensured
...
Starting Flask dev server at http://localhost:8001
Login: admin_dev / 0000
...
127.0.0.1 - - [30/Jan/2026 14:58:54] "GET /health HTTP/1.1" 200 -
[OK] Smoke check: http://127.0.0.1:8001/health
```

### Run 2: DB Report
```powershell
python manage.py quiz-db-report
```
**Output:**
```
[2026-01-30 14:59:23] INFO: Auth DB connection verified: postgresql+psycopg://hispanistica_auth:***@127.0.0.1:54321/hispanistica_auth
[2026-01-30 14:59:23] INFO: Quiz DB connection verified: postgresql+psycopg://hispanistica_quiz:***@127.0.0.1:54322/hispanistica_quiz
Quiz DB Report (read-only)
DB dialect: postgresql
==============================
Counts:
  quiz_topics: 1
  quiz_questions: 18
  quiz_content_releases: 0
  quiz_runs: 1
  quiz_scores: 0

Published Releases:
  (none)

Current release id: None
```

### Run 2b: DB Report (with required env vars)
```powershell
$env:AUTH_DATABASE_URL = "postgresql+psycopg://hispanistica_auth:hispanistica_auth@127.0.0.1:54321/hispanistica_auth"
$env:QUIZ_DATABASE_URL = "postgresql+psycopg://hispanistica_quiz:hispanistica_quiz@127.0.0.1:54322/hispanistica_quiz"
$env:FLASK_SECRET_KEY = "dev-secret-change-me"
python manage.py quiz-db-report
```
**Output:**
```
[2026-01-30 15:15:26] INFO: Auth DB connection verified: postgresql+psycopg://hispanistica_auth:***@127.0.0.1:54321/hispanistica_auth
[2026-01-30 15:15:26] INFO: Quiz DB connection verified: postgresql+psycopg://hispanistica_quiz:***@127.0.0.1:54322/hispanistica_quiz
Quiz DB Report (read-only)
DB dialect: postgresql
==============================
Counts:
  quiz_topics: 1
  quiz_questions: 18
  quiz_content_releases: 0
  quiz_runs: 1
  quiz_scores: 0

Published Releases:
  (none)

Current release id: None
```

### Run 3: Smoke request
```powershell
curl http://127.0.0.1:8000/api/quiz/topics
```
**Output (excerpt):**
```
{"topics":[{"authors":["Frederike Lau","Mika","Karina Stephan Quezada","Felix Tacke (Koordination)"],"based_on":{"chapter_title":"Variation in der Aussprache","chapter_url":"https://school.hispanistica.com/variation/variation_aussprache/","course_title":"Spanische Linguistik @ School","course_url":null},"description":"Hier geht es um Aussprachevariation im Spanischen. Im Fokus stehen regionale Unterschiede sowie zentrale Phänomene wie Distinción, Seseo und Yeísmo und deren Bedeutung für die Wahrnehmung gesprochener Varietäten.","description_key":"Hier geht es um Aussprachevariation im Spanischen. Im Fokus stehen regionale Unterschiede sowie zentrale Phänomene wie Distinción, Seseo und Yeísmo und deren Bedeutung für die Wahrnehmung gesprochener Varietäten.","href":"/games/quiz/variation_aussprache","title_key":"Variation in der Aussprache","topic_id":"variation_aussprache"}]}
```

### Run 4: Admin proof (DEV-only)
```
[OK] ensured dev admin: admin_dev
```

## Notes
- `-UsePostgres` ist jetzt deprecated (Postgres ist Default).
- DEV admin provisioning läuft nur bei `ENV=dev`.
