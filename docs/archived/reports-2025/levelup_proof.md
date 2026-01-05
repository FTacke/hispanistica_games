# Level-Up & Bonus Proof (Option A)

This document confirms that the Level-Up logic follows "Option A":
1.  **Server is Source of Truth**: The server calculates the total score including the bonus.
2.  **Frontend Visualizes**: The frontend receives the *final* score and the *bonus amount*, and calculates the "before" state for animation purposes only.

## 1. Backend Contract Verification

The following logs from `verify_contract.py` demonstrate the server response upon completing a level (2 questions correct).

### Scenario
- **Level 1**: 2 Questions (10 points each).
- **Perfect Bonus**: 20 points.
- **Expected Score**: 10 + 10 + 20 = 40.

### Response Payload (`/answer`)

```json
{
  "bonus_applied_now": true,
  "correct_option_id": 1,
  "difficulty": 1,
  "earned_points": 10,
  "explanation_key": "e",
  "finished": false,
  "is_correct": true,
  "is_run_finished": false,
  "joker_remaining": 2,
  "level_bonus": 20,
  "level_completed": true,
  "level_perfect": true,
  "next_question_index": 2,
  "result": "correct",
  "running_score": 40,
  "success": true
}
```

### Key Fields for Option A
- `running_score`: **40** (The final score stored on the server).
- `level_bonus`: **20** (The bonus amount added).
- `bonus_applied_now`: **true** (Signal to trigger the Level-Up stage).

## 2. Frontend Implementation (Option A)

The frontend (`quiz-play.js`) handles this response as follows:

1.  **Detection**: Checks `data.bonus_applied_now === true`.
2.  **State Transition**: Sets `state.pendingLevelUpData` and moves to `VIEW.LEVEL_UP`.
3.  **Visualization (`renderLevelUpInContainer`)**:
    - Calculates `scoreBefore = data.running_score - data.level_bonus` (40 - 20 = 20).
    - Displays: "20 + 20 Bonus = 40".
    - Animates the count-up.

This ensures the user *sees* the addition, but the *data* is strictly consistent with the server.

## 3. Demo Quiz Removal

The hardcoded "Demo Quiz" has been removed from `static/js/games/quiz-i18n.js`. The application now relies solely on dynamic topics loaded from the API (`/api/quiz/topics`), ensuring only real content (seeded via `seed_quiz_content.py`) is displayed.
