# deployment Component

**Purpose:** Docker configuration, CI/CD pipelines, deployment scripts.

**Scope:** Production deployment, dev environment setup, database initialization, health checks.

---

## Responsibility

1. **Docker** - Production + dev containers (Dockerfile, docker-compose)
2. **CI/CD** - GitHub Actions (tests, linting, MD3 validation)
3. **Scripts** - Database init, user management, deployment checks
4. **Health Checks** - Container health monitoring
5. **Environment Configuration** - `.env` setup, secrets management

---

## Key Files

| Path | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage production image |
| `docker-compose.yml` | Production deployment |
| `docker-compose.dev-postgres.yml` | Dev environment (PostgreSQL) |
| `.github/workflows/ci.yml` | CI pipeline (tests, linting) |
| `.github/workflows/deploy.yml` | Deployment pipeline |
| `scripts/init_auth_db.py` | Initialize auth database |
| `scripts/init_quiz_db.py` | Initialize quiz database |
| `scripts/create_initial_admin.py` | Create admin user |
| `scripts/dev-setup.ps1` | Dev environment setup (Windows) |
| `scripts/dev-start.ps1` | Start dev server (Windows) |

---

## Docker Setup

### Production Image

**File:** `Dockerfile`

**Multi-Stage Build:**
1. **Builder stage** - Install dependencies (build tools, libpq-dev)
2. **Runtime stage** - Minimal image (ffmpeg, libsndfile1, libpq5, curl)

**Python:** 3.12-slim  
**User:** `corapan` (non-root, UID 1000)  
**Workdir:** `/app`  
**Entrypoint:** `scripts/docker-entrypoint.sh`

**Health Check:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:8000/health || exit 1
```

### Production Compose

**File:** `docker-compose.yml`

**Service:** `web` (Flask app)
- **Port:** 6000:8000 (external:internal)
- **Restart:** unless-stopped
- **Resource Limits:** 2 CPUs, 2GB RAM
- **Volumes:**
  - Media: `~/corapan/media/*` (read-only)
  - Config: `~/corapan/config/keys` (read-only)
  - Database: `~/corapan/data/db` (read-only)
  - Logs: `~/corapan/logs` (read-write)

### Dev Compose

**File:** `docker-compose.dev-postgres.yml`

**Services:**
- `db` (PostgreSQL 15)
- `web` (Flask app, development mode)

**Usage:**
```bash
docker-compose -f docker-compose.dev-postgres.yml up
```

---

## CI/CD Pipelines

### CI Pipeline

**File:** `.github/workflows/ci.yml`

**Triggers:** Push to `main`, `prod_prep`; PRs to `main`

**Jobs:**
1. **Test Matrix:**
   - Python: 3.12
   - Auth Hash: bcrypt, argon2
2. **Checks:**
   - MD3 forms/auth guard (`scripts/md3-forms-auth-guard.py`)
   - MD3 lint (`scripts/md3-lint.py`)
   - Project structure (`scripts/check_structure.py`)
   - Ruff linting
3. **Tests:**
   - Unit tests (pytest)
   - Auth integration tests
   - Quiz integration tests

### Deployment Pipeline

**File:** `.github/workflows/deploy.yml`

**Trigger:** Push to `prod` branch

**Steps:**
1. SSH to production server
2. Git pull
3. Docker build + restart
4. Health check
5. Rollback on failure

---

## Environment Variables

**Required:**
- `AUTH_DATABASE_URL` - Auth database connection string
- `QUIZ_DATABASE_URL` - Quiz database connection string
- `SECRET_KEY` - Flask secret key (JWT signing)
- `JWT_SECRET_KEY` - JWT secret key
- `JWT_COOKIE_SECURE` - True for HTTPS (False for dev)

**Optional:**
- `QUIZ_DEBUG` - Enable quiz debug logging (0/1)
- `QUIZ_ADMIN_KEY` - Admin API key for quiz import
- `FLASK_ENV` - development/production

**Template:** `passwords.env.template`

---

## Database Initialization

### Auth Database

**Script:** `scripts/init_auth_db.py`

**Usage:**
```bash
# PostgreSQL
python scripts/init_auth_db.py --engine postgres

# SQLite (dev)
python scripts/init_auth_db.py --engine sqlite
```

**Creates:**
- `auth.users` table
- `auth.refresh_tokens` table
- `auth.reset_tokens` table

**Migration Files:**
- `migrations/0001_create_auth_schema_postgres.sql`
- `migrations/0001_create_auth_schema_sqlite.sql`

### Quiz Database

**Script:** `scripts/init_quiz_db.py`

**Usage:**
```bash
# Seed demo topic
python scripts/init_quiz_db.py

# Seed specific topic
python scripts/init_quiz_db.py --topic-file game_modules/quiz/content/topics/my_topic.yml

# Dry-run
python scripts/init_quiz_db.py --dry-run
```

**Creates:**
- All quiz tables (`quiz_players`, `quiz_topics`, `quiz_questions`, etc.)
- Seeds demo topic from YAML

### Admin User

**Script:** `scripts/create_initial_admin.py`

**Usage:**
```bash
python scripts/create_initial_admin.py
```

**Interactive prompts:**
- Username
- Email
- Password

**Creates:** Admin user with `Role.ADMIN`

---

## Development Setup

### Windows (PowerShell)

**Setup:**
```powershell
.\scripts\dev-setup.ps1
```

**Actions:**
1. Creates virtual environment (`.venv`)
2. Installs dependencies (`requirements.txt`)
3. Initializes auth + quiz databases (SQLite)
4. Creates admin user
5. Seeds demo topic

**Start Server:**
```powershell
.\scripts\dev-start.ps1
```

**Opens:** `http://localhost:5000`

### Linux/Mac

**Setup:**
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/init_auth_db.py --engine sqlite
python scripts/init_quiz_db.py
python scripts/create_initial_admin.py
```

**Start:**
```bash
flask run
```

---

## Health Checks

**Endpoint:** `GET /health`

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2025-01-24T12:00:00Z"
}
```

**Docker Health Check:**
```bash
curl -f http://localhost:8000/health || exit 1
```

**Runs:** Every 30 seconds, 3 retries, 10s start period

---

## Deployment Scripts

| Script | Purpose |
|--------|---------|
| `deploy_prod.sh` | Deploy to production server |
| `deploy_checklist.sh` | Pre-deployment checks |
| `backup.sh` | Backup databases + media |
| `scripts/check_users.py` | Verify user accounts |
| `scripts/reset_user_password.py` | Admin password reset |
| `scripts/anonymize_old_users.py` | Anonymize old users (GDPR) |

---

## Quick Start

**See:** [../QUICKSTART.md](../QUICKSTART.md)

**Dev Environment:**
```powershell
# Windows
.\scripts\dev-setup.ps1
.\scripts\dev-start.ps1

# Linux/Mac
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/init_auth_db.py --engine sqlite
python scripts/init_quiz_db.py
flask run
```

**Production:**
```bash
docker-compose up -d
```

---

## Related Components

- **[app-core](../app-core/)** - Flask app configuration
- **[database](../database/)** - Database schemas, connection management
- **[auth](../auth/)** - User authentication

---

**See Also:**
- Dockerfile: [../../../Dockerfile](../../../Dockerfile)
- Docker Compose: [../../../docker-compose.yml](../../../docker-compose.yml)
- CI Pipeline: [../../../.github/workflows/ci.yml](../../../.github/workflows/ci.yml)
- Quick Start: [../QUICKSTART.md](../QUICKSTART.md)
- Main README: [../../README.md](../../README.md)
