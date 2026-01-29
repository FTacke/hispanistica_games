# Quiz Operations – DEV & Production Workflows

**Purpose:** Schritt-für-Schritt-Anleitungen für Content-Import, Release-Verwaltung, Troubleshooting.

---

## DEV Workflow

**Environment:** Local development (`docker-compose.dev-postgres.yml`)

### 1. Setup

**Start Services:**
```powershell
docker compose -f docker-compose.dev-postgres.yml up -d
```

**Verify DB:**
```powershell
docker ps  # Check quiz-db-1 running
```

**Run Migrations:**
```powershell
python manage.py migrate
```

### 2. Create Content

**Path:** `content/quiz/topics/<topic_slug>.json`

**Example:**
```powershell
# Create new topic file
code content/quiz/topics/grammatik_verben.json
```

**Schema:** See [CONTENT.md](CONTENT.md) for quiz_unit_v2 format.

**Validation:**
```powershell
# Run normalization (validates + fixes common issues)
python scripts/quiz_units_normalize.py
```

### 3. Seed Database

**Command:**
```powershell
python scripts/quiz_seed.py
```

**What it does:**
1. Reads all JSON files from `content/quiz/topics/`
2. Validates schema (quiz_unit_v2)
3. Copies media to `media/quiz/<topic_id>/`
4. Upserts topics and questions to database
5. Sets `is_active=true`, `release_id=null`

**Output:**
```
2025-01-06 14:30:00 INFO Seeding Quiz Topics...
2025-01-06 14:30:01 INFO Loaded 'aussprache' with 72 questions
2025-01-06 14:30:02 INFO Loaded 'grammatik_verben' with 105 questions
2025-01-06 14:30:03 INFO Seeding complete. 2 topics, 177 questions
```

**Idempotency:** Multiple runs safe (upsert logic).

### 4. Test in Browser

**URL:** http://localhost:8000/games/quiz

**Manual Test:**
1. Select topic (e.g., "Aussprache & Akzente")
2. Start run
3. Answer all 10 questions
4. Check leaderboard

**Check Logs:**
```powershell
# Backend logs
docker logs hispanistica-games-web-1 -f

# DB logs
docker logs hispanistica-games-quiz-db-1 -f
```

---

## Production Workflow

**Environment:** `games.hispanistica.org` (Docker Swarm, PostgreSQL)

### 1. Prepare Release

**Release ID Format:** `release_YYYYMMDD_HHMM_<random>`

**Example:** `release_20260106_1430_a7x2`

**Directory Structure:**
```
media/releases/release_20260106_1430_a7x2/
├── units/
│   ├── aussprache.json
│   ├── grammatik_verben.json
│   └── ...
└── audio/
    ├── cafe_pronunciation.mp3
    ├── verb_conjugation_example.mp3
    └── ...
```

**Create on Server:**
```bash
cd /path/to/hispanistica_games
mkdir -p media/releases/release_20260106_1430_a7x2/{units,audio}
```

### 2. Upload Content

**Method 1: SCP**
```bash
scp -r content/quiz/topics/*.json user@games.hispanistica.org:/path/to/media/releases/release_20260106_1430_a7x2/units/
scp -r content/quiz/audio/* user@games.hispanistica.org:/path/to/media/releases/release_20260106_1430_a7x2/audio/
```

**Method 2: rsync**
```bash
rsync -avz content/quiz/topics/*.json user@games.hispanistica.org:/path/to/media/releases/release_20260106_1430_a7x2/units/
rsync -avz content/quiz/audio/* user@games.hispanistica.org:/path/to/media/releases/release_20260106_1430_a7x2/audio/
```

**Verify:**
```bash
ssh user@games.hispanistica.org
cd /path/to/hispanistica_games/media/releases/release_20260106_1430_a7x2
ls -lh units/  # Should show JSON files
ls -lh audio/  # Should show audio files
```

### 3. Import Release

**Admin Dashboard:** https://games.hispanistica.org/quiz-admin

**Login:**
- Use Admin JWT Token (set in .env: `QUIZ_ADMIN_JWT_TOKEN`)
- Or login as user with ADMIN role

