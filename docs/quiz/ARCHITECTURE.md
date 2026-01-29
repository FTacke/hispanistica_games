# Quiz System – Architecture

**Purpose:** System-Design, Mechanik-Invarianten, Breakpoints für Änderungen

---

## System Boundaries

### What Quiz IS

- **Standalone game module** mit eigener Player-DB
- **PostgreSQL-only** (keine SQLite-Unterstützung)
- **10-Fragen-Runs** (5 Difficulty-Levels × 2 Fragen)
- **Timer-enforced** (Server validiert Deadlines)
- **Release-basiert** (Production: Draft → Published)

### What Quiz is NOT

- **Kein Webapp-Auth-System** (separate Player-Authentifizierung)
- **Keine i18n** (Plaintext-Content in JSON)
- **Kein dynamischer Content** (keine User-Generated-Questions)
- **Kein Multiplayer** (jeder Run ist single-player)

---

## Terminology (verbindlich)

| Begriff | Definition | Beispiel |
|---------|------------|----------|
| **Unit** | JSON-Datei mit einem Topic | `aussprache.json` |
| **Topic** | Ein thematisches Quiz (id = slug) | `"aussprache"` |
| **Question** | Eine Frage (ULID-basierte ID) | `"aussprache_q_01KE59P9..."` |
| **Answer** | Eine Antwort-Option (genau 1 correct=true) | `{"id":"a1","text":"...","correct":true}` |
| **Run** | Ein Durchlauf (10 Fragen) | UUID, status: in_progress/finished |
| **Level** | Ein Difficulty-Tier (2 Fragen) | Level 1 = Questions 0-1 (difficulty=1) |
| **Token** | Erfolgsmetrik (0-3 pro Level) | 3 = beide korrekt, 2 = eine korrekt, 1 = Joker, 0 = falsch |
| **Joker** | 50:50 Hilfe (eliminiert 2 falsche) | 2× pro Run verfügbar |
| **Release** | Versioniertes Content-Paket | `release_20260106_1430_a7x2` |
| **Draft** | Importiert, nicht sichtbar | `status='draft'` |
| **Published** | Sichtbar für Spieler | `status='published'` (nur 1 gleichzeitig) |

**Keine Synonyme:** Verwende diese Begriffe konsistent.

---

## Game Mechanics

### Run Structure

```
Run (10 Questions)
├─ Level 1 (difficulty=1): Q0, Q1
├─ Level 2 (difficulty=2): Q2, Q3
├─ Level 3 (difficulty=3): Q4, Q5
├─ Level 4 (difficulty=4): Q6, Q7
└─ Level 5 (difficulty=5): Q8, Q9
```

**Konstanten (in `services.py`):**
- `QUESTIONS_PER_RUN = 10`
- `DIFFICULTY_LEVELS = 5`
- `QUESTIONS_PER_DIFFICULTY = 2`
- `TIMER_SECONDS = 30`
- `MEDIA_BONUS_SECONDS = 10` (extra time wenn Media vorhanden)
- `JOKERS_PER_RUN = 2`

### Question Selection

**Algorithmus** (`services.py:642` – `_select_questions_weighted()`):

1. **Phase 1 (erster Run):** Pure Random-Selection per Difficulty
2. **Phase 2 (nachfolgende Runs):**
   - Berechne Weight: `weight = 1.0 / (1.0 + times_answered)`
   - Weighted Random: Fragen mit weniger Antworten wahrscheinlicher
   - History: Letzte `HISTORY_RUNS_COUNT=3` Runs, max `MAX_HISTORY_QUESTIONS_PER_RUN=2` pro Run

**Invarianten:**
- Genau 2 Fragen pro Difficulty
- Keine Frage doppelt in einem Run
- Keine garantierte Randomness zwischen Spielern (jeder bekommt unterschiedliche Fragen)

### Timer

**Enforcement:** Server-seitig in `services.py:851` (`submit_answer()`)

```python
if answered_at_ms > time_limit_ms:
    # Timeout → 0 Punkte
```

**Client-Timer:** Nur UI (countdown display), keine Validation.

**Time Limit Calculation:**
```python
time_limit = TIMER_SECONDS + (MEDIA_BONUS_SECONDS if question has media else 0)
```

### Scoring

**Base Points:**
```python
POINTS_PER_DIFFICULTY = {
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    5: 50
}
```

**Time Bonus:** (in `services.py:851`)
```python
if correct and time_taken < time_limit:
    time_bonus = calculate_time_bonus(difficulty, time_taken, time_limit)
```

**Token Calculation:** (per Level, 2 Fragen)
```python
if both_correct and no_joker_used:
    tokens = 3
elif one_correct and no_joker_used:
    tokens = 2
elif any_correct and joker_used:
    tokens = 1
else:
    tokens = 0
```

