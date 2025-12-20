# CO.RA.PAN Application Specification

> **Project-Specific MD3 Layer for CO.RA.PAN Webapp**  
> Version 3.0 — Extensions and customizations on top of the core MD3 spec.

---

## 1. Token Customization

### 1.1 App-Specific Tokens

Defined in `static/css/app-tokens.css`:

```css
:root {
  /* Page background (uses surface-container-lowest for card contrast) */
  --app-background: var(--md-sys-color-surface-container-lowest);
  
  /* Textfield label background inheritance */
  --app-textfield-label-bg: var(--md-sys-color-surface);
  
  /* Mobile menu animation */
  --app-mobile-menu-duration: 250ms;
  
  /* Success color (not in standard MD3) */
  --app-color-success: #1b5e20;
  --app-color-on-success: #ffffff;
  --app-color-success-container: #bdfcc9;
}
```

### 1.2 Token Values (Production)

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| `--md-sys-color-primary` | `#0a5981` | `#8ecef4` |
| `--md-sys-color-on-primary` | `#ffffff` | `#003548` |
| `--md-sys-color-surface` | `#fafafa` | `#1a1a1a` |
| `--md-sys-color-error` | `#ba1a1a` | `#ffb4ab` |

### 1.3 Textfield Label Background

Textfield floating labels need a background color matching their container. This is handled via inheritance:

```css
/* Container sets the token */
.md3-card {
  --app-textfield-label-bg: var(--_card-bg);
}

/* Textfield label inherits */
.md3-outlined-textfield__label {
  background: var(--app-textfield-label-bg, var(--md-sys-color-surface));
}
```

**Containers that set this token:**
- `.md3-card` variants
- `.md3-dialog__surface`
- `.md3-sheet__surface`
- `.md3-auth-card`
- `.md3-search-card`

---

## 2. Custom Components

### 2.1 Landing Cards

Used on the index page for feature navigation:

```html
<article class="md3-card md3-card--filled md3-card--landing">
  <div class="md3-card__content">
    <span class="material-symbols-rounded md3-index-card__icon" aria-hidden="true">icon</span>
    <h2 class="md3-title-large md3-index-card__title">Title</h2>
    <p class="md3-body-large md3-index-card__text">Description</p>
  </div>
  <footer class="md3-card__footer md3-card__actions">
    <a href="/path" class="md3-button md3-button--filled">
      <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">arrow_forward</span>
      Action
    </a>
  </footer>
</article>
```

**Features:**
- Uses `--md-sys-color-surface-container-high` (matches Hero brightness)
- Flex layout pushes buttons to bottom
- Defined in `components/cards.css`

### 2.2 Auth Card

Specialized card for authentication forms:

```html
<article class="md3-card md3-card--outlined md3-auth-card">
  <header class="md3-card__header">
    <h2 class="md3-title-large">Section Title</h2>
  </header>
  <div class="md3-card__content">
    <form class="md3-auth-form">
      <!-- Form fields -->
    </form>
  </div>
</article>
```

**Classes:**
- `.md3-auth-card` – Width constraints, centering
- `.md3-auth-form` – Form-specific spacing (12px gaps)
- `.md3-auth-page` – Page section wrapper

### 2.3 Corpus Page

Search/results page with special layout:

```html
<div class="md3-corpus-page">
  <section class="md3-corpus-content">
    <!-- Search form, tabs, results -->
  </section>
</div>
```

**Classes:**
- `.md3-corpus-page` – Edge padding by breakpoint
- `.md3-corpus-content` – Search panel container
- `.md3-corpus-table-container` – DataTables wrapper
- `.md3-corpus-stats` – Statistics grid

### 2.4 Search Card

Tonal card for search interfaces:

```html
<div class="md3-search-card">
  <div class="md3-search-card__section">
    <h2 class="md3-search-card__heading">Filters</h2>
    <!-- Filter fields -->
  </div>
</div>
```

---

## 3. Page Types

### 3.1 Public Pages (Spanish)

| Page | Template | Language |
|------|----------|----------|
| Index | `pages/index.html` | ES |
| Atlas | `pages/atlas.html` | ES |
| Corpus Search | `search/advanced.html` | ES |
| Proyecto | `pages/proyecto_*.html` | ES |
| Corpus Guide | `pages/corpus_guia.html` | ES |

### 3.2 Internal Pages (German)

| Page | Template | Language |
|------|----------|----------|
| Profile | `auth/account_profile.html` | DE |
| Password Change | `auth/account_password.html` | DE |
| Account Delete | `auth/account_delete.html` | DE |
| User Management | `auth/admin_users.html` | DE |
| Admin Dashboard | `pages/admin_dashboard.html` | DE |
| Impressum | `pages/impressum.html` | DE |
| Privacy | `pages/privacy.html` | DE |

### 3.3 Auth Pages (Spanish/Neutral)

| Page | Template | Language |
|------|----------|----------|
| Login | `auth/login.html` | ES |
| Password Forgot | `auth/password_forgot.html` | ES |
| Password Reset | `auth/password_reset.html` | ES |

**Neutral Terms:** "Login" and "Logout" are never translated.

---

## 4. Hero Conventions

### 4.1 Icon Selection

| Page Type | Icon |
|-----------|------|
| Profile | `account_circle` |
| Password | `lock_reset` |
| Delete | `delete_forever` |
| Users | `group` |
| Login | `login` |
| Forgot Password | `mail` |
| Legal | `gavel` |
| Project | `assignment_globe` |
| Corpus | `search_insights` |
| Atlas | `globe_location_pin` |

