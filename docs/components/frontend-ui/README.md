# frontend-ui Component

**Purpose:** Templates, static assets, MD3 design system implementation.

**Scope:** All user-facing UI (HTML templates, CSS, JavaScript). Does NOT include backend logic (see other components).

---

## Responsibility

1. **Templates** - Jinja2 templates for all pages
2. **MD3 Design System** - Material Design 3 tokens, components, theme system
3. **Static Assets** - CSS, JavaScript, fonts, images
4. **Frontend JavaScript** - Client-side interactivity (no backend code)
5. **Responsive Layout** - Mobile-first design with drawer navigation

---

## Key Files

| Path | Purpose |
|------|---------|
| `templates/base.html` | Base template (navbar, drawer, footer, MD3 setup) |
| `templates/games/quiz/` | Quiz templates (list, entry, play) |
| `templates/auth/` | Auth templates (login, register, admin) |
| `templates/pages/` | Static pages (index, about, etc.) |
| `static/css/md3/tokens.css` | MD3 color/typography tokens (canonical) |
| `static/css/app-tokens.css` | App-specific token overrides |
| `static/css/branding.css` | Brand-specific color overrides |
| `static/css/md3/components/` | MD3 component styles (buttons, cards, forms, etc.) |
| `static/js/main.js` | Main JavaScript entry point |
| `static/js/modules/` | Reusable JS modules |

---

## MD3 Design System

**Canonical Token API:**
- **Colors:** `--md-sys-color-*` (primary, secondary, tertiary, surface, error)
- **Typography:** `--md-sys-typescale-*` (headline, body, label)
- **Spacing:** `--space-{1,2,3,4,5,6,8,10,12}` (4px to 48px)
- **Shape:** `--radius-{xs,sm,md,lg,xl,full}`
- **Elevation:** `--elev-{0,1,2,3,4,5}`

**Legacy Tokens:** `--md3-*` names exist in `tokens-legacy-shim.css` (temporary, do NOT use in new code).

### Token Files (Load Order)

1. `tokens.css` - MD3 canonical tokens (--md-sys-*, --space-*)
2. `app-tokens.css` - App overrides (e.g., --app-background)
3. `branding.css` - Brand colors (e.g., --app-brand-primary)
4. `tokens-legacy-shim.css` - Legacy aliases (--md3-*) for backward compatibility

**Rule:** ALWAYS use `--md-sys-*` and `--space-*` in new code. Legacy `--md3-*` tokens are deprecated.

### MD3 Components

**Location:** `static/css/md3/components/`

| Component | Purpose |
|-----------|---------|
| `buttons.css` | Filled, outlined, text buttons |
| `cards.css` | Elevated, filled, outlined cards |
| `forms.css` | Form layouts, fieldsets |
| `textfields.css` | Text inputs, labels, floating labels |
| `alerts.css` | Success, error, warning, info alerts |
| `snackbar.css` | Toast notifications |
| `dialog.css` | Modal dialogs |
| `navbar.css` | Top app bar |
| `navigation-drawer.css` | Sidebar navigation |
| `footer.css` | Page footer |
| `hero.css` | Hero sections |
| `layout-helpers.css` | Flexbox/grid utilities |

---

## Template Structure

**Base Template:** `templates/base.html`
- Loads MD3 tokens + components
- Navbar + drawer navigation
- Theme toggle (light/dark)
- Footer
- Flash messages
- HTMX integration

**Child Templates:**
```jinja2
{% extends "base.html" %}
{% block title %}Page Title{% endblock %}
{% block content %}
  <!-- Page content here -->
{% endblock %}
```

**Template Directories:**
- `templates/auth/` - Login, register, admin_users
- `templates/games/quiz/` - Quiz pages
- `templates/pages/` - Static pages (index, about)
- `templates/errors/` - Error pages (404, 500)
- `templates/partials/` - Reusable components (navbar, footer)

---

## CSS Architecture

**Global Styles:**
- `layout.css` - Base layout, typography, utilities
- `md3/tokens.css` - MD3 color/typography tokens
- `app-tokens.css` - App overrides (--app-background, etc.)
- `branding.css` - Brand colors

**Component Styles:**
- `md3/components/*.css` - MD3 components (buttons, cards, forms)
- `md3/typography.css` - MD3 typography scale
- `md3/layout.css` - MD3 layout utilities

**Module Styles:**
- `game_modules/quiz/styles/quiz.css` - Quiz-scoped styles

**Naming Convention:**
- **Tokens:** `--md-sys-color-*`, `--space-*`
- **Components:** `.md3-button`, `.md3-card`, `.md3-textfield`
- **Utilities:** `.flex`, `.gap-4`, `.text-center`

---

## JavaScript Architecture

**Entry Point:** `static/js/main.js`

**Modules:**
- `api.js` - API client (fetch wrapper)
- `theme.js` - Theme toggle (light/dark)
- `navigation-drawer-init.js` - Drawer initialization
- `modules/snackbar.js` - Toast notifications
- `modules/dialog.js` - Modal dialogs
- `auth/admin_users.js` - Admin user management
- `games/quiz/quiz-game.js` - Quiz game state
- `games/quiz/quiz-timer.js` - Quiz timer

**Pattern:** ES6 modules, no bundler (native browser imports).

---

## Theme System

**Supported Themes:**
- `light` (default)
- `dark`
- `auto` (respects system preference)

**Storage:** `localStorage.theme` (light/dark/auto)

**Implementation:**
- `static/js/theme.js` - Theme initialization (runs inline in `<head>`)
- `static/js/theme-toggle.js` - Theme toggle button

**CSS Variables:**
```css
:root[data-theme="light"] {
  --md-sys-color-primary: #276D7B;
  --md-sys-color-background: #D4DFE4;
}

:root[data-theme="dark"] {
  --md-sys-color-primary: #83D0E0;
  --md-sys-color-background: #041317;
}
```

---

## Responsive Design

**Breakpoints:**
- Mobile: `< 600px`
- Tablet: `600px - 1024px`
- Desktop: `> 1024px`

**Mobile-First:** Base styles for mobile, progressively enhanced for larger screens.

**Navigation:**
- Mobile: Drawer (hamburger menu)
- Desktop: Top navbar + drawer

---

## Static Assets

**Location:** `static/`

| Directory | Purpose |
|-----------|---------|
| `css/` | Stylesheets (MD3, app styles) |
| `js/` | JavaScript (modules, main.js) |
| `fonts/` | Custom fonts |
| `img/` | Images (favicon, logos) |
| `quiz-media/` | Quiz-specific media |
| `vendor/` | Third-party libraries (htmx, etc.) |

---

## Related Components

- **[app-core](../app-core/)** - Flask app (serves templates)
- **[quiz](../quiz/)** - Quiz templates + JavaScript
- **[auth](../auth/)** - Auth templates

---

**See Also:**
- Base Template: [../../../templates/base.html](../../../templates/base.html)
- MD3 Tokens: [../../../static/css/md3/tokens.css](../../../static/css/md3/tokens.css)
- Main JavaScript: [../../../static/js/main.js](../../../static/js/main.js)
- Main README: [../../README.md](../../README.md)