**Max Score per Run:**
- Base: 10+10 + 20+20 + 30+30 + 40+40 + 50+50 = 300 Punkte
- Time Bonus: Variabel
- Tokens: Max 15 (5 Levels × 3)

### Leaderboard (verbindlich)

**Code Truth** (`services.py:1347-1350`):
```python
.order_by(
    desc(QuizScore.total_score),  # Höchster Score zuerst
    asc(QuizScore.created_at)     # Ältester Eintrag gewinnt Ties
)
.limit(30)
```

**Meaning:**
- Sortierung: Erst nach Score (absteigend), dann nach Zeit (aufsteigend)
- Bei gleichem Score: Wer **zuerst** die Punktzahl erreicht hat, steht oben
- Filter: Keine anonymen Spieler (`~QuizPlayer.is_anonymous`)

**Invariante:** Diese Sortierung ist final. Kein "created_at DESC".

### Joker

**Logik** (`services.py:1029` – `use_joker()`):
- Eliminiert 2 **zufällige** falsche Antworten
- Speichert eliminierte IDs in `run_questions[i].joker_disabled`
- Kann nur verwendet werden **vor** Antwort
- Max 2× pro Run (`jokers_remaining` Counter)

**Frontend:** Disabled answers werden ausgegraut.

---

## Database Schema

### Core Tables

**quiz_players:**
- `id` (UUID, PK)
- `name` (String, max 50)
- `normalized_name` (Unique, lowercase)
- `pin_hash` (Argon2, nullable for anonymous)
- `is_anonymous` (Boolean)

**quiz_topics:**
- `id` (String, PK = slug)
- `title_key` (Text, plaintext title)
- `description_key` (Text, plaintext description)
- `authors` (ARRAY of strings)
- `is_active` (Boolean)
- `order_index` (Integer)
- `release_id` (String, FK to releases, nullable)

**quiz_questions:**
- `id` (Text, PK = ULID format)
- `topic_id` (String, FK)
- `difficulty` (Integer, 1-5)
- `type` (String, default "single_choice")
- `prompt_key` (Text, plaintext prompt)
- `explanation_key` (Text, plaintext explanation)
- `answers` (JSONB array: `[{id, text, correct, media}]`)
- `media` (JSONB array: `[{id, type, seed_src, label}]`)
- `sources` (JSONB array, optional)
- `meta` (JSONB, optional)
- `is_active` (Boolean)
- `release_id` (String, FK, nullable)

**quiz_runs:**
- `id` (UUID, PK)
- `player_id` (UUID, FK)
- `topic_id` (String, FK)
- `status` (String: in_progress/finished/abandoned)
- `run_questions` (JSONB array, siehe unten)
- `current_question_index` (Integer, 0-9)
- `jokers_remaining` (Integer, 0-2)
- `running_score` (Integer)
- `tokens_earned` (Integer)
- `created_at`, `finished_at`

**run_questions Structure (JSONB):**
```json
[
  {
    "question_id": "aussprache_q_01KE...",
    "difficulty": 1,
    "answers_order": [2, 1, 4, 3],
    "joker_disabled": [],
    "time_limit_seconds": 30,
    "started_at_ms": 1673012735000,
    "answered_at_ms": null
  }
]
```

**quiz_run_answers:**
- `run_id` (UUID, FK)
- `question_index` (Integer, 0-9)
- `question_id` (Text)
- `selected_answer_id` (String, nullable if timeout)
- `is_correct` (Boolean)
- `time_taken_ms` (Integer)
- `answered_at` (Timestamp)

**quiz_scores:**
- `id` (UUID, PK)
- `run_id` (UUID, Unique FK)
- `player_id` (UUID, FK)
- `player_name` (String, denormalized)
- `topic_id` (String, FK)
- `total_score` (Integer)
- `tokens_count` (Integer)
- `created_at` (Timestamp)
- **Index:** `(topic_id, total_score DESC, created_at ASC)`

**quiz_content_releases:**
- `release_id` (String, PK)
- `status` (String: draft/published/unpublished)
- `units_count`, `questions_count`, `audio_count` (Integer)
- `imported_at`, `published_at`, `unpublished_at` (Timestamp, nullable)

---

## API Contracts

### Public Endpoints

**GET /api/quiz/topics**
- Response: `{"topics": [{id, title_key, description_key, authors, question_count}]}`
- Filter: `is_active=true`
- Sort: `order_index`

**POST /api/quiz/<topic_id>/run/start**
- Request: `{}`
- Response: `{"run_id", "question": {...}, "progress": {...}}`
- Idempotent: Resume wenn `in_progress` Run existiert

**POST /api/quiz/run/<run_id>/answer**
- Request: `{"answer_id": "a2", "answered_at_ms": 1673012745000}`
- Response: `{"correct": true, "points": 10, "running_score": 10, "level_complete": false}`
- Timeout Check: Server validiert `answered_at_ms <= started_at_ms + time_limit_ms`

