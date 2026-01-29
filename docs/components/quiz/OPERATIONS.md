# Quiz Component – Operations Guide

**Target Audience:** Developers, DevOps engineers, content creators  
**Purpose:** Practical workflows for DEV and Production environments

---

## Overview

Quiz content follows different workflows in **DEV** vs **Production**:

| Aspect | DEV | Production |
|--------|-----|------------|
| **Content Location** | `content/quiz/topics/` (in repo) | `media/releases/<release_id>/` (external) |
| **Import Method** | `scripts/quiz_seed.py` | `./manage import-content` or Admin Dashboard |
| **Release Tracking** | No | Yes (`QuizContentRelease` table) |
| **Publish Step** | No (all active by default) | Yes (explicit publish required) |
| **Normalization** | Recommended before seed | **Required** before upload |

---

## DEV Workflow

### Initial Setup

```bash
# 1. Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Initialize database
python scripts/init_quiz_db.py

# 4. Start dev server
flask run
```

### Content Authoring

```bash
# 1. Create/edit JSON file
notepad content/quiz/topics/my_new_topic.json

# 2. Normalize (generate IDs, statistics)
python scripts/quiz_units_normalize.py --write

# 3. Seed database
python scripts/quiz_seed.py

# 4. Test
# Open browser: http://localhost:5000/games/quiz
```

### Quick Iteration

```bash
# Edit → Normalize → Seed (one command)
python scripts/quiz_seed.py

# Skip normalization (if JSON already valid)
python scripts/quiz_seed.py --skip-normalize

# Check normalization without writing
python scripts/quiz_units_normalize.py --check --verbose
```

### Pruning (Removing Topics)

```bash
# Soft prune (set is_active=false for removed topics)
python scripts/quiz_seed.py --prune-soft

# Hard prune (DELETE topics without JSON, DANGEROUS)
python scripts/quiz_seed.py --prune-hard
```

**Warning:** Hard prune fails if topic has active runs. Use soft prune in most cases.

---

## Production Workflow

### Prerequisites

1. **Server Access** – SSH or Admin Dashboard credentials
2. **Content Prepared** – JSON files normalized locally
3. **Release Directory** – Structure: `<release_id>/units/` and `<release_id>/audio/`

### Step 1: Prepare Release (Local)

```bash
# Create release directory
mkdir C:\content\games_hispanistica\release_20260106_1430_winterupdate
cd C:\content\games_hispanistica\release_20260106_1430_winterupdate
mkdir units audio

# Copy content
cp path\to\topics\*.json units\
cp path\to\audio\*.media audio\

# Normalize ALL units
python scripts/quiz_units_normalize.py --write --topics-dir C:\content\games_hispanistica\release_20260106_1430_winterupdate\units

# Verify no errors
python scripts/quiz_units_normalize.py --check --topics-dir C:\content\games_hispanistica\release_20260106_1430_winterupdate\units
```

**Important:** Normalization **must** run locally before upload. Server import does not normalize.

### Step 2: Upload to Server

```bash
# rsync to server
rsync -avz --progress C:\content\games_hispanistica\release_20260106_1430_winterupdate\ user@server:/srv/webapps/games_hispanistica/media/releases/release_20260106_1430_winterupdate/

# Verify upload
ssh user@server "ls -la /srv/webapps/games_hispanistica/media/releases/release_20260106_1430_winterupdate/"
```

### Step 3: Import (Server)

**Option A: CLI**

```bash
ssh user@server
cd /srv/webapps/games_hispanistica

# Import (creates draft)
./manage import-content \
  --units-path media/releases/release_20260106_1430_winterupdate/units \
  --audio-path media/releases/release_20260106_1430_winterupdate/audio \
  --release release_20260106_1430_winterupdate

# Check import log
tail -50 data/import_logs/release_20260106_1430_winterupdate_*.log
```

**Option B: Admin Dashboard**

