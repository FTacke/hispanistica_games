# MD3 Core Specification

> **Project-Agnostic Material Design 3 Specification**  
> Version 3.0 — This document can be reused as-is for other projects.

---

## 1. Token System

All visual properties are defined as CSS custom properties (tokens). Direct use of hex colors, pixel values, or hardcoded values is prohibited.

### 1.1 Token Prefixes

| Prefix | Purpose | Example |
|--------|---------|---------|
| `--md-sys-color-*` | Colors | `--md-sys-color-primary` |
| `--space-*` | Spacing | `--space-4` |
| `--radius-*` | Border radius | `--radius-md` |
| `--elev-*` | Elevation/shadows | `--elev-2` |
| `--md-sys-typescale-*` | Typography | `--md-sys-typescale-body-medium-font` |
| `--md-motion-*` | Animation | `--md-motion-easing-standard` |

### 1.2 Color Tokens

#### Primary Colors
| Token | Usage |
|-------|-------|
| `--md-sys-color-primary` | Primary actions, links, focus rings |
| `--md-sys-color-on-primary` | Text/icons on primary color |
| `--md-sys-color-primary-container` | Tonal backgrounds |
| `--md-sys-color-on-primary-container` | Text on primary container |

#### Surface Hierarchy
```css
--md-sys-color-surface                    /* Base surface */
--md-sys-color-surface-container-lowest   /* Deepest layer */
--md-sys-color-surface-container-low      /* Low emphasis */
--md-sys-color-surface-container          /* Standard */
--md-sys-color-surface-container-high     /* Elevated (cards) */
--md-sys-color-surface-container-highest  /* Highest (inputs) */
```

#### Semantic Colors
| Token | Usage |
|-------|-------|
| `--md-sys-color-error` | Error states, danger buttons |
| `--md-sys-color-on-error` | Text on error color |
| `--md-sys-color-outline` | Borders, dividers |
| `--md-sys-color-outline-variant` | Subtle borders |

### 1.3 Spacing Tokens (8px Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Micro spacing (icon gaps) |
| `--space-2` | 8px | Tight (badge padding) |
| `--space-3` | 12px | Compact (form field gaps) |
| `--space-4` | 16px | Standard (button padding) |
| `--space-5` | 20px | Comfortable |
| `--space-6` | 24px | Card padding |
| `--space-8` | 32px | Section gaps |
| `--space-10` | 40px | Large sections |
| `--space-12` | 48px | Hero spacing |

### 1.4 Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 4px | Small chips |
| `--radius-sm` | 8px | Buttons, inputs |
| `--radius-md` | 12px | Cards |
| `--radius-lg` | 16px | Large cards, dialogs |
| `--radius-full` | 9999px | Pills, circular buttons |

### 1.5 Elevation Tokens

| Token | Usage |
|-------|-------|
| `--elev-1` | Subtle (cards, hover states) |
| `--elev-2` | Medium (menus, elevated cards) |
| `--elev-3` | High (dialogs, overlays) |
| `--elev-4` | Higher (FAB hover) |
| `--elev-5` | Maximum (drag preview) |

---

## 2. Typography

### 2.1 Type Scale Classes

| Class | Size | Weight | Usage |
|-------|------|--------|-------|
| `.md3-display-large` | 57px | 400 | Large headlines (rare) |
| `.md3-headline-large` | 32px | 400 | Page titles |
| `.md3-headline-medium` | 28px | 400 | Section titles, Hero titles |
| `.md3-title-large` | 22px | 400 | Card titles, dialog titles |
| `.md3-title-medium` | 16px | 500 | Subtitles |
| `.md3-body-large` | 16px | 400 | Body text (default) |
| `.md3-body-medium` | 14px | 400 | Secondary text |
| `.md3-body-small` | 12px | 400 | Captions, eyebrows |
| `.md3-label-large` | 14px | 500 | Button labels |
| `.md3-label-medium` | 12px | 500 | Badges, small labels |

