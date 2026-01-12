# P0 Bug Fix: Transition Lock & Timer Issues

**Date:** 2025-01-20  
**Status:** FIXED  
**Files Changed:**
- `static/js/games/quiz-play.js`
- `tests/test_quiz_animations_ui.py`

---

## Bug #1: "Weiter" Button Blocked ("transition in flight")

### Symptom
Console shows: `[GUARD] ❌ BLOCKED loadCurrentQuestion - transition in flight`
The "Weiter" button doesn't advance to the next question.

### Root Cause
In `setupWeiterButton()` (lines 2262-2320), the `transitionInFlight` lock was released in different locations depending on the switch case, but **NOT inside a `finally{}` block**. If any error occurred during the async operation, the lock would never be released.

```javascript
// BEFORE (broken):
switch (state.pendingTransition) {
  case 'LEVEL_UP':
    state.transitionInFlight = false;  // Manual release before await
    await transitionToView(VIEW.LEVEL_UP);
    break;
  case 'NEXT_QUESTION':
    await loadCurrentQuestion();
    state.transitionInFlight = false;  // Manual release after await (never runs on error!)
    break;
}
btn.disabled = false;  // Also not reached on error
```

### Fix Applied
Wrapped entire switch block in `try/finally` to guarantee lock release:

```javascript
// AFTER (fixed):
try {
  switch (state.pendingTransition) {
    case 'LEVEL_UP':
      await transitionToView(VIEW.LEVEL_UP);
      break;
    case 'NEXT_QUESTION':
      await loadCurrentQuestion();
      break;
  }
} finally {
  state.transitionInFlight = false;  // ALWAYS releases, even on error
  btn.disabled = false;
}
```

---

## Bug #2: Timer Stuck at Wrong Value

### Symptom
- Q2 starts with timer showing "20" and stays there
- After timeout, next question shows "0"

### Root Cause
In `loadCurrentQuestion()`, the timer state (`expiresAtMs`, `deadlineAtMs`, `questionStartedAtMs`) was NOT cleared before fetching new question data. When `startTimerCountdown()` ran, it could use stale values from the previous question.

Additionally, `startTimerCountdown()` had no guard to check if `expiresAtMs` was actually set by the server.

### Fix Applied

1. **Clear timer state immediately in loadCurrentQuestion:**
```javascript
// ✅ FIX: Clear timer state IMMEDIATELY to prevent stale values
state.expiresAtMs = null;
state.deadlineAtMs = null;
state.questionStartedAtMs = null;
```

2. **Add guard in startTimerCountdown:**
```javascript
// ✅ GUARD 3b: Server time MUST be available
if (!state.expiresAtMs) {
  console.error('[TIMER GUARD] ❌ BLOCKED startTimerCountdown - no expiresAtMs from server');
  resetTimerUI();  // Show default time instead of stale value
  return;
}
```

---

## Bug #3: Timeout Shows Correct Answer ✅ (Already Fixed)

### Status
The `applyTimeoutUI()` function was already correctly implemented:
- Removes all answer styling classes
- Adds `quiz-answer-option--locked` + `quiz-answer-option--inactive` to ALL answers
- Does NOT add `quiz-answer--correct-reveal` to any answer

---

## Bug #4: CSS Wrong-State Overridden ✅ (Already Fixed in CSS)

### Status
The CSS was already correctly structured with exclusion selectors:
```css
.quiz-answer-option--locked:not(.quiz-answer--selected-wrong):not(.quiz-answer--selected-correct) {
  /* locked styles only apply if NOT selected-wrong/correct */
}
```

### Additional Fix
Found that JS was using mismatched class name `quiz-answer--locked` but CSS expects `quiz-answer-option--locked`. Fixed the JS to use the correct class name.

---

## Test Matrix

| Scenario | Expected | Result |
|----------|----------|--------|
| Q1 correct → Weiter → Q2 loads | Timer starts at 30s | ✅ |
| Q1 wrong → Weiter → Q2 loads | Timer starts at 30s | ✅ |
| Q2 timeout → Weiter → Q3 loads | Timer starts at 30s | ✅ |
| Level-Up → Weiter → Q3 loads | Timer starts at 30s | ✅ |
| Timeout UI | All answers locked+inactive, NO correct reveal | ✅ |
| Wrong answer styling | Red border visible, not overridden | ✅ |

---

## Related Files

- [quiz-play.js](../static/js/games/quiz-play.js) - Main quiz state machine
- [quiz.css](../static/css/games/quiz.css) - Answer state styles
- [test_quiz_animations_ui.py](../tests/test_quiz_animations_ui.py) - UI tests
