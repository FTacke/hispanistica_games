# Quiz Component – Glossary

**Purpose:** Define key terms used across Quiz documentation and codebase

---

## Content Terms

### Quiz Unit
**Definition:** A complete JSON file containing one quiz topic with all its questions.  
**File Format:** `content/quiz/topics/<slug>.json`  
**Schema:** quiz_unit_v1 or quiz_unit_v2  
**Example:** `aussprache.json` (21 questions about pronunciation)

**Contains:**
- Metadata (title, description, authors)
- Questions array (with answers, media, sources)
- Statistics (difficulty distribution)

### Topic
**Definition:** A thematic category of questions (e.g., "Pronunciation", "Grammar").  
**Database:** `quiz_topics` table  
**Identifier:** `slug` (string, e.g., `"aussprache"`)  
**Status:** `is_active` (boolean) – visible to users if true

**Properties:**
- `title_key` – Display title (plaintext, not i18n key anymore)
- `description_key` – Description (plaintext)
- `authors` – Array of author names
- `order_index` – Sort order in topic list
- `release_id` – Release version (for production tracking)

### Question
**Definition:** A single quiz question with 2-6 answer options (exactly one correct).  
**Database:** `quiz_questions` table  
**Identifier:** ULID-based ID (e.g., `"aussprache_q_01KE59P9SVXJF4WMBPGHSJXDK6"`)  
**Format:** `{topic_slug}_q_{ULID}`

**Properties:**
- `difficulty` – Integer 1-5
- `type` – `"single_choice"` (only type supported currently)
- `prompt` – Question text (plaintext)
- `explanation` – Answer explanation (plaintext)
- `answers` – JSONB array of answer objects
- `media` – JSONB array of media objects (audio/image)
- `sources` – Optional source references
- `meta` – Optional metadata

### Answer
**Definition:** One possible response to a question.  
**Storage:** Inside `quiz_questions.answers` (JSONB array)  
**Format:**
```json
{
  "id": "a1",
  "text": "Answer text",
  "correct": true,
  "media": []
}
```

**Constraints:**
- Exactly **one** answer must have `correct: true`
- 2-6 answers per question (recommended: 4)

### Media
**Definition:** Audio or image file attached to question or answer.  
**Types:** `audio` (MP3, OGG, WAV), `image` (JPG, PNG, WEBP, GIF)  
**Storage:** `static/quiz-media/<topic_slug>.media/<filename>`

**Format (v2):**
```json
{
  "id": "m1",
  "type": "audio",
  "seed_src": "aussprache.media/q01_audio_1.mp3",
  "label": "Speaker 1"
}
```

**v1 → v2 Migration:** Normalizer auto-converts single media object to array.

---

## Player Terms

### Player
**Definition:** A game account (separate from webapp users).  
**Database:** `quiz_players` table  
**Auth:** Pseudonym + 4-digit PIN (or anonymous)  
**Identifier:** UUID

**Types:**
- **Registered:** Has pseudonym + PIN, appears on leaderboard
- **Anonymous:** Name = "Anonym", no PIN, hidden from leaderboard

**Fields:**
- `name` – Display name (max 50 chars)
- `normalized_name` – Lowercase, trimmed, unique
- `pin_hash` – Argon2 hash (null for anonymous)
- `is_anonymous` – Boolean

### Session
**Definition:** Authentication token for logged-in player.  
**Database:** `quiz_sessions` table  
**Storage:** `quiz_session_token` cookie (HTTPOnly, Secure)  
**Expiry:** 30 days from creation

**Fields:**
- `token_hash` – SHA256 of session token
- `expires_at` – Expiry timestamp (UTC)

---

## Game Terms

### Run
**Definition:** One complete playthrough of a topic (10 questions).  
**Database:** `quiz_runs` table  
**Identifier:** UUID  
**Status:** `in_progress`, `finished`, `abandoned`

**Structure:**
- **10 questions** (5 difficulty levels × 2 questions each)
- **2 jokers** (50:50, eliminates 2 wrong answers)
- **30-second timer** per question (+ 10s bonus for media questions)

**State Fields:**
- `run_questions` – JSONB array of question data (IDs, order, timer state)
- `current_question_index` – 0-9 (which question player is on)
- `jokers_remaining` – 0-2
- `running_score` – Points accumulated (updated after each question)
- `tokens_earned` – Token count (updated after each level)

