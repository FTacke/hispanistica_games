# MD3 Alerts & Field Messages Migration Report

> Generated: 2025-11-25 (Updated: 2025-11-26)  
> Branch: feature/auth-migration

## Executive Summary

This migration standardizes all hints, warnings, and error messages across the CO.RA.PAN webapp to follow a consistent MD3-based pattern. The changes ensure:

1. **Visual Consistency**: All alerts use MD3 container color tokens (`--md-sys-color-error-container`, etc.)
2. **Accessibility Compliance**: Proper ARIA attributes (`role`, `aria-live`, `aria-describedby`)
3. **Maintainability**: Documented patterns enforced by automated linting
4. **Title + Text Structure**: All alerts have a title and body text

---

## 1. New Components & Patterns

### 1.1 Alert Component (`.md3-alert`)

Full-width alert banners with variants:

| Variant | Class | Role | Background Token | Use Case |
|---------|-------|------|-----------------|----------|
| Error | `md3-alert--error` | `alert` | `--md-sys-color-error-container` | Error messages |
| Warning | `md3-alert--warning` | `status` | `--md-sys-color-warning-container` | Non-blocking warnings |
| Info | `md3-alert--info` | `status` | `--md-sys-color-primary-container` | Informational messages |
| Success | `md3-alert--success` | `status` | `--md-sys-color-success-container` | Success confirmations |

**Layout variants**:
- `md3-alert--banner`: Full-width for page/section alerts (6px border, larger padding)
- `md3-alert--inline`: Compact for form contexts (4px border, smaller padding)

**Structure** (with Title + Text):
```html
<div class="md3-alert md3-alert--error md3-alert--inline" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Fehler</p>
    <p class="md3-alert__text">Message text here.</p>
  </div>
</div>
```

**CRITICAL**: Icon class order must be `material-symbols-rounded md3-alert__icon` (font class FIRST).

### 1.2 Field Support (`.md3-field-support`)

Supporting text below form fields:
- Muted color (`--md-sys-color-on-surface-variant`)
- `md3-body-small` typography
- Linked via `aria-describedby` on input

### 1.3 Field Error (`.md3-field-error`)

Error messages for specific fields:
- Error color (`--md-sys-color-error`)
- `role="alert"` + `aria-live="assertive"`
- Linked via `aria-describedby` on input
- Input should have `aria-invalid="true"` when error is shown

### 1.4 Form Status Container (`.md3-form-status`)

Wrapper for JS-populated status messages:
- Hidden when empty
- Proper spacing for dynamically inserted alerts

### 1.5 JavaScript Alert Utilities

New utility module at `static/js/md3/alert-utils.js`:

```javascript
import { showError, showSuccess, clearAlert } from '/static/js/md3/alert-utils.js';
showError(statusEl, 'Nachricht hier');
showSuccess(statusEl, 'Erfolgreich!');
```

---

## 2. Files Modified

### 2.1 Documentation

| File | Change |
|------|--------|
| `docs/md3-template/md3-structural-compliance.md` | Completely revised Section 2: Alerts with Banner/Inline patterns, color tokens, icon class order |
| `docs/md3-alerts-migration-report.md` | This report (updated) |

### 2.2 CSS

| File | Change |
|------|--------|
| `static/css/md3/components/alerts.css` | **Rewritten** - now uses `--md-sys-color-error-container` tokens instead of `color-mix()` |
| `static/css/md3/components/alerts.css` | Added `--banner` variant for full-width alerts |
| `static/css/md3/components/alerts.css` | Added `.md3-alert__title` with `md3-title-small` typography |
| `static/css/md3/components/alerts.css` | All variants now set text color with `--md-sys-color-on-*-container` |

### 2.3 JavaScript

| File | Change |
|------|--------|
| `static/js/md3/alert-utils.js` | **NEW** - Utility module for creating MD3-compliant alerts in JS |
| `static/js/auth/account_password.js` | Migrated to use `alert-utils.js` |
| `static/js/auth/account_profile.js` | Migrated to use `alert-utils.js` |
| `static/js/auth/account_delete.js` | Migrated to use `alert-utils.js` |
| `static/js/auth/password_forgot.js` | Migrated to use `alert-utils.js` |
| `static/js/auth/password_reset.js` | Migrated to use `alert-utils.js` |

### 2.4 Templates

| File | Change |
|------|--------|
| `templates/auth/login.html` | Added `md3-alert__title` to flash message alert |
| `templates/auth/account_password.html` | Changed `<script>` to `type="module"` |
| `templates/auth/account_profile.html` | Changed `<script>` to `type="module"` |
| `templates/auth/account_delete.html` | Changed `<script>` to `type="module"` |
| `templates/auth/password_forgot.html` | Changed `<script>` to `type="module"` |
| `templates/auth/password_reset.html` | Changed `<script>` to `type="module"` |
### 2.5 Linter

| File | Change |
|------|--------|
| `scripts/md3-lint.py` | Added rules: `MD3-ALERT-001` through `MD3-ALERT-005`, `MD3-FIELD-ERROR-001/002`, `MD3-FIELD-SUPPORT-001` |
| `scripts/md3-lint.py` | Added `lint_alert_patterns()` function with new rules |
| `scripts/md3-lint.py` | Added `inventory_alert_patterns()` function |
| `scripts/md3-lint.py` | Alert rules apply to DataTables pages (structural rules still ignored) |

