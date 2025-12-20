# MD3 Goldstandard – Cards & Sections

> Part of the MD3 Goldstandard documentation series.

## 1. Audit Summary

### 1.1 Current State

**Cards CSS:** `static/css/md3/components/cards.css` (227 lines)

| Class | Status | Issues |
|-------|--------|--------|
| `.md3-card` | ✅ OK | Base card with `--radius-md`, `--space-4` padding |
| `.md3-card--tonal` | ✅ OK | Surface-container background |
| `.md3-card--outlined` | ✅ OK | Border + surface-container-low |
| `.md3-card--elevated` | ✅ OK | Elevation shadow |
| `.md3-card__header` | ⚠️ Partial | Has padding but no title typography enforcement |
| `.md3-card__content` | ⚠️ Partial | Has padding but no vertical rhythm rules |
| `.md3-card__actions` | ❌ Missing | Not defined - actions placed ad-hoc |
| `.md3-card__footer` | ❌ Missing | Not defined |
| `.md3-card__description` | ⚠️ Partial | Only in skeleton templates |

### 1.2 Template Audit

| Template | Card Usage | Issues |
|----------|------------|--------|
| `auth/login.html` | `.md3-card.md3-card--outlined` | ✅ Good structure |
| `auth/account_profile.html` | Multiple cards | ⚠️ Actions inside content, not in footer |
| `auth/account_delete.html` | Single card | ⚠️ No clear header/content separation |
| `auth/admin_users.html` | Table card | ✅ Uses `md3-card__content` |
| `pages/proyecto_como_citar.html` | `.md3-card--tonal` | ✅ Good DOI resource cards |
| `_md3_skeletons/page_form_skeleton.html` | Example card | ✅ Reference implementation |

---

## 2. Target Structure (MD3 Goldstandard)

```html
<article class="md3-card md3-card--outlined">
  <header class="md3-card__header">
    <h2 class="md3-title-large">Card Title</h2>
    <p class="md3-body-medium md3-card__description">Optional description</p>
  </header>
  <div class="md3-card__content">
    <!-- Main content here -->
  </div>
  <footer class="md3-card__actions">
    <button class="md3-button md3-button--text">Cancel</button>
    <button class="md3-button md3-button--filled">Confirm</button>
  </footer>
</article>
```

---

## 3. CSS Rules

### 3.1 Card Base

```css
.md3-card {
  border-radius: var(--radius-md);
  padding: 0; /* Padding handled by header/content/actions */
  box-sizing: border-box;
  width: 100%;
}
```

### 3.2 Card Variants

| Variant | Background | Border | Shadow |
|---------|------------|--------|--------|
| `.md3-card--tonal` | `surface-container` | none | `elev-1` |
| `.md3-card--outlined` | `surface-container-low` | `outline-variant` | none |
| `.md3-card--elevated` | `surface-container-low` | none | `elev-1` → `elev-2` on hover |
| `.md3-card--danger` | inherit | `error` | inherit |

### 3.3 Card Header

```css
.md3-card__header {
  padding: var(--space-5) var(--space-5) var(--space-3);
}

.md3-card__header > h2,
.md3-card__header > h3 {
  margin: 0 0 var(--space-2);
  color: var(--md-sys-color-primary);
}

.md3-card__description {
  margin: 0;
  color: var(--md-sys-color-on-surface-variant);
}
```

### 3.4 Card Content

```css
.md3-card__content {
  padding: var(--space-4) var(--space-5);
}

/* Vertical rhythm inside content */
.md3-card__content > * + * {
  margin-top: var(--space-4);
}
```

### 3.5 Card Actions (NEW)

```css
.md3-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5) var(--space-5);
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

/* Stacked variant for mobile or vertical layouts */
.md3-card__actions--stacked {
  flex-direction: column;
  gap: var(--space-2);
}

.md3-card__actions--stacked .md3-button {
  width: 100%;
}
```

### 3.6 Card Footer (Metadata variant)

```css
.md3-card__footer {
  padding: var(--space-3) var(--space-5);
  background: var(--md-sys-color-surface-container-low);
  border-top: 1px solid var(--md-sys-color-outline-variant);
  font-size: var(--md-sys-typescale-body-small-font-size);
  color: var(--md-sys-color-on-surface-variant);
}
```

---

## 4. Sections

### 4.1 Current State

| Class | Status | Notes |
|-------|--------|-------|
| `.md3-page__section` | ✅ OK | `--space-6` padding top/bottom |
| `.md3-stack--section` | ✅ OK | `--space-6` between children |
| `.md3-text-section` | ✅ OK | Text page sections |

### 4.2 Section Spacing Rules

| Context | Spacing Token | Value |
|---------|---------------|-------|
| Section to Section | `--space-8` | 32px |
| Section Header to Content | `--space-4` | 16px |
| Content paragraph to paragraph | `--space-4` | 16px |
| Content to Actions | `--space-6` | 24px |

### 4.3 Section Typography

| Element | Class | Token |
|---------|-------|-------|
| Section Title | `.md3-title-large` | `title-large` |
| Subsection Title | `.md3-title-medium` | `title-medium` |
| Body Text | `.md3-body-medium` | `body-medium` |
| Supporting Text | `.md3-body-small` | `body-small` |

---

## 5. Responsive Rules

### 5.1 Mobile (≤599px)

```css
@media (max-width: 599px) {
  .md3-card__header,
  .md3-card__content,
  .md3-card__actions {
    padding-inline: var(--space-4);
  }
  
  .md3-card__actions {
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .md3-card__actions .md3-button {
    width: 100%;
  }
}
```

### 5.2 Card Grid

```css
.md3-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

@media (max-width: 599px) {
  .md3-card-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 6. Migration Checklist

- [ ] Add `.md3-card__actions` class to `cards.css`
- [ ] Add `.md3-card__footer` class to `cards.css`
- [ ] Update auth templates to use `md3-card__actions` instead of inline actions
- [ ] Verify all cards have proper header/content/actions structure
- [ ] Test responsive stacking on mobile

---

## 7. Examples

### Profile Card with Actions

```html
<article class="md3-card md3-card--outlined md3-auth-card">
  <header class="md3-card__header">
    <h2 class="md3-title-large">Grunddaten</h2>
  </header>
  <div class="md3-card__content">
    <form class="md3-auth-form">
      <!-- Form fields -->
    </form>
  </div>
  <footer class="md3-card__actions">
    <button class="md3-button md3-button--filled">Speichern</button>
  </footer>
</article>
```

### Danger Zone Card

```html
<article class="md3-card md3-card--outlined md3-card--danger">
  <header class="md3-card__header">
    <h2 class="md3-title-large">Gefahrenzone</h2>
    <p class="md3-body-small md3-card__description">Diese Aktionen können nicht rückgängig gemacht werden.</p>
  </header>
  <div class="md3-card__content">
    <p class="md3-body-medium">Hier kannst du dein Konto löschen.</p>
  </div>
  <footer class="md3-card__actions">
    <button class="md3-button md3-button--filled md3-button--danger">Konto löschen</button>
  </footer>
</article>
```