1. Navigate to `https://games.hispanistica.de/quiz-admin/`
2. Click **"Import Release"**
3. Enter release ID: `release_20260106_1430_winterupdate`
4. Click **"Import"**
5. Review validation results

### Step 4: Publish (Server)

**Option A: CLI**

```bash
./manage publish-release --release release_20260106_1430_winterupdate
```

**Option B: Admin Dashboard**

1. Find release in list
2. Click **"Publish"**
3. Confirm (previous release will be auto-unpublished)

### Step 5: Verify

```bash
# Check published topics (CLI)
curl https://games.hispanistica.de/api/quiz/topics | jq '.topics[] | {id, title_key, release_id}'

# Or visit frontend
# https://games.hispanistica.de/games/quiz
```

---

## Common Tasks

### Update Existing Topic

**DEV:**
```bash
# 1. Edit JSON
notepad content/quiz/topics/aussprache.json

# 2. Normalize + Seed
python scripts/quiz_seed.py

# 3. Test
```

**Production:**
```bash
# 1. Create new release (content versioning)
mkdir release_20260107_1000_aussprache_fix
cp aussprache.json release_20260107_1000_aussprache_fix/units/

# 2. Normalize locally
python scripts/quiz_units_normalize.py --write --topics-dir release_20260107_1000_aussprache_fix/units

# 3. Upload + Import + Publish (see Production Workflow above)
```

### Add New Topic

**DEV:**
```bash
# 1. Create JSON
cp content/quiz/topics/template.json content/quiz/topics/new_topic.json
notepad content/quiz/topics/new_topic.json

# 2. Set slug, title, questions
# {
#   "slug": "new_topic",
#   "title": "My New Topic",
#   ...
# }

# 3. Normalize + Seed
python scripts/quiz_seed.py
```

**Production:**
```bash
# 1. Add to release directory
cp new_topic.json release_20260107_1000/units/

# 2. Normalize ALL units in release
python scripts/quiz_units_normalize.py --write --topics-dir release_20260107_1000/units

# 3. Upload + Import + Publish
```

### Remove Topic

**DEV:**
```bash
# 1. Delete JSON file
rm content/quiz/topics/old_topic.json

# 2. Soft prune (set is_active=false)
python scripts/quiz_seed.py --prune-soft

# 3. Verify
# Topic hidden from /games/quiz but questions remain in DB
```

**Production:**
```bash
# 1. Create new release WITHOUT the topic
mkdir release_20260107_1100_remove_old_topic
cp content/quiz/topics/*.json release_20260107_1100_remove_old_topic/units/
rm release_20260107_1100_remove_old_topic/units/old_topic.json

# 2. Normalize + Upload + Import + Publish
# (See Production Workflow)

# Result: old_topic.is_active = false (soft delete)
```

### Rollback Release

```bash
# Unpublish current release
./manage unpublish-release --release release_20260107_1000

# Publish previous release
./manage publish-release --release release_20260106_1430

# Verify
curl https://games.hispanistica.de/api/quiz/topics | jq '.topics[].release_id'
```

---

## Normalization

### What It Does

1. **Generates Question IDs** (if missing) – Format: `{slug}_q_{ULID}`
2. **Calculates questions_statistics** – Difficulty distribution count
3. **Adds Media Defaults** – Empty arrays for questions/answers without media
4. **Formats JSON** – Sorted keys, 2-space indent (deterministic output)

### When to Run

| Scenario | DEV | Production |
|----------|-----|------------|
| **New JSON file** | ✅ Required | ✅ Required |
| **Edit existing question** | ⚠️ Recommended | ✅ Required |
| **Add/remove question** | ✅ Required | ✅ Required |
| **Change difficulty** | ✅ Required | ✅ Required |
| **No changes** | ❌ Skip | ❌ Skip |

### Commands

