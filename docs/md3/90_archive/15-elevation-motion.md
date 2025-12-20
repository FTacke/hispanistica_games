# MD3 Elevation & Motion – Goldstandard

> **Status:** v1.2 – Advanced Phase  
> **Letzte Aktualisierung:** 2025-01-27

---

## Elevation System

### Audit-Ergebnis

| Komponente | Aktuelle Elevation | Soll |
|------------|-------------------|------|
| Cards (tonal) | `--elev-1` | ✅ |
| Cards (elevated) | `--elev-1` → `--elev-2` on hover | ✅ |
| Dialogs | `--elev-3` | ✅ |
| Navigation Drawer | `--elev-2` | ✅ |
| Top App Bar (scroll) | `--elev-3` | ✅ |
| Snackbar | `--elev-3` | ✅ |
| Menus | (nicht einheitlich) | ⚠️ Fix |

### Elevation Tokens

```css
:root {
  /* Level 1: Subtle lift */
  --elev-1: 0 1px 2px rgb(0 0 0 / 6%), 0 1px 1px rgb(0 0 0 / 5%);
  
  /* Level 2: Cards, raised elements */
  --elev-2: 0 2px 6px rgb(0 0 0 / 10%), 0 1px 2px rgb(0 0 0 / 6%);
  
  /* Level 3: Dialogs, overlays */
  --elev-3: 0 4px 8px rgb(0 0 0 / 12%), 0 2px 4px rgb(0 0 0 / 8%);
  
  /* Level 4: High emphasis (optional) */
  --elev-4: 0 6px 12px rgb(0 0 0 / 15%), 0 3px 6px rgb(0 0 0 / 10%);
  
  /* Level 5: Maximum (rare) */
  --elev-5: 0 8px 16px rgb(0 0 0 / 18%), 0 4px 8px rgb(0 0 0 / 12%);
}
```

### Anwendung

| Komponente | Ruhe | Hover/Focus | Active |
|------------|------|-------------|--------|
| Card (flat) | none | none | none |
| Card (elevated) | `--elev-1` | `--elev-2` | `--elev-1` |
| Button (filled) | none | `--elev-1` | none |
| FAB | `--elev-3` | `--elev-4` | `--elev-2` |
| Dialog | `--elev-3` | – | – |
| Menu | `--elev-2` | – | – |
| Snackbar | `--elev-3` | – | – |
| Top App Bar | none / `--elev-2` (compact) | – | `--elev-3` (scroll) |

---

## Motion System

### Easing Curves

```css
:root {
  /* Standard: Für die meisten UI-Bewegungen */
  --md-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  
  /* Emphasized: Für wichtige, große Bewegungen */
  --md-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
  
  /* Decelerate: Elemente kommen in den Viewport */
  --md-motion-easing-decelerate: cubic-bezier(0, 0, 0, 1);
  
  /* Accelerate: Elemente verlassen den Viewport */
  --md-motion-easing-accelerate: cubic-bezier(0.3, 0, 1, 1);
}
```

### Duration Tokens

```css
:root {
  --md-motion-duration-short1: 50ms;
  --md-motion-duration-short2: 100ms;
  --md-motion-duration-short3: 150ms;
  --md-motion-duration-short4: 200ms;
  --md-motion-duration-medium1: 250ms;
  --md-motion-duration-medium2: 300ms;
  --md-motion-duration-medium3: 350ms;
  --md-motion-duration-medium4: 400ms;
  --md-motion-duration-long1: 450ms;
  --md-motion-duration-long2: 500ms;
}
```

---

## Komponenten-Transitions

### Dialog

```css
.md3-dialog {
  transform: scale(0.9);
  opacity: 0;
  transition: 
    transform 200ms var(--md-motion-easing-emphasized),
    opacity 150ms var(--md-motion-easing-standard);
}

.md3-dialog[open] {
  transform: scale(1);
  opacity: 1;
}
```

### Snackbar

```css
.md3-snackbar {
  transform: translateX(-50%) translateY(100px);
  opacity: 0;
  transition: 
    transform 300ms var(--md-motion-easing-decelerate),
    opacity 200ms var(--md-motion-easing-standard);
}

.md3-snackbar.visible {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}
```

### Navigation Drawer (Modal)

```css
.md3-navigation-drawer--modal {
  transform: translateX(-100%);
  transition: transform 250ms var(--md-motion-easing-emphasized);
}

.md3-navigation-drawer--modal.is-open {
  transform: translateX(0);
}
```

### State Layer (Hover/Focus)

```css
.md3-interactive::before {
  content: "";
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  transition: opacity 150ms var(--md-motion-easing-standard);
}

.md3-interactive:hover::before { opacity: 0.08; }
.md3-interactive:focus-visible::before { opacity: 0.12; }
.md3-interactive:active::before { opacity: 0.12; }
```

---

## State Layer System

### Opacity Levels

| State | Opacity |
|-------|---------|
| Hover | 8% (0.08) |
| Focus | 12% (0.12) |
| Pressed | 12% (0.12) |
| Dragged | 16% (0.16) |

### Implementation Pattern

```css
/* Base interactive element */
.md3-interactive {
  position: relative;
  overflow: hidden; /* Contain state layer */
}

/* State layer pseudo-element */
.md3-interactive::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--md-sys-color-on-surface);
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms var(--md-motion-easing-standard);
  border-radius: inherit;
}

/* For primary-colored backgrounds */
.md3-button--filled::before {
  background: var(--md-sys-color-on-primary);
}
```

---

## Skeleton Loading Animation

```css
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.md3-skeleton {
  background: linear-gradient(
    90deg,
    var(--md-sys-color-surface-container) 25%,
    var(--md-sys-color-surface-container-high) 50%,
    var(--md-sys-color-surface-container) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}
```

---

## Focus Visible

```css
/* Global focus-visible style */
:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

---

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
