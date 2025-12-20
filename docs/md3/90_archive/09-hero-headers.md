# MD3 Goldstandard – Hero & Page Headers

> Part of the MD3 Goldstandard documentation series.

## 1. Audit Summary

### 1.1 Current State

**Hero CSS:** `static/css/md3/components/hero.css` (299 lines)

| Class | Status | Notes |
|-------|--------|-------|
| `.md3-hero` | ✅ OK | Max-width 900px, centered |
| `.md3-hero__container` | ✅ OK | Inner padding |
| `.md3-hero__eyebrow` | ✅ OK | `label-large`, uppercase |
| `.md3-hero__title` | ✅ OK | `display-small` typography |
| `.md3-hero__intro` | ✅ OK | `body-large`, max-width 65ch |
| `.md3-hero__actions` | ✅ OK | Flex with 48px min-height buttons |
| `.md3-hero--card` | ✅ OK | Tonal background with icon |
| `.md3-hero--surface` | ✅ OK | Elevated variant |
| `.md3-hero--container` | ✅ OK | Tonal rounded variant |
| `.md3-hero--minimal` | ✅ OK | Transparent background |
| `.md3-hero__icon` | ✅ OK | 40px circular with primary-container bg |

### 1.2 Template Audit

| Template | Hero Usage | Issues |
|----------|------------|--------|
| `auth/login.html` | `.md3-hero--card` | ✅ Icon + eyebrow + title |
| `auth/account_profile.html` | `.md3-hero--card` | ✅ Same pattern |
| `auth/account_delete.html` | `.md3-hero--card` | ✅ Same pattern |
| `pages/proyecto_overview.html` | `.md3-hero--card` | ✅ Same pattern |
| `pages/editor_overview.html` | `.md3-hero--card` | ✅ Same pattern |
| `_md3_skeletons/page_form_skeleton.html` | `.md3-hero--card` | ✅ Reference |

### 1.3 Identified Issues

1. **Consistent pattern**: All pages use `.md3-hero--card` with icon (good)
2. **H1 vs H2**: All use `md3-headline-medium` for title (should be consistent)
3. **Responsive**: Title scales to 1.75rem on mobile (good)
4. **Spacing below hero**: Uses `margin-bottom: var(--space-8)` (32px)

---

## 2. Target Structure (MD3 Goldstandard)

### 2.1 Card Hero (Standard)

```html
<header class="md3-page__header">
  <div class="md3-hero md3-hero--card md3-hero__container">
    <div class="md3-hero__icon" aria-hidden="true">
      <span class="material-symbols-rounded">icon_name</span>
    </div>
    <div class="md3-hero__content">
      <p class="md3-body-small md3-hero__eyebrow">Category</p>
      <h1 class="md3-headline-medium md3-hero__title">Page Title</h1>
      <p class="md3-body-medium md3-hero__intro">Optional introduction text.</p>
    </div>
  </div>
</header>
```

### 2.2 Minimal Hero (Text Pages)

```html
<header class="md3-page__header">
  <div class="md3-hero md3-hero--minimal">
    <div class="md3-hero__container">
      <h1 class="md3-display-small md3-hero__title">Page Title</h1>
      <p class="md3-body-large md3-hero__intro">Introduction paragraph.</p>
    </div>
  </div>
</header>
```

---

## 3. CSS Rules (Current - Verified)

### 3.1 Hero Base

```css
.md3-hero {
  max-width: 900px;
  margin: var(--space-6) auto 0;
  position: relative;
}

.md3-hero__container {
  padding: var(--space-6) 0 0;
  max-width: var(--text-page-max-width, 900px);
  margin-left: auto;
  margin-right: auto;
}
```

### 3.2 Card Hero Variant

```css
.md3-hero--card {
  background: var(--md-sys-color-surface-container-high);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-8);
  box-shadow: var(--elev-1);
}

.md3-hero--card .md3-hero__icon {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 14px;
}
```

### 3.3 Typography

| Element | Class | Font Size | Weight | Color |
|---------|-------|-----------|--------|-------|
| Eyebrow | `.md3-hero__eyebrow` | `label-large` | 500 | `on-surface-variant` |
| Title | `.md3-hero__title` | `display-small` | 400 | `primary` |
| Intro | `.md3-hero__intro` | `body-large` | 400 | `on-surface` |

### 3.4 Hero Actions

```css
.md3-hero__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.md3-hero__actions .btn {
  min-height: 48px;
  min-width: 48px;
}
```

---

## 4. Hero Variants

### 4.1 Surface Hero (Elevated)

```css
.md3-hero--surface {
  background: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: var(--elev-1);
}
```

### 4.2 Container Hero (Tonal)

```css
.md3-hero--container {
  background: var(--md-sys-color-surface-container);
  border-radius: var(--radius-lg);
  box-shadow: var(--elev-1);
  max-width: 900px;
  margin: var(--space-6) auto var(--space-8);
}
```

