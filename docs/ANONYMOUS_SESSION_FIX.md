# Anonymous Session Fix - Implementation Summary

## Problem Statement

**Bug**: Quiz UI freezes for anonymous users - timer frozen, answers locked, explanation shows immediately.

**Root Cause**: `quiz_auth_required` decorator returned 401 for requests without session cookie, blocking all quiz API endpoints.

## Solution Overview

Implemented clean session management with these principles:
1. **No global cookie hacks** - Session creation only in HTML routes
2. **Deterministic phase logic** - `NOT_STARTED`, `ANSWERING`, `POST_ANSWER` based on server state
3. **Fail-fast error handling** - Timer failures return 409, frontend shows inline retry
4. **Idempotent AUTO-TIMEOUT** - Race condition protection with double-check

## Changed Files

### 1. `game_modules/quiz/routes.py` (Backend)

#### A) Removed: Global after_request Cookie Handler
- **Before**: `@blueprint.after_request` set cookie based on `g.quiz_session_token_new`
- **After**: Removed completely

#### B) Added: `ensure_quiz_session()` Function
```python
def ensure_quiz_session() -> str:
    """Ensure a quiz session cookie exists (create if missing).
    
    Returns session token (existing or newly created).
    Only called from HTML routes.
    """
    token = request.cookies.get(QUIZ_SESSION_COOKIE)
    if token:
        with get_session() as session:
            player = services.verify_session(session, token)
            if player:
                return token
    
    # Create anonymous session
    with get_session() as session:
        result = services.register_player(session, name="", pin=None, anonymous=True)
        if not result.success:
            raise RuntimeError("Failed to create anonymous session")
        return result.session_token
```

#### C) Modified: `quiz_auth_required` Decorator
- **Before**: Auto-created anonymous session + set `g.quiz_session_token_new`
- **After**: Simple verification - returns 401 if no valid session
```python
def quiz_auth_required(f: Callable) -> Callable:
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get(QUIZ_SESSION_COOKIE)
        if not token:
            return jsonify({"error": "No session", "code": "NO_SESSION"}), 401
        
        with get_session() as session:
            player = services.verify_session(session, token)
            if not player:
                return jsonify({"error": "Invalid session", "code": "INVALID_SESSION"}), 401
            
            g.quiz_player_id = player.id
            g.quiz_player_name = player.name
            g.quiz_player_anonymous = player.is_anonymous
        
        return f(*args, **kwargs)
    return decorated
```

#### D) Modified: `/quiz/<topic>/play` HTML Route
- **Before**: Used `@quiz_auth_required` decorator
- **After**: Calls `ensure_quiz_session()` explicitly + sets cookie in response
```python
@blueprint.route("/quiz/<topic_id>/play")
def quiz_play(topic_id: str):
    # Ensure session cookie exists
    session_token = ensure_quiz_session()
    
    with get_session() as session:
        topic = services.get_topic(session, topic_id)
        if not topic or not topic.is_active:
            return render_template("errors/404.html"), 404
        
        player = services.verify_session(session, session_token)
        player_name = player.name if player else None
        
        response = make_response(
            render_template(
                "games/quiz/play.html",
                page_name="quiz",
                topic_id=topic_id,
                topic_title_key=topic.title_key,
                player_name=player_name,
            )
        )
        
        # Set cookie in response
        response.set_cookie(
            QUIZ_SESSION_COOKIE,
            session_token,
            httponly=True,
            secure=request.is_secure,
            samesite="Lax",
            max_age=30 * 24 * 60 * 60,
        )
        
        return response
```

