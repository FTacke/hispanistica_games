  - `templates/pages/corpus_guia.html` — migration completed (2025-11-24): unified to `md3-page` + `md3-hero--card` + `md3-text-page` (Guía de Búsqueda). Preserved images and interactive elements.
# MD3-Migrationsplan — CO.RA.PAN (Gold‑Standard)

Ziel: ein konsistentes, dokumentiertes und migrationssicheres MD3‑Designsystem. Tokens bleiben einzige Quelle der Wahrheit; Komponenten, Layouts und Utilities werden kanonisiert und Legacy‑Aliases schrittweise auslaufen.

Dieses Dokument beschreibt das Zielbild, die technical mapping‑Regeln, ein konkretes Phasen‑Rollout und eine Checkliste für die Migration bestehender Templates.

---

## 1. Ziele

- Gold‑Standard MD3 System: ein einziges Token‑System, ein einziges Kanal‑Mark‑up pro UI‑Komponente, semantische Layout‑Utilities.
- Minimale Breaking Changes: Legacy‑Aliases verbleiben temporär; neue Templates nutzen sofort die kanonischen Klassen.
- Migrationssicherheit: klarer Phasenplan, Lint‑Report und Tests zur Validierung.

## 2. Kurz‑Ist‑Zustand

- Canonical token file: `static/css/md3/tokens.css` (Light/Dark) — bereits im Projekt.
- Core & components: `static/css/md3/typography.css`, `layout.css`, `components/*.css` — existierend.
- Problemfelder: 1) legacy tokens `--md3-*` remaining in CSS, 2) duplicated utility spacing `.m-*`, `.mt-*`, 3) custom non‑canonical controls (checkbox), 4) mixed `.card-*` vs `.md3-card` patterns. Details: see `docs/md3-template/md3_designsystem_bestandaufnahme.md` (inventory).

## 3. Zielbild (konkret)

Principles
- Tokens bleiben Source of Truth: only `--md-sys-*`, `--space-*`, `--radius-*`, `--elev-*` used in new code.
- One spacing system: deprecate `.m-*`/`.mt-*` utilities, add semantic `.md3-stack--*` helpers.
- Canonical components: single canonical markup and classset per component (buttons, textfield, dialog, card, nav, checkbox, etc.).
- Backwards compatible: Legacy aliases kept with `/* @deprecated */` annotations and a removal schedule.

File & namespace rules (high level)
- `static/css/md3/tokens.css` — canonical tokens. Add clear comment block at top: `--md-sys-*` canonical; `--md3-*` aliases only.
- `static/css/md3/layout.css` — core page layout, stack/grid utilities, explicit deprecation comments for old `.m-*` utilities.
- `static/css/md3/components/*` — canonical component files; each must contain a header documenting canonical class names and `@deprecated` aliases.
- `templates/_md3_skeletons/` — add canonical example skeleton pages that use canonical components.

---

## 4. Änderungen nach Layern (konkret)

### 4.1 Tokens & Theme

Action items
- 1) In `tokens.css` add a top comment block documenting: canonical tokens are `--md-sys-*` + `--space-*`/`--radius-*`/`--elev-*`. 2) Create alias mapping at the top for `--md3-*` → `--md-sys-*` (not removal; only alias), and mark `--md3-*` as `@deprecated` in comments.

Migration notes
- Don't rename tokens in place — keep values, add alias shim to guarantee behavior while templates migrate.

### 4.2 Core / Layout & Spacing

Action items
- `layout.css` will gain a top doc comment about allowed layout utilities and deprecation of `.m-*` spacing utilities. Add canonical classes:
  - `.md3-page` (outer page shell)
  - `.md3-page__header` (hero/eyebrow/title/intro wrapper)
  - `.md3-page__section` (content sections)
  - `.md3-stack--page` (vertical rhythm between sections on a page — uses `--space-6` / `--space-8` tokens)
  - `.md3-stack--section` (spacing inside a section between heading → body → actions)
  - `.md3-grid--responsive` (default card grid)

