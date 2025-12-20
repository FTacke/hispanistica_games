# MD3-Designsystem – Bestandsaufnahme

⚠️ Ziel: vollständige, faktische Dokumentation des aktuellen MD3-Systems der Codebasis (Ist‑Zustand).

## 1. Überblick

Kurzfassung
- Die Codebasis verwendet ein zentralisiertes, CSS‑variablen‑basiertes MD3‑Token‑System unter `static/css/md3/tokens.css`.
- Aufbau: tokens.css (Farb-, Typografie-, Spacing-, Shape-/Elevation‑Tokens) → typography.css → layout.css → komponentenspezifische CSS unter `static/css/md3/components/*`.
- Die Templates (z. B. `templates/base.html`, `templates/partials/*`, `templates/pages/*`) verwenden wiederkehrende `md3-` Klassen und component‑blocks. Die wichtigste Integration ist in `templates/base.html`.

Wichtige Dateien (Quelle der Wahrheit)
- `static/css/md3/tokens.css` — zentrale Token-Definitionen (Light/Dark)
- `static/css/md3/typography.css` — tokens → text utility classes (md3-display-*, md3-title-*, md3-body-*)
- `static/css/md3/layout.css` — allgemeine Layout-Utilities, grid and helpers
- `static/css/md3/components/` — konkrete Komponentenimplementierungen (buttons, textfields, dialogs, top-app-bar, navigation-drawer, cards, chips, etc.)
- `static/css/app-tokens.css` — app-specific overrides (small)
- `templates/base.html` — Einbindung aller MD3 CSS Dateien / App Shell

---

## 2. Design Tokens

Quelle: `static/css/md3/tokens.css` (canonical) — zentral geladen über `templates/base.html`

### 2.1 Farben (Kernrollen)

Die Codebasis verwendet MD3-konforme Farbtokens `--md-sys-color-*` plus `--app-*` für kleine App-Overrides. Wichtige Kerntokens (Light theme / Dark theme in Datei):

Hauptfarben (Light mode sample values)
- `--md-sys-color-primary` : #0a5981
- `--md-sys-color-on-primary` : #ffffff
- `--md-sys-color-primary-container` : #91a0b1
- `--md-sys-color-on-primary-container` : #000000

Sekundär / Tertiär
- `--md-sys-color-secondary` : #095378
- `--md-sys-color-on-secondary` : #ffffff
- `--md-sys-color-tertiary` : #7d5260
- `--md-sys-color-on-tertiary` : #ffffff

Surface / Background / Outline
- `--md-sys-color-surface` : #ffffff
- `--md-sys-color-on-surface` : #1c1b1f
- `--md-sys-color-outline` : #79747e
- `--md-sys-color-outline-variant` : #cac4d0
- `--md-sys-color-background` : #c7d5d8
- `--app-background` : var(--md-sys-color-background)

Surface container tonal hierarchy (Light)
- `--md-sys-color-surface-container-lowest` — `--md-sys-color-surface-container-highest` (calculated via color-mix in tokens.css). These are used for tonal cards / backgrounds.

Error / Status
- `--md-sys-color-error`: #b3261e
- `--md-sys-color-on-error`: #ffffff

Extended palette (examples present in tokens.css — Light and Dark variants)
- `--md-sys-color-success, warning, info, neutral, rose, orange, lime, cyan, violet, purple, teal, brown, indigo, pink, gold, mint, slate, crimson` and paired `on-*`/`*-container` tokens.

Where defined: `static/css/md3/tokens.css` (entire set lives here; dark/light variants included)

### 2.2 Typografie

MD3 typescale tokens are canonical and applied via `typography.css`. The tokens follow the MD3 naming convention `--md-sys-typescale-<role>-<property>`.

Examples (in tokens.css):
- Base: `--md-sys-typescale-base-font-family` → "Roboto", "Noto Sans", system stacks
- Display Large: `--md-sys-typescale-display-large-font-size`: 57px; `-line-height`: 64px
- Headline / Title / Body / Label token groups exist (e.g. `--md-sys-typescale-title-medium-font-size`: 16px etc.)

Where applied: `static/css/md3/typography.css` defines classes like `.md3-display-large`, `.md3-title-medium`, `.md3-body-medium`, `.md3-label-large` that reference these tokens.

### 2.3 Spacing & Shape

Spacing tokens (root) — source: tokens.css:
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px

Shape / radii tokens
- `--radius-sm`: 8px
- `--radius-md`: 12px
- `--radius-lg`: 16px

