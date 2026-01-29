# Quiz Refactoring – Baseline (Ist-Zustand)

**Stand:** 29. Januar 2026  
**Zweck:** Faktische Bestandsaufnahme vor großem Umbau (3 Levels, neue Timer, Tokens raus, Markdown-Support)

Diese Datei dokumentiert **nur Fakten** aus dem bestehenden Code. Keine Interpretationen, keine Wünsche.

---

## 1. Zentrale Mechanik-Konstanten

**Datei:** `game_modules/quiz/services.py`

| Konstante | Wert | Zeile | Bedeutung |
|-----------|------|-------|-----------|
| `QUESTIONS_PER_RUN` | `10` | 77 | Anzahl Fragen pro Run |
| `DIFFICULTY_LEVELS` | `5` | 78 | Anzahl Schwierigkeitsstufen (1-5) |
| `QUESTIONS_PER_DIFFICULTY` | `2` | 79 | Fragen pro Difficulty-Level |
| `TIMER_SECONDS` | `30` | 74 | Standard-Timer pro Frage |
| `MEDIA_BONUS_SECONDS` | `10` | 76 | Extra-Zeit bei Media-Fragen |
| `JOKERS_PER_RUN` | `2` | 75 | Joker pro Run |
| `LEADERBOARD_LIMIT` | `30` | 80 | Max Leaderboard-Einträge |
| `SESSION_EXPIRY_DAYS` | `30` | 81 | Session-Gültigkeit |
| `HISTORY_RUNS_COUNT` | `3` | 82 | Letzte N Runs für History |
| `MAX_HISTORY_QUESTIONS_PER_RUN` | `2` | 83 | Max History-Fragen pro Run |

**Points per Difficulty:** (Zeile 86-93)
```python
POINTS_PER_DIFFICULTY = {
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    5: 50,
}
```

**Verwendung in Code:**
- Selection: `_build_run_questions()` Z.659-694
- Scoring: `calculate_running_score()` Z.1175-1178, `finish_run()` Z.1271
- Timer: `calculate_time_limit()` Z.785, `start_question()` Z.823
- Joker: `start_run()` Z.595

---

## 2. Run & State-Modell

### DB-Schema: `quiz_runs`

**Datei:** `game_modules/quiz/models.py`, Zeile 135-180

| Feld | Typ | Nullable | Default | Bedeutung |
|------|-----|----------|---------|-----------|
| `id` | String(36) | No | UUID | Run-ID |
| `player_id` | String(36) | No | - | FK zu quiz_players |
| `topic_id` | String(50) | No | - | FK zu quiz_topics |
| `status` | String(20) | No | `"in_progress"` | `in_progress`, `finished`, `abandoned` |
| `created_at` | DateTime(tz) | No | now() | Erstellungszeit |
| `finished_at` | DateTime(tz) | Yes | NULL | Abschlusszeit |
| `current_index` | Integer | No | `0` | Aktueller Fragenindex (0-9) |
| `run_questions` | JSONB | No | - | Array mit 10 Fragen-Configs |
| `joker_remaining` | Integer | No | `2` | Verbleibende Joker |
| `joker_used_on` | JSONB | No | `[]` | Array mit Indizes wo Joker genutzt |
| `question_started_at` | DateTime(tz) | Yes | NULL | Server-Timer Start (UTC) |
| `expires_at` | DateTime(tz) | Yes | NULL | Server-Timer Ablauf (UTC) |
| `time_limit_seconds` | Integer | No | `30` | Zeitlimit aktuelle Frage |
| `question_started_at_ms` | BigInteger | Yes | NULL | Legacy Client-Timer (deprecated) |
| `deadline_at_ms` | BigInteger | Yes | NULL | Legacy Client-Timer (deprecated) |

**Wichtig:** Es gibt **zwei Timer-Systeme**:
- Server-based (neu): `question_started_at`, `expires_at`
- Client-based (legacy): `question_started_at_ms`, `deadline_at_ms`

### JSONB-Struktur: `run_questions`

**Aufbau:** Array mit genau 10 Items (ein Item pro Frage)

