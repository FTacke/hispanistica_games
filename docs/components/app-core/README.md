# app-core Component

**Purpose:** Flask application factory, configuration loading, extension initialization, and core HTTP infrastructure.

**Scope:** Everything required to bootstrap and run the Flask application, excluding feature-specific logic (auth, quiz, etc.).

---

## Responsibility

1. **Application Factory** - Create configured Flask app instance
2. **Configuration Loading** - Environment-based config from environment variables
3. **Extension Registration** - Initialize JWT, rate limiter, cache, SQLAlchemy
4. **Blueprint Registration** - Register all route blueprints
5. **Error Handling** - Global error handlers for 404, 500, etc.
6. **Security** - CORS, CSP headers, proxy fix for X-Forwarded-*
7. **Logging** - Rotating file logs + console output

---

## Key Files

| Path | Purpose |
|------|---------|
| `src/app/__init__.py` | App factory `create_app()`, dependency verification |
| `src/app/main.py` | Entry point for Flask dev server |
| `src/app/config/__init__.py` | Configuration loading from environment variables |
| `src/app/config/countries.py` | Country/region data (used by quiz) |
| `src/app/extensions/__init__.py` | Extension registration (JWT, Limiter, Cache) |
| `src/app/extensions/sqlalchemy_ext.py` | SQLAlchemy engine initialization for auth DB |
| `src/app/routes/__init__.py` | Blueprint registration |

---

## Lifecycle

### Application Startup

```python
# Entry point: python -m src.app.main
# or: gunicorn src.app.main:app

from src.app import create_app

app = create_app(env_name="development")  # or "production", "testing"
app.run(host="0.0.0.0", port=8000)
```

**Startup Steps:**
1. **Dependency Check** - Verify psycopg2, argon2-cffi available
2. **Load Configuration** - Read environment variables
3. **Initialize Extensions** - JWT, Limiter, Cache, SQLAlchemy engine
4. **Register Blueprints** - public, auth, admin, quiz
5. **Register Error Handlers** - 404, 500, JWT errors
6. **Register Context Processors** - Inject variables into templates
7. **Register Auth Middleware** - Set `g.user`, `g.role` on every request
8. **Verify DB Connection** - Test auth DB connectivity
9. **Log Startup** - "games_hispanistica application startup"

### Request Lifecycle

```
Browser Request
    ↓
Werkzeug (WSGI)
    ↓
ProxyFix Middleware (X-Forwarded-* headers)
    ↓
Flask App
    ↓
Rate Limiter Check
    ↓
Auth Middleware (g.user, g.role from JWT)
    ↓
Route Handler (Blueprint)
    ↓
Service Layer (if needed)
    ↓
Database Query (if needed)
    ↓
Response Rendering (Jinja2 or JSON)
    ↓
HTTP Response
```

---

## Configuration

**Environment Variables (Required):**
```bash
FLASK_SECRET_KEY=<random-256-bit-hex>       # Flask session signing
JWT_SECRET_KEY=<random-256-bit-hex>         # JWT token signing
AUTH_DATABASE_URL=postgresql://...          # Auth DB connection string
```

**Environment Variables (Optional):**
```bash
FLASK_ENV=development|production            # Environment mode
AUTH_HASH_ALGO=argon2|bcrypt                # Password hashing algorithm
JWT_ACCESS_TOKEN_EXPIRES=3600               # Access token lifetime (seconds)
JWT_REFRESH_TOKEN_EXPIRES=2592000           # Refresh token lifetime (seconds)
CACHE_TYPE=SimpleCache|RedisCache           # Cache backend
CACHE_REDIS_URL=redis://localhost:6379/0    # Redis cache URL (if RedisCache)
```

**Configuration Loading:**
```python
# src/app/config/__init__.py
def load_config(app: Flask, env_name: str | None = None) -> None:
    """
    Load configuration from environment variables.
    Raises RuntimeError if required variables missing.
    """
```

**Configuration Sources (Priority Order):**
1. Environment variables (highest priority)
2. `.env` file (if python-dotenv installed)
3. Defaults (lowest priority)