---

## 3. Layout Patterns

### 3.1 Page Structure

Every page follows this canonical structure:

```html
<div class="md3-page">
  <header class="md3-page__header">
    <!-- Hero component -->
  </header>

  <main class="md3-page__main">
    <section class="md3-page__section md3-stack--section">
      <!-- Content -->
    </section>
  </main>
</div>
```

**Rules:**
- No custom wrappers (`.container`, `.page-wrapper`)
- Use `md3-stack--*` classes for vertical spacing
- One `md3-page` per template

### 3.2 Stack Classes (Vertical Rhythm)

| Class | Gap | Usage |
|-------|-----|-------|
| `.md3-stack--page` | 32px | Between top-level sections |
| `.md3-stack--section` | 24px | Within sections (title → content → actions) |
| `.md3-stack--dialog` | 16px | Dialog content |
| `.md3-stack--compact` | 8px | Tight layouts (form fields) |

```html
<main class="md3-stack--page">
  <section>Section 1</section>  <!-- 32px gap -->
  <section>Section 2</section>
</main>
```

### 3.3 Text Page Structure

```html
<main class="md3-text-page">
  <section class="md3-text-section">
    <h2 class="md3-title-large md3-section-title">Section Title</h2>
    <p class="md3-body-medium">Content...</p>
    <h3 class="md3-title-medium md3-subsection-title">Subsection</h3>
    <p class="md3-body-medium">More content...</p>
  </section>
</main>
```

**Heading Rules:**
- H1 lives in the Hero only
- H2 = top-level sections (`.md3-section-title`)
- H3 = subsections (`.md3-subsection-title`)
- Never use H4–H6 in main content

---

## 4. Components

### 4.1 Buttons

#### Canonical Markup
```html
<button class="md3-button md3-button--filled">
  <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">save</span>
  <span class="md3-button__label">Save</span>
</button>
```

#### Variants
| Class | Emphasis | Usage |
|-------|----------|-------|
| `.md3-button--filled` | High | Primary actions |
| `.md3-button--tonal` | Medium | Secondary actions |
| `.md3-button--outlined` | Low | Tertiary actions |
| `.md3-button--text` | Lowest | Cancel, dismiss |

#### Modifiers
- `.md3-button--danger` – Destructive actions (combine with `--filled`)
- `.md3-button--icon-only` – Icon-only buttons

#### Action Zones
```html
<!-- Form actions -->
<div class="md3-actions">
  <button class="md3-button md3-button--text">Cancel</button>
  <button class="md3-button md3-button--filled">Save</button>
</div>

<!-- Card actions -->
<footer class="md3-card__actions">
  <button class="md3-button md3-button--filled">Action</button>
</footer>
```

### 4.2 Textfields (Outlined)

#### Canonical Markup
```html
<div class="md3-outlined-textfield md3-outlined-textfield--block">
  <input
    class="md3-outlined-textfield__input"
    id="field-id"
    name="field"
    type="text"
    required
  >
  <label class="md3-outlined-textfield__label" for="field-id">Label</label>
  <span class="md3-outlined-textfield__outline">
    <span class="md3-outlined-textfield__outline-start"></span>
    <span class="md3-outlined-textfield__outline-notch"></span>
    <span class="md3-outlined-textfield__outline-end"></span>
  </span>
</div>
```

**Rules:**
- Wrapper is `<div>`, not `<label>`
- Order: input → label → outline
- Use `--block` modifier for full-width
- JS sets `.md3-outlined-textfield--focused` and `--has-value`

#### Select Variant
```html
<div class="md3-outlined-textfield">
  <select class="md3-outlined-textfield__input md3-outlined-textfield__input--select">
    <option value="">Select...</option>
  </select>
  <label class="md3-outlined-textfield__label">Label</label>
  <!-- outline structure -->
</div>
```

