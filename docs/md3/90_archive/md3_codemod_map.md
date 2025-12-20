# MD3 Codemod Mapping — CO.RA.PAN

This document lists concrete mappings from *legacy* spacing utilities, card/button aliases and `--md3-*` tokens to the canonical Gold‑Standard MD3 tokens and classes present in the repository. All mappings are derived from the repo's current CSS/HTML/JS usage (search results from templates, static CSS and JS files).

Summary (quick)
- Source of truth tokens: `--space-*` and `--md-sys-color-*` from `static/css/md3/tokens.css`.
- Canonical classes (new code): `.md3-page`, `.md3-page__header`, `.md3-page__section`, `.md3-stack--page`, `.md3-stack--section`, `.md3-grid--responsive`, `.md3-card` + modifiers, `.md3-button--filled|--tonal|--outlined|--text`, `.md3-outlined-textfield`.

Mapping rules below are deterministic: margin utilities map to a token-based replacement. The chosen token values are present in `tokens.css` and match existing visual distances used across templates.

---

## 1) Spacing utilities → Token-based replacements

Notes: tokens and their values (from `static/css/md3/tokens.css`):

| Token | Value |
|---|---:|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |

Selected canonical layout helpers (implemented in `static/css/md3/layout.css`):
- `.md3-page { padding: 0 var(--space-6); }` — edge padding uses `--space-6` (24px). Rationale: `.md3-container` and many components use 1.5rem / 24px already.
- `.md3-stack--page { margin-top: var(--space-8); }` — major page-level rhythm (32px).
- `.md3-stack--section { margin-top: var(--space-6); }` — intra-section spacing (24px) — chosen because `.mt-4` (1.5rem) occurrences are the most frequent gap found in templates.

Concrete mappings: utility -> canonical class / token

| Legacy | Replace with | Context / Files Found | Reasoning (value) |
|---|---|---|---|
| `.mt-1` (0.25rem = 4px) | Use `style`/component spacing or `margin-top: var(--space-1)` (or `.md3-space-1`) | templates & md3/layout.css | token: `--space-1` (4px)
| `.mt-2` (0.5rem = 8px) | `margin-top: var(--space-2)` or `.md3-space-2` | `templates/search/advanced.html` etc. | token: `--space-2` (8px)
| `.mt-3` (1rem = 16px) | `margin-top: var(--space-4)` / `.md3-space-4` | numerous templates (status messages) | token: `--space-4` (16px)
| `.mt-4` (1.5rem = 24px) | Prefer `.md3-stack--section` or `margin-top: var(--space-6)` | most common section spacing in templates (dominant) | token: `--space-6` (24px)
| `.mt-5` (3rem = 48px) | `margin-top: var(--space-12)` | used rarely in codebase; maps to large spacer | token: `--space-12` (48px)
| `.mt-6` (1.5rem / 24px) | `margin-top: var(--space-6)` | some templates and CSS variants | token: `--space-6` (24px)
| `.mt-8` (2rem = 32px) | `margin-top: var(--space-8)` | large section spacing in a few templates | token: `--space-8` (32px)

For bottom margins replace `.mb-*` using the same mapping from `*` → `--space-*` equivalents.

Inline styles (e.g. `style="margin-top: 1.5rem;"`) → replace with canonical classes or token-based helper classes such as `md3-space-6` or a semantic `.md3-stack--section` wrapper.

Shorthand `.m-auto / .mx-auto` → use `.md3-align--center` (added to `static/css/md3/layout.css`) — used to center cards instead of `m-auto`.

`.m-0` → remove or replace with no-margin intent in component markup. If consistent zero margin utility is needed add a *semantic* helper `.md3-reset-margin` (not added automatically) — prefer removing the margin where safe.

---

## 2) Card class mapping

| Legacy | Canonical | Context / Files | Notes |
|---|---|---|---|
| `.card` | `.md3-card` | `templates/pages/*`, `templates/_md3_skeletons/*` | Prefer `md3-card` naming for new templates; keep `.card` as temporary alias in CSS during migration.
| `.card-outlined` | `.md3-card md3-card--outlined` | many templates (auth, player, pages) | Existing `.card-outlined` works, but prefer the `.md3-card--outlined` modifier.
| `.card-elevated` | `.md3-card md3-card--elevated` | templates/pages/admin_dashboard.html etc. | Keep alias until full migration.
| `.card-filled` | `.md3-card md3-card--filled` | multiple templates | maps to tonal / filled background variant; canonicalize to `md3-card--filled`.
| `.card-tonal` / `.card-tonal-*` | `.md3-card--tonal-*` | templates using `card-tonal` | Map to `md3-card--tonal-*` variant naming.