---

## Extensions

### JWT Manager (Flask-JWT-Extended)

**Purpose:** JWT token creation, validation, refresh token rotation

**Configuration:**
- Token storage: HTTP-only, Secure, SameSite=Lax cookies
- Access token: 1 hour (default)
- Refresh token: 30 days (default)
- Token rotation: Automatic on refresh

**Usage in Routes:**
```python
from flask_jwt_extended import jwt_required, get_jwt_identity

@blueprint.get("/protected")
@jwt_required()
def protected_route():
    current_user = get_jwt_identity()  # Username from JWT
    # ...
```

### Rate Limiter (Flask-Limiter)

**Purpose:** Prevent abuse, brute-force attacks

**Configuration:**
- Global limits: 1000/day, 200/hour per IP
- Storage: In-memory (dev), Redis (production recommended)
- Strategy: Fixed window

**Usage in Routes:**
```python
from src.app.extensions import limiter

@blueprint.post("/login")
@limiter.limit("5 per minute")
def login_post():
    # Rate-limited to 5 attempts per minute per IP
    # ...
```

### Cache (Flask-Caching)

**Purpose:** Cache expensive operations (database queries, API calls)

**Configuration:**
- Dev: SimpleCache (in-memory)
- Prod: RedisCache (recommended)
- Default TTL: 300 seconds (5 minutes)

**Usage in Code:**
```python
from src.app.extensions import cache

@cache.memoize(timeout=60)
def expensive_operation(param):
    # Cached for 60 seconds per unique param value
    # ...
```

### SQLAlchemy Engine (Auth DB)

**Purpose:** Manage PostgreSQL connections for auth database

**Configuration:**
- Connection pooling: 5-20 connections
- Pool recycle: 1 hour (prevent stale connections)
- Fail-fast: Verify connection at startup (production)

**Usage:**
```python
from src.app.extensions.sqlalchemy_ext import get_engine

engine = get_engine()
with engine.connect() as conn:
    result = conn.execute(text("SELECT * FROM auth.users"))
```

---

## Error Handling

**Global Error Handlers:**

| Error | Handler | Response |
|-------|---------|----------|
| 404 Not Found | `handle_404()` | `errors/404.html` or JSON `{"error": "Not Found"}` |
| 500 Internal Server Error | `handle_500()` | `errors/500.html` or JSON `{"error": "Internal Server Error"}` |
| JWT Invalid/Expired | JWT error callbacks | Redirect to login or JSON `{"msg": "Token expired"}` |
| Rate Limit Exceeded | Limiter handler | 429 Too Many Requests |

**Content Negotiation:**
- HTML requests → Error page templates
- JSON/API requests → JSON error responses

---

## Security

### CORS (Cross-Origin Resource Sharing)

**Status:** Not explicitly configured (same-origin only)

**Future:** If API needs CORS, use Flask-CORS extension

### CSP (Content Security Policy)

**Status:** Not explicitly configured

**Recommendation:** Add CSP headers via middleware for production

### ProxyFix (X-Forwarded-* Headers)

**Configuration:**
```python
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,      # Trust 1 proxy for X-Forwarded-For
    x_proto=1,    # Trust X-Forwarded-Proto (http/https)
    x_host=1,     # Trust X-Forwarded-Host
    x_prefix=1,   # Trust X-Forwarded-Prefix
)
```

**Purpose:** Correctly handle HTTPS when behind Nginx reverse proxy

### Session Security

- Flask session: Signed with `FLASK_SECRET_KEY`
- JWT cookies: HTTP-only, Secure (HTTPS only in prod), SameSite=Lax

---

## Logging

**Configuration:**
- **Console:** INFO level (all environments)
- **File:** Rotating file handler in `logs/games_hispanistica.log`
  - Max size: 10 MB per file
  - Backups: 5 files
  - Format: `%(asctime)s %(levelname)s [%(name)s] %(message)s`