#### E) Fixed: Phase Logic in `/state` Endpoint
- **Before**: `remaining_seconds == None` → `phase="POST_ANSWER"` (WRONG!)
- **After**: Check if answer exists + timer state
```python
# Check if current question has been answered
stmt_current_answer = select(QuizRunAnswer).where(
    and_(
        QuizRunAnswer.run_id == run.id,
        QuizRunAnswer.question_index == run.current_index
    )
)
current_answer = session.execute(stmt_current_answer).scalar_one_or_none()

# Phase logic:
# - POST_ANSWER: Answer exists for current question
# - ANSWERING: Timer running (has expires_at)
# - NOT_STARTED: No answer and no timer
if current_answer:
    phase = "POST_ANSWER"
elif run.expires_at:
    phase = "ANSWERING"
else:
    phase = "NOT_STARTED"

timer_started = run.expires_at is not None
```

#### F) Added: `timer_started` Field in `/state` Response
```python
payload = {
    # ... existing fields ...
    "phase": phase,
    "timer_started": timer_started,  # NEW
    # ... rest of fields ...
}
```

#### G) Improved: AUTO-TIMEOUT Idempotency with DB Constraint

**Database Level**: UniqueConstraint on `quiz_run_answers(run_id, question_index)` (already exists in models.py)

**Application Level**: Double-check + IntegrityError handling
```python
if not existing_answer:
    # Re-check within same transaction
    session.flush()
    stmt_recheck = select(QuizRunAnswer).where(
        and_(
            QuizRunAnswer.run_id == run.id,
            QuizRunAnswer.question_index == run.current_index
        )
    )
    recheck_answer = session.execute(stmt_recheck).scalar_one_or_none()
    
    if not recheck_answer:
        try:
            # Create timeout answer
            timeout_answer = QuizRunAnswer(...)
            session.add(timeout_answer)
            
            # Advance to next question
            run.current_index += 1
            run.expires_at = None
            # ... clear timer fields ...
            
            session.flush()  # May raise IntegrityError
            
        except IntegrityError:
            # Uniqueness violation - another request already created timeout
            session.rollback()
            _quiz_debug_log("auto_timeout.duplicate_prevented")
            
            # Reload run and answer state after rollback
            session.expire_all()
            stmt_reload = select(QuizRun).where(...)
            run = session.execute(stmt_reload).scalar_one()
            # Continue with reloaded state
```

**Result**: Uniqueness guaranteed by DB constraint. Race conditions handled gracefully via rollback+reload.

### 2. `static/js/games/quiz-play.js` (Frontend)

#### A) Added: NOT_STARTED Phase Constant
```javascript
const PHASE = {
  NOT_STARTED: 'NOT_STARTED',    // Question loaded but timer not started yet
  ANSWERING: 'ANSWERING',        // Timer running, answer buttons enabled
  POST_ANSWER: 'POST_ANSWER'     // Answer submitted, explanation shown
};
```

#### B) Modified: `loadStateForResume()` - Handle NOT_STARTED
```javascript
// Update phase from server (NOT_STARTED, ANSWERING or POST_ANSWER)
if (stateData.phase === 'POST_ANSWER' || stateData.is_expired) {
  state.phase = PHASE.POST_ANSWER;
  state.isAnswered = true;
  state.lastOutcome = stateData.last_answer_result || 'timeout';
} else if (stateData.phase === 'NOT_STARTED' || !stateData.timer_started) {
  // Timer not started yet - need to call /question/start
  state.phase = PHASE.NOT_STARTED;
} else {
  state.phase = PHASE.ANSWERING;
}
```

#### C) Modified: `init()` - Handle NOT_STARTED Phase
```javascript
if (state.phase === PHASE.POST_ANSWER) {
  await loadCurrentQuestionForPostAnswer();
} else if (state.phase === PHASE.NOT_STARTED) {
  // Timer not started - loadCurrentQuestion will call startQuestionTimer
  await loadCurrentQuestion();
} else {
  // ANSWERING phase with active timer
  await loadCurrentQuestion();
}
```

