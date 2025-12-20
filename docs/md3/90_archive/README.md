# MD3 Goldstandard - Documentation Index

**Version:** 1.2  
**Date:** 2025-11-26

This documentation defines the canonical patterns for MD3 components in the CO.RA.PAN webapp.

---

## Documentation Files

| File | Description |
|------|-------------|
| [00-audit-report.md](./00-audit-report.md) | Initial component audit and findings |
| [01-buttons.md](./01-buttons.md) | Button variants and action zones |
| [02-tables.md](./02-tables.md) | Tables, lists, and empty states |
| [03-feedback.md](./03-feedback.md) | Snackbar, loading, and feedback components |
| [04-badges.md](./04-badges.md) | Role and status badges with icons |
| [05-responsiveness.md](./05-responsiveness.md) | Mobile breakpoints and responsive rules |
| [06-cards-sections.md](./06-cards-sections.md) | Cards structure and section spacing |
| [07-dialogs.md](./07-dialogs.md) | Dialog/Sheet patterns and responsive |
| [08-alerts.md](./08-alerts.md) | Alerts, banners, and field messages |
| [09-hero-headers.md](./09-hero-headers.md) | Page heroes and back-link pattern |
| [10-spacing-typography.md](./10-spacing-typography.md) | Spacing tokens and type scale |
| [11-tabs.md](./11-tabs.md) | Tab navigation and sub-tabs |
| [12-toolbar-filters.md](./12-toolbar-filters.md) | Toolbars and filter grids |
| [13-searchfield.md](./13-searchfield.md) | Search input with icon and clear |
| [14-pagination.md](./14-pagination.md) | Pagination navigation |
| [15-elevation-motion.md](./15-elevation-motion.md) | Shadows, transitions, and state layers |
| [16-loading-error.md](./16-loading-error.md) | Loading indicators, errors, empty states |
| [CHANGES.md](./CHANGES.md) | Change summary and new CSS classes |

---

## Quick Reference

### Button Variants

```html
<!-- Primary Action -->
<button class="md3-button md3-button--filled">Primary</button>

<!-- Secondary Action -->
<button class="md3-button md3-button--outlined">Secondary</button>

<!-- Tertiary Action -->
<button class="md3-button md3-button--text">Tertiary</button>

<!-- Danger Action -->
<button class="md3-button md3-button--filled md3-button--danger">Delete</button>
```

### Action Zones

```html
<!-- Form Actions -->
<div class="md3-actions">
  <button class="md3-button md3-button--text">Cancel</button>
  <button class="md3-button md3-button--filled">Save</button>
</div>

<!-- Dialog Actions -->
<div class="md3-dialog__actions">
  <button class="md3-button md3-button--text">Cancel</button>
  <button class="md3-button md3-button--filled">Confirm</button>
</div>

<!-- Card Actions -->
<footer class="md3-card__actions">
  <button class="md3-button md3-button--text">Cancel</button>
  <button class="md3-button md3-button--filled">Save</button>
</footer>
```

### Cards

```html
<article class="md3-card md3-card--outlined">
  <header class="md3-card__header">
    <h2 class="md3-title-large">Card Title</h2>
    <p class="md3-body-medium md3-card__description">Optional description</p>
  </header>
  <div class="md3-card__content">
    <!-- Content -->
  </div>
  <footer class="md3-card__actions">
    <button class="md3-button md3-button--filled">Action</button>
  </footer>
</article>
```

### Tables

```html
<div class="md3-table-container">
  <table class="md3-table">
    <thead>
      <tr><th>Column</th></tr>
    </thead>
    <tbody>
      <tr><td>Data</td></tr>
    </tbody>
  </table>
</div>
```

### Empty State

```html
<div class="md3-empty-state">
  <span class="material-symbols-rounded md3-empty-state__icon">search_off</span>
  <p class="md3-empty-state__title">No results</p>
  <p class="md3-empty-state__text">Try different search terms.</p>
</div>
```

### Badges

```html
<!-- Role Badge -->
<span class="md3-badge md3-badge--role-admin">
  <span class="material-symbols-rounded md3-badge__icon">verified_user</span>
  Admin
</span>

<!-- Status Badge -->
<span class="md3-badge md3-badge--status-active">
  <span class="material-symbols-rounded md3-badge__icon">check_circle</span>
  Active
</span>
```

### Snackbar (JavaScript)

```javascript
// Via global helper
window.MD3Snackbar.showSnackbar('Message', 'success');

// Or import module
import { showSnackbar } from './modules/core/snackbar.js';
showSnackbar('Message', 'error');
```

### Loading States

```html
<!-- Linear Progress -->
<div class="md3-linear-progress"></div>

<!-- Button Loading -->
<button class="md3-button md3-button--filled is-loading" disabled>
  <span class="md3-button__spinner"></span>
  Loading...
</button>
```

### Tabs