Elevation tokens (box-shadow)
- `--elev-1`, `--elev-2`, `--elev-3` — box-shadow value strings defined in tokens.css.

Where used: spacing + shape tokens are used across layout.css and components to control paddings, gaps, border radii and shadows (e.g., cards, dialogs, buttons).

### 2.4 Other tokens / helpers

- `--md-typography-heading-accent` → references primary color
- `--app-background` → canonical site background (mapped to md-sys variant but available for app overrides in `static/css/app-tokens.css`)

---

## 3. Seiten- und Layoutstrukturen

Quelle/Key files: `templates/base.html`, `static/css/md3/layout.css`, `static/css/md3/components/hero.css`, `typography.css` and multiple `templates/pages/*` files.

### 3.1 Standard-Page-Layout

Global shell and layout
- `templates/base.html` defines the app shell: header (top app bar), aside (navigation drawer), main (#main-content) and footer.
- `main` contains `.md3-content-wrapper` which is the content container.

Primary page wrapper classes seen in templates
- `.md3-page`, `.md3-text-page`, `.md3-corpus-page`, `.md3-atlas-page`, `.app-shell` — used in different top-level pages to pick layout variants.

Top bar / Drawer layout and responsive behaviour
- `md3-top-app-bar` is fixed at top, changes to transparent on ≥ 840px (expanded) and removes burger icon there: `static/css/md3/components/top-app-bar.css` and `templates/partials/_top_app_bar.html`.
- `md3-navigation-drawer` has two modes: `md3-navigation-drawer--standard` (expanded permanently on large screens) and a dialog & modal drawer for compact/medium screens (`templates/partials/_navigation_drawer.html`). Drawer width: 280px (MD3 standard)

Safe page spacing & max width
- `.md3-container` / `.md3-content-wrapper` / `.md3-hero__container` and `.md3-card` use tokens: `max-width: 1200px` or component-specific containers (cards often limit to `max-w-600`).

Spacing rules (practical values; from layout.css)
- Page content horizontal padding: `padding: 0 1.5rem` for `.md3-container`.
- Default component gaps use `var(--space-3)` (12px) for intra-component spacing; forms use `--space-3` for `.md3-form` gaps.

Headings margins & alignment
- Hero / page header pattern uses `.md3-hero` → `.md3-hero__eyebrow` + `.md3-hero__title` + `.md3-hero__intro` (used across `templates/pages/*`, e.g. `pages/index.html`, `search/advanced.html`, `auth/*` pages).

Common page patterns and example templates
- Search pages: `templates/search/advanced.html`, `templates/search/_results.html` — uses `md3-corpus-page`, `md3-search-card`, `md3-outlined-textfield`, `md3-chip`, `md3-kwic-list`, `md3-kwic-item` etc.
- Account / Auth pages: `templates/auth/*` use `.md3-page` + `.md3-account-card` and `card-outlined` patterns.
- Admin / Dashboard: `templates/pages/admin_dashboard.html` uses `.md3-hero` + stat cards and `md3-card` layouts.

### 3.2 Content & repeated layout patterns (high-level inventory)
- Hero header (repeated): `.md3-hero`, `.md3-hero__title`, `.md3-hero__eyebrow`, `.md3-hero__intro` → `static/css/md3/components/hero.css`; templates under `templates/pages/`, `templates/search/advanced.html`.
- Search / corpus layout: `md3-corpus-page`, `md3-corpus-content`, `md3-corpus-filter-grid`, `md3-corpus-search-row` → `static/css/md3/components/forms.css` and `textfields.css`.
- Card patterns: `.card`, `.card-elevated`, `.card-outlined`, `.card-tonal-*`, `.md3-card__header`, `.md3-card__content` → `static/css/md3/components/cards.css` (used e.g. in account pages and admin pages).

---

## 4. Formulare & Eingabefelder

Key sources: `static/css/md3/components/textfields.css`, `components/forms.css`, `templates/search/advanced.html` (many examples), `templates/auth/*`.

Patterns found
- Outlined text fields (canonical in code): `.md3-outlined-textfield` (wrapper) with inner parts:
  - `.md3-outlined-textfield__input` (input/textarea/select)
  - `.md3-outlined-textfield__label` (floating label)
  - `.md3-outlined-textfield__outline`, `.md3-outlined-textfield__outline-start`, `__outline-notch`, `__outline-end` (outline parts)
  - Variants: `--flex`, `--fixed`, `--compact`, `--textarea`, `__input--select`, `__input--select[multiple]`

HTML structure (template example: `templates/search/advanced.html`):
```
<div class="md3-outlined-textfield md3-outlined-textfield--flex">
  <input class="md3-outlined-textfield__input" ...>
  <label class="md3-outlined-textfield__label">...</label>
  <div class="md3-outlined-textfield__outline"> ... outline pieces ...</div>
</div>
```

Tokens / states used
- Outline/default border color: `var(--md-sys-color-outline-variant)`
- Input focus color: `var(--md-sys-color-primary)` (focus border and label color)
- Label color: `var(--md-sys-color-on-surface-variant)`
- Spacing uses `--space-*` for paddings and gaps.

Validation states / accessibility
- Focus: `.md3-outlined-textfield__input:focus` changes outline border to `--md-sys-color-primary` and increases width in the outline pieces.
- Select multiple and responsive padding are handled by media queries in `textfields.css`.

Other form controls
- Checkboxes: `.md3-checkbox-container` is a local, custom MD3-like implementation (not official canonical MD3 checkbox component). The CSS is in `components/forms.css` with note that it's custom and needs canonical replacement.
- Inline checkboxes/radios and switches — project includes custom styles in `forms.css` and components specific to Corpus UI (see comments in file).

Where templates apply these patterns: `templates/search/advanced.html`, corpus forms, auth pages and admin pages.

---

## 5. Buttons

Source: `static/css/md3/components/buttons.css`

Variants implemented
- Filled / Contained: `.md3-button--filled` (primary filled button)
- Tonal: `.md3-button--tonal` (medium emphasis)
- Outlined: `.md3-button--outlined` (low emphasis, border-based)
- Text: `.md3-button--text` (lowest emphasis, compact paddings)
- Danger / Warning / Success variants: `.md3-button--danger`, `.md3-button--warning` (colors from tokens)
- Legacy compatibility aliases: `.md3-button--contained` (alias for filled)

Common structure
- Button markup commonly: `<button class="md3-button md3-button--filled|--outlined ...">` and (optionally) an icon + label:
  - `.md3-button__icon` (icons inside buttons, sized ~18px)
  - `.md3-button__label`

States and tokens
- All buttons use `--md-sys-color-*` tokens for background and `--md-sys-typescale-label-*` tokens for size and font-weight.
- Hover/active: use color-mix and `--elev-*` tokens to apply shadows.
- Disabled: `.md3-button--disabled` or `:disabled` sets opacity and disables pointer events.

Examples in templates
- `templates/search/_results.html` — pagination buttons using `.md3-button--outlined`, `.md3-button--disabled` etc.
- `templates/search/advanced.html` — `.md3-button--filled` for search submit, `.md3-button--outlined` for reset, `.md3-button__icon` usage.

---

## 6. Dialoge / Modale

Source: `static/css/md3/components/dialog.css` and use in `templates/search/advanced.html` (CQL guide example)

Dialog types & structure
- Standard modal dialog (native `<dialog>` used in some places): `.md3-dialog` with internal structure:
  - `.md3-dialog__container` (inner wrapper)
  - `.md3-dialog__header` → `.md3-dialog__title`, `.md3-dialog__icon`
  - `.md3-dialog__content` → main body
  - `.md3-dialog__actions` → action row (close, confirm buttons)

Variants
- `md3-dialog--large` → wider, used for CQL guide
- `md3-dialog--error` → title color uses `--md-sys-color-error`

Behaviour & accessibility
- Backdrop: `.md3-dialog::backdrop` styling exists (semi-transparent and blur)
- Dialog open state uses `[open]` attribute (native `<dialog>`), transform scaling feedback for entrance.

Examples
- In `templates/search/advanced.html` the CQL guide uses `md3-dialog md3-dialog--large` with actions (text + filled buttons).

Design rules — canonical dialog pattern (applies to ALL dialogs)
- Structure (must be used everywhere):
   - `<dialog class="md3-dialog" aria-modal="true" aria-labelledby="…">`
      - `.md3-dialog__container` (inner wrapper)
         - `.md3-dialog__surface`
            - `.md3-dialog__header` — contains title / icon
            - `.md3-dialog__content` — body (use `md3-body-medium` for main text)
            - `.md3-dialog__actions` — action row (buttons)

- Surface / colors
   - Dialog surfaces must use a neutral surface token (not page-specific/brand card colors):
      - `background: var(--md-sys-color-surface-container-high)`
   - Do not use page / card classes (e.g. `md3-auth-card` or `md3-auth-dialog__surface`) on dialog surfaces.

- Typography
   - Title: `h2.md3-title-large.md3-dialog__title` — color: `var(--md-sys-color-primary)`
   - Body text inside `.md3-dialog__content`: use `md3-body-medium` with `color: var(--md-sys-color-on-surface)`
   - Meta / hint text (small): `md3-body-small md3-text-variant` → `color: var(--md-sys-color-on-surface-variant)`

- Spacing & sizing
   - `.md3-dialog__surface` padding: 24px top/bottom, 24px left/right (`--space-6` tokens). Larger screens may use slightly larger left/right padding.
   - Max width: 480–560px (default 560px), responsive to small devices (`width: 100%` constrained by container).
   - Use `.md3-stack--dialog` inside `.md3-dialog__content` for intra-dialog spacing (16px gap) — avoid large page-section classes inside dialogs.
   - Actions row is right-aligned, no heavy top divider (keep visual separation by padding only).

- Code blocks & icon-actions (special case: invite links, tokens)
   - Use a dialog-specific helper row: `.md3-dialog__code-row` as a flex row with gap and left-anchored code block + right icon button.
   - Code block styling: `background: var(--md-sys-color-surface-container-low); padding: var(--space-4); border-radius: var(--radius-md)`

Example — standard dialog with code row (invite link)
```html
<dialog class="md3-dialog" aria-modal="true" aria-labelledby="invite-title">
   <div class="md3-dialog__container">
      <div class="md3-dialog__surface">
         <header class="md3-dialog__header">
            <h2 id="invite-title" class="md3-title-large md3-dialog__title">Benutzer angelegt</h2>
         </header>

         <div class="md3-dialog__content md3-stack--dialog">
            <p class="md3-body-medium">Bitte sende diesen Link an den neuen Benutzer:</p>

            <div class="md3-dialog__code-row md3-code-block">
               <pre class="md3-code-block__content">https://example.com/auth/password/reset?token=...</pre>
               <button class="md3-icon-button" title="Kopieren" aria-label="Invite-Link kopieren">…</button>
            </div>

            <p class="md3-body-small md3-text-variant">Gültig bis: …</p>
         </div>

         <div class="md3-dialog__actions">
            <button class="md3-button md3-button--filled">Schließen</button>
         </div>
      </div>
   </div>
</dialog>
```

---

## 7. Navigation

Top App Bar (source files: `static/css/md3/components/top-app-bar.css`, template `templates/partials/_top_app_bar.html`)
- Class: `.md3-top-app-bar` (fixed, z-index and adaptive transparency)
- Structure: `.md3-top-app-bar__row` → left `.md3-top-app-bar__navigation-icon` (burger), center `.md3-top-app-bar__title` (two stacked titles `.md3-top-app-bar__title-site` + `.md3-top-app-bar__title-page`) changed on scroll, right `.md3-top-app-bar__actions` containing icon buttons and user-menu.
- Icon button: `.md3-icon-button` for actions (40×40, rounded).

Navigation Drawer (source: `static/css/md3/components/navigation-drawer.css`, template `templates/partials/_navigation_drawer.html`)
- Class: `.md3-navigation-drawer` and `.md3-navigation-drawer--standard`
- Width: 280px; touch-friendly min heights (48px) for items.
- Structure: header (.md3-navigation-drawer__header logo), content (.md3-navigation-drawer__content), items: `.md3-navigation-drawer__item` with states `.md3-navigation-drawer__item--active` or [aria-current="page"]. Icons: `.md3-navigation-drawer__icon`, chevrons `.md3-navigation-drawer__chevron`, subitems `.md3-navigation-drawer__subitem`.
- Collapsible section: `.md3-navigation-drawer__collapsible` triggers submenu `.md3-navigation-drawer__submenu` with `.md3-navigation-drawer__submenu-inner` and `data-open` to control expansion.

User menu
- `.md3-user-menu`, `.md3-user-menu__toggle`, `.md3-user-menu__dropdown` used in top app bar; dropdown anchored to top bar and uses tokens for background and elevation.

Tabs / Chips / Pagination
- `.md3-tab`, `.md3-tab--active`, `.md3-chip` (chip variants like `md3-chip--assist`) and `.md3-pagination` are used across templates like `search/advanced.html` and `search/_results.html`.

---

## 8. Datenanzeige (Cards, Lists, Tabellen)

Cards
- Implementations: `.card`, `.card-elevated`, `.card-outlined`, `.card-filled`, `.card-tonal-*` and .md3-card equivalents.
- Card header/content/actions structure: `.md3-card__header` (title), `.md3-card__content`, `.card-actions`.
- Tokens: radii (`--radius-md`), paddings (`--space-4`), tonal backgrounds (`--md-sys-color-surface-container*`), shadows (`--elev-*`).

Tables & Lists
- Tables use `md3-table`, with `th/td` padding referencing `--space-3` and borders using `--md-sys-color-outline-variant` (see `layout.css`).
- Lists and result displays (KWIC list, search results) use `.md3-kwic-list`, `.md3-kwic-item`, `.md3-kwic-context`, etc. Templates: `templates/search/_results.html`.

---

## 9. Inkonsistenzen / technische Schulden (Problemstellen)

Ich dokumentiere hier nur beobachtete Abweichungen / TODOs — NICHTS wurde verändert.

1) Legacy token usage in component CSS
   - Files: `static/css/md3/components/forms.css` and some legacy comments in `textfields.css` mention legacy token names like `--md3-*`. These are commented `STATUS: ⚠️ Uses legacy MD3 tokens (--md3-*), needs migration to --md-sys-*`.
   - Problem: not all styles consistently use canonical `--md-sys-*` tokens (migration signals present). This risks inconsistent theme behavior if tokens remain mixed.
   - Examples: top of `components/forms.css` contains the comment block: "STATUS: ⚠️ Uses legacy MD3 tokens (--md3-*), needs migration to --md-sys-*" (see file for details).

