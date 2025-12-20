# MD3 Audit — Forms / Auth / Dialogs

Datum: 2025-11-24
Verfasser: automatischer Audit (erste Bestandaufnahme)

Kurz: Hier ist eine strukturierte Bestandsaufnahme (Formulare, Auth-Seiten, Dialoge/Sheets), relevante Styles/JS und eine Abgleich-Übersicht mit MD3-Patterns. Keine Änderungen am Code — nur Dokumentation, Hinweise und benannte Verdachtsstellen.

---

## 0) Überblick — Scope & Ziel

Ziel: Vollständig inventarisieren, welche Templates / Partials / Komponenten für Formulare / Auth-Views / Dialoge genutzt werden, welche MD3-Basisdateien vorhanden sind, und wo Abweichungen/Legacy-Stellen existieren.

Output: Diese Audit-Datei (Markdown) dient als Ausgangspunkt für gezielte Refactorings.

---

## 1) Projekt-Scan — relevante Verzeichnisse (Kurz)

- `templates/` — Haupt-Templates (Seiten, Partials, Auth-Views): **Auth**-Templates liegen in `templates/auth/`, gemeinsame Partials in `templates/partials/`, MD3-Skelette in `templates/_md3_skeletons/`.
- `static/css/` — Haupt-Styling; MD3-theme lebt unter `static/css/md3/` (tokens, layout, components/*).
- `static/js/` — Frontend-Logic; auth-related scripts in `static/js/auth/` (legacy) and `static/js/modules/auth/` (ES Modules / new).
- `docs/md3-template/` — bereits existierende Dokumentation, Design-Drafts und migration-notes.

Wichtigste beobachtete Pfade (Beispiele):
- `templates/auth/*.html` (login, _login_sheet.html, password_forgot/reset, account_*, admin_users)
- `templates/_md3_skeletons/*` (auth/login/profile/page_form_skeleton.html)
- `static/css/md3/` and `static/css/app-tokens.css` (project overrides)
- `static/js/modules/auth/*` + `static/js/auth/*` (behavior & form handling)

---

## 2) MD3-Basisschicht ("Where to look")

Die zentrale MD3-Basis ist vorhanden und modular aufgebaut:

- `static/css/md3/tokens.css` — **canonical token set** (colors, spacing, typography, radius, elevation). Status: OK (canonical).
- `static/css/md3/tokens-legacy-shim.css` — shim / aliases für alte `--md3-*` Namen. Status: OK / Übergangsphase.
- `static/css/md3/typography.css`, `layout.css` — Layout & Typo primitives.
- `static/css/md3/components/*` — einzelne component-style files; relevant für wir:
  - `textfields.css` — canonical outlined textfield (wrapper + outline parts). PURPOSE: Textfield base (gibt label/focus/outline behavior). Scope: generisch.
  - `forms.css` — form-layouts & corpus-specific rules **(contains legacy / custom parts)**. PURPOSE: form containers, corpus-specific layout and a custom checkbox impl. Status: partly legacy / not fully canonical.
  - `dialog.css` — canonical dialog surface & layout. PURPOSE: canonical `<dialog>.md3-dialog` surface, actions, content. Status: OK.
  - `auth.css`, `login.css` — auth-specific overrides (card sizing, auth forms, sheet interactions). PURPOSE: auth pages & login-sheet. Status: project-specific overrides (expected).
  - `buttons.css`, `chips.css`, `cards.css`, `top-app-bar.css` etc — other components used by pages.

Hinweis: `static/css/app-tokens.css` exists for small app-specific token overrides.

---

## 3) Formulare — Vorkommen & abstrakte Strukturen

Wir fanden überall ein stark einheitliches MD3-Pattern: `.md3-outlined-textfield` als canonical element.

3.1 Canonical textfield pattern (wo benutzt)
- Templates: `templates/auth/*`, `templates/search/advanced.html`, `templates/auth/admin_users.html`, `templates/_md3_skeletons/*` usw.
- CSS: `static/css/md3/components/textfields.css` — definiert
  - `.md3-outlined-textfield` (wrapper)
  - `__input`, `__label`, `__outline` (+ outline pieces)
  - trailing icon support, select handling, compact & textarea variants

Status: GENERELL KONSISTENT (templates nutzen gleiche markup pattern). Good.

3.2 Typische Formular-Template-Struktur (abstrahiert)
- Page shell: `.page` / `.md3-page` / header hero (e.g. `.md3-hero`, hero-container)
- Card / Surface: `article.md3-card.md3-card--outlined.md3-auth-card` (max-width ~480px)
- Form container: `<form class="md3-auth-form">` or `.md3-form` for dialog forms
- Fields: `.md3-outlined-textfield` with children
  - `<input class="md3-outlined-textfield__input" ...>`
  - `<label class="md3-outlined-textfield__label">` (floating)
  - `.md3-outlined-textfield__outline` (parts for MD3 outlined look)
- Actions: `.md3-actions` or `.md3-row--between` containing buttons (`.md3-button--filled`, `.md3-button--text`, `.md3-button--outlined`)

Files/Examples:
- Login (page): `templates/auth/login.html` — full page card — uses `.md3-auth-card`, `.md3-auth-form`, `.md3-outlined-textfield`, `.md3-alert` for global errors.
- Login (sheet): `templates/auth/_login_sheet.html` — `div.md3-sheet` + `md3-sheet__surface` + HTMX integration (hx-post/hx-swap). Actions include close buttons + sheet action bar.
- Password Forgot: `templates/auth/password_forgot.html` — same outlined textfield structure in card.
- Password Reset: `templates/auth/password_reset.html` — hero + outlined textfields + trailing visibility icons.
- Account profile/password/delete/admin users — consistent card/forms/dialogs.

Specials / Observed variants:
- `md3-outlined-textfield__input--select` and `.md3-outlined-textfield__label--select` used for select elements — label behaviour slightly different (always-up label, smaller font).
- Some forms wrap inputs in `<label class="md3-outlined-textfield md3-outlined-textfield--block">` (see admin user create form), others use `div` wrapper — both work but inconsistent markup choice.

Verdacht: Templates sometimes mix `<label wrapper>` vs `<div wrapper>` formats — not critical, but should be normalized for maintainability.

Status (Form Markup): OK / kleine Inkonsistenzen (label-as-wrapper vs div + input + label). Recommend normalization.

---

## 4) Auth-Seiten — inventory & specifics

Auth templates located in `templates/auth/`:
- `login.html`, `_login_sheet.html` (sheet fragment), `password_forgot.html`, `password_reset.html`, `account_profile.html`, `account_password.html`, `account_delete.html`, `admin_users.html`.

Common patterns:
- All auth templates extend `base.html` and import `static/css/md3/components/auth.css` (plus `login.css` for login/loginsheet).
- Use `md3-card`, `md3-auth-card`, `.md3-auth-form`, `.md3-outlined-textfield` and canonical button classes.
- Error handling: mix of global `md3-alert` banners (page login) and field/compact errors in sheets (sheet errors use `.md3-sheet__errors`). This is deliberate (sheet shorter) and acceptable.

Button & action types observed:
- Primary actions: `.md3-button--filled` / `.md3-button--contained` depending on file.
- Secondary actions / text links: `.md3-button--text` or `.md3-link`.

Labels & Input Patterns:
- Inputs have `aria-label` and proper `autocomplete` attributes (good accessibility practice).
- Floating labels used everywhere via `.md3-outlined-textfield__label`.

Differences / potential issues:
- For some forms (admin user create) templates use `label.md3-outlined-textfield` (encapsulating inputs directly in <label>) — good HTML but inconsistent with other forms using div + input + label.
- Login sheet uses HTMX (`hx-post`) and renders sheet fragments — markup is MD3-compatible and JS supports both legacy `.md3-login-sheet` and new `.md3-sheet` selectors.

Status (Auth pages): Meist MD3-aligned; small inconsistencies in wrapper semantics.

---

## 5) Dialogs & Sheets — inventory and variants

Where found:
- `<dialog class="md3-dialog">` used widely: `templates/auth/admin_users.html` (create/invite/user-detail), `templates/auth/account_profile.html` (delete-dialog), `templates/partials/_navigation_drawer.html` (navigation drawer modal), and others.
- `.md3-sheet` used for login-sheet (`templates/auth/_login_sheet.html`) — overlay/sheet pattern.

Abstract structure for md3-dialog (canonical):
- `<dialog class="md3-dialog">`
  - `.md3-dialog__container`
    - `.md3-dialog__surface` (surface cards) — controls token for background
    - `.md3-dialog__header` (title)
    - `.md3-dialog__content` (body)
    - `.md3-dialog__actions` (buttons row)

md3-sheet structure (login-sheet):
- `.md3-sheet` (top-level), `.md3-sheet__backdrop`, `.md3-sheet__surface/md3-sheet__container`, `.md3-sheet__header`, body fields, `.md3-sheet__actions`.

Notes about handling & JS:
- Several JS modules manipulate sheets/dialogs (`static/js/modules/auth/login-sheet.js`, `static/js/modules/navigation/drawer.js`). They support both legacy and newer selectors (compatibility layer).
- Dialog CSS (`dialog.css`) uses `--md-sys-color-surface-container-high` for dialog surface background — good: dialogs are visually distinct from page surface.

Status (Dialogs): Found a consistent canonical pattern; sheet vs dialog patterns are both in use and handled by CSS/JS compatibility. OK.

---

## 6) CSS/SCSS analysis — who styles what (short)

Top files to inspect:
- `static/css/md3/tokens.css` — canonical tokens (colors, spacing, typography) — central.
- `static/css/md3/components/textfields.css` — canonical outlined textfield implementation.
- `static/css/md3/components/forms.css` — form container styles & corpus-specific layouts. Contains legacy bits and a custom checkbox implementation (⚠️!).
- `static/css/md3/components/dialog.css` — canonical dialog surface & token usage (sets `md3-dialog__surface` background token).
- `static/css/md3/components/auth.css` — auth-specific overrides (card width, label backgrounds inside auth cards, ensures inputs are full-width within cards).
- `static/css/md3/components/login.css` — login page and sheet styling (sheet/backdrop + compatibility selectors). Also defines `.md3-login-card` (login-page-specific) — some tokens fallback to `--app-background`.
- `static/css/app-tokens.css` — app-level overrides for token values.

Detailed findings (not exhaustive):
- textfields.css: canonical pattern, tokens used; label background uses `--md-sys-color-surface` by default and `dialog.css` explicitly sets label background to dialog container token to visually match surface.
- forms.css: contains legacy/unsupported patterns (custom checkbox, references to old `--md3-*` tokens in some places); not fully canonical.
- chips.css and some component files still contain hard-coded hex colors (e.g. `#e0e0e0` in `chips.css`) — those are NOT tokenized and should be migrated.

Major deviation candidates:
- Custom checkbox implementation in `forms.css` — Not MD3-canonical.
- `chips.css` uses hex colors directly — tokenization needed.
- `datatables-theme-lock.css` contains many fallback hex colors and `!important` rules that might fight the design system.

Status (CSS alignment): Mostly good — tokens & componentized MD3 files exist. A **few legacy/override** files and hard-coded color usages remain and should be cleaned.

---

## 7) Auth-specific CSS / overrides

Files:
- `static/css/md3/components/auth.css` (auth card + form layout + small overrides)
- `static/css/md3/components/login.css` (login-specific & sheet surfaces)
- `static/css/app-tokens.css` — project-level overrides

What auth CSS does:
- Defines auth card max-width and standardizes padding for auth forms.
- Forces textfields to width:100% inside auth cards & dialog/sheet surfaces.
- Sets label background within auth cards to `--md-sys-color-surface` (prevents hard label panels) so labels don't create high contrast.

Potentially risky patterns:
- Some auth CSS is tightly-coupled to layout design (e.g., large paddings) which might conflict when reusing the same card component on different pages. This is expected but should be clearly documented when refactoring.

Status (Auth-specific CSS): intentional overrides — acceptable. No immediate MD3 conflict except where legacy tokens or hard-coded colors exist elsewhere.

---

## 8) Global MD3 base vs overrides — conflicts & duplicates

- The canonical components live in `static/css/md3/components/*` and should be the *single source of truth*.
- Several older/legacy components still use inline hex values or legacy tokens (e.g. `chips.css`, `datatables-theme-lock.css`, and parts of `forms.css`). These create token fragmentation and risk inconsistent colors/spacings across pages.
- There are aliasing / compatibility classes for sheets (`.md3-login-sheet` vs `.md3-sheet`) — they currently coexist for seamless migration.

Duplicate/Conflict examples:
- `.md3-outlined-textfield` rules are canonical in `textfields.css`. Some auth/pages also define local tweaks (e.g., `.md3-auth-card .md3-outlined-textfield__label { background: var(--md-sys-color-surface) }`) — these are legitimate overrides but should be minimal.
- `forms.css` contains a custom checkbox pattern that diverges from MD3 canonical checkbox; a migration plan is needed.

Status: Uneinheitlich in a few CSS modules (refactor candidates).

---

## 9) Abgleich mit MD3-Pattern — Stärken / Schwächen

9.1 Form patterns (high level)
- Stärken:
  - Clear canonical textfield pattern in `textfields.css` that templates use consistently.
  - Tokens used heavily (colors/spacings), which simplifies theming.
  - Good use of md3 skeleton templates under `templates/_md3_skeletons/` as canonical examples.
- Schwächen:
  - Minor structural inconsistencies (textfields wrapped by `label` vs `div+label`) across templates.
  - `forms.css` custom checkbox isn't MD3 canonical.
  - Some components still use hex colors/hard-coded values (chips, datatables locks) → inconsistent theme.

Status (Forms): OK overall — a few migration tasks to make everything canonical.

9.2 Auth patterns
- Stärken:
  - Auth pages follow the same MD3 card & textfield patterns and import `auth.css` to align layout.
  - HTMX integration in login-sheet is clean and handles sheet-specific messaging.
- Schwächen:
  - Small markup inconsistencies (wrapper style). Potential copy/paste differences in some admin dialogs.

Status (Auth): OK / tidy but minor normalization beneficial.

9.3 Dialog/Sheet patterns
- Stärken:
  - `dialog.css` and `login.css` provide robust canonical dialog/sheet implementations.
  - Dialog surfaces use `--md-sys-color-surface-container-high` which visually separates dialog vs page.
- Schwächen:
  - Compatibility code + alias selectors exist (sheet vs login-sheet) — net effect: no runtime problem, but some technical debt.

Status (Dialogs): OK — clean and canonical.

---

## 10) Concrete findings / problem list (prioritized)

1) `forms.css` — contains a custom checkbox implementation (⚠️ non-canonical). Impact: inconsistent checkbox behavior & accessibility. File: `static/css/md3/components/forms.css` (section "Material Design 3 Checkbox (Custom Implementation)"). Status: klar gegen MD3.

2) Hard-coded colors in a few components:
   - `static/css/md3/components/chips.css` uses hex colors (e.g. `#e0e0e0`). 
   - `static/css/md3/components/datatables-theme-lock.css` uses multiple `!important` rules and fallback hex colors. 
   Impact: defeats tokens & theming; friction for theme swapping.

3) Mixed markup for inputs:
   - Some templates place `<input>` inside `<label class="md3-outlined-textfield">` others use `<div>` and `label` sibling — both work but cause duplicated styles/JS handling complexity. Files: `templates/auth/admin_users.html` vs `templates/auth/login.html` etc. Status: inkonsistent (minor).

4) Compatibility selectors / legacy class names still present (e.g., `.md3-login-sheet` vs `.md3-sheet`). Functionality OK but technical debt; tests rely on both selectors. Files: `static/css/md3/components/login.css`, `static/js/modules/auth/login-sheet.js`.

5) Inline styles & script-generated HTML in some JS modules (small spots). Example: `static/js/modules/search/cqlBuilder.js` uses inline `style="width: 80px;"` — minor issue but reduces style centralization.

---

## 11) Quick Recommendations — next steps (only high-level, non-invasive)

(These are suggestions for follow-up refactoring tasks — not performed now.)

1) Normalize input wrapper markup in templates (choose `div+input+label` or `label-as-wrapper`) and update skeletons in `templates/_md3_skeletons/` accordingly.
2) Replace the custom checkbox in `forms.css` with a canonical MD3 checkbox implementation and update templates to `.md3-checkbox` (add compatibility alias during transition).
3) Audit component files (chips.css, datatables-theme-lock.css, any file with hex colors) to replace hard-coded colors with `--md-sys-*` tokens and remove `!important` where possible.
4) Plan a controlled cleanup of legacy class names (alias removal): migrate to `.md3-sheet` and remove `.md3-login-sheet` after tests/UX window.
5) Add linting/enforcement: extend `scripts/md3-lint.py` (already in repo) with rules to flag: hard-coded colors, legacy token usage, duplicate definitions, and inconsistent textfield markup.
6) Add unit/e2e tests that assert canonical structure for forms/dialogs (helpful during migration) — some tests exist (`tests/..` and Playwright tests) but expand coverage for admin/auth forms and dialogs.

---

## 12) Status summary (table-ish)

- Templates (auth): OK — mostly canonical MD3 markup, small inconsistencies.
- Dialogs / Sheets: OK — canonical `md3-dialog` + `md3-sheet` patterns present and supported.
- Textfields: OK — canonical implementation in `textfields.css`, widely used.
- Forms (forms.css): Uneinheitlich / legacy — contains custom checkbox and some legacy tokens.
- Component hard-coded colors (chips, datatables-theme-lock): gegen MD3 — needs tokenization.

---

## 13) Next-actions (for the next prompt / planning)

- Decide on the input wrapper canonical form (label-as-wrapper vs div+label) and plan batch changes.
- Replace custom checkbox with canonical MD3 checkbox; update templates and tests in a single PR.
- Tokenize the few hard-coded colors found in `chips.css`, `datatables-theme-lock.css`, and other places.
- Remove legacy alias classes (after a compatibility window) and update tests to use canonical names.

---

## 14) Appendix — important files & paths (quick reference)

Templates (Auth):
- templates/auth/login.html
- templates/auth/_login_sheet.html
- templates/auth/password_forgot.html
- templates/auth/password_reset.html
- templates/auth/account_profile.html
- templates/auth/account_password.html
- templates/auth/account_delete.html
- templates/auth/admin_users.html

Skeletons:
- templates/_md3_skeletons/auth_login_skeleton.html
- templates/_md3_skeletons/page_form_skeleton.html
- templates/_md3_skeletons/auth_profile_skeleton.html

CSS (MD3 core & components):
- static/css/md3/tokens.css
- static/css/md3/tokens-legacy-shim.css
- static/css/md3/components/textfields.css
- static/css/md3/components/forms.css
- static/css/md3/components/dialog.css
- static/css/md3/components/auth.css
- static/css/md3/components/login.css
- static/css/app-tokens.css

JS helpers / auth logic:
- static/js/modules/auth/login-sheet.js
- static/js/modules/auth/token-refresh.js
- static/js/auth/password_forgot.js
- static/js/auth/password_reset.js
- static/js/auth/admin_users.js
- static/js/auth/account_profile.js / account_password.js / account_delete.js

Docs / references:
- docs/md3-template/* (existing guidance / migration notes)
- docs/finalizing/* (migration & refactor notes)

---

End of audit (first pass). If you want, I can now convert these findings into an explicit prioritized task list (PR plan), test targets, or start implementing **safe refactorings** one at a time (e.g., replace custom checkbox with canonical MD3 checkbox + tests).

VERDACHT markers in this report indicate places that likely need follow-up checks (e.g. custom checkbox, hard-coded colors, legacy selectors).  


---