```html
<nav class="md3-tabs" role="tablist">
  <button class="md3-tab md3-tab--active" role="tab" aria-selected="true">Tab 1</button>
  <button class="md3-tab" role="tab" aria-selected="false">Tab 2</button>
</nav>
```

### Toolbar with Search

```html
<div class="md3-toolbar">
  <div class="md3-toolbar__filters">
    <div class="md3-searchfield md3-searchfield--inline">
      <span class="material-symbols-rounded md3-searchfield__icon">search</span>
      <input type="search" class="md3-searchfield__input" placeholder="Suchen...">
    </div>
  </div>
  <div class="md3-toolbar__actions">
    <button class="md3-button md3-button--filled">Aktion</button>
  </div>
</div>
```

### Pagination

```html
<nav class="md3-pagination">
  <button class="md3-button md3-button--outlined">
    <span class="material-symbols-rounded">chevron_left</span>
    Zurück
  </button>
  <span class="md3-pagination__info">Seite 1 von 10</span>
  <button class="md3-button md3-button--outlined">
    Weiter
    <span class="material-symbols-rounded">chevron_right</span>
  </button>
</nav>
```

---

## CSS Files Reference

| Component | CSS File |
|-----------|----------|
| Buttons | `static/css/md3/components/buttons.css` |
| Cards | `static/css/md3/components/cards.css` |
| Tables | `static/css/md3/layout.css` |
| Badges | `static/css/md3/components/top-app-bar.css` |
| Snackbar | `static/css/md3/components/snackbar.css` |
| Progress | `static/css/md3/components/progress.css` |
| Alerts | `static/css/md3/components/alerts.css` |
| Dialog | `static/css/md3/components/dialog.css` |
| Hero | `static/css/md3/components/hero.css` |
| Text Pages | `static/css/md3/components/text-pages.css` |
| Auth | `static/css/md3/components/auth.css` |
| Layout | `static/css/md3/layout.css` |
| Tabs | `static/css/md3/components/tabs.css` |
| Toolbar | `static/css/md3/components/toolbar.css` |
| Motion | `static/css/md3/components/motion.css` |
| Errors | `static/css/md3/components/errors.css` |

---

## Spacing Tokens

| Token | Value | Use Case |
|-------|-------|----------|
| `--space-1` | 4px | Micro gaps |
| `--space-2` | 8px | Tight spacing |
| `--space-3` | 12px | Form gaps |
| `--space-4` | 16px | Card content |
| `--space-5` | 20px | Card header |
| `--space-6` | 24px | Section |
| `--space-8` | 32px | Major break |

---

## Changelog

### 2025-11-26 - v1.2 (Advanced Phase)
- Added Tabs documentation (`11-tabs.md`)
- Added Toolbar/Filters documentation (`12-toolbar-filters.md`)
- Added Search Field documentation (`13-searchfield.md`)
- Added Pagination documentation (`14-pagination.md`)
- Added Elevation/Motion documentation (`15-elevation-motion.md`)
- Added Loading/Error Patterns documentation (`16-loading-error.md`)
- **New CSS Files:**
  - `toolbar.css` - Toolbar with filters/actions, search field, pagination
  - `motion.css` - Global motion tokens and state layer utilities
- **Extended tokens.css:**
  - Added `--elev-4`, `--elev-5` elevation levels
  - Added motion tokens (`--md-motion-easing-*`, `--md-motion-duration-*`)
  - Added state layer opacity tokens
- **Extended tabs.css:**
  - Added `--compact` variant
  - Added focus-visible and active states
- **Extended progress.css:**
  - Added circular progress
  - Added skeleton variants (avatar, button, card)
  - Added fixed position variant
- **Extended errors.css:**
  - Added `.md3-empty-state` with all variants
  - Added `.md3-error-card` for inline errors
  - Added `.md3-offline-banner`

### 2025-11-26 - v1.1
- Added Cards & Sections documentation (`06-cards-sections.md`)
- Added Dialogs documentation (`07-dialogs.md`)
- Added Alerts & Banners documentation (`08-alerts.md`)
- Added Hero/Page-Header documentation (`09-hero-headers.md`)
- Added Spacing & Typography documentation (`10-spacing-typography.md`)
- Extended `.md3-card` with `__actions`, `__footer`, `__description`
- Added card responsive rules for mobile
- Added dialog responsive rules with stacked buttons
- Added alert positioning utilities (`--above`, `--below`, `--dismissible`)
- Added back-link pattern (`.md3-back-link`)
- Added page-header pattern (`.md3-page-header`)
- Added stack utilities (`--compact`, `--card`)

### 2025-11-26 - v1.0
- Initial goldstandard documentation
- Extended `.md3-table` with hover/selected/disabled states
- Added `.md3-empty-state` canonical CSS
- Extended badge system with status variants
- Added icon button (`.md3-button--icon`)
- Added responsive rules for actions and tables
- Extended snackbar with warning variant
- Added button loading states and skeleton loaders
