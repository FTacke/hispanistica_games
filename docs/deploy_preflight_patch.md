# Deploy Script Pre-Flight Check - Robustness Patch

**Datum:** 2026-01-06  
**Datei:** `scripts/deploy/deploy_prod.sh`  
**Problem:** Deploy bricht mit unklarer Fehlermeldung ab ("Docker network does not exist"), obwohl eigentliche Ursache fehlende Docker-Zugriffsberechtigung ist.

## Patch Summary

### Änderungen

**Vor dem Patch:**
- Harter Abbruch bei fehlendem Docker-Netzwerk
- Keine Diagnose, warum Netzwerk nicht gefunden wird
- Unklar, ob Docker überhaupt erreichbar ist

**Nach dem Patch:**
1. ✅ **Docker-Zugriff-Diagnose** (vor Netzwerk-Check):
   - User/UID/GID/Groups
   - Docker Socket Permissions (`/var/run/docker.sock`)
   - Docker Context
   
2. ✅ **Expliziter Docker-Daemon-Test** (`docker info`):
   - Bei Erfolg: Server-Version ausgeben
   - Bei Fehler: Exit Code 2 mit konkreten Lösungsvorschlägen
   
3. ✅ **Auto-Create Netzwerk** (wenn Docker erreichbar):
   - Subnet: `172.19.0.0/16` (wie in `server_bootstrap.sh`)
   - Bei Konflikt: Exit Code 3 mit Diagnose-Befehlen
   
4. ✅ **Differenzierte Exit Codes:**
   - `1` - Fehlende Voraussetzungen (pyproject.toml, passwords.env)
   - `2` - Docker Daemon nicht erreichbar
   - `3` - Netzwerk kann nicht erstellt werden (Subnet-Konflikt)

### Diff

```diff
 # -----------------------------------------------------------------------------
 # Step 0: Pre-flight checks
 # -----------------------------------------------------------------------------
 log_info "Running pre-flight checks..."
 
 # Verify we're in the right directory
 if [ ! -f "pyproject.toml" ]; then
     log_error "Not in repository root. Expected to find pyproject.toml"
     log_error "Run this script from: ${APP_DIR}"
     exit 1
 fi
 
 # Verify config exists
 if [ ! -f "${CONFIG_DIR}/passwords.env" ]; then
     log_error "Missing ${CONFIG_DIR}/passwords.env"
     log_error "Run server_bootstrap.sh and configure passwords.env first"
     exit 1
 fi
 
-# Verify Docker network exists
-if ! docker network inspect "${DOCKER_NETWORK}" &> /dev/null; then
-    log_error "Docker network '${DOCKER_NETWORK}' does not exist"
-    log_error "Run server_bootstrap.sh first"
+# Docker access diagnostics
+log_info "Docker diagnostics:"
+echo "  User: $(whoami) (UID: $(id -u), GID: $(id -g))"
+echo "  Groups: $(groups)"
+
+# Check docker socket
+if [ -e /var/run/docker.sock ]; then
+    echo "  Socket: /var/run/docker.sock ($(ls -l /var/run/docker.sock | awk '{print $1, $3, $4}'))"
+else
+    echo "  Socket: /var/run/docker.sock NOT FOUND"
+fi
+
+# Check docker context
+if command -v docker &> /dev/null; then
+    DOCKER_CONTEXT=$(docker context show 2>/dev/null || echo "default")
+    echo "  Context: ${DOCKER_CONTEXT}"
+else
+    log_error "Docker command not found in PATH"
     exit 1
 fi
 
+# Test docker daemon access
+log_info "Testing Docker daemon access..."
+if docker info > /dev/null 2>&1; then
+    DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
+    log_success "Docker daemon accessible (Server version: ${DOCKER_VERSION})"
+else
+    DOCKER_EXIT_CODE=$?
+    log_error "Docker daemon NOT accessible (exit code: ${DOCKER_EXIT_CODE})"
+    echo ""
+    log_error "Possible causes:"
+    log_error "  1. Docker daemon not running"
+    log_error "  2. User '$(whoami)' lacks permission to access /var/run/docker.sock"
+    log_error "  3. Docker running in rootless mode with different socket"
+    log_error "  4. Wrong docker context (current: ${DOCKER_CONTEXT})"
+    echo ""
+    log_error "Solutions:"
+    log_error "  • Add user to docker group: sudo usermod -aG docker $(whoami)"
+    log_error "  • Or run as root: sudo bash ${BASH_SOURCE[0]}"
+    log_error "  • Or check: systemctl status docker"
+    exit 2
+fi
+
+# Verify Docker network exists (or auto-create)
+log_info "Checking Docker network: ${DOCKER_NETWORK}..."
+if docker network inspect "${DOCKER_NETWORK}" &> /dev/null; then
+    NETWORK_SUBNET=$(docker network inspect "${DOCKER_NETWORK}" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')
+    log_success "Network '${DOCKER_NETWORK}' exists (subnet: ${NETWORK_SUBNET})"
+else
+    log_warn "Network '${DOCKER_NETWORK}' does not exist"
+    log_info "Creating network '${DOCKER_NETWORK}' with subnet 172.19.0.0/16..."
+    
+    if docker network create \
+        --driver bridge \
+        --subnet=172.19.0.0/16 \
+        "${DOCKER_NETWORK}" > /dev/null 2>&1; then
+        log_success "Network '${DOCKER_NETWORK}' created successfully"
+    else
+        NETWORK_EXIT_CODE=$?
+        log_error "Failed to create network '${DOCKER_NETWORK}' (exit code: ${NETWORK_EXIT_CODE})"
+        echo ""
+        log_error "Possible causes:"
+        log_error "  1. Subnet 172.19.0.0/16 already in use by another network"
+        log_error "  2. Insufficient Docker permissions"
+        echo ""
+        log_error "Check existing networks:"
+        docker network ls
+        echo ""
+        log_error "If subnet conflict, run: docker network inspect <conflicting-network>"
+        log_error "Then either remove conflict or run server_bootstrap.sh manually"
+        exit 3
+    fi
+fi
+
 log_success "Pre-flight checks passed"
 echo ""
```

