# CO.RA.PAN System Architecture

> **Version:** 1.0  
> **Purpose:** High-level system architecture and component relationships  
> **Last Updated:** 2025-12-19

This document provides an overview of the CO.RA.PAN webapp architecture, data flow, and component interactions.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Component Relationships](#component-relationships)
4. [Data Flow](#data-flow)
5. [Authentication & Authorization](#authentication--authorization)
6. [Database Schema](#database-schema)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Architecture](#deployment-architecture)

---

## System Overview

The CO.RA.PAN webapp is a Flask-based web application following a modular, layered architecture with clear separation of concerns.

### Key Characteristics

- **Framework:** Flask (Python 3.12+)
- **Architecture Pattern:** Modular Blueprint-based MVC
- **Authentication:** JWT with refresh token rotation
- **Database:** PostgreSQL (production), SQLite (development fallback)
- **Frontend:** Server-side rendered templates (Jinja2) with progressive enhancement (HTMX)
- **Design System:** Material Design 3 (CSS-based)
- **Testing:** pytest (unit/integration), Playwright (E2E)
- **Deployment:** Docker Compose, Gunicorn, Nginx (reverse proxy)

### Design Principles

1. **Modularity:** Features organized as independent modules (see [MODULES.md](MODULES.md))
2. **Security-First:** JWT tokens, CSRF protection, rate limiting, CSP headers
3. **Privacy by Design:** DSGVO-compliant analytics, minimal data collection
4. **Accessibility:** WCAG 2.1 AA compliance, semantic HTML, ARIA labels
5. **Progressive Enhancement:** Works without JavaScript, enhanced with JS
6. **Template-First:** Designed for reuse in new projects

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                       Presentation Layer                     │
│  (HTML Templates, CSS, JavaScript, MD3 Components)          │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                      Application Layer                       │
│  (Flask Blueprints, Route Handlers, Request/Response)       │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                       Business Logic Layer                   │
│  (Services, Auth, Search, Export, Analytics)                │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                       Data Access Layer                      │
│  (SQLAlchemy Models, BlackLab API, File System)             │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                      Infrastructure Layer                    │
│  (PostgreSQL, BlackLab Server, File Storage, Docker)        │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### 1. Presentation Layer
- **Location:** `templates/`, `static/`
- **Responsibility:** User interface, visual design, client-side interactions
- **Technologies:** Jinja2, HTML5, CSS3 (MD3), JavaScript (vanilla + HTMX)
- **Key Files:**
  - `templates/_md3_skeletons/` - Template patterns
  - `static/css/md3/` - Design system
  - `static/js/` - Interactive behaviors

#### 2. Application Layer
- **Location:** `src/app/routes/`
- **Responsibility:** HTTP request handling, routing, response generation
- **Technologies:** Flask Blueprints
- **Key Files:**
  - `src/app/routes/public.py` - Public routes (search, corpus, atlas)
  - `src/app/routes/admin.py` - Admin routes (user management, analytics)
  - `src/app/routes/auth.py` - Auth routes (login, logout, profile) [Note: Actually in src/app/auth/routes.py]

#### 3. Business Logic Layer
- **Location:** `src/app/services/`, `src/app/search/`, `src/app/auth/`, `src/app/analytics/`
- **Responsibility:** Business rules, data processing, external API integration
- **Technologies:** Python modules, SQLAlchemy, requests
- **Key Modules:**
  - `src/app/auth/` - Authentication/authorization logic
  - `src/app/search/` - Corpus search, CQL parsing, BlackLab integration
  - `src/app/analytics/` - Usage tracking, reporting
  - `src/app/services/` - Shared business logic

#### 4. Data Access Layer
- **Location:** `src/app/models/`, `src/app/auth/models.py`
- **Responsibility:** Database operations, external data retrieval
- **Technologies:** SQLAlchemy ORM
- **Key Files:**
  - `src/app/auth/models.py` - User, RefreshToken, AuditLog models
  - `src/app/models/` - Other data models (if any)

#### 5. Infrastructure Layer
- **Location:** External services, Docker containers
- **Responsibility:** Data persistence, external services
- **Technologies:** PostgreSQL, BlackLab Server, Docker, Nginx
- **Services:**
  - PostgreSQL: Auth database
  - BlackLab Server: Corpus search engine
  - File System: Media files, exports, logs

---

## Component Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐             │
│  │   Browser  │   │   Nginx    │   │   Docker   │             │
│  │            │   │  (Reverse  │   │  Compose   │             │
│  │   (User)   │   │   Proxy)   │   │            │             │
│  └─────┬──────┘   └─────┬──────┘   └─────┬──────┘             │
│        │                │                │                      │
│        │  HTTP/HTTPS    │                │                      │
│        └────────────────▼────────────────▼──────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Flask App (Gunicorn)                   │  │
│  │                                                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │  Public  │  │   Auth   │  │  Admin   │  │  API     │ │  │
│  │  │  Routes  │  │  Routes  │  │  Routes  │  │ Routes   │ │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │  │
│  │       │             │             │             │         │  │
│  │       └─────────────┴─────────────┴─────────────┘         │  │
│  │                          │                                 │  │
│  │       ┌──────────────────┴───────────────────┐            │  │
│  │       │                                      │            │  │
│  │  ┌────▼──────┐  ┌─────────────┐  ┌─────────▼────────┐   │  │
│  │  │   Auth    │  │   Search    │  │   Analytics     │   │  │
│  │  │  Service  │  │   Service   │  │    Service      │   │  │
│  │  └────┬──────┘  └──────┬──────┘  └─────────┬────────┘   │  │
│  │       │                │                    │            │  │
│  │  ┌────▼──────┐  ┌──────▼──────┐  ┌─────────▼────────┐   │  │
│  │  │   User    │  │  BlackLab   │  │   PostgreSQL     │   │  │
│  │  │   Model   │  │    API      │  │   (Analytics)    │   │  │
│  │  └────┬──────┘  └──────┬──────┘  └──────────────────┘   │  │
│  │       │                │                                 │  │
│  └───────┼────────────────┼─────────────────────────────────┘  │
│          │                │                                    │
│  ┌───────▼─────────┐  ┌───▼──────────────┐                    │
│  │   PostgreSQL    │  │  BlackLab Server │                    │
│  │  (Auth DB)      │  │  (Lucene Index)  │                    │
│  └─────────────────┘  └──────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Core Component Interactions

**1. User Authentication Flow**
```
User → Login Page → Auth Routes → Auth Service → User Model → PostgreSQL
                                                      ↓
                                              JWT Token Created
                                                      ↓
                                        Cookie Set → Response to User
```

**2. Corpus Search Flow**
```
User → Search Form → Public Routes → Search Service → BlackLab API
                                            ↓
                                    Parse CQL Query
                                            ↓
                                    Fetch Results
                                            ↓
                                  Enrich with Metadata
                                            ↓
                            Render Results Template → User
```

**3. Admin User Management Flow**
```
Admin → Admin UI → Admin Routes → Auth Middleware (check role)
                                          ↓
                                   User Model CRUD
                                          ↓
                                    PostgreSQL
                                          ↓
                                   Audit Log Entry
                                          ↓
                              Response → Admin UI Updated
```

---

## Data Flow

### Request Processing Pipeline

```
1. Nginx receives HTTPS request
   ↓
2. Nginx forwards to Gunicorn (port 8000)
   ↓
3. Flask receives request
   ↓
4. Before-request hooks execute:
   - CSRF validation (if POST)
   - JWT token validation (if protected route)
   - Role check (if admin route)
   ↓
5. Route handler executes
   ↓
6. Business logic layer processes
   ↓
7. Data layer retrieves/persists data
   ↓
8. Template rendered (or JSON returned for API)
   ↓
9. After-request hooks execute:
   - Set security headers
   - Log analytics events
   ↓
10. Response sent to Nginx
    ↓
11. Nginx sends response to user
```

### Authentication Data Flow

**Login:**
```
1. User submits username/password
2. Auth service validates credentials
3. Password hash verified (argon2/bcrypt)
4. JWT access token created (15min TTL)
5. Refresh token created (7 days TTL)
6. Refresh token stored in database
7. Both tokens set as HTTP-only cookies
8. User redirected to dashboard
```

**Token Refresh:**
```
1. Access token expires
2. Client sends refresh token
3. Server validates refresh token
4. New access token issued
5. Optionally: new refresh token (rotation)
6. Old refresh token invalidated
7. Cookies updated
```

**Logout:**
```
1. User clicks logout
2. Refresh token invalidated in database
3. Cookies cleared
4. User redirected to login
```

---

## Authentication & Authorization

### JWT Token Structure

**Access Token (15 minutes):**
```json
{
  "sub": "user_id",
  "role": "admin",
  "exp": 1734654321,
  "iat": 1734653421,
  "type": "access"
}
```

**Refresh Token (7 days):**
```json
{
  "sub": "user_id",
  "jti": "unique_token_id",
  "exp": 1735259421,
  "iat": 1734654621,
  "type": "refresh"
}
```

### Role Hierarchy

```
ADMIN (role_level=3)
  ├── Can manage all users
  ├── Can access admin routes
  ├── Can view analytics
  └── Inherits all lower permissions
        ↓
EDITOR (role_level=2)
  ├── Can edit content
  ├── Can access editor tools
  └── Inherits all lower permissions
        ↓
USER (role_level=1)
  ├── Can view corpus
  ├── Can search
  └── Basic authenticated access
        ↓
ANONYMOUS (role_level=0)
  └── Public pages only
```

### Middleware Stack

```python
@app.before_request
def before_request():
    # 1. CSRF validation (if POST/PUT/DELETE)
    # 2. JWT token extraction and validation
    # 3. Load current user from database
    
@app.after_request
def after_request(response):
    # 1. Set security headers (CSP, HSTS, X-Frame-Options)
    # 2. Log analytics event (if enabled)
    # 3. Rate limit check
    return response
```

### Protection Decorators

```python
# Require authentication
@jwt_required()

# Require specific role
@require_role(Role.ADMIN)

# Require specific roles (any of)
@require_role(Role.ADMIN, Role.EDITOR)

# Check permission
@check_permission("corpus.view")
```

---

## Database Schema

### Auth Schema (PostgreSQL)

```sql
-- Users table
CREATE TABLE auth.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    locked_until TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Refresh tokens table
CREATE TABLE auth.refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    jti VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE
);

-- Audit log table
CREATE TABLE auth.audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Analytics Schema (Optional)

```sql
-- Page views
CREATE TABLE auth.analytics_pageviews (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    referrer VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Search events
CREATE TABLE auth.analytics_search_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    query VARCHAR(1000),
    query_type VARCHAR(50),
    result_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audio events
CREATE TABLE auth.analytics_audio_events (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    token_id VARCHAR(255),
    action VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_users_username ON auth.users(username);
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_role ON auth.users(role);
CREATE INDEX idx_users_active ON auth.users(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_refresh_tokens_user ON auth.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_jti ON auth.refresh_tokens(jti);
CREATE INDEX idx_refresh_tokens_expires ON auth.refresh_tokens(expires_at);

CREATE INDEX idx_audit_log_user ON auth.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON auth.audit_log(action);
CREATE INDEX idx_audit_log_created ON auth.audit_log(created_at);

-- Analytics indexes
CREATE INDEX idx_pageviews_session ON auth.analytics_pageviews(session_id);
CREATE INDEX idx_pageviews_created ON auth.analytics_pageviews(created_at);
CREATE INDEX idx_search_events_session ON auth.analytics_search_events(session_id);
CREATE INDEX idx_audio_events_session ON auth.analytics_audio_events(session_id);
```

---

## Testing Strategy

### Test Pyramid

```
         /\
        /  \       ┌─────────────────────────────────────┐
       /E2E \      │ E2E Tests (Playwright)              │
      /      \     │ - Full user flows                   │
     /────────\    │ - Cross-browser testing             │
    /          \   └─────────────────────────────────────┘
   / Integration\  ┌─────────────────────────────────────┐
  /              \ │ Integration Tests (pytest)          │
 /────────────────\│ - API endpoints                     │
/                  │ - Database interactions             │
──────────────────────────────────────────────────────────
/                  │ - Multi-component flows             │
/     Unit Tests   \└─────────────────────────────────────┘
──────────────────────────────────────────────────────────
                   ┌─────────────────────────────────────┐
                   │ Unit Tests (pytest)                 │
                   │ - Pure functions                    │
                   │ - Model methods                     │
                   │ - Business logic                    │
                   └─────────────────────────────────────┘
```

### Test Organization

```
tests/
├── test_auth.py               # Auth module unit tests
├── test_admin_users.py        # Admin CRUD tests
├── test_account_status.py     # Account lifecycle tests
├── test_advanced_api_*.py     # Search API integration tests
├── test_analytics_*.py        # Analytics module tests
├── test_export_*.py           # Export functionality tests
├── e2e/                       # Playwright E2E tests (gitignored)
└── conftest.py                # Shared fixtures
```

### Test Coverage Goals

- **Unit Tests:** >80% coverage for business logic
- **Integration Tests:** All API endpoints
- **E2E Tests:** Critical user flows (login, search, admin)

### Running Tests

```bash
# All tests
pytest

# With coverage
pytest --cov=src/app --cov-report=html

# Specific test
pytest tests/test_auth.py -k test_login

# E2E tests
npm run test:e2e

# CI simulation
./scripts/ci-local.sh  # (if exists)
```

---

## Deployment Architecture

### Production Deployment (Docker Compose)

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                           │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS (443)
┌────────────────────▼────────────────────────────────────┐
│               Nginx Reverse Proxy                       │
│  - SSL Termination                                      │
│  - Static file serving (/static, /media)               │
│  - Rate limiting                                        │
│  - Proxy to Gunicorn (port 8000)                       │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (internal)
┌────────────────────▼────────────────────────────────────┐
│            Flask App (Gunicorn WSGI)                    │
│  - Workers: 4 (2 * CPU cores + 1)                      │
│  - Timeout: 120s                                        │
│  - Graceful reload on deploy                           │
└──────┬─────────────────────────────────────┬────────────┘
       │                                     │
       │ PostgreSQL                          │ HTTP API
       │ (port 5432)                         │ (port 8081)
       │                                     │
┌──────▼──────────────┐            ┌─────────▼────────────┐
│  PostgreSQL         │            │  BlackLab Server     │
│  - Auth database    │            │  - Corpus index      │
│  - Analytics data   │            │  - Lucene backend    │
└─────────────────────┘            └──────────────────────┘
```

### Docker Services

**docker-compose.prod.yml:**
```yaml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - FLASK_ENV=production
      - AUTH_DATABASE_URL=${AUTH_DATABASE_URL}
    volumes:
      - ./data:/app/data
      - ./media:/app/media
      - ./logs:/app/logs
    depends_on:
      - db
      
  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  blacklab:
    image: instituutnederlandsetaal/blacklab:latest
    ports:
      - "8081:8081"
    volumes:
      - ./data/blacklab_index:/data
```

### Deployment Process

1. **Build:** Docker image built on GitHub Actions runner
2. **Test:** CI runs all tests before deployment
3. **Deploy:** SSH to server, pull image, restart containers
4. **Migrate:** Database migrations applied automatically
5. **Health Check:** Verify /health endpoints
6. **Rollback:** Previous image kept for quick rollback

See: [docs/operations/deployment.md](operations/deployment.md)

---

## Security Architecture

### Defense in Depth

**Layer 1: Network**
- Firewall rules (only ports 80, 443, 22 open)
- Rate limiting at Nginx level
- DDoS protection (Cloudflare or similar)

**Layer 2: Application**
- CSRF tokens on all state-changing requests
- JWT token validation
- Role-based access control
- Input validation and sanitization

**Layer 3: Data**
- Password hashing (argon2/bcrypt)
- Encrypted database connections (SSL)
- Sensitive data never logged
- Token rotation on refresh

**Layer 4: Headers**
```python
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

See: [docs/operations/production_hardening.md](operations/production_hardening.md)

---

## Performance Considerations

### Caching Strategy

- **Static Assets:** Nginx serves with long cache headers (1 year)
- **Templates:** Jinja2 template compilation cached
- **Database:** Connection pooling (SQLAlchemy)
- **Search Results:** No caching (always fresh from BlackLab)

### Optimization Techniques

1. **Lazy Loading:** Large datasets paginated
2. **Streaming:** CSV exports streamed to avoid memory issues
3. **Indexing:** Database indexes on frequently queried columns
4. **CDN:** Static assets served via CDN (optional)
5. **Compression:** Gzip compression on text responses

---

## See Also

- [MODULES.md](MODULES.md) - Module dependency matrix
- [PRUNING_GUIDE.md](PRUNING_GUIDE.md) - Removing modules
- [reference/project_structure.md](reference/project_structure.md) - File organization
- [operations/deployment.md](operations/deployment.md) - Deployment guide
- [operations/production_hardening.md](operations/production_hardening.md) - Security guide
