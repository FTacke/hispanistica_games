# MD3 Goldstandard – Dialogs & Sheets

> Part of the MD3 Goldstandard documentation series.

## 1. Audit Summary

### 1.1 Current State

**Dialog CSS:** `static/css/md3/components/dialog.css` (158 lines)

| Class | Status | Issues |
|-------|--------|--------|
| `.md3-dialog` | ✅ OK | Native `<dialog>` with proper backdrop |
| `.md3-dialog__container` | ✅ OK | Flex column layout |
| `.md3-dialog__surface` | ✅ OK | Surface background, 28px radius |
| `.md3-dialog__header` | ✅ OK | Flex with icon support |
| `.md3-dialog__title` | ⚠️ Partial | Color is primary, should use on-surface |
| `.md3-dialog__content` | ✅ OK | Proper padding, overflow handling |
| `.md3-dialog__actions` | ✅ OK | Flex-end, proper gap |
| `.md3-dialog--large` | ✅ OK | 900px max-width variant |
| `.md3-dialog--error` | ✅ OK | Error title color |
| `.md3-dialog--tonal` | ✅ OK | Tonal background variant |

### 1.2 Template Audit

| Template | Dialog Usage | Issues |
|----------|--------------|--------|
| `auth/account_profile.html` | Delete confirmation | ✅ Good structure |
| `auth/admin_users.html` | Create/Edit user | ✅ Uses skeleton pattern |
| `search/advanced.html` | CQL guide dialog | ✅ Large variant works |
| `_md3_skeletons/auth_dialog_skeleton.html` | Reference | ✅ Canonical example |

### 1.3 Identified Issues

1. **Title Typography**: Uses `md3-title-large` but title appears in primary color (should be on-surface per MD3)
2. **Content Spacing**: Gap between title and content inconsistent (sometimes 16px, sometimes 24px)
3. **Input Backgrounds**: Dialog inputs match surface correctly via `--md3-textfield-label-bg`
4. **Mobile Responsiveness**: Missing explicit mobile rules for dialog max-width

---

## 2. Target Structure (MD3 Goldstandard)

```html
<dialog class="md3-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <span class="material-symbols-rounded md3-dialog__icon" aria-hidden="true">info</span>
        <h2 id="dialog-title" class="md3-title-large md3-dialog__title">Dialog Title</h2>
      </header>
      <div class="md3-dialog__content">
        <!-- Content here -->
      </div>
      <div class="md3-dialog__actions">
        <button class="md3-button md3-button--text" data-md3-dialog-action="cancel">Cancel</button>
        <button class="md3-button md3-button--filled" data-md3-dialog-action="confirm">Confirm</button>
      </div>
    </div>
  </div>
</dialog>
```

---

## 3. CSS Rules

### 3.1 Dialog Base

```css
.md3-dialog {
  background: var(--md-sys-color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elev-3);
  min-width: 280px;
  max-width: 560px;
  border: none;
  padding: 0;
  color: var(--md-sys-color-on-surface);
}

.md3-dialog::backdrop {
  background: rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(2px);
}

.md3-dialog[open] {
  display: flex;
  transform: scale(1);
}
```

### 3.2 Dialog Surface

```css
.md3-dialog__surface {
  --_dialog-bg: var(--md-sys-color-surface);
  
  background: var(--_dialog-bg);
  --md3-textfield-label-bg: var(--_dialog-bg);
  
  padding: var(--space-6);
  border-radius: 28px;
  max-width: 560px;
  width: min(100% - calc(var(--space-4) * 2), 560px);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
```

### 3.3 Dialog Header

```css
.md3-dialog__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.md3-dialog__icon {
  color: var(--md-sys-color-secondary);
  font-size: 24px;
  flex-shrink: 0;
}

.md3-dialog__title {
  margin: 0;
  font-size: var(--md-sys-typescale-headline-small-font-size);
  font-weight: var(--md-sys-typescale-headline-small-font-weight);
  line-height: var(--md-sys-typescale-headline-small-line-height);
  color: var(--md-sys-color-on-surface);
}
```

### 3.4 Dialog Content

```css
.md3-dialog__content {
  flex-grow: 1;
  overflow-y: auto;
  font-size: var(--md-sys-typescale-body-medium-font-size);
  line-height: var(--md-sys-typescale-body-medium-line-height);
  color: var(--md-sys-color-on-surface-variant);
}

/* Stack variant for form dialogs */
.md3-stack--dialog > * + * {
  margin-top: var(--space-4);
}
```

### 3.5 Dialog Actions

```css
.md3-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-4);
  flex-shrink: 0;
}

/* Button order: Cancel → Danger → Primary */
.md3-dialog__actions .md3-button--text {
  order: 1;
}

.md3-dialog__actions .md3-button--danger {
  order: 2;
}

.md3-dialog__actions .md3-button--filled:not(.md3-button--danger) {
  order: 3;
}
```

---

## 4. Dialog Variants

### 4.1 Large Dialog

