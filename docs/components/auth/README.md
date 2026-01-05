# auth Component

**Purpose:** JWT-based authentication, user management, role-based access control (RBAC), password reset workflows.

**Scope:** Everything related to user identity, authentication tokens, and authorization.

---

## Responsibility

1. **User Management** - CRUD operations on users (create, read, update, delete/deactivate)
2. **Authentication** - Login/logout, JWT token generation, token refresh
3. **Authorization** - Role-based access control (USER, EDITOR, ADMIN)
4. **Password Management** - Secure hashing (argon2/bcrypt), reset workflows, change password
5. **Session Management** - Refresh token rotation, logout, revocation
6. **Account Security** - Failed login tracking, account locking, password expiry

---

## Key Files

| Path | Purpose |
|------|---------|
| `src/app/auth/models.py` | SQLAlchemy ORM models: User, RefreshToken, ResetToken |
| `src/app/auth/services.py` | Business logic: create_user, authenticate, refresh_token, etc. |
| `src/app/auth/decorators.py` | Route decorators: `@require_role(Role.ADMIN)` |
| `src/app/auth/__init__.py` | Role enum, JWT context helpers |
| `src/app/routes/auth.py` | Auth blueprint: login, logout, account pages |
| `templates/auth/` | Auth UI templates (login, account management) |
| `static/js/auth/` | Frontend JavaScript for auth flows |

---

## Data Model

### auth.users Table

| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | VARCHAR(36) PK | UUID v4 |
| `username` | VARCHAR UNIQUE | Login identifier |
| `email` | VARCHAR UNIQUE NULL | Email address (optional) |
| `password_hash` | TEXT | argon2 or bcrypt hash |
| `role` | VARCHAR(32) | 'user', 'editor', 'admin' |
| `is_active` | BOOLEAN | Account enabled/disabled |
| `must_reset_password` | BOOLEAN | Force password change on next login |
| `created_at` | TIMESTAMP | Account creation |
| `updated_at` | TIMESTAMP | Last modification |
| `last_login_at` | TIMESTAMP NULL | Last successful login |
| `login_failed_count` | INTEGER | Failed login attempts (brute-force protection) |
| `locked_until` | TIMESTAMP NULL | Account lock expiry |
| `deleted_at` | TIMESTAMP NULL | Soft delete timestamp |
| `deletion_requested_at` | TIMESTAMP NULL | Account deletion request timestamp |
| `display_name` | VARCHAR NULL | User-friendly display name |
| `access_expires_at` | TIMESTAMP NULL | Account expiry (time-limited access) |
| `valid_from` | TIMESTAMP NULL | Account validity start |

### auth.refresh_tokens Table

| Column | Type | Purpose |
|--------|------|---------|
| `token_id` | VARCHAR(36) PK | UUID v4 |
| `user_id` | VARCHAR(36) FK | References users(user_id) |
| `token_hash` | TEXT | SHA-256 hash of refresh token |
| `created_at` | TIMESTAMP | Token creation |
| `expires_at` | TIMESTAMP | Token expiry (30 days default) |
| `revoked_at` | TIMESTAMP NULL | Manual revocation |
| `user_agent` | VARCHAR NULL | Browser/client info |
| `ip_address` | VARCHAR NULL | Client IP |

### auth.reset_tokens Table

| Column | Type | Purpose |
|--------|------|---------|
| `token_id` | VARCHAR(36) PK | UUID v4 |
| `user_id` | VARCHAR(36) FK | References users(user_id) |
| `token_hash` | TEXT | SHA-256 hash of reset token |
| `created_at` | TIMESTAMP | Token creation |
| `expires_at` | TIMESTAMP | Token expiry (1 hour default) |
| `used_at` | TIMESTAMP NULL | Token usage timestamp |

---

## Authentication Flow

### Login (Password-Based)

```
1. User submits username + password → POST /auth/login
2. Service validates credentials (auth.services.authenticate_user)
3. Check: is_active, not locked, not deleted
4. Verify password hash (argon2.verify)
5. Update last_login_at, reset login_failed_count
6. Generate JWT access token (1 hour expiry)
7. Generate JWT refresh token (30 days expiry)
8. Store refresh_token in auth.refresh_tokens (hashed)
9. Set HTTP-only, Secure cookies with tokens
10. Redirect to ?next= URL or /
```

**Routes:**
- `GET /auth/login` - Login form
- `POST /auth/login` - Process login (rate-limited: 5/min)

### Token Refresh

```
1. Access token expires → Frontend detects 401
2. Send refresh token → POST /auth/refresh
3. Validate refresh token (JWT + DB lookup)
4. Generate new access + refresh tokens
5. Revoke old refresh token
6. Return new tokens in cookies
```

**Routes:**
- `POST /auth/refresh` - Refresh tokens

### Logout

```
1. User clicks logout → POST /auth/logout
2. Revoke refresh token in DB (set revoked_at)
3. Clear JWT cookies
4. Redirect to login page
```

**Routes:**
- `POST /auth/logout` - Logout

---

## Authorization (RBAC)

### Roles

```python
# src/app/auth/__init__.py
from enum import Enum

class Role(str, Enum):
    USER = "user"      # Basic user (quiz player)
    EDITOR = "editor"  # Content editor (future)
    ADMIN = "admin"    # Full admin access
```

### Route Protection

```python
from flask_jwt_extended import jwt_required
from src.app.auth.decorators import require_role
from src.app.auth import Role

@blueprint.get("/admin/dashboard")
@jwt_required()                    # Step 1: Verify JWT valid
@require_role(Role.ADMIN)         # Step 2: Check user has admin role
def admin_dashboard():
    # Only accessible to admins
    # ...
```

