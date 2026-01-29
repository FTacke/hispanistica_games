# Quiz Component – Admin Import Guide

**Target Audience:** System administrators, DevOps engineers  
**Purpose:** Complete guide to Quiz content import and release management

---

## Overview

Quiz content is managed through a **Release-based workflow**:
1. **Import** – Load JSON units into database (status: `draft`)
2. **Publish** – Make release visible to users (status: `published`)
3. **Unpublish** – Hide release (rollback) (status: `unpublished`)

Only **one release can be published at a time**.

---

## Authentication

All admin endpoints require:
- **JWT token** (from webapp login)
- **Role:** `ADMIN`

**Deprecated:** `QUIZ_ADMIN_KEY` environment variable (removed, no longer used).

---

## Import Methods

### Method 1: Admin Dashboard (Recommended)

**URL:** `https://games.hispanistica.de/quiz-admin/`

**Steps:**
1. Log in with admin credentials
2. Navigate to **Quiz Content** section
3. Click **"Import Release"**
4. Select release directory from server filesystem
5. Click **"Import"** → Status shows `draft`
6. Review imported units
7. Click **"Publish Release"** → Status changes to `published`

**Advantages:**
- Visual feedback
- Validation errors shown in UI
- No SSH access required

### Method 2: CLI (Server SSH)

```bash
# Import release
./manage import-content \
  --units-path media/releases/<release_id>/units \
  --audio-path media/releases/<release_id>/audio \
  --release <release_id>

# Publish release
./manage publish-release --release <release_id>

# Unpublish (rollback)
./manage unpublish-release --release <release_id>
```

**Advantages:**
- Scriptable
- Better for CI/CD
- Exit codes for automation

---

## API Endpoints

### List Releases

```http
GET /quiz-admin/api/releases
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "items": [
    {
      "release_id": "release_20260106_1430_a7x2",
      "status": "published",
      "units_count": 7,
      "questions_count": 142,
      "audio_count": 89,
      "imported_at": "2026-01-06T14:32:15Z",
      "published_at": "2026-01-06T15:00:00Z"
    }
  ]
}
```

### Get Release Details

```http
GET /quiz-admin/api/releases/<release_id>
Authorization: Bearer <jwt_token>
```

### Import Release

```http
POST /quiz-admin/api/releases/<release_id>/import
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "units_path": "media/releases/<release_id>/units",
  "audio_path": "media/releases/<release_id>/audio"
}
```

**Response (Success):**
```json
{
  "ok": true,
  "units_imported": 7,
  "questions_imported": 142,
  "audio_files_processed": 89,
  "warnings": [],
  "import_log": "data/import_logs/release_20260106_1430_a7x2_1673012735.log"
}
```

**Response (Error):**
```json
{
  "ok": false,
  "errors": [
    "Validation error in aussprache.json: Missing 'slug' field",
    "Audio file not found: test_quiz.media/q01_audio_1.mp3"
  ]
}
```

### Publish Release

```http
POST /quiz-admin/api/releases/<release_id>/publish
Authorization: Bearer <jwt_token>
```

**Effect:**
- Sets `status='published'` for release
- Sets `is_active=true` for all topics/questions in release
- **Auto-unpublishes previous release** (only one published at a time)

**Response:**
```json
{
  "ok": true,
  "units_affected": 7,
  "previous_release_unpublished": "release_20260105_1200_b3y4"
}
```

### Unpublish Release

```http
POST /quiz-admin/api/releases/<release_id>/unpublish
Authorization: Bearer <jwt_token>
```

**Effect:**
- Sets `status='unpublished'` for release
- Sets `is_active=false` for all topics/questions in release

---

## Import Process Details

### Step 1: Validation

For each JSON file in `units_path`:
1. **Schema Validation** – Check against `quiz_unit_v1` or `quiz_unit_v2` schema
2. **Content Validation**:
   - `slug` matches filename (e.g., `aussprache.json` → `slug: "aussprache"`)
   - Exactly one correct answer per question
   - All media files exist in `audio_path`
   - Question IDs are ULID format (if present)
