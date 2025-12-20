# MD3 Migration Lint Report — current legacy occurrences

This file lists all occurrences of legacy tokens, utilities and inline styles found in the repository at the time of generation. It is a working report to help prioritize migration work and verify progress.

Important: The repository currently includes a temporary shim `static/css/md3/tokens-legacy-shim.css` which maps many `--md3-*` token names to canonical `--md-sys-*`/`--space-*` names so the UI keeps rendering during migration.

---

Summary (high level)
- Legacy token names `--md3-*`: multiple occurrences in CSS/JS/docs. These should be migrated to `--md-sys-*` or `--space-*` as appropriate.
- Utility spacing classes `.m-*`, `.mt-*`, `.mb-*`, `.mx-auto` etc.: used across templates — prefer semantic `.md3-stack--*` or `.md3-page__section` instead.
- Inline style attributes (style="padding/margin/...)` found in docs and a few JS templates which should be replaced by token-driven classes.
- Legacy button alias `.md3-button--contained` and the older `.md3-button--destructive`/`.md3-destructive` naming appear in some places; these are marked `@deprecated` in `components/buttons.css` and should be replaced by the canonical modifier `.md3-button--danger` (or `.md3-button--filled.md3-button--danger` where filled/contained appearance is required).
- `.card-*` vs `.md3-card` duplicates: many templates still use `.card`, `.card-outlined`, `.card-elevated` — map to `.md3-card` variants.

---

1) `--md3-*` occurrences (representative list)

- `static/css/player-mobile.css` — many `--md3-space-*` and `--md3-color-*` usages (padding/gap/background/color).
- `static/js/main.js` — `.getPropertyValue("--md3-mobile-menu-duration")` (JS reading legacy variable).
- `static/css/md3/components/login.css` — `padding: var(--md3-space-4, 1rem);` and `.md3-button--contained` styles.
- `static/css/md3/components/editor.css` — `z-index: var(--md3-z-dialog, 1300);`.
- `docs/` — many design docs (md3-quick-reference.md, md3-design-modernisierung.md, reports/ archives) contain `--md3-*` examples or references (these are docs to be updated optionally).

Suggested action: move usages to canonical tokens. For CSS/JS that rely on the legacy shim, plan to update code to use `--md-sys-*` or `--space-*` and remove dependency on the shim.

---

Completed migrations

- `templates/pages/impressum.html` — migrated (2025-11-24): converted to canonical `md3-page`, `md3-page__header`, `md3-page__section`, and `md3-stack--*` spacing; no `--md3-*` tokens, `.m-*` utilities, or inline margin/padding remain.

- `templates/pages/privacy.html` — migrated (2025-11-24): updated to `md3-page` + `md3-hero--card` with icon and `md3-text-page` content wrapper; preserved existing images and interactivity.

- Proyecto pages migrated (2025-11-24):
  - `templates/pages/proyecto_overview.html`
  - `templates/pages/proyecto_diseno.html`
  - `templates/pages/proyecto_estadisticas.html`
  - `templates/pages/proyecto_quienes_somos.html`
  - `templates/pages/proyecto_como_citar.html`
  - `templates/pages/proyecto_referencias.html`
  - `templates/pages/corpus_guia.html`

---

2) `.m-*` / `.mt-*` occurrences in templates

Found (examples):
- `templates/search/advanced.html`: classes such as `m-0` applied on small elements (several lines around 452..536).
- `templates/auth/password_reset.html`, `templates/auth/account_password.html`: `m-auto` used on centered cards.
- `templates/auth/account_profile.html`: `mx-auto`, `mt-4` on cards.
- `templates/pages/admin_dashboard.html` includes `mt-4` in some pods.
- `static/js/modules/search/cqlBuilder.js` uses `class="md3-title-small m-0"`.

Suggested action: replace these uses with `.md3-stack--section` (for component internals) or `.md3-page__section` and token-driven alignment helpers (e.g., `.md3-align--center`, or use `.md3-grid--responsive` for layout). Add codemod or search/replace scripts.

---

3) Inline styles (style="… margin|padding …") — high-priority for elimination

Found examples:
- `static/js/modules/stats/renderBar.js` line with inline <span> using margin-right and border-radius inline styles.
- `static/js/modules/search/token-tab.js` includes innerHTML with `style="padding: 1rem;"`.
- Several archived docs (`docs/archived/2025-11-01__responsive-padding-drawer-analysis.md`) have inline HTML with style attributes.
- `docs/finalizing/06_ui_md3_audit.md` references inline styles used in templates.

Suggested action: replace inline styles with token-driven utility classes where behavior should be preserved. For dynamic content built via JS (innerHTML), move style into JS-injected classes or update templates to render semantic wrappers.

---

4) Legacy button aliases

Occurrences:
- `static/css/md3/components/buttons.css` — `.md3-button--contained` kept as compatibility alias and was annotated `@deprecated`.
- `static/css/md3/components/login.css` defines `.md3-button--contained` specific styles; templates referencing it should be updated to `.md3-button--filled`.

Suggested action: Update templates to use `.md3-button--filled` (or other canonical variant) and then remove alias in a later cleanup phase.

---

5) Card classes duplication (`.card` vs `.md3-card`)

Occurrences:
- Numerous templates under `templates/pages/` and `templates/auth/` use class names: `card`, `card-elevated`, `card-outlined`, `card-tonal-*`, alongside `md3-card` variants.
- `static/css/md3/components/cards.css` already handles both, but prefer `.md3-card-*` for new code.

Suggested action: map `.card->.md3-card` (or maintain alias mapping temporarily). Update canonical skeletons to use `.md3-card` and progressively replace `.card-*` by using the migration checklist page-by-page.

---

6) Misc / JS & dynamic token reads

- `static/js/main.js` expecting `--md3-mobile-menu-duration` — update JS to read canonical tokens where appropriate (or keep shim until migration complete).

---

Appendix: Recommendations for the linting tool

- write `scripts/md3-lint.py` or a small Node script which:
  - greps for `--md3-` in templates and JS/CSS; warn/error if used (except in `tokens-legacy-shim.css`)
  - greps for `class="[^"]*\b(m-|mt-|mb-|mx-|my-)` in templates and flags occurrences
  - greps for inline style attributes containing margin/padding
  - produces a CSV/markdown report with file paths, line numbers and suggested change

---

If you want, I can now:
- create `scripts/md3-lint.py` and add an Nx/CI job; or
- run an automatic codemod to replace the most obvious `.m-0` / `m-auto` occurrences with `md3` semantic helpers in a small set of high-priority templates.
