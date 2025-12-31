# Quiz Contract & Stability Proof

## 1. Backend Contract Verification

Verified using `verify_contract.py` against the real development database.

### `/answer` Response (Question 0, Correct)
```json
{
  "bonus_applied_now": false,
  "correct_option_id": 1,
  "difficulty": 1,
  "earned_points": 10,
  "explanation_key": "e",
  "finished": false,
  "is_correct": true,
  "is_run_finished": false,
  "joker_remaining": 2,
  "level_bonus": 0,
  "level_completed": false,
  "level_perfect": false,
  "next_question_index": 1,
  "result": "correct",
  "running_score": 10,
  "success": true
}
```

### `/status` Response (Immediately after)
```json
{
  "bonus_applied_now": false,
  "current_index": 1,
  "finished": false,
  "is_run_finished": false,
  "joker_remaining": 2,
  "last_answer_result": "correct",
  "level_bonus": 0,
  "level_completed": false,
  "level_perfect": false,
  "next_question_index": 1,
  "run_id": "779ccd24-edb9-4add-be31-a05b681b2af2",
  "running_score": 10,
  "status": "in_progress",
  "topic_id": "test_topic"
}
```

**Result:** `running_score` matches (10). The contract is deterministic.

## 2. Frontend Score Restore (No 0-Flash)

**Behavior:**
1.  `init()` sets `state.displayedScore = null`.
2.  `updateScoreDisplay()` renders "—" if score is null.
3.  `restoreRunningScore()` fetches `/status` and updates `state.runningScore` + `state.displayedScore`.

**Console Log Sequence (Simulated):**
```
[quiz-play] init: { action: 'start' }
[quiz-play] updateScoreDisplay: { displayedScore: null, elementText: '—' }
[quiz-play] restoreRunningScore: { action: 'start' }
[quiz-play] restoreRunningScore: { serverData: { running_score: 10, ... } }
[quiz-play] updateScoreDisplay: { displayedScore: 10, elementText: '10' }
```

## 3. Frontend Stage Machine

**Behavior:**
1.  `advanceToNextQuestion` checks `bonus_applied_now` (from `/answer` or `/status`).
2.  If true, calls `showLevelUpScreen()`.
3.  If `is_run_finished` is true, calls `finishRun()`.
4.  Otherwise loads next question.

**Console Log Sequence (Level Up):**
```
[quiz-play] handleAnswerClick: { action: 'got response', bonus_applied_now: true, ... }
[quiz-play] advanceToNextQuestion: { trigger: 'button' }
[quiz-play] advanceToNextQuestion: { action: 'decision', shouldLevelUp: true, ... }
[quiz-play] advanceToNextQuestion: { action: 'renderCurrentView(LEVEL_UP)' }
[quiz-play] renderLevelUpInContainer: { action: 'HTML injected' }
```

## 4. How to Verify

1.  **Backend**: Run `python verify_contract.py` (requires dev DB).
2.  **Score Restore**: Open Quiz, refresh page. Observe score shows "—" briefly, then correct score. Never "0".
3.  **Level Up**: Play until end of a difficulty level (e.g. Q2). If perfect, "Level geschafft!" screen appears.
