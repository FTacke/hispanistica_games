# Refactoring Phase 3c – Robust Uploads/Imports/Release/Publish + Infra

Date: 2026-01-30

## Summary (What changed)
- **Fail-fast media guard** on app startup: `/app/media` must be writable; required directories are created idempotently. See [src/app/__init__.py](src/app/__init__.py).
- **Container startup guard**: write-test and auto-create `/app/media/quiz` + `/app/media/releases` with optional UID/GID ownership. See [scripts/docker-entrypoint.sh](scripts/docker-entrypoint.sh).
- **Media mounts now RW** and release directories are mounted. See [docker-compose.yml](docker-compose.yml), [infra/docker-compose.dev.yml](infra/docker-compose.dev.yml), [infra/docker-compose.prod.yml](infra/docker-compose.prod.yml).
- **Nginx upload limits/timeouts** set to support large uploads. See [infra/nginx/games_hispanistica.conf.template](infra/nginx/games_hispanistica.conf.template).
- **Observability**: upload/import now logs request ID, release ID, unit slug, write path and file sizes. See [src/app/routes/quiz_admin.py](src/app/routes/quiz_admin.py) and [game_modules/quiz/import_service.py](game_modules/quiz/import_service.py).
- **Release import semantics test** (UPSERT/merge; no deletions) added. See [tests/test_quiz_release_import.py](tests/test_quiz_release_import.py).

## A) Startup Guards / Init (Media Path)
**Behavior**
- `/app/media` must be writable or startup fails.
- Directories created idempotently: `/app/media/quiz`, `/app/media/releases`.
- Ownership can be enforced via environment variables `MEDIA_UID` and `MEDIA_GID` at container start.
- Media path can be overridden via `MEDIA_ROOT` (app config + entrypoint).

**Implementation**
- App-level guard: [src/app/__init__.py](src/app/__init__.py)
- Container guard: [scripts/docker-entrypoint.sh](scripts/docker-entrypoint.sh)

## B) Docker / Compose / Deployment
**Mounts now RW (no :ro for media)**
- [docker-compose.yml](docker-compose.yml)
- [infra/docker-compose.dev.yml](infra/docker-compose.dev.yml)
- [infra/docker-compose.prod.yml](infra/docker-compose.prod.yml)

**Release directories are mounted**
- `/app/media/quiz`
- `/app/media/releases`

**Host dir creation script (deploy)**
- [scripts/ops/ensure_media_dirs.sh](scripts/ops/ensure_media_dirs.sh)

## C) Nginx / Reverse Proxy
**Configured for large uploads**
- `client_max_body_size 200m`
- `proxy_read_timeout 300s`
- `proxy_send_timeout 300s`
- `send_timeout 300s`

See [infra/nginx/games_hispanistica.conf.template](infra/nginx/games_hispanistica.conf.template).

## D) Release Semantics (UPSERT/Merge) + Test
**Semantics**
- Import is **UPSERT/merge** by topic/question IDs; **no delete** step.
- Re-importing a unit updates the existing row, and units not present in the import are preserved.

**Integration test**
- Test: [tests/test_quiz_release_import.py](tests/test_quiz_release_import.py)
- Behavior verified:
  - Import Unit A into Release R.
  - Import Unit B into Release R (Unit A file absent) → Unit A remains.
  - Re-import Unit A with changed title → title updates; Unit B remains.

## E) Observability (Logs + Request IDs)
**Upload logging**
- Includes `request_id`, `release_id`, `slug`, write paths, and file sizes.
- See [src/app/routes/quiz_admin.py](src/app/routes/quiz_admin.py).

**Import logging**
- Log files now include `request_id` in filename.
- Log line includes `Request ID: <id>` at start of import/publish/unpublish.
- See [game_modules/quiz/import_service.py](game_modules/quiz/import_service.py).

**Log retrieval**
- Admin API can filter logs by `request_id` query param.
- See [src/app/routes/quiz_admin.py](src/app/routes/quiz_admin.py).

---

## Evidence (Commands, Outputs, Logs)

### 1) Media directory preparation (server)
Command:
```
MEDIA_ROOT=/srv/webapps/games_hispanistica/media MEDIA_UID=1000 MEDIA_GID=1000 \
  ./scripts/ops/ensure_media_dirs.sh
```
Expected output:
```
Media directories ensured under: /srv/webapps/games_hispanistica/media
Setting ownership to 1000:1000
Done.
```

### 2) Nginx config validation
Command:
```
nginx -T | sed -n '/games_hispanistica/,/server {/p'
```
Expected output (excerpt):
```
client_max_body_size 200m;
proxy_read_timeout 300s;
proxy_send_timeout 300s;
send_timeout 300s;
```

### 3) Import log (existing evidence)
Source: [data/import_logs/20260130_120238_import_release_20260130_120235_dev.log](data/import_logs/20260130_120238_import_release_20260130_120235_dev.log)

Excerpt:
```
[2026-01-30 12:02:38] INFO: Starting import for release 'release_20260130_120235_dev'
[2026-01-30 12:02:38] INFO: Units path: media/current/units
[2026-01-30 12:02:38] INFO: Audio path: media/current/audio
[2026-01-30 12:02:38] INFO: [OK] variation_aussprache.json: 18 questions, 0 audio refs
[2026-01-30 12:02:38] INFO: [OK] Imported variation_aussprache: 18 questions
[2026-01-30 12:02:38] INFO: [OK] Import completed successfully
```

### 4) Release import semantics test
Command:
```
pytest tests/test_quiz_release_import.py -q
```
Expected output:
```
1 passed
```

---

## Notes
- Upload/import robustness now depends on RW mounts for `/app/media` and the presence of `/app/media/quiz` and `/app/media/releases`.
- If uploads fail with 413 or 504, confirm Nginx config from [infra/nginx/games_hispanistica.conf.template](infra/nginx/games_hispanistica.conf.template) is deployed and `nginx -T` reflects the new values.
