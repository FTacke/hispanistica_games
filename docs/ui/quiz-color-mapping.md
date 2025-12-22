# Quiz UI - Color Token Mapping (Source of Truth)

**Last Updated:** 2025-12-21  
**Purpose:** Definitive reference for all color token usage in the Quiz module

---

## Core Principle

**NO hardcoded colors (`#hex`, `rgba`, etc.) in Quiz CSS or components.**  
All colors MUST come from semantic MD3 tokens defined in the design system.

---

## Token Mapping Reference

### Question & Content

| UI Element | Token | Notes |
|------------|-------|-------|
| Question Text | `on-surface` | Always high contrast |
| Question Background | `surface` | Main card background |
| Media Elements | `surface-variant` | Audio player, etc. |

### Answer Options

| UI Element | State | Token | Contrast Requirement |
|------------|-------|-------|---------------------|
| Answer Text | Default | `on-surface` | ≥ 4.5:1 |
| Answer Background | Default | `surface-variant` | - |
| Answer Border | Default | `transparent` | - |
| Answer Text | Hover | `on-surface` | ≥ 4.5:1 |
| Answer Background | Hover | `primary-container` | - |
| Answer Border | Hover | `primary` | - |
| Answer Text | Selected | `on-surface` | ≥ 4.5:1 |
| Answer Background | Selected | `primary-container` | - |
| Answer Border | Selected | `primary` | - |
| Answer Text | Correct | `on-surface` | ≥ 4.5:1 |
| Answer Background | Correct | `success-container` | - |
| Answer Border | Correct | `success` | - |
| Answer Text | Wrong | `on-surface` | ≥ 4.5:1 |
| Answer Background | Wrong | `error-container` | - |
| Answer Border | Wrong | `error` | - |
| Answer Text | Disabled (50/50) | `on-surface-variant` | ≥ 3:1 |
| Answer Background | Disabled | `surface-variant` | Opacity 0.6 on container |
| Answer Marker | Default | `on-surface-variant` | - |
| Answer Marker | Selected | `on-primary` | On `primary` background |

### Feedback Panels

| UI Element | Token | Notes |
|------------|-------|-------|
| Correct - Background | `success-container` | - |
| Correct - Border | `success` | Left border accent |
| Correct - Title | `success` | Status text |
| Correct - Explanation | `on-surface` | Body text (NOT variant!) |
| Wrong - Background | `error-container` | - |
| Wrong - Border | `error` | Left border accent |
| Wrong - Title | `error` | Status text |
| Wrong - Explanation | `on-surface` | Body text (NOT variant!) |

### Header & Meta Info

| UI Element | Token | Notes |
|------------|-------|-------|
| Level Label | `on-surface-variant` | Secondary text |
| Progress Numbers | `on-surface` | Primary text |
| Timer Background | `surface` | - |
| Timer Border (Normal) | `primary` | - |
| Timer Text (Normal) | `primary` | - |
| Timer Background (Warning) | `warning-container` | Added background |
| Timer Border (Warning) | `warning` | - |
| Timer Text (Warning) | `warning` | - |
| Timer Background (Danger) | `error-container` | Added background |
| Timer Border (Danger) | `error` | - |
| Timer Text (Danger) | `error` | - |

### Buttons

| UI Element | State | Token (BG / Text) | Notes |
|------------|-------|-------------------|-------|
| Primary Button | Default | `primary / on-primary` | Main CTA |
| Primary Button | Hover | `primary` (brightness 1.1) | - |
| Secondary Button | Default | `secondary-container / secondary` | - |
| Secondary Button | Hover | `secondary / surface` | Inverted |
| Ghost Button | Default | `transparent / primary` | - |
| Ghost Button | Hover | `primary-container / primary` | - |
| Button | Disabled | `surface-variant / on-surface` | Opacity 0.5 |
| Joker Button | Default | Custom `accent-gold` | Special highlight |
| Joker Button | Disabled | `surface-variant / on-surface` | Opacity 0.5 |

### Finish Screen

| UI Element | Token | Notes |
|------------|-------|-------|
| Title | `primary` | Large headline |
| Primary Result Card BG | `surface-variant` | Prominent container |
| Score Values | `primary` | Large numbers |
| Score Labels | `on-surface` | Clear readable labels |
| Result Note | `on-surface-variant` | Small helper text |
| Breakdown Card BG | `surface` | - |
| Breakdown Title | `on-surface` | Section header |
| Breakdown Level Text | `on-surface` | Row label |
| Breakdown Accuracy | `on-surface-variant` | Secondary info |
| Breakdown Points | `on-surface` | Important number |
| Breakdown Icon (Perfect) | `primary` | Achievement indicator |

### Snackbar / Toast

| UI Element | Token | Notes |
|------------|-------|-------|
| Default Background | `on-surface` | Dark overlay |
| Default Text | `surface` | Light text |
| Correct Background | `success` | - |
| Correct Text | `#fff` | Fixed white for maximum contrast |
| Wrong Background | `error` | - |
| Wrong Text | `#fff` | Fixed white for maximum contrast |
| Button Background | `rgba(255,255,255,0.25)` | Semi-transparent overlay |
| Button Text | `#fff` | Inherited from parent |

### Topic Cards

| UI Element | Token | Notes |
|------------|-------|-------|
| Card Background | `surface` | - |
| Icon Background | `primary-container` | - |
| Icon Color | `on-primary-container` | - |
| Title | `on-surface` | - |
| Description | `on-surface-variant` | - |

### Leaderboard

| UI Element | Token | Notes |
|------------|-------|-------|
| Header Background | `primary` | - |
| Header Text | `on-primary` | - |
| Row Background | `surface` | - |
| Row Border | `surface-variant` | Dividers |
| Rank (Normal) | `primary` | - |
| Rank (Gold) | Custom `accent-gold` | Top 3 highlight |
| Name | `on-surface` | - |
| Score | `on-surface` | - |
| Tokens | Custom `accent-gold` | Special currency |

---

## Custom Quiz Colors

These are defined as CSS custom properties in the quiz container but should eventually be replaced with MD3 tokens:

```css
--quiz-success: #2e7d32;
--quiz-success-container: #c8e6c9;

--quiz-warning: #f57c00;
--quiz-warning-container: #fff3e0;

--quiz-accent-gold: #ffc107;
--quiz-accent-purple: #9c27b0;
--quiz-accent-blue: #2196f3;
```

**TODO:** Map these to proper MD3 extended color tokens in the design system.

---

## Contrast Requirements (WCAG AA)

- **Normal Text:** ≥ 4.5:1
- **Large Text / Headlines:** ≥ 3:0
- **Disabled / Secondary Text:** ≥ 3:1 (not invisible!)
- **UI Components (borders, icons):** ≥ 3:1

---

## Rules for Future Changes

1. **Never add hardcoded colors** - always use tokens
2. **Test in both Light and Dark modes** - contrast must work in both
3. **Always pair container with on-container** - e.g., `success-container` → `on-success-container`
4. **Opacity on containers, not text** - maintain text contrast even when faded
5. **Verify contrast ratios** - use browser DevTools or contrast checker

---

## How to Verify Token Usage

```bash
# Check for hardcoded colors in quiz CSS (should return nothing)
grep -E '#[0-9a-fA-F]{3,6}|rgba?\(' static/css/games/quiz.css
```

---

## Related Documentation

- [MD3 Design Tokens](/docs/md3/tokens.md)
- [Quiz Module Architecture](/docs/MODULES.md#quiz)
- [UI Conventions](/docs/ui_conventions/)

---

**Principle:** If text isn't immediately readable, it's not a design choice—it's a bug in the token system.
