# Quiz Timer/State Root Cause Analysis

**Date:** 2026-01-12  
**Status:** ✅ Diagnosis Complete  
**Next:** Implementation of server-based timer system

---

## Executive Summary

The quiz timer system has **fundamental architectural flaws** that cause:
1. **Countdown gets stuck** with wrong values (e.g., starts at 20 instead of 30)
2. **Refresh resets to question 1** (cheat vulnerability)
3. **Timeout leaves timer at 0** for next question
4. **No server-side timer validation** allows client manipulation

**Root Cause:** Timer state is **client-controlled** with server only recording timestamps passively. The backend doesn't compute or enforce remaining time, creating race conditions and cheat vulnerabilities.

---

## Current Architecture (Broken)

### Backend: Passive Timestamp Recording

**Model:** `QuizRun` ([models.py:148-161](c:\dev\hispanistica_games\game_modules\quiz\models.py))
```python
# Timer state (client epoch ms)
question_started_at_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
deadline_at_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
```

**Key Issue:** Fields are **client-provided and never validated**. Server treats them as opaque values.

**Endpoints:**

1. **`POST /question/start`** ([routes.py:543-578](c:\dev\hispanistica_games\game_modules\quiz\routes.py))
   - Accepts `started_at_ms` from client
   - Calculates `deadline_at_ms = started_at_ms + 30000`
   - Stores both values **without verification**
   - Returns them back unchanged

2. **`POST /answer`** ([routes.py:578-648](c:\dev\hispanistica_games\game_modules\quiz\routes.py))
   - Accepts `answered_at_ms` from client
   - **Only checks:** `if answered_at_ms > run.deadline_at_ms: result = "timeout"`
   - **Clears timer state:** `run.question_started_at_ms = None; run.deadline_at_ms = None`
   - Never validates if deadline was actually server-computed

3. **`GET /status`** ([routes.py:649-738](c:\dev\hispanistica_games\game_modules\quiz\routes.py))
   - Returns `current_index` and `running_score`
   - **Does NOT return timer state** (question_started_at_ms, deadline_at_ms)
   - Cannot resume timer after refresh

**Problem:** Backend is a **dumb storage layer** for client timestamps. No source of truth.

### Frontend: Local Timer Truth

**Timer Logic:** ([quiz-play.js:1285-1349](c:\dev\hispanistica_games\static\js\games\quiz-play.js))

```javascript
async function startQuestionTimer() {
  const startedAtMs = Date.now();  // ❌ Client decides start time
  
  const response = await fetch(`${API_BASE}/run/${state.runId}/question/start`, {
    body: JSON.stringify({
      question_index: state.currentIndex,
      started_at_ms: startedAtMs,  // ❌ Send client time to server
    })
  });
  
  const data = await response.json();
  state.questionStartedAtMs = data.question_started_at_ms;  // ❌ Server echoes back our time
  state.deadlineAtMs = data.deadline_at_ms;
}

function startTimerCountdown() {
  const updateTimer = () => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((state.deadlineAtMs - now) / 1000));
    // ❌ Display uses local Date.now() against client-provided deadline
  };
  state.timerInterval = setInterval(updateTimer, 100);
}
```

**Problems:**
1. **No drift correction:** Client clock may be wrong, timer drifts over time
2. **Deadline is client-provided:** User can manipulate browser time
3. **No resume logic:** Refresh loses `deadlineAtMs` from state, can't reconstruct

---

## Bug Reproduction (Code Trace)

### Bug 1: Countdown Stuck at Wrong Value

**Scenario:** Answer at 20s remaining → Next question starts at "20" and stays there

