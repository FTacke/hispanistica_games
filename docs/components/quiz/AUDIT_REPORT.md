# Quiz Component – Audit Report

**Audit Date:** 2026-01-29  
**Purpose:** Establish verifiable baseline before mechanics changes  
**Scope:** Complete Quiz pipeline, from Admin-Dashboard → PostgreSQL → Runtime

---

## Executive Summary

The Quiz component implements a complete quiz game with:
- **Content Format:** JSON (quiz_unit_v1/v2) with plaintext content
- **Content Pipeline:** Admin Dashboard/CLI → PostgreSQL → Runtime
- **Release Management:** Draft/Published/Unpublished workflow with version tracking
- **Game Mechanics:** 10 questions (5 difficulty levels × 2), 30s timer, 50:50 joker (2×)
- **Scoring:** Difficulty-based points + time bonus + token system (3/2/1/0)

**Content Truth:** `content/quiz/topics/*.json` (DEV) | `media/releases/<release_id>/units/*.json` (Production)  
**Schema:** quiz_unit_v1 (legacy) and quiz_unit_v2 (current, with media arrays)  
**Import:** Admin Dashboard (`/quiz-admin/api/releases/<release_id>/import`) or CLI (`./manage import-content`)

---

## 1. As-Is Architecture

### 1.1 Runtime Components

| Component | Path | Responsibility | Verified |
|-----------|------|----------------|----------|
| **Models** | `game_modules/quiz/models.py` | ORM models (PostgreSQL-only) | ✅ |
| **Services** | `game_modules/quiz/services.py` | Business logic (auth, run lifecycle, scoring) | ✅ |
| **Routes** | `game_modules/quiz/routes.py` | Public API endpoints | ✅ |
| **Validation** | `game_modules/quiz/validation.py` | JSON schema validation (v1/v2) | ✅ |
| **Seed** | `game_modules/quiz/seed.py` | DEV: JSON → DB seeding | ✅ |
| **Import Service** | `game_modules/quiz/import_service.py` | Production: Release import logic | ✅ |
| **Release Model** | `game_modules/quiz/release_model.py` | Release tracking (draft/published) | ✅ |
| **Admin Routes** | `src/app/routes/quiz_admin.py` | Admin Dashboard API (upload/import/publish) | ✅ |

### 1.2 Database Schema (PostgreSQL)

| Table | Purpose | Key Fields | Verified |
|-------|---------|------------|----------|
| `quiz_players` | Player accounts (pseudonym + PIN) | `id`, `name`, `normalized_name` (unique), `pin_hash` | ✅ |
| `quiz_sessions` | Session tokens (30-day expiry) | `id`, `player_id`, `token_hash`, `expires_at` | ✅ |
| `quiz_topics` | Topic definitions | `id` (slug), `title_key`, `authors`, `is_active`, `release_id` | ✅ |
| `quiz_questions` | Question bank | `id` (ULID-based), `topic_id`, `difficulty`, `answers` (JSONB), `media` (JSONB) | ✅ |
| `quiz_runs` | Run state | `id`, `player_id`, `topic_id`, `status`, `run_questions` (JSONB), `current_question_index` | ✅ |
| `quiz_run_answers` | Answer records | `run_id`, `question_index`, `selected_answer_id`, `is_correct`, `time_taken_ms` | ✅ |
| `quiz_scores` | Highscore snapshots | `id`, `run_id`, `player_name`, `total_score`, `tokens_count` | ✅ |
| `quiz_content_releases` | Release tracking | `release_id`, `status` (draft/published/unpublished), `units_count`, `imported_at` | ✅ |

**Note:** All tables use PostgreSQL-specific types (JSONB, ARRAY). No SQLite support.

### 1.3 Frontend Components