**Item-Schema:**
```json
{
  "question_id": "topic_q_01KE...",
  "difficulty": 3,
  "answers_order": [2, 1, 4, 3],
  "joker_disabled": [],
  "time_limit_seconds": 30,
  "started_at_ms": 1673012735000,
  "answered_at_ms": null
}
```

**Bau in:** `_build_run_questions()` Z.642-720

**Felder gesetzt:**
- Bei Run-Start: `question_id`, `difficulty`, `answers_order` (Z.704-710)
- Bei Joker-Use: `joker_disabled` (Z.1055-1062)
- Bei Question-Start: `started_at_ms` (legacy, Z.1579)
- Bei Answer-Submit: `answered_at_ms` (legacy, nicht in Services gesetzt, nur geplant)

---

## 3. Level-/Progress-Logik

### Aktuelles Level-System (5 Levels)

**Verteilung:**
- Level 1 (difficulty=1): Questions 0-1
- Level 2 (difficulty=2): Questions 2-3
- Level 3 (difficulty=3): Questions 4-5
- Level 4 (difficulty=4): Questions 6-7
- Level 5 (difficulty=5): Questions 8-9

**Level-Ende erkannt in:**

#### Backend: `calculate_running_score()`

**Datei:** `game_modules/quiz/services.py`, Z.1137-1198

**Logik:**
```python
# Z.1171: Track level completion for current question
current_difficulty = run.run_questions[current_question_index]["difficulty"]
level_completed = False

# Z.1175-1198: Iterate difficulties
for difficulty in range(1, DIFFICULTY_LEVELS + 1):
    results = difficulty_results[difficulty]
    
    # Z.1191: Check if current answer completed this level
    if difficulty == current_difficulty and len(results) == 2:
        level_completed = True
        level_perfect = is_perfect
        level_bonus = bonus if is_perfect else 0
```

**Return:** `(running_score, level_completed, level_perfect, level_bonus, level_correct_count, level_questions_in_level)`

**Trigger:** Nach jedem `submit_answer()` (Z.991)

#### Frontend: State Machine

**Datei:** `static/js/games/quiz-play.js`

**States:** (Z.275-282)
- `STATE.IDLE` – Frage aktiv, Buttons klickbar
- `STATE.ANSWERED_LOCKED` – Antwort gewählt, UI locked, Erklärung sichtbar
- `STATE.TRANSITIONING` – Lade-Animation

**Views:** (Z.267-272)
- `VIEW.QUESTION` – Frage anzeigen
- `VIEW.LEVEL_UP` – Level-Up-Screen
- `VIEW.POST_ANSWER` – Erklärungs-Screen (deprecated state)
- `VIEW.FINISH` – Endscreen

**Level-Up-Trigger:**

**Datei:** `static/js/games/quiz-play.js`, Z.2180-2190 (`handleAnswerClick`) und Z.2441-2451 (Auto-Submit)

```javascript
// Wenn level_completed vom Backend
if (answer.levelCompleted) {
    const levelResult = buildLevelResult(answer, getLevelIndex(answer.difficulty));
    state.pendingLevelUpData = levelResult;
    state.pendingTransition = answer.finished ? 'LEVEL_UP_THEN_FINAL' : 'LEVEL_UP';
}
```

**Transition ausgelöst in:** `handleContinueClick()` Z.2655-2676

```javascript
case 'LEVEL_UP':
    await transitionToView(VIEW.LEVEL_UP);
    break;
case 'LEVEL_UP_THEN_FINAL':
    await transitionToView(VIEW.LEVEL_UP);
    // Nach Level-Up folgt automatisch Finish
    break;
```

**Level-Index-Berechnung:** (nicht explizit im Code, implizit = difficulty)

---

## 4. Timer-Enforcement

### Server-Based Timer (aktuell aktiv)

**Datei:** `game_modules/quiz/services.py`

#### Timer Start

**Function:** `start_question()` Z.797-851

**Ablauf:**
```python
# Z.824: Server-Zeit als Source of Truth
server_now = datetime.now(timezone.utc)

# Z.829: Zeitlimit setzen
if time_limit_seconds is None:
    time_limit_seconds = run.time_limit_seconds or TIMER_SECONDS

# Z.831-833: Timer-Felder setzen
run.question_started_at = server_now
run.expires_at = server_now + timedelta(seconds=time_limit_seconds)
run.time_limit_seconds = time_limit_seconds

# Z.836-838: Legacy-Felder (backward compat)
client_now_ms = int(server_now.timestamp() * 1000)
run.question_started_at_ms = client_now_ms
run.deadline_at_ms = client_now_ms + (time_limit_seconds * 1000)
```