Deprecation
- Mark `.m-*`/`.mt-*`/`.mb-*` utilities as `@deprecated` in the file and add a small migration tip comment to replace them by `.md3-stack--*` or `md3-page__section`.

### 4.3 Component layer (buttons / textfields / dialogs / navigation / cards / forms)

Common directives
- Each component file in `static/css/md3/components/*.css` must begin with a header that documents canonical classes and any deprecated aliases.
- Aliases must carry `/* @deprecated: use ... */` comments.

Buttons mapping (example)
| Current/Legacy | Canonical |
|---|---|
| `.md3-button--contained` | `.md3-button--filled`  /* @deprecated alias */
| `.md3-button--danger` (legacy naming) | `.md3-button--filled.md3-button--danger` (modifier)

Buttons action items
- Document the 4 canonical variants: `.md3-button--filled`, `.md3-button--tonal`, `.md3-button--outlined`, `.md3-button--text` in `components/buttons.css` header. Add color/typography note.
- Keep legacy aliases with `@deprecated` and add TODO comment where such alias is present in templates.

Textfields & Forms
- Document `.md3-outlined-textfield` as canonical. Add header comment to `components/textfields.css` stating usage rules (spacing via tokens, label states, error states, helper text alignment).
- Mark `components/forms.css` checkbox implementation as `@deprecated` and document differences to canonical MD3 checkbox (visibility, ripple, focus ring). Introduce `md3-checkbox` vs `md3-checkbox-legacy` naming scheme.

Dialogs
- Document `.md3-dialog` structure and modifiers in `components/dialog.css` header. Add `@deprecated` markers for any non-conforming classes.

Cards & Tables
- Decide canonical: rename/alias mapping if both `.card-*` and `.md3-card-*` exist. Prefer `.md3-card-*` as canonical, and add `@deprecated` aliases for `.card-*`.

### 4.4 Templates & Template Skeletons

Action items
- Add `templates/_md3_skeletons/` with canonical skeleton templates:
  - `page_text_skeleton.html`
  - `page_form_skeleton.html`
  - `page_admin_skeleton.html`
- Create the files as reference only; do not delete or modify current templates in other folders yet.
- Use canonical classes and tokens exclusively.

---

## 5. Phasenplan (Rollout)

Phase 0 — Preparation (short)
- Add documentation header comments in tokens/layout/component css files announcing the migration and alias rules.
- Add skeleton templates for devs.
- Run a repo scan to produce a `md3_lint_report.md` with all legacy occurrences.

Phase 1 — New templates & core only
- All new templates must use canonical classes and tokens.
- Add automated checks (linting / grep rules) to CI that fail a PR if it introduces new `--md3-*` tokens or `.m-*` utilities in templates.

Phase 2 — Migrate high‑priority pages
- Migrate one page per major category while preserving behavior (examples below):
  - Text page: `templates/pages/...` such as `about`, `impressum`

  NOTE: `templates/pages/impressum.html` — migration completed (2025-11-24). The page now uses canonical `md3-page`/`md3-page__section` classes, `md3-stack--*` spacing, and no inline margin/padding or legacy `--md3-*` tokens.

  NOTE: `templates/pages/privacy.html` (Datenschutzerklärung) — migration completed (2025-11-24): now uses `md3-page` + `md3-hero--card` with icon and `md3-text-page` for main content (keeps original content and interactive elements).

  NOTE: Proyecto pages — migration completed (2025-11-24): updated the following templates to the canonical text page preset with a card-hero header + icon while preserving embedded images and interactive elements:
  - `templates/pages/proyecto_overview.html`
  - `templates/pages/proyecto_diseno.html`
  - `templates/pages/proyecto_estadisticas.html`
  - `templates/pages/proyecto_quienes_somos.html`
  - `templates/pages/proyecto_como_citar.html`
  - `templates/pages/proyecto_referencias.html`
  - Form page: `templates/auth/*` and `templates/search/advanced.html`
  - Dashboard: `templates/pages/admin_dashboard.html`
- For each page update: change markup to canonical classes, update one reference per old alias to include `/* TODO: migrated */`.

