# CORAPAN UI – MD3 Styleguide (Offiziell)

> **Version:** 2.0  
> **Stand:** 2025-01-27  
> **Status:** Kanonisch – alle neuen Komponenten MÜSSEN diesem Guide folgen

---

## Inhaltsverzeichnis

1. [Token-System](#1-token-system)
2. [Farben](#2-farben)
3. [Typografie](#3-typografie)
4. [Spacing](#4-spacing)
5. [Elevation & Shadows](#5-elevation--shadows)
6. [Motion](#6-motion)
7. [Komponenten](#7-komponenten)
8. [A11y-Anforderungen](#8-a11y-anforderungen)
9. [Verbotene Patterns](#9-verbotene-patterns)

---

## 1. Token-System

### 1.1 Namenskonventionen

| Präfix | Verwendung | Beispiel |
|--------|------------|----------|
| `--md-sys-color-*` | Farben | `--md-sys-color-primary` |
| `--space-*` | Abstände | `--space-4` (1rem) |
| `--radius-*` | Border-Radius | `--radius-md` (12px) |
| `--elev-*` | Elevation/Shadows | `--elev-2` |
| `--md-motion-*` | Animation | `--md-motion-easing-standard` |

### 1.2 Verbotene Token-Präfixe

```css
/* ❌ VERBOTEN – Legacy-Tokens, nicht verwenden */
--md3-*        /* Alle --md3-* Präfixe */
--btn-*        /* Bootstrap Legacy */
--card-*       /* Bootstrap Legacy */
```

---

## 2. Farben

### 2.1 Primäre Rollen

| Token | Verwendung |
|-------|------------|
| `--md-sys-color-primary` | Primäre Aktionen, Links, Fokus |
| `--md-sys-color-on-primary` | Text auf Primary |
| `--md-sys-color-primary-container` | Tonal-Hintergründe |
| `--md-sys-color-on-primary-container` | Text auf Primary-Container |

### 2.2 Surface-Hierarchie

```css
--md-sys-color-surface              /* Basis-Oberfläche */
--md-sys-color-surface-container-lowest   /* Tiefste Ebene */
--md-sys-color-surface-container-low      /* Niedrig */
--md-sys-color-surface-container          /* Standard */
--md-sys-color-surface-container-high     /* Hoch */
--md-sys-color-surface-container-highest  /* Höchste (Input-BG) */
```

### 2.3 Semantische Farben

| Token | Verwendung |
|-------|------------|
| `--md-sys-color-error` | Fehler, Danger-Buttons |
| `--md-sys-color-on-error` | Text auf Error |
| `--md-sys-color-outline` | Borders, Dividers |
| `--md-sys-color-outline-variant` | Subtile Borders |

---

## 3. Typografie

### 3.1 Type-Scale

| Klasse | Größe | Gewicht | Verwendung |
|--------|-------|---------|------------|
| `.md3-display-large` | 57px | 400 | Große Headlines (selten) |
| `.md3-display-medium` | 45px | 400 | Headlines |
| `.md3-headline-large` | 32px | 400 | Page-Titles |
| `.md3-headline-medium` | 28px | 400 | Section-Titles |
| `.md3-title-large` | 22px | 400 | Card-Titles, Dialog-Titles |
| `.md3-title-medium` | 16px | 500 | Subtitles |
| `.md3-body-large` | 16px | 400 | Fließtext (Standard) |
| `.md3-body-medium` | 14px | 400 | Sekundärer Text |
| `.md3-label-large` | 14px | 500 | Button-Labels |
| `.md3-label-medium` | 12px | 500 | Badges, kleine Labels |

### 3.2 Usage Rules

```html
<!-- ✅ Korrekt -->
<h1 class="md3-headline-large">Page Title</h1>
<p class="md3-body-large">Content text.</p>

<!-- ❌ Falsch: Inline-Styles -->
<h1 style="font-size: 32px;">Title</h1>
```

---

## 4. Spacing

### 4.1 Spacing-Scale (8px-Basis)

| Token | Wert | Verwendung |
|-------|------|------------|
| `--space-1` | 4px | Minimal (Icon-Margin) |
| `--space-2` | 8px | Tight (Badge-Padding) |
| `--space-3` | 12px | Compact |
| `--space-4` | 16px | Standard (Button-Padding-X) |
| `--space-5` | 20px | Comfortable |
| `--space-6` | 24px | Card-Padding |
| `--space-8` | 32px | Section-Gap |
| `--space-10` | 40px | Large Section |
| `--space-12` | 48px | Hero-Spacing |
| `--space-16` | 64px | Page-Margin |

### 4.2 Anwendungsbeispiele

```css
/* Card */
.md3-card__content {
  padding: var(--space-5) var(--space-6);
}

/* Button */
.md3-button {
  padding: 0 var(--space-4);
  gap: var(--space-2);
}

/* Section-Gap */
.actions-zone {
  gap: var(--space-3);
}
```

---

## 5. Elevation & Shadows

### 5.1 Elevation-Stufen

| Token | Shadow | Verwendung |
|-------|--------|------------|
| `--elev-1` | Subtil | Cards (tonal), Hover-States |
| `--elev-2` | Mittel | Cards (elevated), Menus |
| `--elev-3` | Hoch | Dialogs, Overlays, Snackbar |
| `--elev-4` | Höher | FAB-Hover |
| `--elev-5` | Maximum | Selten (Drag-Preview) |

### 5.2 Komponenten-Mapping

| Komponente | Ruhe | Hover | Active |
|------------|------|-------|--------|
| Card (outlined) | none | none | none |
| Card (elevated) | `--elev-1` | `--elev-2` | `--elev-1` |
| Button (filled) | none | `--elev-1` | none |
| Dialog | `--elev-3` | – | – |
| Snackbar | `--elev-3` | – | – |
| Menu | `--elev-2` | – | – |

---

## 6. Motion

### 6.1 Easing Curves

```css
--md-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);    /* Standard */
--md-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);  /* Betont */
--md-motion-easing-decelerate: cubic-bezier(0, 0, 0, 1);    /* Erscheinen */
--md-motion-easing-accelerate: cubic-bezier(0.3, 0, 1, 1);  /* Verschwinden */
```

### 6.2 Duration-Tokens

| Token | Dauer | Verwendung |
|-------|-------|------------|
| `--md-motion-duration-short2` | 100ms | Hover-States |
| `--md-motion-duration-short3` | 150ms | Button-Feedback |
| `--md-motion-duration-short4` | 200ms | Standard-Transitions |
| `--md-motion-duration-medium2` | 300ms | Dialog-Erscheinen |
| `--md-motion-duration-medium4` | 400ms | Page-Transitions |

### 6.3 Komponenten-Transitions

```css
/* Button */
.md3-button {
  transition: 
    background-color var(--md-motion-duration-short3) var(--md-motion-easing-standard),
    box-shadow var(--md-motion-duration-short3) var(--md-motion-easing-standard);
}

/* Dialog */
.md3-dialog[open] {
  animation: dialog-enter var(--md-motion-duration-medium2) var(--md-motion-easing-decelerate);
}
```

---

## 7. Komponenten

### 7.1 Buttons

#### Varianten

| Klasse | Verwendung |
|--------|------------|
| `.md3-button--filled` | Primäre Aktion (1 pro View) |
| `.md3-button--outlined` | Sekundäre Aktionen |
| `.md3-button--text` | Tertiäre Aktionen, Cancel |
| `.md3-button--tonal` | Medium-Emphasis |
| `.md3-button--danger` | Destruktive Aktionen |

#### Struktur

```html
<button class="md3-button md3-button--filled">
  <span class="material-symbols-rounded" aria-hidden="true">save</span>
  Save
</button>
```

#### Action Zones

```html
<div class="md3-table__actions-zone">
  <button class="md3-button md3-button--text">Cancel</button>
  <button class="md3-button md3-button--filled">Confirm</button>
</div>
```

---

### 7.2 Cards

#### Varianten

| Klasse | Background | Border | Shadow |
|--------|------------|--------|--------|
| `.md3-card--tonal` | surface-container | none | elev-1 |
| `.md3-card--outlined` | surface-container-low | outline-variant | none |
| `.md3-card--elevated` | surface-container-low | none | elev-1/2 |
| `.md3-card--danger` | inherit | error | inherit |

#### Struktur

```html
<article class="md3-card md3-card--outlined">
  <header class="md3-card__header">
    <h2 class="md3-title-large">Title</h2>
    <p class="md3-body-medium md3-card__description">Description</p>
  </header>
  <div class="md3-card__content">
    <!-- Content -->
  </div>
  <footer class="md3-card__actions">
    <button class="md3-button md3-button--text">Cancel</button>
    <button class="md3-button md3-button--filled">Confirm</button>
  </footer>
</article>
```

---

### 7.3 Dialogs

```html
<dialog class="md3-dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <span class="material-symbols-rounded md3-dialog__icon" aria-hidden="true">info</span>
        <h2 id="dlg-title" class="md3-title-large md3-dialog__title">Title</h2>
      </header>
      <div class="md3-dialog__content">
        <!-- Content -->
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

### 7.4 Tables

```html
<div class="md3-table-wrapper">
  <table class="md3-data-table">
    <thead>
      <tr>
        <th>Header</th>
      </tr>
    </thead>
    <tbody>
      <tr class="md3-table__row--clickable">
        <td>Cell</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- Empty State -->
<div class="md3-table-empty-state">
  <span class="material-symbols-rounded">search_off</span>
  <p class="md3-body-large">No results found.</p>
</div>
```

---

### 7.5 Alerts/Snackbar

```html
<!-- Inline Alert -->
<div class="md3-alert md3-alert--warning" role="alert">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">warning</span>
  <p class="md3-alert__message">Warning message</p>
</div>

<!-- Snackbar (JS-gesteuert) -->
<aside class="md3-snackbar md3-snackbar--error" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-snackbar__icon" aria-hidden="true">error</span>
  <p class="md3-snackbar__message">Error occurred</p>
  <button class="md3-snackbar__action">Retry</button>
  <button class="md3-snackbar__close" aria-label="Dismiss">
    <span class="material-symbols-rounded">close</span>
  </button>
</aside>
```

---

### 7.6 Tabs

```html
<div class="md3-tabs" role="tablist">
  <button class="md3-tab md3-tab--active" role="tab" aria-selected="true">
    <span class="material-symbols-rounded md3-tab__icon" aria-hidden="true">home</span>
    <span class="md3-tab__label">Tab 1</span>
  </button>
  <button class="md3-tab" role="tab" aria-selected="false">
    <span class="md3-tab__label">Tab 2</span>
  </button>
</div>
```

---

### 7.7 Loading States

```html
<!-- Linear Progress -->
<div class="md3-progress" role="progressbar" aria-label="Loading">
  <div class="md3-progress__track">
    <div class="md3-progress__indicator" style="width: 60%"></div>
  </div>
</div>

<!-- Circular Progress -->
<div class="md3-progress-circular" role="progressbar" aria-label="Loading">
  <svg viewBox="0 0 48 48">
    <circle class="md3-progress-circular__track" cx="24" cy="24" r="20"></circle>
    <circle class="md3-progress-circular__indicator" cx="24" cy="24" r="20"></circle>
  </svg>
</div>

<!-- Skeleton -->
<div class="md3-skeleton md3-skeleton--text"></div>
<div class="md3-skeleton md3-skeleton--card"></div>
```

---

### 7.8 Pagination

```html
<nav class="md3-pagination" role="navigation" aria-label="Pagination">
  <button class="md3-pagination__btn" aria-label="Previous page" disabled>
    <span class="material-symbols-rounded">chevron_left</span>
  </button>
  <span class="md3-pagination__info">Page 1 of 10</span>
  <button class="md3-pagination__btn" aria-label="Next page">
    <span class="material-symbols-rounded">chevron_right</span>
  </button>
</nav>
```

---

### 7.9 Toolbar

```html
<div class="md3-toolbar" role="toolbar" aria-label="Actions">
  <div class="md3-toolbar__group md3-toolbar__group--start">
    <button class="md3-toolbar__btn" aria-label="Filter">
      <span class="material-symbols-rounded">filter_list</span>
    </button>
  </div>
  <div class="md3-toolbar__group md3-toolbar__group--end">
    <button class="md3-toolbar__btn md3-toolbar__btn--primary" aria-label="Add">
      <span class="material-symbols-rounded">add</span>
    </button>
  </div>
</div>
```

---

## 8. A11y-Anforderungen

### 8.1 Kontrast

| Element | Mindest-Kontrast |
|---------|------------------|
| Body-Text | 4.5:1 (WCAG AA) |
| Large-Text (≥18px) | 3:1 |
| Icons (funktional) | 3:1 |
| Focus-Indicator | 3:1 |

### 8.2 Focus-States

```css
:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}
```

### 8.3 Erforderliche Attribute

| Komponente | Attribute |
|------------|-----------|
| Dialog | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Tab | `role="tab"`, `aria-selected` |
| Tablist | `role="tablist"` |
| Alert | `role="alert"` |
| Snackbar | `role="alert"`, `aria-live="assertive"` |
| Progress | `role="progressbar"`, `aria-label` |
| Icon-Button | `aria-label` (Pflicht!) |

### 8.4 Icon-only Buttons

```html
<!-- ✅ Korrekt -->
<button class="md3-button--icon" aria-label="Delete">
  <span class="material-symbols-rounded" aria-hidden="true">delete</span>
</button>

<!-- ❌ Falsch: Fehlendes aria-label -->
<button class="md3-button--icon">
  <span class="material-symbols-rounded">delete</span>
</button>
```

---

## 9. Verbotene Patterns

### 9.1 CSS

```css
/* ❌ VERBOTEN */
var(--md3-*)                    /* Legacy-Tokens */
.md3-button--contained          /* Use --filled */
.md3-button--destructive        /* Use --danger */
.btn-primary, .btn-danger       /* Bootstrap */
!important                      /* Außer in dokumentierten Ausnahmen */
```

### 9.2 HTML

```html
<!-- ❌ VERBOTEN -->
<button style="background: red;">    <!-- Inline-Styles -->
<div class="btn btn-primary">        <!-- Bootstrap-Klassen -->
onclick="alert('x')"                 <!-- Inline-Handlers -->
```

### 9.3 Dokumentierte Ausnahmen

Die folgenden Komponenten haben begründete Abweichungen:

| Komponente | Datei | Grund |
|------------|-------|-------|
| Player | `player.css` | Spezialisierte Audio-Controls |
| Editor | `editor.css` | Transcript-Editor mit eigenen Anforderungen |
| Mobile-Player | `player-mobile.css` | Touch-optimierte Overrides |

Siehe `docs/ui-md3-deviations.md` für Details.

---

## Anhang: Quick Reference

### Token Cheatsheet

```css
/* Colors */
var(--md-sys-color-primary)
var(--md-sys-color-on-primary)
var(--md-sys-color-surface)
var(--md-sys-color-on-surface)
var(--md-sys-color-error)
var(--md-sys-color-outline)

/* Spacing */
var(--space-1) /* 4px */
var(--space-2) /* 8px */
var(--space-3) /* 12px */
var(--space-4) /* 16px */
var(--space-6) /* 24px */
var(--space-8) /* 32px */

/* Radius */
var(--radius-sm)  /* 8px */
var(--radius-md)  /* 12px */
var(--radius-lg)  /* 16px */
var(--radius-xl)  /* 28px */

/* Elevation */
var(--elev-1) /* Cards */
var(--elev-2) /* Menus */
var(--elev-3) /* Dialogs */

/* Motion */
var(--md-motion-duration-short4)   /* 200ms */
var(--md-motion-easing-standard)
```

---

**Nächste Schritte:** Siehe `docs/ui-md3-checklist.md` für die Komponenten-Checkliste.