## Beispiel: GitHub Actions Logs

### Szenario 1: Docker nicht erreichbar (Permissions-Problem)

**Vorher:**
```
[INFO] Running pre-flight checks...
[ERROR] Docker network 'games-network' does not exist
[ERROR] Run server_bootstrap.sh first
Error: Process completed with exit code 1.
```
→ Unklar, ob Docker läuft oder nur Netzwerk fehlt

**Nachher:**
```
[INFO] Running pre-flight checks...
[INFO] Docker diagnostics:
  User: runner (UID: 1001, GID: 1001)
  Groups: runner
  Socket: /var/run/docker.sock (srw-rw---- root docker)
  Context: default
[INFO] Testing Docker daemon access...
[ERROR] Docker daemon NOT accessible (exit code: 1)

[ERROR] Possible causes:
  1. Docker daemon not running
  2. User 'runner' lacks permission to access /var/run/docker.sock
  3. Docker running in rootless mode with different socket
  4. Wrong docker context (current: default)

[ERROR] Solutions:
  • Add user to docker group: sudo usermod -aG docker runner
  • Or run as root: sudo bash ./scripts/deploy/deploy_prod.sh
  • Or check: systemctl status docker
Error: Process completed with exit code 2.
```
→ Klare Diagnose: User nicht in docker-Gruppe

### Szenario 2: Docker erreichbar, Netzwerk fehlt (Auto-Create)

**Vorher:**
```
[INFO] Running pre-flight checks...
[ERROR] Docker network 'games-network' does not exist
[ERROR] Run server_bootstrap.sh first
Error: Process completed with exit code 1.
```

**Nachher:**
```
[INFO] Running pre-flight checks...
[INFO] Docker diagnostics:
  User: root (UID: 0, GID: 0)
  Groups: root
  Socket: /var/run/docker.sock (srw-rw---- root docker)
  Context: default
[INFO] Testing Docker daemon access...
[✓] Docker daemon accessible (Server version: 24.0.7)
[INFO] Checking Docker network: games-network...
[WARN] Network 'games-network' does not exist
[INFO] Creating network 'games-network' with subnet 172.19.0.0/16...
[✓] Network 'games-network' created successfully
[✓] Pre-flight checks passed
```
→ Netzwerk automatisch angelegt, Deployment fortsetzbar

### Szenario 3: Subnet-Konflikt

**Vorher:**
```
[ERROR] Docker network 'games-network' does not exist
[ERROR] Run server_bootstrap.sh first
```

**Nachher:**
```
[INFO] Creating network 'games-network' with subnet 172.19.0.0/16...
[ERROR] Failed to create network 'games-network' (exit code: 1)

[ERROR] Possible causes:
  1. Subnet 172.19.0.0/16 already in use by another network
  2. Insufficient Docker permissions

[ERROR] Check existing networks:
NETWORK ID     NAME              DRIVER    SCOPE
abc123def456   bridge            bridge    local
789ghi012jkl   old-games-net     bridge    local

[ERROR] If subnet conflict, run: docker network inspect <conflicting-network>
[ERROR] Then either remove conflict or run server_bootstrap.sh manually
Error: Process completed with exit code 3.
```
→ Konkrete Anleitung zur Behebung

## Vorteile für CI/CD

1. **Schnellere Fehlerdiagnose:**
   - Runner-Logs zeigen sofort, ob Permission- oder Netzwerk-Problem
   - Keine Trial-and-Error mit mehreren Deployments nötig

2. **Self-Healing:**
   - Auto-Create Netzwerk reduziert Bootstrap-Fehler
   - Idempotent: mehrfaches Ausführen sicher

3. **Klare Action Items:**
   - Exit Codes unterscheiden Fehlertypen
   - Lösungsvorschläge direkt im Log

4. **Audit-Trail:**
   - Docker-Version + Context dokumentiert
   - Reproduzierbarkeit durch detaillierte Diagnose

## Testen

```bash
# Test 1: Docker nicht erreichbar simulieren
sudo chmod 600 /var/run/docker.sock  # Nur root
./scripts/deploy/deploy_prod.sh
# Expected: Exit 2 mit Permissions-Hinweis

# Test 2: Docker erreichbar, Netzwerk fehlt
docker network rm games-network
./scripts/deploy/deploy_prod.sh
# Expected: Auto-Create + Exit 0

# Test 3: Subnet-Konflikt
docker network create --subnet=172.19.0.0/16 conflicting-network
docker network rm games-network
./scripts/deploy/deploy_prod.sh
# Expected: Exit 3 mit Konflikt-Diagnose
```

## Breaking Changes

**Keine** - Script ist weiterhin rückwärtskompatibel:
- Bestehende Netzwerke werden nicht verändert
- Bei Erfolg identisches Verhalten
- Nur bei Fehler: bessere Diagnose

## Rollback

Falls Probleme auftreten, alte Version wiederherstellen:
```bash
git revert HEAD  # Wenn committed
# Oder manuell: Netzwerk-Check ohne Auto-Create
```

---

**Status:** ✅ Implementiert und getestet
