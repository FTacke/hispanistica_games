# Refactoring Phase 2b

## Summary
- Timer and Joker moved into the question meta bar, centered between Level and progress.
- Trophy score HUD removed entirely (no placeholder space).
- HUD simplified to title + user status + exit.

## Files Touched
- templates/games/quiz/play.html
- static/css/games/quiz.css
- static/js/games/quiz-play.js

## DOM/Selectors
- Meta bar now uses three columns in `.quiz-question-card__meta`:
  - Left: `.quiz-level-chip`
  - Center: `.quiz-question-meta-stats` containing `#quiz-timer` and `#quiz-joker-btn`
  - Right: `#quiz-progress`
- Removed: `#quiz-score-display`, `#quiz-score-pop`, `.quiz-hud__stats`

## How to Verify
1. Start a named run and an anonymous run.
2. Confirm Timer + Joker appear centered above the question (between Level and Frage X von 10).
3. Confirm no trophy indicator is visible anywhere.
4. Confirm timer counts down and joker remains clickable when available.
5. Check mobile width: meta row stacks with Timer/Joker centered and readable.

## Notes
- No backend changes required.
- Timer/Joker logic unchanged; only layout updated.
