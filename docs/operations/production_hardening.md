# Production Hardening Overview

> **Status:** Implemented  
> **Date:** 2025-11-27  
> **Scope:** Tests, Security, Performance, Observability, CI/CD

---

## 1. Test Coverage

### 1.1 Current Test Inventory

| Category | Files | Coverage |
|----------|-------|----------|
| **Auth Flow** | `test_auth_flow.py`, `test_auth_db_flow.py`, `test_auth_db_endpoints.py` | Login, logout, password change, reset request/confirm, profile CRUD |
| **Admin Users** | `test_admin_users.py` | List, create, invite, lock/unlock, role changes, password reset |
| **Role-Based Access** | `test_admin_users.py`, `test_security_headers.py` | Admin-only routes protected, 403 for unauthorized |
| **Search** | `test_advanced_search.py`, `test_cql_*.py`, `test_bls_*.py` | CQL generation, filters, BlackLab integration |
| **Security** | `test_security_headers.py`, `test_rate_limit_and_cookie.py` | CSP, HSTS, cookie security |
| **UI/Pages** | `test_ui_pages.py`, `test_top_app_bar_rendering.py`, `test_privacy_page.py` | Page rendering, navigation |
| **E2E** | `tests/e2e/playwright/auth.spec.js`, `profile-ui.spec.js` | Login/logout flow, profile UI |

### 1.2 Core Flows Covered

#### Auth
- ✅ Login (valid credentials)
- ✅ Login (invalid credentials → error message)
- ✅ Password change (success + old sessions invalidated)
- ✅ Password reset request
- ✅ Password reset confirm with token

#### Roles
- ✅ Admin routes require `@jwt_required() @require_role(Role.ADMIN)`
- ✅ Unauthorized users get 401/403
- ✅ Role checks enforced via `decorators.py`

#### Search
- ✅ CQL query building with various filters
- ✅ Country scope (national/regional)
- ✅ Speaker filters

#### Admin User Management
- ✅ User creation with invite link
- ✅ Invite metadata (expiry, ID)
- ✅ Password reset returns invite link
- ✅ Lock/unlock users
- ✅ List users with filter (default: active only, optional: include inactive)
- ✅ Update user email, role, is_active status
- ✅ Last-admin protection (cannot demote/deactivate the last active admin)
- ✅ Email format validation

### 1.3 Running Tests

```bash
# All tests
pytest

# Specific category
pytest tests/test_auth_flow.py
pytest tests/test_admin_users.py -v

# E2E (requires server running)
npm run test:e2e
```

---

## 2. Security Hardening

### 2.1 Security Headers

All responses include security headers via `register_security_headers()` in `src/app/__init__.py`:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HSTS (production only) |
| `Content-Security-Policy` | See below | Script/style sources |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer info |

#### CSP Configuration

```
default-src 'self';
script-src 'self' https://code.jquery.com https://cdn.jsdelivr.net 
           https://cdn.datatables.net https://cdnjs.cloudflare.com https://unpkg.com;
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.datatables.net 
          https://cdnjs.cloudflare.com https://unpkg.com https://fonts.googleapis.com;
img-src 'self' data: https: blob:;
font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net 
         https://fonts.googleapis.com https://fonts.gstatic.com;
connect-src 'self';
media-src 'self' blob:;
frame-ancestors 'none';
```

### 2.2 Cookie Security

JWT cookies are configured via Flask-JWT-Extended:

| Setting | Value | Notes |
|---------|-------|-------|
| `JWT_COOKIE_SECURE` | `True` (prod) / `False` (dev) | HTTPS-only in production |
| `JWT_COOKIE_HTTPONLY` | `True` | Not accessible via JavaScript |
| `JWT_COOKIE_SAMESITE` | `Lax` | CSRF protection |
| `JWT_COOKIE_CSRF_PROTECT` | `True` | Double-submit CSRF |

### 2.3 Session/Token Invalidation