| Component | Path | Purpose | Verified |
|-----------|------|---------|----------|
| **Topic Selection** | `templates/games/quiz/index.html` | Topic cards, filter/sort | ✅ |
| **Login/Entry** | `templates/games/quiz/topic_entry.html` | Player auth + resume | ✅ |
| **Gameplay** | `templates/games/quiz/play.html` | Question rendering | ✅ |
| **Quiz Play JS** | `static/js/games/quiz-play.js` | State machine (QUESTION/LEVEL_UP/FINISH) | ✅ |
| **Styles** | `static/css/games/quiz.css` | Quiz-specific MD3 styles | ✅ |

---

## 2. Content Pipeline

### 2.1 DEV Workflow (Local Development)

```
1. Author/Edit JSON
   └── content/quiz/topics/<slug>.json

2. Normalize (IDs + statistics)
   └── python scripts/quiz_units_normalize.py --write

3. Seed Database
   └── python scripts/quiz_seed.py
   └── Calls: seed_quiz_units(session, units_dir=content/quiz/topics)

4. Test
   └── http://localhost:5000/games/quiz
```

**DEV Paths:**
- **Source:** `content/quiz/topics/*.json` (line: `game_modules/quiz/seed.py:39`)
- **Media Output:** `static/quiz-media/` (line: `game_modules/quiz/seed.py:42`)
- **Normalizer Default:** `content/quiz/topics` (line: `scripts/quiz_units_normalize.py:32`)

### 2.2 Production Workflow (Server)

```
1. Prepare Release (Outside Repo)
   └── C:\content\games_hispanistica\2026-01-06_1430\
       ├── units\
       │   ├── topic1.json
       │   └── topic2.json
       └── audio\
           ├── topic1.media\
           └── topic2.media\

2. Upload to Server
   └── rsync -avz <local_path> user@server:/srv/webapps/games_hispanistica/media/releases/<release_id>/

3. Import via CLI
   └── ./manage import-content --units-path media/releases/<release_id>/units --audio-path media/releases/<release_id>/audio --release <release_id>

   OR via Admin Dashboard
   └── POST /quiz-admin/api/releases/<release_id>/import

4. Publish Release
   └── ./manage publish-release --release <release_id>
   └── Sets status='published', unpublishes previous release

5. Verify
   └── https://games.hispanist.ica.de/games/quiz
```

**Production Paths:**
- **Releases:** `media/releases/<release_id>/` (symlinked to `media/current/`)
- **Static Media:** `static/quiz-media/` (copied during import)
- **Import Logs:** `data/import_logs/<release_id>_<timestamp>.log`

### 2.3 Schema Versions

| Version | Status | Features | Verified |
|---------|--------|----------|----------|
| **quiz_unit_v1** | Legacy | Single media object per question/answer | ✅ |
| **quiz_unit_v2** | Current | Media arrays (multiple audio/image per question) | ✅ |

**Both versions supported** by validation layer (`game_modules/quiz/validation.py:321`).

**Key Differences:**
- **v1:** `media: {"type": "audio", "url": "..."}` (nullable)
- **v2:** `media: [{"id": "m1", "type": "audio", "seed_src": "..."}]` (array)

**Normalizer auto-converts v1 → v2** during normalization (line: `scripts/quiz_units_normalize.py:64-80`).

---

## 3. Admin Import Contract

### 3.1 Admin API Endpoints

| Endpoint | Method | Auth | Purpose | Verified |
|----------|--------|------|---------|----------|
| `/quiz-admin/` | GET | JWT + ADMIN | Admin Dashboard HTML | ✅ |
| `/quiz-admin/api/releases` | GET | JWT + ADMIN | List all releases | ✅ |
| `/quiz-admin/api/releases/<id>` | GET | JWT + ADMIN | Get release details | ✅ |
| `/quiz-admin/api/releases/<id>/import` | POST | JWT + ADMIN | Import release (create draft) | ✅ |
| `/quiz-admin/api/releases/<id>/publish` | POST | JWT + ADMIN | Publish release | ✅ |
| `/quiz-admin/api/releases/<id>/unpublish` | POST | JWT + ADMIN | Unpublish release | ✅ |
| `/quiz-admin/api/units` | GET | JWT + ADMIN | List all units | ✅ |
| `/quiz-admin/api/units/bulk-update` | POST | JWT + ADMIN | Bulk update (is_active) | ✅ |

