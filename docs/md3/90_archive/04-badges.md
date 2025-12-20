# MD3 Goldstandard - Icons & Badges

**Version:** 1.0  
**Date:** 2025-11-26

---

## 1. Role Badges

### 1.1 Role Icon Mapping

| Role | Icon | Badge Class |
|------|------|-------------|
| Admin | `verified_user` | `md3-badge--role-admin` |
| Editor | `edit` | `md3-badge--role-editor` |
| User | `person` | `md3-badge--role-user` |

### 1.2 HTML Structure

**Badge with Icon:**
```html
<span class="md3-badge md3-badge--role-admin">
  <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">verified_user</span>
  Admin
</span>
```

**Badge Text Only:**
```html
<span class="md3-badge md3-badge--role-editor">Editor</span>
```

### 1.3 CSS Implementation

```css
/* Base Badge */
.md3-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-inline: 8px;
  height: 24px;
  border-radius: 9999px;
  font-size: var(--md-sys-typescale-label-small-font-size);
  font-weight: var(--md-sys-typescale-label-small-font-weight);
  line-height: 1;
  white-space: nowrap;
}

.md3-badge__icon {
  font-size: 14px;
  width: 14px;
  height: 14px;
}

/* Small Variant */
.md3-badge--small {
  height: 20px;
  padding-inline: 6px;
  font-size: var(--md-sys-typescale-label-small-font-size);
}

.md3-badge--small .md3-badge__icon {
  font-size: 12px;
  width: 12px;
  height: 12px;
}

/* Role Colors */
.md3-badge--role-admin {
  background: color-mix(in srgb, var(--md-sys-color-error) 16%, transparent);
  color: var(--md-sys-color-error);
}

.md3-badge--role-editor {
  background: color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent);
  color: var(--md-sys-color-primary);
}

.md3-badge--role-user {
  background: color-mix(in srgb, var(--md-sys-color-secondary) 16%, transparent);
  color: var(--md-sys-color-secondary);
}
```

---

## 2. Status Badges

### 2.1 Status Types

| Status | Icon | Badge Class | Color |
|--------|------|-------------|-------|
| Active | `check_circle` | `md3-badge--status-active` | Green (success) |
| Inactive | `pause_circle` | `md3-badge--status-inactive` | Gray (neutral) |
| Pending | `schedule` | `md3-badge--status-pending` | Amber (warning) |
| Error | `error` | `md3-badge--status-error` | Red (error) |

### 2.2 HTML Structure

```html
<span class="md3-badge md3-badge--status-active">
  <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">check_circle</span>
  Aktiv
</span>

<span class="md3-badge md3-badge--status-inactive">Inaktiv</span>
```

### 2.3 CSS Implementation

```css
/* Success/Active - Muted green */
.md3-badge--status-active,
.md3-badge--success {
  background: color-mix(in srgb, var(--md-sys-color-success, #34a853) 16%, transparent);
  color: var(--md-sys-color-success, #34a853);
}

/* Inactive - Neutral gray */
.md3-badge--status-inactive {
  background: color-mix(in srgb, var(--md-sys-color-outline) 24%, transparent);
  color: var(--md-sys-color-on-surface-variant);
}

/* Pending - Warning amber */
.md3-badge--status-pending {
  background: color-mix(in srgb, var(--md-sys-color-warning) 16%, transparent);
  color: var(--md-sys-color-on-warning-container);
}

/* Error - Red */
.md3-badge--status-error,
.md3-badge--error {
  background: color-mix(in srgb, var(--md-sys-color-error) 16%, transparent);
  color: var(--md-sys-color-error);
}
```

---

## 3. Info Badges

For filter status, counts, notifications.

### 3.1 Info Badge

```html
<span class="md3-badge md3-badge--info">
  <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">filter_alt</span>
  Filtrado activo
</span>
```

```css
.md3-badge--info {
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
  color: var(--md-sys-color-primary);
}
```