3. **Duplicate Check** – No duplicate question IDs across units

### Step 2: Audio Processing

For each media file referenced in JSON:
1. Calculate SHA256 hash
2. Copy to `static/quiz-media/<topic_slug>.media/<filename>`
3. Store hash in database (for idempotency)

### Step 3: Database Upsert

```sql
-- Topics: UPSERT by topic_id (slug)
INSERT INTO quiz_topics (id, title_key, description_key, authors, is_active, release_id, ...)
VALUES (...)
ON CONFLICT (id) DO UPDATE SET ...;

-- Questions: UPSERT by question_id
INSERT INTO quiz_questions (id, topic_id, difficulty, prompt_key, answers, media, release_id, ...)
VALUES (...)
ON CONFLICT (id) DO UPDATE SET ...;
```

**Idempotent:** Multiple imports of same release → same result (no duplicates).

### Step 4: Release Tracking

```sql
-- Create or update release record
INSERT INTO quiz_content_releases (release_id, status, units_count, questions_count, audio_count, imported_at, ...)
VALUES (...)
ON CONFLICT (release_id) DO UPDATE SET ...;
```

---

## Expected JSON Format

See [CONTENT.md](CONTENT.md) for full specification.

**Minimal Example:**
```json
{
  "schema_version": "quiz_unit_v2",
  "slug": "my_topic",
  "title": "My Quiz Topic",
  "description": "A short description of the quiz.",
  "authors": ["Author Name"],
  "is_active": true,
  "order_index": 0,
  "questions_statistics": {
    "1": 2,
    "2": 2
  },
  "questions": [
    {
      "id": "my_topic_q_01KE59P9SVXJF4WMBPGHSJXDK6",
      "difficulty": 1,
      "type": "single_choice",
      "prompt": "What is the correct answer?",
      "explanation": "This is the explanation after the answer.",
      "media": [],
      "answers": [
        {"id": "a1", "text": "Correct answer", "correct": true, "media": []},
        {"id": "a2", "text": "Wrong answer 1", "correct": false, "media": []},
        {"id": "a3", "text": "Wrong answer 2", "correct": false, "media": []},
        {"id": "a4", "text": "Wrong answer 3", "correct": false, "media": []}
      ],
      "sources": [],
      "meta": {}
    }
  ]
}
```

---

## Error Handling

### Validation Errors

**Error:** `Missing required field 'slug'`  
**Fix:** Add `"slug": "topic_name"` to JSON root

**Error:** `slug 'my-topic' does not match pattern [a-z0-9_]+`  
**Fix:** Use lowercase letters, numbers, underscores only (no hyphens)

**Error:** `Question has multiple correct answers`  
**Fix:** Ensure exactly one answer has `"correct": true`

**Error:** `Audio file not found: my_topic.media/audio.mp3`  
**Fix:** Check `audio_path` contains the referenced file

### Filesystem Errors

**Error:** `units_path not found: media/releases/xxx/units`  
**Fix:** Ensure release directory uploaded via rsync

**Error:** `Permission denied: static/quiz-media/`  
**Fix:** Check directory permissions (`chmod 755 static/quiz-media`)

### Database Errors

**Error:** `duplicate key value violates unique constraint "quiz_topics_pkey"`  
**Fix:** Topic already exists with different content. Use UPSERT (import handles this automatically).

---

## Import Logs

All imports are logged to: `data/import_logs/<release_id>_<timestamp>.log`

**Log Contents:**
- Timestamp
- Release ID
- Units processed
- Questions imported
- Audio files copied
- Validation errors
- Warnings

**Example:**
```
[2026-01-06 14:32:15] INFO: Starting import for release: release_20260106_1430_a7x2
[2026-01-06 14:32:16] INFO: Validating 7 units...
[2026-01-06 14:32:17] INFO: Unit 'aussprache': 21 questions, 15 audio files
[2026-01-06 14:32:18] WARNING: Unit 'test_quiz': Question q01 missing 'sources' field (non-critical)
[2026-01-06 14:32:20] INFO: Import complete: 7 units, 142 questions, 89 audio files
```

---

## Production Workflow

