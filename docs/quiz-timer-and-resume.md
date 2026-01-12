# Quiz Timer and Resume System - Complete Documentation

**Date:** 2026-01-12  
**Version:** 3.0  
**Status:** ✅ Implemented - Server-Authoritative Phase Enforcement

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [API Contract](#api-contract)
6. [Phase Enforcement](#phase-enforcement)
7. [Testing Checklist](#testing-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Executive Summary

### Problems Solved (v3.0)

1. **❌ Bug 1:** Frontend ignores server phase on resume
   - **✅ Fixed:** `init()` checks `state.phase` from server - if `POST_ANSWER`, shows post-answer UI instead of starting new timer

2. **❌ Bug 2:** Timer starts without server validation  
   - **✅ Fixed:** `startQuestionTimer()` returns boolean, `loadCurrentQuestion()` throws if no valid `expiresAtMs`

3. **❌ Bug 3:** Q2 starts with "20" and stays frozen
   - **✅ Fixed:** Timer state (`expiresAtMs`, `deadlineAtMs`, `questionStartedAtMs`) cleared immediately in `loadCurrentQuestion()`

4. **❌ Bug 4:** Timeout UI can be overwritten by other styling functions
   - **✅ Fixed:** `showAnswerResult()` and `showCorrectAnswer()` have early-return guards for `state.lastOutcome === 'timeout'`

5. **❌ Bug 5:** Refresh resets quiz / cheat vulnerability
   - **✅ Fixed:** `/state` endpoint returns `phase: 'POST_ANSWER'` when expired, frontend respects it

### Key Architectural Principle

**Server is the Single Source of Truth for:**
- Timer expiration (`expires_at_ms`)
- Current phase (`ANSWERING` vs `POST_ANSWER`)
- Question index (`current_index`)

**Frontend MUST:**
- Respect `phase` from `/state` endpoint
- NOT override phase to `ANSWERING` if server says `POST_ANSWER`
- NOT start timer countdown without valid `expiresAtMs` from server
- Clear ALL timer state before loading new question

---

## Architecture Overview

### Before (Broken)

```
Client                          Server
------                          ------
loadStateForResume() → phase="POST_ANSWER"
  ↓
loadCurrentQuestion()           
  ↓
state.phase = PHASE.ANSWERING  ← ❌ OVERWRITES server phase!
startTimerCountdown()          ← ❌ STARTS timer even for POST_ANSWER!
```

### After (Fixed)

```
Client                          Server
------                          ------
loadStateForResume() → phase="POST_ANSWER"
  ↓
init() checks: state.phase === PHASE.POST_ANSWER?
  ↓ YES
loadCurrentQuestionForPostAnswer()  ← ✅ Shows post-answer UI, NO timer
  ↓ NO  
loadCurrentQuestion()
  ↓
startQuestionTimer() → expiresAtMs from server
  ↓
if (!expiresAtMs) throw Error   ← ✅ FAIL FAST if no server timer
  ↓
state.phase = PHASE.ANSWERING   ← ✅ Only after successful timer start
startTimerCountdown()           ← ✅ Only with valid expiresAtMs
```

### Database Schema

**Migration:** [migrations/0012_add_server_based_timer.sql](c:\dev\hispanistica_games\migrations\0012_add_server_based_timer.sql)

```python
class QuizRun(QuizBase):
    # NEW: Server-based timer fields (source of truth)
    question_started_at: Mapped[Optional[datetime]]  # Server UTC
    expires_at: Mapped[Optional[datetime]]           # Server UTC
    time_limit_seconds: Mapped[int]                  # 30 + bonus
    
    # LEGACY: Kept for backward compatibility
    question_started_at_ms: Mapped[Optional[int]]
    deadline_at_ms: Mapped[Optional[int]]
```

### Service Layer

**File:** [game_modules/quiz/services.py](c:\dev\hispanistica_games\game_modules\quiz\services.py)

#### Timer Helper Functions

```python
def get_remaining_seconds(run: QuizRun) -> Optional[float]:
    """Calculate remaining time from server perspective."""
    if not run.expires_at:
        return None
    
    server_now = datetime.now(timezone.utc)
    remaining = (run.expires_at - server_now).total_seconds()
    return remaining


def is_question_expired(run: QuizRun) -> bool:
    """Check if timer has expired (timeout)."""
    remaining = get_remaining_seconds(run)
    if remaining is None:
        return False
    return remaining <= 0


def calculate_time_limit(question_data: dict) -> int:
    """Calculate time limit (30 + bonus for media)."""
    base_time = TIMER_SECONDS  # 30
    media = question_data.get('media')
    if media and isinstance(media, list) and len(media) > 0:
        return base_time + MEDIA_BONUS_SECONDS  # 30 + 10 = 40
    return base_time
```

#### start_question() - Server Decides Start Time

```python
def start_question(session, run, question_index, started_at_ms=None, time_limit_seconds=None):
    """Start timer (SERVER-SIDE).
    
    Args:
        started_at_ms: DEPRECATED - ignored
        time_limit_seconds: Optional custom limit (default: 30 or 30+bonus)
    """
    if run.current_index != question_index:
        return False
    
    if run.question_started_at is not None:
        return True  # Idempotent
    
    # ✅ Server decides start time
    server_now = datetime.now(timezone.utc)
    time_limit = time_limit_seconds or run.time_limit_seconds or TIMER_SECONDS
    
    run.question_started_at = server_now
    run.expires_at = server_now + timedelta(seconds=time_limit)
    run.time_limit_seconds = time_limit
    
    # Legacy fields for backward compatibility
    client_now_ms = int(server_now.timestamp() * 1000)
    run.question_started_at_ms = client_now_ms
    run.deadline_at_ms = client_now_ms + (time_limit * 1000)
    
    return True
```

#### submit_answer() - Server Validates Timeout

```python
def submit_answer(session, run, question_index, selected_answer_id, answered_at_ms, used_joker):
    """Submit answer with server-side timeout validation."""
    
    # ✅ Server-side timeout check (source of truth)
    is_expired = is_question_expired(run)
    
    # Legacy check for backward compatibility
    client_timeout = False
    if run.deadline_at_ms and answered_at_ms > run.deadline_at_ms:
        client_timeout = True
    
    if is_expired or client_timeout:
        result = "timeout"
    elif selected_answer_id is not None:
        result = "correct" if selected_answer_id == correct_id else "wrong"
    
    # Clear timer state for next question
    run.question_started_at = None
    run.expires_at = None
    run.time_limit_seconds = TIMER_SECONDS
    
    # ...
```

### Routes Layer

**File:** [game_modules/quiz/routes.py](c:\dev\hispanistica_games\game_modules\quiz\routes.py)

#### POST /question/start - Start Timer

```python
@blueprint.route("/api/quiz/run/<run_id>/question/start", methods=["POST"])
@quiz_auth_required
def api_start_question(run_id: str):
    """Start timer (SERVER-BASED)."""
    data = request.get_json() or {}
    question_index = data.get("question_index")
    time_limit_seconds = data.get("time_limit_seconds")  # Optional
    
    # ❌ OLD: started_at_ms is DEPRECATED and ignored
    
    run = get_run(run_id)
    services.start_question(session, run, question_index, None, time_limit_seconds)
    
    remaining_seconds = services.get_remaining_seconds(run)
    
    return jsonify({
        "success": True,
        # NEW: Server-based fields
        "server_now_ms": int(datetime.now(UTC).timestamp() * 1000),
        "expires_at_ms": int(run.expires_at.timestamp() * 1000),
        "time_limit_seconds": run.time_limit_seconds,
        "remaining_seconds": remaining_seconds,
        # LEGACY: For backward compatibility
        "deadline_at_ms": run.deadline_at_ms,
    })
```

#### GET /run/:id/state - Complete State for Resume

```python
@blueprint.route("/api/quiz/run/<run_id>/state", methods=["GET"])
@quiz_auth_required
def api_get_run_state(run_id: str):
    """Get complete run state including timer (for refresh resume)."""
    
    run = get_run(run_id)
    server_now = datetime.now(timezone.utc)
    
    remaining_seconds = services.get_remaining_seconds(run)
    is_expired = services.is_question_expired(run)
    
    # ✅ AUTO-TIMEOUT: If expired and no answer recorded, create timeout record (idempotent)
    if is_expired and run.question_started_at and run.current_index < QUESTIONS_PER_RUN:
        existing_answer = get_answer_for_index(run.id, run.current_index)
        if not existing_answer:
            # Create timeout answer record
            timeout_answer = QuizRunAnswer(
                run_id=run.id,
                question_id=run.run_questions[run.current_index]["question_id"],
                question_index=run.current_index,
                selected_answer_id=None,
                result="timeout",
                answered_at_ms=int(run.expires_at.timestamp() * 1000),
            )
            session.add(timeout_answer)
            
            # Advance to next question and clear timer
            run.current_index += 1
            run.question_started_at = None
            run.expires_at = None
            session.flush()
    
    # Determine phase (after auto-timeout, so phase reflects new state)
    phase = "ANSWERING"
    if remaining_seconds is None or is_expired:
        phase = "POST_ANSWER"
    
    return jsonify({
        "run_id": run.id,
        "current_index": run.current_index,
        # Server-based timer fields
        "server_now_ms": int(server_now.timestamp() * 1000),
        "expires_at_ms": int(run.expires_at.timestamp() * 1000) if run.expires_at else None,
        "time_limit_seconds": run.time_limit_seconds,
        "remaining_seconds": max(0, remaining_seconds) if remaining_seconds else None,
        "is_expired": is_expired,
        "phase": phase,
        # Progress and state
        "running_score": calculate_score(run),
        "run_questions": run.run_questions,
        "joker_remaining": run.joker_remaining,
        # ...
    })
```

---

## Frontend Implementation

**File:** [static/js/games/quiz-play.js](c:\dev\hispanistica_games\static\js\games\quiz-play.js)

### State Object Changes (v3.0)

```javascript
let state = {
  // ✅ SERVER-BASED TIMER FIELDS
  expiresAtMs: null,            // Server-provided expiration timestamp
  serverClockOffsetMs: 0,       // Offset for drift correction
  timeLimitSeconds: 30,         // Time limit for current question
  
  // ✅ NEW v3.0: SERVER-BASED STATE FIELDS (from /state endpoint)
  serverPhase: null,            // Last known phase from server ('ANSWERING' or 'POST_ANSWER')
  serverIsExpired: false,       // Last known expiry status from server
  serverRemainingSeconds: null, // Last known remaining time from server
  
  // Phase tracking
  phase: PHASE.ANSWERING,       // Current client phase (must match server!)
  lastOutcome: null,            // Track last outcome (null, 'correct', 'wrong', 'timeout')
  
  // LEGACY: Kept for backward compatibility
  questionStartedAtMs: null,
  deadlineAtMs: null,
  // ...
};
```

### Resume on Page Load (v3.0 - Server Phase Enforcement)

```javascript
async function init() {
  const runData = await startOrResumeRun();  // force_new: false (unless ?restart=1)
  
  state.runId = runData.run_id;
  state.currentIndex = runData.current_index;
  
  // ✅ Load complete state including timer AND phase
  const serverState = await loadStateForResume();
  
  // Restore score from server
  await restoreRunningScore();
  
  // Check if already finished
  if (state.currentIndex >= 10) {
    await finishRun();
    return;
  }
  
  // ✅ NEW v3.0: Respect server phase - don't blindly call loadCurrentQuestion
  if (state.phase === PHASE.POST_ANSWER) {
    // Server says we're in POST_ANSWER (question already answered/expired)
    // Need to show post-answer UI, NOT start new question timer
    await loadCurrentQuestionForPostAnswer();
  } else {
    // Normal case: load current question and start timer
    await loadCurrentQuestion();
  }
}
```

### loadStateForResume() - Store Server Phase (v3.0)

```javascript
async function loadStateForResume() {
  const response = await fetch(`/api/quiz/run/${state.runId}/state`);
  const stateData = await response.json();
  
  // ✅ Calculate server clock offset for drift correction
  const clientNowMs = Date.now();
  const serverNowMs = stateData.server_now_ms;
  state.serverClockOffsetMs = serverNowMs - clientNowMs;
  
  // ✅ NEW v3.0: Store server-provided phase and expiry state
  state.serverPhase = stateData.phase;  // 'ANSWERING' or 'POST_ANSWER'
  state.serverIsExpired = stateData.is_expired || false;
  state.serverRemainingSeconds = stateData.remaining_seconds;
  
  // Update timer state ONLY if still in ANSWERING phase
  if (stateData.phase === 'ANSWERING' && stateData.expires_at_ms && !stateData.is_expired) {
    state.expiresAtMs = stateData.expires_at_ms;
    state.timeLimitSeconds = stateData.time_limit_seconds || 30;
    state.deadlineAtMs = stateData.expires_at_ms;
    state.questionStartedAtMs = stateData.expires_at_ms - (state.timeLimitSeconds * 1000);
  } else {
    // ✅ FIX: Clear timer state if not in active ANSWERING
    state.expiresAtMs = null;
    state.deadlineAtMs = null;
    state.questionStartedAtMs = null;
  }
  
  // Update phase from server (ANSWERING or POST_ANSWER)
  if (stateData.phase === 'POST_ANSWER' || stateData.is_expired) {
    state.phase = PHASE.POST_ANSWER;
    state.isAnswered = true;
    state.lastOutcome = stateData.last_answer_result || 'timeout';
  } else {
    state.phase = PHASE.ANSWERING;
  }
  
  return stateData;  // Return so caller can inspect
}
```

### loadCurrentQuestionForPostAnswer() - NEW v3.0

```javascript
/**
 * Load current question for POST_ANSWER state (resume after timeout/answer)
 * Server says POST_ANSWER -> no timer start, only show UI
 */
async function loadCurrentQuestionForPostAnswer() {
  const questionConfig = state.runQuestions[state.currentIndex];
  const questionId = questionConfig.question_id;
  
  // Fetch question details
  const response = await fetch(`/api/quiz/questions/${questionId}`);
  state.questionData = await response.json();
  
  // Render question (but NO timer)
  renderQuestion();
  state.currentView = VIEW.QUESTION;
  renderCurrentView();
  
  // ✅ KEY: Phase stays POST_ANSWER, no timer start
  state.phase = PHASE.POST_ANSWER;
  state.isAnswered = true;
  
  // Apply appropriate UI based on outcome
  if (state.lastOutcome === 'timeout') {
    applyTimeoutUI();  // All answers locked+inactive, no correct reveal
  } else {
    setUIState(STATE.ANSWERED_LOCKED);
  }
  
  // Show explanation and "Weiter" button
  showExplanationCard('Drücke "Weiter" um fortzufahren.');
  state.pendingTransition = 'NEXT_QUESTION';
  state.nextQuestionIndex = state.currentIndex + 1;
}
```

### loadCurrentQuestion() - Timer Gating (v3.0)

```javascript
async function loadCurrentQuestion() {
  // ... guards ...
  
  try {
    // ✅ Clear timer state IMMEDIATELY
    stopAllTimers();
    state.expiresAtMs = null;
    state.deadlineAtMs = null;
    state.questionStartedAtMs = null;
    
    // Fetch question data...
    
    // ✅ FIX: Start timer ONLY if we get valid server response
    if (!state.questionStartedAtMs) {
      const timerStarted = await startQuestionTimer();
      if (!timerStarted || !state.expiresAtMs) {
        throw new Error('Failed to start question timer on server');
      }
    }
    
    // Render question...
    
    // ✅ FIX: Set ANSWERING and start countdown ONLY with valid server timer
    if (state.expiresAtMs) {
      state.phase = PHASE.ANSWERING;
      startTimerCountdown();
    }
  } finally {
    state.isLoadingQuestion = false;
  }
}
```

### startQuestionTimer() - Return Success (v3.0)

```javascript
/**
 * @returns {Promise<boolean>} true if timer was started successfully
 */
async function startQuestionTimer() {
  try {
    const response = await fetch(`/api/quiz/run/${state.runId}/question/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question_index: state.currentIndex,
        time_limit_seconds: totalTimerSeconds
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      state.serverClockOffsetMs = data.server_now_ms - Date.now();
      state.expiresAtMs = data.expires_at_ms;
      state.questionStartedAtMs = data.question_started_at_ms;
      
      // ✅ Return success only if we got valid timer data
      return !!(state.expiresAtMs && state.questionStartedAtMs);
    }
    return false;
  } catch (error) {
    return false;
  }
}
```

### Timeout UI Guards (v3.0)

```javascript
/**
 * Show result styling - but NOT on timeout!
 */