2) Mixed utility systems / duplication
   - `layout.css` defines utility classes `.m-1`, `.mt-2` etc. plus project-specific `.md3-space-*` helpers; this duplicates concerns and can lead to inconsistent spacing across components.
   - Templates sometimes use combination of `.m-*, .mt-*` plus token-driven component spacing — duplication of spacing controls can lead to drift.

3) Non-canonical custom controls
   - Checkbox implementation is custom and not canonical MD3: `.md3-checkbox` in `components/forms.css` implements its own checkmark/ripple, rather than using a shared canonical MD3 checkbox component.
   - The codebase marks this as TODO to replace with canonical MD3 components.

4) Small inconsistencies in typography-weight definitions
   - `tokens.css` uses `--md-sys-typescale-title-large-font-weight` with a comment about mismatch to typography.css (a note about 400 vs 500). There's a short internal inconsistency recorded as comments in `tokens.css`.

5) Component scope bleed / legacy aliases
   - `buttons.css` contains legacy compatibility aliases (e.g., `.md3-button--contained`) to keep older templates working. This is intentionally allowed but should be noted when constructing a canonical template system (aliases exist and are used in templates).

6) Accessibility / alt patterns
   - Some templates use GET for logout flows and comment "no CSRF" — while a functional decision, this is security-related behavior that sits outside pure design system concerns — still worth noting as a structural inconsistency with modern expectations.