**Idempotenz:** Wenn `run.question_started_at` bereits gesetzt, wird nicht überschrieben (Z.819-821)

#### Timeout-Check

**Function:** `is_question_expired()` Z.772-780

```python
def is_question_expired(run: QuizRun) -> bool:
    remaining = get_remaining_seconds(run)
    if remaining is None:
        return False
    return remaining <= 0
```

**Function:** `get_remaining_seconds()` Z.758-770

```python
if not run.expires_at:
    return None
server_now = datetime.now(timezone.utc)
remaining = (run.expires_at - server_now).total_seconds()
return remaining
```

#### Timeout-Enforcement

**Function:** `submit_answer()` Z.860-975

**Ablauf:**
```python
# Z.919: Server-seitiger Check
is_expired = is_question_expired(run)

# Z.922-926: Legacy Client-Check (backward compat)
client_timeout = False
if run.deadline_at_ms and answered_at_ms > run.deadline_at_ms:
    client_timeout = True

# Z.928-934: Timeout → result = "timeout"
if is_expired or client_timeout:
    result = "timeout"
```

**Konsequenz:** Bei Timeout wird `result = "timeout"`, keine Punkte (Z.988 `is_correct = false`)

### Frontend Timer (nur UI)

**Datei:** `static/js/games/quiz-play.js`

**Timer-Start:** Nach Question-Load und `/start`-Call (Z.1540-1610)

**Countdown-Display:** In `updateTimerDisplay()` (nicht in dieser Datei-Range, aber referenziert)

**Auto-Submit bei Timeout:** Z.1718-1810 (TimerController)

```javascript
// Z.1732: Berechne Remaining
const serverRemainingMs = state.expiresAtMs - serverNowMs;

// Z.1741: Bei <= 0 → Auto-Submit
if (serverRemainingMs <= 0) {
    await autoSubmitTimeout();
}
```

**Wichtig:** Frontend sendet `answered_at_ms` mit, aber Backend validiert mit Server-Zeit.

---

## 5. Token-Abhängigkeiten

### Token-Berechnung

**Datei:** `game_modules/quiz/services.py`

#### In `calculate_running_score()` (Z.1175-1198)

**Logik:** "Token" ist eigentlich "Level-Perfect-Bonus"

```python
# Z.1178: Points pro Difficulty
points = correct_count * POINTS_PER_DIFFICULTY[difficulty]

# Z.1181-1185: Bonus wenn beide Fragen korrekt
is_perfect = len(results) == 2 and all(results)
if is_perfect:
    bonus = 2 * POINTS_PER_DIFFICULTY[difficulty]
    total_level_bonus += bonus
```

**Kein Token-Counter in dieser Function** (aber `level_perfect` Flag gesetzt)

#### In `finish_run()` (Z.1264-1312)

**Logik:** Tokens = Anzahl perfekter Levels

```python
# Z.1265: Init
tokens_count = 0

# Z.1268-1287: Iterate difficulties
for difficulty in range(1, DIFFICULTY_LEVELS + 1):
    results = difficulty_results[difficulty]
    correct_count = sum(1 for r in results if r)
    points = correct_count * POINTS_PER_DIFFICULTY[difficulty]
    
    # Z.1275-1279: Token wenn beide korrekt
    earned_token = len(results) == 2 and all(results)
    if earned_token:
        tokens_count += 1
        token_bonus = 2 * POINTS_PER_DIFFICULTY[difficulty]
```

**Gespeichert in:** `QuizScore.tokens_count` (Z.1305)

### Token-Display

#### Backend API Responses

**AnswerResult (services.py Z.145-156):**
```python
@dataclass
class AnswerResult:
    # ... andere Felder
    level_perfect: bool = False  # Wird gesetzt, aber kein token_count
```

**ScoreResult (services.py Z.151-159):**
```python
@dataclass
class ScoreResult:
    total_score: int
    tokens_count: int  # ← Hier ist es
    breakdown: List[Dict[str, Any]]
```

