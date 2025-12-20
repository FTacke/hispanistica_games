# MD3 Loading & Error Patterns – Goldstandard

> **Status:** v1.2 – Advanced Phase  
> **Letzte Aktualisierung:** 2025-01-27

---

## Audit-Ergebnis: Loading

| Pattern | Fundort | Status |
|---------|---------|--------|
| Linear Progress | `progress.css` | ✅ Vorhanden |
| Button Spinner | `progress.css` | ✅ Vorhanden |
| Skeleton Loader | `progress.css` | ✅ Vorhanden |
| Page Loading | (hx-indicator) | ⚠️ Nicht einheitlich |

## Audit-Ergebnis: Error/Empty

| Pattern | Fundort | Status |
|---------|---------|--------|
| Error Alert | `_results.html`, `login.html` | ✅ |
| Empty State | `_results.html`, `editor_overview.html` | ✅ |
| Error Page | `errors.css`, `templates/errors/` | ✅ |
| Form Status | Auth templates | ✅ |

---

## Loading Patterns

### 1. Linear Progress (Page/Section Loading)

```html
<!-- Under Top App Bar -->
<div class="md3-linear-progress" id="page-loading" hidden>
  <div class="md3-linear-progress__track"></div>
</div>

<!-- HTMX Integration -->
<div class="md3-linear-progress htmx-indicator" id="search-progress"></div>
```

```css
.md3-linear-progress {
  height: 4px;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: var(--md-sys-color-surface-container-highest);
}

.md3-linear-progress::before {
  content: "";
  position: absolute;
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

### 2. Button Loading State

```html
<button class="md3-button md3-button--filled is-loading" disabled>
  <span class="md3-button__spinner"></span>
  <span class="md3-button__label">Speichern...</span>
</button>
```

```css
.md3-button.is-loading {
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

### 3. Skeleton Loader

```html
<div class="md3-skeleton-card">
  <div class="md3-skeleton md3-skeleton--avatar"></div>
  <div class="md3-skeleton md3-skeleton--text"></div>
  <div class="md3-skeleton md3-skeleton--text md3-skeleton--short"></div>
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

.md3-skeleton--short { width: 60%; }
.md3-skeleton--avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
```

---

## Error Patterns

### 1. Inline Error Alert

```html
<div class="md3-alert md3-alert--error" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <strong>Error:</strong> {{ error_message }}
  </div>
</div>
```

### 2. Error Loading Card

```html
<div class="md3-error-card">
  <span class="material-symbols-rounded md3-error-card__icon" aria-hidden="true">error</span>
  <h3 class="md3-error-card__title">Fehler beim Laden</h3>
  <p class="md3-error-card__message">Die Daten konnten nicht geladen werden.</p>
  <button class="md3-button md3-button--outlined" onclick="location.reload()">
    <span class="material-symbols-rounded md3-button__icon">refresh</span>
    Erneut versuchen
  </button>
</div>
```

```css
.md3-error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-8);
  gap: var(--space-4);
}

.md3-error-card__icon {
  font-size: 48px;
  color: var(--md-sys-color-error);
}

.md3-error-card__title {
  font-size: var(--md-sys-typescale-headline-small-font-size);
  font-weight: var(--md-sys-typescale-headline-small-font-weight);
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.md3-error-card__message {
  font-size: var(--md-sys-typescale-body-medium-font-size);
  color: var(--md-sys-color-on-surface-variant);
  margin: 0;
  max-width: 320px;
}
```

---

## Empty State Patterns

### 1. Standard Empty State

```html
<div class="md3-empty-state">
  <span class="material-symbols-rounded md3-empty-state__icon" aria-hidden="true">search_off</span>
  <p class="md3-empty-state__text">No se encontraron resultados.</p>
  <p class="md3-empty-state__hint">Intenta con términos diferentes.</p>
</div>
```

```css
.md3-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-8);
  gap: var(--space-3);
}

.md3-empty-state__icon {
  font-size: 48px;
  color: var(--md-sys-color-on-surface-variant);
}

.md3-empty-state__text {
  font-size: var(--md-sys-typescale-title-medium-font-size);
  font-weight: var(--md-sys-typescale-title-medium-font-weight);
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.md3-empty-state__hint {
  font-size: var(--md-sys-typescale-body-medium-font-size);
  color: var(--md-sys-color-on-surface-variant);
  margin: 0;
}
```

### 2. Empty State with Action

```html
<div class="md3-empty-state">
  <span class="material-symbols-rounded md3-empty-state__icon">folder_open</span>
  <p class="md3-empty-state__text">Keine Dateien vorhanden</p>
  <p class="md3-empty-state__hint">Laden Sie eine Datei hoch, um zu beginnen.</p>
  <button class="md3-button md3-button--filled">
    <span class="material-symbols-rounded md3-button__icon">upload</span>
    Datei hochladen
  </button>
</div>
```

---

## Offline / Connection Lost

### Banner Pattern

```html
<div class="md3-offline-banner" role="alert" aria-live="polite" hidden>
  <span class="material-symbols-rounded md3-offline-banner__icon">cloud_off</span>
  <span class="md3-offline-banner__text">Keine Internetverbindung</span>
</div>
```

```css
.md3-offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--md-sys-color-error-container);
  color: var(--md-sys-color-on-error-container);
  font-size: var(--md-sys-typescale-label-medium-font-size);
}

.md3-offline-banner__icon {
  font-size: 18px;
}
```

### JavaScript Hook

```javascript
window.addEventListener('online', () => {
  document.querySelector('.md3-offline-banner')?.setAttribute('hidden', '');
});

window.addEventListener('offline', () => {
  document.querySelector('.md3-offline-banner')?.removeAttribute('hidden');
});
```

---

## Form Status (Success/Error)

```html
<div id="status" class="md3-form-status" role="status" aria-live="polite"></div>
```

```javascript
// Success
statusEl.innerHTML = `
  <div class="md3-alert md3-alert--success">
    <span class="material-symbols-rounded md3-alert__icon">check_circle</span>
    <span>Erfolgreich gespeichert!</span>
  </div>
`;

// Error
statusEl.innerHTML = `
  <div class="md3-alert md3-alert--error">
    <span class="material-symbols-rounded md3-alert__icon">error</span>
    <span>Fehler: ${message}</span>
  </div>
`;
```

---

## Icon Reference

| State | Icon |
|-------|------|
| Error | `error` |
| Success | `check_circle` |
| Warning | `warning` |
| Info | `info` |
| Empty (Search) | `search_off` |
| Empty (Folder) | `folder_open` |
| Offline | `cloud_off` |
| Loading | (spinner) |
