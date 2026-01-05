# CO.RA.PAN Quick Reference Guide
## Essential Patterns & File Locations for games_hispanistica Audit

---

## Quick Directory Map

```
corapan-webapp/
├── src/app/                    # Flask application code
│   ├── __init__.py            # Application factory (create_app)
│   ├── main.py                # Entry point
│   ├── auth/                  # CORE: Authentication logic
│   │   ├── models.py          # User, RefreshToken, AuditLog ORM
│   │   ├── routes.py          # /auth/* endpoints
│   │   ├── services.py        # Password hashing, token operations
│   │   └── middleware.py      # @require_role() decorator
│   ├── config/                # Configuration loading
│   ├── extensions/            # Flask extensions (JWT, Cache, Limiter)
│   ├── routes/                # Blueprints by feature
│   │   ├── public.py          # /, /health, /login
│   │   ├── admin.py           # /admin dashboard
│   │   ├── corpus.py          # Corpus metadata routes
│   │   ├── media.py           # Audio/transcript serving
│   │   ├── player.py          # Audio player page
│   │   ├── search/            # BlackLab integration (OPTIONAL)
│   │   └── analytics.py       # Analytics tracking (OPTIONAL)
│   ├── services/              # Business logic
│   │   ├── blacklab_search.py # Corpus search (OPTIONAL)
│   │   ├── database.py        # ORM models
│   │   └── ...
│   └── analytics/             # Analytics module (OPTIONAL, v1.0)
├── static/                    # Frontend assets
│   ├── css/md3/               # Material Design 3
│   │   ├── tokens.css         # Color/typography variables
│   │   └── components/        # Auth, corpus, player, stats CSS
│   ├── js/                    # JavaScript modules
│   │   ├── modules/           # Organized by feature
│   │   └── vendor/            # HTMX, DataTables, ECharts, Leaflet
│   └── img/                   # Images, logos
├── templates/                 # Jinja2 templates
│   ├── base.html              # Master layout
│   ├── auth/                  # Login, password reset, profile
│   ├── pages/                 # Page templates
│   ├── search/                # Search UI (OPTIONAL)
│   └── _md3_skeletons/        # Loading placeholders
├── migrations/                # SQL migrations
│   ├── 0001_create_auth_schema_postgres.sql
│   ├── 0001_create_auth_schema_sqlite.sql
│   └── 0002_create_analytics_tables.sql
├── tests/                     # pytest test suite
├── scripts/                   # Utility scripts
│   ├── create_initial_admin.py
│   ├── deploy_prod.sh
│   └── blacklab/              # Indexing tools (OPTIONAL)
├── data/                      # Persistent storage
│   ├── db/                    # SQLite auth DB (dev)
│   ├── metadata/              # Corpus metadata (OPTIONAL)
│   └── blacklab_index/        # Search indices (OPTIONAL)
├── media/                     # Audio files (OPTIONAL)
├── docs/                      # Documentation
│   ├── MODULES.md             # Module dependency map
│   ├── ARCHITECTURE.md        # System design
│   └── PRUNING_GUIDE.md       # Safe removal procedures
├── Dockerfile                 # Container image
├── docker-compose.yml         # Multi-service orchestration
├── pyproject.toml             # Python project config
├── requirements.txt           # Dependencies
├── .env.example               # Environment template
└── README.md                  # Project documentation
```

---

## Core Blueprint Registration

**File:** `src/app/routes/__init__.py`

```python
BLUEPRINTS = [
    public.blueprint,          # "/" - Public routes, landing, health
    auth.blueprint,            # "/auth" - Login, logout, profile
    media.blueprint,           # "/media" - Audio & transcripts
    admin.blueprint,           # "/admin" - Admin dashboard
    atlas.blueprint,           # "/atlas" - Geolinguistic map
    player.blueprint,          # "/player" - Audio player
    editor.blueprint,          # "/editor" - Transcript editing
    stats.blueprint,           # "/api/stats" - Statistics API
    bls_proxy.bp,             # "/bls" - BlackLab proxy
    advanced.bp,              # "/search/advanced" - CQL builder
    corpus.blueprint,          # "/corpus" - Corpus info
    admin_users.bp,           # "/api/admin" - User management API
    analytics.bp,             # "/api/analytics" - Analytics API (v1.0)
]
```

---

## Core Authentication Flow

### Login Endpoint
```python
# src/app/routes/auth.py
@blueprint.post("/login")
def login():
    """
    1. Validate credentials against auth.users table
    2. Generate JWT tokens (access + refresh)
    3. Set HTTP-only, secure cookies
    4. Redirect to ?next=... or dashboard
    """
```

### Protected Routes
```python
@blueprint.get("/admin/users")
@jwt_required()                      # Requires valid JWT
@require_role(Role.ADMIN)           # Requires admin role
def admin_users_page():
    return render_template(...)
```

### Auth Context (Every Request)
```python
# src/app/__init__.py - register_auth_context()
@app.before_request
def _set_auth_context():
    g.user = username_from_jwt     # Available in all routes
    g.role = role_from_jwt         # Role enum or None
    g.must_reset_password = bool   # Force password change flag
```