---

## 3. Linter Rules Added

### Error Rules

| Rule ID | Description |
|---------|-------------|
| `MD3-ALERT-001` | `role="alert"` without `.md3-alert` or `.md3-field-error` class |
| `MD3-ALERT-004` | Error alert missing `role="alert"` attribute |
| `MD3-ALERT-005` | Icon class order wrong (must be `material-symbols-rounded md3-alert__icon`) |

### Warning Rules

| Rule ID | Description |
|---------|-------------|
| `MD3-ALERT-002` | Legacy alert classes (`alert-danger`, `form-error`, `help-block`, `hint`) without MD3 equivalent |
| `MD3-ALERT-003` | Alert missing `.md3-alert__title` element |
| `MD3-FIELD-ERROR-001` | Error text not directly after `md3-outlined-textfield` block |
| `MD3-FIELD-ERROR-002` | Input with `aria-invalid="true"` without linked `md3-field-error` |

### Info Rules

| Rule ID | Description |
|---------|-------------|
| `MD3-FIELD-SUPPORT-001` | Inventory of `md3-field-support`, `md3-field-error`, and `md3-alert` elements |

---

## 4. Pattern Reference

### 4.1 Form-wide Error Alert (with Title)

```html
<div class="md3-alert md3-alert--error md3-alert--inline" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Fehler</p>
    <p class="md3-alert__text">Benutzername oder Passwort ist falsch.</p>
  </div>
</div>
```

### 4.2 Page-level Banner Alert

```html
<section class="md3-page__section">
  <div class="md3-alert md3-alert--success md3-alert--banner" role="status" aria-live="polite">
    <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">check_circle</span>
    <div class="md3-alert__content">
      <p class="md3-alert__title">Erfolg</p>
      <p class="md3-alert__text">Deine Änderungen wurden gespeichert.</p>
    </div>
  </div>
</section>
```

### 4.3 Field with Error

```html
<div class="md3-outlined-textfield md3-outlined-textfield--block">
  <input 
    type="text" 
    id="email"
    aria-invalid="true"
    aria-describedby="email-error">
  <label class="md3-outlined-textfield__label" for="email">Email</label>
  <!-- outline structure -->
</div>
<div class="md3-field-error" id="email-error" role="alert" aria-live="assertive">
  <p class="md3-body-small">Please enter a valid email address.</p>
</div>
```

### 4.4 Field with Supporting Text

```html
<div class="md3-outlined-textfield md3-outlined-textfield--block">
  <input 
    type="text" 
    id="username"
    aria-describedby="username-support">
  <label class="md3-outlined-textfield__label" for="username">Username</label>
  <!-- outline structure -->
</div>
<div class="md3-field-support" id="username-support">
  <p class="md3-body-small">Choose a unique username (3-20 characters).</p>
</div>
```

### 4.5 JS-populated Status Container

Using the new `alert-utils.js` module:

```html
<form id="myform">
  <!-- fields -->
</form>
<div id="status" class="md3-form-status" role="status" aria-live="polite"></div>

<script type="module">
  import { showSuccess, showError, clearAlert } from '/static/js/md3/alert-utils.js';
  
  const status = document.getElementById('status');
  
  // Show success
  showSuccess(status, 'Changes saved successfully.');
  
  // Show error
  showError(status, 'Something went wrong.');
  
  // Clear
  clearAlert(status);
</script>
```

---

## 5. Migration Notes

### 5.1 Scope Exclusions

- **LOKAL/** directory: Completely ignored (examples only)
- **DataTables pages** (`templates/search/advanced*`): Table layout preserved, but alert rules still apply
- **Special layout pages** (Player, Editor, Atlas): Layout preserved, alert patterns standardized

### 5.2 Preserved Patterns

- **Textfield Goldstandard**: Unchanged (per requirements)
- **Existing `md3-alert` in `_results.html`**: Already compliant, no changes needed
- **CQL Warning in advanced search**: Uses custom `md3-cql-warning` (specific to CQL editor context)

### 5.3 JavaScript Considerations

Forms using JS for validation should:
1. Update status container with `md3-alert` HTML
2. Set `aria-invalid="true"` on invalid inputs
3. Link errors via `aria-describedby`
4. Remove error state when input is corrected

---

## 6. Validation

Run the linter to validate compliance:

```bash
# Full scan with inventory
python scripts/md3-lint.py --inventory --json-out reports/md3-alerts-lint.json

# Focus on auth templates
python scripts/md3-lint.py --focus templates/auth

# Check for alerts specifically
python scripts/md3-lint.py --focus templates --errors-only
```

---

## 7. Future Work

1. **JS Helper Functions**: Consider adding `showFieldError()` / `showFormAlert()` helpers
2. **Snackbar Migration**: Align existing snackbar mechanics with MD3 tokens
3. **Error Animation**: Add subtle shake animation for field errors
4. **Dark Mode**: Verify alert colors work in dark theme

---

*Report generated as part of the MD3 Alerts & Field Messages migration.*