**Log Locations:**
- Dev: `logs/games_hispanistica.log` (project root)
- Prod: `/srv/webapps/games_hispanistica/logs/` (or configured path)

**Usage:**
```python
import logging

logger = logging.getLogger(__name__)
logger.info("Something happened")
logger.warning("Warning message")
logger.error("Error occurred", exc_info=True)
```

---

## Blueprints

**Registered Blueprints (in order):**

| Blueprint | Module | Prefix | Purpose |
|-----------|--------|--------|---------|
| `public` | `src/app/routes/public.py` | `/` | Landing page, health check, project pages |
| `auth` | `src/app/routes/auth.py` | `/auth` | Login, logout, account management |
| `admin` | `src/app/routes/admin.py` | `/api/admin` | Admin REST API for user management |
| `quiz` | `game_modules/quiz/routes.py` | `/quiz`, `/api/quiz` | Quiz game routes |

**Blueprint Registration:**
```python
# src/app/routes/__init__.py
BLUEPRINTS = [
    public.blueprint,
    auth.blueprint,
    admin.blueprint,
    quiz_blueprint,
]

def register_blueprints(app: Flask) -> None:
    for bp in BLUEPRINTS:
        app.register_blueprint(bp)
```

---

## Dependencies

**Python Version:** 3.12+

**Critical Dependencies:**
- `flask >= 3.1.0` - Web framework
- `flask-jwt-extended >= 4.6.0` - JWT authentication
- `flask-limiter >= 3.5.0` - Rate limiting
- `flask-caching >= 2.1.0` - Caching
- `sqlalchemy >= 2.0.0` - ORM
- `psycopg2-binary >= 2.9.0` - PostgreSQL driver
- `argon2-cffi >= 23.1.0` - Password hashing
- `werkzeug >= 3.0.0` - WSGI utilities

**See:** `requirements.txt` or `pyproject.toml` for complete list

---

## Interfaces

### Python API (App Factory)

```python
from src.app import create_app

# Create app with specific environment
app = create_app(env_name="development")

# Create app with auto-detected environment
app = create_app()  # Reads FLASK_ENV or defaults to development
```

### CLI (Development Server)

```bash
# Run dev server
python -m src.app.main

# Default: http://0.0.0.0:8000
```

### WSGI (Production)

```bash
# Gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 src.app.main:app

# uWSGI
uwsgi --http :8000 --module src.app.main:app
```

---

## Operations

### Health Check

```bash
curl http://localhost:8000/health
# Response: {"status": "healthy", "service": "games.hispanistica"}
```

### Verify Dependencies

```bash
# Check critical dependencies at startup
# Logs warnings if psycopg2, argon2-cffi unavailable
# App will start but with degraded features
```

### Environment Validation

```bash
# App will fail to start if required env vars missing:
# - FLASK_SECRET_KEY
# - JWT_SECRET_KEY
# - AUTH_DATABASE_URL
```

---

## Related Components

- **[auth](../auth/)** - Uses JWT extension initialized here
- **[database](../database/)** - Uses SQLAlchemy engine initialized here
- **[deployment](../deployment/)** - Configuration and startup procedures
- **[frontend-ui](../frontend-ui/)** - Templates rendered via Flask

---

## Troubleshooting

**App fails to start with "RuntimeError: FLASK_SECRET_KEY must be provided"**
- Solution: Set environment variable `FLASK_SECRET_KEY=<random-hex>`

**"psycopg2 not available" warning**
- Solution: Install PostgreSQL driver: `pip install psycopg2-binary`

**"Auth DB connection failed"**
- Solution: Verify `AUTH_DATABASE_URL` is correct, PostgreSQL is running

**JWT tokens not working**
- Solution: Check `JWT_SECRET_KEY` is set, cookies are not blocked by browser

**Rate limit exceeded errors**
- Solution: Increase limits in `src/app/extensions/__init__.py` or use Redis for distributed rate limiting

---

**See Also:**
- Main README: [../../README.md](../../README.md)
- Configuration: Environment variables section above
- Deployment: [../deployment/](../deployment/)
