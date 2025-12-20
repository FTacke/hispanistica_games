# MD3 Structural Compliance Documentation — CO.RA.PAN Webapp

> Version 1.0 • Created: 2025-11-25

This document defines canonical HTML structures for MD3 components (Pages, Cards, Dialogs, Sheets, Forms) and provides enforceable rules for linting and migration.

---

## 1. Canonical Structures

### 1.1 Card Structure

**Order**: `header` → `content` → `actions`

```html
<article class="md3-card md3-card--outlined">
  <header class="md3-card__header">
    <h2 class="md3-title-large md3-card__title">Title</h2>
  </header>
  <div class="md3-card__content md3-stack--section">
    <!-- content, form fields, paragraphs -->
  </div>
  <footer class="md3-card__footer md3-card__actions">
    <button class="md3-button md3-button--text">Cancel</button>
    <button class="md3-button md3-button--filled">Save</button>
  </footer>
</article>
```

**Rules**:
- `md3-card__content` MUST exist
- `md3-card__actions`/`md3-card__footer` MUST come AFTER `md3-card__content`
- Header contains only: title, eyebrow, short intro text

### 1.2 Dialog Structure

**Order**: `<dialog>` → `__container` → `__surface` → `__header` → `__content` → `__actions`

```html
<dialog class="md3-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <h2 id="dialog-title" class="md3-title-large md3-dialog__title">Title</h2>
      </header>
      <div class="md3-dialog__content md3-stack--dialog">
        <!-- body content, form -->
      </div>
      <div class="md3-dialog__actions">
        <button class="md3-button md3-button--text">Cancel</button>
        <button class="md3-button md3-button--filled">Confirm</button>
      </div>
    </div>
  </div>
</dialog>
```

**Rules**:
- MUST have `md3-dialog__surface`
- MUST have `md3-dialog__content`
- MUST have `md3-dialog__actions`
- MUST have `md3-dialog__title` (h2) with an ID
- MUST have `aria-modal="true"`
- MUST have `aria-labelledby` or `aria-label`

### 1.3 Bottom Sheet Structure

**Order**: `md3-sheet` → `__backdrop` → `__surface` → `__header` → `__content` → `__actions`

```html
<div class="md3-sheet" role="dialog" aria-modal="true" aria-label="Sheet title">
  <div class="md3-sheet__backdrop"></div>
  <div class="md3-sheet__surface md3-sheet__container">
    <header class="md3-sheet__header">
      <h2 class="md3-title-large md3-sheet__title">Title</h2>
      <button class="md3-sheet__close-button">×</button>
    </header>
    <div class="md3-sheet__content md3-stack--dialog">
      <!-- fields -->
    </div>
    <div class="md3-sheet__actions">
      <button class="md3-button md3-button--filled">Submit</button>
    </div>
  </div>
</div>
```

### 1.4 Page Structure

**Order**: `md3-page` → `__header` → `__main` → `__section`

```html
<div class="md3-page">
  <header class="md3-page__header md3-stack--section">
    <div class="md3-page__eyebrow md3-body-small">Category</div>
    <h1 class="md3-headline-large">Page Title</h1>
    <p class="md3-body-medium">Short intro</p>
  </header>
  <main class="md3-page__main">
    <section class="md3-page__section md3-stack--page">
      <!-- content -->
    </section>
  </main>
</div>
```

### 1.5 Hero Structure (Goldstandard)

**Canonical Hero-Card mit Icon**:

```html
<header class="md3-page__header">
  <div class="md3-hero md3-hero--card md3-hero__container">
    <div class="md3-hero__icon" aria-hidden="true">
      <span class="material-symbols-rounded">icon_name</span>
    </div>
    <div class="md3-hero__content">
      <p class="md3-body-small md3-hero__eyebrow">Category / Context</p>
      <h1 class="md3-headline-medium md3-hero__title">Page Title</h1>
    </div>
  </div>
</header>
```

