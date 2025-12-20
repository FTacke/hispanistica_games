# MD3 Goldstandard - Audit Report

**Date:** 2025-11-26  
**Scope:** Buttons, Actions-Zones, Lists/Tables, States, Feedback Components, Icons & Badges, Responsiveness

---

## 1. Overview

This audit documents the current state of MD3 components across the CO.RA.PAN webapp, identifying inconsistencies and areas for standardization.

### 1.1 Key Findings Summary

| Area | Status | Issues |
|------|--------|--------|
| Buttons | ⚠️ Mostly OK | Minor inconsistencies in icon usage, some legacy aliases remain |
| Actions Zones | ⚠️ Needs Work | Inconsistent positioning, some floating buttons |
| Tables | ⚠️ Mixed | Basic styling exists, missing hover/selected states |
| Snackbar | ⚠️ Fragmented | Multiple implementations (player uses custom, auth uses alerts) |
| Empty States | ✅ Partial | Pattern exists but not universal |
| Badges | ⚠️ Partial | Role badges exist, status badges incomplete |
| Loading | ❌ Minimal | Basic progress CSS, no unified pattern |

---

## 2. Detailed Component Audit

### 2.1 Buttons

**Location:** `static/css/md3/components/buttons.css` (328 lines)

**Current Variants:**
- `.md3-button--filled` ✅ Primary actions
- `.md3-button--tonal` ✅ Medium emphasis  
- `.md3-button--outlined` ✅ Low emphasis
- `.md3-button--text` ✅ Lowest emphasis
- `.md3-button--danger` ✅ Destructive actions
- `.md3-button--warning` ✅ Warning actions

**Legacy Aliases (to deprecate):**
- `.md3-button--contained` → use `--filled`
- `.md3-button--destructive` → use `--danger`

**Issues Found:**
1. Some icon buttons missing `aria-label`
2. Editor uses custom button classes (`md3-editor-btn-*`) instead of canonical classes
3. Player sidebar uses custom button styling

### 2.2 Actions Zones by Template

#### Auth Templates

| Template | Actions Pattern | Issues |
|----------|-----------------|--------|
| `login.html` | ✅ `.md3-actions` with text/filled | OK - good separation |
| `account_profile.html` | ⚠️ Multiple cards with `.md3-actions` | Each card OK, but danger button is `filled+danger` |
| `account_password.html` | ✅ `.md3-actions` with text/filled | OK |
| `account_delete.html` | ✅ `.md3-actions` with text+danger | OK |
| `password_forgot.html` | ✅ `.md3-row--between .md3-actions` | OK |
| `password_reset.html` | ⚠️ `.md3-actions` single button | Missing "back" link |
| `admin_users.html` | ✅ Toolbar + dialog actions | Good pattern |

#### Dialog Actions

| Dialog | Location | Actions Pattern | Issues |
|--------|----------|-----------------|--------|
| Create User | `admin_users.html` | ✅ `.md3-dialog__actions` | OK |
| Invite Link | `admin_users.html` | ⚠️ Single filled button | Should have secondary |
| User Detail | `admin_users.html` | ✅ Text + outlined | OK |
| Delete Account | `account_profile.html` | ✅ Text + filled danger | OK |

#### Page Templates

| Template | Actions Pattern | Issues |
|----------|-----------------|--------|
| `editor_overview.html` | N/A (table action buttons) | Per-row edit links |
| `atlas.html` | No actions | OK - display only |
| `admin_dashboard.html` | No actions | OK - display only |
| `search/advanced.html` | ✅ Toolbar with outlined+filled | Good reset/search pattern |

### 2.3 Lists & Tables

**Existing Table Styles:**

1. **`layout.css`** - Basic `.md3-table`:
   - Width 100%, collapse borders
   - Simple padding, bottom border
   - **Missing:** hover, selected, empty states

2. **`editor-overview.css`** - `.md3-files-table`:
   - More complete styling
   - Has hover state on `tbody tr`
   - Shadow, rounded corners
   - **Custom, not reusing `.md3-table`**

3. **`admin_users.html`** - User list table:
   - Uses `.md3-table` class
   - Columns: Username, Email, Role, Status, Created, Actions
   - Role/status shown with badges
   - **Missing:** Empty state when no users

**Tables Inventory:**

| Location | Class Used | Has Hover | Has Selected | Has Empty State |
|----------|-----------|-----------|--------------|-----------------|
| `admin_users.html` | `.md3-table` | ❌ | ❌ | ⚠️ JS only |
| `editor_overview.html` | `.md3-files-table` | ✅ | ❌ | ✅ |
| `search/advanced.html` | DataTables | Custom | N/A | ✅ |

### 2.4 States (Focus, Hover, Disabled, Selected)

**Buttons - Current State:**
- ✅ Hover: All variants have hover states
- ✅ Focus: `outline: 2px solid` with `outline-offset: 2px`
- ✅ Disabled: Reduced opacity (0.38), `cursor: not-allowed`

**Tables - Current State:**
- ⚠️ Hover: Only in `editor-overview.css`, not in base `.md3-table`
- ❌ Selected: No `.is-selected` class defined
- ❌ Disabled rows: No styling