#### D) Modified: `startQuestionTimer()` - Return Structured Error
```javascript
// Before: return false
// After: return { success, errorCode, errorMessage, status }

if (response.ok) {
  // ... timer setup ...
  return { success: true, expiresAtMs: state.expiresAtMs };
} else {
  // Parse error response
  let errorCode = 'UNKNOWN';
  let errorMessage = 'Failed to start question timer on server';
  try {
    const errorData = await response.json();
    errorCode = errorData.code || 'UNKNOWN';
    errorMessage = errorData.error || errorMessage;
  } catch (e) {
    // Ignore JSON parse errors
  }
  
  console.error(`Failed to start question timer (${response.status}):`, errorCode);
  state.expiresAtMs = null;
  state.questionStartedAtMs = null;
  state.deadlineAtMs = null;
  
  return { success: false, errorCode, errorMessage, status: response.status };
}
```

#### E) Modified: `loadCurrentQuestion()` - Inline Error Display
```javascript
if (!state.questionStartedAtMs) {
  const timerResult = await startQuestionTimer();
  if (!timerResult.success || !state.expiresAtMs) {
    console.error('[TIMER] Failed to start server timer:', timerResult.errorCode);
    
    // Show inline error with retry for 409 errors
    if (timerResult.status === 409) {
      showTimerStartError(timerResult.errorCode, timerResult.errorMessage);
      return; // Stop execution, wait for user to retry
    }
    
    // Other errors - throw
    throw new Error(`Failed to start question timer: ${timerResult.errorCode}`);
  }
}
```

#### F) Added: `showTimerStartError()` and `retryStartTimer()` Functions

**Error Display**:
```javascript
function showTimerStartError(errorCode, errorMessage) {
  const container = document.getElementById('quiz-question-container');
  if (!container) return;
  
  const errorHtml = `
    <div id="timer-error-card" class="md3-card md3-card--elevated" style="padding: 24px; margin: 16px 0; text-align: center;">
      <div class="md3-headline-small" style="color: var(--md-sys-color-error); margin-bottom: 12px;">
        ⚠️ Timer-Fehler
      </div>
      <div id="timer-error-message" class="md3-body-medium" style="margin-bottom: 16px;">
        ${errorMessage || 'Der Timer konnte nicht gestartet werden.'}
      </div>
      <div id="timer-error-code" class="md3-body-small" style="color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px;">
        Fehlercode: ${errorCode}
      </div>
      <button 
        id="timer-retry-btn"
        class="md3-button md3-button--filled" 
        onclick="retryStartTimer();"
        style="min-width: 140px;">
        <span class="md3-button__label">Erneut versuchen</span>
      </button>
    </div>
  `;
  
  container.innerHTML = errorHtml;
}
```

**Retry Logic (No Page Reload)**:
```javascript
async function retryStartTimer() {
  const retryBtn = document.getElementById('timer-retry-btn');
  const errorMessage = document.getElementById('timer-error-message');
  
  // Disable button and show spinner
  retryBtn.disabled = true;
  retryBtn.innerHTML = '<span class="md3-button__label">Wird versucht...</span>';
  
  try {
    // Attempt to start timer
    const timerResult = await startQuestionTimer();
    
    if (timerResult.success && state.expiresAtMs) {
      // Success! Reload state and render
      const stateResponse = await fetch(`${API_BASE}/run/${state.runId}/state`, {
        credentials: 'same-origin'
      });
      
      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        
        // Update state and re-render
        state.phase = stateData.phase === 'POST_ANSWER' ? PHASE.POST_ANSWER : PHASE.ANSWERING;
        state.expiresAtMs = stateData.expires_at_ms;
        state.serverClockOffsetMs = stateData.server_now_ms - Date.now();
        
        state.currentView = VIEW.QUESTION;
        renderCurrentView();
        
        if (state.phase === PHASE.ANSWERING && state.expiresAtMs) {
          startTimerCountdown();
        }
      }
    } else {
      // Failed - update error message and re-enable button
      errorMessage.textContent = timerResult.errorMessage || 'Timer konnte nicht gestartet werden.';
      retryBtn.disabled = false;
      retryBtn.innerHTML = '<span class="md3-button__label">Erneut versuchen</span>';
    }
  } catch (error) {
    // Network error - update message and re-enable button
    errorMessage.textContent = 'Fehler beim erneuten Versuch: ' + error.message;
    retryBtn.disabled = false;
    retryBtn.innerHTML = '<span class="md3-button__label">Erneut versuchen</span>';
  }
}
```