---

## Environment Variables (Minimal Setup)

```bash
# Required (always)
FLASK_SECRET_KEY=<64-random-chars>
JWT_SECRET_KEY=<64-random-chars>
AUTH_DATABASE_URL=sqlite:///data/db/auth.db    # or postgresql://...
FLASK_ENV=development                          # or production

# Optional (corpus only)
BLACKLAB_BASE_URL=http://localhost:8081/blacklab-server
ALLOW_PUBLIC_TEMP_AUDIO=false

# Optional (analytics, v1.0+)
ANALYTICS_ENABLED=true
```

---

## Database Schema (Auth Only)

### Users Table
```sql
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
    soft_deleted_at TIMESTAMP NULL         -- GDPR anonymization
);
```

### Refresh Tokens Table
```sql
CREATE TABLE auth.refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth.users(id) ON DELETE CASCADE,
    token_jti VARCHAR UNIQUE NOT NULL,     -- JWT ID for revocation
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Audit Log Table
```sql
CREATE TABLE auth.audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth.users(id),
    action VARCHAR NOT NULL,               -- 'login', 'create_user', etc.
    resource VARCHAR,                       -- Object ID or type
    metadata JSONB,                        -- Extra context
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Template Inheritance Pattern

```html
<!-- templates/base.html - Master layout -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>{% block title %}CO.RA.PAN{% endblock %}</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/md3/tokens.css') }}">
    {% block extra_head %}{% endblock %}
  </head>
  <body class="app-shell">
    <!-- MD3 Top App Bar -->
    {% include "partials/top_app_bar.html" %}
    
    <!-- Navigation Drawer -->
    {% include "partials/nav_drawer.html" %}
    
    <!-- Main Content -->
    {% block content %}{% endblock %}
  </body>
</html>

<!-- templates/pages/corpus_search.html - Inherits -->
{% extends "base.html" %}

{% block title %}Search the Corpus{% endblock %}

{% block content %}
  <div class="corpus-search">
    <!-- Page-specific content -->
  </div>
{% endblock %}
```

---

## Service Layer Pattern

```python
# src/app/services/blacklab_search.py (OPTIONAL)
def execute_cql_query(query: str, limit: int = 50) -> dict:
    """
    Args:
        query: CQL query string (validated)
        limit: Results per page
    
    Returns:
        {
            "hits": [
                {
                    "doc_id": "arg2251...",
                    "token_start": 5,
                    "token_end": 8,
                    "left": ["word", "word"],
                    "match": ["keyword"],
                    "right": ["word", "word"]
                },
                ...
            ],
            "total": 1234,
            "facets": {"country_code": {"ARG": 500, ...}}
        }
    """
    # 1. Validate CQL syntax
    # 2. Build BlackLab API request
    # 3. Execute query via HTTP client
    # 4. Parse response into canonical format
    # 5. Return results
```

---

## Flask Extensions Setup

**File:** `src/app/extensions/__init__.py`

```python
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_caching import Cache

jwt = JWTManager()
limiter = Limiter(default_limits=["1000 per day", "200 per hour"])
cache = Cache(config={"CACHE_TYPE": "SimpleCache"})

def register_extensions(app: Flask) -> None:
    """Initialize all extensions with Flask app."""
    jwt.init_app(app)
    limiter.init_app(app)
    cache.init_app(app)
    register_jwt_handlers()  # JWT error handlers
```

---

## Common Routes

### Public Routes (No Auth Required)
```
GET  /                      # Landing page
GET  /login                 # Login form
GET  /health                # Health check (Kubernetes)
GET  /impressum             # Legal info
GET  /privacy               # Privacy policy
GET  /proyecto/*            # Project info pages
```

### Authenticated Routes (JWT Required)
```
POST /auth/login            # Submit login form
GET  /auth/logout           # Logout (unset cookies)
GET  /auth/account/profile  # User profile page
POST /auth/password/change  # Change password
```

### Admin Routes (Admin Role Only)
```
GET  /admin/dashboard       # Admin overview
GET  /admin/users           # User management (DataTables)
POST /api/admin/users       # Create/modify users
DELETE /api/admin/users/:id # Delete user
```

### Public API (Open Access)
```
GET  /api/stats/all         # Corpus statistics (public)
GET  /health                # Service health
```

### Authenticated API
```
POST /api/analytics/event   # Track user action
```

---

## CSS Organization

### Material Design 3 Structure
```
static/css/
├── md3/
│   ├── tokens.css          # Color variables, typography scales
│   │   :root {
│   │     --md-sys-color-primary: #6750a4;
│   │     --md-sys-color-secondary: #625b71;
│   │     --md-ref-typeface-brand: "Roboto";
│   │   }
│   ├── typography.css      # Font sizes, weights, line heights
│   ├── layout.css          # Grid, spacing, responsive breakpoints
│   ├── components/
│   │   ├── auth.css        # Login form, password reset
│   │   ├── corpus.css      # Search results, KWIC display
│   │   ├── admin.css       # User tables, admin dashboard
│   │   ├── audio-player.css # Media controls
│   │   ├── atlas.css       # Map styling
│   │   ├── stats.css       # Chart styling
│   │   └── datatables-theme-lock.css  # Table theming
│   └── ...
└── app.css                 # Global overrides, app-specific styles
```

