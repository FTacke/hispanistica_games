# MD3 Goldstandard - Buttons & Actions Zones

**Version:** 1.0  
**Date:** 2025-11-26

---

## 1. Button Variants

### 1.1 Primary Actions (`md3-button--filled`)

Use for the main action in a form, dialog, or toolbar.

```html
<button type="submit" class="md3-button md3-button--filled">
  <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">save</span>
  Speichern
</button>
```

**CSS Tokens:**
- Background: `--md-sys-color-primary`
- Text: `--md-sys-color-on-primary`
- Hover: 92% primary + 8% on-primary mix

### 1.2 Secondary Actions (`md3-button--outlined`)

Use for secondary actions alongside primary, or main actions in toolbars.

```html
<button type="button" class="md3-button md3-button--outlined">
  <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">refresh</span>
  Aktualisieren
</button>
```

**CSS Tokens:**
- Border: `--md-sys-color-outline`
- Text: `--md-sys-color-primary`
- Hover: 8% primary tint background

### 1.3 Tertiary Actions (`md3-button--text`)

Use for dismissive actions (Cancel, Back) or low-emphasis links.

```html
<a href="/back" class="md3-button md3-button--text">Abbrechen</a>
```

**CSS Tokens:**
- Background: transparent
- Text: `--md-sys-color-primary`
- Hover: 12% primary tint background

### 1.4 Danger Actions (`md3-button--danger`)

Use for destructive actions (Delete, Reset). Available in two emphasis levels:

**High Emphasis (filled danger):**
```html
<button class="md3-button md3-button--filled md3-button--danger">
  <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">delete_forever</span>
  Löschen
</button>
```

**Low Emphasis (outlined danger):**
```html
<button class="md3-button md3-button--outlined md3-button--danger">
  <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">delete</span>
  Entfernen
</button>
```

### 1.5 Tonal Actions (`md3-button--tonal`)

Use for medium emphasis, e.g., secondary CTAs in hero sections.

```html
<button class="md3-button md3-button--tonal">
  Mehr erfahren
</button>
```

---

## 2. Button Icons

Icons inside buttons use the `.md3-button__icon` class:

```html
<span class="material-symbols-rounded md3-button__icon" aria-hidden="true">icon_name</span>
```

**Size:** 18×18px  
**Position:** Leading (before text) by default

---

## 3. Actions Zones

### 3.1 Dialog Actions (`.md3-dialog__actions`)

Position: End of dialog, after content.  
Alignment: Right-aligned, gap 12px.  
Order: Secondary → Primary (left to right).

```html
<div class="md3-dialog__actions">
  <button type="button" class="md3-button md3-button--text">Abbrechen</button>
  <button type="submit" class="md3-button md3-button--filled">Speichern</button>
</div>
```

**With Danger Action:**
```html
<div class="md3-dialog__actions">
  <button type="button" class="md3-button md3-button--text">Abbrechen</button>
  <button type="button" class="md3-button md3-button--filled md3-button--danger">Löschen</button>
</div>
```

### 3.2 Form Actions (`.md3-actions`)

Position: Bottom of card/form.  
Alignment: Right-aligned (default) or space-between.  
Margin-top: `var(--space-4)` (16px).

```html
<div class="md3-actions">
  <a href="/back" class="md3-button md3-button--text">Abbrechen</a>
  <button type="submit" class="md3-button md3-button--filled">
    <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">save</span>
    Speichern
  </button>
</div>
```

**Space-between variant (link left, button right):**
```html
<div class="md3-row--between md3-actions">
  <a href="/forgot" class="md3-button md3-button--text">Passwort vergessen?</a>
  <button type="submit" class="md3-button md3-button--filled">Anmelden</button>
</div>
```

### 3.3 Toolbar Actions (`.md3-toolbar`)

Position: Above tables/lists, typically right-aligned within a row.

```html
<div class="md3-row--between">
  <div class="md3-search-field"><!-- search input --></div>
  <div class="md3-toolbar">
    <button class="md3-button md3-button--outlined">
      <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">refresh</span>
      Aktualisieren
    </button>
    <button class="md3-button md3-button--filled">
      <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">add</span>
      Neu anlegen
    </button>
  </div>
</div>
```

### 3.4 Card Actions

For actions within a card, use `.md3-actions` inside `.md3-card__content`:

```html
<article class="md3-card md3-card--outlined">
  <div class="md3-card__content">
    <p>Card content here...</p>
    <div class="md3-actions">
      <button class="md3-button md3-button--filled">Action</button>
    </div>
  </div>
</article>
```

---

## 4. Danger Zone Pattern

For irreversible actions, use a dedicated card with danger styling:

```html
<article class="md3-card md3-card--outlined md3-card--danger">
  <header class="md3-card__header">
    <h2 class="md3-title-large">Gefahrenzone</h2>
  </header>
  <div class="md3-card__content">
    <p class="md3-body-medium">Warnung: Diese Aktion kann nicht rückgängig gemacht werden.</p>
    <div class="md3-actions">
      <button class="md3-button md3-button--filled md3-button--danger">
        <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">delete_forever</span>
        Konto löschen
      </button>
    </div>
  </div>
</article>
```

---

## 5. Disabled State

Add `disabled` attribute to disable buttons:

```html
<button class="md3-button md3-button--filled" disabled>
  Nicht verfügbar
</button>
```

**Styling:**
- Background: `rgba(28, 27, 31, 0.12)`
- Text: `rgba(28, 27, 31, 0.38)`
- Cursor: `not-allowed`
- No hover/focus effects

---

## 6. Responsive Rules

### Mobile (≤600px)

Actions zones should stack vertically when needed:

```css
@media (max-width: 600px) {
  .md3-actions--stack {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .md3-actions--stack .md3-button {
    width: 100%;
    justify-content: center;
  }
}
```

**Order when stacked:**
1. Primary action (top)
2. Secondary action
3. Danger action (bottom)

---

## 7. Deprecated Aliases

Do **NOT** use these classes in new code:

| Deprecated | Use Instead |
|-----------|-------------|
| `.md3-button--contained` | `.md3-button--filled` |
| `.md3-button--destructive` | `.md3-button--danger` |
| `.md3-destructive` | `.md3-button--danger` |

---

## 8. Examples by Context

### Login Form
```html
<div class="md3-row--between md3-actions">
  <a class="md3-button md3-button--text" href="/forgot">¿Olvidaste tu contraseña?</a>
  <button type="submit" class="md3-button md3-button--filled">
    <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">login</span>
    Entrar
  </button>
</div>
```

### Confirmation Dialog
```html
<div class="md3-dialog__actions">
  <button type="button" class="md3-button md3-button--text" id="cancel">Abbrechen</button>
  <button type="button" class="md3-button md3-button--filled" id="confirm">Bestätigen</button>
</div>
```

### Delete Confirmation
```html
<div class="md3-dialog__actions">
  <button type="button" class="md3-button md3-button--text">Abbrechen</button>
  <button type="button" class="md3-button md3-button--filled md3-button--danger">Löschen</button>
</div>
```

### Admin Toolbar
```html
<div class="md3-toolbar">
  <button class="md3-button md3-button--outlined">
    <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">refresh</span>
    Aktualisieren
  </button>
  <button class="md3-button md3-button--filled">
    <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">add</span>
    Benutzer anlegen
  </button>
</div>
```