### Run Question
**Definition:** One question instance within a run (includes randomized answer order).  
**Storage:** Inside `quiz_runs.run_questions` (JSONB array)  
**Index:** 0-9 (position in run)

**Format:**
```json
{
  "question_id": "aussprache_q_01KE59P9SVXJF4WMBPGHSJXDK6",
  "difficulty": 1,
  "answers_order": [2, 1, 4, 3],
  "joker_disabled": [],
  "time_limit_seconds": 30,
  "started_at_ms": 1673012735000,
  "answered_at_ms": null
}
```

**Fields:**
- `answers_order` – Randomized display order (indexes into original answers array)
- `joker_disabled` – Indexes of eliminated answers (if joker used)
- `started_at_ms` – Unix timestamp (milliseconds) when timer started
- `answered_at_ms` – Unix timestamp when player answered

### Answer Record
**Definition:** Player's submitted answer for a question.  
**Database:** `quiz_run_answers` table  
**Created:** When player submits answer or timer expires

**Fields:**
- `question_index` – 0-9 (position in run)
- `question_id` – Question identifier
- `selected_answer_id` – Answer ID (e.g., `"a2"`) or null (timeout)
- `is_correct` – Boolean
- `time_taken_ms` – Milliseconds from start to answer
- `answered_at` – Timestamp (UTC)

### Level
**Definition:** A difficulty tier within a run (2 questions per level).  
**Not stored separately** – derived from question index.

**Mapping:**
- Level 1 = Questions 0-1 (difficulty 1)
- Level 2 = Questions 2-3 (difficulty 2)
- Level 3 = Questions 4-5 (difficulty 3)
- Level 4 = Questions 6-7 (difficulty 4)
- Level 5 = Questions 8-9 (difficulty 5)

**Level Completion:** Triggers bonus calculation and token award.

---

## Scoring Terms

### Base Points
**Definition:** Points earned for correct answer (before time bonus).  
**Formula:** `base_points = difficulty × 10`  
**Range:** 10-50 points per question

**Distribution:**
- Difficulty 1 → 10 points
- Difficulty 2 → 20 points
- Difficulty 3 → 30 points
- Difficulty 4 → 40 points
- Difficulty 5 → 50 points

### Time Bonus
**Definition:** Extra points for fast answers.  
**Formula:** `time_bonus = max(0, time_limit - time_taken) × bonus_rate`  
**Bonus Rate:** Varies by difficulty (not fully documented, see `services.py:851`)

**Note:** Time bonus shown separately on Level-Up screen, then added to running score.

### Token
**Definition:** Achievement metric (separate from points, used for leaderboard tiebreaker).  
**Awarded per level** (2 questions per level).  
**Range:** 0-3 tokens per level, max 15 per run

**Token Rules:**
- **3 tokens:** Both questions correct (no joker)
- **2 tokens:** One question correct (no joker)
- **1 token:** One+ correct with joker used
- **0 tokens:** Zero correct or both wrong

**Purpose:** Distinguish players with same score (skill indicator).

### Total Score
**Definition:** Final score for a run (stored in leaderboard).  
**Formula:** `total_score = sum(base_points + time_bonus)` for all 10 questions  
**Max Theoretical:** 300 points (10+20+30+40+50 × 2) + time bonuses

### Leaderboard
**Definition:** Ranked list of top scores per topic.  
**Database:** `quiz_scores` table  
**Limit:** Top 30 per topic  
**Sort Order:**
1. `total_score` DESC
2. `tokens_count` DESC
3. `created_at` ASC (earliest wins ties)

**Visibility:** Anonymous players excluded (only registered players shown).

---

## Release Terms

### Release
**Definition:** A versioned content package (for production deployment).  
**Database:** `quiz_content_releases` table  
**Identifier:** `release_id` (e.g., `"release_20260106_1430_a7x2"`)  
**Status:** `draft`, `published`, `unpublished`

**Lifecycle:**
1. **Draft** – Imported but not visible to users
2. **Published** – Active, visible to users (only one published at a time)
3. **Unpublished** – Rolled back, hidden from users

**Fields:**
- `units_count` – Number of topics in release
- `questions_count` – Total questions
- `audio_count` – Audio files processed
- `imported_at` – When imported to database
- `published_at` – When made visible
- `unpublished_at` – When rolled back

### Import
**Definition:** Process of loading JSON units into database.  
**Method:** CLI (`./manage import-content`) or Admin Dashboard  
**Result:** Creates/updates topics and questions with `release_id`

