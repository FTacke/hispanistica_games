# MD3 Goldstandard – Alerts & Banners

> Part of the MD3 Goldstandard documentation series.

## 1. Audit Summary

### 1.1 Current State

**Alerts CSS:** `static/css/md3/components/alerts.css` (350 lines)

| Class | Status | Notes |
|-------|--------|-------|
| `.md3-alert` | ✅ OK | Base with flex layout, border-left accent |
| `.md3-alert--banner` | ✅ OK | Full-width page/section alerts |
| `.md3-alert--inline` | ✅ OK | Compact form alerts |
| `.md3-alert__icon` | ✅ OK | 24px icon with proper alignment |
| `.md3-alert__content` | ✅ OK | Flex column for title + text |
| `.md3-alert__title` | ✅ OK | `title-small` typography |
| `.md3-alert__text` | ✅ OK | `body-medium` typography |
| `.md3-alert--error` | ✅ OK | Error container colors |
| `.md3-alert--warning` | ✅ OK | Amber/warning colors |
| `.md3-alert--info` | ✅ OK | Primary container colors |
| `.md3-alert--success` | ✅ OK | Muted green (color-mix) |
| `.md3-field-support` | ✅ OK | Field hint text |
| `.md3-field-error` | ✅ OK | Field error messages |

### 1.2 Template Audit

| Template | Alert Usage | Issues |
|----------|-------------|--------|
| `auth/login.html` | `.md3-alert--error.md3-alert--inline` | ✅ Good, above form |
| `search/_results.html` | `.md3-alert--error` | ✅ Proper structure |
| `static/js/md3/alert-utils.js` | Dynamic alerts | ✅ Uses proper classes |

### 1.3 Identified Issues

1. **Positioning**: Some templates place alerts below inputs instead of above
2. **Success saturation**: Success variant is intentionally muted (good)
3. **Animation**: Has `alert-slide-down` animation (good)
4. **ARIA**: Missing `aria-live="polite"` on some dynamic alerts

---

## 2. Target Structure (MD3 Goldstandard)

### 2.1 Banner Alert (Page/Section Level)

```html
<div class="md3-alert md3-alert--error md3-alert--banner" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Error Title</p>
    <p class="md3-alert__text">Detailed error message explaining what went wrong.</p>
  </div>
</div>
```

### 2.2 Inline Alert (Form Context)

```html
<div class="md3-alert md3-alert--warning md3-alert--inline" role="alert">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">warning</span>
  <div class="md3-alert__content">
    <p class="md3-alert__text">Please check your input.</p>
  </div>
</div>
```

---

## 3. CSS Rules (Current - Verified)

### 3.1 Alert Base

```css
.md3-alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  margin-bottom: var(--space-4);
  border-radius: var(--radius-md);
  border-left: 4px solid transparent;
  align-items: flex-start;
  animation: alert-slide-down 300ms cubic-bezier(0.4, 0, 0.2, 1);
  background-color: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
}
```

### 3.2 Layout Variants

| Variant | Padding | Border Width | Use Case |
|---------|---------|--------------|----------|
| Base | `16px 20px` | 4px | Default |
| `.md3-alert--banner` | `16px 24px` | 6px | Page-level |
| `.md3-alert--inline` | `12px 16px` | 4px | Form-level |

### 3.3 Color Variants

| Variant | Background | Border | Icon/Title Color |
|---------|------------|--------|------------------|
| `--error` | `error-container` | `error` | `error` |
| `--warning` | `warning-container` | `warning` | `warning` |
| `--info` | `primary-container` | `primary` | `primary` |
| `--success` | `color-mix(surface 70%, success-container 30%)` | `color-mix(outline, success)` | `color-mix(on-surface-variant, success)` |

---

## 4. Positioning Rules

### 4.1 Alert Placement

| Context | Position | Spacing |
|---------|----------|---------|
| Form Error | **Above** the form | `margin-bottom: 16px` |
| Field Error | Below the field | `margin-top: 4px` |
| Page Banner | Top of content area | `margin-bottom: 24px` |
| Card Alert | Inside card content, above fields | `margin-bottom: 16px` |

### 4.2 Form Status Container

```css
.md3-form-status {
  margin-top: var(--space-3);
}

.md3-form-status:empty {
  display: none;
}

.md3-form-status > .md3-alert:last-child {
  margin-bottom: 0;
}
```

