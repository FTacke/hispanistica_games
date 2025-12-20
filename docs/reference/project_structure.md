# Project Structure

> **Version:** 1.0  
> **Last Updated:** 2025-11-27

This document defines the canonical folder structure for the CO.RA.PAN webapp.
All contributors must follow these rules when adding files.

---

## 1. Root Directory

The repository root should contain **only**:

| File/Folder | Purpose |
|-------------|---------|
| `README.md` | Project overview and quick start |
| `LICENSE` | License file (if applicable) |
| `CHANGELOG.md` | Version history (or in docs/) |
| `startme.md` | Quick start guide for developers |
| `pyproject.toml` | Python project config |
| `requirements.txt` | Python dependencies |
| `package.json` | Node.js dependencies (Playwright, etc.) |
| `Makefile` | Common dev commands |
| `Dockerfile` | Container build |
| `docker-compose*.yml` | Container orchestration |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore rules |
| `.dockerignore` | Docker ignore rules |
| `playwright.config.js` | E2E test config |
| `.github/` | CI/CD workflows |
| `.vscode/` | Editor settings (optional) |

**NOT allowed in root:**
- Markdown documentation files (except README, startme, CHANGELOG)
- Python scripts (use `scripts/`)
- Ad-hoc notes or temporary files
- Generated reports

---

## 2. Source Code: `src/`

```
src/
└── app/
    ├── __init__.py      # Application factory
    ├── main.py          # Entry point
    ├── auth/            # Authentication logic
    ├── config/          # Configuration
    ├── extensions/      # Flask extensions
    ├── models/          # Data models
    ├── routes/          # Route blueprints
    ├── search/          # Search/CQL logic
    └── services/        # Business logic services
```

**Rules:**
- All application code lives here
- Use blueprints for route organization
- Keep imports clean and layered

---

## 3. Templates: `templates/`

```
templates/
├── base.html                    # Base layout
├── _md3_skeletons/              # Skeleton templates for new pages
├── auth/                        # Authentication pages
├── errors/                      # Error pages (400, 403, 404, 500)
├── pages/                       # Content pages
├── partials/                    # Reusable template fragments
└── search/                      # Search-related templates
```

**Rules:**
- All HTML templates here
- No Markdown or documentation in this folder
- Use skeletons for new pages
- Partials for reusable fragments

---

## 4. Static Assets: `static/`

```
static/
├── css/
│   ├── app-tokens.css           # App-specific design tokens
│   ├── layout.css               # Layout styles
│   └── md3/                     # MD3 design system
│       ├── tokens.css
│       ├── typography.css
│       ├── layout.css
│       └── components/          # Component styles
├── js/
│   ├── theme.js                 # Theme handling
│   ├── auth.js                  # Auth functionality
│   └── ...
├── img/                         # Images, icons
├── fonts/                       # Custom fonts
└── vendor/                      # Third-party libraries
```

**Rules:**
- CSS organized by system (md3/) and app-specific
- JS files named descriptively
- No generated files committed (use .gitignore)

---

## 5. Documentation: `docs/`

```
docs/
├── index.md                     # Documentation home
├── CHANGELOG.md                 # Version history
├── CONTRIBUTING.md              # Contribution guide
├── archived/                    # Old/deprecated docs
├── concepts/                    # Conceptual documentation
├── decisions/                   # Architecture Decision Records
├── design/                      # Design documentation
├── dev/                         # Developer guides
├── guides/                      # User/feature guides
├── how-to/                      # How-to articles
├── md3/                         # MD3 design system docs
├── migration/                   # Migration guides
├── operations/                  # Ops & deployment docs
│   ├── production_hardening.md
│   ├── qa_checklist.md
│   ├── release_checklist.md
│   └── deployment.md
├── performance/                 # Performance documentation
├── reference/                   # API/reference docs
│   ├── project_structure.md     # This file
│   └── repo_cleanup.md
├── template/                    # Template reuse docs
└── troubleshooting/             # Troubleshooting guides
```