**Import Steps:**
1. Navigate to **Releases** tab
2. Enter Release ID: `release_20260106_1430_a7x2`
3. Click **Import Release**

**API Call (Alternative):**
```bash
curl -X POST https://games.hispanistica.org/quiz-admin/api/releases/release_20260106_1430_a7x2/import \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json"
```

**Request Body:** **EMPTY** (paths constructed from release_id)

**Response:**
```json
{
  "ok": true,
  "units_imported": 7,
  "questions_imported": 142,
  "audio_files_copied": 23
}
```

**State After Import:**
- `quiz_content_releases.status = 'draft'`
- Topics imported but **not visible** to players (`is_active=false`)
- Media copied to `media/quiz/<release_id>/`

### 4. Publish Release

**Admin Dashboard:**
1. Go to **Releases** tab
2. Find `release_20260106_1430_a7x2` (status: draft)
3. Click **Publish**

**API Call:**
```bash
curl -X POST https://games.hispanistica.org/quiz-admin/api/releases/release_20260106_1430_a7x2/publish \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json"
```

**Request Body:** **EMPTY**

**Response:**
```json
{
  "ok": true,
  "units_affected": 7,
  "previous_release_id": "release_20260101_1200_x3y4"
}
```

**State After Publish:**
- `quiz_content_releases.status = 'published'`
- Previous release: `status = 'unpublished'`
- Topics now visible: `is_active=true`
- Only **1 published release** at a time

### 5. Verify Deployment

**Check Topics API:**
```bash
curl https://games.hispanistica.org/api/quiz/topics | jq
```

**Expected:**
```json
{
  "topics": [
    {
      "id": "aussprache",
      "title_key": "Aussprache & Akzente",
      "question_count": 72
    }
  ]
}
```

**Manual Test:**
1. Visit https://games.hispanistica.org/games/quiz
2. See new topics listed
3. Start a run, verify questions load
4. Check media (audio/images) work

---

## Rollback

**Scenario:** Published release has critical bug, need to revert.

### Option 1: Unpublish Current, Republish Previous

**Step 1: Unpublish Current**
```bash
curl -X POST https://games.hispanistica.org/quiz-admin/api/releases/release_20260106_1430_a7x2/unpublish \
  -H "Authorization: Bearer <admin-jwt-token>"
```

**Step 2: Republish Previous**
```bash
curl -X POST https://games.hispanistica.org/quiz-admin/api/releases/release_20260101_1200_x3y4/publish \
  -H "Authorization: Bearer <admin-jwt-token>"
```

**Result:** Previous release is now active.

### Option 2: Database Direct (Emergency)

**If Admin Dashboard unavailable:**

```sql
-- Connect to DB
psql -U quiz_user -d quiz_db

-- Unpublish current
UPDATE quiz_content_releases
SET status = 'unpublished', unpublished_at = NOW()
WHERE release_id = 'release_20260106_1430_a7x2';

-- Publish previous
UPDATE quiz_content_releases
SET status = 'published', published_at = NOW()
WHERE release_id = 'release_20260101_1200_x3y4';

-- Update topics
UPDATE quiz_topics
SET release_id = 'release_20260101_1200_x3y4', is_active = true
WHERE release_id = 'release_20260106_1430_a7x2';

-- Update questions
UPDATE quiz_questions
SET release_id = 'release_20260101_1200_x3y4'
WHERE release_id = 'release_20260106_1430_a7x2';

-- Verify
SELECT release_id, status FROM quiz_content_releases ORDER BY imported_at DESC LIMIT 5;
```

**Warning:** This bypasses validation. Use only if API unavailable.

---

## Content Update (Patch)

**Scenario:** Fix typo in existing question without creating new release.

### DEV

**Step 1: Edit JSON**
```powershell
code content/quiz/topics/aussprache.json
# Fix typo in question prompt
```

**Step 2: Re-seed**
```powershell
python scripts/quiz_seed.py
```

**Result:** Question updated in DB (upsert logic).

### Production

