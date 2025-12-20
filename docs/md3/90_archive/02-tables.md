# MD3 Goldstandard - Tables & Lists

**Version:** 1.0  
**Date:** 2025-11-26

---

## 1. Base Table (`.md3-table`)

Use for admin lists, file overviews, and structured data displays.

### 1.1 Basic Structure

```html
<div class="md3-table-container">
  <table class="md3-table">
    <thead>
      <tr>
        <th>Column 1</th>
        <th>Column 2</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Data 1</td>
        <td>Data 2</td>
        <td>
          <button class="md3-button md3-button--icon" title="Edit">
            <span class="material-symbols-rounded">edit</span>
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### 1.2 CSS Tokens

| Element | Property | Value |
|---------|----------|-------|
| Table | Width | 100% |
| Table | Border-collapse | collapse |
| th/td | Padding | `var(--space-3)` |
| th/td | Border-bottom | 1px solid `--md-sys-color-outline-variant` |
| thead th | Background | `--md-sys-color-surface-container` |
| thead th | Font-weight | 600 |
| thead th | Color | `--md-sys-color-on-surface-variant` |
| tbody td | Color | `--md-sys-color-on-surface` |

---

## 2. Table States

### 2.1 Hover State

Rows with interactive actions should show hover feedback:

```css
.md3-table tbody tr:hover {
  background-color: var(--md-sys-color-surface-container-low);
}

/* Only show pointer if row is clickable */
.md3-table--clickable tbody tr {
  cursor: pointer;
}
```

### 2.2 Selected State

For rows that can be selected (e.g., multi-select operations):

```html
<tr class="is-selected">
  <td>Selected row</td>
</tr>
```

```css
.md3-table tbody tr.is-selected {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.md3-table tbody tr.is-selected td {
  border-left: 3px solid var(--md-sys-color-primary);
}
```

### 2.3 Disabled Row

For inactive/disabled entries (e.g., inactive users):

```html
<tr class="is-disabled">
  <td>Disabled row</td>
</tr>
```

```css
.md3-table tbody tr.is-disabled {
  opacity: 0.6;
  cursor: default;
}

.md3-table tbody tr.is-disabled:hover {
  background-color: transparent;
}
```

---

## 3. Table Variants

### 3.1 Elevated Table

With shadow and rounded corners:

```html
<div class="md3-table-container md3-table-container--elevated">
  <table class="md3-table">...</table>
</div>
```

```css
.md3-table-container--elevated {
  background: var(--md-sys-color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--elev-1);
  overflow: hidden;
}
```

### 3.2 Outlined Table

With border instead of shadow:

```html
<div class="md3-table-container md3-table-container--outlined">
  <table class="md3-table">...</table>
</div>
```

```css
.md3-table-container--outlined {
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--radius-md);
  overflow: hidden;
}
```

---

## 4. Empty State

When a table has no data, show an empty state instead:

### 4.1 Basic Pattern

```html
{% if items %}
<div class="md3-table-container">
  <table class="md3-table">...</table>
</div>
{% else %}
<div class="md3-empty-state">
  <span class="material-symbols-rounded md3-empty-state__icon" aria-hidden="true">person_off</span>
  <p class="md3-empty-state__title">Keine Benutzer gefunden</p>
  <p class="md3-empty-state__text">Erstellen Sie einen neuen Benutzer, um zu beginnen.</p>
  <button class="md3-button md3-button--filled">
    <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">add</span>
    Benutzer anlegen
  </button>
</div>
{% endif %}
```

### 4.2 Empty State CSS

```css
.md3-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
}

.md3-empty-state__icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
  color: var(--md-sys-color-outline);
}

.md3-empty-state__title {
  font-size: var(--md-sys-typescale-title-medium-font-size);
  font-weight: var(--md-sys-typescale-title-medium-font-weight);
  margin: 0 0 var(--space-2);
  color: var(--md-sys-color-on-surface);
}

.md3-empty-state__text {
  font-size: var(--md-sys-typescale-body-medium-font-size);
  margin: 0 0 var(--space-4);
  max-width: 300px;
}

