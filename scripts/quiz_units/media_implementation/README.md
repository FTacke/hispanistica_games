# Quiz Media Implementation Notes

This directory documents the legacy quiz import and media-processing code that existed outside `scripts/quiz_units` before cleanup.

## Goal

Preserve the implementation knowledge for a future reimplementation without keeping the old production and dev import stack alive in the main app.

## Legacy Implementation Overview

There were two separate legacy flows:

1. DEV seed flow
- Purpose: read quiz JSON units directly from `content/quiz/topics`, validate them, copy referenced media files into `static/quiz-media`, then upsert quiz topics/questions into the database.
- Main code:
  - `game_modules/quiz/seed.py`
  - `scripts/quiz_seed.py`
  - `scripts/quiz_seed_single.py`

2. Release/import flow
- Purpose: upload or rsync unit JSON files plus audio files into `media/releases/<release_id>/`, then import them into the database with release tracking and optional publish/unpublish state.
- Main code:
  - `src/app/routes/quiz_admin.py`
  - `game_modules/quiz/import_service.py`
  - `game_modules/quiz/release_model.py`
  - `manage.py` commands `import-content`, `publish-release`, `unpublish-release`, `list-releases`
  - `scripts/release_deploy.py`
  - `src/app/services/content_release.py`
  - `scripts/content_release/*`

## Detailed Behavior

### 1. DEV seed flow

#### Entry points
- `scripts/quiz_seed.py`
  - optional normalize step
  - bulk seed all units from `content/quiz/topics`
  - optional soft/hard prune of removed topics
- `scripts/quiz_seed_single.py`
  - seed exactly one unit JSON file

#### Core media handling in `game_modules/quiz/seed.py`

Important functions:
- `compute_file_hash(file_path)`
  - SHA256 of a source or target media file.
- `copy_media_file(seed_src, json_dir, slug, question_id, media_id, answer_id=None, project_root=None)`
  - resolves `seed_src` relative to the JSON file
  - validates allowed extension
  - builds target path under `static/quiz-media/<slug>/<question_id>/`
  - names files as either `<media_id>.<ext>` or `<answer_id>_<media_id>.<ext>`
  - compares hashes if target already exists
  - raises on content mismatch instead of silently overwriting
  - returns final public URL like `/static/quiz-media/<slug>/<question_id>/<filename>`
- `process_media_for_question(question, json_dir, slug, project_root=None)`
  - processes question-level media
  - processes answer-level media
  - returns transformed media JSON structures plus copied file count
- `import_quiz_unit(session, unit, json_path=None, project_root=None)`
  - uses `process_media_for_question`
  - writes final media URLs into question/answer JSON payloads stored in DB
- `seed_quiz_units(session, units_dir=None)`
  - bulk import of all JSON units

#### DEV seed media contract
- Input media references use `seed_src`.
- `seed_src` is treated as path relative to the JSON file location.
- Files are physically copied into `static/quiz-media`.
- Database stores final `src` URLs after copy.

### 2. Release/import flow

#### Upload stage in `src/app/routes/quiz_admin.py`

Important behavior:
- `POST /quiz-admin/api/upload-unit`
  - accepts one JSON file plus optional `media_files[]`
  - validates JSON with `validate_quiz_unit`
  - extracts audio refs from question/answer media entries with `type == audio` and `seed_src`
  - creates `media/releases/<release_id>/units/` and `media/releases/<release_id>/audio/`
  - writes `<slug>.json` into `units/`
  - writes uploaded media files into `audio/`
  - stores a release record in the DB
  - missing referenced media files are reported but do not fail upload

The upload route did not import content into the quiz DB yet. It only staged files for a later import step.

#### Import stage in `game_modules/quiz/import_service.py`

Important functions and behavior:
- `_validate_unit_file(json_path)`
  - parses JSON and runs `validate_quiz_unit`
- `_collect_audio_refs(unit)`
  - traverses question-level and answer-level media
  - collects `seed_src` values for audio entries
- `_compute_audio_hash(audio_path)`
  - SHA256 for uploaded audio files
- `import_release(session, units_path, audio_path, release_id, dry_run=False, request_id=None)`
  - validates all unit JSON files
  - checks filename matches slug
  - checks that every referenced audio filename exists in the release audio directory
  - computes hashes for unique audio files
  - upserts topics and questions into DB
  - stores media in DB using `m.src or m.seed_src`
  - creates or updates `quiz_content_releases`
  - writes detailed import logs under `data/import_logs`
- `publish_release(...)` / `unpublish_release(...)`
  - changed release status metadata only
  - counted units by `QuizTopic.release_id`
- `list_releases(...)`
  - listed release metadata for dashboard UI

#### Release/import media contract
- Files live in `media/releases/<release_id>/audio/`.
- JSON files live in `media/releases/<release_id>/units/`.
- Audio validation only used the filename part of `seed_src`:
  - `Path(ref).name`
  - then looked for that filename inside the release audio directory
- Unlike the DEV seed flow, this path did not copy media into `static/quiz-media`.
- It kept media references inside DB payloads as `src` or unresolved `seed_src` values.

### 3. Remote deployment flow

These scripts wrapped the release/import workflow but were not themselves the media-processing core:
- `src/app/services/content_release.py`
- `scripts/release_deploy.py`
- `scripts/content_release/*`
- `scripts/dev_release_flow_v2.ps1`

Their role was:
- validate local release directories
- rsync to server
- switch `current` symlink
- trigger `manage.py import-content` or older seed steps remotely

## Files That Contained The Useful Implementation

Primary logic files:
- `game_modules/quiz/seed.py`
- `game_modules/quiz/import_service.py`
- `src/app/routes/quiz_admin.py`
- `game_modules/quiz/validation.py`

Supporting orchestration files:
- `scripts/quiz_seed.py`
- `scripts/quiz_seed_single.py`
- `manage.py`
- `scripts/release_deploy.py`
- `src/app/services/content_release.py`
- `scripts/content_release/sync_release.ps1`

## Recommended Extraction For Reimplementation

If this is rebuilt later, the reusable ideas worth carrying over are:

1. Validation before persistence
- reuse the structure of `validate_quiz_unit`
- reject malformed units before filesystem or DB writes

2. Explicit media traversal
- question media and answer media must be traversed separately
- only media entries with `type == audio` and a non-empty source reference are relevant for audio import

3. Deterministic media normalization
- resolve every media input into one canonical stored form
- do not mix `seed_src` and final `src` in long-term persisted records

4. Separation of concerns
- staging upload
- media validation/copy
- DB import/upsert
- publish/visibility
should be separate steps or separate modules

5. Conflict-safe copy logic
- hash comparison before overwrite is the safest part of the old DEV flow
- that behavior is worth reusing if physical media copies return in the future

## Important Caveats From The Legacy Stack

1. Two competing implementations existed.
- DEV seed copied files into `static/quiz-media`.
- Release import validated audio files from `media/releases/...` but did not normalize them the same way.

2. Media persistence semantics were inconsistent.
- Sometimes final DB payloads contained final URLs.
- Sometimes they still contained unresolved `seed_src` values.

3. Release tracking complicated the model.
- `release_id` on topics/questions plus `quiz_content_releases` added operational state that was not necessary for the quiz game itself.

4. Deployment logic was spread across app code, scripts and docs.
- This made it hard to know which path was canonical.

## Cleanup Intent

After this documentation was written, the old import/release/seed implementations outside `scripts/quiz_units` were removed from the active app codebase to leave `scripts/quiz_units` as the only surviving quiz-unit tooling area.