**Step 1: Edit JSON in Release**
```bash
ssh user@games.hispanistica.org
cd /path/to/hispanistica_games/media/releases/release_20260106_1430_a7x2/units
nano aussprache.json  # Fix typo
```

**Step 2: Re-import**
```bash
curl -X POST https://games.hispanistica.org/quiz-admin/api/releases/release_20260106_1430_a7x2/import \
  -H "Authorization: Bearer <admin-jwt-token>"
```

**Step 3: Publish (if unpublished)**
```bash
curl -X POST https://games.hispanistica.org/quiz-admin/api/releases/release_20260106_1430_a7x2/publish \
  -H "Authorization: Bearer <admin-jwt-token>"
```

**Note:** Re-import is **idempotent** (safe to run multiple times).

---

## Troubleshooting

### Import Fails: "File not found"

**Symptom:**
```json
{
  "error": "File not found: media/releases/release_20260106_1430_a7x2/units/aussprache.json"
}
```

**Cause:** Release directory or files missing.

**Fix:**
```bash
# Check directory exists
ls -l media/releases/release_20260106_1430_a7x2/

# Check files
ls -l media/releases/release_20260106_1430_a7x2/units/
ls -l media/releases/release_20260106_1430_a7x2/audio/
```

### Import Fails: "Invalid schema"

**Symptom:**
```json
{
  "error": "Invalid schema: 'schemaVersion' is required"
}
```

**Cause:** JSON file missing required fields or has incorrect schema.

**Fix:**
```powershell
# Run normalization locally
python scripts/quiz_units_normalize.py

# Re-upload fixed files
scp content/quiz/topics/aussprache.json user@server:/path/to/units/
```

### Topics Not Visible After Publish

**Symptom:** GET /api/quiz/topics returns empty array.

**Cause:** `is_active=false` or no published release.

**Check:**
```sql
-- Check release status
SELECT release_id, status FROM quiz_content_releases ORDER BY imported_at DESC;

-- Check topics
SELECT id, title_key, is_active, release_id FROM quiz_topics;
```

**Fix:**
```bash
# Republish
curl -X POST https://games.hispanistica.org/quiz-admin/api/releases/<release_id>/publish \
  -H "Authorization: Bearer <admin-jwt-token>"
```

### Leaderboard Not Updating

**Symptom:** Finished run, but not appearing in leaderboard.

**Possible Causes:**
1. Player is anonymous (`is_anonymous=true` → excluded)
2. Run not finished (`status != 'finished'`)
3. No quiz_scores entry (idempotency issue)

**Check:**
```sql
-- Check player
SELECT id, name, is_anonymous FROM quiz_players WHERE name = 'TestPlayer';

-- Check run
SELECT id, player_id, status, running_score, tokens_earned
FROM quiz_runs
WHERE player_id = '<player_uuid>'
ORDER BY created_at DESC
LIMIT 1;

-- Check score
SELECT * FROM quiz_scores WHERE run_id = '<run_uuid>';
```

**Fix:**
- If player anonymous: Re-register with name + PIN
- If run not finished: Call POST /api/quiz/run/<id>/finish
- If score missing: Call finish endpoint again (idempotent)

### Audio Not Playing

**Symptom:** Audio media shows in question, but doesn't play.

**Possible Causes:**
1. File not copied to `media/quiz/<release_id>/`
2. Incorrect `seed_src` in JSON
3. File format not supported (must be MP3 or OGG)
4. MIME type misconfigured in nginx

**Check:**
```bash
# Check file exists
ls -l media/quiz/release_20260106_1430_a7x2/cafe_pronunciation.mp3

# Check file size (should be >0)
du -h media/quiz/release_20260106_1430_a7x2/cafe_pronunciation.mp3

# Test direct URL
curl -I https://games.hispanistica.org/media/quiz/release_20260106_1430_a7x2/cafe_pronunciation.mp3
```

**Fix:**
- If file missing: Re-upload audio files, re-import
- If wrong format: Convert to MP3 (ffmpeg)
- If MIME type wrong: Check nginx config (`audio/mpeg` for MP3)