**Rules**:
- Hero MUST be inside `md3-page__header`
- Hero container has `md3-hero md3-hero--card md3-hero__container`
- Icon uses `md3-hero__icon` with `aria-hidden="true"`
- Content uses `md3-hero__content` with eyebrow and title
- Title is H1 with `md3-headline-medium md3-hero__title`
- Eyebrow is optional, uses `md3-body-small md3-hero__eyebrow`

**Reference Implementation**: `templates/pages/impressum.html`

**Pages requiring Hero**:
- Text pages (impressum, proyecto, datenschutz)
- Auth pages (account_profile, account_password, admin_users)
- Editor overview, atlas pages
- Search pages (advanced.html - Hero only, DataTables preserved)

**Hero CSS**: `static/css/md3/components/hero.css`

---

## 2. Alerts, Unterstützende Texte & Fehlermeldungen (Goldstandard)

This section defines canonical patterns for all messages, hints, warnings, and error texts in the application.

### 2.1 Alert Base Structure

**Purpose**: Provide clear visual feedback for errors, warnings, info, and success messages.

**Components**:
- `.md3-alert`: Base alert container
- `.md3-alert--banner`: Full-width for page/section alerts
- `.md3-alert--inline`: Compact for form contexts
- `.md3-alert__icon`: Material Symbol icon (must come FIRST for font loading)
- `.md3-alert__content`: Wrapper for title + text
- `.md3-alert__title`: Bold heading (md3-title-small)
- `.md3-alert__text`: Body text (md3-body-medium)

**Canonical Structure (with Title + Text)**:

```html
<div class="md3-alert md3-alert--error md3-alert--inline" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Fehler</p>
    <p class="md3-alert__text">Die Anmeldedaten sind ungültig. Bitte versuche es erneut.</p>
  </div>
</div>
```

**CRITICAL: Icon Class Order**
```html
<!-- ✅ CORRECT: material-symbols-rounded FIRST -->
<span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>

<!-- ❌ WRONG: Font class must come first -->
<span class="md3-alert__icon material-symbols-rounded" aria-hidden="true">error</span>
```

### 2.2 Alert Layout Variants

| Variant | Class | Padding | Border | Usage |
|---------|-------|---------|--------|-------|
| **Banner** | `md3-alert--banner` | Large (space-6) | 6px left | Page/section-level alerts |
| **Inline** | `md3-alert--inline` | Compact (space-4) | 4px left | Form contexts |

**Banner Example (Page-level)**:

```html
<section class="md3-page__section">
  <div class="md3-alert md3-alert--error md3-alert--banner" role="alert" aria-live="assertive">
    <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
    <div class="md3-alert__content">
      <p class="md3-alert__title">Sitzung abgelaufen</p>
      <p class="md3-alert__text">Bitte melde dich erneut an, um fortzufahren.</p>
    </div>
  </div>
</section>
```

**Inline Example (Form-level)**:

```html
<div class="md3-alert md3-alert--error md3-alert--inline" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Fehler</p>
    <p class="md3-alert__text">Benutzername oder Passwort ist falsch.</p>
  </div>
</div>
```

### 2.3 Alert Color Variants

All variants use MD3 container color tokens:

| Modifier | Background | Border | Text | Icon |
|----------|------------|--------|------|------|
| `md3-alert--error` | `--md-sys-color-error-container` | `--md-sys-color-error` | `--md-sys-color-on-error-container` | error |
| `md3-alert--warning` | `--md-sys-color-warning-container` | `--md-sys-color-warning` | `--md-sys-color-on-warning-container` | warning |
| `md3-alert--info` | `--md-sys-color-primary-container` | `--md-sys-color-primary` | `--md-sys-color-on-primary-container` | info |
| `md3-alert--success` | `--md-sys-color-success-container` | `--md-sys-color-success` | `--md-sys-color-on-success-container` | check_circle |

