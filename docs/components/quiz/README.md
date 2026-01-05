# quiz Component

**Purpose:** Interactive multiple-choice quiz game with timer, jokers, leaderboard.

**Scope:** Complete quiz game module (player auth, run management, scoring). Separate from webapp auth (see [auth](../auth/)).

---

## Responsibility

1. **Player Management** - Register/login with pseudonym + 4-digit PIN (separate from webapp users)
2. **Run Lifecycle** - Start, resume, restart, finish quiz runs
3. **Question Selection** - History-weighted randomization per difficulty level
4. **Timer Enforcement** - 30-second deadline per question (server-side validation)
5. **Joker System** - 50:50 joker (2× per run, eliminates 2 wrong answers)
6. **Scoring** - Token calculation (3/2/1/0 per difficulty level based on correctness)
7. **Leaderboard** - Top 30 scores per topic

---

## Key Files

| Path | Purpose |
|------|---------|
| `game_modules/quiz/__init__.py` | Module entry point |
| `game_modules/quiz/routes.py` | Flask blueprint (pages + API) |
| `game_modules/quiz/models.py` | SQLAlchemy ORM models (PostgreSQL-only) |
| `game_modules/quiz/services.py` | Business logic (player auth, run management) |
| `game_modules/quiz/seed.py` | Database seeding from YAML |
| `game_modules/quiz/validation.py` | Content validation for YAML files |
| `game_modules/quiz/content/topics/` | Topic YAML files |
| `templates/games/quiz/` | Jinja2 templates |
| `static/js/games/quiz/` | Frontend JavaScript |
| `game_modules/quiz/styles/quiz.css` | Scoped CSS styles |

---

## Data Model

**PostgreSQL-ONLY** (no SQLite support).

### Tables

1. **quiz_players** - Game player accounts
   - `id` (UUID), `name`, `normalized_name` (unique), `pin_hash` (nullable for anonymous), `is_anonymous`
   - Separate from `auth.users` - quiz players authenticate with pseudonym + PIN

2. **quiz_sessions** - Session tokens
   - `id` (UUID), `player_id` (FK), `token_hash`, `expires_at`
   - Session cookie: `quiz_session_token` (30-day expiry)

3. **quiz_topics** - Topic definitions
   - `id` (string, e.g., "demo_topic"), `title_key`, `description_key`, `authors` (ARRAY), `based_on` (JSONB), `is_active`, `order_index`

4. **quiz_questions** - Question bank
   - `id` (string, e.g., "demo_topic.q1"), `topic_id` (FK), `question_text` (JSONB), `difficulty_level` (1-5), `answers` (JSONB array), `correct_index` (int)
   - **Answers format:** `[{"text": "...", "help_text": "..."}, ...]`

5. **quiz_runs** - Run state
   - `id` (UUID), `player_id` (FK), `topic_id` (FK), `state` (enum: in_progress, completed, abandoned), `question_sequence` (ARRAY of question IDs), `current_question_index`, `current_question_deadline` (Unix timestamp), `jokers_remaining`, `score`, `tokens_earned`

6. **quiz_run_answers** - Answer records
   - `run_id` (FK), `question_index`, `question_id`, `selected_index` (nullable), `is_correct`, `answered_at`, `time_taken_ms`

7. **quiz_scores** - Highscore snapshots
   - `id` (UUID), `run_id` (FK, unique), `player_name`, `topic_id` (FK), `total_score`, `tokens_count`, `created_at`
   - Indexed: `(topic_id, total_score DESC, tokens_count DESC, created_at DESC)` for leaderboard

---

## Game Rules

**Run Structure:** 10 questions = 5 difficulty levels × 2 questions each  
**Timer:** 30 seconds per question (server enforces deadline)  
**Jokers:** 2× per run (50:50 eliminates 2 wrong answers)  
**Scoring:**
- **Per Question:** `base_points = difficulty_level * 10` (10/20/30/40/50 points)
- **Timeouts/Wrong:** 0 points
- **Per Difficulty Level:** 3/2/1/0 tokens based on performance:
  - Both correct: 3 tokens
  - One correct: 2 tokens
  - One correct after using joker: 1 token
  - Zero correct: 0 tokens

**Final Score:** Sum of base points + time bonus  
**Leaderboard:** Sorted by total score DESC, tokens DESC, created_at DESC (top 30)

---

## Question Selection Algorithm