### 4.3 Primary Container Hero (Accent)

```css
.md3-hero--primary-container {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.md3-hero--primary-container .md3-hero__title {
  color: var(--md-sys-color-on-primary-container);
}
```

### 4.4 Minimal Hero (Borderless)

```css
.md3-hero--minimal {
  background: transparent;
}

.md3-hero--minimal .md3-hero__container {
  padding-top: var(--space-8);
  padding-bottom: var(--space-6);
}
```

---

## 5. Responsive Rules

### 5.1 Mobile (≤599px)

```css
@media (max-width: 599px) {
  .md3-hero__title {
    font-size: 1.75rem;
  }
  
  .md3-hero__title--large {
    font-size: 2rem;
  }
  
  .md3-hero__intro {
    font-size: 0.95rem;
    margin-bottom: 20px;
  }
  
  .md3-hero__actions {
    margin-bottom: 12px;
  }
  
  .md3-hero--card {
    border-radius: var(--radius-sm);
    padding: var(--space-4);
  }
  
  .md3-hero__icon {
    width: 48px;
    height: 48px;
    font-size: 28px;
  }
}
```

### 5.2 Tablet (600-1024px)

```css
@media (min-width: 600px) and (max-width: 1024px) {
  .md3-hero__title {
    max-width: 90%;
  }
}
```

### 5.3 Desktop (≥1025px)

```css
@media (min-width: 1025px) {
  .md3-hero__container {
    padding-top: var(--space-6);
  }
  
  .md3-hero__title {
    max-width: 85%;
  }
  
  .md3-hero__intro {
    max-width: 70ch;
  }
}
```

---

## 6. Page Title System

### 6.1 Title Sources (Priority)

1. `main[data-page-title]` attribute
2. First `<h1>` element
3. `<meta name="page-title">` tag
4. Document `<title>`

### 6.2 Top App Bar Integration

```javascript
// From navigation/page-title.js
export function getPageTitle() {
  const main = document.querySelector('main');
  if (main) {
    const fromAttr = main.getAttribute('data-page-title');
    if (fromAttr?.trim()) return fromAttr.trim();
  }
  
  const h1 = document.querySelector('h1');
  if (h1?.textContent?.trim()) return h1.textContent.trim();
  
  const meta = document.querySelector('meta[name="page-title"]');
  if (meta?.content?.trim()) return meta.content.trim();
  
  return document.title || 'CO.RA.PAN';
}
```

---

## 7. Back Link Pattern

### 7.1 Structure

```html
<header class="md3-page__header">
  <nav class="md3-page__nav" aria-label="Navigation">
    <a href="/previous" class="md3-button md3-button--text md3-back-link">
      <span class="material-symbols-rounded">arrow_back</span>
      Zurück
    </a>
  </nav>
  <div class="md3-hero md3-hero--card md3-hero__container">
    <!-- hero content -->
  </div>
</header>
```

### 7.2 Back Link CSS

```css
.md3-back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  color: var(--md-sys-color-on-surface-variant);
}

.md3-back-link:hover {
  color: var(--md-sys-color-primary);
}
```

---

## 8. Migration Checklist

- [x] Hero structure is consistent across templates
- [x] Card hero variant is standard pattern
- [x] Responsive breakpoints defined
- [ ] Verify H1 usage is single per page
- [ ] Test back-link pattern where needed
- [ ] Ensure top-app-bar title updates correctly

---

## 9. Examples

### Auth Page Hero

```html
<header class="md3-page__header">
  <div class="md3-hero md3-hero--card md3-hero__container">
    <div class="md3-hero__icon" aria-hidden="true">
      <span class="material-symbols-rounded">login</span>
    </div>
    <div class="md3-hero__content">
      <p class="md3-body-small md3-hero__eyebrow">Acceso</p>
      <h1 class="md3-headline-medium md3-hero__title">Iniciar sesión</h1>
      <p class="md3-body-medium md3-hero__intro">Accede a tu cuenta para explorar el corpus.</p>
    </div>
  </div>
</header>
```

### Editor Overview Hero

```html
<header class="md3-page__header">
  <div class="md3-hero md3-hero--card md3-hero__container">
    <div class="md3-hero__icon" aria-hidden="true">
      <span class="material-symbols-rounded">edit_note</span>
    </div>
    <div class="md3-hero__content">
      <p class="md3-body-small md3-hero__eyebrow">Editor</p>
      <h1 class="md3-headline-medium md3-hero__title">Editor de Transcripciones</h1>
      <p class="md3-body-medium md3-hero__intro">Gestionar y editar archivos JSON del corpus</p>
    </div>
  </div>
</header>
```

### Text Page Minimal Hero

```html
<header class="md3-page__header">
  <div class="md3-hero md3-hero--minimal">
    <div class="md3-hero__container">
      <h1 class="md3-display-small md3-hero__title">Datenschutzerklärung</h1>
    </div>
  </div>
</header>
```
