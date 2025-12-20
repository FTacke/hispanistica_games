# MD3 Goldstandard - Feedback Components

**Version:** 1.0  
**Date:** 2025-11-26

---

## 1. Snackbar / Toast

### 1.1 Overview

Snackbars provide brief, non-blocking feedback after an action.

**Position:** Fixed, bottom-center (or bottom-right on desktop)  
**Duration:** 4-6 seconds (auto-dismiss)  
**Z-index:** 10000

### 1.2 HTML Structure

```html
<div class="md3-snackbar" role="status" aria-live="polite">
  <span class="material-symbols-rounded md3-snackbar__icon" aria-hidden="true">check_circle</span>
  <span class="md3-snackbar__message">Änderungen gespeichert.</span>
  <button class="md3-snackbar__action">Rückgängig</button>
</div>
```

### 1.3 Variants

| Variant | Class | Icon | Use Case |
|---------|-------|------|----------|
| Success | `md3-snackbar--success` | `check_circle` | Confirm save, copy, create |
| Error | `md3-snackbar--error` | `error` | Failed action |
| Info | `md3-snackbar--info` | `info` | Neutral notification |
| Warning | `md3-snackbar--warning` | `warning` | Caution message |

### 1.4 JavaScript API

```javascript
// Show snackbar
function showSnackbar(message, type = 'info', duration = 4000) {
  // Remove existing snackbar
  const existing = document.querySelector('.md3-snackbar.visible');
  if (existing) {
    existing.classList.remove('visible');
    setTimeout(() => existing.remove(), 200);
  }

  // Create snackbar element
  const snackbar = document.createElement('div');
  snackbar.className = `md3-snackbar md3-snackbar--${type}`;
  snackbar.setAttribute('role', 'status');
  snackbar.setAttribute('aria-live', 'polite');

  const icons = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
    warning: 'warning'
  };

  snackbar.innerHTML = `
    <span class="material-symbols-rounded md3-snackbar__icon" aria-hidden="true">${icons[type]}</span>
    <span class="md3-snackbar__message">${message}</span>
  `;

  document.body.appendChild(snackbar);

  // Show with animation
  requestAnimationFrame(() => {
    snackbar.classList.add('visible');
  });

  // Auto-dismiss
  setTimeout(() => {
    snackbar.classList.remove('visible');
    setTimeout(() => snackbar.remove(), 300);
  }, duration);
}
```

### 1.5 CSS (Reference)

Located in `static/css/md3/components/snackbar.css`:

```css
.md3-snackbar {
  position: fixed;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  z-index: 10000;
  
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  
  min-width: 288px;
  max-width: min(560px, calc(100vw - var(--space-8)));
  
  background: var(--md-sys-color-inverse-surface);
  color: var(--md-sys-color-inverse-on-surface);
  border-radius: var(--radius-sm);
  box-shadow: var(--elev-3);
  
  opacity: 0;
  visibility: hidden;
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 200ms ease;
}

.md3-snackbar.visible {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
  visibility: visible;
}
```

---

## 2. Loading States

### 2.1 Linear Progress

For section/page loading:

```html
<div class="md3-linear-progress" role="progressbar" aria-label="Lädt..."></div>
```

```css
.md3-linear-progress {
  height: 4px;
  width: 100%;
  background: var(--md-sys-color-surface-container-highest);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.md3-linear-progress::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 30%;
  background: var(--md-sys-color-primary);
  animation: progress-indeterminate 1.5s ease-in-out infinite;
}

@keyframes progress-indeterminate {
  0% { left: -30%; }
  100% { left: 100%; }
}
```

### 2.2 Button Loading State

For buttons that trigger async actions:

```html
<button class="md3-button md3-button--filled is-loading" disabled>
  <span class="md3-button__spinner" aria-hidden="true"></span>
  <span class="md3-button__text">Speichern...</span>
</button>
```

```css
.md3-button.is-loading {
  position: relative;
  pointer-events: none;
}

.md3-button__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 2.3 JavaScript Helper

```javascript
function setButtonLoading(button, loading = true) {
  if (loading) {
    button.classList.add('is-loading');
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    const spinner = document.createElement('span');
    spinner.className = 'md3-button__spinner';
    spinner.setAttribute('aria-hidden', 'true');
    button.prepend(spinner);
  } else {
    button.classList.remove('is-loading');
    button.disabled = false;
    const spinner = button.querySelector('.md3-button__spinner');
    if (spinner) spinner.remove();
  }
}
```

### 2.4 Card Loading

For cards with async content:

```html
<div class="md3-card md3-card--outlined md3-card--loading">
  <div class="md3-card__content">
    <div class="md3-skeleton md3-skeleton--text"></div>
    <div class="md3-skeleton md3-skeleton--text md3-skeleton--short"></div>
  </div>