#### Error State
```html
<div class="md3-field-error" id="field-error" role="alert" aria-live="assertive">
  <p class="md3-body-small">Error message</p>
</div>
```

### 4.3 Checkbox

```html
<label class="md3-checkbox">
  <input type="checkbox" name="agree">
  <span class="md3-checkbox__icon"></span>
  <span class="md3-checkbox__label">I agree to the terms</span>
</label>
```

### 4.4 Cards

#### Canonical Markup
```html
<article class="md3-card md3-card--outlined">
  <header class="md3-card__header">
    <h2 class="md3-title-large md3-card__title">Title</h2>
    <p class="md3-body-medium md3-card__description">Optional description</p>
  </header>
  <div class="md3-card__content md3-stack--section">
    <!-- Content -->
  </div>
  <footer class="md3-card__footer md3-card__actions">
    <button class="md3-button md3-button--text">Cancel</button>
    <button class="md3-button md3-button--filled">Save</button>
  </footer>
</article>
```

#### Variants
| Class | Usage |
|-------|-------|
| `.md3-card--outlined` | Default, bordered |
| `.md3-card--elevated` | Raised with shadow |
| `.md3-card--filled` | Solid background |
| `.md3-card--tonal` | Tinted background |

### 4.5 Dialogs

#### Canonical Markup
```html
<dialog class="md3-dialog" aria-modal="true" aria-labelledby="dialog-title">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <h2 id="dialog-title" class="md3-title-large md3-dialog__title">Title</h2>
      </header>
      <div class="md3-dialog__content md3-stack--dialog">
        <!-- Content -->
      </div>
      <div class="md3-dialog__actions">
        <button class="md3-button md3-button--text">Cancel</button>
        <button class="md3-button md3-button--filled">Confirm</button>
      </div>
    </div>
  </div>
</dialog>
```

**Required Attributes:**
- `aria-modal="true"`
- `aria-labelledby` pointing to title ID

### 4.6 Sheets

```html
<div class="md3-sheet">
  <div class="md3-sheet__backdrop"></div>
  <div class="md3-sheet__surface">
    <header class="md3-sheet__header">
      <h2 class="md3-title-large">Title</h2>
      <button class="md3-sheet__close-button">✕</button>
    </header>
    <div class="md3-sheet__content">
      <!-- Content -->
    </div>
    <div class="md3-sheet__actions">
      <!-- Actions -->
    </div>
  </div>
</div>
```

### 4.7 Alerts

#### Inline Alert
```html
<div class="md3-alert md3-alert--error md3-alert--inline" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Error Title</p>
    <p class="md3-alert__text">Error message details.</p>
  </div>
</div>
```

#### Variants
| Class | Usage |
|-------|-------|
| `.md3-alert--error` | Errors (red) |
| `.md3-alert--warning` | Warnings (yellow) |
| `.md3-alert--success` | Success (green) |
| `.md3-alert--info` | Information (blue) |

#### Display Modes
| Class | Behavior |
|-------|----------|
| `.md3-alert--inline` | Inline with content |
| `.md3-alert--banner` | Full-width banner |

### 4.8 Hero

#### Canonical Markup
```html
<header class="md3-page__header">
  <div class="md3-hero md3-hero--card md3-hero__container">
    <div class="md3-hero__icon" aria-hidden="true">
      <span class="material-symbols-rounded">icon_name</span>
    </div>
    <div class="md3-hero__content">
      <p class="md3-body-small md3-hero__eyebrow">Category</p>
      <h1 class="md3-headline-medium md3-hero__title">Page Title</h1>
      <p class="md3-hero__intro">Brief introduction text.</p>
    </div>
  </div>
</header>
```

**Rules:**
- H1 lives only in the Hero
- Eyebrow is optional
- Hero only in `md3-page__header`, never in content

### 4.9 Navigation

