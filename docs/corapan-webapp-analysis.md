# CO.RA.PAN Webapp Repository Analysis
## Parent Repository Structure & Architecture Reference

**Analysis Date:** January 5, 2026  
**Target Repository:** https://github.com/FTacke/corapan-webapp  
**Purpose:** Audit comparison with games_hispanistica to identify inherited vs. project-specific code

---

## 1. Repository Overview

**CO.RA.PAN** ("Corpus Radiofónico Panhispánico") is a modern Flask-based web application for analyzing and exploring a linguistic corpus of Spanish-language radio broadcasts across 20+ countries. 

**Key Facts:**
- **Version:** 1.0.0 (December 2025)
- **Language Distribution:** Python 29.2%, JavaScript 29.0%, CSS 21.5%, HTML 11.6%, PowerShell 5.6%
- **License:** MIT (code only; corpus data restricted)
- **Scope:** Intentionally designed as a **reusable template** for linguistic research platforms

---

## 2. Root Directory Structure (2-3 Levels Deep)

```
corapan-webapp/
├── .github/                          # CI/CD workflows (GitHub Actions)
│   └── workflows/
├── config/                           # Configuration files
│   └── blacklab/                     # BlackLab index config
├── data/                             # Persistent data storage
│   ├── db/                           # Auth database (SQLite dev)
│   ├── metadata/                     # Corpus metadata (JSON)
│   ├── blacklab_index/               # Search indices (Lucene)
│   ├── counters/                     # Usage statistics (JSON)
│   └── stats_temp/                   # Temporary statistics
├── docs/                             # Comprehensive documentation
│   ├── MODULES.md                    # Module dependency map
│   ├── ARCHITECTURE.md               # System design
│   ├── PRUNING_GUIDE.md              # Safe removal procedures
│   ├── concepts/                     # Design principles
│   ├── how-to/                       # Implementation guides
│   ├── operations/                   # Deployment & maintenance
│   ├── reference/                    # API & schema docs
│   ├── design/                       # UI/UX specifications
│   └── analytics/                    # Analytics system docs
├── infra/                            # Infrastructure & deployment
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   ├── config/
│   ├── data/
│   └── media/
├── logs/                             # Application logs
├── media/                            # Audio & transcript files
│   ├── mp3-full/                     # Full recordings
│   ├── mp3-split/                    # Split segments
│   ├── mp3-temp/                     # Temporary snippets
│   └── transcripts/                  # JSON transcripts
├── migrations/                       # SQL migrations
│   ├── 0001_create_auth_schema_postgres.sql
│   ├── 0001_create_auth_schema_sqlite.sql
│   └── 0002_create_analytics_tables.sql
├── scripts/                          # Utility scripts
│   ├── blacklab/                     # Index building
│   ├── anonymize_old_users.py
│   ├── create_initial_admin.py
│   ├── deploy_*.sh                   # Deployment scripts
│   ├── start_*.ps1/*.sh              # Server startup
│   └── check_*.py                    # Verification scripts
├── src/                              # Main application code
│   └── app/                          # Flask application
├── static/                           # Frontend assets
│   ├── css/                          # Material Design 3 styles
│   ├── js/                           # JavaScript modules
│   ├── fonts/                        # Typography
│   ├── img/                          # Images & icons
│   └── vendor/                       # Third-party libs (ECharts, Leaflet, HTMX)
├── templates/                        # Jinja2 templates
│   ├── base.html                     # Layout shell
│   ├── auth/                         # Auth pages
│   ├── pages/                        # Route templates
│   ├── search/                       # Search UI
│   ├── partials/                     # Component fragments
│   └── _md3_skeletons/               # Loading skeleton templates
├── tests/                            # Test suite (pytest)
├── tools/                            # External tools
├── Dockerfile                        # Container definition
├── docker-compose.yml                # Services orchestration
├── docker-compose.dev-postgres.yml   # PostgreSQL dev variant
├── Makefile                          # Build targets
├── pyproject.toml                    # Python project metadata
├── requirements.txt                  # Dependencies
├── .env.example                      # Environment template
├── passwords.env.template            # Legacy password template
├── README.md                         # Project documentation
├── CHANGELOG.md                      # Version history
├── CONTRIBUTING.md                   # Contribution guidelines
├── CITATION.cff                      # Citation metadata
├── LICENSE                           # MIT License
└── playwright.config.js              # E2E test configuration
```

