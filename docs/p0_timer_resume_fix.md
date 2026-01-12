# P0 Timer & Resume Fix

**Version:** 3.0  
**Date:** 2026-01-12  
**Status:** ✅ IMPLEMENTED

---

## Root Cause Analysis

### Symptome (Original P0-Bugs)

1. **Countdown "leakt" zur nächsten Frage** → Q2 startet mit 20s statt 30s und bleibt stehen
2. **Nach Timeout bleibt Timer bei 0** → Nächste Frage friert ein
3. **Refresh startet bei Q1** → Cheat-Exploit, sollte auf aktueller Frage bleiben
4. **Refresh nach Timeout ignoriert POST_ANSWER Phase** → Timer startet neu statt POST_ANSWER UI zu zeigen

### Kernursache: Client überschreibt Server-Phase

```javascript
// ❌ VORHER (BROKEN):
async function init() {
  await loadStateForResume();  // Server sagt: phase = 'POST_ANSWER'
  await loadCurrentQuestion();  // Client überschreibt: phase = ANSWERING ❌
                                // → Timer startet neu, obwohl Frage schon beantwortet!
}

async function loadCurrentQuestion() {
  // ... render question ...
  state.phase = PHASE.ANSWERING;  // ❌ Immer ANSWERING, egal was Server sagt!
  startTimerCountdown();          // ❌ Startet countdown auch bei abgelaufener Frage!
}
```

**Problem:** Frontend verhält sich wie "Client-Authoritative State Machine", ignoriert Server-Phase komplett.

**Lösung:** Server ist Single Source of Truth für:
- `phase` (ANSWERING | POST_ANSWER)
- `expires_at_ms` (UTC timestamp)
- `is_expired` (boolean)

---

## Implementierte Fixes

### A) Phase Enforcement (Server-Authoritative)

#### 1. loadStateForResume() - Server Phase speichern

```javascript
async function loadStateForResume() {
  const stateData = await fetch(`/api/quiz/run/${state.runId}/state`).then(r => r.json());
  
  // ✅ Server-Phase und Timer-State speichern
  state.serverPhase = stateData.phase;  // 'ANSWERING' | 'POST_ANSWER'
  state.serverIsExpired = stateData.is_expired || false;
  state.serverRemainingSeconds = stateData.remaining_seconds;
  
  // Timer-State NUR setzen wenn ANSWERING + nicht expired
  if (stateData.phase === 'ANSWERING' && stateData.expires_at_ms && !stateData.is_expired) {
    state.expiresAtMs = stateData.expires_at_ms;
    state.timeLimitSeconds = stateData.time_limit_seconds || 30;
  } else {
    // ✅ FIX: Timer-State clearen wenn POST_ANSWER
    state.expiresAtMs = null;
    state.deadlineAtMs = null;
    state.questionStartedAtMs = null;
  }
  
  // Phase übernehmen vom Server
  if (stateData.phase === 'POST_ANSWER' || stateData.is_expired) {
    state.phase = PHASE.POST_ANSWER;
    state.isAnswered = true;
    state.lastOutcome = stateData.last_answer_result || 'timeout';
  } else {
    state.phase = PHASE.ANSWERING;
  }
  
  return stateData;  // ✅ Return für caller inspection
}
```

#### 2. init() - Phase-basiertes Routing

```javascript
async function init() {
  // ... load run data ...
  
  const serverState = await loadStateForResume();
  await restoreRunningScore();
  
  if (state.currentIndex >= 10) {
    await finishRun();
    return;
  }
  
  // ✅ FIX: Respektiere Server-Phase
  if (state.phase === PHASE.POST_ANSWER) {
    // Server sagt POST_ANSWER → Zeige post-answer UI, KEIN Timer
    await loadCurrentQuestionForPostAnswer();
  } else {
    // Server sagt ANSWERING → Lade Frage + starte Timer
    await loadCurrentQuestion();
  }
}
```

#### 3. loadCurrentQuestionForPostAnswer() - NEU

