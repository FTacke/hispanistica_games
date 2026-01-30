# Refactoring Phase 3b – Release Semantics, Dashboard Upload v2, Dev Flow, DB Report

Date: 2026-01-30

## Summary
- Follow-up defaults and dev-start changes are documented in [docs/quiz/refactoring/refactoring_phase3c.md](docs/quiz/refactoring/refactoring_phase3c.md).
- **Release import is UPSERT/merge** by `topic.id` and `question.id`, with **no delete** phase. Missing units are not removed. (Verified in code)
- **Publish/unpublish** toggles `quiz_content_releases.status` and timestamps only; unit visibility is still governed by `is_active`. (Verified in code)
- **Dashboard upload v2** now validates `quiz_unit_v1`/`quiz_unit_v2`, accepts `_v2.json`, allows audio optional, and can append to an existing release via optional `release_id`. (Verified in code)
- **Auth + Quiz DBs** are **PostgreSQL-only** in non-test environments; missing/SQLite URLs fail fast. (Verified in code)
- **Prod-like DEV flow script** runs against **PostgreSQL**, completes import/publish + incremental patch import, and writes a report (see Postgres run output).
- **Read-only DB report** command exists (`quiz-db-report`) and returns counts/releases on PostgreSQL (captured in report output).

## 1) Code Audit: Import/Publish/Release Semantics

