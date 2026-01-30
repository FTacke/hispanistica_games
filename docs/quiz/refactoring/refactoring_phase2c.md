# Refactoring Phase 2c

## Summary
- Unified timer/joker chip sizing so both appear as one matched set.
- Meta bar now uses grid areas; desktop keeps 3 columns, mobile switches to two rows.
- HUD keeps exit on the right and shows user name on mobile with ellipsis.

## Files Changed
- static/css/games/quiz.css

## Desktop Behavior
- Meta bar: Level left, Timer+Joker centered, Fortschritt right.
- Timer and Joker chips share identical height, padding, icon size, and font size.

## Mobile Behavior
- Row 1: Level left, Fortschritt right.
- Row 2: Timer + Joker centered; wraps if needed.
- User chip shows name; text truncates with ellipsis when long.

## How to Verify
1. Desktop: check meta bar alignment and equal chip sizes.
2. Mobile width: confirm two-row meta layout and centered chips.
3. HUD: exit button right; user name visible; no overlap/clip.
4. Confirm no console errors during gameplay.

## Screenshot Hints
- Focus on the meta bar above the question: Level / Timer+Joker / Frage X von 10.
- Mobile: capture both meta rows in a narrow viewport.
