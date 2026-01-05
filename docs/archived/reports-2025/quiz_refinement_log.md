# Quiz Refinement & Level-Up Finalization Log

## 1. Highscore / Leaderboard Logic

**File:** `game_modules/quiz/services.py`

The leaderboard logic was updated to show the **global top 30** scores for a topic, sorted by score (descending) and then by creation time (ascending, as a stable tiebreaker for "first to achieve").

```python
def get_leaderboard(session: Session, topic_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    """Get global leaderboard for topic, sorted by score.
    
    Ranking logic:
    1. total_score DESC (Highest score first)
    2. created_at ASC (Earlier finish wins tiebreaker)
    
    Returns top N entries (default 30).
    """
    stmt = (
        select(QuizScore)
        .where(QuizScore.topic_id == topic_id)
        .order_by(
            desc(QuizScore.total_score),
            asc(QuizScore.created_at)
        )
        .limit(limit)
    )
```

## 2. Page Title Consistency

**File:** `static/js/games/quiz-play.js`

The page title logic was standardized to `Quiz: <Quiz-Titel> – Games.Hispanistica`.

```javascript
  function updatePageTitle(view) {
    const quizTitle = state.topicTitle;
    const base = 'Games.Hispanistica';
    const title = quizTitle ? `Quiz: ${quizTitle}` : 'Quiz';
    document.title = `${title} – ${base}`;
  }
```

## 3. Terminology & Top-Bar

**File:** `static/js/games/quiz-i18n.js`
Renamed "Stufe" to "Level".

```javascript
        level_label: "Level",
        difficulty_level: "Level",
```

**File:** `templates/games/quiz/play.html`
Updated Top-Bar to use "Level" and `signal_cellular_alt` icon.

```html
        <div class="quiz-header__level-chip" id="quiz-level-chip">
          <span class="material-symbols-rounded">signal_cellular_alt</span>
          <span data-i18n="ui.quiz.level_label">Level</span>
          <span id="quiz-level-num">1</span>
        </div>
```

## 4. Level-Up Logic & UX

**File:** `static/js/games/quiz-play.js`

### Trigger Logic
Level-Up is now triggered strictly by `level_completed`, decoupled from bonus.

```javascript
    // LevelUp Trigger: ALWAYS show when level_completed is true.
    // Decoupled from bonus.
    const shouldLevelUp = !!data.level_completed;
```

### UI Implementation (Scenarios A/B/C)
The `renderLevelUpInContainer` function was rewritten to support Scenarios A (Perfect), B (Partial), and C (Fail), with a persistent Bonus Block and Auto-Forward timer.

```javascript
    // Determine Scenario
    let subline = '';
    let scenario = 'B'; // Default partial
    
    if (correctCount === totalCount) {
        scenario = 'A';
        subline = 'Perfekt gelöst!';
    } else if (correctCount === 0) {
        scenario = 'C';
        subline = 'Leider war das nichts.';
    } else {
        scenario = 'B';
        subline = 'Da geht noch mehr!';
    }
```

### Auto-Forward
Added `startAutoForwardTimer` (10s) which is cancelled on user interaction.

## 5. Manual Verification Steps

1.  **Highscore**: Finish a game with a high score. Check `/api/quiz/topics/<topic>/leaderboard` or the UI to ensure it appears at the top. Finish another game with the same score later; it should be ranked lower (or same rank but listed after).
2.  **Page Title**: Navigate to Quiz. Check browser tab title is `Quiz: <Title> – Games.Hispanistica`.
3.  **Level-Up**:
    *   Play until Level 1 ends.
    *   **Scenario A**: Answer all correctly. Verify "Perfekt gelöst!", Bonus > 0, "Richtig: 2/2".
    *   **Scenario B**: Answer 1/2 correctly. Verify "Da geht noch mehr!", Bonus +0, "Richtig: 1/2".
    *   **Scenario C**: Answer 0/2 correctly. Verify "Leider war das nichts.", Bonus +0, "Richtig: 0/2", Tip visible.
    *   **Auto-Forward**: Wait 10s on Level-Up screen. Verify it advances to next question.