Notes: `static/css/md3/components/cards.css` already contains both `.card-*` and `.md3-card` rules; codemod can convert templates to `.md3-card` variants safely while leaving behavior unchanged.

---

## 3) Buttons & destructive aliases

| Legacy | Canonical | Context | Notes |
|---|---|---|---|
| `.md3-button--contained` | `.md3-button--filled` | `static/css/md3/components/login.css` and occasional templates | `.md3-button--contained` implemented as a compatibility alias; codemod replace usage in templates and JS to `.md3-button--filled`.
| `.md3-button--destructive` / `.md3-destructive` | `.md3-button--danger` (preferred) or `.md3-button--filled.md3-button--danger` | Several templates & CSS | Recommendation: replace legacy aliases with the canonical modifier `.md3-button--danger`. Keep the compatibility alias in `components/buttons.css` only briefly until templates are migrated; prefer `.md3-button--danger` in new templates.

---

## 4) Token names (legacy → canonical)

The repo contains older token names in docs/CSS/JS e.g., `--md3-space-*`, `--md3-color-*`. We added a temporary compatibility shim `static/css/md3/tokens-legacy-shim.css` which maps the common legacy names to canonical tokens.

Concrete token mappings (representative)

| Legacy token | Canonical token (use this) | Files found (examples) |
|---|---|---|
| `--md3-space-1` → `--md3-space-12` | `--space-1` → `--space-12` | `static/css/player-mobile.css`, `docs/*` — many usages | keep shim until templates migrated; update code to prefer `--space-*` names.
| `--md3-color-primary` | `--md-sys-color-primary` | `static/css/player-mobile.css`, some docs | canonicalize to `--md-sys-color-*` tokens.
| `--md3-color-on-surface-variant` | `--md-sys-color-on-surface-variant` | docs & CSS | prefer `--md-sys-*` tokens in new templates/CSS.

Note: the shim file `tokens-legacy-shim.css` maps many common legacy names to the canonical tokens. The codemod should replace legacy token names in CSS and JS but keep the shim until the changes settle.

---

## 5) JS & dynamic templates

Findings:
- `static/js/main.js` reads `--md3-mobile-menu-duration` — map to `--md3-mobile-menu-duration` shim value or migrate code to read from canonical tokens (introduce `--ui-mobile-menu-duration` or keep shim value). 
- For JS that injects HTML with classes / inline styles (`cqlBuilder.js`, `renderBar.js`) replace strings like `class="... mb-3"` with `class="... md3-space-3"` or wrap elements in `.md3-stack--section` as appropriate.

---

## 6) Recommended codemod strategy (safe, incremental)

1. Add linting (see `docs/md3-template/md3_lint_report.md`) to fail new occurrences.
2. Run a codemod in batches: replace class strings in templates → run visual spot-checks + browser regression tests.
3. Leave compatibility shim files (`tokens-legacy-shim.css`) and deprecated aliases in component CSS until repo-level lint shows zero legacy occurrences.

Example codemod cases to automate (script-friendly):
- Replace `class="([^\"]*)\bmt-([0-9])\b([^\"]*)"` → `replace with margin: var(--space-X) or better: wrap with `.md3-stack--section` where appropriate`.
- Replace `class=\"([^\"]*)\bcard\b([^\"]*)\"` → `replace with .md3-card` and add `.md3-card--filled/outlined` based on original class.
- Replace `--md3-([a-z0-9-]+)` occurrences to canonical `--space-*` or `--md-sys-*` equivalents per the token mapping table.

---

If you want, I can now:
- implement `scripts/md3-codemod.py` that performs the most frequent/low-risk replacements automatically and creates a detailed GitHub PR for review, or
- implement `scripts/md3-lint.py` and add a CI step to block new legacy introductions immediately (recommended first step).
