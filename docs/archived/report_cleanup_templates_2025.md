# Template Cleanup Report

The following templates have been identified as unused and removed from the codebase.

## Removed Templates

### `templates/pages/corpus.html`
- **Reason**: Replaced by `templates/search/advanced.html`.
- **Evidence**: The route `/corpus/` redirects to `/search/advanced`. The `_render_corpus` function in `src/app/routes/corpus.py` is unused.

### `templates/partials/_navbar.html`
- **Reason**: Replaced by `templates/partials/_top_app_bar.html` and `templates/partials/_navigation_drawer.html`.
- **Evidence**: Only referenced in documentation and migration reports. `base.html` uses `_top_app_bar.html`.

### `templates/partials/theme_toggle.html`
- **Reason**: Unused component.
- **Evidence**: Theme toggle logic is implemented directly in `base.html` and `static/js/theme.js`. No `include` or `render_template` references found in code.

### `templates/search/debug_bls.html`
- **Reason**: Debug tool with no active route.
- **Evidence**: Referenced in docs as `http://localhost:8000/search/debug_bls/`, but no corresponding route exists in `src/app/routes/`.

## Removed Static Assets

### `static/js/modules/corpus/`
- **Reason**: Legacy JS modules for the old corpus page.
- **Evidence**: Files contain `console.warn('[DEPRECATED] ...')`. Referenced only by the unused `pages/corpus.html`.