- **Logout:** Calls `unset_jwt_cookies()` to clear tokens
- **Password Change:** Revokes all refresh tokens for user (see `test_change_password_success_and_invalidate`)
- **Account Delete:** Soft-deletes user, revokes all tokens

### 2.4 Rate Limiting

Rate limiting via Flask-Limiter on auth endpoints:
- `/auth/login`: Limited to prevent brute force
- `/auth/refresh`: Limited to prevent token abuse

---

## 3. Performance

### 3.1 Frontend Optimizations

- **CSS Preloading:** Critical CSS preloaded in `<head>`
- **Async Font Loading:** Icon fonts loaded with `media="print"` + async swap
- **Cache Busting:** `APP_BUILD_ID` timestamp added for versioned assets

### 3.2 Static Asset Caching

Configure in production (nginx/reverse proxy):

```nginx
location /static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    gzip on;
    gzip_types text/css application/javascript;
}
```

### 3.3 Backend

- BlackLab queries use httpx with connection pooling
- Auth DB uses SQLAlchemy with session management
- Rotating log files (10MB, 5 backups)

---

## 4. Observability

### 4.1 Logging

Structured logging configured in `setup_logging()`:

```
[%(asctime)s] %(levelname)s in %(module)s: %(message)s
```

- **Location:** `logs/corapan.log`
- **Rotation:** 10MB max, 5 backup files
- **No sensitive data:** Passwords/tokens never logged

### 4.2 Health Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | Overall health | `{"status": "healthy/degraded/unhealthy", "checks": {...}}` |
| `/health/bls` | BlackLab status | `{"ok": true/false, "url": "...", "error": null}` |
| `/health/auth` | Auth DB status | `{"ok": true/false, "error": null}` |

### 4.3 Error Tracking

Custom error handlers in `register_error_handlers()`:
- 400, 401, 403, 404, 500 all logged
- API routes return JSON errors
- HTML routes render error templates

**Optional Sentry Integration:**

```python
# In src/app/__init__.py
import sentry_sdk
sentry_sdk.init(dsn=os.getenv("SENTRY_DSN"))
```

---

## 5. CI/CD Pipeline

### 5.1 Pipeline Steps (`.github/workflows/ci.yml`)

1. **Lint/Format** (`ruff check`, `ruff format --check`)
2. **MD3 Guards** (`md3-forms-auth-guard.py`, `md3-lint.py`)
3. **Unit/Integration Tests** (`pytest`)
4. **Postgres Integration Tests** (tests against PostgreSQL)
5. **E2E Tests** (Playwright, after unit tests pass)

### 5.2 Database Testing

Tests run against both SQLite (quick) and PostgreSQL (production-representative):

```yaml
# CI Matrix for database testing
strategy:
  matrix:
    db: [sqlite, postgres]
```

- **SQLite:** Fast feedback, no external dependencies
- **PostgreSQL:** Production-representative, required before release

### 5.3 Branch Protection

- PRs to `main` require all checks to pass
- Matrix testing for `bcrypt` and `argon2` hash algorithms

### 5.4 Secrets Management

All sensitive values from environment variables:

| Variable | Purpose |
|----------|---------|
| `FLASK_SECRET_KEY` | Session encryption |
| `JWT_SECRET_KEY` | JWT signing (HMAC) |
| `AUTH_DATABASE_URL` | Auth database connection (Postgres in prod) |
| `SENTRY_DSN` | Error tracking (optional) |

See `.env.example` for complete list.

---

## 6. Deployment Checklist

See `docs/operations/release_checklist.md` for pre/post-deploy steps.

---

## 7. Known Gaps / Future Work

1. **Visual Regression:** Screenshot tests not yet automated
2. **Load Testing:** No performance benchmarks established
3. **CDN:** Static assets served locally (consider CDN for scale)
4. **APM:** No application performance monitoring (consider Datadog/New Relic)