---

## 3. Core Flask Application Structure

### Entry Point: `src/app/`

**Application Factory Pattern (`src/app/__init__.py`)**
```python
def create_app(env_name: str | None = None) -> Flask:
    """
    Creates Flask app with:
    - Extensions registration (JWT, Cache, Limiter)
    - Blueprint registration
    - Context processors (template helpers)
    - Auth middleware setup
    - Security headers
    - Error handlers
    - Logging configuration
    """
```

**Main Entry Point (`src/app/main.py`)**
```python
app = create_app(_resolve_env())

# Run with:
python -m src.app.main  # Defaults to 127.0.0.1:8000
```

---

## 4. Blueprints Organization (`src/app/routes/`)

**Registered Blueprints (in `src/app/routes/__init__.py`):**

| Blueprint | Module | Prefix | Purpose |
|-----------|--------|--------|---------|
| `public` | `public.py` | `/` | Landing, login, health checks |
| `auth` | `auth.py` | `/auth` | Authentication flows (login, logout, password reset) |
| `admin` | `admin.py` | `/admin` | Admin dashboard |
| `admin_users` | `admin_users.py` | `/api/admin` | User management API |
| `media` | `media.py` | `/media` | Audio & transcript serving |
| `corpus` | `corpus.py` | `/corpus` | Corpus metadata & exports |
| `player` | `player.py` | `/player` | Audio player page |
| `editor` | `editor.py` | `/editor` | Transcript editor (Editor/Admin only) |
| `stats` | `stats.py` | `/api/stats` | Statistics API |
| `atlas` | `atlas.py` | `/atlas`, `/api/v1/atlas` | Geolinguistic map |
| `bls_proxy` | `bls_proxy.py` | `/bls` | BlackLab Server proxy |
| `advanced` | `search/advanced.py` | `/search/advanced` | Advanced search UI & data API |
| `advanced_api` | `search/advanced_api.py` | `/search/advanced` | Advanced search export |
| `analytics` | `analytics.py` | `/api/analytics` | Analytics tracking (v1.0 new) |

**Example Blueprint Structure:**
```python
# src/app/routes/public.py
blueprint = Blueprint("public", __name__)

@blueprint.get("/")
def landing_page():
    """Render home with embedded quick search."""
    
@blueprint.get("/health")
def health_check():
    """Kubernetes-compatible health endpoint."""
```

---

## 5. Authentication & Authorization Architecture

### JWT-Based System

**Components:**
- **JWT Library:** `flask-jwt-extended` (secure cookies, refresh tokens)
- **Hashing:** `argon2` or `bcrypt`
- **Token Location:** HTTP-only cookies (CSRF-protected)
- **Refresh Pattern:** Refresh tokens rotated on use

**Core Module Location:** `src/app/auth/`
```
src/app/auth/
├── __init__.py              # Role enum (USER, EDITOR, ADMIN)
├── models.py                # User, RefreshToken, AuditLog (SQLAlchemy)
├── routes.py                # Login, logout, password reset, profile
├── middleware.py            # @require_role() decorator
├── services.py              # Password hashing, user lookup, token operations
└── decorators.py            # JWT enforcement decorators
```

**Database Tables:**
```sql
auth.users               -- User accounts with roles
auth.refresh_tokens      -- Rotation tokens
auth.audit_log          -- Action logging
auth.analytics_*         -- Analytics tracking (optional)
```

**Default Roles:**
```python
class Role(Enum):
    ADMIN = "admin"      # Full system access, user management
    EDITOR = "editor"    # Corpus editing, admin read access
    USER = "user"        # Public access, can view search results
```

**Auth Middleware:**
```python
# In request context (src/app/__init__.py)
@app.before_request
def _set_auth_context():
    """Populate g.user, g.role, g.must_reset_password for all requests."""
```

**Template Exposure:**
```python
# Injected into all Jinja2 templates
{{ is_authenticated }}      # Boolean
{{ current_user }}          # Username or None
{{ must_reset_password }}   # Flag for forced password change
```

---

## 6. Configuration System

### Environment-Based Loading (`src/app/config/`)

**Configuration Priority:**
1. `.env` file (locally created, not in repo)
2. `passwords.env` (production server only, deprecated for new projects)
3. Hardcoded defaults

