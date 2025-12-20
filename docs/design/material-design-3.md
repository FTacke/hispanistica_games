---
title: "Material Design 3 Implementation"
status: active
owner: frontend-team
updated: "2025-11-07"
tags: [material-design, md3, components]
links:
  - design-system-overview.md
  - design-tokens.md
---

# Material Design 3 Implementation

Spezifische Material Design 3 (MD3) Implementierungsdetails für CO.RA.PAN.

---

## MD3 Principles Adopted

### 1. Surface & Elevation

CO.RA.PAN verwendet **tonal surfaces** statt Shadow-basierter Elevation:

```css
/* Baseline surface */
.surface-level-0 { background: var(--color-bg); }

/* Elevated surface */
.surface-level-1 { background: var(--color-surface); }

/* Higher elevation */
.surface-level-2 { background: var(--color-surface-alt); }
```

**Shadows sind subtil** (nur für visuelle Trennung):
```css
box-shadow: 0 0 12px rgba(36, 70, 82, 0.05);
```

---

### 2. Color System

**MD3 verwendet Dynamic Color** - CO.RA.PAN verwendet statische Farben:

| MD3 Token | CO.RA.PAN Token | Wert |
|-----------|-----------------|------|
| `primary` | `--color-accent` | #2f5f73 |
| `on-primary` | `white` | #ffffff |
| `surface` | `--color-surface` | #eaf3f5 |
| `on-surface` | `--color-text` | #244652 |
| `surface-variant` | `--color-surface-alt` | #d7e6eb |

---

### 3. Typography Scale

MD3-konforme Typografie-Rollen:

| MD3 Role | CO.RA.PAN Class | Font Size |
|----------|-----------------|-----------|
| Display Large | `.text-display-lg` | 3rem (48px) |
| Display Medium | `.text-display-md` | 2rem (32px) |
| Headline Large | `.text-headline-lg` | 1.5rem (24px) |
| Title Large | `.text-title-lg` | 1.125rem (18px) |
| Body Large | `.text-body-lg` | 1rem (16px) |
| Label Medium | `.text-label-md` | 0.875rem (14px) |

---

## MD3 Components

### Buttons

**Filled Button (Primary):**
```html
<button class="btn btn-primary">
  <i class="material-symbols-rounded">search</i>
  Buscar
</button>
```

**Outlined Button (Secondary):**
```html
<button class="btn btn-outlined">
  Cancelar
</button>
```

**Text Button (Tertiary):**
```html
<button class="btn btn-text">
  Más información
</button>
```

---

### Cards

**Filled Card:**
```html
<div class="card card-filled">
  <h3 class="card-title">Título</h3>
  <p class="card-text">Contenido...</p>
</div>
```

**Outlined Card:**
```html
<div class="card card-outlined">
  <!-- ... -->
</div>
```

---

### Navigation

**Top App Bar:**
```html
<header class="top-app-bar" data-element="top-app-bar">
  <button class="icon-button" data-action="toggle-drawer">
    <i class="material-symbols-rounded">menu</i>
  </button>
  <h1 class="app-bar-title">CO.RA.PAN</h1>
</header>
```

**Navigation Drawer (Mobile):**
```html
<nav class="navigation-drawer" data-element="drawer">
  <ul class="drawer-menu">
    <li><a href="/">Inicio</a></li>
    <li><a href="/corpus">Corpus</a></li>
  </ul>
</nav>
```

---

## MD3 State Layers

**Hover & Focus States:**
```css
.btn:hover::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(47, 95, 115, 0.08); /* 8% overlay */
  border-radius: inherit;
}

.btn:focus-visible::before {
  background: rgba(47, 95, 115, 0.12); /* 12% overlay */
}
```

---

## Abweichungen von MD3

### 1. Keine Dynamic Color
**MD3 Standard:** Color-Scheme generiert aus Seed-Color  
**CO.RA.PAN:** Statische Palette (Performance + Einfachheit)

### 2. Reduzierte Elevation
**MD3 Standard:** 5 Elevation-Levels (0-4)  
**CO.RA.PAN:** 3 Levels (0-2) mit minimalen Shadows

### 3. Simplified Motion
**MD3 Standard:** Complex Easing Curves (emphasized-decelerate, etc.)  
**CO.RA.PAN:** Simple `ease` und `ease-in-out`

---

## Siehe auch

- [Design System Overview](design-system-overview.md)
- [Design Tokens](design-tokens.md)
- [Accessibility](accessibility.md)
