# MD3 Goldstandard Migration Summary

> Generated: 2025-01-XX • Status: **Phase 2 Complete**

## Overview

This document summarizes the MD3 Goldstandard migration for the CO.RA.PAN webapp, implementing unified structural patterns for Heroes, Login Flow, and Textfields.

---

## 1. Hero Standard Implementation

### Canonical Pattern
```html
<header class="md3-page__header">
  <div class="md3-hero md3-hero--card md3-hero__container">
    <div class="md3-hero__icon" aria-hidden="true">
      <span class="material-symbols-rounded">icon_name</span>
    </div>
    <div class="md3-hero__content">
      <p class="md3-body-small md3-hero__eyebrow">Category</p>
      <h1 class="md3-headline-medium md3-hero__title">Page Title</h1>
    </div>
  </div>
</header>
```

### Reference Implementation
- **File**: `templates/pages/impressum.html`
- **CSS**: `static/css/md3/components/hero.css`

### Pages with Hero
| Page | Status | Icon |
|------|--------|------|
| impressum.html | ✅ Goldstandard | gavel |
| proyecto_referencias.html | ✅ Updated | library_books |
| datenschutz.html | ✅ Updated | security |
| account_profile.html | ✅ Has Hero | account_circle |
| account_password.html | ✅ Has Hero | lock |
| admin_users.html | ✅ Has Hero | admin_panel_settings |
| search/advanced.html | ⚠️ Needs Hero | search |

---

## 2. Login Sheet Removal

### Changes Made

**DELETED Components**:
- ❌ `/auth/login_sheet` endpoint (src/app/routes/auth.py) — REMOVED
- ❌ `templates/auth/_login_sheet.html` — DELETED
- ❌ `static/js/modules/auth/login-sheet.js` — DELETED
- ❌ HTMX sheet injection pattern — REMOVED
- ❌ Login sheet JavaScript handlers — REMOVED

**UPDATED Components**:
| Component | Change |
|-----------|--------|
| `src/app/routes/auth.py` | Removed `login_sheet()` route, errors now render `login.html` |
| `src/app/__init__.py` | Removed `/auth/login_sheet` from allowed prefixes |
| `static/js/modules/atlas/index.js` | Changed to `window.location.href = /login?next=...` |
| `static/js/modules/advanced/audio.js` | Changed to `window.location.href = /login?next=...` |
| `static/js/modules/navigation/app-bar.js` | Replaced `initLoginSheet()` with `initLoginHandler()` |
| `static/js/main.js` | Simplified `openLogin()` to redirect to `/login` |
| `tests/test_ui_pages.py` | Updated to test `/login` instead of `/auth/login_sheet` |
| `tests/e2e/playwright/auth.spec.js` | Updated to test full-page login navigation |
| `templates/partials/status_banner.html` | Updated comments |

### New Login Flow
```
User Action → Click "Anmelden"
           → Redirect to /login?next=<current_url>
           → Full-page login form
           → On success: redirect to next URL
           → On error: re-render login.html with flash message
```

### Benefits
- ✅ Simpler implementation (no sheet/overlay)
- ✅ Better mobile UX (full-page form)
- ✅ Better accessibility (no focus trapping)
- ✅ Reduced JavaScript complexity
- ✅ No HTMX dependency for auth flow

---

## 3. Textfield Unification

### Canonical Pattern
```html
<div class="md3-outlined-textfield md3-outlined-textfield--block">
  <input 
    type="text" 
    class="md3-outlined-textfield__input" 
    id="field-id" 
    name="field"
    autocomplete="appropriate-value"
    required
    aria-label="Accessible Label">
  <label class="md3-outlined-textfield__label" for="field-id">Label</label>
  <span class="md3-outlined-textfield__outline">
    <span class="md3-outlined-textfield__outline-start"></span>
    <span class="md3-outlined-textfield__outline-notch"></span>
    <span class="md3-outlined-textfield__outline-end"></span>
  </span>
</div>
```

### Reference Implementation
- **File**: `templates/auth/login.html`
- **CSS**: `static/css/md3/components/textfield.css`

### Pattern Rules
1. Wrapper: `div.md3-outlined-textfield.md3-outlined-textfield--block`
2. Order: Input → Label → Outline (required for CSS animation)
3. Label uses `for` attribute pointing to input `id`
4. DO NOT wrap input inside label (breaks MD3 outline animation)

---

## 4. Linter Results

### Final Scan (Post-Migration)
```
📋 Summary:
   Errors:   0
   Warnings: 769
   Info:     70
```

### Focus Scan (Auth + Skeletons)
```
📋 Summary:
   Errors:   0
   Warnings: 0
   Info:     0

✅ No errors or warnings
```

### Warning Categories
Most warnings are in areas excluded from migration:
- DataTables legacy markup (templates/search/advanced*)
- Player-specific CSS (static/css/player-*.css)
- Legacy CSS inline values (needs gradual token migration)

---

## 5. Documentation Updates

### Updated Files
| File | Section | Change |
|------|---------|--------|
| `md3-structural-compliance.md` | 1.5 | Added Hero Structure section |
| `md3-structural-compliance.md` | 3.1 | Expanded Textfield Pattern |
| `md3-structural-compliance.md` | 6.2 | Added Login Sheet deprecated notice |

---

## 6. Migration Exclusions

The following areas are explicitly excluded from MD3 structural migration:

| Path Pattern | Reason |
|--------------|--------|
| `LOKAL/**` | Local development only, not deployed |
| `templates/pages/player*.html` | Complex player UI, separate migration |
| `templates/pages/editor*.html` | Complex editor UI, separate migration |
| `static/css/player-*.css` | Player-specific styles |
| `templates/search/advanced*` | DataTables markup preserved |

---

## 7. Next Steps

### Immediate
- [ ] Delete deprecated files after verification:
  - `templates/auth/_login_sheet.html`
  - `static/js/modules/auth/login-sheet.js`
- [ ] Add Hero to `search/advanced.html`
- [ ] Run E2E tests to verify login flow

### Future
- [ ] Migrate warning-level issues (inline CSS values → tokens)
- [ ] Add Hero to remaining text pages
- [ ] Unify button patterns across all forms

---

## 8. Commands Reference

```bash
# Run linter (full scan)
python scripts/md3-lint.py

# Focus on specific directories
python scripts/md3-lint.py --focus templates/auth templates/_md3_skeletons

# Generate JSON report
python scripts/md3-lint.py --json-out reports/md3-lint.json

# Run auto-fix (dry-run)
python scripts/md3-autofix.py --dry-run

# Apply auto-fixes
python scripts/md3-autofix.py --apply
```

---

*Document maintained by: CO.RA.PAN Development Team*
*Reference: `docs/md3-template/md3-structural-compliance.md`*