### 3. `scripts/test_anonymous_session.py` (REPRO Script)

Created comprehensive test script that:
1. GET `/quiz/<topic>/play` - Verifies cookie is set
2. POST `/api/quiz/<topic>/run/start` - Verifies run created
3. GET `/api/quiz/run/<id>/state` - Verifies phase, timer_started
4. POST `/api/quiz/run/<id>/question/start` - Verifies timer starts

## Verification Commands

### Manual Testing (requires dev server running)

```powershell
# 1. Start dev server
$env:FLASK_APP="src.app:create_app"
$env:FLASK_ENV="development"
$env:FLASK_SECRET_KEY="dev-secret-key-testing"
flask run --port 8000 --debug

# 2. Run REPRO script in new terminal
python scripts/test_anonymous_session.py

# Expected output:
# [SUCCESS] STEP 1 PASSED - Cookie 'quiz_session' was set
# [SUCCESS] STEP 2 PASSED - run_id received
# [SUCCESS] STEP 3 PASSED - Phase received: NOT_STARTED
# [SUCCESS] STEP 4 PASSED - Timer started successfully
# [SUCCESS] ALL TESTS PASSED ✅
```

### Smoke Tests (Browser)

1. **Anonymous User Flow**:
   - Navigate to `http://localhost:8000/quiz/variation_aussprache`
   - Click "Anonym spielen"
   - Verify: Timer countdown starts (30 → 29 → 28...)
   - Verify: Answer buttons are clickable
   - Click an answer
   - Verify: Explanation shows ONLY after answer
   - Click "Weiter"
   - Verify: Next question loads with new timer

2. **Refresh During Question**:
   - Start question, wait 10 seconds
   - Refresh page (F5)
   - Verify: Timer shows ~20 seconds remaining
   - Verify: Can still answer
   - Verify: Explanation hidden until answer

3. **Timeout Scenario**:
   - Start question, wait full 30 seconds
   - Verify: Answers lock automatically
   - Verify: Explanation shows "Zeit abgelaufen"
   - Click "Weiter"
   - Verify: Next question loads

## PASS/FAIL Matrix

### Backend Tests

| Test Case | Mode | Expected | Status |
|-----------|------|----------|--------|
| `/quiz/<topic>/play` sets cookie | Anonymous | quiz_session cookie present | ✅ CODE_VERIFIED |
| `/quiz/<topic>/play` sets cookie | Username | quiz_session cookie present | ✅ CODE_VERIFIED |
| `/api/quiz/.../start` with cookie | Anonymous | 200 + run_id | ✅ CODE_VERIFIED |
| `/api/quiz/.../start` with cookie | Username | 200 + run_id | ✅ CODE_VERIFIED |
| `/api/quiz/.../start` without cookie | Any | 401 NO_SESSION | ✅ CODE_VERIFIED |
| `/state` with no answer, no timer | Any | phase=NOT_STARTED | ✅ CODE_VERIFIED |
| `/state` with timer, no answer | Any | phase=ANSWERING | ✅ CODE_VERIFIED |
| `/state` with answer | Any | phase=POST_ANSWER | ✅ CODE_VERIFIED |
| `/state` includes timer_started | Any | true/false based on expires_at | ✅ CODE_VERIFIED |
| `/question/start` timer fails | Any | 409 TIMER_NOT_STARTED | ✅ CODE_VERIFIED |
| AUTO-TIMEOUT idempotency | Any | No duplicate answers | ✅ CODE_VERIFIED |

### Frontend Tests