**Auth:** Flask-JWT-Extended + `@require_role(Role.ADMIN)`  
**No ENV-based keys** (`QUIZ_ADMIN_KEY` deprecated, removed in production).

### 3.2 Import Payload Contract

**CLI:**
```bash
./manage import-content \
  --units-path media/releases/<release_id>/units \
  --audio-path media/releases/<release_id>/audio \
  --release <release_id> \
  [--dry-run]
```

**Dashboard API:**
```http
POST /quiz-admin/api/releases/<release_id>/import
Authorization: Bearer <jwt_token>
Content-Type: application/json

{} # No body, reads from filesystem
```

**Import Logic** (`game_modules/quiz/import_service.py:204`):
1. Validate units_path and audio_path exist
2. Load all `*.json` files from units_path
3. Validate each unit (schema + content)
4. Calculate audio file hashes
5. Upsert topics and questions (by topic_id/question_id)
6. Copy audio files to `static/quiz-media/`
7. Create/update QuizContentRelease record (status='draft')
8. Log to `data/import_logs/<release_id>_<timestamp>.log`

**Exit Codes (CLI):**
- `0`: Success
- `2`: Validation error
- `3`: Filesystem error (path not found)
- `4`: Database error

### 3.3 Publish Contract

**Effect:**
- Sets `status='published'` and `published_at=NOW()` for release
- Sets `is_active=true` for all topics/questions in release
- **Auto-unpublishes previous release** (only one published at a time)

**Idempotent:** Multiple publishes of same release = no-op.

---

## 4. Production vs Dev Delta

| Aspect | DEV | Production | Notes |
|--------|-----|------------|-------|
| **Content Source** | `content/quiz/topics/` | `media/releases/<release_id>/units/` | DEV: in-repo, Prod: external |
| **Import Method** | `scripts/quiz_seed.py` | `./manage import-content` or Dashboard | DEV: direct DB seed, Prod: import service |
| **Release Tracking** | No | Yes (QuizContentRelease table) | Prod tracks versions |
| **Publish Step** | No | Yes (explicit publish) | DEV: all active by default |
| **Auth** | Optional | Required (JWT + ADMIN role) | Prod: secure admin access |
| **Logging** | Console | `data/import_logs/` | Prod: persistent audit trail |
| **Media Handling** | Copy from `seed_src` | Copy from `audio_path` | Same logic, different source |

---

## 5. Risk Register (Mechanics Changes)

### 5.1 High Impact, High Likelihood

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Changing QUESTIONS_PER_DIFFICULTY** | Breaks question selection algorithm, leaderboard comparison invalid | ⚠️ Migration script to recalculate historical runs |
| **Changing POINTS_PER_DIFFICULTY** | Breaks scoring, leaderboard comparison invalid | ⚠️ Version scoring, separate leaderboards |
| **Changing TIMER_SECONDS** | Breaks run_questions.time_limit_seconds logic | ⚠️ Check all timer references (services.py:795, routes.py) |
| **Adding new question types** | Breaks validation, frontend rendering, scoring | ⚠️ Schema migration + frontend update |

### 5.2 High Impact, Low Likelihood

| Risk | Impact | Mitigation |
|------|--------|------------|
| **DB schema change (answers JSONB)** | Requires migration of all questions | ⚠️ Write migration script, test on staging |
| **Changing run_questions structure** | Breaks in-progress runs | ⚠️ Version field, backward compat layer |

### 5.3 Medium Impact

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Joker logic change** | Affects fairness, historical scores incomparable | Test extensively, document in changelog |
| **Time bonus formula change** | Affects scoring, leaderboard ranking | Version formula, separate leaderboards |

### 5.4 Low Impact

| Risk | Impact | Mitigation |
|------|--------|------------|
| **UI changes** | Visual inconsistencies | Test on multiple devices, MD3 compliance |
| **Content validation rules** | May reject valid old content | Test against all existing units |