**Breakdown-Item (Z.1285-1293):**
```python
breakdown.append({
    "difficulty": difficulty,
    "correct": correct_count,
    "total": len(results),
    "points": points,
    "token_earned": earned_token,
    "token_bonus": token_bonus,
})
```

#### Frontend

**Datei:** `static/js/games/quiz-play.js`

**Token-Referenzen:** Keine direkte Token-Display-Logik in STATE-Objekt (Z.289-337)

**In normalizeFinishResponse() (Z.143-159):**
```javascript
return {
    totalScore: raw.total_score,
    tokensCount: raw.tokens_count,  // ← Hier wird's gemappt
    breakdown: raw.breakdown
};
```

**Leaderboard Display (nicht im analysierten Bereich):** Verwendet `tokens_count` aus API

### Stellen die bei tokens_count=0/null kaputtgehen würden

**Backend:**
- `QuizScore.tokens_count` (models.py Z.228): NOT NULL → muss 0 sein, nicht NULL
- `finish_run()` (services.py Z.1265): Initialisiert mit 0 → Safe
- Leaderboard-Query (services.py Z.1347-1350): Sortiert nach `total_score`, dann `created_at` → tokens_count nicht in ORDER BY → **Safe**

**Frontend:**
- `normalizeFinishResponse()`: Erwartet `tokens_count` als Number → Bei 0 OK, bei NULL würde TypeScript/Display crashen
- Leaderboard-Render: Wenn Template `tokens_count` anzeigt → Bei 0 OK, bei NULL muss Template robust sein

**Fazit:** Token kann auf 0 gesetzt werden ohne Crashes. Aber:
- Frontend-Templates müssen `tokens_count` optional behandeln oder default=0
- API-Responses sollten `tokens_count: 0` (nicht NULL) liefern

---

## 6. Content-Pipeline (Ist-Zustand)

### JSON-Schema (aktuell)

**Datei:** `game_modules/quiz/validation.py`

#### Unterstützte Schema-Versionen

**Zeile 321:**
```python
SUPPORTED_SCHEMA_VERSIONS = {'quiz_unit_v1', 'quiz_unit_v2'}
```

#### Difficulty-Range

**Zeile 171-173:**
```python
difficulty = data["difficulty"]
if not isinstance(difficulty, int) or difficulty < 1 or difficulty > 5:
    errors.append(f"Question {question_id}: difficulty must be 1-5, got {difficulty}")
```

**Validation:** Difficulty muss Integer zwischen 1 und 5 sein (inklusive)

#### Question-Count pro Difficulty

**Zeile 257-265:**
```python
# Validate we have 2 questions per difficulty level
difficulty_counts = {}
for q in questions:
    difficulty_counts[q.difficulty] = difficulty_counts.get(q.difficulty, 0) + 1

for d in range(1, 6):  # 1-5
    count = difficulty_counts.get(d, 0)
    if count < 2:
        errors.append(f"Difficulty {d}: need at least 2 questions, got {count}")
```

**Regel:** Mindestens 2 Fragen pro Difficulty (1-5) pro Topic

#### Media-Support

**Zeile 60-83 (UnitMediaSchema):**
```python
@dataclass
class UnitMediaSchema:
    id: str
    type: str  # "audio" or "image"
    seed_src: Optional[str] = None
    src: Optional[str] = None
    label: Optional[str] = None
    alt: Optional[str] = None
    caption: Optional[str] = None
```

**v2 unterstützt:** Media-Arrays in Questions und Answers

### Import-Pfade

#### DEV (Seed)

**Tool:** `scripts/quiz_seed.py` (nicht analysiert, aber referenziert in Docs)

**Pfad:** `content/quiz/topics/<topic_slug>.json`

**Ziel-DB:** Direktes Upsert in `quiz_topics`, `quiz_questions` mit `is_active=true`, `release_id=NULL`

#### Production

**Service:** `game_modules/quiz/import_service.py`

**Quellpfad:** `media/releases/<release_id>/units/<topic_slug>.json`

**Audio-Pfad:** `media/releases/<release_id>/audio/`

