# Special CSS Zone

This directory contains CSS files that are **intentionally excluded** from standard MD3 structural compliance checks.

## Excluded Files

These files use legacy `--md3-*` tokens and may have `!important` declarations that are necessary for their specific use cases:

### From `static/css/` (referenced, not moved):
- `player-mobile.css` — Mobile-specific player overrides
- `editor.css` — Editor component styles
- Additional player files as needed

## Why These Are Excluded

1. **Complexity**: Player and editor components have complex interactions with third-party libraries (wavesurfer.js, etc.)
2. **Specificity**: These files require high specificity to override library defaults
3. **Scope**: They only affect specific, isolated pages (player.html, editor.html)
4. **Risk**: Migrating tokens without thorough testing could break critical functionality

## Token Migration Status

| File | Legacy Tokens (`--md3-*`) | Migration Status |
|------|---------------------------|------------------|
| `player-mobile.css` | ~50+ | ⏳ Deferred |
| `editor.css` | TBD | ⏳ Deferred |

## Future Work

When resources allow, these files should be migrated to use:
- `--md-sys-color-*` instead of `--md3-color-*`
- `--space-*` instead of `--md3-space-*`

This migration should be done carefully with thorough testing on actual player/editor pages.
