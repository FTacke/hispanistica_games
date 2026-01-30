# Refactoring Phase 2d

## Summary
- Fixed mobile meta bar layout by removing grid usage on small screens.
- Mobile now uses explicit two-row flex layout: row 1 (Level + Progress), row 2 (Timer + Joker centered).
- Desktop grid layout unchanged; chips remain equal size.

## Files Changed
- templates/games/quiz/play.html
- static/css/games/quiz.css

## What Was Broken
- Mobile grid areas produced inconsistent placement (progress centered or orphaned, chips drifting).
- Grid overrides in the media query did not fully reset desktop layout.

## Key CSS Changes
- Added meta rows in markup: `.quiz-question-meta-row--top` and `--bottom`.
- Desktop keeps grid layout; meta rows are `display: contents`.
- Mobile overrides:
  - `.quiz-question-card__meta` becomes column flex container.
  - Row 1 uses `justify-content: space-between`.
  - Row 2 centers chips with `flex-wrap`.
  - Grid settings are unset on mobile to avoid fallback positioning.

## How to Verify
1. Mobile viewport (~390px):
   - Row 1 shows Level left, Frage X von 10 right.
   - Row 2 centers Timer + Joker with equal sizing.
   - No overlaps or stray centered progress text.
2. Desktop viewport:
   - Level left, Timer/Joker centered, Progress right.
3. Confirm no layout shifts when answering questions.