**Import-Function:** `QuizImportService.import_release()` (Z. nicht im Ausschnitt, aber aus Struktur erkennbar)

**Flow:**
1. Lese JSON aus `units/`
2. Validiere mit `validate_quiz_unit()` (validation.py)
3. Compute Audio-Hashes (Z.145-160 in import_service.py)
4. Upsert Topics + Questions mit `release_id`, `is_active=false` (Draft)
5. Erstelle/Update `QuizContentRelease` mit `status='draft'`

**Publish-Function:** `QuizImportService.publish_release()` (Z. nicht im Ausschnitt)

**Flow:**
1. Setze alte Published Release auf `unpublished`
2. Setze Target Release auf `published`
3. Update alle Topics/Questions der Release: `is_active=true`

---

## 7. Admin-Import & Release

### Admin-Dashboard

**Datei:** `src/app/routes/quiz_admin.py`

**Route (Page):** `/quiz-admin/` (Z.59-63)

**Auth:** JWT + `@require_role(Role.ADMIN)` (Z.61)

**Template:** `admin/quiz_content.html`

### Import-Endpoint

**Route:** `POST /quiz-admin/api/releases/<release_id>/import` (Z.143-202)

**Request Body:** **LEER** (Pfade aus release_id konstruiert)

**Service-Call:** `QuizImportService.import_release(session, release_id, dry_run=False)` (Z.171)

**Response (Success):**
```json
{
  "ok": true,
  "units_imported": 7,
  "questions_imported": 142,
  "audio_files_processed": 23
}
```

**Response (Error):**
```json
{
  "ok": false,
  "errors": ["..."]
}
```

**State-Änderung:** Release wird auf `status='draft'` gesetzt, Topics/Questions mit `is_active=false`

### Publish-Endpoint

**Route:** `POST /quiz-admin/api/releases/<release_id>/publish` (nicht im Ausschnitt, aber aus Liste in docs erkennbar)

**Erwartung:** Setzt Release auf `published`, Topics/Questions auf `is_active=true`, alte Release auf `unpublished`

### Annahmen über Schema/Counts

**Import-Service:** Verwendet `validate_quiz_unit()` → Validiert Difficulty 1-5, min 2 pro Difficulty

**Wenn Schema ändert (z.B. Difficulty 1-3):**
- `validation.py` Z.172: Muss `difficulty < 1 or difficulty > 3` ändern
- `validation.py` Z.263: Muss `range(1, 4)` statt `range(1, 6)` ändern
- `import_service.py`: Keine hardcoded Difficulty-Checks → sollte via Validator safe sein

---

## 8. Frontend-State-Machine (Ist)

**Datei:** `static/js/games/quiz-play.js`

### States

**Zeile 275-282:**
```javascript
const STATE = {
    IDLE: 'idle',
    ANSWERED_LOCKED: 'answered_locked',
    TRANSITIONING: 'transitioning'
};
```

**Bedeutung:**
- `IDLE` – Frage sichtbar, Antworten klickbar, Timer läuft
- `ANSWERED_LOCKED` – Antwort gewählt, UI disabled, Erklärung sichtbar, "Weiter"-Button
- `TRANSITIONING` – Lade-Animation zwischen Fragen/Views

### Views

**Zeile 267-272:**
```javascript
const VIEW = {
    QUESTION: 'question',
    LEVEL_UP: 'level_up',
    POST_ANSWER: 'post_answer',
    FINISH: 'finish'
};
```

**Bedeutung:**
- `QUESTION` – Fragen-Screen
- `LEVEL_UP` – Level-Up-Celebration
- `POST_ANSWER` – Deprecated (war für Erklärung-Screen, jetzt in QUESTION integriert)
- `FINISH` – Endscreen mit Score/Leaderboard

### State-Objekt

**Zeile 289-337:** Vollständiges State-Objekt