```javascript
/**
 * Load question for POST_ANSWER state (resume after timeout/answer)
 * Server says POST_ANSWER → no timer start, only show UI
 */
async function loadCurrentQuestionForPostAnswer() {
  const questionConfig = state.runQuestions[state.currentIndex];
  const questionId = questionConfig.question_id;
  
  // Fetch question data
  const response = await fetch(`/api/quiz/questions/${questionId}`);
  state.questionData = await response.json();
  
  // Render question (but NO timer)
  renderQuestion();
  state.currentView = VIEW.QUESTION;
  renderCurrentView();
  
  // ✅ KEY: Phase bleibt POST_ANSWER, kein Timer-Start
  state.phase = PHASE.POST_ANSWER;
  state.isAnswered = true;
  
  // Apply UI based on outcome
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

### B) Timer State Cleanup (No Leaks)

#### 4. loadCurrentQuestion() - Hard Timer Reset

```javascript
async function loadCurrentQuestion() {
  // Guards...
  
  try {
    // ✅ FIX: Stop timers AND clear state IMMEDIATELY
    stopAllTimers();
    state.expiresAtMs = null;
    state.deadlineAtMs = null;
    state.questionStartedAtMs = null;
    
    // Fetch question data...
    
    // ✅ FIX: Start timer ONLY with valid server response
    if (!state.questionStartedAtMs) {
      const timerStarted = await startQuestionTimer();
      if (!timerStarted || !state.expiresAtMs) {
        throw new Error('Failed to start question timer on server');
      }
    }
    
    // Render question...
    
    // ✅ FIX: Set ANSWERING phase ONLY after successful timer start
    if (state.expiresAtMs) {
      state.phase = PHASE.ANSWERING;
      startTimerCountdown();
    }
  } finally {
    state.isLoadingQuestion = false;
  }
}
```

#### 5. startQuestionTimer() - Return Success

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

### C) Timeout UI Protection

#### 6. showAnswerResult() - Timeout Guard

```javascript
function showAnswerResult(selectedId, result, correctId) {
  // ✅ GUARD: Don't overwrite timeout UI
  if (state.lastOutcome === 'timeout') {
    debugLog('showAnswerResult', { action: 'blocked - timeout state active' });
    return;
  }
  
  // ... normal styling ...
}
```

#### 7. showCorrectAnswer() - Timeout Guard

```javascript
/**
 * @deprecated Use applyTimeoutUI() for timeouts
 */