### BEM Naming Convention
```css
.corpus-search { }                  /* Block */
.corpus-search__form { }            /* Element */
.corpus-search__button { }
.corpus-search__button--primary { } /* Modifier */
.corpus-search--advanced { }        /* Block modifier */
```

---

## JavaScript Module Pattern

### Core Module (Auth Handling)
```javascript
// static/js/modules/core/auth_handler.js
const AuthHandler = (() => {
  const refreshToken = async () => {
    const res = await fetch('/auth/refresh', {method: 'POST'});
    if (!res.ok) window.location.href = '/login';
  };
  
  return {refreshToken, logout: () => {...}};
})();
```

### Feature Module (Search)
```javascript
// static/js/modules/search/searchUI.js
const SearchUI = (() => {
  const init = (containerSelector) => {
    const form = document.querySelector(containerSelector);
    form.addEventListener('submit', handleSubmit);
  };
  
  const handleSubmit = (event) => {
    event.preventDefault();
    const query = form.querySelector('input').value;
    // Submit to /search/advanced endpoint
  };
  
  return {init};
})();

// Initialization in template or main.js
document.addEventListener('DOMContentLoaded', () => {
  SearchUI.init('#search-form');
});
```

---

## Test Fixtures Pattern

```python
# tests/conftest.py or test_*.py
@pytest.fixture
def app():
    """Create test Flask app with auth configured."""
    from pathlib import Path
    from src.app import create_app
    
    project_root = Path(__file__).resolve().parents[1]
    
    app = create_app('testing')
    app.config['AUTH_DATABASE_URL'] = 'sqlite:///:memory:'
    app.config['TESTING'] = True
    
    # Initialize in-memory database
    from src.app.extensions.sqlalchemy_ext import init_engine, get_engine
    from src.app.auth.models import Base
    
    init_engine(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    
    return app

@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()

@pytest.fixture
def admin_token(client):
    """Create an admin user and return JWT token."""
    # 1. Create admin user in test DB
    # 2. POST to /auth/login
    # 3. Extract token from response
    # 4. Return token
```

---

## Docker Compose Services

```yaml
# docker-compose.yml
services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - FLASK_ENV=production
      - AUTH_DATABASE_URL=postgresql://postgres:pass@db:5432/corapan
      - BLACKLAB_BASE_URL=http://blacklab:8081/blacklab-server
    depends_on:
      - db
      - blacklab
    volumes:
      - ./data:/app/data
      - ./media:/app/media

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: securepass
      POSTGRES_DB: corapan
    volumes:
      - db_data:/var/lib/postgresql/data

  blacklab:
    image: institutefortheology/blacklab:3.7
    ports:
      - "8081:8080"
    volumes:
      - ./data/blacklab_index:/data/indices
      - ./config/blacklab:/config

volumes:
  db_data:
```

---

## Deployment Checklist

- [ ] Environment variables set (`.env` not in repo)
- [ ] Database migrations applied
- [ ] HTTPS reverse proxy configured (Nginx)
- [ ] `FLASK_ENV=production`
- [ ] `JWT_COOKIE_SECURE=true`
- [ ] `DEBUG=false`
- [ ] Rate limiting enabled
- [ ] Logging to file (not stdout)
- [ ] Database backups configured
- [ ] Health check endpoint monitored
- [ ] Secrets rotated (passwords, JWT keys)

---

## Identifying Inherited vs. Project-Specific

### Likely INHERITED (Reusable Template Code):
- `src/app/__init__.py` - Application factory
- `src/app/auth/` - Complete auth system
- `src/app/extensions/` - Flask extensions
- `src/app/routes/auth.py` - Auth routes
- `src/app/routes/admin.py` - Admin UI routes
- `static/css/md3/` - Material Design 3
- `templates/auth/` - Login, password reset
- `templates/base.html` - Master layout
- `migrations/0001_*` - Auth schema
- All test fixtures pattern

### Likely PROJECT-SPECIFIC (CO.RA.PAN Corpus):
- `src/app/search/` - BlackLab integration (CQL, token queries)
- `src/app/routes/corpus.py` - Corpus info & metadata
- `src/app/routes/player.py` - Audio player
- `src/app/routes/atlas.py` - Geolinguistic mapping
- `src/app/services/blacklab_search.py` - Search logic
- `src/app/services/audio_snippets.py` - Audio extraction
- `static/vendor/leaflet/` - Mapping library
- `static/vendor/echarts/` - Charting library
- `templates/search/` - Search UI templates
- `templates/pages/atlas.html` - Map template
- `scripts/blacklab/` - Indexing tools
- `config/blacklab/` - BlackLab configuration
- `media/` - Audio files directory structure

---

**Quick Reference for:** `games_hispanistica` audit team  
**Reference Repository:** FTacke/corapan-webapp v1.0.0  
**Last Updated:** January 5, 2026