**Phase 1 (1st run):** Pure random selection per difficulty level  
**Phase 2 (subsequent runs):**
1. Calculate weight for each question: `weight = 1.0 / (1.0 + times_answered)`
2. Weighted random selection: questions answered fewer times are more likely
3. Prevents repetition while maintaining randomness

**See:** `QuizService._select_questions_weighted()` in `services.py`

---

## API Endpoints

**Base URL:** `/games/quiz`

### Pages

- `GET /games/quiz` - Topic selection page
- `GET /games/quiz/<topic_id>` - Topic entry (login/resume)
- `GET /games/quiz/<topic_id>/play` - Quiz gameplay page

### Authentication

- `POST /api/quiz/auth/register` - Register player (pseudonym + PIN)
- `POST /api/quiz/auth/login` - Login player
- `POST /api/quiz/auth/logout` - Logout (delete session)

### Topics

- `GET /api/quiz/topics` - List active topics
- `GET /api/quiz/topics/<id>/leaderboard` - Leaderboard (top 30)

### Runs

- `POST /api/quiz/<topic_id>/run/start` - Start new run or resume
- `POST /api/quiz/<topic_id>/run/restart` - Restart run (abandon current)
- `GET /api/quiz/<topic_id>/run/current` - Get current question
- `POST /api/quiz/<topic_id>/run/answer` - Submit answer
- `POST /api/quiz/<topic_id>/run/joker` - Use 50:50 joker
- `POST /api/quiz/<topic_id>/run/finish` - Complete run (create score)

**See:** [routes.py](../../../game_modules/quiz/routes.py) for detailed request/response schemas.

---

## Content Format

**Location:** `game_modules/quiz/content/topics/<topic_id>.yml`

**YAML Structure:**
```yaml
topic_id: "demo_topic"
title_key: "Demo Topic"
description_key: "Practice questions for beginners"
authors:
  - "Author Name"
based_on:
  chapter_title: "Chapter 1"
  chapter_url: "https://example.com/chapter1"
  course_title: "Course Name"
  course_url: "https://example.com/course"
is_active: true
order_index: 0
questions:
  - question_id: "demo_topic.q1"
    difficulty_level: 1
    question_text:
      de: "What is 2+2?"
      en: "What is 2+2?"
    answers:
      - text:
          de: "3"
          en: "3"
        help_text:
          de: "Try again."
          en: "Try again."
      - text:
          de: "4"
          en: "4"
        help_text:
          de: "Correct!"
          en: "Correct!"
      - text:
          de: "5"
          en: "5"
        help_text:
          de: "Not quite."
          en: "Not quite."
      - text:
          de: "6"
          en: "6"
        help_text:
          de: "Incorrect."
          en: "Incorrect."
    correct_index: 1
```

**Validation:** `QuizContentValidator` in `validation.py`

---

## Database Seeding

**Script:** `scripts/init_quiz_db.py`

**Usage:**
```bash
# Seed demo topic
python scripts/init_quiz_db.py

# Seed specific topic
python scripts/init_quiz_db.py --topic-file game_modules/quiz/content/topics/my_topic.yml

# Dry-run (validate only)
python scripts/init_quiz_db.py --dry-run
```

**See:** `seed.py` for seeding logic.

---

## Frontend Architecture

**Templates:** `templates/games/quiz/`
- `list.html` - Topic selection
- `entry.html` - Login/resume page
- `play.html` - Quiz gameplay

**JavaScript:** `static/js/games/quiz/`
- `quiz-game.js` - Game state management, API client
- `quiz-timer.js` - Timer countdown
- `quiz-ui.js` - DOM updates, animations

**CSS:** `game_modules/quiz/styles/quiz.css` (scoped styles, loaded via manifest)

---

## Session Management

**Cookie Name:** `quiz_session_token`  
**Expiry:** 30 days  
**Storage:** Token hash in `quiz_sessions` table  
**Validation:** `QuizAuthService.get_current_player()` checks token hash + expiry

---

## Related Components

- **[database](../database/)** - Quiz uses separate PostgreSQL connection
- **[frontend-ui](../frontend-ui/)** - Templates, static assets
- **[auth](../auth/)** - Webapp auth (separate from quiz players)

---

**See Also:**
- Quiz README: [../../../game_modules/quiz/README.md](../../../game_modules/quiz/README.md)
- Module Manifest: [../../../game_modules/quiz/manifest.json](../../../game_modules/quiz/manifest.json)
- Main README: [../../README.md](../../README.md)