```css
.md3-dialog--large {
  max-width: 900px;
  width: min(900px, 95vw);
}

.md3-dialog--large .md3-dialog__surface {
  max-width: none;
  width: 100%;
}
```

### 4.2 Error/Danger Dialog

```css
.md3-dialog--error .md3-dialog__icon,
.md3-dialog--danger .md3-dialog__icon {
  color: var(--md-sys-color-error);
}

.md3-dialog--error .md3-dialog__title,
.md3-dialog--danger .md3-dialog__title {
  color: var(--md-sys-color-error);
}
```

### 4.3 Tonal Dialog

```css
.md3-dialog--tonal .md3-dialog__surface {
  --_dialog-bg: var(--md-sys-color-surface-container-high);
  background: var(--_dialog-bg);
  --md3-textfield-label-bg: var(--_dialog-bg);
}
```

---

## 5. Responsive Rules

### 5.1 Mobile (≤599px)

```css
@media (max-width: 599px) {
  .md3-dialog {
    max-width: calc(100vw - var(--space-6));
    margin: var(--space-4);
  }
  
  .md3-dialog__surface {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }
  
  .md3-dialog__actions {
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .md3-dialog__actions .md3-button {
    width: 100%;
    justify-content: center;
  }
  
  /* Reverse order for stacked: Primary first */
  .md3-dialog__actions .md3-button--filled:not(.md3-button--danger) {
    order: 1;
  }
  
  .md3-dialog__actions .md3-button--danger {
    order: 2;
  }
  
  .md3-dialog__actions .md3-button--text {
    order: 3;
  }
}
```

### 5.2 Full-Screen Dialog (Mobile)

```css
.md3-dialog--fullscreen {
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
  border-radius: 0;
}

@media (min-width: 600px) {
  .md3-dialog--fullscreen {
    max-width: 560px;
    max-height: 90vh;
    border-radius: var(--radius-lg);
  }
}
```

---

## 6. Sheets (Bottom Sheet Pattern)

### 6.1 Structure

```html
<div class="md3-sheet" role="dialog" aria-modal="true">
  <div class="md3-sheet__scrim"></div>
  <div class="md3-sheet__surface">
    <div class="md3-sheet__drag-handle"></div>
    <div class="md3-sheet__content">
      <!-- Content -->
    </div>
  </div>
</div>
```

### 6.2 Sheet CSS

```css
.md3-sheet {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet, 1000);
  display: none;
}

.md3-sheet[open] {
  display: flex;
  align-items: flex-end;
}

.md3-sheet__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.32);
}

.md3-sheet__surface {
  position: relative;
  background: var(--md-sys-color-surface-container-low);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: var(--space-4);
  max-height: 90vh;
  overflow-y: auto;
  width: 100%;
}

.md3-sheet__drag-handle {
  width: 32px;
  height: 4px;
  background: var(--md-sys-color-outline);
  border-radius: 2px;
  margin: 0 auto var(--space-4);
}
```

---

## 7. Migration Checklist

- [ ] Update `.md3-dialog__title` color from primary to on-surface
- [ ] Add mobile responsive rules for dialogs
- [ ] Ensure all dialog templates use proper ARIA attributes
- [ ] Test textfield label backgrounds in dialogs
- [ ] Add `.md3-dialog--fullscreen` variant for mobile

---

## 8. Examples

### Confirmation Dialog

```html
<dialog class="md3-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <h2 id="confirm-title" class="md3-title-large md3-dialog__title">Konto löschen?</h2>
      </header>
      <div class="md3-dialog__content">
        <p class="md3-body-medium">Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten werden gelöscht.</p>
      </div>
      <div class="md3-dialog__actions">
        <button class="md3-button md3-button--text" data-md3-dialog-action="cancel">Abbrechen</button>
        <button class="md3-button md3-button--filled md3-button--danger" data-md3-dialog-action="confirm">Löschen</button>
      </div>
    </div>
  </div>
</dialog>
```

### Form Dialog

```html
<dialog class="md3-dialog" role="dialog" aria-modal="true" aria-labelledby="form-title">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <span class="material-symbols-rounded md3-dialog__icon">person_add</span>
        <h2 id="form-title" class="md3-title-large md3-dialog__title">Benutzer erstellen</h2>
      </header>
      <div class="md3-dialog__content md3-stack--dialog">
        <div class="md3-outlined-textfield">
          <input type="text" class="md3-outlined-textfield__input" id="username" required>
          <label class="md3-outlined-textfield__label" for="username">Benutzername</label>
          <!-- outline elements -->
        </div>
        <div class="md3-outlined-textfield">
          <input type="email" class="md3-outlined-textfield__input" id="email" required>
          <label class="md3-outlined-textfield__label" for="email">E-Mail</label>
          <!-- outline elements -->
        </div>
      </div>
      <div class="md3-dialog__actions">
        <button class="md3-button md3-button--text">Abbrechen</button>
        <button class="md3-button md3-button--filled">Erstellen</button>
      </div>
    </div>
  </div>
</dialog>
```