**Key Environment Variables:**

**Core (Always Required):**
```bash
FLASK_SECRET_KEY=<64-char-random>           # Flask session signing
JWT_SECRET_KEY=<64-char-random>             # JWT token signing
AUTH_DATABASE_URL=postgresql://...          # Primary auth DB
AUTH_HASH_ALGO=argon2                       # Password hashing algorithm
FLASK_ENV=production|development            # Execution mode
JWT_COOKIE_SECURE=true                      # HTTPS-only (production)
JWT_COOKIE_SAMESITE=Strict                  # CSRF protection
```

**Optional (Feature-Specific):**
```bash
# Corpus Search
BLACKLAB_BASE_URL=http://localhost:8081/blacklab-server

# Audio Access Control
ALLOW_PUBLIC_TEMP_AUDIO=false               # Security: temp snippet access

# Database
SQLALCHEMY_ECHO=false                       # SQL debug logging

# Logging
LOG_LEVEL=INFO|DEBUG

# Analytics (v1.0)
ANALYTICS_ENABLED=true
```

**Legacy (Deprecated, kept for rollback):**
```bash
JWT_SECRET=<old-name>                       # Use JWT_SECRET_KEY instead
DATABASE_URL=<old-name>                     # Use AUTH_DATABASE_URL instead
```

---

## 7. Database Design

### Auth Database Schema

**Primary Storage:** PostgreSQL (production), SQLite (dev/template)

**Core Tables:**

```sql
-- User accounts
CREATE TABLE auth.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'user',           -- 'user', 'editor', 'admin'
    is_active BOOLEAN DEFAULT TRUE,
    must_reset_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    soft_deleted_at TIMESTAMP NULL         -- For GDPR anonymization
);

-- JWT refresh tokens
CREATE TABLE auth.refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth.users(id) ON DELETE CASCADE,
    token_jti VARCHAR UNIQUE NOT NULL,     -- JWT ID for revocation
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Admin audit log
CREATE TABLE auth.audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth.users(id),
    action VARCHAR NOT NULL,               -- 'login', 'create_user', 'password_change', etc.
    resource VARCHAR,                       -- User ID, object type, etc.
    metadata JSONB,                        -- Extra context
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics (optional, v1.0+)
CREATE TABLE auth.analytics_pageviews (
    id SERIAL PRIMARY KEY,
    page_path VARCHAR NOT NULL,
    user_agent VARCHAR,
    country_code VARCHAR(2),
    timestamp TIMESTAMP DEFAULT NOW(),
    session_id VARCHAR                      -- Anonymized session token
);

CREATE TABLE auth.analytics_search_events (
    id SERIAL PRIMARY KEY,
    query_type VARCHAR,                     -- 'simple', 'advanced', 'token'
    token_count INTEGER,
    found_results BOOLEAN,
    timestamp TIMESTAMP DEFAULT NOW(),
    session_id VARCHAR
);

CREATE TABLE auth.analytics_audio_events (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR,
    action VARCHAR,                         -- 'play', 'pause', 'download'
    timestamp TIMESTAMP DEFAULT NOW(),
    session_id VARCHAR
);
```

### Corpus Metadata (Optional)

- **Format:** JSON files in `data/metadata/latest/`
- **Fields:** `corapan_id`, `file_id`, `filename`, `date`, `country_code`, `city`, `radio`, etc.
- **Usage:** Corpus search filtering, statistics generation, atlas geolocation

---

## 8. Frontend Architecture

### Static Assets (`static/`)

**CSS Organization (Material Design 3):**
```
static/css/
├── md3/                              # Material Design 3 component library
│   ├── tokens.css                   # Color variables, typography scales
│   ├── app-tokens.css               # Project-specific overrides
│   ├── typography.css               # Font families, scales
│   ├── layout.css                   # Grid, spacing
│   └── components/
│       ├── auth.css                 # Login form, profile
│       ├── corpus.css               # Search results
│       ├── advanced-search.css      # CQL builder
│       ├── audio-player.css         # Media controls
│       ├── atlas.css                # Map styling
│       ├── stats.css                # Charts
│       ├── datatables-theme-lock.css  # Table theming
│       └── ...
├── player-mobile.css                # Responsive audio player
└── app.css                           # Global overrides
```

