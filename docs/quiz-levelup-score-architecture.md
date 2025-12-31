# Quiz Level-Up & Score System - Architecture Documentation

## Overview

This document describes the single-stage view architecture implemented for the quiz module, ensuring:
1. Level-Up appears as a proper intermediate page (not an overlay)
2. Score is always sourced from backend (persists across refresh)
3. Points pop is visible longer and not cut off by transitions
4. Transitions are slower and more noticeable (600ms)

---

## Stage View System

### Architecture Decision: Single Content Root

The quiz now uses a **single-stage architecture** where exactly ONE view is rendered at a time:

```
VIEW_QUESTION  →  VIEW_LEVEL_UP  →  VIEW_QUESTION  →  ...  →  VIEW_FINISH
```

### View States

```javascript
const VIEW = {
  QUESTION: 'question',   // Question card with answers
  LEVEL_UP: 'level_up',   // Level completion celebration
  FINISH: 'finish'        // End screen with highscore rank
};
```

### Core Function: `renderCurrentView()`

This function is the **single source of truth** for what's visible:

```javascript
function renderCurrentView() {
  // Hide ALL views
  questionContainer.hidden = true;
  levelUpEl.hidden = true;
  finishEl.hidden = true;
  
  // Show only current view
  switch (state.currentView) {
    case VIEW.QUESTION:
      questionContainer.hidden = false;
      break;
    case VIEW.LEVEL_UP:
      levelUpEl.hidden = false;
      break;
    case VIEW.FINISH:
      finishEl.hidden = false;
      break;
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

**Forbidden:**
- No manual `.hidden = false` outside of `renderCurrentView()`
- No overlays or multiple visible sections
- No "floating" Level-Up blocks below the stage

---

## Level-Up as Intermediate Page

### When Level-Up Shows

Level-Up appears **only** when:
1. `level_completed === true` (both questions in level answered)
2. `level_perfect === true` (both answers correct)
3. `level_bonus > 0` (token bonus awarded)

If `level_bonus === 0`, Level-Up is **skipped** (would appear broken).

### Trigger Point

Level-Up is **not** shown immediately after answer. Flow:

```
1. User answers question
   ↓
2. Explanation shown
   ↓
3. "Weiter" button appears
   ↓
4. User clicks "Weiter"
   ↓
5. IF pendingLevelUp === true:
      → transitionToView(VIEW.LEVEL_UP)
      → Auto-advance after 1500ms
      → transitionToView(VIEW.QUESTION)
   ELSE:
      → loadCurrentQuestion()
```

### Auto-Advance

- **Duration:** 1500ms (configurable via `LEVEL_UP_AUTO_ADVANCE_MS`)
- **Cancellable:** Click anywhere on Level-Up screen to skip
- **Timer Behavior:** Timer is **paused** during Level-Up (no seconds lost)

### State Management

```javascript
// After answer API response
if (data.level_perfect && data.level_bonus > 0) {
  state.pendingLevelUp = true;
  state.pendingLevelUpData = {
    difficulty: data.difficulty,
    level_bonus: data.level_bonus,
    next_level: data.difficulty + 1
  };
  state.advanceCallback = () => showLevelUpScreen();
}
```

---

## Score: Source of Truth & Persistence

### Principle: Backend is Authority

The frontend **never calculates score**. All score values come from backend:

```javascript
// Answer response
{
  "running_score": 120,      // Current total (source of truth)
  "earned_points": 20,       // Points from this answer
  "level_bonus": 40,         // Bonus if level complete
  ...
}
```

### Score State Variables

```javascript
state.runningScore   // Actual score from backend
state.displayedScore // Visual score (for count-up animation)
```

### Score Restoration on Refresh

**New endpoint:** `GET /api/quiz/run/<run_id>/status`

Returns:
```json
{
  "run_id": "...",
  "current_index": 3,
  "running_score": 80,
  "is_finished": false,
  "joker_remaining": 1
}
```

**Called on init:**
```javascript
async function restoreRunningScore() {
  const response = await fetch(`${API_BASE}/run/${state.runId}/status`);
  const data = await response.json();
  state.runningScore = data.running_score || 0;
  state.displayedScore = state.runningScore;
  updateScoreDisplay();
}
```

**Result:** Score persists correctly after page refresh.

### Score Update Flow

```javascript
// After answer
data.running_score = 120  // Backend calculates
state.runningScore = data.running_score
updateScoreWithAnimation(state.runningScore)  // Count-up
```

---

## Points Pop Stabilization

### Location: Topbar (Not Stage)

The `+X` pop is attached to **score chip in topbar**, not in the stage content:

```html
<div class="quiz-score-chip">
  <span id="quiz-score-display">100</span>
  <span id="quiz-score-pop" class="quiz-score-chip__pop">+20</span>
