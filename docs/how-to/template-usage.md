---
title: "Using this repo as a template"
status: active
owner: documentation
updated: "2025-11-23"
tags: [template, auth, md3, onboarding]
links:
  - ../index.md
  - ../auth-migration/auth-migration.md
  - ../../startme.md
---

# Using this repository as a template for new projects

This repository contains a full web-app template with a modern DB-backed authentication system (JWT + refresh tokens, rotation, admin UI), a Material Design 3 UI foundation, privacy-friendly defaults and a set of dev convenience scripts. Use it as a base when you want a webapp with secure authentication and a short bootstrap path.

## Why use this template

- Security-first Auth (DB, short-lived JWT, refresh token rotation, audit/anonymization)
- Admin UI and RBAC scaffolding
- MD3-based front-end tokens/components so theming is easy
- CI and Playwright E2E jobs included as examples

## Quick checklist to adapt for a new project

1) Fork/clone this repository
2) Search & replace the project name/branding (README, templates, title tags)
3) Update theme tokens (see `static/css/md3/tokens.css` and `static/css/app-tokens.css`)
4) Update static/logo images located in `static/img/` and header/footer templates
5) Customize `templates/pages/privacy.html` and `templates/pages/impressum.html` with your legal texts
6) Configure environment variables (see examples below). Run DB migrations and create an admin account
7) Remove or adapt corpus-specific code (BlackLab search/index details) to your app

## Environment & secrets you must change

Always configure these values for a new project deployment:

- FLASK_SECRET_KEY — session signing key
- JWT_SECRET or RSA_PRIVATE_KEY — change to a secure key stored in secret manager
- AUTH_DATABASE_URL — SQLAlchemy URL for your auth DB
- AUTH_HASH_ALGO — `argon2` (recommended) or `bcrypt`
- JWT_COOKIE_SECURE — set true in production

## Auth bootstrapping for a new project

1) Apply DB migrations for the auth schema (see `migrations/`):
   - SQLite: `python scripts/apply_auth_migration.py --db data/db/auth.db`
   - Postgres: apply `migrations/0001_create_auth_schema_postgres.sql` via psql or Alembic
2) Create the initial admin account (use secrets or CI-managed values):
   - `START_ADMIN_USERNAME` and `START_ADMIN_PASSWORD` are used by `scripts/create_initial_admin.py`
3) Optional: seed extra demo users for tests (`scripts/seed_e2e_db.py`)

## What to keep and what to remove

- Keep: `src/app/auth` (controllers, models, middleware), `templates/auth/*` (UI), `scripts/*` helpers
- Replace: any application-specific content (search corpus, transforms, custom routes) — these are not required in new apps

## Recommended first PR checklist (for your new project)

- [ ] Replace project name & identifiers
- [ ] Update license & README
- [ ] Configure CI secrets (JWT secret, DB credentials)
- [ ] Run the full test-suite and Playwright E2E locally/CI
- [ ] Validate CSP and cookie settings in staging (JWT_COOKIE_SECURE set appropriately)

## Links

- Start here for local dev: `startme.md`
- Auth migration & rationale: `docs/auth-migration/auth-migration.md`