### Where import writes
- Release tracking table: `quiz_content_releases` model in [game_modules/quiz/release_model.py](game_modules/quiz/release_model.py#L20-L35).
- Import is handled in [game_modules/quiz/import_service.py](game_modules/quiz/import_service.py#L212-L490).

### Import semantics (UPSERT / merge)
Evidence:
- Import is labeled as UPSERT and performs update-or-insert for topics/questions (no delete step). See [game_modules/quiz/import_service.py](game_modules/quiz/import_service.py#L345-L460).
- Topic UPSERT uses `QuizTopic.id` and updates `release_id` for touched units only: [game_modules/quiz/import_service.py](game_modules/quiz/import_service.py#L373-L399).
- Question UPSERT uses `QuizQuestion.id` and updates existing rows: [game_modules/quiz/import_service.py](game_modules/quiz/import_service.py#L429-L463).

**Explicit semantic statement (from code):**
> Import merges by `topic.id` and `question.id` (UPSERT). It does **not** delete missing units. A re-import updates only the units present in the import files and leaves others untouched.

### Publish semantics
- Publish marks the target release as `published` and unpublishes others (status and timestamps only): [game_modules/quiz/import_service.py](game_modules/quiz/import_service.py#L511-L579).
- Publish endpoint calls the service directly: [src/app/routes/quiz_admin.py](src/app/routes/quiz_admin.py#L198-L229).

## 2) Dashboard Upload v2 (Contract + Behavior)

### Endpoint + validation
- Upload endpoint: [src/app/routes/quiz_admin.py](src/app/routes/quiz_admin.py#L461-L640).
- Uses `validate_quiz_unit` (v1/v2 schema) before saving: [src/app/routes/quiz_admin.py](src/app/routes/quiz_admin.py#L480-L520).
- Validator enforces difficulty range (1–3) and 4/4/2 minimum counts: [game_modules/quiz/validation.py](game_modules/quiz/validation.py#L257-L267).

### `_v2.json` acceptance
- Filename is not validated; schema validation uses JSON content. Thus `_v2.json` filenames are accepted (slug is taken from JSON).

### Optional audio
- Upload accepts 0-n audio files; missing audio refs are reported but do not fail upload: [src/app/routes/quiz_admin.py](src/app/routes/quiz_admin.py#L560-L622).

### Upload to existing release
- Optional `release_id` is accepted and used; otherwise a new release is generated: [src/app/routes/quiz_admin.py](src/app/routes/quiz_admin.py#L544-L560).
- Upload writes only the single unit JSON and **does not delete other units** in that release.

## 3) DEV “Prod-like” Release Flow

### Script
- Script created: [scripts/dev_release_flow_v2.ps1](scripts/dev_release_flow_v2.ps1)
- Output log (Postgres run): [docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt](docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt)

### What it does
1. Sets `ENV=dev`, `QUIZ_MECHANICS_VERSION=v2`, `QUIZ_DEV_SEED_MODE=none`
2. Creates `media/releases/<release_id>/units` and `media/releases/<release_id>/audio`
3. Copies `variation_aussprache_v2.json` to `media/releases/<release_id>/units/variation_aussprache.json`
4. Creates `media/current` junction/symlink (junction used on Windows without admin)
5. Runs import, publish, and `quiz-db-report`, writing all outputs to the report file

### Evidence (Postgres dev run)
See [docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt](docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt). Key outcomes:
- `media/current` created as **junction** (Windows non-admin fallback).
- Auth DB dialect check returns **postgresql**.
- Quiz DB dialect check returns **postgresql**.
- Import completed (1 unit / 18 questions) and release created.
- Publish completed for `release_20260130_104355_dev`.
- Incremental patch import completed (same release) and publish completed again.
- Import log evidence shows **Updated release record** (UPSERT): `Updated release record: release_20260130_104355_dev`.
- `quiz-db-report` shows `DB dialect: postgresql` and expected counts.
- No Unicode/PowerShell errors in script output (ASCII CLI output + UTF-8 capture).

## 4) Incremental Import Test (Single Unit)

### Patch Unit
- Added patch file with same `slug` and IDs (only one explanation changed, with **bold** and *italic*):
  [content/quiz/topics/variation_aussprache_v2_patch.json](content/quiz/topics/variation_aussprache_v2_patch.json)

### Intended Steps
1. Copy patch file into `media/current/units/variation_aussprache.json`
2. Re-run import into **same release**
3. Publish again
4. Verify that other units are retained (merge behavior)

### Status
- **Verified in DEV (Postgres)** via incremental patch import + publish. Merge/replace behavior is confirmed both in code and in DB state.

### Evidence (patched explanation)
Verification via `scripts/verify_patch.py` (2026-01-30):
- `question_id=variation_aussprache_q_01KDT5WVTVXYEBZMKK9NWF7SNK`
- `explanation=Beim **seseo** werden die Laute /s/ und /θ/ gleich ausgesprochen, etwa casa und caza beide mit [s]; in Varietäten mit *distinción* bleibt der Unterschied erhalten.`

## 5) Server-Audit Extension: `quiz-db-report`

- New read-only command implemented in [manage.py](manage.py#L253-L331).
- Intended output:
  - counts: `quiz_topics`, `quiz_questions`, `quiz_content_releases`, `quiz_runs`, `quiz_scores`
  - published releases (ids + timestamps)
  - “current” release id = first published release

### Local DEV Result (Postgres)
- `Auth DB dialect: postgresql`, `Quiz DB dialect: postgresql`, and counts printed. Full output captured in [docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt](docs/quiz/refactoring/dev_release_flow_report_phase3b_1.txt).

## 6) Dashboard Upload Contract (Doc/Single Source of Truth)

- Updated in [docs/quiz/OPERATIONS.md](docs/quiz/OPERATIONS.md#L114-L240) to document release layout, current link, import semantics, and dashboard upload behavior.

## What is now verified
- Import uses UPSERT and **does not delete** missing units (code audit).
- Publish/unpublish updates `quiz_content_releases.status` and timestamps (code audit).
- Dashboard upload uses v1/v2 validator and supports optional audio + optional `release_id` (code audit).
- Prod-like release layout and `media/current` linking are scripted and reproducible in DEV (script + output log).
- Incremental patch import (same release) updates the unit without deleting others (Postgres run + DB check).
- `quiz-db-report` produces counts and release summary on Postgres.
- Auth DB is enforced as PostgreSQL in non-test environments (fail-fast if missing/SQLite).

## What is still unknown / requires Phase 4
- Whether any legacy docs or scripts still assume delete/rebuild semantics.

## Risks / TODOs for Phase 4
- Consider if any admin/maintenance scripts still default to SQLite for auth DB; align with Postgres-only requirement where applicable.

## How to run (DEV)
```powershell
# 1) Run prod-like dev flow (creates release + current link + import/publish/report)
./scripts/dev_release_flow_v2.ps1

# 2) Try DB report (requires Postgres-backed QUIZ_DB_* or QUIZ_DATABASE_URL)
python manage.py quiz-db-report

# 3) Incremental test (manual)
Copy-Item content/quiz/topics/variation_aussprache_v2_patch.json media/current/units/variation_aussprache.json -Force
python manage.py import-content --units-path media/current/units --audio-path media/current/audio --release <release_id>
```