---

## Backup & Restore

### Backup Database

**Full Backup:**
```bash
docker exec hispanistica-games-quiz-db-1 pg_dump -U quiz_user quiz_db > backup_20260106.sql
```

**Topics + Questions Only:**
```bash
docker exec hispanistica-games-quiz-db-1 pg_dump -U quiz_user quiz_db \
  --table=quiz_topics --table=quiz_questions --table=quiz_content_releases \
  > backup_content_20260106.sql
```

### Restore Database

**Full Restore:**
```bash
docker exec -i hispanistica-games-quiz-db-1 psql -U quiz_user quiz_db < backup_20260106.sql
```

**Warning:** This overwrites all data (including players, runs, scores).

---

## Environment Variables

**DEV (.env.dev):**
```env
QUIZ_DB_HOST=localhost
QUIZ_DB_PORT=5432
QUIZ_DB_USER=quiz_user
QUIZ_DB_PASSWORD=quiz_pass
QUIZ_DB_NAME=quiz_db
```

**Production (.env.prod):**
```env
QUIZ_DB_HOST=quiz-db.internal
QUIZ_DB_PORT=5432
QUIZ_DB_USER=quiz_user_prod
QUIZ_DB_PASSWORD=<secure-password>
QUIZ_DB_NAME=quiz_db_prod
QUIZ_ADMIN_JWT_TOKEN=<admin-jwt-secret>
```

**Admin Auth:**
- **No ENV-based QUIZ_ADMIN_KEY** (removed)
- Admin endpoints require **JWT + ADMIN role** (from user DB)

---

## Monitoring

### Check Release Status

**API:**
```bash
curl https://games.hispanistica.org/quiz-admin/api/releases \
  -H "Authorization: Bearer <admin-jwt-token>" | jq
```

**Response:**
```json
{
  "releases": [
    {
      "release_id": "release_20260106_1430_a7x2",
      "status": "published",
      "units_count": 7,
      "questions_count": 142,
      "imported_at": "2025-01-06T14:30:00Z",
      "published_at": "2025-01-06T15:00:00Z"
    },
    {
      "release_id": "release_20260101_1200_x3y4",
      "status": "unpublished",
      "units_count": 5,
      "questions_count": 98,
      "imported_at": "2025-01-01T12:00:00Z",
      "unpublished_at": "2025-01-06T15:00:00Z"
    }
  ]
}
```

### Check Topic Activity

**SQL:**
```sql
SELECT
  t.id,
  t.title_key,
  COUNT(DISTINCT r.id) AS total_runs,
  COUNT(DISTINCT r.player_id) AS unique_players,
  AVG(s.total_score) AS avg_score
FROM quiz_topics t
LEFT JOIN quiz_runs r ON r.topic_id = t.id AND r.status = 'finished'
LEFT JOIN quiz_scores s ON s.run_id = r.id
WHERE t.is_active = true
GROUP BY t.id, t.title_key
ORDER BY total_runs DESC;
```

### Check Question Stats

**SQL:**
```sql
SELECT
  q.id,
  q.prompt_key,
  q.difficulty,
  COUNT(a.id) AS times_answered,
  SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) AS correct_count,
  ROUND(100.0 * SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END) / COUNT(a.id), 2) AS correct_pct
FROM quiz_questions q
LEFT JOIN quiz_run_answers a ON a.question_id = q.id
WHERE q.is_active = true
GROUP BY q.id, q.prompt_key, q.difficulty
ORDER BY times_answered DESC
LIMIT 20;
```

**Use Case:** Identify too-easy/too-hard questions.

---

## Admin Dashboard

**URL:** https://games.hispanistica.org/quiz-admin

**Features:**
- Import releases (draft)
- Publish/unpublish releases
- View release history
- View topic stats
- View question stats (future)

**Auth:**
- JWT Token (set in .env: `QUIZ_ADMIN_JWT_TOKEN`)
- Or login as user with ADMIN role

**Code:** `src/app/routes/quiz_admin.py`

---

**This document is the single source of truth for Quiz operations.**