</div>
```

**Why:** Stage content changes during transitions, but topbar remains stable.

### Visibility Duration

```javascript
const POINTS_POP_DURATION_MS = 1000; // 1 second (was 600ms)
```

**CSS Animation:**
```css
--quiz-anim-pop: 1000ms; /* Longer visibility */
```

### Animation Robustness

- Pop uses separate animation state
- Not affected by stage view transitions
- `setTimeout` ensures cleanup after animation completes

---

## Slower Transitions

### Durations

```javascript
const TRANSITION_DURATION_MS = 600; // Was 500ms
const LEVEL_UP_AUTO_ADVANCE_MS = 1500; // Was 1400ms
```

**CSS:**
```css
--quiz-anim-transition: 600ms;
--quiz-anim-level-auto: 1500ms;
```

### Easing

```css
cubic-bezier(0.2, 0.0, 0.2, 1) /* Material Design emphasis */
```

### Race Condition Prevention

```javascript
state.isTransitioning = false;

async function transitionToView(newView) {
  if (state.isTransitioning) return; // Block parallel transitions
  
  state.isTransitioning = true;
  // ... transition logic ...
  state.isTransitioning = false;
}
```

**Functions that check `isTransitioning`:**
- `advanceToNextQuestion()`
- `advanceFromLevelUp()`
- `transitionToView()`

### Scroll Behavior

On every view change:
```javascript
window.scrollTo({ top: 0, behavior: 'smooth' });
```

**Ensures:** New view is always visible at top of viewport.

---

## Finish Screen

### View Transition

```javascript
// In finishRun()
state.currentView = VIEW.FINISH;
renderCurrentView();
showFinishScreen(data);
```

### Score Display

```javascript
// Use running_score (or total_score from finish response)
state.runningScore = data.total_score;

// Count-up animation
animateCountUp(finalScoreEl, data.total_score, 800);
```

**Important:** `data.total_score` from finish endpoint should **match** `state.runningScore`.

---

## Leaderboard Top 30

### Backend Change

```python
LEADERBOARD_LIMIT = 30  # Was 15
```

### UI Display

```javascript
// Finish API returns
{
  "player_rank": 5,
  "leaderboard_size": 30
}