### Permission Hierarchy

```
ADMIN > EDITOR > USER
- ADMIN: All permissions
- EDITOR: USER permissions + content editing (future)
- USER: Basic quiz gameplay
```

---

## Password Security

### Hashing Algorithm

**Preferred:** argon2id (if argon2-cffi installed)  
**Fallback:** bcrypt (if argon2 unavailable)

**argon2 Configuration:**
- Memory cost: 65536 KB (64 MB)
- Time cost: 3 iterations
- Parallelism: 4 threads
- Salt: Random 16 bytes (auto-generated)

### Password Requirements

**No explicit validation** in current code. Recommendations:
- Minimum 8 characters
- Mix of letters, numbers, special chars
- Not common passwords (future: add blocklist)

### Password Change

**Routes:**
- `GET /auth/account/password/page` - Password change form
- `POST /auth/change-password` - Process password change (requires current password)

### Password Reset

**Workflow:**
```
1. User requests reset → POST /auth/reset-password/request (email)
2. System generates reset token (1 hour expiry)
3. Send email with reset link (NOT IMPLEMENTED - requires email service)
4. User clicks link → GET /auth/reset-password/confirm?token=...
5. User submits new password → POST /auth/reset-password/confirm
6. System validates token, updates password, marks token as used
```

**Note:** Email sending NOT implemented. Token generation works but requires manual delivery.

---

## Account Management

### Account Profile

**Routes:**
- `GET /auth/account/profile` - View profile
- `PATCH /auth/account/profile` - Update profile (display_name, email)

### Account Deletion

**Routes:**
- `GET /auth/account/delete/page` - Account deletion form
- `POST /auth/account/delete` - Request deletion (sets deletion_requested_at)

**Note:** Soft delete only. User data retained for audit/compliance.

---

## Security Features

### Brute-Force Protection

**Failed Login Tracking:**
- Increment `login_failed_count` on failed login
- Lock account for 15 minutes after 5 failed attempts (sets `locked_until`)
- Reset counter on successful login

### Token Security

**JWT Tokens:**
- HTTP-only cookies (prevents XSS)
- Secure flag (HTTPS only in production)
- SameSite=Lax (CSRF protection)
- Short expiry (1 hour access, 30 days refresh)

**Refresh Token Rotation:**
- New refresh token on each refresh request
- Old refresh token revoked immediately
- Prevents token replay attacks

### Rate Limiting

**Login Endpoint:**
- 5 attempts per minute per IP
- Prevents brute-force attacks

---

## Interfaces

### Service Layer API

```python
from src.app.auth import services

# Create user
user_id = services.create_user(
    username="testuser",
    password="securepass123",
    email="test@example.com",
    role="user"
)

# Authenticate
user_data = services.authenticate_user(username="testuser", password="securepass123")
# Returns: {"user_id": "...", "username": "...", "role": "...", "must_reset_password": False}

# Generate tokens
access_token, refresh_token = services.create_access_and_refresh_tokens(
    user_id="...", 
    username="...", 
    role="..."
)

# Refresh tokens
new_access, new_refresh = services.refresh_access_token(old_refresh_token="...")

# Logout
services.revoke_refresh_token(token="...")
```

### Route Decorators

```python
from flask_jwt_extended import jwt_required
from src.app.auth.decorators import require_role
from src.app.auth import Role

@blueprint.get("/protected")
@jwt_required()
def protected_route():
    # Requires valid JWT
    # g.user = username (set by auth middleware)
    # g.role = Role enum value
    # ...

@blueprint.get("/admin-only")
@jwt_required()
@require_role(Role.ADMIN)
def admin_route():
    # Requires valid JWT + admin role
    # ...
```

### Auth Context (g object)

**Available in all routes after auth middleware:**
```python
from flask import g

# In any route handler:
username = g.user  # "admin" or None
role = g.role      # Role.ADMIN or None
must_reset = g.must_reset_password  # True/False
```

---

## Configuration

**Environment Variables:**
```bash
JWT_SECRET_KEY=<random-256-bit-hex>           # JWT signing key
JWT_ACCESS_TOKEN_EXPIRES=3600                 # Access token lifetime (seconds)
JWT_REFRESH_TOKEN_EXPIRES=2592000             # Refresh token lifetime (seconds)
AUTH_HASH_ALGO=argon2|bcrypt                  # Password hashing algorithm
```

---

## Operations

### Create Admin User

```bash
python scripts/create_initial_admin.py \
  --username admin \
  --password change-me \
  --email admin@example.com
```

### Reset User Password

```bash
python scripts/reset_user_password.py \
  --username testuser \
  --password newpass123
```

### List Users

```bash
python scripts/check_users.py
```

---

## Related Components

- **[app-core](../app-core/)** - Provides JWT extension, configuration
- **[admin-api](../admin-api/)** - Admin REST API for user management
- **[database](../database/)** - Auth DB schema, SQLAlchemy models
- **[frontend-ui](../frontend-ui/)** - Auth templates, login forms

---

## Troubleshooting

**Login fails with "Invalid credentials"**
- Check username/password correct
- Verify user `is_active=true`, not locked, not deleted

**"Account locked" message**
- User exceeded 5 failed login attempts
- Wait 15 minutes or admin must unlock (reset `locked_until`, `login_failed_count`)

**JWT token expired constantly**
- Check system clock synced
- Increase `JWT_ACCESS_TOKEN_EXPIRES` if needed

**argon2 not available warning**
- Install: `pip install argon2-cffi`
- Falls back to bcrypt (still secure but slower)

---

**See Also:**
- Main README: [../../README.md](../../README.md)
- Admin API: [../admin-api/](../admin-api/)
- Database Schema: [../database/](../database/)