**Links:**
- ⚠️ Focus states vary by component

### 2.5 Feedback Components

#### Snackbar/Toast

**Current Implementations:**

1. **`snackbar.css`** - Canonical MD3 Snackbar:
   - Fixed position bottom-center
   - Variants: `--success`, `--error`, `--info`
   - Transition animation
   - Responsive for mobile
   - **NOT actively used in most templates!**

2. **Player custom snackbar** (`tokens.js`):
   - Uses `.copy-snackbar` class
   - Custom inline styling
   - **Inconsistent with MD3 pattern**

3. **Auth forms**:
   - Use `.md3-alert` inline, not snackbar
   - Status via `.md3-form-status` container

**Flash Messages:**
- `base.html` prepares `data-flash-messages` but no JS consumption found
- Login page uses inline alerts, not snackbars

#### Loading States

**Current CSS (`progress.css`):**
```css
.md3-linear-progress { height: 4px; /* basic animation */ }
```

**Usage:**
- `search/advanced.html` references `#search-progress` for htmx indicator
- No button loading states defined
- No full-page loading overlay

#### Empty States

**Current Pattern (`editor-overview.css`, `_results.html`):**
```html
<div class="md3-empty-state">
  <span class="material-symbols-rounded md3-empty-state__icon">icon</span>
  <p class="md3-empty-state__text">Title</p>
  <p class="md3-empty-state__hint">Hint text</p>
</div>
```

**Issues:**
- Styling only in `editor-overview.css` (198-214)
- Not defined centrally
- No primary action button pattern

### 2.6 Icons & Badges

#### Role Badges (top-app-bar.css)

**Current Mapping:**
- `.md3-badge--role-admin` → error color (16% mix)
- `.md3-badge--role-editor` → primary color (16% mix)
- `.md3-badge--role-user` → secondary color (16% mix)

**Admin Users Table (`admin_users.js`):**
- Role: `<span class="md3-badge md3-badge--small">${user.role}</span>`
- Status: `<span class="md3-badge ${user.is_active ? 'md3-badge--success' : 'md3-badge--error'}">`

**Issues:**
- No icon mapping defined (admin=shield?, editor=edit?)
- `.md3-badge--success` and `.md3-badge--error` not defined in CSS!
- `.md3-badge--small` not defined

#### Status Badges

**Expected but Missing:**
- `.md3-badge--status-active`
- `.md3-badge--status-inactive`
- `.md3-badge--status-error`

### 2.7 Responsiveness

**Breakpoints Found:**
- `snackbar.css`: `@media (max-width: 600px)`
- `alerts.css`: `@media (max-width: 480px)`
- Various other components use inconsistent breakpoints

**Button Stacking:**
- `.md3-actions` uses flexbox, no mobile override
- Dialog actions may overflow on narrow screens

---

## 3. Templates by Area

### 3.1 Auth Templates (DO NOT change logic)

| File | Components |
|------|------------|
| `auth/login.html` | Form, filled button, text link, inline alert |
| `auth/account_profile.html` | 3 cards, forms, danger zone, delete dialog |
| `auth/account_password.html` | Form, text+filled actions |
| `auth/account_delete.html` | Form, danger button |
| `auth/password_forgot.html` | Form, text+filled actions |
| `auth/password_reset.html` | Form, single filled button |
| `auth/admin_users.html` | Table, toolbar, 3 dialogs, badges |

### 3.2 Special Pages (NO CODE CHANGES except sidebar)

| File | Notes |
|------|-------|
| `pages/player.html` | Player sidebar with cards, buttons - **sidebar can be modified** |
| `pages/editor.html` | Editor sidebar with status, buttons - **sidebar can be modified** |

### 3.3 Standard Pages

| File | Components |
|------|------------|
| `pages/editor_overview.html` | Country tabs, file table, empty state |
| `pages/atlas.html` | Map, selects, tabs |
| `pages/admin_dashboard.html` | Metric cards, details |
| `search/advanced.html` | Tabs, forms, DataTables (no visual changes) |

---

## 4. Priority Recommendations

### High Priority (Foundation)
1. Create central badge styles with status variants
2. Extend `.md3-table` with hover/selected states
3. Centralize empty state CSS
4. Unify snackbar usage across app

### Medium Priority (Consistency)
5. Add missing badge variants (`--success`, `--error`, `--small`)
6. Define icon mapping for roles
7. Add loading button state pattern
8. Responsive button stacking

### Low Priority (Polish)
9. Migrate editor custom buttons to canonical classes
10. Player sidebar button unification
11. Remove legacy button aliases

---

## 5. Next Steps

1. ✅ Create `docs/md3-goldstandard/01-buttons.md` - Button specs
2. Create `docs/md3-goldstandard/02-tables.md` - Table specs
3. Create `docs/md3-goldstandard/03-feedback.md` - Snackbar/Loading/Empty
4. Create `docs/md3-goldstandard/04-badges.md` - Icons & Badges
5. Create `docs/md3-goldstandard/05-responsiveness.md` - Responsive rules
6. Implement CSS changes in small commits
7. Update templates to use canonical patterns