7) Token comments mention color-mix / OKLab fallback
   - tokens.css uses `color-mix(in oklab, ...)` and contains a fallback `@supports not (color: oklab(...))`; rely on fallback variable `--_on-surface-variant-static` — this is good but must be considered when building SSR/static theme tooling.

---

## 10. How to use this document

- This file is an exact reconstruction of the current MD3-based system used by the repository (tokens, components, templates and known problem spots). Use the `static/css/md3/*` directory as your canonical source of style and tokens.
- If you (or an assistant) need to create a MD3 template system that matches this project’s current state, follow these direct rules:
  1. Use tokens from `static/css/md3/tokens.css`.
  2. Follow classes/markup patterns used in `templates/partials/*` and pages under `templates/`.
  3. Be aware of legacy aliases and custom components noted above — treat them as intentional backward compatibility unless explicitly migrated.

---

Appendix / Quick-links (examples of template usage) — non-exhaustive
- `templates/base.html` → global load order & includes
- `templates/partials/_top_app_bar.html` → Top App Bar structure & user menu
- `templates/partials/_navigation_drawer.html` → Drawer, items, submenus
- `templates/search/advanced.html` → Search page: forms, textfields, dialogs, chips, tabs, actions
- `templates/search/_results.html` → Result list, pagination, empty state
- CSS references: `static/css/md3/tokens.css`, `typography.css`, `layout.css`, `components/buttons.css`, `components/textfields.css`, `components/dialog.css`, `components/navigation-drawer.css`, `components/top-app-bar.css`, `components/cards.css`, `components/forms.css`

---

If you'd like, I can now:
- generate a machine‑readable tokens-only JSON file derived from `tokens.css` (for templating or automated theme generation), or
- produce a small validation script that checks templates for deprecated `--md3-*` tokens and outputs a migration report.

✅ Next step I recommend (optional): produce a canonical MD3 template skeleton that maps these classes and tokens to a single, reproducible component library (no CSS changes in the codebase — a template-only artefact).