function showCorrectAnswer(correctId) {
  // ✅ GUARD: Never show correct answer on timeout
  if (state.lastOutcome === 'timeout') {
    console.error('[GUARD] ❌ BLOCKED showCorrectAnswer - timeout state');
    return;
  }
  
  // ... normal styling ...
}
```

---

## Verification Tests (PFLICHT)

### Test 1: Normal Answer Flow
**Szenario:** Standard-Ablauf ohne Refresh/Timeout

**Steps:**
1. Start quiz
2. Q1 timer zählt von 30 runter (z.B. bis ~17)
3. Answer Q1
4. Click "Weiter"
5. Q2 timer startet bei 30 (nicht 17 oder 20)

**Expected:**
- ✅ Q1 timer counts down normally
- ✅ POST /answer stops timer
- ✅ Q2 timer starts fresh at ~30s
- ✅ No stale timer values leak

**Status:** 🔄 TO BE TESTED

---

### Test 2: Refresh During ANSWERING
**Szenario:** Page refresh während Frage läuft

**Steps:**
1. Start quiz
2. Wait until Q2 timer shows ~17 seconds
3. Press F5 (hard refresh)
4. Observe timer after page load

**Expected:**
- ✅ Page reloads, stays on Q2 (not Q1)
- ✅ Timer resumes at ~17s (not 30s)
- ✅ Timer continues counting down (not frozen)
- ✅ Answer still works

**Status:** 🔄 TO BE TESTED

---

### Test 3: Timeout Flow
**Szenario:** Timer läuft ab (reaches 0)

**Steps:**
1. Start quiz
2. Let Q1 timer reach 0 (don't answer)
3. Observe timeout UI
4. Click "Weiter"
5. Observe Q2 timer

**Expected:**
- ✅ At 0: Shows timeout UI (all answers gray/inactive)
- ✅ Timeout UI does NOT show correct answer (penalty)
- ✅ "Weiter" button is visible and clickable
- ✅ Q2 timer starts at ~30s (not 0, not frozen)
- ✅ POST_ANSWER state does not restart timer

**Status:** 🔄 TO BE TESTED

---

### Test 4: Refresh During POST_ANSWER
**Szenario:** Refresh nach Antwort aber vor "Weiter"

**Steps:**
1. Answer Q3
2. Wait for explanation card to show
3. Press F5 (before clicking "Weiter")
4. Observe UI after reload

**Expected:**
- ✅ Stays on Q3 (not Q4)
- ✅ Shows POST_ANSWER UI (explanation card visible)
- ✅ "Weiter" button is visible
- ✅ Timer is NOT running
- ✅ Answers are locked/styled correctly

**Status:** 🔄 TO BE TESTED

---

### Test 5: Refresh After Timeout
**Szenario:** Timeout dann Refresh vor "Weiter"

**Steps:**
1. Let Q1 timeout (timer reaches 0)
2. Observe timeout UI
3. Press F5 (before clicking "Weiter")
4. Observe UI after reload

**Expected:**
- ✅ Stays on Q1
- ✅ Shows POST_ANSWER timeout UI
- ✅ All answers locked+inactive (gray)
- ✅ Correct answer NOT revealed (timeout penalty)
- ✅ "Weiter" button visible
- ✅ Timer NOT running

**Status:** 🔄 TO BE TESTED

---

### Test 6: Q2 Timer After Q1 Timeout
**Szenario:** Verify timer resets after timeout

**Steps:**
1. Let Q1 timeout completely
2. Click "Weiter"
3. Observe Q2 timer immediately

**Expected:**
- ✅ Q2 timer starts at ~30s (not 0, not 20)
- ✅ Q2 timer counts down normally
- ✅ Q2 answers are clickable (not locked)

**Status:** 🔄 TO BE TESTED

---

### Test 7: DevTools Clock Manipulation (Anti-Cheat)
**Szenario:** Client tries to cheat with timer

**Steps:**
1. Start quiz
2. Open DevTools console
3. Run: `state.expiresAtMs = Date.now() + 999999000` (add 1000 hours)
4. Observe timer display
5. Wait 30 seconds real time
6. Try to answer

**Expected:**
- ✅ Timer display may show wrong value (client-side only)
- ✅ Server still times out after 30s real time
- ✅ POST /answer returns `result: "timeout"`
- ✅ Server clock is authoritative

**Status:** 🔄 TO BE TESTED

---

### Test 8: Timeout UI Cannot Be Overwritten
**Szenario:** Verify timeout styling is protected

**Steps:**
1. Let Q1 timeout
2. Open DevTools console
3. Run: `showCorrectAnswer(1)` manually
4. Observe answer styling

**Expected:**
- ✅ Timeout styling is preserved (gray/inactive)
- ✅ Correct answer is NOT highlighted
- ✅ Guard prevents showCorrectAnswer() execution

**Status:** 🔄 TO BE TESTED

---

## Code Changes Summary

### Modified Files

**1. static/js/games/quiz-play.js** (3339 lines)

**Changes:**
- Added `serverPhase`, `serverIsExpired`, `serverRemainingSeconds` to state object
- Modified `loadStateForResume()` to return stateData and clear timer state if POST_ANSWER
- Modified `init()` to check `state.phase` and route to appropriate function
- **NEW:** `loadCurrentQuestionForPostAnswer()` - handles POST_ANSWER resume without timer
- Modified `loadCurrentQuestion()` to throw error if timer start fails
- Modified `startQuestionTimer()` to return boolean success indicator
- Added guards in `showAnswerResult()` and `showCorrectAnswer()` for timeout protection
- Fixed timer state cleanup in `stopAllTimers()` and question transitions

**Lines changed:** ~150 lines (minimal patch, no refactor)

---

## Architecture Changes

### Before (Broken)
```
┌─────────────────────────────────────────────────┐
│ CLIENT (quiz-play.js)                           │
│                                                 │
│ init()                                          │
│   ├─> loadStateForResume()                     │
│   │    └─> GET /state → phase: 'POST_ANSWER'   │
│   │                                             │
│   └─> loadCurrentQuestion()  ❌ OVERWRITES!    │
│        └─> state.phase = ANSWERING             │
│            startTimerCountdown()               │
│                                                 │
│ Result: Timer restarts even though question    │
│         already answered/expired!               │
└─────────────────────────────────────────────────┘
```

### After (Fixed)
```
┌─────────────────────────────────────────────────┐
│ SERVER (routes.py, services.py)                 │
│ Single Source of Truth for:                     │
│  - phase (ANSWERING | POST_ANSWER)              │
│  - expires_at (UTC timestamp)                   │
│  - is_expired (boolean)                         │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ CLIENT (quiz-play.js)                           │
│                                                 │
│ init()                                          │
│   ├─> loadStateForResume()                     │
│   │    └─> GET /state → phase: 'POST_ANSWER'   │
│   │        state.phase = POST_ANSWER ✅         │
│   │                                             │
│   ├─> if (phase === POST_ANSWER)               │
│   │    └─> loadCurrentQuestionForPostAnswer()  │
│   │         - NO timer start                    │
│   │         - Show post-answer UI               │
│   │                                             │
│   └─> else (phase === ANSWERING)               │
│        └─> loadCurrentQuestion()               │
│             - Start timer only if valid         │
│             - Set phase = ANSWERING ✅          │
│                                                 │
│ Result: Server phase respected, no overwrites! │
└─────────────────────────────────────────────────┘
```

---

## Backend Contract (No Changes Required)

Backend already implements correct server-authoritative timer:

### GET /api/quiz/run/:runId/state
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
  "last_answer_result": null,
  "running_score": 450,
  "joker_remaining": 1,
  "finished": false
}
```