**Trace:**
1. Question N: Timer counts down, user clicks answer at 20s
2. `handleAnswerClick()` → `submitAnswer()` → Backend clears timer: `deadline_at_ms = None`
3. Next question loads via `loadCurrentQuestion()`
4. `startQuestionTimer()` calls `/question/start` with new `Date.now()`
5. Backend sets `deadline_at_ms = new_start + 30000`
6. **BUG:** Frontend has race condition:
   - If `startTimerCountdown()` is called **before** `/question/start` response arrives
   - Old `state.deadlineAtMs` (from previous question) is still in memory
   - Timer calculates remaining from **stale deadline**
   - Display shows `Math.ceil((oldDeadline - now) / 1000)` ≈ 20s from previous question

**Root Cause:**
- `state.deadlineAtMs` not cleared between questions
- Timer starts before new deadline is set
- No server-side validation that countdown is correct

**Evidence:** [quiz-play.js:1045-1172](c:\dev\hispanistica_games\static\js\games\quiz-play.js)
```javascript
async function loadCurrentQuestion() {
  // ❌ state.deadlineAtMs NOT cleared here
  stopAllTimers();
  // ...
  await startQuestionTimer();  // ❌ Async - may complete AFTER startTimerCountdown
  startTimerCountdown();       // ❌ Uses stale state.deadlineAtMs if startQuestionTimer pending
}
```

### Bug 2: Refresh Resets to Question 1 (Cheat)

**Scenario:** User on question 5 → Refreshes page → Back to question 1

**Trace:**
1. User refreshes browser
2. `init()` calls `startOrResumeRun()` ([quiz-play.js:427-449](c:\dev\hispanistica_games\static\js\games\quiz-play.js))
3. **Hardcoded:** `body: JSON.stringify({ force_new: true })`
4. Backend creates **new run** with `current_index=0`
5. User loses progress

**Root Cause:**
- No resume logic in frontend
- `force_new: true` is always sent
- Backend `start_run()` service creates new run instead of returning existing

**Evidence:**
```javascript
async function startOrResumeRun() {
  const startResp = await fetch(`${API_BASE}/${state.topicId}/run/start`, {
    body: JSON.stringify({ force_new: true })  // ❌ Always new
  });
}
```

**Backend behavior:** [services.py:575-626](c:\dev\hispanistica_games\game_modules\quiz\services.py)
```python
def start_run(session, player_id, topic_id, force_new=False):
    if not force_new:
        existing = session.execute(/* find in_progress run */).scalar_one_or_none()
        if existing:
            return (existing, False)  # Resume
    
    # Create new run
    run = QuizRun(id=str(uuid.uuid4()), current_index=0, ...)
```

**Fix Required:** Frontend must call with `force_new: false` on normal init, check for existing run.

### Bug 3: Timeout Leaves Timer at 0

**Scenario:** Timeout occurs → Click "Weiter" → Next question timer stays at 0

**Trace:**
1. Timer reaches 0 → `handleTimeout()` called
2. Timeout submits answer with `selected_answer_id: null`
3. Backend clears `deadline_at_ms = None`
4. User clicks "Weiter" → `loadCurrentQuestion()`
5. New question calls `startQuestionTimer()`
6. **BUG:** `resetTimerUI()` was only added recently, older code path exists
7. If `startTimerCountdown()` uses old `state.deadlineAtMs` (not cleared), shows 0

**Root Cause:** Same as Bug 1 - state not properly reset between questions

**Evidence:** Recent fix added `resetTimerUI()` but core issue is async timing of `startQuestionTimer()` vs `startTimerCountdown()`.

### Bug 4: No Anti-Cheat / Server Timer Validation

**Scenario:** User manipulates browser clock or deadline value

**Vulnerability:**
1. User opens DevTools, sets `state.deadlineAtMs` to `Date.now() + 999999000`
2. Timer shows 999999 seconds remaining
3. User has unlimited time to answer
4. Backend only checks `answered_at_ms > deadline_at_ms` using **client-provided deadline**

**Root Cause:**
- Backend never computes remaining time from server clock
- `deadline_at_ms` is client-provided and trusted blindly
- No idempotent timeout mechanism

---

## Affected Files