### 4.2 Eyebrow Categories

| German | Spanish |
|--------|---------|
| Konto | Cuenta |
| Admin | Admin |
| Rechtliche Informationen | — |

---

## 5. Excluded Areas (Custom Components)

These areas intentionally deviate from standard MD3:

### 5.1 DataTables

- Third-party library with custom overrides
- Uses `!important` where necessary (documented with `NEEDS_IMPORTANT` comments)
- Styles in `components/datatables.css` and `datatables-theme-lock.css`

### 5.2 Audio Player

- Custom waveform/spectrogram visualization
- Play controls with non-standard styling
- Defined in `components/audio-player.css`

### 5.3 Transcript Editor

- Real-time editing with word selection
- Speaker assignment panels
- Defined in `components/editor.css`

**Rule:** Only the sidebar/card containers in these areas follow MD3. Internal controls are custom.

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Drawer |
|------------|-------|--------|
| Compact | 0–599px | Modal |
| Medium | 600–839px | Modal |
| Expanded | 840–1199px | Standard (280px) |
| Large | 1200px+ | Standard (280px) |

### 6.1 Edge Padding

| Breakpoint | Padding |
|------------|---------|
| Compact | 16px |
| Medium | 24px |
| Expanded | 32px |

### 6.2 Index Page Exception

The index page hides the drawer and hamburger menu:

```css
body[data-page="index"] .md3-top-app-bar__navigation-icon {
  display: none !important; /* NEEDS_IMPORTANT: app-shell override */
}

body[data-page="index"] #navigation-drawer {
  display: none !important; /* NEEDS_IMPORTANT: app-shell override */
}
```

---

## 7. Special Patterns

### 7.1 Danger Zone Cards

For destructive actions (account deletion):

```html
<article class="md3-card md3-card--outlined card-outlined--danger md3-auth-card">
  <header class="md3-card__header">
    <h2 class="md3-title-large" style="color: var(--md-sys-color-error)">Gefahrenzone</h2>
  </header>
  <!-- ... -->
</article>
```

### 7.2 Back Links in Heroes

```html
<div class="md3-hero md3-hero--card md3-hero__container">
  <a href="/previous" class="md3-hero__back-link">
    <span class="material-symbols-rounded">arrow_back</span>
    Zurück
  </a>
  <!-- Hero content -->
</div>
```

### 7.3 Password Toggle

```html
<div class="md3-outlined-textfield md3-outlined-textfield--block">
  <input type="password" id="password" class="md3-outlined-textfield__input">
  <label class="md3-outlined-textfield__label" for="password">Password</label>
  <button type="button" class="md3-outlined-textfield__icon--trailing" data-toggle="password">
    <span class="material-symbols-rounded" aria-hidden="true">visibility</span>
  </button>
  <!-- outline -->
</div>
```

---

## 8. Form Patterns

### 8.1 Auth Form

```html
<form class="md3-auth-form" novalidate>
  <div class="md3-outlined-textfield md3-outlined-textfield--block">
    <!-- textfield -->
  </div>
  
  <div class="md3-actions">
    <a href="/cancel" class="md3-button md3-button--text">Cancel</a>
    <button type="submit" class="md3-button md3-button--filled">
      <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">save</span>
      Save
    </button>
  </div>
</form>
```

### 8.2 Dialog with Form

```html
<dialog class="md3-dialog" aria-modal="true" aria-labelledby="dialog-title">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <h2 id="dialog-title" class="md3-title-large md3-dialog__title">Title</h2>
      </header>
      <div class="md3-dialog__content md3-stack--dialog">
        <p class="md3-body-medium">Introduction text</p>
        <div class="md3-outlined-textfield md3-outlined-textfield--block">
          <!-- textfield -->
        </div>
      </div>
      <div class="md3-dialog__actions">
        <button class="md3-button md3-button--text" id="cancel">Cancel</button>
        <button class="md3-button md3-button--filled" id="confirm">Confirm</button>
      </div>
    </div>
  </div>
</dialog>
```

---

## 9. CSS Organization

### 9.1 File Structure

```
static/css/md3/
├── tokens.css           # Core tokens (colors, spacing, elevation)
├── typography.css       # Type scale classes
├── layout.css          # Page structure, stacks, grids
└── components/
    ├── buttons.css
    ├── textfields.css
    ├── cards.css
    ├── dialog.css
    ├── alerts.css
    ├── hero.css
    ├── navigation.css
    ├── auth.css         # Auth-specific layouts
    ├── login.css        # Login page
    ├── corpus.css       # Corpus search page
    ├── search-ui.css    # Search components
    ├── datatables.css   # DataTables overrides
    ├── datatables-theme-lock.css
    ├── editor.css       # Transcript editor
    ├── index.css        # Index page
    └── text-pages.css   # Text content pages
```

### 9.2 App Tokens

```
static/css/
└── app-tokens.css      # App-specific token extensions
```

---

## 10. Testing Checklist

Before deployment, verify:

- [ ] All pages pass `md3-lint.py`
- [ ] All forms pass `md3-forms-auth-guard.py`
- [ ] Dark mode displays correctly
- [ ] Mobile breakpoints work
- [ ] Language is correct (ES public, DE internal)
- [ ] DataTables render properly
- [ ] Audio player functions
- [ ] Editor works (if applicable)
