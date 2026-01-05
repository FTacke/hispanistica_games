# games_hispanistica Documentation

**Version:** Based on code state as of 2025-01-24  
**Principle:** This documentation describes **exclusively the current codebase**. No roadmaps, no archived decisions, no historical notes.

---

## What is games_hispanistica?

**games_hispanistica** is a web-based quiz game platform for learning Spanish language and culture. Built with Flask, PostgreSQL, and Material Design 3.

**Tech Stack:**
- **Backend:** Python 3.12+, Flask 3.1+, SQLAlchemy 2.0+
- **Database:** PostgreSQL (JSONB for quiz content)
- **Auth:** JWT tokens (Flask-JWT-Extended) + Session-based
- **Frontend:** Jinja2 templates, vanilla JavaScript, MD3 design tokens
- **Deployment:** Docker Compose, GitHub Actions CI/CD

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  HTTP Client (Browser)                          │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Flask Application (app-core)                   │
│  ┌──────────────────────────────────────────┐  │
│  │  Routes (Blueprints)                     │  │
│  │  - public (/, /health, /projekt/*)       │  │
│  │  - auth (/auth/*, /account/*)            │  │
│  │  - admin (/api/admin/*)                  │  │
│  │  - quiz (/quiz/*, /api/quiz/*)           │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Extensions                              │  │
│  │  - JWT Manager (auth tokens)             │  │
│  │  - Rate Limiter (anti-abuse)             │  │
│  │  - Cache (SimpleCache/Redis)             │  │
│  └──────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Database Layer (PostgreSQL)                    │
│  - hispanistica_games_auth (auth.users, ...)    │
│  - quiz_topics, quiz_questions, quiz_runs, ...  │
└─────────────────────────────────────────────────┘
```

**Request Flow:**
1. Browser → Flask route handler
2. JWT verification (if protected route)
3. Service layer (business logic)
4. Database queries (SQLAlchemy ORM)
5. Response rendering (Jinja2 templates or JSON)

---

## Components

This codebase is organized into **7 major components**. Each component has its own subdirectory with detailed documentation.

### Core System

| Component | Purpose | Entry Points |
|-----------|---------|--------------|
| [app-core](components/app-core/) | Flask app factory, configuration, extensions | `src/app/__init__.py`, `src/app/main.py` |
| [database](components/database/) | SQLAlchemy setup, auth DB schema | `src/app/services/database.py`, `src/app/extensions/sqlalchemy_ext.py` |
| [frontend-ui](components/frontend-ui/) | Templates, CSS, JavaScript, MD3 design | `templates/`, `static/` |

### Features

| Component | Purpose | Entry Points |
|-----------|---------|--------------|
| [auth](components/auth/) | JWT authentication, user management, roles | `src/app/auth/`, `src/app/routes/auth.py` |
| [admin-api](components/admin-api/) | REST API for user management (admin-only) | `src/app/routes/admin.py` |
| [quiz](components/quiz/) | Quiz game module (topics, questions, runs, scores) | `game_modules/quiz/` |

### Operations

| Component | Purpose | Entry Points |
|-----------|---------|--------------|
| [deployment](components/deployment/) | Docker, CI/CD, scripts, database setup | `docker-compose*.yml`, `.github/workflows/`, `scripts/` |

---

## Quick Start

**Prerequisites:**
- Python 3.12+
- Docker Desktop (for PostgreSQL)
- PowerShell 5.1+ or PowerShell 7+

**Setup & Run:**
```powershell
# Clone and setup (PostgreSQL + venv + dependencies + auth DB + quiz seed)
.\scripts\dev-setup.ps1 -UsePostgres

# Login: admin / change-me
# Access: http://localhost:8000
```

**Daily Development:**
```powershell
# Start PostgreSQL + Flask dev server
.\scripts\dev-start.ps1 -UsePostgres
```

See [deployment](components/deployment/) component for detailed setup instructions.

---

## Development Workflow

### Adding a New Route

1. Create route in appropriate blueprint (`src/app/routes/`)
2. Add authentication decorators if needed (`@jwt_required()`, `@require_role(Role.ADMIN)`)
3. Implement service layer logic (if database interaction)
4. Create Jinja2 template (if HTML response)
5. Add frontend JavaScript (if interactive)

### Database Changes

1. Modify models in `src/app/auth/models.py` (auth tables) or `game_modules/quiz/models.py` (quiz tables)
2. Create migration SQL file (PostgreSQL only): `migrations/*.sql`
3. Apply migration: `python scripts/init_auth_db.py` or `python scripts/init_quiz_db.py`

### Quiz Content

Quiz content (topics, questions, media) is managed **outside Git** in `content/` directory:
- JSON seed files: `content/quiz_units/topics/*.json`
- Audio files: `content/quiz-media/*.mp3`
- Seeding: `python scripts/quiz_seed.py` (auto-runs in dev-start.ps1)

**Never commit** quiz content to Git. See [quiz](components/quiz/) component for details.

---

## Project Structure

```
hispanistica_games/
├── src/app/                    # Flask application
│   ├── __init__.py             # App factory
│   ├── main.py                 # Entry point
│   ├── auth/                   # Auth models, services, decorators
│   ├── config/                 # Configuration loading
│   ├── extensions/             # Flask extensions (JWT, Limiter, Cache)
│   ├── routes/                 # Route blueprints
│   │   ├── public.py           # Public routes
│   │   ├── auth.py             # Auth routes
│   │   └── admin.py            # Admin API
│   └── services/               # Business logic
│       └── database.py         # Database utilities
├── game_modules/               # Pluggable game modules
│   └── quiz/                   # Quiz game
│       ├── routes.py           # Quiz routes
│       ├── models.py           # Quiz DB models
│       ├── services.py         # Quiz business logic
│       ├── validation.py       # Input validation
│       └── seed.py             # Content seeding
├── templates/                  # Jinja2 templates
│   ├── auth/                   # Auth & admin pages
│   ├── games/                  # Game pages
│   ├── pages/                  # Public pages
│   └── partials/               # Reusable components
├── static/                     # Static assets
│   ├── css/                    # Stylesheets (MD3 tokens)
│   ├── js/                     # JavaScript modules
│   ├── img/                    # Images
│   └── vendor/                 # Third-party libraries
├── scripts/                    # Utility scripts
│   ├── dev-setup.ps1           # Complete dev environment setup
│   ├── dev-start.ps1           # Start dev server
│   ├── init_auth_db.py         # Initialize auth database
│   ├── init_quiz_db.py         # Initialize quiz database
│   ├── quiz_seed.py            # Seed quiz content
│   └── create_initial_admin.py # Create admin user
├── migrations/                 # Database migrations (SQL files)
├── .github/workflows/          # CI/CD pipelines
├── docker-compose*.yml         # Docker configurations
└── docs/                       # This documentation
    └── components/             # Component-specific docs
```

---

## Testing

**Unit Tests:**
```powershell
pytest tests/
```

**Auth Flow Tests:**
```powershell
pytest tests/test_auth_flow.py -v
```

**E2E Tests:**
```powershell
# Playwright (if configured)
pytest tests/e2e/ -v
```

See [deployment](components/deployment/) for CI/CD pipeline details.

---

## Deployment

**Production Deployment:**
- Docker Compose with PostgreSQL + Gunicorn
- Nginx reverse proxy (SSL termination)
- GitHub Actions CI/CD
- Environment variables via `passwords.env`

See [deployment](components/deployment/) component for detailed production deployment guide.

---

## Security

**Authentication:**
- JWT tokens (access + refresh)
- HTTP-only, Secure, SameSite=Lax cookies
- Rate limiting (Flask-Limiter)
- Password hashing (argon2 or bcrypt)

**Authorization:**
- Role-based access control (USER, EDITOR, ADMIN)
- Route decorators (`@require_role(Role.ADMIN)`)

**Secrets Management:**
- Environment variables only
- Never commit secrets to Git
- `.env.example` for documentation only

See [auth](components/auth/) component for authentication details.

---

## Contributing

**Code Style:**
- Python: PEP 8, type hints
- JavaScript: ESLint (if configured)
- Templates: Jinja2 conventions

**Branch Strategy:**
- `main` - production-ready
- `feature/*` - new features
- `fix/*` - bug fixes
- `docs/*` - documentation

**Commit Messages:**
```
<type>(<scope>): <subject>

type: feat, fix, docs, refactor, test, chore
scope: component name (auth, quiz, frontend-ui, etc.)
```

---

## Documentation Scope

**What is documented:**
- Current code structure and behavior
- Component responsibilities and interfaces
- Configuration and deployment
- Development workflows

**What is NOT documented:**
- Historical decisions (see Git history)
- Archived experiments (see Git history)
- Future plans or roadmaps (see issue tracker)
- Removed features or old architectures (see Git history)

**Principle:** Documentation describes **only what exists in the current codebase**. For past decisions or removed features, use Git history.

---

## Support

**Issues:** Report bugs and request features via GitHub Issues  
**Development:** See individual component docs for detailed guides  
**Production:** See [deployment](components/deployment/) for operations runbook  

---

**Last Updated:** 2025-01-24 (reflects code state at this date)  
**Repository:** https://github.com/hispanistica/games_hispanistica (if public)  
**License:** See LICENSE file in repository root  