### 2.4 ARIA Roles & Live Regions

| Context | Role | aria-live | Usage |
|---------|------|-----------|-------|
| Error alert | `alert` | `assertive` | Immediate announcement |
| Warning alert | `status` | `polite` | Announced when idle |
| Info alert | `status` | `polite` | Announced when idle |
| Success alert | `status` | `polite` | Announced when idle |

### 2.5 Feld-unterstützender Text („supporting text")

**Purpose**: Provide contextual help for form fields.

**Position**: Always directly **below** a textfield, within the form flow.

**Structure**:

```html
<div class="md3-field-support" id="FIELDID-support">
  <p class="md3-body-small">Short help text, max 1-2 lines.</p>
</div>
```

**Rules**:
- The associated `<input>` gets `aria-describedby="FIELDID-support"` (combined with `FIELDID-error` if both exist)
- Styling: muted color (`--md-sys-color-on-surface-variant`), consistent line-height
- Use `md3-body-small` typography

### 2.6 Feld-Fehlermeldung

**Purpose**: Display validation errors for specific form fields.

**Position**: Directly **below** the field, replacing or alongside supporting text.

**Structure**:

```html
<div class="md3-field-error" id="FIELDID-error" role="alert" aria-live="assertive">
  <p class="md3-body-small">Specific error message explaining what to fix.</p>
</div>
```

**Rules**:
- Text color: `--md-sys-color-error`
- Optional: thin red indicator/border via CSS
- Rule: "Always at the field" — no detached error texts without clear reference
- Input must have `aria-invalid="true"` when error is shown
- Input must have `aria-describedby="FIELDID-error"` pointing to the error

**CSS Classes**:
- `.md3-field-error` — error container
- `.md3-field-error--visible` — modifier for show/hide animation

### 2.7 JavaScript Alert Utilities

For dynamically populated alerts, use `alert-utils.js`:

```javascript
import { showError, showSuccess, clearAlert } from '/static/js/md3/alert-utils.js';

// Show error alert
showError(statusContainer, 'Die Passwörter stimmen nicht überein.');

// Show success alert
showSuccess(statusContainer, 'Profil erfolgreich gespeichert.');

// Clear alert
clearAlert(statusContainer);
```

**Available Functions**:
- `showAlert(container, type, title, message, inline)` — Generic alert
- `showError(container, message, title)` — Error alert
- `showSuccess(container, message, title)` — Success alert
- `showInfo(container, message, title)` — Info alert
- `showWarning(container, message, title)` — Warning alert
- `clearAlert(container)` — Remove alert

### 2.8 Formular-weite Hinweise/Fehler (Inline Alerts)

**Purpose**: Display messages that apply to the entire form (e.g., login errors, submission success).

**Position**: As compact **inline alert** above the first form row, but still inside `md3-card__content` or `md3-dialog__content`.

**Structure**:

```html
<div class="md3-alert md3-alert--info md3-alert--inline" role="status" aria-live="polite">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">info</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Hinweis</p>
    <p class="md3-alert__text">Brief explanation, e.g., "Please log in to access this content."</p>
  </div>
</div>
```

**Variants**:
| Modifier | Role | Icon | Usage |
|----------|------|------|-------|
| `md3-alert--info` | `status` | `info` | Informational messages |
| `md3-alert--warning` | `status` | `warning` | Warnings (non-blocking) |
| `md3-alert--error` | `alert` | `error` | Error messages |
| `md3-alert--success` | `status` | `check_circle` | Success confirmations |

**Rules**:
- `role="alert"` + `aria-live="assertive"` for errors (immediate announcement)
- `role="status"` + `aria-live="polite"` for info/warning/success (announced when idle)
- Typography: `md3-alert__title` for heading, `md3-alert__text` for content
- `--inline` modifier provides compact padding for form contexts

### 2.9 Seiten- / systemweite Meldungen