// UI shows
"Platz 5 von 30 in der Bestenliste"
```

---

## Count-Up Animation

### Implementation

```javascript
function updateScoreWithAnimation(targetScore) {
  const startValue = state.displayedScore;
  const startTime = performance.now();
  
  function animateScore(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / COUNT_UP_DURATION_MS, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    
    state.displayedScore = startValue + (targetScore - startValue) * eased;
    updateScoreDisplay();
    
    if (progress < 1) {
      requestAnimationFrame(animateScore);
    }
  }
  
  requestAnimationFrame(animateScore);
}
```

### Duration

```javascript
const COUNT_UP_DURATION_MS = 700;
```

### Reduced Motion Support

```javascript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) {
  state.displayedScore = targetScore;
  updateScoreDisplay();
  return;
}
```

---

## Testing Checklist

### Backend

- [ ] `GET /api/quiz/run/<run_id>/status` returns `running_score`
- [ ] `POST /api/quiz/run/<run_id>/answer` returns `running_score`, `level_completed`, `level_perfect`, `level_bonus`
- [ ] `POST /api/quiz/run/<run_id>/finish` returns `player_rank` and `leaderboard_size` (max 30)
- [ ] `running_score` from answer matches `total_score` from finish

### Frontend Flow

1. **Start run**
   - [ ] Score chip shows 0 initially
   - [ ] Score chip updates after first correct answer

2. **Answer correct**
   - [ ] Score count-up animates from old to new value (700ms)
   - [ ] `+X` pop appears for 1000ms
   - [ ] Pop not cut off when clicking "Weiter"

3. **Page refresh**
   - [ ] Score chip shows correct value (not 0)
   - [ ] Can continue quiz from current question

4. **Perfect level completion**
   - [ ] Click "Weiter" after 2nd correct answer in level
   - [ ] Level-Up screen appears as **sole content** (no question visible)
   - [ ] Bonus count-up animates
   - [ ] Auto-advance after 1500ms
   - [ ] OR click to skip

5. **After Level-Up**
   - [ ] Transition to next question (smooth 600ms)
   - [ ] Score still correct
   - [ ] Timer working normally

6. **Finish screen**
   - [ ] Score matches what was displayed during quiz
   - [ ] Rank shows "Platz X von 30"
   - [ ] Can restart quiz

---

## Files Modified

### Backend

**game_modules/quiz/routes.py**
- Added `GET /api/quiz/run/<run_id>/status` endpoint

### Frontend JavaScript

**static/js/games/quiz-play.js**
- Added `VIEW` constants (QUESTION, LEVEL_UP, FINISH)
- Added `renderCurrentView()` - single view controller
- Added `transitionToView()` - smooth view transitions
- Added `restoreRunningScore()` - score persistence
- Changed `state.currentScore` → `state.runningScore`, `state.displayedScore`
- Added `state.pendingLevelUp`, `state.pendingLevelUpData`
- Added `state.isTransitioning` - race condition guard
- Updated `showLevelUpScreen()` - uses view system
- Updated `finishRun()` - uses view system
- Updated `updateScoreWithAnimation()` - robust count-up
- Updated `showPointsPop()` - longer duration (1000ms)

### Frontend CSS

**static/css/games/quiz.css**
- `--quiz-anim-transition: 600ms` (was 500ms)
- `--quiz-anim-pop: 1000ms` (was 550ms)
- `--quiz-anim-level-auto: 1500ms` (was 1400ms)

### HTML Template

**templates/games/quiz/play.html**
- No changes (already had `hidden` attributes)

---

## Key Principles

1. **One Stage, One View:** Never show multiple views simultaneously
2. **Backend is Truth:** Frontend never calculates score
3. **Transitions Matter:** 600ms gives users time to perceive changes
4. **Level-Up is a Page:** Not an overlay, not a notification
5. **Persistence:** Score survives refresh
6. **Accessibility:** Reduced motion support, screen reader announcements

---

## Known Edge Cases

### Scenario: User refreshes during Level-Up
**Behavior:** Level-Up data is lost, resumes at next question
**Acceptable:** Level-Up is celebratory, not critical

### Scenario: Multiple rapid clicks on "Weiter"
**Protection:** `state.isTransitioning` blocks parallel navigation

### Scenario: Network error during status fetch
**Fallback:** Score defaults to 0, user can continue (will resync on next answer)

---

## Future Improvements

1. **Animation polish:** Add slight bounce to Level-Up card entrance
2. **Sound effects:** Optional ding on Level-Up (accessibility consideration)
3. **Level-Up variations:** Different emojis/messages based on difficulty level
4. **Score persistence:** Store in localStorage as additional backup
5. **Transition timing:** Make configurable per-user (accessibility setting)

---

## Summary

The quiz now uses a **proper page-based architecture** where Level-Up is a real intermediate stage between questions, score is always correct and persists across refresh, and all transitions are smooth and noticeable. The implementation follows the principle of **single responsibility**: one function controls views, one source provides score, one animation timing is used throughout.
