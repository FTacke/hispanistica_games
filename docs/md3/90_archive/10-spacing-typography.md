# MD3 Goldstandard – Spacing & Typography

> Part of the MD3 Goldstandard documentation series.

## 1. Spacing System

### 1.1 Token Reference

| Token | Value | Use Case |
|-------|-------|----------|
| `--space-1` | 4px | Micro gaps (icon-label) |
| `--space-2` | 8px | Tight spacing (inline elements) |
| `--space-3` | 12px | Form field gaps |
| `--space-4` | 16px | Card padding, section content |
| `--space-5` | 20px | Card header/actions padding |
| `--space-6` | 24px | Section spacing, page margins |
| `--space-8` | 32px | Major section breaks |
| `--space-10` | 40px | Page bottom padding |
| `--space-12` | 48px | Content bottom padding |

### 1.2 Vertical Rhythm Rules

| Context | Token | Value |
|---------|-------|-------|
| Section to Section | `--space-8` | 32px |
| Section Header to Content | `--space-4` | 16px |
| Paragraph to Paragraph | `--space-4` | 16px |
| Form Field to Field | `--space-3` or `--space-4` | 12-16px |
| Content to Actions | `--space-6` | 24px |
| Actions Button Gap | `--space-2` or `--space-3` | 8-12px |

### 1.3 Stack Utilities

```css
/* Page-level rhythm (major sections) */
.md3-stack--page > * + * {
  margin-top: var(--space-8); /* 32px */
}

/* Section-level rhythm (within sections) */
.md3-stack--section > * + * {
  margin-top: var(--space-6); /* 24px */
}

/* Dialog-level rhythm (form dialogs) */
.md3-stack--dialog > * + * {
  margin-top: var(--space-4); /* 16px */
}

/* Compact rhythm (inline elements) */
.md3-stack--compact > * + * {
  margin-top: var(--space-2); /* 8px */
}
```

---

## 2. Typography System

### 2.1 Type Scale Reference

| Role | Class | Size | Weight | Line Height | Letter Spacing |
|------|-------|------|--------|-------------|----------------|
| Display Large | `.md3-display-large` | 57px | 400 | 64px | -0.25px |
| Display Medium | `.md3-display-medium` | 45px | 400 | 52px | 0 |
| Display Small | `.md3-display-small` | 36px | 400 | 44px | 0 |
| Headline Large | `.md3-headline-large` | 32px | 400 | 40px | 0 |
| Headline Medium | `.md3-headline-medium` | 28px | 400 | 36px | 0 |
| Headline Small | `.md3-headline-small` | 24px | 400 | 32px | 0 |
| Title Large | `.md3-title-large` | 22px | 400 | 28px | 0 |
| Title Medium | `.md3-title-medium` | 16px | 500 | 24px | 0.15px |
| Title Small | `.md3-title-small` | 14px | 500 | 20px | 0.1px |
| Label Large | `.md3-label-large` | 14px | 500 | 20px | 0.1px |
| Label Medium | `.md3-label-medium` | 12px | 500 | 16px | 0.5px |
| Label Small | `.md3-label-small` | 11px | 500 | 16px | 0.5px |
| Body Large | `.md3-body-large` | 16px | 400 | 24px | 0.5px |
| Body Medium | `.md3-body-medium` | 14px | 400 | 20px | 0.25px |
| Body Small | `.md3-body-small` | 12px | 400 | 16px | 0.4px |

### 2.2 Usage Guidelines

| Context | Typography Class |
|---------|------------------|
| Page Title (Hero) | `.md3-headline-medium` or `.md3-display-small` |
| Card Title | `.md3-title-large` |
| Section Title | `.md3-title-large` |
| Subsection Title | `.md3-title-medium` |
| Body Text | `.md3-body-medium` or `.md3-body-large` |
| Form Labels | `.md3-label-large` |
| Supporting Text | `.md3-body-small` |
| Button Text | `.md3-label-large` |
| Table Headers | `.md3-label-medium` |
| Table Cells | `.md3-body-medium` |

### 2.3 Color Mapping

| Role | Color Token |
|------|-------------|
| Page Title | `--md-sys-color-primary` |
| Card Title | `--md-sys-color-primary` |
| Section Title | `--md-sys-color-primary` |
| Body Text | `--md-sys-color-on-surface` |
| Secondary Text | `--md-sys-color-on-surface-variant` |
| Error Text | `--md-sys-color-error` |
| Link Text | `--md-sys-color-primary` |

---

## 3. Component Spacing Reference

### 3.1 Cards

| Element | Padding |
|---------|---------|
| `.md3-card__header` | `20px 20px 12px` |
| `.md3-card__content` | `16px 20px` |
| `.md3-card__actions` | `16px 20px 20px` |
| Mobile adjustment | `-4px` horizontal |

### 3.2 Dialogs

| Element | Padding |
|---------|---------|
| `.md3-dialog__surface` | `24px` |
| `.md3-dialog__content` | `0 0 12px 0` |
| `.md3-dialog__actions` | `16px 0 0 0` |
| Mobile adjustment | `16px` surface |

### 3.3 Alerts

| Variant | Padding |
|---------|---------|
| Base | `16px 20px` |
| `.md3-alert--banner` | `16px 24px` |
| `.md3-alert--inline` | `12px 16px` |
| Mobile adjustment | `-4px` all around |