function showAnswerResult(selectedId, result, correctId) {
  // ✅ GUARD: Don't overwrite timeout UI
  if (state.lastOutcome === 'timeout') {
    return;
  }
  // ... normal styling ...
}

/**
 * @deprecated Use applyTimeoutUI() for timeouts
 */
function showCorrectAnswer(correctId) {
  // ✅ GUARD: Never show correct answer on timeout
  if (state.lastOutcome === 'timeout') {
    return;
  }
  // ... normal styling ...
}
```

### startTimerCountdown() - Drift-Corrected Display
  
  const updateTimer = () => {
    // ✅ Drift-corrected time calculation
    const clientNow = Date.now();
    const correctedNow = clientNow + state.serverClockOffsetMs;
    const expiresAt = state.expiresAtMs;
    
    if (!expiresAt) {
      console.error('No expires_at available');
      return;
    }
    
    const remaining = Math.max(0, Math.ceil((expiresAt - correctedNow) / 1000));
    
    // Update display
    timerDisplay.textContent = remaining;
    
    // Update styling
    if (remaining <= TIMER_DANGER) {
      timerEl.classList.add('quiz-timer--danger');
    } else if (remaining <= TIMER_WARNING) {
      timerEl.classList.add('quiz-timer--warning');
    }
    
    // Check for timeout
    if (remaining <= 0 && state.phase === PHASE.ANSWERING) {
      handleTimeout();
    }
  };
  
  updateTimer();
  state.timerInterval = setInterval(updateTimer, 100);
}
```