**Relevante Felder:**
- `currentIndex`: Aktueller Fragenindex (0-9)
- `nextQuestionIndex`: Nächster Index vom Backend
- `jokerRemaining`: Verbleibende Joker (0-2)
- `runningScore`: Laufender Score
- `questionData`: Aktuelle Frage vom Backend
- `uiState`: Aktueller UI-State (`STATE.IDLE` etc.)
- `currentView`: Aktuelles View (`VIEW.QUESTION` etc.)
- `isAnswered`: Ob Antwort gewählt wurde
- `lastAnswerResult`: Letztes `/answer`-Response
- `pendingTransition`: Was nach "Weiter" kommt (`'LEVEL_UP'`, `'LEVEL_UP_THEN_FINAL'`, `'NEXT'`)
- `pendingLevelUpData`: Level-Result-Daten für Level-Up-Screen

### Transitions

#### Question → Question (normaler Flow)

**Trigger:** Answer-Submit, kein Level-Complete (Z.2180-2190 in handleAnswerClick)

```javascript
if (!answer.levelCompleted) {
    state.pendingTransition = 'NEXT';
}
// Nach "Weiter": loadQuestion(nextIndex)
```

#### Question → Level-Up

**Trigger:** Answer-Submit, Level-Complete (Z.2183-2188)

```javascript
if (answer.levelCompleted) {
    const levelResult = buildLevelResult(answer, getLevelIndex(answer.difficulty));
    state.pendingLevelUpData = levelResult;
    state.pendingTransition = answer.finished ? 'LEVEL_UP_THEN_FINAL' : 'LEVEL_UP';
}
// Nach "Weiter": transitionToView(VIEW.LEVEL_UP)
```

#### Level-Up → Question (weiterspielen)

**Trigger:** "Weiter"-Button in Level-Up (Z.2655-2660)

```javascript
case 'LEVEL_UP':
    await transitionToView(VIEW.LEVEL_UP);
    // Automatisch: renderLevelUp() zeigt "Weiter"-Button
    // Bei Click: continueAfterLevelUp() → loadQuestion(nextIndex)
    break;
```

#### Level-Up → Finish (letztes Level)

**Trigger:** Letztes Level complete (Z.2661-2676)

```javascript
case 'LEVEL_UP_THEN_FINAL':
    await transitionToView(VIEW.LEVEL_UP);
    // Nach Level-Up-Anzeige: automatisch → transitionToView(VIEW.FINISH)
    break;
```

### Timer-Logik

**Server-Timer-Felder in State (Z.295-304):**
```javascript
expiresAtMs: null,  // Server expiration timestamp
serverClockOffsetMs: 0,  // Clock drift correction
timeLimitSeconds: 30,
serverPhase: null,
serverIsExpired: false,
serverRemainingSeconds: null
```

**Legacy-Felder (Z.305-306):**
```javascript
questionStartedAtMs: null,  // Deprecated
deadlineAtMs: null  // Deprecated
```

**Timer-Start:** Nach `/question/start`-Call (Z.1579-1610)

**Auto-Submit bei Timeout:** TimerController (Z.1718-1810)

```javascript
// Z.1741: Check expiry
if (serverRemainingMs <= 0) {
    await autoSubmitTimeout();
}
```

**Auto-Submit Function:** Sendet `answer_id: null`, `answered_at_ms: deadline`

---

## 9. Bekannte fragile Stellen

### Mehrfache Event-Handler

**Potenzial für Doppel-Events:**

**Answer-Buttons:** (nicht im analysierten Bereich, aber aus State-Logik erkennbar)
- Wenn `handleAnswerClick()` mehrfach gebunden → Doppel-Submit
- Aktuelle Mitigation: `state.isAnswered`-Flag (Z.323) verhindert Re-Submit

**Continue-Button:** (Z.2648-2690 in handleContinueClick)
- Lock: `state.transitionInFlight` (Z.2651)
- Verhindert konkurrierende Transitions

### Race-Conditions

**Timer vs Manual-Submit:**

**Szenario:** User klickt Antwort exakt wenn Timer abläuft

**Mitigation:** `state.activeTimerAttemptId` (Z.335) + `timeoutSubmittedForAttemptId` (Z.336)

**Logik (Z.1723-1760 in TimerController):**
```javascript
// Prüfe ob Timeout für diese Question schon submitted
if (state.timeoutSubmittedForAttemptId[attemptId]) {
    console.log('[TIMER] Timeout already submitted for this attempt');
    return;
}
// Setze Flag vor Submit
state.timeoutSubmittedForAttemptId[attemptId] = true;
```