### 3.4 Hero

| Element | Padding/Margin |
|---------|----------------|
| `.md3-hero--card` | `24px` padding |
| Margin below hero | `32px` |
| Mobile adjustment | `16px` padding |

---

## 4. Heading Hierarchy

### 4.1 Document Structure

```
H1 (Page Title)           → md3-headline-medium / md3-display-small
  H2 (Section Title)      → md3-title-large
    H3 (Subsection)       → md3-title-medium
      H4 (Minor heading)  → md3-title-small
```

### 4.2 Heading Margins

```css
/* Section titles - more space before, less after */
.md3-title-large,
.md3-section-title {
  margin-top: var(--space-8);
  margin-bottom: var(--space-3);
}

/* Subsection titles */
.md3-title-medium,
.md3-subsection-title {
  margin-top: var(--space-6);
  margin-bottom: var(--space-2);
}

/* First heading in section - no top margin */
section > h2:first-child,
.md3-card__content > h2:first-child {
  margin-top: 0;
}
```

---

## 5. Form Spacing

### 5.1 Form Layout

```css
.md3-auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4); /* 16px between fields */
}

/* Tighter spacing for compact forms */
.md3-form--compact {
  gap: var(--space-3); /* 12px between fields */
}
```

### 5.2 Field to Label

```css
.md3-field-support,
.md3-field-error {
  margin-top: var(--space-1); /* 4px below field */
  padding-left: var(--space-4); /* Align with input text */
}
```

### 5.3 Actions Zone

```css
.md3-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2); /* 8px between buttons */
  margin-top: var(--space-4); /* 16px above actions */
}
```

---

## 6. Responsive Typography

### 6.1 Mobile Adjustments (≤599px)

```css
@media (max-width: 599px) {
  .md3-display-small {
    font-size: 1.75rem; /* 28px */
    line-height: 1.3;
  }
  
  .md3-headline-medium {
    font-size: 1.5rem; /* 24px */
    line-height: 1.25;
  }
  
  .md3-title-large {
    font-size: 1.125rem; /* 18px */
  }
  
  .md3-body-large {
    font-size: 0.95rem; /* 15px */
  }
}
```

### 6.2 Large Screens (≥1200px)

```css
@media (min-width: 1200px) {
  .md3-display-small {
    font-size: 2.5rem; /* 40px */
  }
  
  .md3-body-large {
    font-size: 1.125rem; /* 18px */
  }
}
```

---

## 7. Text Utilities

### 7.1 Color Utilities

```css
.md3-text-primary { color: var(--md-sys-color-primary); }
.md3-text-secondary { color: var(--md-sys-color-secondary); }
.md3-text-error { color: var(--md-sys-color-error); }
.md3-text-variant { color: var(--md-sys-color-on-surface-variant); }
```

### 7.2 Alignment Utilities

```css
.md3-text-center { text-align: center; }
.md3-text-right { text-align: right; }
.md3-text-left { text-align: left; }
```

### 7.3 Max-Width Utilities

```css
.max-w-400 { max-width: 400px; }
.max-w-480 { max-width: 480px; }
.max-w-600 { max-width: 600px; }
.max-w-900 { max-width: 900px; }
```

---

## 8. Page Layout Spacing

### 8.1 Page Container

```css
.md3-page {
  padding: 0 var(--space-6); /* 24px edge padding */
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 599px) {
  .md3-page {
    padding: 0 var(--space-4); /* 16px on mobile */
  }
}
```

### 8.2 Text Page

```css
.md3-text-page {
  padding: 0 var(--space-4); /* Mobile: 16px */
}

@media (min-width: 600px) {
  .md3-text-page {
    padding: 0 var(--space-6); /* Tablet: 24px */
  }
}

@media (min-width: 1200px) {
  .md3-text-page {
    padding: 0 var(--space-8); /* Desktop: 32px */
  }
}

.md3-text-content {
  max-width: var(--text-page-max-width, 900px);
  margin: var(--space-6) auto 0;
  padding-bottom: var(--space-12);
}
```

---

## 9. Migration Checklist

- [ ] Replace hardcoded px values with `--space-*` tokens
- [ ] Use `.md3-stack--*` utilities for vertical rhythm
- [ ] Apply correct typography classes to all headings
- [ ] Verify heading hierarchy (single H1 per page)
- [ ] Test responsive typography on mobile
- [ ] Ensure edge padding is consistent across pages

---

## 10. Quick Reference

### Spacing Cheat Sheet

```
4px  = --space-1  (micro)
8px  = --space-2  (tight)
12px = --space-3  (form gaps)
16px = --space-4  (card content)
20px = --space-5  (card header)
24px = --space-6  (section)
32px = --space-8  (major break)
40px = --space-10 (page bottom)
48px = --space-12 (content bottom)
```

### Typography Cheat Sheet

```
Page Title   → md3-headline-medium (28px)
Card Title   → md3-title-large (22px)
Section      → md3-title-large (22px)
Subsection   → md3-title-medium (16px/500)
Body         → md3-body-medium (14px)
Body Large   → md3-body-large (16px)
Label        → md3-label-large (14px/500)
Small        → md3-body-small (12px)
```