**Steps:**
1. Validate JSON schema
2. Calculate audio hashes
3. Upsert topics and questions
4. Copy audio files to `static/quiz-media/`
5. Create/update release record (status = 'draft')
6. Log to `data/import_logs/`

**Idempotent:** Multiple imports → same result (no duplicates).

### Publish
**Definition:** Making a release visible to users.  
**Effect:**
- Sets `status = 'published'` for release
- Sets `is_active = true` for all topics/questions in release
- **Auto-unpublishes** previous release (only one published at a time)

**Idempotent:** Multiple publishes → no-op (same result).

### Unpublish
**Definition:** Hiding a release from users (rollback).  
**Effect:**
- Sets `status = 'unpublished'` for release
- Sets `is_active = false` for all topics/questions in release

**Use Case:** Emergency rollback or testing.

---

## Technical Terms

### ULID
**Definition:** Universally Unique Lexicographically Sortable Identifier.  
**Format:** 26-character string (e.g., `01KE59P9SVXJF4WMBPGHSJXDK6`)  
**Used For:** Question IDs (sortable by creation time)  
**Generation:** `quiz_units_normalize.py` script

### Normalization
**Definition:** Pre-processing JSON units to ensure consistency.  
**Script:** `scripts/quiz_units_normalize.py`  
**Operations:**
1. Generate missing question IDs (ULID)
2. Calculate `questions_statistics` (difficulty distribution)
3. Add media defaults (empty arrays)
4. Format JSON (sorted keys, 2-space indent)

**Required Before:** Upload to production (not enforced by import, but strongly recommended).

### Seeding
**Definition:** Loading JSON units into database (DEV workflow).  
**Script:** `scripts/quiz_seed.py`  
**Method:** Calls `game_modules.quiz.seed.seed_quiz_units()`

**Difference from Import:**
- **Seeding:** DEV-only, direct DB access, no release tracking
- **Import:** Production, via import service, tracks releases

### Upsert
**Definition:** INSERT if not exists, UPDATE if exists (idempotent operation).  
**SQL:** `INSERT ... ON CONFLICT ... DO UPDATE SET ...`  
**Used For:** Topics (by `id`), Questions (by `id`)

**Benefit:** Multiple imports don't create duplicates.

### Advisory Lock
**Definition:** PostgreSQL lock to prevent concurrent execution.  
**Used By:** `quiz_seed.py` (prevents parallel seeding)  
**Lock ID:** MD5 hash of `"quiz_seed_lock"`

### JSONB
**Definition:** PostgreSQL binary JSON data type (efficient storage and querying).  
**Used For:**
- `quiz_questions.answers` (answer array)
- `quiz_questions.media` (media array)
- `quiz_runs.run_questions` (run state)

**Advantage:** Indexable, queryable, more efficient than TEXT JSON.

### Schema Version
**Definition:** Content format version (backward compatibility).  
**Versions:**
- `quiz_unit_v1` – Legacy, single media object
- `quiz_unit_v2` – Current, media arrays

**Support:** Both versions validated and imported (v1 auto-converted to v2).

---

## Abbreviations

- **API** – Application Programming Interface
- **CLI** – Command-Line Interface
- **CORS** – Cross-Origin Resource Sharing (not used, quiz on same domain)
- **DB** – Database (PostgreSQL)
- **DEV** – Development environment
- **FK** – Foreign Key
- **JSONB** – Binary JSON (PostgreSQL type)
- **JWT** – JSON Web Token (webapp auth)
- **MD3** – Material Design 3 (design system)
- **ORM** – Object-Relational Mapping (SQLAlchemy)
- **PIN** – Personal Identification Number (4 digits for player auth)
- **SHA256** – Secure Hash Algorithm 256-bit (for audio files)
- **ULID** – Universally Unique Lexicographically Sortable Identifier
- **URL** – Uniform Resource Locator
- **UUID** – Universally Unique Identifier (for players, runs, sessions)

---

## Related Documentation

- [README.md](README.md) – Component overview
- [ARCHITECTURE.md](ARCHITECTURE.md) – System design
- [CONTENT.md](CONTENT.md) – JSON schema reference
- [OPERATIONS.md](OPERATIONS.md) – DEV/Production workflows
- [ADMIN_IMPORT.md](ADMIN_IMPORT.md) – Import API reference
- [AUDIT_REPORT.md](AUDIT_REPORT.md) – Complete audit