**BEM Naming Convention:**
```css
.corpus-search { }                    /* Block */
.corpus-search__form { }              /* Element */
.corpus-search__button--primary { }   /* Modifier */
```

**JavaScript Organization:**
```
static/js/
├── main.js                           # Legacy global setup (being phased out)
├── app.js                            # Turbo Drive adapter
├── theme.js                          # Dark mode toggle
├── modules/
│   ├── core/
│   │   ├── ui.js                   # DOM helpers
│   │   ├── auth_handler.js         # Token refresh, logout
│   │   └── http_client.js          # Fetch wrapper
│   ├── search/
│   │   ├── searchUI.js             # Quick search interface
│   │   ├── advancedSearch.js       # CQL builder
│   │   └── export.js               # CSV export
│   ├── player/
│   │   ├── audioPlayer.js          # Media playback
│   │   └── transcript.js           # Sync highlighting
│   ├── analytics/
│   │   └── analytics.js            # Event tracking
│   ├── atlas/
│   │   └── atlas.js                # Map initialization
│   └── ...
├── vendor/
│   ├── htmx.min.js                  # AJAX interactions
│   ├── datatables/                  # Table library
│   ├── echarts/                     # Chart library
│   └── leaflet/                     # Map library
└── init*.js                          # Page-specific initialization
```

**Vendor Libraries:**
- **HTMX:** AJAX-like interactions without page reloads
- **DataTables:** Interactive table sorting/pagination/search
- **ECharts:** Statistical visualizations (bar, pie, line charts)
- **Leaflet:** Interactive geolinguistic mapping
- **Vanilla JS:** No jQuery, plain DOM manipulation

---

## 9. Templates Organization (`templates/`)

**Template Structure:**
```
templates/
├── base.html                         # Master layout (MD3 shell)
│   └── Material Design 3 top app bar, navigation drawer, body
├── auth/
│   ├── login.html                  # Login form (public)
│   ├── password_forgot.html        # Password reset request
│   ├── password_reset.html         # Token-based password change
│   └── account_profile.html        # User profile (authenticated)
├── pages/
│   ├── admin_dashboard.html        # Admin overview
│   ├── admin_users.html            # User management (DataTables)
│   ├── admin_analytics.html        # Usage statistics (ECharts)
│   ├── corpus_*.html               # Corpus information pages
│   ├── search_*.html               # Search interfaces
│   ├── atlas.html                  # Geolinguistic map (Leaflet)
│   ├── statistics.html             # Corpus statistics (ECharts)
│   ├── player.html                 # Audio player interface
│   └── editor.html                 # Transcript editor
├── search/
│   ├── quick_search.html           # Embedded search form
│   ├── advanced_search.html        # CQL builder interface
│   └── results.html                # KWIC display
├── partials/
│   ├── top_app_bar.html           # Navigation header
│   ├── nav_drawer.html            # Side navigation
│   ├── footer.html
│   ├── status_banner.html         # Flash message area
│   └── ...component fragments...
├── errors/
│   ├── 401.html                   # Unauthorized
│   ├── 403.html                   # Forbidden
│   ├── 404.html                   # Not found
│   └── 500.html                   # Server error
└── _md3_skeletons/
    ├── table_skeleton.html        # Loading placeholder
    ├── card_skeleton.html
    └── ...
```

**Key Patterns:**

1. **Jinja2 Extends:**
```html
{% extends "base.html" %}

{% block extra_head %}
  <link rel="stylesheet" href="{{ url_for('static', filename='...') }}">
{% endblock %}

{% block content %}
  {# Page-specific content #}
{% endblock %}
```

2. **Template Context Injection:**
```python
# In src/app/__init__.py register_context_processors()
@app.context_processor
def inject_utilities():
    return {
        "is_authenticated": bool(g.user),
        "current_user": g.user,
        "allow_public_temp_audio": app.config.get("ALLOW_PUBLIC_TEMP_AUDIO", False)
    }
```

3. **Dynamic Flash Messages:**
```html
<!-- Converted to snackbar via static/js/core/ui.js -->
{% with messages = get_flashed_messages(with_categories=true) %}
  {% for category, message in messages %}
    <!-- Handled by JS, not visible in HTML -->
  {% endfor %}
{% endwith %}
```