**POST /api/quiz/run/<run_id>/joker**
- Request: `{"question_index": 3}`
- Response: `{"eliminated_answers": ["a2", "a4"], "jokers_remaining": 1}`
- Error: `{"error": "no_jokers"}` wenn `jokers_remaining == 0`

**POST /api/quiz/run/<run_id>/finish**
- Request: `{}`
- Response: `{"total_score": 245, "tokens_count": 12, "rank": 5, "breakdown": [...]}`
- Idempotent: Mehrfache Calls geben gleiches Result

### Admin Endpoints (JWT + ADMIN Role)

**POST /quiz-admin/api/releases/<release_id>/import**
- Request Body: **LEER** (paths aus filesystem)
- Response: `{"ok": true, "units_imported": 7, "questions_imported": 142}`
- Effekt: Liest von `media/releases/<release_id>/units/` und `/audio/`

**POST /quiz-admin/api/releases/<release_id>/publish**
- Request Body: **LEER**
- Response: `{"ok": true, "units_affected": 7}`
- Effekt: Sets `status='published'`, unpublished previous release

---

## Invariants (DO NOT BREAK)

### Database Integrity

1. `quiz_runs.run_questions` ist valid JSONB (10 items)
2. Jeder Run hat exakt 10 Fragen (außer QUESTIONS_PER_RUN ändert sich)
3. `quiz_run_answers.question_index` ist 0-9
4. `quiz_scores.run_id` ist unique (ein Score pro Run)
5. Nur eine Published Release (`SELECT COUNT(*) WHERE status='published' <= 1`)

### Scoring Consistency

1. Total Score ist **deterministisch** (gleiche Inputs → gleicher Output)
2. Total Score ist **monoton** (mehr Correct → höher oder gleich)
3. Time Bonus ist **non-negative** (nie negativ)
4. Token Count ist **0-15** (5 Levels × 3)

### Timer Enforcement

1. Server validiert Deadline (Client-Timer nur UI)
2. Timeout Answers → 0 Points (nie awarded)
3. Timer startet nur nach Question Start API Call

### Question Selection

1. Jeder Run hat 2 Fragen pro Difficulty (außer Distribution ändert sich)
2. Questions randomized (keine predictable order)
3. Weighted Selection bevorzugt weniger-beantwortete (fairness)
4. Keine Frage zweimal in selben Run

### Leaderboard

1. Sortierung: `total_score DESC`, `created_at ASC` (fixes)
2. Nur registered Players (keine anonymen)
3. Limit 30

---

## Code Breakpoints

**Wenn du Mechanik änderst, prüfe diese Functions:**

### services.py

| Function | Line | Affected by |
|----------|------|-------------|
| `start_or_resume_run()` | ~565 | QUESTIONS_PER_RUN, QUESTIONS_PER_DIFFICULTY |
| `_select_questions_weighted()` | ~642 | Question selection algorithm, HISTORY_* |
| `start_question()` | ~795 | TIMER_SECONDS, MEDIA_BONUS_SECONDS |
| `submit_answer()` | ~851 | POINTS_PER_DIFFICULTY, timeout logic, token calc |
| `use_joker()` | ~1029 | JOKERS_PER_RUN, elimination logic |
| `finish_run()` | ~1201 | Final score, token totals, leaderboard insert |
| `get_leaderboard()` | ~1330 | Leaderboard sort order, limit |

### routes.py

| Endpoint | Line | Dependencies |
|----------|------|--------------|
| `/api/quiz/<topic_id>/run/start` | ~683 | `start_or_resume_run()` |
| `/api/quiz/run/<run_id>/question/start` | ~775 | `start_question()` |
| `/api/quiz/run/<run_id>/answer` | ~838 | `submit_answer()` |
| `/api/quiz/run/<run_id>/joker` | ~1050 | `use_joker()` |
| `/api/quiz/run/<run_id>/finish` | ~1195 | `finish_run()` |

### Frontend (quiz-play.js)

| State | Function | Dependencies |
|-------|----------|--------------|
| QUESTION | `renderQuestion()` | Timer display, answer rendering |
| QUESTION | `handleAnswerSelect()` | `/api/.../answer` contract |
| LEVEL_UP | `renderLevelUp()` | Bonus animation, token display |
| FINISH | `renderFinish()` | `/api/.../finish` contract, leaderboard |

---

## Mechanic Change Safety

**Bevor du Scoring, Timer, Selection oder Joker änderst:**

### Impact Assessment

**Fragen:**
1. Betrifft die Änderung **historische Runs**?
   - Ja → Können alte/neue Runs fair verglichen werden?
2. Betrifft die Änderung **Leaderboard-Ranking**?
   - Ja → Separate Leaderboards? Version-Field?
