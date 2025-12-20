---
title: "Design System Overview"
status: active
owner: frontend-team
updated: "2025-11-07"
tags: [design, ui, material-design, style-guide]
links:
  - design-tokens.md
  - material-design-3.md
  - accessibility.md
---

# Design System Overview

Übersicht über das CO.RA.PAN Design System und Designprinzipien.

---

## Design Philosophy

Das CO.RA.PAN Design System basiert auf **Material Design 3 Principles** mit angepasster Farbpalette für optimale Lesbarkeit und Barrierefreiheit.

### Kernprinzipien

1. **Konsistenz**: Einheitliche Komponenten über alle Seiten
2. **Accessibility First**: WCAG AA-konform (4.5:1 Kontrast minimum)
3. **Responsive**: Mobile-first Design mit flüssigen Layouts
4. **Performance**: Minimale CSS/JS-Größe, optimierte Ladezeiten

---

## Typography

### Font Stack

**Primary Display Font:**
```css
font-family: 'Arial Narrow', 'Helvetica Neue Condensed', Arial, sans-serif;
```
- Verwendet für: Hero-Titel, Section-Headers, Navigation
- Charakteristik: Eng, modern, platzsparend

**Body Font:**
```css
font-family: Arial, sans-serif;
```
- Base Size: 16px
- Line Height: 1.5 (24px)
- Skalierung: `clamp()` für responsive Größen

**Monospace Font:**
```css
font-family: 'JetBrains Mono', 'Fira Mono', monospace;
```
- Verwendet für: Code-Snippets, Token-IDs, Dateinamen

### Typographic Scale

```css
--font-size-xs: 0.75rem;   /* 12px */
--font-size-sm: 0.875rem;  /* 14px */
--font-size-base: 1rem;    /* 16px */
--font-size-lg: 1.125rem;  /* 18px */
--font-size-xl: 1.5rem;    /* 24px */
--font-size-2xl: 2rem;     /* 32px */
--font-size-3xl: 3rem;     /* 48px */
```

**Hero Headings mit clamp():**
```css
.hero-title {
  font-size: clamp(2rem, 5vw, 3rem);
}
```

---

## Layout Principles

### Max Width & Centering

```css
:root {
  --max-content-width: 1200px;
}

.container {
  max-width: var(--max-content-width);
  margin-inline: auto;
  padding-inline: var(--space-4);
}
```

### Spacing System

Konsistente Spacing-Tokens für Gutters und vertikalen Rhythmus:

```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
```

**Verwendung:**
- Card-Padding: `var(--space-4)` bis `var(--space-6)`
- Section-Gaps: `var(--space-8)` bis `var(--space-12)`
- Button-Padding: `var(--space-2)` (vertikal), `var(--space-4)` (horizontal)

### Responsive Grid

```css
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-6);
}
```

**Breakpoints:**
```css
/* Mobile first */
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
```

---

## Component Architecture

### Shared Component Classes

**Cards:**
```css
.project-card,
.project-meta-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: 0 0 12px rgba(36, 70, 82, 0.05);
}
```

**Buttons:**
```css
.btn {
  /* Base button styles */
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.btn:hover {
  box-shadow: 0 2px 8px rgba(36, 70, 82, 0.15);
  transform: translateY(-1px);
}

.btn-primary {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.btn-primary:hover {
  background: var(--color-accent-dark);
}
```

### Special Components

**Login Sheet:**
```css
.login-sheet {
  backdrop-filter: blur(20px);
  background: rgba(234, 243, 245, 0.95);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(36, 70, 82, 0.2);
}
```

**Project Hero:**
```css
.project-hero {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-12) var(--space-4);
}
```

---

## Mobile Navigation

### Drawer Pattern

Mobile Navigation (< 768px) verwendet einen **Navigation Drawer**:

```css
.navigation-drawer {
  position: fixed;
  top: 0;
  left: -100%;
  width: 280px;
  height: 100vh;
  background: var(--color-surface);
  transition: left 0.3s ease;
  z-index: 1000;
}

.navigation-drawer.open {
  left: 0;
}
```

**Toggle:**
```html
<button data-action="toggle-drawer" class="menu-button">
  <i class="material-symbols-rounded">menu</i>
</button>
```

---

## Border & Shadow System

### Borders

```css
--border-width: 1px;
--color-border: #2f5f73;

.card {
  border: var(--border-width) solid var(--color-border);
}
```

### Shadows

**Subtle Elevation (Cards):**
```css
box-shadow: 0 0 12px rgba(36, 70, 82, 0.05);
```

**Medium Elevation (Modals, Dropdowns):**
```css
box-shadow: 0 4px 24px rgba(36, 70, 82, 0.15);
```

**Strong Elevation (Login Sheet):**
```css
box-shadow: 0 8px 32px rgba(36, 70, 82, 0.2);
```

---

## Icon System

**Font:** Material Symbols (Rounded Variant)

```html
<i class="material-symbols-rounded">home</i>
<i class="material-symbols-rounded">search</i>
<i class="material-symbols-rounded">person</i>
```

**CDN:**
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet">
```

**Sizing:**
```css
.icon-sm { font-size: 1rem; }    /* 16px */
.icon-md { font-size: 1.5rem; }  /* 24px */
.icon-lg { font-size: 2rem; }    /* 32px */
```

---

## Siehe auch

- [Design Tokens](design-tokens.md) - CSS Custom Properties
- [Material Design 3](material-design-3.md) - MD3-spezifische Implementierung
- [Accessibility](accessibility.md) - Barrierefreiheit & Kontraste