### Full Deployment

```bash
# 1. Prepare release locally (outside repo)
cd C:\content\games_hispanistica\
mkdir 2026-01-06_1430
cd 2026-01-06_1430
mkdir units audio

# 2. Normalize JSON (generate IDs, statistics)
python scripts/quiz_units_normalize.py --write --topics-dir C:\content\games_hispanistica\2026-01-06_1430\units

# 3. Upload to server
rsync -avz C:\content\games_hispanistica\2026-01-06_1430\ user@server:/srv/webapps/games_hispanistica/media/releases/2026-01-06_1430/

# 4. SSH to server
ssh user@server

# 5. Import
cd /srv/webapps/games_hispanistica
./manage import-content \
  --units-path media/releases/2026-01-06_1430/units \
  --audio-path media/releases/2026-01-06_1430/audio \
  --release 2026-01-06_1430

# 6. Verify import log
tail -f data/import_logs/2026-01-06_1430_*.log

# 7. Publish
./manage publish-release --release 2026-01-06_1430

# 8. Verify
curl https://games.hispanistica.de/api/quiz/topics | jq '.topics[] | .id'
```

### Rollback

```bash
# Unpublish current release
./manage unpublish-release --release 2026-01-06_1430

# Publish previous release
./manage publish-release --release 2026-01-05_1200

# Verify
curl https://games.hispanistica.de/api/quiz/topics | jq '.topics[].release_id'
```

---

## Troubleshooting

### Issue: Import succeeds but topics not visible

**Check:**
```sql
SELECT id, title_key, is_active, release_id FROM quiz_topics WHERE release_id = '2026-01-06_1430';
```

**Fix:** Publish the release:
```bash
./manage publish-release --release 2026-01-06_1430
```

### Issue: Audio not playing

**Check:**
1. File exists: `ls -la static/quiz-media/<topic_slug>.media/`
2. File permissions: `chmod 644 static/quiz-media/<topic_slug>.media/*.mp3`
3. Nginx serves static files: `curl https://games.hispanistica.de/static/quiz-media/<topic_slug>.media/audio.mp3`

### Issue: Previous release still visible after publish

**Check:**
```sql
SELECT release_id, status, published_at FROM quiz_content_releases ORDER BY published_at DESC;
```

**Expected:** Only one release with `status='published'`.

**Fix:** Manually unpublish old release:
```bash
./manage unpublish-release --release <old_release_id>
```

---

## Best Practices

1. **Always normalize before upload**
   - Ensures stable question IDs
   - Validates schema compliance

2. **Test on staging first**
   - Import to staging environment
   - Play through 2-3 topics manually
   - Check leaderboard

3. **Use descriptive release IDs**
   - Format: `release_YYYYMMDD_HHMM_<suffix>`
   - Example: `release_20260106_1430_winterupdate`

4. **Monitor import logs**
   - Check for warnings (non-critical but worth reviewing)
   - Archive logs for audit trail

5. **Schedule releases during low traffic**
   - Publish workflow sets `is_active` flags → brief DB lock
   - Aim for off-peak hours

6. **Keep rollback plan ready**
   - Know previous release ID
   - Test unpublish/publish cycle on staging

---

## Security Considerations

1. **Admin Dashboard access**
   - Requires webapp admin credentials (JWT-based)
   - No ENV-based keys (QUIZ_ADMIN_KEY deprecated)

2. **File permissions**
   - `media/releases/` → 755 (world-readable, admin-writable)
   - `static/quiz-media/` → 755 (world-readable, admin-writable)

3. **Content validation**
   - All JSON validated before DB insert
   - No user-generated content (admin-curated only)

4. **Audit trail**
   - All imports logged with timestamp
   - Release tracking table records who/when

---

## Related Documentation

- [CONTENT.md](CONTENT.md) – JSON schema and authoring guide
- [OPERATIONS.md](OPERATIONS.md) – DEV vs Production workflows
- [AUDIT_REPORT.md](AUDIT_REPORT.md) – Complete architecture audit
- [games_hispanistica_production.md](../../games_hispanistica_production.md) – Production setup
