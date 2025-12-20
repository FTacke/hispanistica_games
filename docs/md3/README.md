# MD3 Design System Documentation

**Version:** 3.0  
**Last Updated:** 2025-11-26

This is the consolidated MD3 documentation for the CO.RA.PAN webapp and reusable design system.

---

## Document Structure

| Document | Purpose |
|----------|---------|
| [00_overview.md](./00_overview.md) | Quick introduction to the MD3 system: tokens, components, principles |
| [10_md3_spec_core.md](./10_md3_spec_core.md) | **Project-agnostic** MD3 specification: tokens, components, layout patterns, rules |
| [20_app_spec_corapan.md](./20_app_spec_corapan.md) | **CO.RA.PAN-specific** layer: token values, custom components, language rules |
| [30_patterns_and_skeletons.md](./30_patterns_and_skeletons.md) | Skeleton templates and page patterns for new pages |
| [40_tooling_and_ci.md](./40_tooling_and_ci.md) | Guard/lint scripts, CI integration, hard rules |
| [background-color-standard.md](./background-color-standard.md) | **Background Color Standard** – Kanonische Token-Nutzung für Backgrounds |
| [90_archive/](./90_archive/) | Historical documents (audits, migration reports) – for reference only |

---

## Quick Start for New Developers

1. Read **00_overview.md** for a 5-minute introduction
2. Study **10_md3_spec_core.md** for component specifications
3. Check **30_patterns_and_skeletons.md** to find the right skeleton for your page
4. Run `python scripts/md3-lint.py` before committing

## Quick Start for New Projects

To reuse this design system in a new project:

1. Copy `static/css/md3/` (tokens, typography, components)
2. Copy `templates/_md3_skeletons/` as starting templates
3. Use **10_md3_spec_core.md** as your specification
4. Create your own **20_app_spec_*.md** for project-specific extensions

---

## Key Principles

- **Tokens are the source of truth** – all colors, spacing, elevation via CSS custom properties
- **One canonical markup per component** – no alternative patterns allowed
- **No inline styles, no hex colors** – enforced by linting
- **Skeleton-first development** – new pages start from skeleton templates
