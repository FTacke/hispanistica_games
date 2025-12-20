# MD3 Text Pages Standard — CO.RA.PAN

This file documents the canonical Text Pages standard for CO.RA.PAN. It defines scope, structure, hero conventions, heading hierarchy, divider rules and a short workflow for creating new text pages.

## 1. Scope

Applies to templates in `templates/pages/` that are content-heavy (text pages), including but not limited to:

- `templates/pages/impressum.html`
- the privacy policy template (e.g. `privacy.html` / `datenschutz.html`)
- all `templates/pages/proyecto_*.html`
- any other templates that include `class="md3-text-page"` in their markup

Not in scope: search pages, admin pages/dashboards, dialogs, JS templates and components.

## 2. Page structure (canonical)

Text pages must follow the canonical layout:

```html
<div class="md3-page">
  <header class="md3-page__header">
    <!-- Card Hero: icon, eyebrow, h1 -->
  </header>

  <main class="md3-text-page">
    <section class="md3-text-section">
      <!-- Content blocks: H2, paragraphs, lists, H3 subheadings -->
    </section>
  </main>
</div>
```

Notes:
- `md3-text-content` inside `main` is used to constrain max-width and center content.
- Use `section.md3-text-section` for each main content block to give consistent spacing.

## 3. Hero convention

The hero remains the H1 for the page and must not be changed. Hero composition:

- Eyebrow: `p` or `span` with `class="md3-body-small md3-hero__eyebrow"` for the small eyebrow/categorization
- Icon: round icon element using Material Symbols in `.md3-hero__icon` (40px container)
- Title: `<h1 class="md3-headline-medium md3-hero__title">` (leave unchanged)

Keep hero purely presentational and do not add structural subsections there.

## 4. Headings hierarchy in `<main>`

- Top-level sections under the hero must use H2 as the logical top level of main content.
- H2 class signature (required): `class="md3-title-large md3-section-title"`
- Subsections must use H3 with the signature: `class="md3-title-medium md3-subsection-title"`
- Do not use H4–H6 inside the main content. If deeper nesting is required, prefer H3 + smaller visual affordances (lists, dt/dd, bold sub-headings), but not H4+.

Rationale:
- Keeps a maximum of two structural levels under hero (H2/H3) for accessibility and predictable layout.

## 5. Divider rule (systematic only)

Dividers (e.g. `<hr>`, `.page-divider`, `.md3-text-section--divider`) are allowed only when used systematically across the page — e.g., if you have a divider immediately preceding each H2 and the divider count equals the H2 count.

If the pattern is not consistent (dividers scattered or used as decorative separators inside paragraphs), remove the divider and rely on `section` spacing to create rhythm.

## 6. CSS helpers (tokens-only)

Text pages should rely on tokens in `static/css/md3/tokens.css` and helper classes in the MD3 CSS:

- `.md3-section-title` — color: `var(--md-sys-color-primary)`; spacing: `var(--space-8)` / `var(--space-3)`
- `.md3-subsection-title` — color: `var(--md-sys-color-on-surface)`; spacing: `var(--space-6)` / `var(--space-2)`

Do not hardcode colors or absolute px — use the canonical tokens.

## 7. How to add a new Text Page (quick guide)

1. Copy `templates/_md3_skeletons/page_text_skeleton.html` to `templates/pages/your_new_page.html`.
2. Update the hero title (H1) and eyebrow/icon as needed — leave H1 class as `md3-headline-medium`.
3. Inside `<main class="md3-text-page">`, add content using `section class="md3-text-section"` and structure headings using H2/H3 conventions above.
4. Avoid H4/H5/H6 inside main. Use lists and definition lists for structure instead.
5. Run the guard / linter locally (`python scripts/md3-textpages-guard.py` or `python scripts/md3-lint.py`) to check compliance.

## 8. Enforcement & CI

The `scripts/md3-textpages-guard.py` (see repo) validates the templates against this standard and writes a markdown report to `docs/md3-template/md3_textpages_guard_report.md`. The `scripts/md3-lint.py` calls the guard as part of linting and the CI job is configured to run the lint when `templates/pages/` are changed. The guard will produce FAILURE on structure and heading mismatches and WARN on divider anomalies.

---

If you need adjustments to the visual tokens (e.g. `md3-section-title` spacing) update `static/css/md3/components/text-pages.css` and rerun the guard to verify changes.
