# Refactoring Phase 2

## Summary
- Timer defaults updated to 40s (named) and 240s (anonymous), with +10s media bonus.
- Timer/joker HUD stays visible and more prominent.
- Inline markdown rendering supports **bold** and *italic* in prompt/answers/explanations with safe HTML.

## Backend Changes
- `game_modules/quiz/services.py`
  - Added `TIMER_SECONDS_NAMED=40`, `TIMER_SECONDS_ANON=240`.
  - Added `_get_base_timer_seconds(is_anonymous)` and used in `calculate_time_limit()`.
  - `start_question()` computes time limit server-side based on player anonymity + media.
- `game_modules/quiz/routes.py`
  - `time_limit_seconds` response now uses per-player base time when run lacks a stored value.

## Frontend Changes
- `static/js/games/quiz-play.js`
  - Countdown uses server-provided remaining seconds (`remaining_seconds`) with timestamp.
  - HUD timer/joker always visible; UI derives from `state.timeLimitSeconds`.
  - Inline markdown rendering applied to prompt/answers/explanations; aria labels use stripped text.
- `static/css/games/quiz.css`
  - Timer/joker sizing and emphasis increased for visibility.

## Tests
- Added `tests/test_quiz_timer_phase2.py` to verify:
  - Named player timer default = 40s.
  - Anonymous player timer = 240s + 10s media bonus.

## Manual Verification
- Start a quiz as named and anonymous users.
- Confirm HUD timer and joker are visible at all times.
- Confirm timer displays 40s named / 240s anonymous, and media questions add +10s.
- Confirm **bold** and *italic* render in prompt/answers/explanation.

## Notes
- No migrations required.