| Test Case | Expected | Status |
|-----------|----------|--------|
| NOT_STARTED → call /question/start | Timer starts | ✅ CODE_VERIFIED |
| ANSWERING → countdown display | Timer counts down | ✅ CODE_VERIFIED |
| POST_ANSWER → show explanation | Explanation visible | ✅ CODE_VERIFIED |
| 409 error → inline retry UI | Error card + retry button | ✅ CODE_VERIFIED |
| Refresh mid-question → resume | Timer resumes from server state | ✅ CODE_VERIFIED |

### Integration Tests (Requires Live Server)

| Test Case | Mode | Expected | Status |
|-----------|------|----------|--------|
| Full anonymous flow | Anonymous | Timer, answers, explanation work | ⏳ PENDING_MANUAL |
| Refresh resume | Anonymous | State preserved, timer accurate | ⏳ PENDING_MANUAL |
| Timeout handling | Anonymous | Auto-advance after timeout | ⏳ PENDING_MANUAL |
| Username flow | Username | All features work same as anon | ⏳ PENDING_MANUAL |

## Code Review Verification

### Authentication Flow

✅ **Session Creation**: Only in `/quiz/<topic>/play` HTML route via `ensure_quiz_session()`  
✅ **No Global Hooks**: Removed `after_request` handler, no `g.quiz_session_token_new`  
✅ **Clean Separation**: HTML routes create sessions, API routes verify sessions  
✅ **401 Only When Appropriate**: API returns 401 only if no valid session exists  

### Phase Logic

✅ **Deterministic**: Phase based on answer existence + timer state, not just timer  
✅ **NOT_STARTED**: Explicit phase when no answer and no timer  
✅ **No Silent Fallbacks**: Frontend handles all three phases explicitly  
✅ **Timer Flag**: `timer_started` boolean for unambiguous state  

### Error Handling

✅ **Fail-Fast**: `/question/start` returns 409 if timer not set  
✅ **Structured Errors**: Return `{errorCode, errorMessage, status}`  
✅ **Inline UI**: Error card with retry button, no alert+reload  
✅ **Logging**: Console logs with errorCode for debugging  

### Idempotency

✅ **Double-Check**: AUTO-TIMEOUT checks twice within transaction  
✅ **Flush Before Insert**: Ensures database state is current  
✅ **Uniqueness**: Only one answer per (run_id, question_index)  

## Architecture Decisions

1. **Session Creation Location**: HTML routes only
   - **Why**: Clean separation - HTML establishes session, API uses it
   - **Benefit**: No global hooks, deterministic cookie setting

2. **NOT_STARTED Phase**: Explicit phase instead of ANSWERING without timer
   - **Why**: Prevents confusion - phase matches actual state
   - **Benefit**: Frontend can distinguish "need to start timer" from "timer running"

3. **409 for Timer Failures**: Conflict status code
   - **Why**: Semantic - server state conflict (timer should exist but doesn't)
   - **Benefit**: Frontend can distinguish from network/auth errors

4. **Inline Error Display**: No alert+reload
   - **Why**: Better UX - user sees context, can retry without losing state
   - **Benefit**: Less disruptive, maintains user flow

## Summary

**Problem**: Quiz UI froze for anonymous users due to 401 blocks on all API endpoints.

**Solution**: Clean session management with:
- HTML routes create sessions via `ensure_quiz_session()`
- API routes verify sessions via `quiz_auth_required` (401 if missing)
- Deterministic phase logic (NOT_STARTED, ANSWERING, POST_ANSWER)
- Inline error handling with retry for timer failures
- Idempotent AUTO-TIMEOUT with race condition protection

**Status**: All code changes implemented and syntax-validated. Manual testing pending dev server stability.

**Next Steps**: 
1. Run `scripts/test_anonymous_session.py` when dev server is stable
2. Perform browser smoke tests for anonymous and username modes
3. Verify timer accuracy across refreshes
4. Test timeout AUTO-ADVANCE behavior