**Rules:**
- ALL documentation goes here
- Use appropriate subfolder based on content type
- Archive old docs in `archived/`
- No docs in repository root (except README, startme)

---

## 6. Scripts: `scripts/`

```
scripts/
├── dev-setup.ps1                # Windows dev setup
├── dev-start.ps1                # Start dev server
├── md3-lint.py                  # MD3 linting
├── md3-forms-auth-guard.py      # Form security guard
├── apply_auth_migration.py      # DB migration
├── create_initial_admin.py      # Admin user creation
├── seed_e2e_db.py               # E2E test database
├── check_structure.py           # Project structure validation
├── blacklab/                    # BlackLab-related scripts
├── debug/                       # Debug utilities
├── ops/                         # Operations (systemd services)
│   └── corapan-gunicorn.service # Gunicorn systemd service
└── __pycache__/                 # (gitignored)
```

**Rules:**
- All utility/helper scripts here
- No scripts in root directory
- Organize related scripts in subfolders
- Operations configs in `ops/` subfolder
- Document script purpose in README.md or script docstring

---

## 7. Tests: `tests/`

```
tests/
├── __init__.py
├── README.md                    # Test documentation
├── conftest.py                  # Shared fixtures (if needed)
├── test_*.py                    # Unit/integration tests
├── e2e/                         # End-to-end tests
│   └── playwright/              # Playwright specs
├── js/                          # JavaScript tests
└── resources/                   # Test fixtures/data
```

**Rules:**
- All tests here, not in src/
- E2E tests in `e2e/` subfolder
- Test files prefixed with `test_`
- Fixtures in `resources/`

---

## 8. Data & Media (Not in Git)

```
data/                            # Application data (gitignored)
├── blacklab_export/
├── blacklab_index/
├── counters/
├── db/                          # SQLite databases
└── exports/

media/                           # Media files (gitignored)
├── mp3-full/
├── mp3-split/
├── mp3-temp/
└── transcripts/

logs/                            # Log files (gitignored)
```

**Rules:**
- These folders are in `.gitignore`
- Never commit data, media, or logs
- Use environment variables for paths

---

## 9. Configuration: `config/`

```
config/
├── blacklab/                    # BlackLab configuration
│   ├── blacklab-server.yaml
│   └── *.blf.yaml
└── keys/                        # RSA keys (gitignored content)
```

**Rules:**
- Application configuration here
- Sensitive keys never committed (add to .gitignore)

---

## 10. Migrations: `migrations/`

```
migrations/
├── 0001_create_auth_schema_sqlite.sql
└── 0001_create_auth_schema_postgres.sql
```

**Rules:**
- Database migration scripts
- Number prefix for ordering
- Separate files for different DB engines

---

## 11. CI/CD: `.github/`

```
.github/
├── workflows/
│   ├── ci.yml                   # Main CI pipeline
│   └── md3-lint.yml             # MD3 linting (if separate)
└── CODEOWNERS                   # (optional)
```

---

## 12. Rules Summary

### ✅ DO

1. Put documentation in `docs/`
2. Put scripts in `scripts/`
3. Put tests in `tests/`
4. Put templates in `templates/`
5. Put static assets in `static/`
6. Follow existing folder patterns
7. Update this document when adding new top-level folders

### ❌ DON'T

1. Add .md files to root (except README, startme, CHANGELOG)
2. Add scripts to root directory
3. Commit data, media, or log files
4. Create new top-level folders without discussion
5. Put temporary/generated files in git

---

## 13. Enforcement

The CI pipeline includes checks for structure violations:

```yaml
# In .github/workflows/ci.yml
- name: Check project structure
  run: python scripts/check_structure.py
```

Common violations flagged:
- Markdown files in root (except allowed list)
- Scripts outside `scripts/`
- Uncommitted changes in `data/` or `media/`
