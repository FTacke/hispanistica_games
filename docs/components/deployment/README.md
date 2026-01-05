# Deployment Component

**Purpose:** Docker configuration, CI/CD pipelines, deployment scripts, security hardening.

**Scope:** Production deployment, dev environment setup, database initialization, health checks, branch protection, self-hosted runner security.

---

## ⚠️ Security & Branch Protection

**Important:** This is a public repository with a self-hosted runner.

- 📖 **Setup guide:** [BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md) (comprehensive)
- 🚀 **Quick checklist:** [BRANCH_PROTECTION_QUICK.md](./BRANCH_PROTECTION_QUICK.md) (5 min setup)

**Key rule:** `main` branch requires PR review + approval before merge. Pushes restricted to maintainers only.

---

## Phase 1: Deploy Foundation Checklist

> Source of Truth: [games_hispanistica_production.md](../../../games_hispanistica_production.md)

### Target State

- [x] Self-hosted GitHub runner deployment pipeline
- [x] Idempotent database setup (schema + admin user)
- [x] Health endpoints (`/health`, `/health/db`)
- [x] Server bootstrap script (one-time setup)
- [x] Deploy script (repeatable deployment)
- [x] Smoke check script (post-deployment verification)
- [x] Nginx configuration template

### Server Paths

| Path | Purpose |
|------|---------|
| `/srv/webapps/games_hispanistica/app/` | Git repository checkout |
| `/srv/webapps/games_hispanistica/config/` | Environment files (passwords.env) |
| `/srv/webapps/games_hispanistica/data/` | Persistent data |
| `/srv/webapps/games_hispanistica/logs/` | Application logs |
| `/srv/webapps/games_hispanistica/media/` | Content releases (MP3, etc.) |
| `/srv/webapps/games_hispanistica/runner/` | GitHub Actions runner |

### Ports

| Service | Port |
|---------|------|
| Host (Nginx proxy target) | 7000 |
| Container internal | 5000 |

### Docker

| Setting | Value |
|---------|-------|
| Container name | `games-webapp` |
| Image name | `games-webapp:latest` |
| Network | `games-network` |
| Subnet | `172.19.0.0/16` |

### PostgreSQL

| Setting | Value |
|---------|-------|
| Database name | `games_hispanistica` |
| User | `games_app` |
| Connection | `postgresql://games_app:<PASSWORD>@172.19.0.1:5432/games_hispanistica` |

### Environment Variables (passwords.env)

```bash
# Required
FLASK_SECRET_KEY=<random-hex-64>
JWT_SECRET_KEY=<random-hex-64>
AUTH_DATABASE_URL=postgresql://games_app:<PASSWORD>@172.19.0.1:5432/games_hispanistica
AUTH_HASH_ALGO=argon2
JWT_COOKIE_SECURE=true
FLASK_ENV=production

# Admin user (for setup_prod_db.py)
START_ADMIN_USERNAME=admin
START_ADMIN_PASSWORD=<secure-password>
START_ADMIN_EMAIL=admin@games.hispanistica.com
```

### Nginx

| Setting | Value |
|---------|-------|
| Domain | `games.hispanistica.com` |
| SSL | Let's Encrypt |
| Proxy to | `127.0.0.1:7000` |
| Media alias | `/srv/webapps/games_hispanistica/media/current/` |

---

## Responsibility

1. **Docker** - Production + dev containers (Dockerfile, docker-compose)
2. **CI/CD** - GitHub Actions (tests, linting, deployment)
3. **Scripts** - Database init, user management, deployment
4. **Health Checks** - Container health monitoring
5. **Environment Configuration** - `.env` setup, secrets management

---

## Key Files

| Path | Purpose |
|------|---------|
| `Dockerfile` | Production image (multi-stage) |
| `docker-compose.yml` | Production compose |
| `docker-compose.dev-postgres.yml` | Dev environment (PostgreSQL) |
| `.github/workflows/ci.yml` | CI pipeline |
| `.github/workflows/deploy.yml` | **Production deployment** |
| `scripts/deploy/server_bootstrap.sh` | **One-time server setup** |
| `scripts/deploy/deploy_prod.sh` | **Repeatable deployment** |
| `scripts/deploy/smoke_check.sh` | **Post-deployment checks** |
| `scripts/setup_prod_db.py` | **Idempotent DB setup** |
| `scripts/init_auth_db.py` | Initialize auth database |
| `scripts/create_initial_admin.py` | Create admin user |
| `infra/nginx/games_hispanistica.conf.template` | **Nginx vhost template** |
| `src/app/config/app_identity.py` | **App constants** |

---

## Production Deployment

### First-Time Server Setup

```bash
# On production server as root
cd /srv/webapps
git clone https://github.com/<org>/hispanistica_games.git games_hispanistica/app
cd games_hispanistica/app
sudo bash scripts/deploy/server_bootstrap.sh

# Configure passwords.env
sudo cp /srv/webapps/games_hispanistica/config/passwords.env.template \
        /srv/webapps/games_hispanistica/config/passwords.env
sudo nano /srv/webapps/games_hispanistica/config/passwords.env
# Fill in real values!

# Create PostgreSQL database
sudo -u postgres createuser games_app -P
sudo -u postgres createdb games_hispanistica -O games_app
```

### Regular Deployment

Deployment happens automatically when pushing to `main` branch (via GitHub Actions).

Manual deployment:
```bash
cd /srv/webapps/games_hispanistica/app
bash scripts/deploy/deploy_prod.sh
```

### Smoke Checks

```bash
# After deployment
bash scripts/deploy/smoke_check.sh

# With domain check
bash scripts/deploy/smoke_check.sh --domain games.hispanistica.com
```

---

## Health Endpoints

### GET /health

Basic health check for load balancers and monitoring.

**Response (200):**
```json
{
  "status": "ok",
  "service": "games.hispanistica",
  "version": "0.1.0",
  "commit": "abc1234",
  "timestamp": "2026-01-05T12:00:00Z"
}
```

### GET /health/db

Database connectivity check.

**Response (200):**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-01-05T12:00:00Z"
}
```

**Response (500):**
```json
{
  "status": "error",
  "database": "disconnected",
  "error": "Connection refused",
  "timestamp": "2026-01-05T12:00:00Z"
}
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
