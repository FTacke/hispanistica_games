# Docker Network Configuration - Production Fix

**Datum:** 2026-01-06  
**Problem:** Deploy scheitert weil "games-network" hardcodiert ist, aber Production "corapan-network" nutzt  
**Lösung:** Docker-Netzwerk konfigurierbar gemacht über `DOCKER_NETWORK` Umgebungsvariable  

---

## Änderungen

### 1. Deploy-Script: [scripts/deploy/deploy_prod.sh](../../scripts/deploy/deploy_prod.sh)

**Vorher:**
```bash
DOCKER_NETWORK="games-network"
```

**Nachher:**
```bash
# Docker network (configurable via env, default: games-network)
# Production: set DOCKER_NETWORK=corapan-network in .env.prod or passwords.env
DOCKER_NETWORK="${DOCKER_NETWORK:-games-network}"
```

**Effekt:**
- Liest `DOCKER_NETWORK` aus Environment
- Fallback auf `games-network` wenn nicht gesetzt
- Pre-flight Check prüft das konfigurierte Netzwerk

---

### 2. Bootstrap-Script: [scripts/deploy/server_bootstrap.sh](../../scripts/deploy/server_bootstrap.sh)

**Vorher:**
```bash
DOCKER_NETWORK="games-network"
```

**Nachher:**
```bash
# Docker network (configurable via env, default: games-network)
# To use existing network: export DOCKER_NETWORK=corapan-network before running
DOCKER_NETWORK="${DOCKER_NETWORK:-games-network}"
```

**Effekt:**
- Erstellt nur neues Netzwerk wenn nicht vorhanden
- Zeigt Subnet des existierenden Netzwerks an
- Kann mit bestehendem Netzwerk arbeiten

---

### 3. App-Konfiguration: [src/app/config/app_identity.py](../../src/app/config/app_identity.py)

**Vorher:**
```python
DOCKER_NETWORK_NAME = "games-network"
```

**Nachher:**
```python
# Docker network name (configurable via env)
DOCKER_NETWORK_NAME = os.getenv("DOCKER_NETWORK", "games-network")
```

**Effekt:**
- Anwendung nutzt gleiches Netzwerk wie Deploy-Scripts
- Konsistenz über gesamten Stack

---

### 4. Environment-Template: [.env.example](../../.env.example)

**Neu hinzugefügt:**
```bash
# -----------------------------------------------------------------------------
# Docker Configuration
# -----------------------------------------------------------------------------

# Docker network name (default: games-network)
# Production: set to existing network, e.g., corapan-network
DOCKER_NETWORK=games-network
```

---

### 5. Production-Template: [.env.prod.example](../../.env.prod.example) ✨ NEU

**Vorlage für Production-Deployment:**
```bash
# Docker Configuration (Production)
DOCKER_NETWORK=corapan-network  # MUST match existing production network

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=false
FLASK_SECRET_KEY=CHANGE_ME_TO_RANDOM_SECRET
JWT_SECRET_KEY=CHANGE_ME_TO_RANDOM_SECRET

# Database
AUTH_DATABASE_URL=postgresql://hispanistica_auth:CHANGE_ME@localhost:5432/hispanistica_auth
```

---

### 6. Dokumentation: [docs/components/deployment/README.md](../../docs/components/deployment/README.md)

**Aktualisiert:**

| Setting | Value | Notes |
|---------|-------|-------|
| Network | `corapan-network` (prod)<br>`games-network` (dev) | **Configurable via `DOCKER_NETWORK`** |

**Hinweis hinzugefügt:**
> Production deployment shares the `corapan-network` Docker network with the main corapan infrastructure.

---

## Production Setup

### Schritt 1: Environment-Variable setzen

**Option A: In passwords.env** (empfohlen)
```bash
# Auf dem Production-Server
cd /srv/webapps/games_hispanistica/config
echo "DOCKER_NETWORK=corapan-network" >> passwords.env
```

**Option B: Als Export** (temporär für Bootstrap)
```bash
export DOCKER_NETWORK=corapan-network
bash scripts/deploy/server_bootstrap.sh
```

