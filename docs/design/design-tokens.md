---
title: "Design Tokens Reference"
status: active
owner: frontend-team
updated: "2025-11-07"
tags: [design, css, tokens, variables]
links:
  - design-system-overview.md
  - material-design-3.md
---

# Design Tokens Reference

Vollständige Referenz aller CSS Custom Properties (Design Tokens) im CO.RA.PAN Design System.

---

## Color Palette

### Background & Surface

```css
:root {
  --color-bg: #c7d5d8;           /* Overall canvas */
  --color-surface: #eaf3f5;      /* Cards, interactive shells */
  --color-surface-alt: #d7e6eb;  /* Subtle elevation */
}
```

**Verwendung:**
- `--color-bg`: Body-Background, Page-Canvas
- `--color-surface`: Cards, Modals, Navigation
- `--color-surface-alt`: Hover-States, Secondary-Cards

---

### Accent & Border

```css
:root {
  --color-accent: #2f5f73;       /* Primary buttons, borders */
  --color-accent-dark: #244652;  /* Hover state for accent */
  --color-accent-soft: #a9c9d0;  /* Chips, soft backgrounds */
  --color-border: #2f5f73;       /* Card outlines, dividers */
}
```

**Verwendung:**
- `--color-accent`: Primary Buttons, Active Links, Icons
- `--color-accent-dark`: Button Hover, Active Navigation
- `--color-accent-soft`: Navigation Chips, Tags, Hover-BG
- `--color-border`: 1px Borders auf Cards, Input-Fields

---

### Text Colors

```css
:root {
  --color-text: #244652;         /* Primary text */
  --color-text-muted: #3a6070;   /* Secondary text, hints */
}
```

**Kontraste:**
- `--color-text` auf `--color-bg`: **6.2:1** (AAA)
- `--color-text` auf `--color-surface`: **7.8:1** (AAA)
- `--color-text-muted` auf `--color-bg`: **4.7:1** (AA)

---

### Support Colors

```css
:root {
  --color-success: #2f5f73;      /* Success states (re-uses accent) */
  --color-warning: #efede1;      /* Warning backgrounds */
  --color-error: #913535;        /* Error states, destructive actions */
}
```

**Verwendung:**
- `--color-success`: Flash-Messages (Success), Checkmarks
- `--color-warning`: Warning-Banners, Info-Boxes
- `--color-error`: Error-Messages, Delete-Buttons

---

## Spacing Tokens

### Base Scale

```css
:root {
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-10: 2.5rem;  /* 40px */
  --space-12: 3rem;    /* 48px */
  --space-16: 4rem;    /* 64px */
}
```

### Semantic Spacing

```css
:root {
  --gutter: var(--space-4);         /* Default horizontal padding */
  --section-gap: var(--space-12);   /* Vertical gap between sections */
  --card-padding: var(--space-6);   /* Inner padding for cards */
}
```

---

## Border Radius

```css
:root {
  --radius-sm: 0.25rem;  /* 4px - Buttons, Small Elements */
  --radius-md: 0.5rem;   /* 8px - Cards, Inputs */
  --radius-lg: 1rem;     /* 16px - Modals, Login Sheet */
  --radius-xl: 1.5rem;   /* 24px - Hero-Sections */
}
```

---

## Typography Tokens

### Font Families

```css
:root {
  --font-display: 'Arial Narrow', 'Helvetica Neue Condensed', Arial, sans-serif;
  --font-body: Arial, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Mono', monospace;
}
```

### Font Sizes

```css
:root {
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.5rem;     /* 24px */
  --font-size-2xl: 2rem;      /* 32px */
  --font-size-3xl: 3rem;      /* 48px */
}
```

### Font Weights

```css
:root {
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

### Line Heights

```css
:root {
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
}
```

---

## Shadow Tokens

```css
:root {
  --shadow-sm: 0 0 12px rgba(36, 70, 82, 0.05);   /* Subtle (Cards) */
  --shadow-md: 0 4px 24px rgba(36, 70, 82, 0.15); /* Medium (Dropdowns) */
  --shadow-lg: 0 8px 32px rgba(36, 70, 82, 0.2);  /* Strong (Modals) */
}
```

---

## Transition Tokens

```css
:root {
  --transition-fast: 0.15s ease;
  --transition-base: 0.2s ease;
  --transition-slow: 0.3s ease;
}
```

**Verwendung:**
```css
.btn {
  transition: all var(--transition-base);
}

.navigation-drawer {
  transition: left var(--transition-slow);
}
```

---

## Z-Index Scale

```css
:root {
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-drawer: 1000;
  --z-modal: 2000;
  --z-toast: 3000;
}
```

**Verwendung:**
```css
.navigation-drawer { z-index: var(--z-drawer); }
.login-sheet { z-index: var(--z-modal); }
```

---

## Breakpoints (via CSS)

```css
:root {
  --bp-mobile: 320px;
  --bp-tablet: 768px;
  --bp-desktop: 1024px;
  --bp-wide: 1440px;
}
```

**Verwendung in Media Queries:**
```css
@media (min-width: 768px) {
  /* Tablet+ styles */
}
```

---

## Component-Specific Tokens

### Navigation

```css
:root {
  --nav-height: 64px;
  --nav-bg: var(--color-surface);
  --nav-drawer-width: 280px;
}
```

### Cards

```css
:root {
  --card-bg: var(--color-surface);
  --card-border: 1px solid var(--color-border);
  --card-radius: var(--radius-md);
  --card-shadow: var(--shadow-sm);
}
```

### Buttons

```css
:root {
  --btn-padding-y: var(--space-2);
  --btn-padding-x: var(--space-4);
  --btn-radius: var(--radius-sm);
  --btn-transition: var(--transition-base);
}
```

---

## Accessibility Overrides

### Dark Mode (Future)

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a2a30;
    --color-surface: #244652;
    --color-text: #eaf3f5;
    --color-text-muted: #a9c9d0;
    /* ... */
  }
}
```

**Status:** 🚧 Nicht implementiert (Roadmap Item)

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Status:** ✅ Implementiert

---

## Token Generation

Tokens werden automatisch aus Figma-Designs generiert:

```bash
# LOKAL/00 - Md3-design/generate-tokens.py
python generate-tokens.py --input design-specs.json --output md3-tokens.generated.css
```

**Output:** `md3-tokens.generated.css` (wird in `static/css/` eingebunden)

---

## Siehe auch

- [Design System Overview](design-system-overview.md) - Konzeptuelle Übersicht
- [Material Design 3](material-design-3.md) - MD3-spezifische Tokens
- [Accessibility](accessibility.md) - Kontrast-Ratios & WCAG