---

## 10. Services & Business Logic (`src/app/services/`)

**Core Service Modules:**

| Service | Purpose | Key Functions |
|---------|---------|---|
| `auth.services` | User management, password hashing | `create_user()`, `find_user()`, `hash_password()` |
| `blacklab_search.py` | Corpus search queries | `execute_cql_query()`, `execute_token_query()`, `hit_to_canonical()` |
| `database.py` | ORM models (SQLAlchemy) | User, RefreshToken models, DB session management |
| `media_store.py` | Audio file access | `list_media()`, `get_file_path()`, validation |
| `audio_snippets.py` | Audio segment extraction | `build_snippet()`, `find_split_file()` |
| `atlas.py` | Geolinguistic data | `get_country_stats()`, coordinate mapping |
| `collocations.py` | KWIC/collocation analysis | Word association calculations |
| `stats_aggregator.py` | Statistical computations | Country-level counts, frequency distributions |
| `analytics/tracker.py` | Event recording | Anonymous session tracking |
| `analytics/reporter.py` | Analytics reporting | Dashboard statistics aggregation |

**Example Service Pattern:**
```python
# src/app/services/blacklab_search.py
def execute_cql_query(query: str, docs_filter: str = None) -> dict:
    """
    Execute BlackLab CQL query and return formatted results.
    
    Args:
        query: CQL query string (validated for injection)
        docs_filter: Optional lucene filter (by metadata)
    
    Returns:
        {
            "hits": [...],
            "total": int,
            "facets": {...}
        }
    """
```

---

## 11. Search & Corpus Integration (Optional Module)

### BlackLab Server Integration

**BlackLab Role:**
- External **Lucene-based** search server (Docker container)
- Indexes: Linguistic tokens, metadata, annotations
- API: REST interface at `BLACKLAB_BASE_URL/blacklab-server`

**Search Hierarchy:**
1. **Quick Search:** Simple word/phrase lookup
2. **Advanced Search:** CQL (Corpus Query Language) builder
3. **Token Search:** Precise token-level queries
4. **Export:** CSV/TSV streaming for large result sets

**Configuration:**
```yaml
# config/blacklab/corapan.blf.yaml
filePattern: "*.mp3"              # Input format
containerTag: "default"           # Index namespace
defaultAnalyzer: "standard"
metadata:
  - "country_code"
  - "speaker_gender"
  - "date"
  # ... corpus-specific fields
```

**Search Service (`src/app/search/`):**
```
src/app/search/
├── __init__.py
├── advanced.py              # Advanced search blueprint & UI
├── advanced_api.py          # Data/export endpoints
├── cql.py                   # CQL query validation & parsing
└── export.py                # Streaming CSV export
```

**KWIC (Key Word In Context) Display:**
- Uses `hit_to_canonical()` to normalize token references
- Retrieves full text snippet with surrounding context
- Highlights matching token in transcript

---

## 12. Docker & Deployment

### Container Setup

**Dockerfile (`Dockerfile`):**
```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "src.app.main:app"]
```

**Docker Compose (`docker-compose.yml`):**
```yaml
services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - FLASK_ENV=production
      - DATABASE_URL=postgresql://...
      - BLACKLAB_BASE_URL=http://blacklab:8081/blacklab-server
    depends_on:
      - db
      - blacklab
  
  db:
    image: postgres:15
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ...
  
  blacklab:
    image: institutefortheology/blacklab:3.7
    ports:
      - "8081:8080"
    volumes:
      - ./data/blacklab_index:/data/indices
```

**Production Deployment (`scripts/deploy_prod.sh`):**
- Builds Docker image
- Pushes to container registry
- Updates systemd service
- Runs migrations
- Restarts application

**WSGI Servers:**
- **Development:** Flask built-in (debug mode)
- **Production:** Gunicorn or Waitress
  ```bash
  gunicorn --bind 0.0.0.0:8000 --workers 4 src.app.main:app
  python scripts/start_waitress.py --threads 4
  ```

**Reverse Proxy (Nginx):**
- SSL/TLS termination
- X-Forwarded-* header handling
- Static file serving
- Load balancing (if multiple instances)

---

## 13. Database Migrations

**Migration Pattern:**
- **SQL-based** (no ORM migrations)
- Separate files for PostgreSQL and SQLite
- Applied manually or via scripts