---

## 5. Field-Level Messages

### 5.1 Supporting Text

```html
<div class="md3-outlined-textfield">
  <input ...>
  <label ...>Email</label>
  <!-- outline elements -->
</div>
<div class="md3-field-support">
  <p>We'll never share your email.</p>
</div>
```

```css
.md3-field-support {
  margin-top: var(--space-1);
  padding-left: var(--space-4);
  color: var(--md-sys-color-on-surface-variant);
}

.md3-field-support p {
  margin: 0;
  font-size: var(--md-sys-typescale-body-small-font-size);
}
```

### 5.2 Field Error

```html
<div class="md3-outlined-textfield md3-outlined-textfield--error">
  <input ...>
  <label ...>Password</label>
</div>
<div class="md3-field-error" role="alert">
  <p>Password must be at least 8 characters.</p>
</div>
```

```css
.md3-field-error {
  margin-top: var(--space-1);
  padding-left: var(--space-4);
  color: var(--md-sys-color-error);
}

.md3-field-error:empty {
  display: none;
}
```

---

## 6. Responsive Rules

### 6.1 Mobile (≤480px)

```css
@media (max-width: 480px) {
  .md3-alert {
    padding: var(--space-3) var(--space-4);
    gap: var(--space-3);
  }
  
  .md3-alert--banner {
    padding: var(--space-3) var(--space-4);
    border-left-width: 4px;
  }
  
  .md3-alert--inline {
    padding: var(--space-2) var(--space-3);
  }
  
  .md3-alert__icon {
    font-size: 1.25rem;
  }
  
  .md3-alert__title {
    font-size: var(--md-sys-typescale-label-large-font-size);
  }
  
  .md3-alert__text {
    font-size: var(--md-sys-typescale-body-small-font-size);
  }
}
```

---

## 7. Accessibility

### 7.1 ARIA Attributes

| Alert Type | Role | aria-live | Notes |
|------------|------|-----------|-------|
| Error | `alert` | `assertive` | Immediate announcement |
| Warning | `alert` | `polite` | Standard priority |
| Info | `status` | `polite` | Lower priority |
| Success | `status` | `polite` | Confirmation |

### 7.2 Example with Full ARIA

```html
<div class="md3-alert md3-alert--success md3-alert--inline" 
     role="status" 
     aria-live="polite"
     aria-atomic="true">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">check_circle</span>
  <div class="md3-alert__content">
    <p class="md3-alert__text">Änderungen erfolgreich gespeichert.</p>
  </div>
</div>
```

---

## 8. JavaScript API

### 8.1 alert-utils.js

```javascript
import { createAlert, showAlert, hideAlert } from './md3/alert-utils.js';

// Create alert HTML
const alertHtml = createAlert({
  type: 'error',      // 'error' | 'warning' | 'info' | 'success'
  title: 'Error',     // Optional title
  message: 'Something went wrong.',
  inline: true        // true = inline, false = banner
});

// Show in container
showAlert(containerElement, {
  type: 'success',
  message: 'Saved!'
});

// Hide/remove
hideAlert(alertElement);
```

---

## 9. Migration Checklist

- [x] Alert base structure is correct
- [x] All color variants defined with proper tokens
- [x] Responsive breakpoints in place
- [ ] Verify all templates place alerts above inputs
- [ ] Add `aria-live` to dynamic JS-generated alerts
- [ ] Test animation on all browsers

---

## 10. Examples

### Login Error

```html
<div class="md3-alert md3-alert--error md3-alert--inline" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Fehler</p>
    <p class="md3-alert__text">Benutzername oder Passwort falsch.</p>
  </div>
</div>
```

### Save Confirmation

```html
<div class="md3-alert md3-alert--success md3-alert--inline" role="status" aria-live="polite">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">check_circle</span>
  <div class="md3-alert__content">
    <p class="md3-alert__text">Profil erfolgreich aktualisiert.</p>
  </div>
</div>
```

### Page-Level Warning Banner

```html
<div class="md3-alert md3-alert--warning md3-alert--banner" role="alert" aria-live="polite">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">warning</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Wartungsarbeiten</p>
    <p class="md3-alert__text">Das System ist am Sonntag von 2:00-4:00 Uhr nicht erreichbar.</p>
  </div>
</div>
```
