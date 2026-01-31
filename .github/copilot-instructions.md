# Copilot Instructions for Games.Hispanistica

## Project Overview

**Games.Hispanistica** is a Flask-based educational web application for interactive Spanish linguistics quizzes. This is a **modular, PostgreSQL-only** app with server-side rendering (Jinja2) and Material Design 3 (MD3) styling.

## Architecture

### Backend: Modular Flask App with Game Blueprints

- **Application Factory**: [src/app/__init__.py](../src/app/__init__.py) creates Flask app via `create_app(env)`. All blueprints are auto-discovered from [src/app/routes/__init__.py](../src/app/routes/__init__.py).
- **Game Modules**: Self-contained blueprints in `game_modules/`. Example: `game_modules/quiz/` has models, services, routes, templates, and styles.
- **Dual Database**: Two PostgreSQL databases:
  - **Auth DB** (port 54321): User authentication, roles, JWT tokens (`src/app/auth/`)
  - **Quiz DB** (port 54322): Quiz players (separate from webapp users), questions, runs, scores (`game_modules/quiz/models.py`)
- **Quiz Player Auth**: Separate authentication from webapp users. Players use pseudonym + 4-digit PIN (stored in `quiz_players` table, not `auth.users`). Session managed via `quiz_session_token` cookie.

### Frontend: Server-Rendered + Vanilla JS

- **Templates**: Jinja2 in `templates/`. Base template is `templates/base.html` (includes navbar, drawer, footer).
- **MD3 Design System**: Strict Material Design 3 token architecture:
  - **Canonical tokens**: `--md-sys-color-*`, `--md-sys-typescale-*`, `--space-*` in [static/css/md3/tokens.css](../static/css/md3/tokens.css)
  - **NEVER use legacy `--md3-*` tokens** (deprecated, shim exists in `tokens-legacy-shim.css` only for backward compat)
  - **Components**: MD3 components in [static/css/md3/components/](../static/css/md3/components/) (buttons, cards, forms, etc.)
  - **Branding**: Override tokens in [static/css/branding.css](../static/css/branding.css) (ONLY `:root` variable declarations allowed, no component rules)
- **JavaScript**: Vanilla JS modules in `static/js/modules/`. No frameworks. Uses ES6 modules with explicit imports.

## Critical Developer Workflows

### Daily Development Start

```powershell
.\scripts\dev-start.ps1
```

This script:
1. Starts Docker PostgreSQL containers (Auth + Quiz DBs)
2. Activates `.venv` Python environment
3. Initializes Auth DB schema (if needed)
4. Runs Quiz auto-pipeline: normalize → seed → prune (if `QUIZ_DEV_SEED_MODE` set)
5. Starts Flask dev server on port 8000 (or next available port)

**Environment Variables**:
- `QUIZ_DEV_SEED_MODE=single` → Seed one quiz topic from `content/quiz/topics/*.json`
- `QUIZ_DEV_SEED_MODE=all` → Seed all topics
- `QUIZ_MECHANICS_VERSION=v2` (default) → Use v2 mechanics (10 questions per run)

**Login (DEV)**: Username `admin_dev` / Password `0000`

### Testing

```powershell
pytest -v
```

Tests are in `tests/`. Key test files:
- `test_import_service.py` → Quiz content import/publish pipeline
- `test_quiz_release_filtering.py` → Release-based filtering

Use `runTests` tool when available instead of terminal commands.

### Production Content Deployment

**DEV vs PROD workflows are strictly separated**:
- **DEV**: Content auto-synced from `content/quiz/topics/*.json` via `dev-start.ps1` (automatic normalize/seed/prune)
- **PROD**: Content uploaded via rsync → imported via CLI → published via Admin Dashboard

**Production pipeline** (see [startme.md](../startme.md) and [docs/components/quiz/OPERATIONS.md](../docs/components/quiz/OPERATIONS.md)):
1. Create release folder: `quiz_releases/release_YYYYMMDD_HHMM/units/` + `/audio/`
2. rsync upload to server
3. Import: `python manage.py import-content --units-path media/current/units --audio-path media/current/audio --release 2026-01-06_1430`
4. Publish: `python manage.py publish-release --release 2026-01-06_1430`

## Project-Specific Conventions

### 1. Documentation Standards (CRITICAL)

All Markdown documentation **MUST** follow strict conventions in [CONTRIBUTING.md](../CONTRIBUTING.md):

- **Front-matter required**: Every `.md` file needs YAML front-matter with `title`, `status`, `owner`, `updated`, `tags`, `links`
- **File naming**: `kebab-case`, ASCII-only (e.g., `authentication-flow.md`, NOT `Authentication_Flow.md`)
- **Directory structure**: Docs organized by purpose: `concepts/`, `how-to/`, `reference/`, `operations/`, `troubleshooting/`, `decisions/`, `archived/`
- **Single-topic principle**: Files >1200 words should be split by logical domain
- **"Siehe auch" section**: Every doc must end with related links section

**Example front-matter**:
```yaml
---
title: "Authentication Flow"
status: active
owner: backend-team
updated: "2025-11-10"
tags: [auth, jwt, security]
links:
  - reference/api-auth-endpoints.md
---
```

### 2. Quiz Content Schema (v1 vs v2)

Quiz content in `content/quiz/topics/*.json` uses versioned schemas:
- **v2 (current)**: 10 questions per unit (5 difficulty levels × 2 questions each). Detected by `quiz_unit_version: "2.0.0"`
- **v1 (legacy)**: Variable questions per difficulty. Default if no `quiz_unit_version` field.