**Purpose**: Global status messages (e.g., "Settings saved", "Session expired").

**Position**: Either:
1. **Page Alert**: Directly below the Hero in an `md3-page__section` with `md3-alert md3-alert--success md3-alert--banner`, or
2. **Snackbar**: Existing snackbar mechanics, visually aligned to MD3 standard

**Structure (Page Alert)**:

```html
<section class="md3-page__section">
  <div class="md3-alert md3-alert--success md3-alert--banner" role="status" aria-live="polite">
    <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">check_circle</span>
    <div class="md3-alert__content">
      <p class="md3-alert__title">Erfolg</p>
      <p class="md3-alert__text">Your changes have been saved.</p>
    </div>
  </div>
</section>
```

**Rules**:
- No loose, arbitrarily placed `<p>` or `<div>` messages
- System-wide alerts should be dismissible (optional close button)
- Use consistent animation (slide-down)

### 2.10 Dialoge/Sheets

**Rules**:
- Alerts belong in `md3-dialog__content` / `md3-sheet__content`, NOT in header or actions
- Field errors follow the same pattern as in regular forms — directly below inputs
- Form-wide alerts at the top of `__content`, before form fields

**Example (Dialog with Error)**:

```html
<div class="md3-dialog__content md3-stack--dialog">
  <!-- Form-wide error alert -->
  <div class="md3-alert md3-alert--error md3-alert--inline" role="alert" aria-live="assertive">
    <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
    <div class="md3-alert__content">
      <p class="md3-alert__title">Fehler</p>
      <p class="md3-alert__text">Invalid credentials. Please try again.</p>
    </div>
  </div>
  
  <!-- Form fields -->
  <div class="md3-outlined-textfield md3-outlined-textfield--block">
    <input type="text" id="username" aria-invalid="true" aria-describedby="username-error">
    <!-- ... -->
  </div>
  <div class="md3-field-error" id="username-error" role="alert" aria-live="assertive">
    <p class="md3-body-small">Username is required.</p>
  </div>
</div>
```

### 2.11 ARIA Guidelines Summary

| Context | Role | aria-live | Usage |
|---------|------|-----------|-------|
| Field error | `alert` | `assertive` | Immediate announcement |
| Form error alert | `alert` | `assertive` | Immediate announcement |
| Info/warning/success | `status` | `polite` | Announced when idle |
| Supporting text | (none) | (none) | Static, linked via `aria-describedby` |

**Input Attributes**:
- `aria-invalid="true"` when field has error
- `aria-describedby="FIELDID-support FIELDID-error"` to link both support and error texts

---

## 3. Typography Rules

| Context | Element | Class |
|---------|---------|-------|
| Page title | H1 | `md3-headline-large` |
| Card/Dialog/Section title | H2 | `md3-title-large` |
| Subsection | H3 | `md3-title-medium` |
| Body text | p | `md3-body-medium` |
| Small text | p | `md3-body-small` |
| Labels | label | `md3-label-large` |

**Rule**: Headings must be in order (H1 > H2 > H3). No skipping levels.

---

## 4. Form & Input Rules

### 4.1 Textfield Pattern (Goldstandard)

**Canonical MD3 Outlined Textfield**:

```html
<div class="md3-outlined-textfield md3-outlined-textfield--block">
  <input 
    type="text" 
    class="md3-outlined-textfield__input" 
    id="field-id" 
    name="field"
    autocomplete="appropriate-value"
    required
    aria-label="Accessible Label">
  <label class="md3-outlined-textfield__label" for="field-id">Visible Label</label>
  <span class="md3-outlined-textfield__outline">
    <span class="md3-outlined-textfield__outline-start"></span>
    <span class="md3-outlined-textfield__outline-notch"></span>
    <span class="md3-outlined-textfield__outline-end"></span>
  </span>
</div>
```