| File | Lines | Issue |
|------|-------|-------|
| [game_modules/quiz/models.py](c:\dev\hispanistica_games\game_modules\quiz\models.py) | 148-161 | Timer fields are client ms, not server UTC |
| [game_modules/quiz/services.py](c:\dev\hispanistica_games\game_modules\quiz\services.py) | 756-772 | `start_question()` trusts client `started_at_ms` |
| [game_modules/quiz/services.py](c:\dev\hispanistica_games\game_modules\quiz\services.py) | 841-843 | Timeout check uses client-provided `deadline_at_ms` |
| [game_modules/quiz/routes.py](c:\dev\hispanistica_games\game_modules\quiz\routes.py) | 543-578 | `/question/start` accepts client time uncritically |
| [game_modules/quiz/routes.py](c:\dev\hispanistica_games\game_modules\quiz\routes.py) | 649-738 | `/status` doesn't return timer state for resume |
| [static/js/games/quiz-play.js](c:\dev\hispanistica_games\static\js\games\quiz-play.js) | 427-449 | `force_new: true` always creates new run |
| [static/js/games/quiz-play.js](c:\dev\hispanistica_games\static\js\games\quiz-play.js) | 1045-1172 | `loadCurrentQuestion()` doesn't clear deadline state |
| [static/js/games/quiz-play.js](c:\dev\hispanistica_games\static\js\games\quiz-play.js) | 1177-1220 | `startQuestionTimer()` sends client `Date.now()` |
| [static/js/games/quiz-play.js](c:\dev\hispanistica_games\static\js\games\quiz-play.js) | 1285-1349 | `startTimerCountdown()` uses local clock without drift correction |

---

## Why This Is Unfixable Without Backend Changes

**Attempted Frontend-Only Fixes Fail Because:**

1. **State clearing:** Can clear `deadlineAtMs` between questions, but doesn't fix:
   - Server still has no timer truth
   - Refresh still can't resume (no server state to restore)
   - Cheat vulnerability remains

2. **Drift correction:** Can sync client clock offset with server, but:
   - Still uses client-provided deadline
   - User can manipulate offset calculation
   - Doesn't fix refresh resume

3. **Resume logic:** Can change `force_new: false`, but:
   - `/status` endpoint doesn't return timer fields
   - No way to know how much time is left after refresh
   - Backend doesn't track "time remaining" as a concept

**Fundamental Issue:** Backend must own timer computation. Client can only display.

---

## Required Solution Architecture

### Backend: Server Clock as Source of Truth

1. **Store server UTC timestamps:**
   ```python
   # Replace client ms with server datetime
   question_started_at: Mapped[Optional[datetime]]  # server UTC
   expires_at: Mapped[Optional[datetime]]          # server UTC
   time_limit_seconds: Mapped[int]                 # 30 + bonus
   ```

2. **Compute remaining time server-side:**
   ```python
   def get_remaining_seconds(run):
       if not run.expires_at:
           return None
       server_now = datetime.now(timezone.utc)
       remaining = (run.expires_at - server_now).total_seconds()
       return max(0, remaining)
   ```

3. **Idempotent timeout:**
   ```python
   def check_timeout(run):
       if run.expires_at and datetime.now(timezone.utc) >= run.expires_at:
           if not run.answered_at:  # Not yet answered
               # Auto-mark as timeout
               answer = QuizRunAnswer(result='timeout', ...)
               session.add(answer)
               return True
       return False
   ```

4. **New endpoint `/run/:id/state`:**
   ```python
   @blueprint.route("/api/quiz/run/<run_id>/state")
   def get_run_state(run_id):
       run = get_run(run_id)
       server_now = datetime.now(timezone.utc)
       remaining = get_remaining_seconds(run)
       
       return jsonify({
           "current_index": run.current_index,
           "server_now_ms": int(server_now.timestamp() * 1000),
           "expires_at_ms": int(run.expires_at.timestamp() * 1000) if run.expires_at else None,
           "remaining_seconds": remaining,
           "phase": "ANSWERING" if remaining > 0 else "POST_ANSWER",
           ...
       })
   ```

