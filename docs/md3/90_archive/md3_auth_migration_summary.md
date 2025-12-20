# MD3 Auth & Dialogs Migration — Summary

This document summarizes the work performed to migrate auth-related UI (login, profile, password, admin user management) and related dialogs/sheets to the canonical MD3 standard.

✅ Scope: templates in `templates/auth/` and auth-related JS modules under `static/js/auth` plus sheet/partial fragments and relevant MD3 components.

---

## Files migrated / added

Templates modified (canonicalization to `md3-page` / `md3-auth-card` / `md3-outlined-textfield` / dialog surfaces):
- templates/auth/login.html (restructured to `md3-page` > `main` > `section`, `md3-card md3-card--outlined md3-auth-card`)
- templates/auth/_login_sheet.html (converted to canonical `.md3-sheet` pattern; kept legacy classes for compatibility)
- templates/partials/status_banner.html (login sheet fragment updated to `.md3-sheet` with compatibility classes)
- templates/auth/password_forgot.html (auth card + outlined textfields)
- templates/auth/password_reset.html (auth card updated to md3-auth-card correctness)
- templates/auth/account_profile.html (cards updated; destructive buttons adjusted; dialog surface normalization)
- templates/auth/account_password.html (auth card updated)
- templates/auth/account_delete.html (auth card + destructive button + outlined field)
- templates/auth/admin_users.html (admin user table/card normalized; dialogs updated to use dialog surface + canonical titles)

Skeletons added to `templates/_md3_skeletons/`:
- auth_login_skeleton.html
- auth_profile_skeleton.html
- auth_dialog_skeleton.html

CSS changes (canonical helper + compatibility aliases):
- static/css/md3/layout.css — added `.md3-auth-card { max-width: 480px; margin: 0 auto }` helper
- static/css/md3/components/login.css — added alias selectors so `.md3-sheet`/`.md3-sheet__*` work alongside legacy `.md3-login-sheet` selectors
- static/css/md3/components/status-banner.css — same aliasing to support both sheet flavors

JS changes (selectors / initialization / compatibility):
- static/js/modules/auth/login-sheet.js — queries now support both legacy and new `.md3-sheet__close-button` / `.md3-sheet__backdrop` selectors
- static/js/modules/navigation/app-bar.js — supports new `.md3-sheet__backdrop` selector as well as legacy `.md3-login-backdrop`

Other JS modules were checked and largely remained compatible (selectors use IDs and data attributes that were preserved).

Lint & CI:
- scripts/md3-lint.py — extended with auth-specific heuristic checks (detect leftover .card without md3-card, legacy `md3-button--contained`, missing `md3-outlined-textfield` usage, and dialogs missing `md3-dialog__surface` or `md3-title-large`). The script was run and reported warnings only (no blocking errors).

---

## Notes & follow-ups

- For compatibility, both the legacy `md3-login-sheet*` classes and the new `md3-sheet*` classes are supported in templates/components/JS. This can be cleaned up later after a window where tests/UX are stable.

- Remaining TODOs:
  - Decide whether to rename some remaining `card-*` aliases (e.g. `card-outlined`) across the repo; md3-lint will flag these.
  - Add stricter unit/e2e tests for login-sheet selectors to use the new `md3-sheet` classes (update e2e tests where they assert legacy selectors).
  - Consider converting remaining legacy button classes to canonical `.md3-button--filled|--outlined|--text` across the repo.

---

If you'd like, I can:
- open a PR with these changes (include diff, automated checks, and a short README for reviewers),
- update E2E tests to reference the new classes, or
- make the CSS changes stricter (remove legacy alias selectors) in a follow-up after CI and tests are stable.

Let me know which direction you prefer for cleanup and PR workflow. 🎯