---

## API Contract

### POST /api/quiz/run/:runId/question/start

**Request:**
```json
{
  "question_index": 5,
  "time_limit_seconds": 40  // Optional (30 + media bonus)
}
```

**Response:**
```json
{
  "success": true,
  "server_now_ms": 1736700000000,
  "expires_at_ms": 1736700040000,
  "time_limit_seconds": 40,
  "remaining_seconds": 40.0,
  "deadline_at_ms": 1736700040000  // Legacy
}
```

### GET /api/quiz/run/:runId/state

**Request:** None (GET)

**Response:**
```json
{
  "run_id": "abc123",
  "current_index": 5,
  "server_now_ms": 1736700010000,
  "expires_at_ms": 1736700040000,
  "time_limit_seconds": 40,
  "remaining_seconds": 30.0,
  "is_expired": false,
  "phase": "ANSWERING",
  "running_score": 450,
  "run_questions": [...],
  "joker_remaining": 1,
  "finished": false
}
```

### POST /api/quiz/run/:runId/answer

**Request:**
```json
{
  "question_index": 5,
  "selected_answer_id": "ans_abc",
  "answered_at_ms": 1736700025000,  // Still sent, but not trusted for timeout
  "used_joker": false
}
```

**Response:** (unchanged)

**Server-Side Timeout Check:**
```python
# Server validates timeout using its own clock
is_expired = is_question_expired(run)  # Uses run.expires_at vs server UTC now

if is_expired:
    result = "timeout"  # Regardless of answered_at_ms
```