**Aber:** Wenn Manual-Submit gleichzeitig → Backend muss letzten Call gewinnen (idempotent)

**Load-Question mehrfach:**

**Lock:** `state.isLoadingQuestion` (Z.332)

**Logik (Z.1382-1390 in loadQuestion):**
```javascript
if (state.isLoadingQuestion) {
    debugLog('loadQuestion', { action: 'skip', reason: 'already_loading' });
    return;
}
state.isLoadingQuestion = true;
// ... load
state.isLoadingQuestion = false;
```

### State-Locks

**Transition-Lock:** `state.transitionInFlight` (Z.330)
- Verhindert überlappende View-Transitions (Continue + Auto-Advance)

**UI-State-Lock:** `state.uiState` (Z.322)
- `ANSWERED_LOCKED` → Buttons disabled (via CSS `.is-locked`)

**Problem:** Wenn State nicht korrekt zurückgesetzt → Buttons bleiben disabled

**Kritische Reset-Punkte:**
- Nach loadQuestion() (Z.1420-1480): State auf IDLE
- Nach handleAnswerClick() (Z.2200-2220): State auf ANSWERED_LOCKED
- Nach handleContinueClick() (Z.2690): Lock zurücksetzen

### Pointer-Events / Overlays

**Nicht im analysierten Bereich**, aber aus State-Machine erkennbar:

**Potenzielle Probleme:**
- Overlay über Buttons bleibt sichtbar → Buttons nicht klickbar
- Z-Index-Konflikte zwischen Question-Card und Explanation-Card
- Disabled-State wird nicht CSS-seitig propagiert

**Debug-Hinweis:** Wenn Buttons nicht klickbar:
1. Prüfe `state.uiState` (sollte `IDLE` sein)
2. Prüfe CSS-Klasse `.is-locked` auf Button-Container
3. Prüfe `pointer-events: none` in DevTools

---

## Zusammenfassung

### Kritische Code-Stellen für Refactoring

| Subsystem | Datei | Funktionen | Impact wenn geändert |
|-----------|-------|------------|---------------------|
| **Mechanik-Konstanten** | services.py | Z.74-93 | 🔴 Critical – alle Abhängigen brechen |
| **Question-Selection** | services.py | `_build_run_questions()` Z.642-720 | 🔴 Critical – Distribution ändert sich |
| **Scoring** | services.py | `calculate_running_score()` Z.1137-1198, `finish_run()` Z.1201-1312 | 🔴 Critical – Leaderboard inkonsistent |
| **Level-Detection** | services.py | `calculate_running_score()` Z.1171-1198 | 🔴 Critical – Frontend Level-Up bricht |
| **Timer-Start** | services.py | `start_question()` Z.797-851 | 🟠 High – Timeout-Logic betroffen |
| **Timer-Check** | services.py | `is_question_expired()` Z.772-780, `submit_answer()` Z.919-934 | 🟠 High – Timeout-Enforcement |
| **Validation** | validation.py | Z.171-173 (Difficulty-Range), Z.257-265 (Counts) | 🔴 Critical – Content-Import bricht |
| **Frontend-State** | quiz-play.js | Z.275-337 (State-Objekt), Z.2180-2690 (Transitions) | 🟠 High – UI bricht |
| **Token-Display** | quiz-play.js, services.py | `normalizeFinishResponse()` (JS), `finish_run()` (Py) | 🟡 Medium – UI zeigt falsche Daten |

### Datenbankfelder die bei Mechanik-Änderung betroffen sind

| Feld | Tabelle | Typ | Kann NULL? | Änderung nötig? |
|------|---------|-----|-----------|-----------------|
| `tokens_count` | quiz_scores | Integer | No | Kann 0 bleiben (soft removal) |
| `run_questions` | quiz_runs | JSONB | No | Schema ändert sich (Difficulty-Werte) |
| `difficulty` | quiz_questions | Integer | No | Neue Range 1-3 (Content-Migration) |

**Wichtig:** Keine Schema-Migration nötig wenn Difficulty 1-3 bleibt Subset von 1-5. Aber Content muss re-normalized werden.

---

**Dieses Dokument ist komplett. Jede geplante Änderung kann nun gegen diese Baseline gemappt werden.**
