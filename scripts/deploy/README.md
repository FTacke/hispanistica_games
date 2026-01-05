# Deploy Scripts

This directory contains production deployment scripts for games_hispanistica.

## Scripts

| Script | Purpose |
|--------|---------|
| `server_bootstrap.sh` | One-time server preparation |
| `deploy_prod.sh` | Repeatable deployment |
| `smoke_check.sh` | Post-deployment verification |

## Usage

### First-time Server Setup

```bash
# On production server as root
sudo bash scripts/deploy/server_bootstrap.sh
```

### Deployment (via GitHub Runner or manual)

```bash
cd /srv/webapps/games_hispanistica/app
bash scripts/deploy/deploy_prod.sh
```

### Manual Smoke Check

```bash
bash scripts/deploy/smoke_check.sh
bash scripts/deploy/smoke_check.sh --domain games.hispanistica.com
```

## See Also

- [Deployment Documentation](../../docs/components/deployment/README.md)
- [Production Concept](../../games_hispanistica_production.md)