3. Betrifft die Änderung **in-progress Runs**?
   - Ja → Migration oder Invalidierung?
4. Betrifft die Änderung **Content-Schema**?
   - Ja → Re-Normalisierung aller Units nötig?

**Risk Matrix:**

| Change | Impact | Mitigation |
|--------|--------|------------|
| QUESTIONS_PER_DIFFICULTY | 🔴 Critical | Separate leaderboards, migration script |
| POINTS_PER_DIFFICULTY | 🔴 Critical | Version scoring, separate leaderboards |
| TIMER_SECONDS | 🟠 High | Test timeout logic, update docs |
| Token rules | 🟠 High | Version mechanics field, changelog |
| New question types | 🟠 High | Schema migration, frontend update |
| Joker logic | 🟡 Medium | Test fairness, document |
| Time bonus formula | 🟡 Medium | Version formula, update tests |
| UI-only changes | 🟢 Low | Visual tests |

### Required Tests

**Unit:**
- [ ] Question selection (weighted, history)
- [ ] Scoring (all difficulties, time bonus)
- [ ] Token calculation (all combinations)
- [ ] Joker elimination (edge cases)
- [ ] Timer validation (timeout, early submit)

**Integration:**
- [ ] Full run (start → 10 answers → finish)
- [ ] Leaderboard insertion (ties, duplicates)
- [ ] Resume (in-progress state)

**E2E (Manual):**
- [ ] Play 3 full runs
- [ ] Test joker (both uses)
- [ ] Test timeout (let timer expire)
- [ ] Check leaderboard (correct rank)

### Migration Strategy

**If changing JSONB fields (run_questions, answers):**

1. **Add Version Field:**
   ```sql
   ALTER TABLE quiz_runs ADD COLUMN mechanics_version INTEGER DEFAULT 1;
   ```

2. **Write Migration Script:**
   ```python
   # scripts/migrate_mechanics_v2.py
   def migrate_run_questions_v1_to_v2(old_data):
       return new_data
   ```

3. **Backward Compatibility:**
   ```python
   def load_run_questions(run):
       if run.mechanics_version == 1:
           return load_v1(run.run_questions)
       return load_v2(run.run_questions)
   ```

4. **Deploy:**
   - Deploy backward-compat code first
   - Run migration
   - Remove compat layer after full migration

### Documentation Updates

**Nach Mechanik-Änderung:**
- [ ] Update constants in this file
- [ ] Update game rules in README.md
- [ ] Document breaking changes in CHANGELOG.md
- [ ] Update API contracts if response format changed

---

## Frontend Architecture

### State Machine (quiz-play.js)

**States:**
1. **QUESTION** – Display question, timer, answers
2. **LEVEL_UP** – Show bonus, animate score (after Q1, Q3, Q5, Q7, Q9)
3. **FINISH** – Final score, leaderboard, rank

**Transitions:**
- QUESTION → (submit answer) → QUESTION (if not level complete)
- QUESTION → (submit answer) → LEVEL_UP (if level complete)
- LEVEL_UP → (continue) → QUESTION (if more questions)
- LEVEL_UP → (continue) → FINISH (if run complete)

### Timer Display

**Client-Side:**
- Countdown von `time_limit_seconds` bis 0
- Visuelles Feedback (progress bar, color change)
- Bei 0: Auto-submit (mit `answered_at_ms = deadline`)

**Server-Side:**
- Validiert `answered_at_ms <= started_at_ms + time_limit_ms`
- Timeout → `is_correct = false`, `points = 0`

**Important:** Client-Timer ist **nur UI**. Server hat final say.

---

## Design System

**Material Design 3:**
- Tokens: `static/css/md3/tokens.css`
- Quiz Styles: `static/css/games/quiz.css`

**Key Components:**
- `md3-card` – Topic cards, question card
- `md3-button` – Answer buttons, action buttons
- `md3-progress` – Timer progress bar
- `md3-badge` – Difficulty badges, token count

**Color Scheme:**
- Correct: `--md-sys-color-tertiary` (green)
- Wrong: `--md-sys-color-error` (red)
- Joker: `--md-sys-color-secondary` (orange)

---

## Performance Considerations

**Question Selection:**
- Weighted random: O(n) per difficulty (n = questions in DB)
- History query: Last 3 runs (limited by HISTORY_RUNS_COUNT)
- **Bottleneck:** Large question banks (>1000 per topic)

**Leaderboard Query:**
- Index: `(topic_id, total_score DESC, created_at ASC)`
- Limit 30: Fast auch bei vielen Scores

**Import:**
- Audio hash calculation: CPU-bound (SHA256)
- File copy: I/O-bound
- **Optimization:** Pre-calculate hashes, parallel processing

---

**This document is the single source of truth for Quiz architecture.**
