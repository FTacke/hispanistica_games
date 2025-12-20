# MD3 Goldstandard - Responsiveness

**Version:** 1.0  
**Date:** 2025-11-26

---

## 1. Breakpoints

### 1.1 Standard Breakpoints

| Name | Width | Use |
|------|-------|-----|
| Mobile | ≤600px | Phone, narrow windows |
| Desktop | >600px | Tablet and up |

### 1.2 CSS Variables (optional)

```css
:root {
  --breakpoint-mobile: 600px;
}
```

---

## 2. Button Responsiveness

### 2.1 Action Zone Stacking

On mobile, action zones should stack buttons vertically:

```css
@media (max-width: 600px) {
  .md3-actions {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .md3-actions .md3-button {
    width: 100%;
    justify-content: center;
  }
  
  /* Order: Primary first, then secondary, danger last */
  .md3-actions .md3-button--filled {
    order: 1;
  }
  
  .md3-actions .md3-button--outlined {
    order: 2;
  }
  
  .md3-actions .md3-button--text {
    order: 3;
  }
  
  .md3-actions .md3-button--danger {
    order: 4;
  }
}
```

### 2.2 Dialog Actions

Dialog actions may need special handling:

```css
@media (max-width: 600px) {
  .md3-dialog__actions {
    flex-direction: column-reverse; /* Primary on top */
    gap: var(--space-2);
  }
  
  .md3-dialog__actions .md3-button {
    width: 100%;
  }
}
```

### 2.3 Toolbar on Mobile

Toolbars may need to wrap or change layout:

```css
@media (max-width: 600px) {
  .md3-toolbar {
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  
  .md3-toolbar .md3-button {
    flex: 1 1 calc(50% - var(--space-2));
    min-width: 120px;
  }
}
```

---

## 3. Table Responsiveness

### 3.1 Horizontal Scroll

Tables should scroll horizontally rather than break layout:

```css
.md3-table-container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.md3-table {
  min-width: 600px; /* Prevent excessive compression */
}
```

### 3.2 Hide Secondary Columns

Less important columns can be hidden on mobile:

```css
@media (max-width: 600px) {
  .md3-hide-mobile {
    display: none;
  }
}
```

**Usage:**
```html
<th class="md3-hide-mobile">Created At</th>
<td class="md3-hide-mobile">2025-01-15</td>
```

### 3.3 Column Priority Guide

| Priority | Show on Mobile | Examples |
|----------|----------------|----------|
| High | ✅ Always | Name, Status, Actions |
| Medium | ⚠️ If space | Email, Role |
| Low | ❌ Hide | Created date, ID, Secondary info |

---

## 4. Dialog Responsiveness

### 4.1 Full-Width on Mobile

```css
@media (max-width: 600px) {
  .md3-dialog {
    width: 100%;
    max-width: 100%;
    margin: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 90vh;
  }
  
  .md3-dialog__container {
    max-width: 100%;
  }
  
  .md3-dialog__surface {
    width: 100%;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
}
```

### 4.2 Dialog Scroll

Long dialogs should scroll their content:

```css
.md3-dialog__content {
  max-height: 50vh;
  overflow-y: auto;
}

@media (max-width: 600px) {
  .md3-dialog__content {
    max-height: 60vh;
  }
}
```

---

## 5. Snackbar Responsiveness

Already implemented in `snackbar.css`:

```css
@media (max-width: 600px) {
  .md3-snackbar {
    left: var(--space-4);
    right: var(--space-4);
    transform: translateX(0) translateY(100px);
    min-width: auto;
  }
  
  .md3-snackbar.visible {
    transform: translateX(0) translateY(0);
  }
}
```

---

## 6. Alert Responsiveness

Already implemented in `alerts.css`:

```css
@media (max-width: 480px) {
  .md3-alert {
    padding: var(--space-3) var(--space-4);
    gap: var(--space-3);
  }

  .md3-alert--banner {
    padding: var(--space-3) var(--space-4);
    border-left-width: 4px;
  }

  .md3-alert__icon {
    font-size: 1.25rem;
    width: 1.25rem;
    height: 1.25rem;
  }
}
```

---

## 7. Card Responsiveness

### 7.1 Auth Cards

```css
@media (max-width: 600px) {
  .md3-auth-card {
    max-width: 100%;
    margin: 0;
    border-radius: 0;
  }
}
```

### 7.2 Card Grid

For dashboard-style card layouts:

```css
.md3-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

@media (max-width: 600px) {
  .md3-card-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 8. Form Responsiveness

### 8.1 Form Row (Side-by-side → Stacked)

```css
.md3-form-row {
  display: flex;
  gap: var(--space-4);
}

@media (max-width: 600px) {
  .md3-form-row {
    flex-direction: column;
    gap: var(--space-3);
  }
}
```

### 8.2 Textfield Sizing

```css
.md3-outlined-textfield--block {
  width: 100%;
}

/* On mobile, all textfields should be full-width */
@media (max-width: 600px) {
  .md3-outlined-textfield {
    width: 100%;
  }
}
```

---

## 9. Empty State Responsiveness

```css
@media (max-width: 600px) {
  .md3-empty-state {
    padding: var(--space-6);
  }
  
  .md3-empty-state__icon {
    font-size: 40px;
  }
  
  .md3-empty-state__text {
    max-width: 100%;
    padding: 0 var(--space-4);
  }
}
```

---

## 10. Badge Responsiveness

Badges should remain legible on mobile:

```css
@media (max-width: 600px) {
  /* Hide icon in badges for space */
  .md3-badge--compact .md3-badge__icon {
    display: none;
  }
}
```

---

## 11. Utility Classes

### 11.1 Show/Hide

```css
@media (max-width: 600px) {
  .md3-hide-mobile {
    display: none !important;
  }
}

@media (min-width: 601px) {
  .md3-hide-desktop {
    display: none !important;
  }
}
```

### 11.2 Text Truncation

```css
.md3-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.md3-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

---

## 12. Testing Checklist

### Mobile (≤600px)
- [ ] Buttons stack vertically in action zones
- [ ] Dialog fills width, anchored to bottom
- [ ] Tables scroll horizontally
- [ ] Secondary table columns hidden
- [ ] Snackbar full-width with margins
- [ ] Forms use full-width textfields
- [ ] Empty states fit in viewport

### Desktop (>600px)
- [ ] Buttons align horizontally
- [ ] Dialogs centered with max-width
- [ ] Tables show all columns
- [ ] Cards in grid layout
- [ ] Snackbar centered at bottom