### POST /api/quiz/run/:runId/question/start
```json
{
  "success": true,
  "server_now_ms": 1736700000000,
  "expires_at_ms": 1736700040000,
  "question_started_at_ms": 1736700000000,
  "time_limit_seconds": 40,
  "remaining_seconds": 40.0
}
```

### POST /api/quiz/run/:runId/answer
Server validates timeout using `is_question_expired(run)`:
```python
is_expired = is_question_expired(run)  # Uses run.expires_at vs server UTC now

if is_expired:
    result = "timeout"  # Regardless of answered_at_ms
```

---

## Testing Checklist

### Pre-Deployment
- [ ] Run all 8 verification tests above
- [ ] Document results (PASS/FAIL) in this file
- [ ] Verify no console errors during tests
- [ ] Verify no regressions in existing features

### Post-Deployment
- [ ] Monitor for timer-related bug reports
- [ ] Check server logs for timeout enforcement
- [ ] Verify score calculation remains correct
- [ ] Test on mobile devices (iOS Safari, Android Chrome)

---

## Rollback Plan

If critical issues occur in production:

1. **Immediate:** Revert commit with this fix
2. **Temporary:** Add server-side flag to force `phase: 'ANSWERING'` on all `/state` calls (bypasses fix)
3. **Investigation:** Use browser DevTools to capture state transitions
4. **Fix:** Iterate on fix in development environment

---

## Known Limitations

1. **Server clock drift:** Client calculates `serverClockOffsetMs` to compensate, but extreme drift (>5s) may cause UI jank
2. **Network latency:** Slow networks may show timer "jump" on resume due to elapsed time during fetch
3. **Browser throttling:** Background tabs may have inaccurate countdown display (server timeout still enforced)

---

## Future Improvements (Out of Scope)

1. WebSocket connection for real-time timer sync (eliminates drift)
2. Offline support with IndexedDB state persistence
3. Server-sent events for timer updates (push vs poll)
4. Timer visualization showing server vs client offset

---

## Conclusion

**Root Cause:** Client-side state machine overwrote server-authoritative phase, causing timer to restart inappropriately.

**Fix:** Enforce server phase as Single Source of Truth, add `loadCurrentQuestionForPostAnswer()` to handle POST_ANSWER resume without timer.

**Impact:** Minimal code changes (~150 lines), no breaking API changes, backward compatible with old clients.

**Testing Status:** Implementation complete, awaiting verification tests (see Test 1-8 above).

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-12  
**Author:** Repo Agent (AI-assisted)