```bash
# Normalize content/quiz/topics/ (DEV default)
python scripts/quiz_units_normalize.py --write

# Normalize custom directory
python scripts/quiz_units_normalize.py --write --topics-dir path/to/units

# Check without writing (dry-run)
python scripts/quiz_units_normalize.py --check

# Verbose output (show all changes)
python scripts/quiz_units_normalize.py --check --verbose
```

### Output

```
Normalizing content/quiz/topics/...
✓ aussprache.json (21 questions, no changes)
✓ kreativitaet.json (18 questions, added 2 IDs)
✓ orthographie.json (25 questions, updated statistics)

Summary:
- 7 files processed
- 142 questions total
- 2 files modified
```

---

## Seeding (DEV Only)

### What It Does

1. **Reads JSON** from `content/quiz/topics/`
2. **Validates** schema and content
3. **Upserts** topics and questions (by topic_id, question_id)
4. **Copies Media** from `seed_src` to `static/quiz-media/`
5. **Soft Prunes** (optional) – Sets `is_active=false` for removed topics

### Commands

```bash
# Full pipeline: Normalize + Seed + Soft Prune
python scripts/quiz_seed.py

# Explicit soft prune
python scripts/quiz_seed.py --prune-soft

# Hard prune (DELETE, dangerous)
python scripts/quiz_seed.py --prune-hard

# Skip normalization
python scripts/quiz_seed.py --skip-normalize
```

### Advisory Lock

Seeding uses PostgreSQL advisory lock to prevent parallel execution:
- Lock ID: `quiz_seed_lock` (MD5 hash)
- If lock held: script waits or exits (depending on implementation)

---

## Import Service (Production Only)

### Architecture

```
QuizImportService
├── import_release()      # Main entry point
├── validate_units()      # Schema + content validation
├── calculate_hashes()    # Audio file SHA256
├── upsert_topics()       # INSERT ON CONFLICT UPDATE
├── upsert_questions()    # INSERT ON CONFLICT UPDATE
├── copy_audio_files()    # seed_src → static/quiz-media/
└── log_import()          # Write to data/import_logs/
```

### Idempotency

Multiple imports of same release → **same result**:
- Topics/questions upserted by ID (no duplicates)
- Audio files copied by hash (skip if same hash exists)
- Release record updated with timestamp

### Dry-Run Mode

```bash
# Validate without writing to database
./manage import-content \
  --units-path media/releases/release_20260106_1430/units \
  --audio-path media/releases/release_20260106_1430/audio \
  --release release_20260106_1430 \
  --dry-run
```

**Output:**
```
Validating 7 units...
✓ aussprache.json (21 questions, 15 audio files)
✓ kreativitaet.json (18 questions, 12 audio files)
...

Validation complete:
- 7 units valid
- 142 questions
- 89 audio files
- 0 errors

(Dry-run: no data written)
```

---

## Media Handling

### DEV: seed_src (Relative Paths)

```json
{
  "media": [
    {
      "id": "m1",
      "type": "audio",
      "seed_src": "aussprache.media/q01_audio_1.mp3"
    }
  ]
}
```

**Resolved to:** `content/quiz/topics/aussprache.media/q01_audio_1.mp3`  
**Copied to:** `static/quiz-media/aussprache.media/q01_audio_1.mp3`

### Production: seed_src (Release-Relative Paths)

```json
{
  "media": [
    {
      "id": "m1",
      "type": "audio",
      "seed_src": "aussprache.media/q01_audio_1.mp3"
    }
  ]
}
```

**Resolved to:** `media/releases/release_20260106_1430/audio/aussprache.media/q01_audio_1.mp3`  
**Copied to:** `static/quiz-media/aussprache.media/q01_audio_1.mp3`

### Media Hash Tracking

Audio files tracked by SHA256 hash:
- Same file (hash match) → skip copy
- Different file (hash mismatch) → overwrite
- Missing file → error

---

## Database Maintenance

### Check Active Topics

```sql
SELECT id, title_key, is_active, release_id, order_index
FROM quiz_topics
WHERE is_active = true
ORDER BY order_index;
```