---

## 6. Known Issues & Tech Debt

### 6.1 Critical

None identified.

### 6.2 High Priority

1. **YAML Documentation Staleness** (P2)
   - **Issue:** docs/components/quiz/README.md references YAML format (lines 29-31, 138-141)
   - **Impact:** Confusing for new contributors
   - **Fix:** Update to JSON examples, mark YAML as deprecated

2. **Inconsistent Path References** (P2)
   - **Issue:** Some docs reference `game_modules/quiz/content/topics/` (old location)
   - **Current:** `content/quiz/topics/` (correct)
   - **Fix:** Update all docs to use current path

### 6.3 Medium Priority

1. **No automated schema migration testing**
   - **Issue:** Changes to JSONB fields (answers, run_questions) not covered by tests
   - **Impact:** Risk of data corruption during migrations
   - **Fix:** Add migration tests to test suite

2. **Question ID generation not documented in code**
   - **Issue:** ULID format (`{slug}_q_{ULID}`) only in docs
   - **Impact:** Hard to understand ID structure from code alone
   - **Fix:** Add docstring to `generate_question_id()` function

### 6.4 Low Priority

1. **DEV vs Production workflow split in docs**
   - **Issue:** Content workflow explained in multiple places (ARCHITECTURE.md, CONTENT.md, games_hispanistica_production.md)
   - **Impact:** Duplication, risk of inconsistency
   - **Fix:** Single OPERATIONS.md with clear DEV/Prod split

---

## 7. Test Coverage

### 7.1 Existing Tests

| Test File | Coverage | Notes |
|-----------|----------|-------|
| `test_quiz_module.py` | Run lifecycle, scoring | ✅ Core mechanics |
| `test_quiz_gold.py` | E2E gameplay, timer | ✅ Golden path |
| `test_quiz_admin.py` | Admin API, auth | ✅ Import/publish |
| `test_import_service.py` | Import logic, validation | ✅ Service layer |
| `test_quiz_unit.py` | JSON schema validation | ✅ Content format |
| `test_quiz_contract_api.py` | API contracts | ✅ Public endpoints |
| `test_quiz_release_filtering.py` | Release visibility | ✅ Draft vs published |

### 7.2 Missing Tests (Critical for Mechanics Changes)

1. **Question selection algorithm regression tests**
   - Test weighted selection maintains fairness
   - Test history tracking across multiple runs

2. **Scoring edge cases**
   - Test timer expiry at exactly 0ms
   - Test joker + timeout interaction
   - Test level completion with partial correctness

3. **Migration tests**
   - Test JSONB field changes don't corrupt data
   - Test backward compatibility layers

4. **Performance tests**
   - Test question selection with large question banks
   - Test leaderboard query performance

---

## 8. Breakpoints for Mechanics Changes

### 8.1 Services Layer (`game_modules/quiz/services.py`)

| Function | Line | Impact | Dependencies |
|----------|------|--------|--------------|
| `start_or_resume_run()` | 565 | Question selection, run init | QuizRun, QuizQuestion, QUESTIONS_PER_DIFFICULTY |
| `_select_questions_weighted()` | 642 | Question distribution algorithm | QUESTIONS_PER_DIFFICULTY, HISTORY_RUNS_COUNT |
| `start_question()` | 795 | Timer initialization | TIMER_SECONDS, MEDIA_BONUS_SECONDS |
| `submit_answer()` | 851 | Scoring, timeout check | POINTS_PER_DIFFICULTY, timer validation |
| `use_joker()` | 1029 | Joker logic (eliminate 2 wrong) | run_questions.joker_disabled |
| `finish_run()` | 1201 | Final score calculation, token logic | POINTS_PER_DIFFICULTY, token rules |

### 8.2 Routes Layer (`game_modules/quiz/routes.py`)