**Always normalize before seeding**:
```powershell
python scripts/quiz_units_normalize.py --write --topics-dir content/quiz/topics
```

This generates missing ULIDs for questions and creates `questions_statistics` for leaderboard display.

### 3. CSS Architecture Rules

- **Layer separation**: Tokens → Branding → Components → Page-specific
- **branding.css restriction**: ONLY `:root { --brand-* }` and `:root { --md-sys-* : var(--brand-*) }` allowed. NO `.class` or `#id` selectors.
- **Validation**: Run `.\scripts\check-css-architecture.ps1` to verify layer violations

### 4. Game Module Registration Pattern

To add a new game module:
1. Create `game_modules/my_game/__init__.py` with lazy-loaded blueprint:
   ```python
   def __getattr__(name: str):
       if name == "my_game_blueprint":
           from .routes import blueprint as my_game_blueprint
           return my_game_blueprint
       raise AttributeError(f"module {__name__} has no attribute {name}")
   ```
2. Flask auto-discovers blueprints via `register_blueprints()` in [src/app/routes/__init__.py](../src/app/routes/__init__.py)

### 5. Database Migrations (PostgreSQL Only)

- **Auth DB**: Migrations in `src/app/auth/migrations/` (applied via `scripts/init_auth_db.py`)
- **Quiz DB**: Migrations in `game_modules/quiz/migrations/` (applied via `scripts/init_quiz_db.py`)
- **NO SQLite support**: All models require PostgreSQL features (ARRAY, JSONB, enums)

### 6. PowerShell Script Conventions

All dev scripts in `scripts/*.ps1` follow these patterns:
- **Error handling**: `$ErrorActionPreference = 'Stop'`
- **Repository root**: `$repoRoot = Split-Path -Parent $PSScriptRoot; Set-Location $repoRoot`
- **127.0.0.1 not localhost**: Use `127.0.0.1` for PostgreSQL to avoid DNS resolution issues with psycopg on Windows
- **Help blocks**: `.SYNOPSIS`, `.DESCRIPTION`, `.EXAMPLE` at top of file

## Integration Points

### External Dependencies

- **PostgreSQL**: Two databases (Auth + Quiz) managed via `docker-compose.dev-postgres.yml`
- **argon2-cffi**: Password hashing (critical dependency, verify with `_verify_critical_dependencies()` in `src/app/__init__.py`)
- **Flask-JWT-Extended**: JWT token management for webapp authentication (NOT used for quiz player auth)
- **SQLAlchemy**: ORM with PostgreSQL-specific features (ARRAY, JSONB)

### Cross-Component Communication

- **Auth → Quiz**: Separate authentication domains. Webapp admins (JWT) can manage content, but quiz players use PIN-based sessions.
- **Quiz Run State**: Stored in `quiz_runs` table with JSONB `question_sequence`, checked by `services.py` before each question/answer.
- **Leaderboard**: Real-time via `quiz_scores` table, indexed by `(topic_id, total_score DESC, tokens_count DESC, created_at DESC)`

## Key Files Reference

| Path | Purpose |
|------|---------|
| [startme.md](../startme.md) | Daily dev workflow (MUST READ) |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Documentation conventions (strict rules) |
| [manage.py](../manage.py) | Production CLI (import/publish content) |
| [scripts/dev-start.ps1](../scripts/dev-start.ps1) | Dev server start (PostgreSQL + auto-seed) |
| [src/app/__init__.py](../src/app/__init__.py) | Application factory |
| [game_modules/quiz/services.py](../game_modules/quiz/services.py) | Quiz business logic (player auth, run management) |
| [game_modules/quiz/models.py](../game_modules/quiz/models.py) | Quiz database models (PostgreSQL-only) |
| [docs/components/quiz/README.md](../docs/components/quiz/README.md) | Quiz module overview |
| [docs/components/quiz/ARCHITECTURE.md](../docs/components/quiz/ARCHITECTURE.md) | Quiz mechanics, scoring, invariants |

## Anti-Patterns to Avoid

1. **DO NOT use SQLite for quiz**: Models require PostgreSQL ARRAY/JSONB types
2. **DO NOT use legacy `--md3-*` CSS tokens**: Always use `--md-sys-*` canonical tokens
3. **DO NOT add component rules to branding.css**: Only `:root` variable declarations allowed
4. **DO NOT mix DEV and PROD workflows**: Auto-seeding is DEV-only; PROD uses rsync + import CLI
5. **DO NOT skip normalization**: Always run `quiz_units_normalize.py` before seeding new content
6. **DO NOT create docs without front-matter**: All `.md` files need YAML metadata (see CONTRIBUTING.md)
7. **DO NOT use uppercase in doc filenames**: Always `kebab-case` (e.g., `auth-flow.md`, not `Auth_Flow.md`)

## Quick Start Checklist for New Contributors

1. Read [startme.md](../startme.md) for dev setup
2. Run `.\scripts\dev-start.ps1` to start local environment
3. Review [CONTRIBUTING.md](../CONTRIBUTING.md) for documentation standards
4. Check [docs/components/quiz/README.md](../docs/components/quiz/README.md) for quiz architecture
5. Validate CSS with `.\scripts\check-css-architecture.ps1` after changes
6. Test with `pytest -v` before committing