### Frontend: Display Only

1. **Calculate server clock offset:**
   ```javascript
   const stateData = await fetch('/api/quiz/run/state');
   const serverNowMs = stateData.server_now_ms;
   const clientNowMs = Date.now();
   state.serverClockOffsetMs = serverNowMs - clientNowMs;
   ```

2. **Display countdown with drift correction:**
   ```javascript
   function updateTimer() {
       const clientNow = Date.now();
       const correctedNow = clientNow + state.serverClockOffsetMs;
       const remaining = Math.max(0, (state.expiresAtMs - correctedNow) / 1000);
       display.textContent = Math.ceil(remaining);
   }
   ```

3. **Resume after refresh:**
   ```javascript
   async function init() {
       const stateData = await fetch('/api/quiz/run/state');
       state.currentIndex = stateData.current_index;
       state.expiresAtMs = stateData.expires_at_ms;
       state.remainingSeconds = stateData.remaining_seconds;
       
       if (stateData.phase === 'POST_ANSWER') {
           // Already answered, show POST_ANSWER UI
           renderPostAnswer();
       } else {
           // Start timer from remaining time
           startTimerCountdown();
       }
   }
   ```

4. **Never send timer values to server:**
   ```javascript
   // OLD: Send started_at_ms
   // NEW: Server decides when it started
   await fetch('/api/quiz/run/question/start', {
       body: JSON.stringify({ question_index: N })  // No timestamp!
   });
   ```

---

## Implementation Order

1. **Backend Model Migration:**
   - Add `expires_at`, `time_limit_seconds` columns
   - Migrate data from `deadline_at_ms` (or drop old data)
   - Remove `question_started_at_ms`, `deadline_at_ms` (or deprecate)

2. **Backend Services:**
   - Update `start_question()` to use `datetime.now(UTC)`
   - Add `get_remaining_seconds()` helper
   - Update `submit_answer()` to check timeout via `expires_at`
   - Add idempotent timeout handling

3. **Backend Routes:**
   - Create `/run/:id/state` endpoint
   - Update `/question/start` to not accept `started_at_ms`
   - Update `/status` to return timer state (or deprecate for `/state`)

4. **Frontend:**
   - Update `init()` to call `/state` and resume
   - Remove `started_at_ms` from `/question/start` calls
   - Add server clock offset calculation
   - Update `startTimerCountdown()` to use corrected time
   - Change `startOrResumeRun()` to use `force_new: false`

5. **Testing:**
   - Manual checklist (see below)
   - Add integration tests for timeout idempotency
   - Test refresh resume at various points

---

## Testing Checklist

**Pre-Fix Bugs (Reproduce):**
- [ ] Answer at 20s → Next Q starts at ~20 and stays (Bug 1)
- [ ] Refresh on Q5 → Resets to Q1 (Bug 2)
- [ ] Timeout → Weiter → Next Q timer at 0 (Bug 3)
- [ ] DevTools: Set `state.deadlineAtMs` to far future → unlimited time (Bug 4)

**Post-Fix Verification:**
- [ ] Answer at any time → Next Q always starts at 30 (or 30+bonus)
- [ ] Refresh on Q5 → Stays on Q5, timer continues from remaining time
- [ ] Timeout → Weiter → Next Q timer starts at 30
- [ ] DevTools: Manipulate state → No effect, server enforces timeout
- [ ] Slow network: Timer doesn't drift even with delayed responses
- [ ] Multiple rapid refreshes: State consistent, no duplicates
- [ ] LevelUp transition: Timer doesn't carry over to next question

---

## Next Steps

1. Create migration script for backend model
2. Implement `/state` endpoint
3. Update frontend to use server state
4. Run full test checklist
5. Deploy and monitor for timer issues

---

**Status:** Ready for implementation  
**Owner:** Repo-Agent  
**Priority:** P0 (Blocks fair gameplay)