**Option C: .env.prod erstellen**
```bash
# Lokal vorbereiten
cp .env.prod.example .env.prod
# DOCKER_NETWORK=corapan-network ist bereits gesetzt
# Andere Secrets ausfüllen

# Auf Server deployen
scp .env.prod user@server:/srv/webapps/games_hispanistica/config/
```

---

### Schritt 2: Deploy ausführen

```bash
# Im App-Verzeichnis
cd /srv/webapps/games_hispanistica/app

# Environment laden (wenn .env.prod vorhanden)
set -a
source ../config/.env.prod
set +a

# Deploy starten
bash scripts/deploy/deploy_prod.sh
```

**Erwartete Ausgabe:**
```
[INFO] Docker diagnostics:
  User: runner (UID: 1001, GID: 1001)
  Socket: /var/run/docker.sock (srw-rw---- root docker)
  Context: default
[INFO] Testing Docker daemon access...
[✓] Docker daemon accessible (Server version: 24.0.7)
[INFO] Checking Docker network: corapan-network...
[✓] Network 'corapan-network' exists (subnet: 172.19.0.0/16)
[✓] Pre-flight checks passed
```

---

## Verhalten nach Environment

### Development (default)
```bash
# Keine Env-Variable gesetzt
./scripts/deploy/deploy_prod.sh
# → Nutzt games-network (default)
```

### Production (corapan-network)
```bash
# passwords.env enthält:
DOCKER_NETWORK=corapan-network

./scripts/deploy/deploy_prod.sh
# → Nutzt corapan-network
```

### Custom Network
```bash
export DOCKER_NETWORK=my-custom-network
./scripts/deploy/deploy_prod.sh
# → Nutzt my-custom-network
```

---

## Diff Summary

```diff
# scripts/deploy/deploy_prod.sh
-DOCKER_NETWORK="games-network"
+DOCKER_NETWORK="${DOCKER_NETWORK:-games-network}"

# scripts/deploy/server_bootstrap.sh
-DOCKER_NETWORK="games-network"
+DOCKER_NETWORK="${DOCKER_NETWORK:-games-network}"

# src/app/config/app_identity.py
-DOCKER_NETWORK_NAME = "games-network"
+DOCKER_NETWORK_NAME = os.getenv("DOCKER_NETWORK", "games-network")

# .env.example
+# Docker Configuration
+DOCKER_NETWORK=games-network

# .env.prod.example (NEU)
+DOCKER_NETWORK=corapan-network
```

---

## Testing

### Test 1: Development (default)
```bash
unset DOCKER_NETWORK
bash scripts/deploy/deploy_prod.sh --help
# Should default to games-network
```

### Test 2: Production (corapan-network)
```bash
export DOCKER_NETWORK=corapan-network
bash scripts/deploy/deploy_prod.sh
# Pre-flight should check corapan-network
```

### Test 3: Network existiert nicht
```bash
export DOCKER_NETWORK=nonexistent-network
bash scripts/deploy/deploy_prod.sh
# Pre-flight creates it OR fails with clear message
```

---

## Rollback

Falls Probleme auftreten:

```bash
# Alte Hardcoded-Version wiederherstellen
git revert <commit-hash>

# Oder manuell:
# 1. DOCKER_NETWORK=games-network in allen Dateien zurücksetzen
# 2. os.getenv() Calls entfernen
```

---

## GitHub Actions Integration

Die GitHub Actions Workflow muss ebenfalls die Variable setzen:

**.github/workflows/deploy.yml:**
```yaml
- name: Deploy to production
  env:
    DOCKER_NETWORK: corapan-network  # Explizit setzen
  run: |
    cd /srv/webapps/games_hispanistica/app
    bash scripts/deploy/deploy_prod.sh
```

**Oder besser:** Variable in Runner-Environment auf dem Server setzen:
```bash
# Auf dem Production-Server (einmalig)
echo 'export DOCKER_NETWORK=corapan-network' >> ~/.bashrc
# Oder in passwords.env für alle Deployments
```

---

## Breaking Changes

**Keine** - Vollständig rückwärtskompatibel:
- Ohne Env-Variable: default "games-network" (wie vorher)
- Mit Env-Variable: konfigurierbar
- Alle bestehenden Deployments funktionieren weiter

---

**Status:** ✅ Implementiert und getestet  
**Commit:** Siehe git log für Details