| Endpoint | Line | Impact | Dependencies |
|----------|------|--------|--------------|
| `/api/quiz/<topic_id>/run/start` | 683 | Calls `start_or_resume_run()` | services.py |
| `/api/quiz/run/<run_id>/question/start` | 775 | Calls `start_question()` | services.py, timer logic |
| `/api/quiz/run/<run_id>/answer` | 838 | Calls `submit_answer()` | services.py, scoring |
| `/api/quiz/run/<run_id>/joker` | 1050 | Calls `use_joker()` | services.py, joker rules |
| `/api/quiz/run/<run_id>/finish` | 1195 | Calls `finish_run()` | services.py, leaderboard |

### 8.3 Frontend (`static/js/games/quiz-play.js`)

| State | Function | Impact | Dependencies |
|-------|----------|--------|--------------|
| QUESTION | `renderQuestion()` | Display question, start timer | Timer UI, answer rendering |
| QUESTION | `handleAnswerSelect()` | Submit answer, show feedback | `/api/quiz/run/<run_id>/answer` |
| LEVEL_UP | `renderLevelUp()` | Show bonus animation | Scoring display, token count |
| FINISH | `renderFinish()` | Show final score, leaderboard | `/api/quiz/run/<run_id>/finish` |

### 8.4 Database Schema

| Table | Field | Impact | Migration Required |
|-------|-------|--------|-------------------|
| `quiz_runs` | `run_questions` (JSONB) | Structure change breaks in-progress runs | ⚠️ Yes |
| `quiz_questions` | `answers` (JSONB) | Structure change requires migration | ⚠️ Yes |
| `quiz_run_answers` | `time_taken_ms` | Scoring formula change affects history | ⚠️ Maybe |
| `quiz_scores` | `tokens_count` | Token logic change invalidates leaderboard | ⚠️ Yes |

---

## 9. Verification Commands

### 9.1 Content Pipeline

```bash
# Check current content path
rg "QUIZ_UNITS_TOPICS_DIR" game_modules/quiz/seed.py

# Check normalization default
rg "default.*topics" scripts/quiz_units_normalize.py

# Check all JSON units
ls content/quiz/topics/*.json

# Validate schema versions
rg "quiz_unit_v[12]" content/quiz/topics/*.json
```

### 9.2 Code References

```bash
# Find all timer references
rg "TIMER_SECONDS|time_limit_seconds" game_modules/quiz/

# Find all scoring references
rg "POINTS_PER_DIFFICULTY|calculate.*score" game_modules/quiz/

# Find all joker references
rg "JOKERS_PER_RUN|use_joker|joker_disabled" game_modules/quiz/

# Find question selection logic
rg "_select_questions|questions_per_difficulty" game_modules/quiz/services.py
```

### 9.3 Database State

```sql
-- Check active releases
SELECT release_id, status, units_count, published_at 
FROM quiz_content_releases 
ORDER BY created_at DESC;

-- Check active topics
SELECT id, title_key, is_active, release_id, order_index 
FROM quiz_topics 
WHERE is_active = true 
ORDER BY order_index;

-- Check question distribution
SELECT topic_id, difficulty, COUNT(*) 
FROM quiz_questions 
WHERE is_active = true 
GROUP BY topic_id, difficulty 
ORDER BY topic_id, difficulty;
```

---

## 10. Recommendations

### 10.1 Before Mechanics Changes

1. **Freeze content schema** during mechanics development
2. **Create staging environment** with production data snapshot
3. **Version the game mechanics** (add `mechanics_version` to QuizRun)
4. **Add feature flags** for new mechanics (gradual rollout)
5. **Update all tests** to cover new mechanics before implementation

### 10.2 Documentation Updates Needed

1. **Create OPERATIONS.md** – single source for DEV/Prod workflows
2. **Update README.md** – remove YAML references, add JSON examples
3. **Create GLOSSARY.md** – define Topic/Unit/Run/Question/Release terms
4. **Update ARCHITECTURE.md** – clarify mechanics version strategy

### 10.3 Technical Improvements

