---
title: "Games Production Admin Configuration"
status: active
owner: backend-team
updated: "2026-04-16"
tags: [deployment, production, docker, postgres]
links:
  - docs/components/deployment/README.md
  - infra/docker-compose.prod.yml
  - scripts/deploy/deploy_prod.sh
---

# games_hispanistica Server Admin Configuration

## Purpose

This document describes the canonical production model for games_hispanistica after the repository cleanup on 2026-04-16.

The old single-container deployment with host PostgreSQL routing via localhost, bridge gateway addresses, or host.docker.internal is obsolete and must not be used.

## Canonical Production Model

- Deployment entrypoint: docker compose with [infra/docker-compose.prod.yml](infra/docker-compose.prod.yml)
- Web container name: games-web-prod
- Host bind: 127.0.0.1:7000 -> 5000
- Backend network: games-backend-prod
- Dedicated DB service hostname: games-db-prod
- Auth DB: games_hispanistica
- Quiz DB: games_hispanistica_quiz

Both databases are required in production. The repository does not provision the dedicated PostgreSQL service; that infrastructure must exist before deployment.

## Required Environment Variables

The production env file is expected at:

- /srv/webapps/games_hispanistica/config/passwords.env

Required values:

```bash
GAMES_BACKEND_NETWORK=games-backend-prod
GAMES_DB_HOST=games-db-prod
AUTH_DATABASE_URL=postgresql+psycopg2://games_app:<PASSWORD>@games-db-prod:5432/games_hispanistica
QUIZ_DATABASE_URL=postgresql+psycopg2://games_app:<PASSWORD>@games-db-prod:5432/games_hispanistica_quiz
FLASK_SECRET_KEY=<generated-secret>
JWT_SECRET_KEY=<generated-secret>
AUTH_HASH_ALGO=argon2
JWT_COOKIE_SECURE=true
FLASK_ENV=production
DB_WAIT_SECONDS=120
```

Optional mount overrides:

```bash
GAMES_DATA_DIR=/srv/webapps/games_hispanistica/data
GAMES_MEDIA_DIR=/srv/webapps/games_hispanistica/media
GAMES_LOGS_DIR=/srv/webapps/games_hispanistica/logs
GAMES_KEYS_DIR=/srv/webapps/games_hispanistica/config/keys
```

Admin bootstrap is explicit and only for first-time setup:

```bash
ADMIN_BOOTSTRAP=1
START_ADMIN_USERNAME=admin
START_ADMIN_PASSWORD=<secure-password>
START_ADMIN_EMAIL=admin@games.hispanistica.com
```

Remove ADMIN_BOOTSTRAP and START_ADMIN_PASSWORD again after the initial bootstrap deploy.

## Deployment Sequence

1. Check out the target commit into /srv/webapps/games_hispanistica/app.
2. Verify that the backend network games-backend-prod exists.
3. Verify that the dedicated DB service games-db-prod is reachable on that network.
4. Run bash scripts/deploy/deploy_prod.sh from the repository root.
5. The deploy script rebuilds the web service via docker compose.
6. The deploy script runs scripts/setup_prod_db.py for the auth database.
7. The deploy script runs scripts/init_quiz_db.py for the quiz database.
8. Verify http://127.0.0.1:7000/health on the host.

## Health Checks

Expected checks:

```bash
docker ps --filter name=games-web-prod
curl -f http://127.0.0.1:7000/health
```

Optional DB reachability checks from the backend network:

```bash
docker run --rm --network games-backend-prod postgres:16-alpine \
  pg_isready -h games-db-prod -p 5432 -U games_app -d games_hispanistica

docker run --rm --network games-backend-prod postgres:16-alpine \
  pg_isready -h games-db-prod -p 5432 -U games_app -d games_hispanistica_quiz
```

## Explicitly Unsupported Paths

Do not use any of the following as the production database path:

- localhost inside the container
- 172.18.0.1 or other bridge gateway IPs
- host.docker.internal
- corapan-db-prod
- a docker run based primary deployment path
- a silent DATABASE_URL fallback for the quiz database

## External Prerequisites

The following infrastructure is outside this repository and must be provided separately:

- External backend Docker network games-backend-prod
- Dedicated PostgreSQL service games-db-prod attached to that network
- Databases games_hispanistica and games_hispanistica_quiz
- Credentials for the games_app database user
- Nginx or equivalent reverse proxy to 127.0.0.1:7000

## Siehe auch

- [docs/components/deployment/README.md](docs/components/deployment/README.md)
- [infra/docker-compose.prod.yml](infra/docker-compose.prod.yml)
- [scripts/deploy/deploy_prod.sh](scripts/deploy/deploy_prod.sh)
- [.env.prod.example](.env.prod.example)