Phase 3 — Complete repository migration
- Migrate remaining templates, fix mismatches, run tests.

Phase 4 — Cleanup
- Remove deprecated aliases and utilities only once the lint report is near zero and there is buy‑in from maintainers.

Timeline suggestion (example)
- Weeks 0–1: Phase 0
- Weeks 1–3: Phase 1 & add CI checks
- Weeks 3–7: Phase 2 (iteratively migrate critical pages)
- Weeks 7–12: Phase 3 & 4

---

## 6. Concrete migration items & mapping (examples from repo)

- Tokens: any `--md3-*` occurrence → leave as alias shim in `tokens.css`, log occurrence in lint report. Prefer `--md-sys-*` in new code.
- Spacing utilities: `.m-*`/`.mt-*`/`.mb-*` → replace with `.md3-stack--*` or `.md3-page__section` spacing utilities; update examples in `layout.css`.
- Buttons mapping: `.md3-button--contained` → `.md3-button--filled` (add `@deprecated`).
- Cards: map `.card`, `.card-outlined`, `.card-elevated` → `.md3-card`, `.md3-card--outlined`, `.md3-card--elevated` (aliases allowed during migration).

### 6.1 Templates / Migration status table (example items)

| Template | Role | Suggested migration target | Note |
|---|---:|---|---|
| `templates/search/advanced.html` | Search page (forms & dialogs) | Use `.md3-page`, `.md3-outlined-textfield`, `.md3-dialog` | High priority
| `templates/auth/login.html` (and register) | Form page | `.md3-page`, `.md3-outlined-textfield`, `.md3-button--filled` | High priority
| `templates/pages/admin_dashboard.html` | Admin/Dashboard | `.md3-page`, `.md3-grid--responsive`, `.md3-card` | High priority

---

## 7. Tests, CI & Linting

Automated checks to add (examples):
- `scripts/md3-lint.py` that greps for `--md3-` tokens and `.m-` classes in templates or CSS changes and fails when new occurrences are added.
- CI check that runs the lint script and blocks PRs introducing new legacy token usages.

Short example lint rules
- Err if any new `--md3-` token usage shows up in `templates/` or `static/css/` (except tokens.css alias block).
- Err if `.m-` or `mt-` / `mb-` appear in templates (warnings allowed during migration but new code fails).

---

## 8. Checklist — Before marking one page as migrated

Use this checklist for each page or template update; all items must be checked to mark the template migrated.

1. Uses `--md-sys-*` tokens for colors and surface variables (no inline colors).
2. Uses `.md3-page` or appropriate canonical page class.
3. Sectioning uses `.md3-page__section` and token-based spacing (no `.m-*` utilities or inline margins).
4. Buttons: only canonical variants `.md3-button--filled|--tonal|--outlined|--text` used for the page.
5. Textfields: canonical `.md3-outlined-textfield` markup and classes used; helper + error text consistent.
6. Dialogs: `.md3-dialog` markup used with `__header`, `__content`, `__actions`.
7. Cards: migrated to `.md3-card` or uses alias with TODO comment recorded.
8. No hard-coded pixel paddings/margins or colors.

If any item fails, mark the template as partially migrated and record the leftover legacy occurrences in `md3_lint_report.md`.

---

## 9. Next steps — immediate changes performed in repository

1. Add top comment headers to tokens/layout and component files documenting canonical vs deprecated usage.
2. Create `templates/_md3_skeletons` with three canonical skeleton files (reference only).
3. Run a repository scan and write `docs/md3-template/md3_lint_report.md` listing current legacy occurrences.

These are implemented in follow-up commits / files in this branch.

---

## Appendix — Helpful queries for maintainers

Search for the most relevant migration signals:
- `grep -R "--md3-" -n` → list legacy tokens
- `grep -R "class=\".*m-" -n templates` → find spacing classes
- `git grep "md3-button--contained"` → find legacy button aliases

Good luck — keep the tokens authoritative, prefer semantic markup over utilities, and keep migrations gradual and reversible.