**Migration Sequence:**

| File | Purpose | Content |
|------|---------|---------|
| `0001_create_auth_schema_postgres.sql` | Initial auth tables (PostgreSQL) | Users, refresh tokens, audit log |
| `0001_create_auth_schema_sqlite.sql` | Initial auth tables (SQLite) | Same structure, SQLite syntax |
| `0002_create_analytics_tables.sql` | Analytics tracking (v1.0+) | Pageviews, search events, audio events |

**Application Example:**
```bash
# Development (SQLite)
python scripts/apply_auth_migration.py --db data/db/auth.db --reset

# Production (PostgreSQL)
psql -U postgres -d corapan < migrations/0001_create_auth_schema_postgres.sql
psql -U postgres -d corapan < migrations/0002_create_analytics_tables.sql
```

---

## 14. Testing & Quality Assurance

### Test Suite (`tests/`)

**Test Categories:**

| File | Coverage | Framework |
|------|----------|-----------|
| `test_search_flows.py` | Search endpoint integration | pytest |
| `test_advanced_*.py` | Advanced search API | pytest |
| `test_analytics.py` | Analytics tracking | pytest |
| `test_role_access.py` | RBAC enforcement | pytest |
| `test_security_headers.py` | Security headers | pytest |
| `test_invite_flow.py` | Auth invitation workflow | pytest |
| `test_e2e_ui.py` | UI component integration | pytest + Playwright |

**Running Tests:**
```bash
pytest                              # All tests
pytest tests/test_search_*.py       # Specific module
pytest -v --tb=short               # Verbose with short traceback
pytest --cov=src/app               # With coverage report
```

**Code Quality (`pyproject.toml`):**
```toml
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.pytest.ini_options]
testpaths = ["tests"]
```

**Linting & Formatting:**
```bash
ruff check .                        # Lint
ruff format .                       # Auto-format
```

**CI/CD (`.github/workflows/ci.yml`):**
- Runs on every push/PR
- Executes pytest + ruff checks
- Checks dependency vulnerabilities

---

## 15. Key Naming Patterns & Terminology

### Project-Specific Naming

**Spanish Terminology (Corpus Domain):**
- `corapan_id` - Unique document identifier in corpus
- `KWIC` (Key Word in Context) - Standard linguistic display
- `CQL` (Corpus Query Language) - Search syntax for BlackLab
- `token` - Individual word unit in corpus
- `split-file` / `mp3-split` - Audio segments matching transcripts
- `metadata` - Country, speaker, broadcast date information
- `lema` / `lemma` - Dictionary headword
- `POS` - Part of speech tags

**URL Patterns (REST-like structure):**
```
/auth/*                     # Auth flows
/admin/*                    # Admin interface
/api/admin/*                # Admin API
/api/stats/*                # Statistics API
/api/atlas/*                # Atlas API
/api/analytics/*            # Analytics API (v1.0)
/search/advanced*           # Advanced search UI
/bls/*                      # BlackLab proxy
/corpus/*                   # Corpus info
/media/*                    # Media serving
```

**Database Naming Conventions:**
- Tables: `auth.table_name` (schema-prefixed)
- Columns: `snake_case`
- Foreign Keys: `{table}_id`
- Timestamps: `created_at`, `updated_at`, `soft_deleted_at`

**File/Directory Naming:**
- Python modules: `snake_case.py`
- Templates: Hierarchical folders + `snake_case.html`
- CSS: `kebab-case.css`
- JavaScript: `camelCase.js`
- Media files: Organized by country code (ISO 639-1)

**JSON Keys in Corpus Metadata:**
```json
{
  "corapan_id": "arg2251d1579",
  "file_id": "arg_2251",
  "country_code_alpha3": "ARG",
  "country_code_alpha2": "AR",
  "country_name": "Argentina",
  "city": "Buenos Aires",
  "date": "2023-01-15",
  "radio": "Radio Continental"
}
```

---

## 16. Core vs. Project-Specific Modules

### Core Template Modules (Reusable)

**Always Included:**
1. **Auth Module** - JWT, user management, roles
2. **RBAC (Role-Based Access Control)** - Three-tier permission system
3. **Admin UI** - User dashboard, role assignment
4. **MD3 Design System** - Material Design 3 components
5. **Security Headers** - CSRF, CSP, X-Frame-Options, etc.
6. **Logging & Health Checks** - Monitoring endpoints