</div>
```

```css
.md3-skeleton {
  background: linear-gradient(
    90deg,
    var(--md-sys-color-surface-container) 25%,
    var(--md-sys-color-surface-container-high) 50%,
    var(--md-sys-color-surface-container) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.md3-skeleton--text {
  height: 1em;
  margin-bottom: 0.5em;
}

.md3-skeleton--short {
  width: 60%;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 3. Empty States

### 3.1 Standard Pattern

```html
<div class="md3-empty-state">
  <span class="material-symbols-rounded md3-empty-state__icon" aria-hidden="true">search_off</span>
  <p class="md3-empty-state__title">Keine Ergebnisse gefunden</p>
  <p class="md3-empty-state__text">Versuchen Sie es mit anderen Suchbegriffen oder passen Sie die Filter an.</p>
  <button class="md3-button md3-button--outlined">Filter zurücksetzen</button>
</div>
```

### 3.2 Icon Mapping

| Context | Icon | Title Example |
|---------|------|---------------|
| No search results | `search_off` | Keine Ergebnisse gefunden |
| No users | `person_off` | Keine Benutzer |
| No files | `folder_off` | Keine Dateien |
| Empty inbox | `inbox` | Keine Nachrichten |
| Error loading | `cloud_off` | Fehler beim Laden |
| No data available | `do_not_disturb_on` | Keine Daten |

### 3.3 CSS (Canonical)

```css
.md3-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
  min-height: 200px;
}

.md3-empty-state__icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
  color: var(--md-sys-color-outline);
}

.md3-empty-state__title {
  font-family: var(--md-sys-typescale-title-medium-font-family);
  font-size: var(--md-sys-typescale-title-medium-font-size);
  font-weight: var(--md-sys-typescale-title-medium-font-weight);
  line-height: var(--md-sys-typescale-title-medium-line-height);
  margin: 0 0 var(--space-2);
  color: var(--md-sys-color-on-surface);
}

.md3-empty-state__text {
  font-family: var(--md-sys-typescale-body-medium-font-family);
  font-size: var(--md-sys-typescale-body-medium-font-size);
  line-height: var(--md-sys-typescale-body-medium-line-height);
  margin: 0 0 var(--space-4);
  max-width: 320px;
}

.md3-empty-state .md3-button {
  margin-top: var(--space-2);
}
```

---

## 4. Inline Alerts

For form feedback and in-context messages.

### 4.1 Error Alert

```html
<div class="md3-alert md3-alert--error md3-alert--inline" role="alert">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Fehler</p>
    <p class="md3-alert__text">Benutzername oder Passwort falsch.</p>
  </div>
</div>
```

### 4.2 Success Alert

```html
<div class="md3-alert md3-alert--success md3-alert--inline" role="status">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">check_circle</span>
  <div class="md3-alert__content">
    <p class="md3-alert__text">Änderungen erfolgreich gespeichert.</p>
  </div>
</div>
```

### 4.3 Form Status Container

Wrap JS-populated status messages:

```html
<form id="myform">
  <!-- fields -->
</form>
<div id="status" class="md3-form-status" role="status" aria-live="polite"></div>
```

```javascript
// Populate status with alert
document.getElementById('status').innerHTML = `
  <div class="md3-alert md3-alert--success md3-alert--inline">
    <span class="material-symbols-rounded md3-alert__icon">check_circle</span>
    <div class="md3-alert__content">
      <p class="md3-alert__text">Gespeichert!</p>
    </div>
  </div>
`;
```

---

## 5. Migration Guide

### From Custom Snackbar to MD3

**Before (player/tokens.js):**
```javascript
const snackbar = document.createElement("div");
snackbar.className = "copy-snackbar";
snackbar.innerHTML = `...custom structure...`;
```

**After:**
```javascript
showSnackbar("Token-IDs kopiert!", "success");
```

### From Alert to Snackbar

Use **alerts** for:
- Form validation errors (inline, persistent)
- Critical error messages
- Messages that require reading

Use **snackbars** for:
- Confirmation of actions (copy, save, delete)
- Brief status updates
- Non-critical notifications

---

## 6. Accessibility

### Snackbar
- Use `role="status"` and `aria-live="polite"`
- Auto-dismiss should not be too fast (min 4 seconds)
- Provide a way to dismiss manually for long messages

### Loading
- Use `aria-label` on progress indicators
- Announce loading state changes to screen readers
- Consider `aria-busy="true"` on loading containers

### Empty States
- Icons should have `aria-hidden="true"`
- Title/text should be descriptive
- Action button should indicate next step