**Rules**:
- Wrapper: `div.md3-outlined-textfield.md3-outlined-textfield--block`
- Input: `input.md3-outlined-textfield__input` with `id`, `name`, `autocomplete`
- Label: `label.md3-outlined-textfield__label` with `for` pointing to input ID
- Outline: span wrapper with 3 outline parts (start, notch, end)
- Order: Input → Label → Outline (CSS requires this order)

**DO NOT USE**:
- `<label>` wrapping `<input>` (breaks MD3 outline animation)
- Inline `placeholder` instead of label (accessibility issue)
- Missing outline structure (breaks visual styling)

**Reference Implementation**: `templates/auth/login.html`

### 4.2 Form Rules

- Inputs MUST be inside `.md3-form` or `<form class="md3-auth-form">`
- Submit buttons MUST be inside the `<form>` OR have `form="form-id"` attribute
- Use `.md3-form__row` and `.md3-form__field` for layout

### 4.3 Button Types

| Type | Class | Usage |
|------|-------|-------|
| Primary | `md3-button--filled` | Main action |
| Secondary | `md3-button--outlined` | Alternative action |
| Text | `md3-button--text` | Cancel, dismiss |
| Danger | `md3-button--filled md3-button--danger` | Destructive action |

---

## 5. Spacing Tokens

Use CSS custom properties from `static/css/md3/tokens.css`:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight spacing |
| `--space-2` | 8px | Small gap |
| `--space-3` | 12px | Icon spacing |
| `--space-4` | 16px | Card padding |
| `--space-6` | 24px | Dialog padding |
| `--space-8` | 32px | Section gap |

**Stack helpers**: `md3-stack--page`, `md3-stack--section`, `md3-stack--dialog`

---

## 6. ARIA & Accessibility

| Component | Required Attributes |
|-----------|---------------------|
| Dialog | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Sheet | `role="dialog"`, `aria-modal="true"`, `aria-label` |
| Alert | `role="alert"`, `aria-live="assertive"` |
| Menu item | `role="menuitem"` |
| Separator | `role="separator"` |

---

## 7. Forbidden Patterns

### 7.1 Legacy Classes (ERROR)

- `class="card"` without `md3-card`
- `class="card-outlined"` → use `md3-card--outlined`
- `md3-button--contained` → use `md3-button--filled`
- `md3-login-sheet` → use `md3-sheet` (if sheet needed)

### 7.2 Login Sheet (DELETED)

**Status**: Login-Sheet pattern is completely removed from the codebase.

**Deleted Files**:
- `templates/auth/_login_sheet.html` ❌ DELETED
- `static/js/modules/auth/login-sheet.js` ❌ DELETED
- `/auth/login_sheet` endpoint ❌ REMOVED

**New Pattern** (REQUIRED):
- Full-page login at `/login` with `?next=` parameter
- 401 responses redirect to `/login?next=intended_url`
- No sheet/overlay for authentication
- Simpler, more accessible, better UX on mobile

### 7.3 Legacy Tokens (ERROR)

- `--md3-*` tokens → use `--md-sys-*` or `--space-*`

### 7.4 Inline Styles (WARNING)

- `style="margin: 12px"` → use `--space-*` tokens
- `style="padding: 16px"` → use `--space-4`

---

## 8. Lint Rule IDs