#### Top App Bar
```html
<header class="md3-top-app-bar">
  <button class="md3-top-app-bar__navigation-icon">☰</button>
  <span class="md3-top-app-bar__title">Title</span>
  <div class="md3-top-app-bar__actions">
    <!-- Action buttons -->
  </div>
</header>
```

#### Navigation Drawer
```html
<nav class="md3-navigation-drawer">
  <a href="/" class="md3-navigation-drawer__item" aria-current="page">
    <span class="material-symbols-rounded">home</span>
    <span>Home</span>
  </a>
  <!-- More items -->
</nav>
```

#### Desktop Drawer Elevation (≥840px)

The standard/desktop drawer has a permanent right-oriented shadow (Level 1).

**Selector:** `aside#navigation-drawer-standard.md3-navigation-drawer--standard`  
**CSS Location:** `static/css/md3/components/navigation-drawer.css`

```css
.md3-navigation-drawer.md3-navigation-drawer--standard {
  box-shadow:
    1px 0 3px rgba(0, 0, 0, 0.08),
    4px 0 8px rgba(0, 0, 0, 0.06);
}
```

**Important:** The layout (`layout.css`) uses `overflow: clip` on `body.app-shell` at desktop breakpoints. This allows the shadow to paint outside the drawer's grid cell while still clipping actual content overflow.

---

## 5. Motion

### 5.1 Easing Curves

```css
--md-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
--md-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
--md-motion-easing-decelerate: cubic-bezier(0, 0, 0, 1);   /* Appearing */
--md-motion-easing-accelerate: cubic-bezier(0.3, 0, 1, 1); /* Disappearing */
```

### 5.2 Duration Tokens

| Token | Duration | Usage |
|-------|----------|-------|
| `--md-motion-duration-short2` | 100ms | Hover states |
| `--md-motion-duration-short3` | 150ms | Button feedback |
| `--md-motion-duration-short4` | 200ms | Standard transitions |
| `--md-motion-duration-medium2` | 300ms | Dialog appear |
| `--md-motion-duration-medium4` | 400ms | Page transitions |

---

## 6. Accessibility

### 6.1 Required Attributes

| Component | Required |
|-----------|----------|
| Dialog | `aria-modal="true"`, `aria-labelledby` |
| Alert | `role="alert"`, `aria-live="assertive"` |
| Icon | `aria-hidden="true"` |
| Button with icon only | `aria-label` |
| Current nav item | `aria-current="page"` |

### 6.2 Focus Management

- All interactive elements must be keyboard accessible
- Dialogs must trap focus
- Focus rings use `--md-sys-color-primary`
- Minimum touch target: 48×48px

---

## 7. Forbidden Patterns

### 7.1 Absolutely Prohibited

| Pattern | Reason |
|---------|--------|
| Hex colors (`#fff`, `#0a5981`) | Use tokens |
| Inline styles (`style="..."`) | Use classes |
| Pixel values in CSS | Use spacing tokens |
| `!important` (except documented) | Specificity issues |

### 7.2 Legacy Classes (Deprecated)

| Legacy | Replacement |
|--------|-------------|
| `.btn-*` | `.md3-button--*` |
| `.card`, `.card-*` | `.md3-card--*` |
| `.m-*`, `.mt-*`, `.mb-*` | `.md3-stack--*` |
| `--md3-*` tokens | `--md-sys-*` tokens |
| `.md3-button--contained` | `.md3-button--filled` |
| `.md3-login-sheet` | `.md3-sheet` |

---

## 8. Component Checklist

Before merging any new page:

- [ ] Uses `md3-page` structure
- [ ] H1 only in Hero
- [ ] All buttons use `md3-button--*`
- [ ] All inputs use `md3-outlined-textfield`
- [ ] No inline styles
- [ ] No hex colors
- [ ] No legacy classes
- [ ] Dialogs have `aria-modal` and `aria-labelledby`
- [ ] Alerts have `role="alert"`
- [ ] Passes `md3-lint.py`