### Check Question Distribution

```sql
SELECT topic_id, difficulty, COUNT(*) as count
FROM quiz_questions
WHERE is_active = true
GROUP BY topic_id, difficulty
ORDER BY topic_id, difficulty;
```

### Check Active Releases

```sql
SELECT release_id, status, units_count, questions_count, published_at
FROM quiz_content_releases
ORDER BY created_at DESC;
```

### Manual Publish/Unpublish (Emergency)

```sql
-- Unpublish current release
UPDATE quiz_content_releases SET status = 'unpublished', unpublished_at = NOW()
WHERE status = 'published';

UPDATE quiz_topics SET is_active = false
WHERE release_id = '<current_release_id>';

-- Publish specific release
UPDATE quiz_content_releases SET status = 'published', published_at = NOW()
WHERE release_id = '<target_release_id>';

UPDATE quiz_topics SET is_active = true
WHERE release_id = '<target_release_id>';
```

**Warning:** Use CLI commands instead. Manual SQL bypasses audit logging.

---

## Troubleshooting

### Issue: Normalization adds unexpected IDs

**Cause:** Questions missing `id` field → auto-generated ULID  
**Fix:** First normalization generates IDs, subsequent runs preserve them  
**Commit normalized JSON to repo** to avoid regeneration

### Issue: Seed fails with "File not found"

**Cause:** `seed_src` path incorrect in JSON  
**Check:**
```bash
ls -la content/quiz/topics/aussprache.media/
```

**Fix:** Adjust `seed_src` to match actual file location

### Issue: Import succeeds but topics not visible

**Cause:** Release not published (status = 'draft')  
**Fix:**
```bash
./manage publish-release --release <release_id>
```

### Issue: Audio not playing in frontend

**Check:**
1. File copied to `static/quiz-media/`
2. File permissions: `chmod 644 static/quiz-media/**/*.mp3`
3. Nginx serves static files
4. Browser console for 404 errors

**Fix:** Re-run import or manually copy audio files

### Issue: Publish fails with "previous release still published"

**Cause:** Database inconsistency (multiple published releases)  
**Fix:**
```sql
-- Check published releases
SELECT release_id, status FROM quiz_content_releases WHERE status = 'published';

-- Manually unpublish extras
UPDATE quiz_content_releases SET status = 'unpublished' WHERE release_id != '<target_release_id>' AND status = 'published';
```

---

## Performance Considerations

### DEV

- **Seed time:** ~2-5 seconds for 7 topics, 142 questions
- **Bottleneck:** File I/O (copying audio)
- **Optimization:** Use SSD, skip unchanged files

### Production

- **Import time:** ~10-30 seconds for typical release
- **Bottleneck:** Audio hash calculation (CPU-bound)
- **Optimization:** Pre-calculate hashes locally, upload with manifest

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Quiz Content Import

on:
  workflow_dispatch:
    inputs:
      release_id:
        description: 'Release ID to import'
        required: true

jobs:
  import:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Normalize Content
        run: |
          python scripts/quiz_units_normalize.py --check --topics-dir ${{ inputs.release_path }}

      - name: Upload to Server
        run: |
          rsync -avz ${{ inputs.release_path }} server:/srv/webapps/games_hispanistica/media/releases/${{ inputs.release_id }}/

      - name: Import Release
        run: |
          ssh server "./manage import-content --release ${{ inputs.release_id }}"

      - name: Publish Release
        if: github.ref == 'refs/heads/main'
        run: |
          ssh server "./manage publish-release --release ${{ inputs.release_id }}"
```

---

## Related Documentation

- [CONTENT.md](CONTENT.md) – JSON schema and authoring guide
- [ADMIN_IMPORT.md](ADMIN_IMPORT.md) – Admin Dashboard and API reference
- [AUDIT_REPORT.md](AUDIT_REPORT.md) – Complete architecture audit
- [games_hispanistica_production.md](../../games_hispanistica_production.md) – Production setup