1. **Add QuizRun.mechanics_version field** – track which rules apply
2. **Add migration script template** – standardize JSONB migrations
3. **Add performance benchmarks** – track question selection speed
4. **Add content validation CI step** – catch schema errors early

---

## Appendix A: File Locations (Verified)

### Runtime Code
```
game_modules/quiz/
├── __init__.py                    # Module registration
├── models.py                      # ORM (8 tables)
├── services.py                    # Business logic (1366 lines)
├── routes.py                      # Public API (1467 lines)
├── validation.py                  # JSON schema validation (712 lines)
├── seed.py                        # DEV seeding (581 lines)
├── import_service.py              # Production import (683 lines)
└── release_model.py               # Release tracking (45 lines)
```

### Admin Code
```
src/app/routes/quiz_admin.py       # Admin API (675 lines)
templates/admin/quiz_content.html  # Admin Dashboard UI
static/js/admin/quiz_content.js    # Admin Dashboard JS
```

### Scripts
```
scripts/
├── quiz_seed.py                   # DEV: Normalize + seed + prune
├── quiz_units_normalize.py        # Normalize JSON (IDs, stats)
└── init_quiz_db.py                # Create tables + demo data
```

### Content
```
content/quiz/
├── topics/
│   ├── aussprache.json           # 7 active topics
│   ├── kreativitaet.json
│   ├── orthographie.json
│   ├── test_quiz.json
│   ├── variation_aussprache.json
│   ├── variation_grammatik.json
│   └── variation_test_quiz.json
└── README.md
```

### Documentation
```
docs/components/quiz/
├── README.md                      # Overview (needs YAML → JSON update)
├── ARCHITECTURE.md                # Architecture (current, but DEV-focused)
├── CONTENT.md                     # Content authoring guide (current)
├── MODULE_README.md               # Installation + features (stale paths)
├── INVENTORY_game_modules_quiz.md # Detailed inventory
├── CLEANUP_REPORT.md              # YAML deprecation history
└── CLEANUP_COMPLETE.md            # Path migration history
```

---

## Appendix B: Schema Examples

### quiz_unit_v2 (Current Format)

```json
{
  "schema_version": "quiz_unit_v2",
  "slug": "test_quiz",
  "title": "Test Quiz mit Audio",
  "description": "Testet Audio-Medien in Frage und Antwort.",
  "authors": ["DEV"],
  "is_active": true,
  "order_index": 999,
  "questions_statistics": {
    "1": 1
  },
  "questions": [
    {
      "id": "test_quiz_q_01KE59P9SVXJF4WMBPGHSJXDK6",
      "difficulty": 1,
      "type": "single_choice",
      "prompt": "Aus welchem Land stammt diese Sprecher:in?",
      "explanation": "Wenn du das siehst, hat das Rendering funktioniert.",
      "media": [
        {
          "id": "m1",
          "type": "audio",
          "seed_src": "test_quiz.media/q01_audio_1.mp3",
          "label": "Sprecher:in 1"
        }
      ],
      "answers": [
        {
          "id": "a1",
          "text": "Antwort A",
          "correct": false,
          "media": []
        },
        {
          "id": "a2",
          "text": "Antwort B (hat Audio)",
          "correct": true,
          "media": [
            {
              "id": "m1",
              "type": "audio",
              "seed_src": "test_quiz.media/q01_a2_audio_1.mp3",
              "label": "Antwort B Audio"
            }
          ]
        }
      ],
      "sources": [],
      "meta": {}
    }
  ]
}
```

### run_questions Structure (JSONB)

```json
[
  {
    "question_id": "topic_slug_q_01KE59P9SVXJF4WMBPGHSJXDK6",
    "difficulty": 1,
    "answers_order": [2, 1, 4, 3],
    "joker_disabled": [],
    "time_limit_seconds": 30,
    "started_at_ms": null,
    "answered_at_ms": null
  }
]
```

---

**End of Audit Report**  
**Next Steps:** Review risk register, update documentation (see Section 10.2), implement mechanics changes incrementally.
