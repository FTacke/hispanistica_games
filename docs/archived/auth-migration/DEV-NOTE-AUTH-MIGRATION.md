# DEV NOTE — Auth Migration (feature/auth-migration)

Kurzüberblick (Kurz, prägnant):

- Branch: feature/auth-migration — final cleanup and hardening tasks applied.
- Completed items: Logout UX, CSP hardening (scripts & styles), Playwright E2E + CI, removal of env-based auth code paths, audit/anonymization retention job & CLI, refactor auth templates to MD3.

Was getan (Technisch, Datei-Referenzen):

1) Logout UX
- Client-side logout implementation: `static/js/logout.js` (fetch + reload) and UI hooks added to templates/partials.
- Tests: `tests/test_logout_ui.py` (unit/UI smoke test).

2) CSP Hardening
- Moved inline scripts to modules; removed `'unsafe-inline'` for `script-src` previously.
- Removed `'unsafe-inline'` for `style-src` in `src/app/__init__.py`.
- Tests: `tests/test_security_headers.py` covers both script-src and style-src now.

3) E2E Playwright
- Added Playwright test: `tests/e2e/playwright/auth.spec.js` and CI job in `.github/workflows/ci.yml`.
- Seed helper: `scripts/seed_e2e_db.py`.

4) Remove legacy env-based auth
- Removed automatic loading of `passwords.env` (no more auto dotenv in `src/app/config/__init__.py`).
- Removed AUTH_BACKEND feature-flag from the runtime control code and deprecated env path checks.
- Updated docs and README to reflect DB-only auth default.

5) Audit log retention & anonymization
- Config: `AUTH_ACCOUNT_ANONYMIZE_AFTER_DAYS` default 30 days (config in `src/app/config/__init__.py`).
- Implemented anonymization job in `src/app/auth/services.py` (anonymize_soft_deleted_users_older_than).
- CLI: `flask auth-anonymize` (
`src/app/__init__.py` registers command).
- Standalone script: `scripts/anonymize_old_users.py`.
- Tests: `tests/test_privacy_compliance.py` (user anonymization flow + retention job).

6) Templates / MD3 quality
- Converted auth templates to MD3 consistent layout (now extend `base.html`):
  - `templates/auth/account_profile.html`
  - `templates/auth/account_password.html`
  - `templates/auth/account_delete.html`
  - `templates/auth/admin_users.html`
  - `templates/auth/password_forgot.html`
  - `templates/auth/password_reset.html`
- Kept behavior intact while improving structure and removing inline JS.

Design / Theming (MD3) — Quick summary
- Updated templates: `templates/auth/login.html`, `templates/auth/password_forgot.html`, `templates/auth/password_reset.html`, `templates/auth/account_profile.html`, `templates/auth/account_password.html`, `templates/auth/account_delete.html`, `templates/auth/admin_users.html` to follow the same MD3 layout, tokens and component usage.
- Central theme / token files live in `static/css/md3/tokens.css` (core MD3 roles & typography) and `static/css/md3/components/*` — there is also `static/css/app-tokens.css` for small project-specific token overrides and `static/css/md3/components/layout-helpers.css` for tiny layout utilities (spacing & responsive helpers).
- How to adapt the design for a new project: change colors/typography in `static/css/md3/tokens.css` or override values in `static/css/app-tokens.css`. Templates and components consume tokens (no hard-coded colors or spacing), so swapping theme variables is sufficient to retheme the entire UI.

Tests added/updated (unit & infra)
- `tests/test_logout_ui.py` — logout UI markers + flow
- `tests/test_security_headers.py` — CSP checks for script-src and style-src
- `tests/test_privacy_compliance.py` — anonymization + retention job
- Playwright E2E: `tests/e2e/playwright/auth.spec.js` (smoke test)

Notes / Remaining work
- There remain non-auth inline styles in a few search & stats UI fragments (static/js templates). These should be migrated away from inline style attributes to CSS classes for full CSP compliance across the entire app.
- Playwright E2E in CI is set up but may need iterative stabilization across OS matrices and CI runners for flakiness; monitor CI runs and add retries or additional waits as needed.

If you'd like, I can now:
- Remove the last inline-style occurrences app-wide (search+replace to CSS classes in static/js) so `style-src 'unsafe-inline'` can be fully removed from the docs and any remaining comments.
- Run a full test suite or CI smoke in a disposable environment.

For local development and quick onboarding, `startme.md` now contains a short 5-minute quickstart for both a SQLite-based and a Postgres (docker) dev flow. If you plan to reuse this repository as a template, `docs/how-to/template-usage.md` summarizes the minimal steps to rebrand and initialize auth in a new project.

If you want me to continue, say which of the remaining items is highest priority next (e.g., global inline style removal, Playwright test hardening, or add a scheduled worker job for anonymization in deployment manifests).

---

Dev convenience: Resetting SQLite-based auth (Variant A)

Added a small convenience flow for local devs so you can always get a clean
auth DB and a working admin user with a single command:

1. `make auth-reset-dev` — deletes `data/db/auth.db`, reapplies the sqlite
  migration and creates an admin user `admin` using the password provided via
  `START_ADMIN_PASSWORD` (fallback: `change-me`).

Mini self-tests (manual):

1. Run `make auth-reset-dev` → start the app → login with `admin` / your password
  (or `change-me`). This should succeed.
2. Try entering a wrong password multiple times to trigger the lockout.
  Then run `make auth-reset-dev` again — the admin account must be unlocked and
  accept the correct password after the reset.

These helpers are intentionally safe for dev — they do not change auth core
logic or production migrations; use them to recover a developer environment.