### 3.2 Count Badge

For notification counts:

```html
<span class="md3-badge md3-badge--count">5</span>
```

```css
.md3-badge--count {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
}
```

---

## 4. Icon Usage Standards

### 4.1 Icon Sizes

| Context | Size | Class |
|---------|------|-------|
| Button icon | 18px | `.md3-button__icon` |
| Badge icon | 14px | `.md3-badge__icon` |
| Card header | 24px | Default |
| Hero icon | 48px | `.md3-hero__icon` |
| Empty state | 48px | `.md3-empty-state__icon` |

### 4.2 Standard Icon Set

**Actions:**
| Action | Icon |
|--------|------|
| Save | `save` |
| Delete | `delete` / `delete_forever` |
| Edit | `edit` |
| Add | `add` |
| Close | `close` |
| Refresh | `refresh` |
| Search | `search` |
| Filter | `filter_alt` |
| Export | `download` |
| Copy | `content_copy` |

**Status:**
| Status | Icon |
|--------|------|
| Success | `check_circle` |
| Error | `error` |
| Warning | `warning` |
| Info | `info` |
| Loading | spinner animation |

**Navigation:**
| Direction | Icon |
|-----------|------|
| Back | `arrow_back` |
| Forward | `arrow_forward` |
| Up | `arrow_upward` |
| Expand | `expand_more` |
| Collapse | `expand_less` |

**User/Auth:**
| Context | Icon |
|---------|------|
| Login | `login` |
| Logout | `logout` |
| Profile | `account_circle` |
| Settings | `settings` |
| Password | `lock` / `lock_reset` |
| User | `person` |
| Admin | `verified_user` / `shield` |

### 4.3 Icon Button

For icon-only buttons, always include accessible label:

```html
<button class="md3-button md3-button--icon" 
        title="Bearbeiten" 
        aria-label="Bearbeiten">
  <span class="material-symbols-rounded">edit</span>
</button>
```

---

## 5. Usage in Tables

### 5.1 Role Column

```html
<td>
  <span class="md3-badge md3-badge--small md3-badge--role-admin">
    <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">verified_user</span>
    admin
  </span>
</td>
```

### 5.2 Status Column

```html
<td>
  <span class="md3-badge md3-badge--status-active">
    <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">check_circle</span>
    Aktiv
  </span>
</td>
```

### 5.3 JavaScript Rendering

```javascript
function renderRoleBadge(role) {
  const icons = {
    admin: 'verified_user',
    editor: 'edit',
    user: 'person'
  };
  return `
    <span class="md3-badge md3-badge--small md3-badge--role-${role}">
      <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">${icons[role]}</span>
      ${role}
    </span>
  `;
}

function renderStatusBadge(isActive) {
  if (isActive) {
    return `
      <span class="md3-badge md3-badge--status-active">
        <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">check_circle</span>
        Aktiv
      </span>
    `;
  }
  return `
    <span class="md3-badge md3-badge--status-inactive">Inaktiv</span>
  `;
}
```

---

## 6. Usage in User Menu

```html
<div class="md3-account-button">
  <span class="md3-badge md3-badge--role-admin">
    <span class="material-symbols-rounded md3-badge__icon" aria-hidden="true">verified_user</span>
    Admin
  </span>
  <span class="md3-account-button__user">username</span>
</div>
```

---

## 7. Dark Mode Considerations

Badge colors should remain legible in both light and dark modes. The `color-mix()` approach with transparent backgrounds ensures this.

For explicit dark mode overrides:

```css
@media (prefers-color-scheme: dark) {
  .md3-badge--status-active {
    background: color-mix(in srgb, var(--md-sys-color-success) 24%, transparent);
  }
}
```

---

## 8. Accessibility

- Icons in badges must have `aria-hidden="true"`
- Badge text conveys the meaning, not the icon
- Sufficient color contrast (3:1 minimum for large text)
- Role badges should use semantic text (e.g., "admin" not just color)
