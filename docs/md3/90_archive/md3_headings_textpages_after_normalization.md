# MD3 Headings Normalization — Text Pages (after run)

Summary of the automated normalization run that ensures consistent H2/H3 usage in text pages (only templates under `templates/pages/` that are content text pages).

Scope: templates/pages/* (only text pages - mission targets: Impressum, Privacy, Guía, and the Proyecto pages)

---

## Files processed and results

| Template | H2 count (main) | H3 count (main) | Dividers removed? | Notes / Manual review |
|---|---:|---:|:---:|---|
| templates/pages/impressum.html | 5 | 3 | Yes (removed `md3-page__divider`) | H3 classes updated to `md3-subsection-title`; body text set to `md3-body-large`.
| templates/pages/privacy.html | 8 | 0 | Yes (removed `md3-text-section--divider`) | Numbered H2 retained (1..8). Verified no H4/H5 present.
| templates/pages/corpus_guia.html | 4 | 3 | Yes (removed `<hr class="md3-divider">`) | H3 updated; intro paragraph kept.
| templates/pages/proyecto_como_citar.html | 6 | 3 | No (no unsystematic dividers found) | H3 inside cards kept and annotated with `md3-subsection-title`.
| templates/pages/proyecto_diseno.html | 4 | 0 | No | Clean conversion of H2s to `md3-section-title` and sections normalized.
| templates/pages/proyecto_estadisticas.html | 2 | 0 | No | Section structure preserved; H2 normalized.
| templates/pages/proyecto_overview.html | 4 | 0 | Yes (removed `md3-text-section--divider`) | References moved to normal section spacing.
| templates/pages/proyecto_quienes_somos.html | 1 | 0 | No | Single H2 (Credits) normalized.
| templates/pages/proyecto_referencias.html | 1 | 0 | Kept (systematic) | Kept `md3-text-section--divider` because `divider count==H2 count` and it precedes the H2 (systematic case).

---

## Rules applied (tight summary)
- H1 in the Hero header was left unchanged.
- All top-level section headings in `<main class="md3-text-page">` were normalized to:
  - H2: `<h2 class="md3-title-large md3-section-title">…</h2>` (H2s are now typographically larger than H3)
  - H3: `<h3 class="md3-title-medium md3-subsection-title">…</h3>`
- H4/H5/H6 inside `<main>` were promoted to H3 where necessary. (No H4/H5 detected in the target pages.)
- Dividers (`<hr>` or `md3-text-section--divider`) were removed unless there was a clear system (count(dividers) == count(H2) and each divider just precedes H2) — in that case they are kept unchanged.

- Sections: All section containers in target text pages were unified to use `<section class="md3-text-section">` for consistent spacing and structure (privacy already used this pattern and was used as the canonical reference).

---

## Manual review required (if any)
- No file flagged as requiring manual structural review in this pass. The pages that contained more complex nested content (e.g., many lists or code blocks) were updated conservatively and appear consistent.

---

If you want, next steps I can take:
- Add an md3-lint rule to enforce the `H2/H3` signature (only for `templates/pages/`).
- Perform a visual QA pass (browser screenshots / Playwright checks) to confirm spacing and typography.

Additionally done in this pass:
- Added a canonical skeleton matching the standard: `templates/_md3_skeletons/page_text_skeleton.html`.
- Added an automated guard script `scripts/md3-textpages-guard.py` that validates text pages and writes `docs/md3-template/md3_textpages_guard_report.md`. The general `scripts/md3-lint.py` now runs the guard and treats STRUCTURE/HEADING failures as lint errors.

If you'd like I can create a PR with these changes and the report.
