# database Component

**Purpose:** SQLAlchemy configuration, auth database schema, connection management.

**Scope:** Database layer for auth tables. Quiz has separate DB handling (see [quiz](../quiz/)).

---

## Responsibility

1. **Engine Management** - PostgreSQL connection pooling
2. **Schema Definition** - SQLAlchemy ORM models for auth tables
3. **Migrations** - SQL-based schema creation/updates
4. **Query Utilities** - Helper functions for common queries

---

## Key Files

| Path | Purpose |
|------|---------|
| `src/app/extensions/sqlalchemy_ext.py` | Engine initialization, connection pooling |
| `src/app/auth/models.py` | ORM models: User, RefreshToken, ResetToken |
| `src/app/services/database.py` | Database utilities, helper functions |
| `migrations/0001_create_auth_schema_postgres.sql` | Auth schema creation (PostgreSQL) |
| `migrations/0001_create_auth_schema_sqlite.sql` | Auth schema creation (SQLite) |

---

## Database Schema

**Database Name:** `hispanistica_games_auth` (or configured name)  
**Schema:** `auth` (PostgreSQL) or default (SQLite)

### Tables

1. **auth.users** - User accounts
2. **auth.refresh_tokens** - JWT refresh tokens
3. **auth.reset_tokens** - Password reset tokens

**See:** [../auth/README.md](../auth/README.md) for detailed schema documentation.

---

## Connection Configuration

**Environment Variable:**
```bash
AUTH_DATABASE_URL=postgresql://user:pass@host:port/dbname
# or
AUTH_DATABASE_URL=sqlite:///path/to/database.db
```

**Connection Pooling (PostgreSQL):**
- Pool size: 5 (default)
- Max overflow: 10 (default)
- Pool recycle: 3600 seconds (1 hour)
- Echo SQL: False (set to True for debugging)

---

## Engine Initialization

**Startup:**
```python
# src/app/__init__.py
from src.app.extensions.sqlalchemy_ext import init_engine

init_engine(app, fail_fast=True)  # Production: fail if DB unreachable
```

**Usage:**
```python
from src.app.extensions.sqlalchemy_ext import get_engine

engine = get_engine()
with engine.connect() as conn:
    result = conn.execute(text("SELECT * FROM auth.users"))
```

---

## Migrations

**Apply Schema:**
```bash
# PostgreSQL
python scripts/init_auth_db.py --engine postgres

# SQLite
python scripts/init_auth_db.py --engine sqlite
```

**Migration Files:**
- `migrations/0001_create_auth_schema_postgres.sql`
- `migrations/0001_create_auth_schema_sqlite.sql`

**Migration Strategy:** SQL-based (no Alembic/Flask-Migrate)

---

## Related Components

- **[auth](../auth/)** - Uses auth tables for user management
- **[admin-api](../admin-api/)** - CRUD operations on users
- **[quiz](../quiz/)** - Separate database handling

---

**See Also:**
- Auth Schema: [../auth/README.md#data-model](../auth/README.md#data-model)
- Deployment: [../deployment/README.md](../deployment/README.md)