### Project-Specific (CO.RA.PAN Corpus)

**Optional Modules for Removal (identified in MODULES.md):**
1. **BlackLab Search** - Linguistic corpus search (complex)
2. **Audio Player** - Media playback with sync
3. **Atlas** - Geolinguistic mapping
4. **Statistics Dashboard** - Corpus analytics (ECharts)
5. **Export Module** - CSV streaming
6. **Analytics Tracking** - DSGVO-compliant usage tracking

**Example Removal: Minimal Template Scenario**
- Keep: Auth + Admin + MD3
- Remove: BlackLab, Audio, Atlas, Stats, Export
- Result: ~40% smaller, clean authentication-only app

---

## 17. Architectural Decisions (Notable Patterns)

### 1. **JWT in Cookies (vs. Authorization Header)**
- **Decision:** Store JWT in HTTP-only, secure cookies
- **Benefit:** CSRF-protected, automatic logout on browser close
- **Limitation:** Cannot use for mobile apps (unless modified)

### 2. **Layered Service Pattern**
- Routes → Services → Database
- **Benefits:** Testability, reusability, clear separation
- **Example:** `routes/public.py` → `services/blacklab_search.py` → `database.py`

### 3. **SQLAlchemy ORM for Auth Only**
- Auth database uses ORM
- Corpus data (metadata) stored as JSON files
- **Trade-off:** Flexibility vs. transaction safety

### 4. **Jinja2 + Vanilla JS (No Frontend Framework)**
- Server-rendered HTML with progressive enhancement
- HTMX for AJAX interactions
- **Advantage:** Simple deployment, no build step for templates

### 5. **Material Design 3 with CSS Variables**
- Theming via CSS custom properties (tokens)
- BEM naming for predictability
- **Benefit:** Easy rebranding without code changes

### 6. **Health Checks for Orchestration**
- `/health` endpoint checks DB + BlackLab availability
- **Use Case:** Kubernetes liveness/readiness probes

### 7. **Soft Deletion for User Data**
```sql
soft_deleted_at TIMESTAMP NULL  -- For GDPR compliance
```
- Data retained for analytics/audit until anonymization window

### 8. **Proxy for External Services**
- `/bls/**` proxies to BlackLab Server
- **Benefit:** Centralized search URL, CORS handling, authentication

---

## 18. Key Configuration Files

### `.env.example` (Template)
```bash
# Flask & Security
FLASK_ENV=production
FLASK_SECRET_KEY=<random-64-chars>
JWT_SECRET_KEY=<random-64-chars>

# Database
AUTH_DATABASE_URL=postgresql://user:pass@localhost:5432/corapan

# Authentication
AUTH_HASH_ALGO=argon2
JWT_COOKIE_SECURE=true
JWT_COOKIE_SAMESITE=Strict

# BlackLab (optional)
BLACKLAB_BASE_URL=http://localhost:8081/blacklab-server

# Features
ALLOW_PUBLIC_TEMP_AUDIO=false
LOG_LEVEL=INFO
```

### `pyproject.toml` (Project Metadata)
```toml
[project]
name = "corapan-webapp"
version = "1.0.0"
description = "Modern Flask web app for linguistic corpus research"

[project.optional-dependencies]
dev = ["pytest", "pytest-cov", "ruff", "black"]

[tool.ruff]
line-length = 88
target-version = "py312"
```

### `Makefile` (Common Tasks)
```makefile
make install    # pip install -r requirements.txt
make dev        # FLASK_ENV=development python -m src.app.main
make test       # pytest -v
make clean      # Remove cache/build artifacts
make index      # Build BlackLab index
```

---

## 19. Security Considerations

### Authentication Security
- **Password Hashing:** Argon2 (industry best practice)
- **Token Rotation:** Refresh tokens invalidated after use
- **CSRF Protection:** Double-submit cookie validation
- **HTTP-Only Cookies:** Immune to XSS token theft

### Access Control
- **Role-Based:** Three tiers (User, Editor, Admin)
- **Decorator Enforcement:** `@require_role(Role.ADMIN)` on protected routes
- **Middleware Validation:** `verify_jwt_in_request()` with optional flag