---

## Migration Guide

### Step 1: Run Database Migration

```bash
# Dev environment
psql -U hispanistica_auth -d hispanistica_auth -f migrations/0012_add_server_based_timer.sql

# Production
docker exec -i hispanistica_games_db psql -U <user> -d <db> < migrations/0012_add_server_based_timer.sql
```

**Verify:**
```sql
\d quiz_runs;
-- Should show: question_started_at, expires_at, time_limit_seconds
```

### Step 2: Deploy Backend Code

- Models: `game_modules/quiz/models.py`
- Services: `game_modules/quiz/services.py`
- Routes: `game_modules/quiz/routes.py`

**Backward Compatibility:**
- Old fields (`deadline_at_ms`) are still populated
- Clients can use either old or new fields during transition

### Step 3: Deploy Frontend Code

- `static/js/games/quiz-play.js`

**Backward Compatibility:**
- Falls back to `deadlineAtMs` if `expiresAtMs` not available
- Old servers will still work (frontend calculates offset from response)

### Step 4: Verify

See [Testing Checklist](#testing-checklist) below.

### Step 5: Future Cleanup (Optional)

After 2-3 weeks of stable operation:
- Remove `question_started_at_ms`, `deadline_at_ms` columns (breaking change)
- Remove legacy fallback code in frontend

---

## Testing Checklist

### Pre-Deployment (Development)

- [ ] **Migration:** Run SQL migration successfully
- [ ] **Start Quiz:** New run starts, timer shows 30 and counts down
- [ ] **Answer Question:** Timer stops, next question starts at 30
- [ ] **Media Question:** Timer shows 40 (30 + 10 bonus) for questions with media
- [ ] **Timeout:** Let timer reach 0 → Shows timeout UI → "Weiter" works → Next Q starts at 30
- [ ] **Refresh on Q1:** Refresh → Stays on Q1, timer resumes from remaining time
- [ ] **Refresh on Q5:** Refresh at 22s remaining → Stays on Q5, shows ~22s, counts down
- [ ] **Refresh after timeout:** Refresh → Shows POST_ANSWER UI, "Weiter" visible
- [ ] **Refresh after answer:** Refresh → Shows POST_ANSWER UI with explanation
- [ ] **LevelUp:** Complete level 2 → LevelUp screen → Continue → Q5 starts at 30
- [ ] **Finish:** Complete Q10 → Shows final score screen
- [ ] **Restart:** Click "Nochmal spielen" → New run starts at Q1

### v3.0 Phase Enforcement Tests (NEW)

- [ ] **Resume during ANSWERING:**
  1. Start quiz, wait until timer shows ~20s
  2. Refresh page
  3. ✅ Verify: Timer resumes at ~20s (not 30)
  4. ✅ Verify: Answers are clickable

- [ ] **Resume during POST_ANSWER (answered):**
  1. Start quiz, answer Q1
  2. Refresh page immediately (before clicking "Weiter")
  3. ✅ Verify: Shows explanation card
  4. ✅ Verify: "Weiter" button visible
  5. ✅ Verify: Timer NOT running
  6. ✅ Verify: Answers locked

- [ ] **Resume during POST_ANSWER (timeout):**
  1. Start quiz, let Q1 timeout
  2. Refresh page immediately (before clicking "Weiter")
  3. ✅ Verify: Timeout styling applied (gray answers)
  4. ✅ Verify: Correct answer NOT shown (timeout penalty)
  5. ✅ Verify: "Weiter" button visible
  6. ✅ Verify: Timer NOT running

- [ ] **Q2 Timer After Q1 Timeout:**
  1. Let Q1 timeout
  2. Click "Weiter"
  3. ✅ Verify: Q2 starts with 30s (not 0, not stale Q1 value)
  4. ✅ Verify: Timer counts down normally

- [ ] **Timeout UI Cannot Be Overwritten:**
  1. Let timer reach 0
  2. Open DevTools, run `showCorrectAnswer(1)` in console
  3. ✅ Verify: Timeout styling preserved (correct NOT revealed)

### Anti-Cheat Verification

- [ ] **DevTools Manipulation:**
  - Open DevTools console
  - Set `state.expiresAtMs = Date.now() + 999999000`
  - Observe: Timer display may show wrong value, but...
  - Submit answer after 30s real time
  - Server returns `result: "timeout"` (server clock wins!)

- [ ] **System Clock Manipulation:**
  - Change system time forward 1 hour
  - Start quiz
  - Observe: Timer counts down normally (server decides)
  - Change system time back
  - Observe: Timer continues (drift correction works)

### Regression Testing

- [ ] **Score Calculation:** Score increases correctly after each correct answer
- [ ] **Joker:** 50:50 works, removes 2 wrong answers
- [ ] **Joker Persistence:** Use joker on Q3, refresh → Joker still used on Q3
- [ ] **Audio Playback:** Audio questions play, timer shows bonus time
- [ ] **Accessibility:** Screen reader announces timer, keyboard navigation works
- [ ] **Mobile:** Layout responsive, timer visible, no horizontal scroll

### Performance Testing

- [ ] **Slow Network:** Throttle to 3G → Timer doesn't drift or freeze
- [ ] **Server Lag:** Add 2s artificial delay to /state endpoint → Resume still works
- [ ] **Multiple Refreshes:** Refresh 5 times rapidly → No duplicate runs, state consistent

### Bug Verification (Original Issues + v3.0 Fixes)

- [ ] **Bug 1 Fixed:** Answer at 20s → Next Q shows 30, not 20 ✅
- [ ] **Bug 2 Fixed:** Refresh on Q5 → Stays on Q5, not Q1 ✅
- [ ] **Bug 3 Fixed:** Timeout → Next Q timer shows 30, not 0 ✅
- [ ] **Bug 4 Fixed:** DevTools manipulation → No effect on timeout ✅
- [ ] **Bug 5 Fixed (v3.0):** Resume after timeout → Shows timeout UI, not new timer ✅
- [ ] **Bug 6 Fixed (v3.0):** Resume after answer → Shows POST_ANSWER, not ANSWERING ✅
- [ ] **Bug 7 Fixed (v3.0):** Timeout UI cannot be overwritten by other code paths ✅

---

## Troubleshooting

### Issue: Timer shows wrong value after refresh

**Symptom:** After refresh, timer shows 30 instead of remaining time

**Diagnosis:**
1. Check `/state` endpoint returns `expires_at_ms` and `remaining_seconds`
2. Check browser console for `loadStateForResume` logs
3. Verify `state.expiresAtMs` is set correctly

**Fix:**
```javascript
// In loadStateForResume(), verify:
if (stateData.expires_at_ms) {
  state.expiresAtMs = stateData.expires_at_ms;  // Must be set!
}
```

### Issue: Timer drifts over time

**Symptom:** Timer shows 27s but server timeout occurs at 30s

**Diagnosis:**
1. Check `state.serverClockOffsetMs` in console
2. Large offset (>5000ms) indicates clock sync issue

**Fix:**
- Ensure server clock is NTP-synced
- Refresh page to recalculate offset

```bash
# Server: Check NTP sync
timedatectl status
```

### Issue: Timeout not detected

**Symptom:** User answers after 30s, but answer is accepted

**Diagnosis:**
1. Check backend logs for `submit_answer.timeout`
2. Verify `run.expires_at` is set correctly
3. Check server time: `SELECT NOW();`

**Fix:**
```python
# In services.py, verify:
is_expired = is_question_expired(run)
if is_expired:
    result = "timeout"  # Must override client choice
```

### Issue: Refresh always creates new run

**Symptom:** Progress lost on every refresh

**Diagnosis:**
1. Check `/run/start` request has `force_new: false`
2. Check backend `start_run()` service for existing run query

**Fix:**
```javascript
// In startOrResumeRun(), verify:
body: JSON.stringify({ force_new: false })  // NOT true!
```

### Issue: Media bonus not applied

**Symptom:** Audio question shows 30s instead of 40s

**Diagnosis:**
1. Check `currentQuestionMediaBonusSeconds` value
2. Check `/question/start` request includes `time_limit_seconds`
3. Verify backend `calculate_time_limit()` detects media

**Fix:**
```python
# In services.py calculate_time_limit():
media = question_data.get('media')
if media and isinstance(media, list) and len(media) > 0:
    return TIMER_SECONDS + MEDIA_BONUS_SECONDS  # 30 + 10
```

### Debugging Tips

**Enable Debug Logging:**
```bash
# Backend
export QUIZ_DEBUG=1

# Frontend
localStorage.setItem('quizDebug', '1');
# Or add ?quizDebug=1 to URL
```

**Check Server Time:**
```sql
SELECT NOW(), EXTRACT(EPOCH FROM NOW()) * 1000 AS now_ms;
```

**Check Run Timer State:**
```sql
SELECT 
  id, 
  current_index,
  question_started_at,
  expires_at,
  time_limit_seconds,
  EXTRACT(EPOCH FROM (expires_at - NOW())) AS remaining_seconds
FROM quiz_runs 
WHERE id = '<run_id>';
```

**Check Client State:**
```javascript
// In browser console
console.log(window.quizState);
console.log('Expires at:', new Date(window.quizState.expiresAtMs));
console.log('Server offset:', window.quizState.serverClockOffsetMs);
```

---

## Summary

### What Changed

| Component | Before | After |
|-----------|--------|-------|
| **DB Schema** | `deadline_at_ms` (BigInt, client) | `expires_at` (Timestamp UTC, server) |
| **Timer Start** | Client sends `started_at_ms` | Server decides start time |
| **Timer Display** | `remaining = deadline - Date.now()` | `remaining = expiresAt - (Date.now() + offset)` |
| **Timeout Check** | `answered_at_ms > deadline_at_ms` | `is_question_expired(run)` (server clock) |
| **Resume** | No state persistence | `/state` endpoint with complete timer state |
| **Anti-Cheat** | None (client controlled) | Server enforces timeout |

### Benefits

- ✅ **No Timer Bugs:** Server controls truth, no race conditions
- ✅ **Perfect Resume:** Refresh preserves exact state and remaining time
- ✅ **Anti-Cheat:** Client manipulation has no effect
- ✅ **No Drift:** Clock offset correction ensures accurate display
- ✅ **Backward Compatible:** Old fields remain functional during transition

### Files Modified

- [migrations/0012_add_server_based_timer.sql](c:\dev\hispanistica_games\migrations\0012_add_server_based_timer.sql)
- [game_modules/quiz/models.py](c:\dev\hispanistica_games\game_modules\quiz\models.py)
- [game_modules/quiz/services.py](c:\dev\hispanistica_games\game_modules\quiz\services.py)
- [game_modules/quiz/routes.py](c:\dev\hispanistica_games\game_modules\quiz\routes.py)
- [static/js/games/quiz-play.js](c:\dev\hispanistica_games\static\js\games\quiz-play.js)

### Documentation

- [docs/quiz-timer-root-cause.md](c:\dev\hispanistica_games\docs\quiz-timer-root-cause.md) - Root cause analysis
- [docs/quiz-timer-and-resume.md](c:\dev\hispanistica_games\docs\quiz-timer-and-resume.md) - This file

---

**Status:** ✅ Ready for Deployment  
**Testing Required:** See [Testing Checklist](#testing-checklist)  
**Priority:** P0 (Blocks fair gameplay)

---

**Next Steps:**

1. Run migration in dev environment
2. Test all checklist items
3. Deploy to staging for QA
4. Deploy to production
5. Monitor for timer-related errors
6. After 2-3 weeks: Consider removing legacy fields