.md3-empty-state .md3-button {
  margin-top: var(--space-2);
}
```

### 4.3 Icon Mapping for Empty States

| Context | Icon |
|---------|------|
| No users | `person_off` |
| No search results | `search_off` |
| No files | `folder_off` |
| No data | `do_not_disturb_on` |
| Error loading | `error_outline` |

---

## 5. Inline Empty Row

For tables populated by JavaScript where an empty row is appropriate:

```html
<tbody id="list-body">
  <tr class="md3-table__empty-row">
    <td colspan="6">
      <div class="md3-empty-inline">
        <span class="material-symbols-rounded" aria-hidden="true">inbox</span>
        <span>Keine Einträge vorhanden.</span>
      </div>
    </td>
  </tr>
</tbody>
```

```css
.md3-table__empty-row td {
  padding: var(--space-6) var(--space-4);
}

.md3-empty-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--md-sys-color-on-surface-variant);
}
```

---

## 6. Action Columns

### 6.1 Icon Buttons

For row actions, use icon buttons:

```html
<td class="md3-table__actions">
  <button class="md3-button md3-button--icon" title="Bearbeiten" aria-label="Bearbeiten">
    <span class="material-symbols-rounded">edit</span>
  </button>
  <button class="md3-button md3-button--icon" title="Löschen" aria-label="Löschen">
    <span class="material-symbols-rounded">delete</span>
  </button>
</td>
```

```css
.md3-table__actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.md3-button--icon {
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 150ms ease;
}

.md3-button--icon:hover {
  background-color: var(--md-sys-color-surface-container-highest);
}

.md3-button--icon:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}
```

### 6.2 Link Actions

For navigation to detail pages:

```html
<td>
  <a href="/edit/123" class="md3-button md3-button--text md3-button--small">
    <span class="material-symbols-rounded md3-button__icon">edit</span>
    Edit
  </a>
</td>
```

---

## 7. Column Widths

Use utility classes for fixed column widths:

```html
<th class="col-w-10">ID</th>
<th class="col-w-25">Name</th>
<th class="col-w-15">Status</th>
<th class="col-w-15">Actions</th>
```

```css
.col-w-10 { width: 10%; }
.col-w-15 { width: 15%; }
.col-w-20 { width: 20%; }
.col-w-25 { width: 25%; }
.col-w-30 { width: 30%; }
```

---

## 8. Responsive Behavior

### 8.1 Horizontal Scroll

Tables should scroll horizontally on small screens:

```css
.md3-table-container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.md3-table {
  min-width: 600px; /* Prevent excessive compression */
}
```

### 8.2 Priority Columns

On mobile, consider hiding less important columns:

```html
<th class="md3-hide-mobile">Created At</th>
<td class="md3-hide-mobile">2025-01-15</td>
```

```css
@media (max-width: 600px) {
  .md3-hide-mobile {
    display: none;
  }
}
```

---

## 9. Example: Admin Users Table

```html
<div class="md3-table-container">
  <table class="md3-table">
    <thead>
      <tr>
        <th class="col-w-20">Benutzername</th>
        <th class="col-w-25">Email</th>
        <th class="col-w-10">Rolle</th>
        <th class="col-w-10">Status</th>
        <th class="col-w-20 md3-hide-mobile">Erstellt am</th>
        <th class="col-w-15">Aktionen</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="md3-body-medium">admin</span></td>
        <td><span class="md3-body-small">admin@example.com</span></td>
        <td><span class="md3-badge md3-badge--role-admin">admin</span></td>
        <td><span class="md3-badge md3-badge--status-active">Aktiv</span></td>
        <td class="md3-hide-mobile"><span class="md3-body-small">15.01.2025</span></td>
        <td class="md3-table__actions">
          <button class="md3-button md3-button--icon" title="Bearbeiten">
            <span class="material-symbols-rounded">edit</span>
          </button>
          <button class="md3-button md3-button--icon" title="Passwort zurücksetzen">
            <span class="material-symbols-rounded">history_edu</span>
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```
