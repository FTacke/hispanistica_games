# Template README

> **Version:** 1.0  
> **Purpose:** Reusable MD3-based web application template

---

## Overview

This is a **reusable web application template** based on the CO.RA.PAN project. It provides:

- **MD3 Design System** - Material Design 3 components and tokens
- **Flask Backend** - Python web framework with blueprints
- **JWT Authentication** - Secure cookie-based auth with role management
- **SQLAlchemy ORM** - Database abstraction (SQLite/PostgreSQL)
- **Playwright E2E** - End-to-end testing framework

---

## Quick Start

### 1. Clone and Initialize

```bash
git clone <repository-url> my-project
cd my-project

# Fresh start (remove original git history)
rm -rf .git && git init

# Install Python dependencies
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

# Install Node dependencies (for E2E tests)
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings:
# - FLASK_SECRET_KEY (generate random string)
# - JWT_SECRET_KEY (generate random string)
# - AUTH_DATABASE_URL (default: sqlite:///data/db/auth.db)
```

### 3. Initialize Database

```bash
python scripts/apply_auth_migration.py --db data/db/auth.db --reset
python scripts/create_initial_admin.py --db data/db/auth.db --username admin --password your-password
```

### 4. Run Development Server

```bash
.\scripts\dev-start.ps1  # Windows
# or
python -m src.app.main   # Any platform
```

Visit: http://localhost:8000

---

## Customization

### Branding

1. **Colors:** Create `static/css/branding.css` with your color tokens
2. **Logo:** Replace `static/img/favicon.ico` and add logo files
3. **Titles:** Update `templates/base.html` default title

### Content

1. **Landing Page:** Edit `templates/pages/index.html`
2. **Legal Pages:** Edit `templates/pages/impressum.html`, `privacy.html`
3. **Navigation:** Update `templates/partials/navigation-drawer.html`

### New Pages

1. Copy skeleton from `templates/_md3_skeletons/`
2. Create template in `templates/pages/`
3. Add route in `src/app/routes/`
4. Run `python scripts/md3-lint.py` to verify

---

## Documentation

| Document | Location |
|----------|----------|
| **Module Overview** | `docs/MODULES.md` - Feature modules and dependencies |
| **Removal Guide** | `docs/PRUNING_GUIDE.md` - Step-by-step module removal |
| **Architecture** | `docs/ARCHITECTURE.md` - System design and data flow |
| **Developer Guide** | `docs/template/developer_guide.md` - Creating pages and customizing |
| **Template Usage** | `docs/how-to/template-usage.md` - Quick checklist |
| **Production Setup** | `docs/operations/production_hardening.md` - Security hardening |
| **Release Checklist** | `docs/operations/release_checklist.md` - Pre-launch checklist |
| **Project Structure** | `docs/reference/project_structure.md` - File organization |

---

## Testing

```bash
# Unit tests
pytest

# E2E tests (requires server running)
npm run test:e2e

# MD3 lint
python scripts/md3-lint.py
```

---

## Project Structure

```
├── src/app/           # Application code
├── templates/         # HTML templates
├── static/            # CSS, JS, images
├── docs/              # Documentation
├── scripts/           # Utility scripts
├── tests/             # Test files
└── data/              # Runtime data (gitignored)
```

See `docs/reference/project_structure.md` for details.

---

## License

[Specify your license]