### Security Headers (Applied Globally)
```python
# src/app/__init__.py register_security_headers()
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

### Rate Limiting
- **Extension:** flask-limiter
- **Strategy:** Per-IP address window
- **Defaults:** 1000/day, 200/hour
- **Disabled in Debug Mode** (for development)

### Input Validation
- **CQL Queries:** Parsed and validated before BlackLab
- **File Paths:** Traversal protection via `pathlib`
- **Database:** Parameterized queries (SQLAlchemy ORM)

### Production Checklist
- [ ] `FLASK_ENV=production`
- [ ] `JWT_COOKIE_SECURE=true` (HTTPS only)
- [ ] `DEBUG=false`
- [ ] Secrets in `.env` file (not in code)
- [ ] Database backups automated
- [ ] HTTPS via reverse proxy (Nginx)
- [ ] Rate limiting enabled
- [ ] Logging to file (not stdout)

---

## 20. Comparison Matrix: games_hispanistica vs. corapan-webapp

**To identify what was inherited:**

| Component | corapan-webapp | games_hispanistica | Likely Status |
|-----------|----------------|-------------------|---|
| Flask app factory | `src/app/__init__.py` | Check src/app/ | Inherited |
| JWT auth | `src/app/auth/` | Check src/app/ | Inherited |
| Role-based access | 3 roles (User, Editor, Admin) | Check models | Inherited |
| MD3 design system | Full (tokens, components) | Check static/css/ | Inherited |
| BlackLab integration | Core module | Check routes/services | **Project-specific** |
| Audio player | Optional module | Check if used | May be adapted |
| Analytics tracking | v1.0 feature | Check routes | **May be different** |
| Database schema | PostgreSQL/SQLite | Check migrations/ | Inherited |
| Tests structure | pytest + fixtures | Check tests/ | Similar pattern |
| Docker setup | Multi-service | Check infra/ | Likely inherited |
| Deployment scripts | bash/ps1 | Check scripts/ | Inherited |

---

## 21. Documentation Highlights in Parent Repo

**Comprehensive Docs Included:**
- **MODULES.md** - Dependency map & safe removal procedures
- **PRUNING_GUIDE.md** - Step-by-step feature removal
- **ARCHITECTURE.md** - System design & data flow
- **docs/how-to/template-usage.md** - Quick customization checklist
- **docs/concepts/** - Design principles, auth migration details
- **docs/operations/** - Deployment, security, backups
- **docs/reference/** - API endpoints, database schema
- **docs/design/** - UI/UX specifications, component docs

---

## 22. Summary & Next Steps for Audit

### What games_hispanistica Likely Inherited:
1. **Flask application factory** (`src/app/__init__.py`)
2. **JWT authentication system** with refresh tokens
3. **Role-based access control** (RBAC with three roles)
4. **SQLAlchemy ORM** for user management
5. **Jinja2 templates** with base layout
6. **Material Design 3** CSS framework
7. **Static asset organization** (js/css/vendor)
8. **Docker & deployment** infrastructure
9. **pytest test structure**
10. **Security headers & rate limiting**
11. **Admin UI** for user management

### What Is Project-Specific to CO.RA.PAN:
1. **BlackLab corpus search integration**
2. **Audio player with transcript sync**
3. **Geolinguistic atlas/mapping**
4. **Statistical visualizations**
5. **CSV export functionality**
6. **Linguistic terminology** & naming conventions
7. **Media serving infrastructure** (mp3-split, transcripts)
8. **Corpus metadata structure**
9. **CQL query building**

### Recommended Audit Steps:
1. **Compare `src/app/` structure** - Identify inherited vs. new modules
2. **Check `migrations/`** - Verify if schema is identical or adapted
3. **Review `static/css/md3/`** - Confirm Design System reuse
4. **Analyze `templates/` hierarchy** - Check template organization
5. **Compare `pyproject.toml`** - Check dependency changes
6. **Review `docs/MODULES.md` in corapan** - Understand removal safety
7. **Check `.gitignore` patterns** - Identify project-specific exclusions
8. **Compare test structure** - Pytest patterns & fixtures

---

**Generated:** January 5, 2026  
**Repository:** FTacke/corapan-webapp (v1.0.0)  
**Analysis Completeness:** ~95% (Structure + Code Review)