| ID | Severity | Description |
|----|----------|-------------|
| `MD3-DIALOG-001` | ERROR | Dialog missing `md3-dialog__surface` |
| `MD3-DIALOG-002` | ERROR | Dialog missing `md3-dialog__content` |
| `MD3-DIALOG-003` | ERROR | Dialog missing `md3-dialog__actions` |
| `MD3-DIALOG-004` | ERROR | Dialog missing `md3-dialog__title` |
| `MD3-DIALOG-005` | ERROR | Dialog missing `aria-modal="true"` |
| `MD3-DIALOG-006` | ERROR | Dialog missing `aria-labelledby` or `aria-label` |
| `MD3-CARD-001` | ERROR | Card missing `md3-card__content` |
| `MD3-CARD-002` | ERROR | Card actions before content |
| `MD3-FORM-001` | ERROR | Submit button outside form without `form` attr |
| `MD3-LEGACY-001` | ERROR | Legacy `class="card"` usage |
| `MD3-LEGACY-002` | ERROR | Legacy `--md3-*` token usage |
| `MD3-LEGACY-003` | ERROR | Legacy `md3-button--contained` |
| `MD3-SPACING-001` | WARN | Inline pixel spacing |
| `MD3-TEXTFIELD-001` | WARN | Non-standard textfield structure |
| `MD3-HEADER-001` | WARN | Complex content in header |
| `MD3-INPUT-001` | INFO | Input field inventory (for audit) |

---

## 9. Exceptions

### 9.1 DataTables (search/advanced)

Files under `templates/search/advanced*` use legacy DataTables layout.

- **No auto-fixes** applied
- **No build failures** for MD3 violations
- Violations logged as `IGNORED_MD3_IN_DATATABLES` (info only)

---

## 10. Quick Checklist

Use this checklist for every page, card, dialog, or form:

### Structure
- [ ] Card has `md3-card__content` 
- [ ] Card actions come AFTER content
- [ ] Dialog has `__surface`, `__content`, `__actions`
- [ ] Dialog has title with ID

### Accessibility
- [ ] Dialog has `aria-modal="true"`
- [ ] Dialog has `aria-labelledby` pointing to title ID
- [ ] Alerts have `role="alert"` or `role="status"` and appropriate `aria-live`

### Alerts & Field Messages
- [ ] Field errors always below the field as `md3-field-error`
- [ ] Form/page alerts only as `md3-alert` in content areas, NOT in headers
- [ ] `role="alert"` only for errors, otherwise `role="status"`
- [ ] Inputs with errors have `aria-invalid="true"` + `aria-describedby` pointing to error ID
- [ ] Supporting text uses `md3-field-support` with `aria-describedby` linkage

### Forms
- [ ] Submit button inside `<form>` OR has `form="id"`
- [ ] Inputs use `md3-outlined-textfield` pattern
- [ ] Form has `.md3-form` or `.md3-auth-form`

### Typography
- [ ] Page: H1 with `md3-headline-large`
- [ ] Card/Dialog: H2 with `md3-title-large`
- [ ] Subsection: H3 with `md3-title-medium`

### Tokens
- [ ] No `--md3-*` tokens (use `--md-sys-*`)
- [ ] No inline pixel values (use `--space-*`)
- [ ] No legacy class names

### Legacy Classes
- [ ] No `class="card"` (use `md3-card`)
- [ ] No `md3-button--contained` (use `--filled`)
- [ ] No `md3-login-sheet` (use `md3-sheet`)

---

## 11. Running the Linter

```bash
# Full scan with JSON report
python scripts/md3-lint.py --json-out reports/md3-lint.json

# Focus on auth templates
python scripts/md3-lint.py --focus templates/auth

# Allow warnings (CI mode)
python scripts/md3-lint.py --exit-zero
```

---

## 12. Auto-Fix (Conservative)

```bash
# Dry-run to see proposed fixes
python scripts/md3-autofix.py --dry-run

# Apply fixes to auth templates only
python scripts/md3-autofix.py --apply --scope templates/auth
```

**Safe auto-fixes**:
- Add `aria-modal="true"` to dialogs
- Add `aria-labelledby` when title ID exists
- Add `form="id"` to orphan submit buttons (single-form files)

**NOT auto-fixed** (manual review required):
- Reordering card/dialog blocks
- Changing class names
- Complex structural changes

---

*Document maintained by: CO.RA.PAN Development Team*
*Reference: `scripts/md3-lint.py`, `scripts/md3-autofix.py`*
