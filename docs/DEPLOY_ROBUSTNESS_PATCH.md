# Deploy-Robustness Patch: Docker-Gateway-Unabhängigkeit

**Datum:** 2026-01-06  
**Agent:** Server-Deploy-Robustheits-Agent  
**Ziel:** Deploy-Prozess unabhängig von wechselnden Docker-Gateway-IPs machen

---

## 🔴 ROOT CAUSE ANALYSIS

### Problem
Das Deployment war **fragil und nicht deterministisch** wegen:

1. **Widersprüchliche Netzwerk-Konfigurationen:**
   - Dokumentation referenzierte `corapan-network` (172.18.0.0/16)
   - Deploy-Skript erstellte `games-network` (172.19.0.0/16)
   - Beide Netze haben unterschiedliche Gateway-IPs: `172.18.0.1` vs `172.19.0.1`

2. **Hardcodierte Gateway-IPs in DB-URLs:**
   ```bash
   # Dokumentation empfahl:
   AUTH_DATABASE_URL=postgresql://...@172.18.0.1:5432/...
   
   # Oder:
   AUTH_DATABASE_URL=postgresql://...@172.19.0.1:5432/...
   ```

3. **Flakiness-Szenario:**
   - Je nachdem, welches Netzwerk zuerst erstellt wurde oder welche Doku befolgt wurde:
     - Container versucht DB @ 172.18.0.1 → aber Netzwerk ist 172.19.x → **Connection timeout**
     - Oder umgekehrt

4. **Keine Preflight-Checks:**
   - Deploy-Skript prüfte nicht, ob Host-Postgres aus Docker-Kontext erreichbar ist
   - Fehler traten erst beim Container-Start auf → schlechte DX

### Warum war das problematisch?
- **Nicht reproduzierbar:** Erfolg hing von Setup-Historie ab
- **Nicht portabel:** Bei Docker-Netzwerk-Neuanlage andere Gateway-IP
- **Fehleranfällig:** Copy-Paste aus verschiedenen Doku-Abschnitten führte zu Inkonsistenz

---

## ✅ LÖSUNG: host.docker.internal + host-gateway

### Architektur-Entscheidung
Statt hardcodierter Gateway-IPs nutzen wir:

```bash
# Container-Start mit:
--add-host=host.docker.internal:host-gateway

# DB-URL im Container:
postgresql://user:pass@host.docker.internal:5432/dbname
```

### Vorteile
1. **Robust:** Unabhängig vom Docker-Subnet (172.18, 172.19, 192.168, ...)
2. **Portabel:** Funktioniert auf allen Systemen:
   - Linux: `host-gateway` mapped zu aktueller Gateway-IP
   - macOS/Windows: `host.docker.internal` ist nativ verfügbar
3. **Wartbar:** Keine IPs in Config-Dateien hardcoden
4. **Standardisiert:** Best Practice aus Docker-Dokumentation

---

## 📋 ÄNDERUNGEN (3 Dateien)

### 1. scripts/deploy/deploy_prod.sh

#### Änderung 1.1: Netzwerk-Standard auf corapan-network
```diff
-DOCKER_NETWORK="${DOCKER_NETWORK:-games-network}"
+DOCKER_NETWORK="${DOCKER_NETWORK:-corapan-network}"
```

**Rationale:** Alle Apps nutzen ein Netzwerk → weniger Konfiguration, konsistent mit corapan

#### Änderung 1.2: Netzwerk-Erstellung mit korrektem Subnet
```diff
-log_info "Creating network '${DOCKER_NETWORK}' with subnet 172.19.0.0/16..."
+log_info "Creating network '${DOCKER_NETWORK}' with subnet 172.18.0.0/16 (corapan standard)..."

 docker network create \
     --driver bridge \
-    --subnet=172.19.0.0/16 \
+    --subnet=172.18.0.0/16 \
+    --gateway=172.18.0.1 \
     "${DOCKER_NETWORK}"
```

**Rationale:** Konsistenz mit corapan-Setup, Gateway explizit gesetzt

#### Änderung 1.3: Preflight-Check für DB-Erreichbarkeit (NEU)
```bash
# Step 0.5: Verify Host PostgreSQL Reachability (from Docker context)
log_info "Testing PostgreSQL connectivity from Docker container (host.docker.internal)..."

docker run --rm \
    --network "${DOCKER_NETWORK}" \
    --add-host=host.docker.internal:host-gateway \
    postgres:16-alpine \
    pg_isready -h host.docker.internal -p 5432 -U "${DB_TEST_USER}" -d "${DB_TEST_NAME}" -q

if [ $? -ne 0 ]; then
    log_error "PostgreSQL NOT reachable from Docker container!"
    log_error "Deploy ABORTED. Fix database connectivity first."
    exit 10
fi
```

**Rationale:**
- **Fail-Fast:** Stoppe Deploy sofort, wenn DB nicht erreichbar
- **Klare Fehlermeldung:** User weiß sofort, was kaputt ist
- **Authentisch:** Test im gleichen Netzwerk-Kontext wie die App

#### Änderung 1.4: Container-Start mit host.docker.internal
```diff
 docker run -d \
     --name "${CONTAINER_NAME}" \
     --restart unless-stopped \
     --network "${DOCKER_NETWORK}" \
+    --add-host=host.docker.internal:host-gateway \
     -p "${HOST_PORT}:${CONTAINER_PORT}" \
     ...
```

**Rationale:** Container kann jetzt `host.docker.internal` auflösen → robuste DB-Verbindung

---

### 2. scripts/docker-entrypoint.sh

#### Änderung 2.1: Default DB-Host definieren
```diff
+# Default database host (robust against Docker network gateway changes)
+DEFAULT_DB_HOST="host.docker.internal"
```

#### Änderung 2.2: DB-URL-Parser nutzt host.docker.internal als Fallback
```python
# In Python-Parser:
default_host = os.environ.get('DEFAULT_DB_HOST', 'host.docker.internal')
# ...
host = parsed.hostname or default_host  # Statt 'db'
```

**Rationale:** Selbst wenn URL keinen Host angibt, nutzen wir robusten Standard

#### Änderung 2.3: Bessere Fehlerdiagnose
```diff
 echo "Troubleshooting:"
-echo "  1. Verify database container is running: docker ps"
+echo "  1. Verify PostgreSQL is running on host:"
+echo "       systemctl status postgresql"
+echo "  2. Verify container has host.docker.internal mapping:"
+echo "       docker run must include: --add-host=host.docker.internal:host-gateway"
```

**Rationale:** Fehlersuche leitet auf korrekte Architektur (Host-DB, nicht Container-DB)

---

### 3. games_hispanistica_production.md

#### Änderungen (7 Stellen):
1. ✅ `172.18.0.1` → `host.docker.internal` (alle DB-URLs)
2. ✅ `172.19.0.1` → `host.docker.internal` (alle DB-URLs)
3. ✅ Dokumentiere `--add-host=host.docker.internal:host-gateway` in Container-Beispielen
4. ✅ Entferne `games-network` Referenzen
5. ✅ Standardisiere auf `corapan-network` (shared)
6. ✅ Ergänze Rationale: "Warum host.docker.internal statt 172.x?"
7. ✅ Checklist: "DB-Host: host.docker.internal" explizit erwähnen

---

## 🧪 VERIFIKATIONS-PLAN

### Manueller Test auf Produktionsserver

```bash
# 1. Code aktualisieren
cd /srv/webapps/games_hispanistica/app
git pull origin main

# 2. passwords.env prüfen/anpassen
nano /srv/webapps/games_hispanistica/config/passwords.env
# Sicherstellen:
# AUTH_DATABASE_URL=postgresql://games_app:PASSWORD@host.docker.internal:5432/games_hispanistica

# 3. Deploy ausführen
bash scripts/deploy/deploy_prod.sh
```

**Erwartetes Verhalten:**
1. ✅ Preflight-Check testet DB-Erreichbarkeit aus Docker-Kontext
2. ✅ Falls FAIL: Deploy bricht ab mit klarer Meldung (systemctl, pg_hba.conf)
3. ✅ Falls OK: Container startet mit `--add-host=host.docker.internal:host-gateway`
4. ✅ Container verbindet erfolgreich zur DB
5. ✅ Health-Endpoint `/health` ist erreichbar

### Post-Deployment Checks

```bash
# Container läuft?
docker ps | grep games-webapp

# Welches Netzwerk?
docker inspect games-webapp | grep NetworkMode
# Erwartung: "corapan-network"

# host.docker.internal auflösbar?
docker exec games-webapp getent hosts host.docker.internal
# Erwartung: 172.18.0.1 host.docker.internal (oder Gateway von corapan-network)

# DB-Verbindung?
docker exec games-webapp python -c "
from src.app.extensions.sqlalchemy_ext import init_engine, get_engine
class FakeApp:
    def __init__(self):
        import os
        self.config = {'AUTH_DATABASE_URL': os.environ['AUTH_DATABASE_URL']}
app = FakeApp()
init_engine(app)
engine = get_engine()
with engine.connect() as conn:
    print('DB OK:', conn.execute('SELECT version()').scalar())
"
# Erwartung: "DB OK: PostgreSQL 14.x ..."

# Health-Check
curl http://localhost:7000/health
# Erwartung: {"status": "ok"}
```

---

## 🔒 SECURITY & BEST PRACTICES

### Was wurde NICHT geändert
- ✅ Secrets bleiben in `passwords.env` (nicht im Code)
- ✅ Keine Passwörter in Logs oder Doku
- ✅ Keine Container-Privilegien erhöht
- ✅ Netzwerk-Isolation bleibt erhalten (corapan-network ist private bridge)

### Backward Compatibility
- ⚠️ **Breaking Change:** URLs mit `172.x.0.1` funktionieren nicht mehr
- ✅ **Migration:** Einfach DB-Host in `passwords.env` auf `host.docker.internal` ändern
- ✅ **Graceful:** Alte Setups können parallel laufen (verschiedene Netzwerke möglich)

---

## 📊 IMPACT ASSESSMENT

### Robustheit
| Metrik | Vorher | Nachher |
|--------|--------|---------|
| Abhängigkeit von Docker-Subnet | ❌ Ja (172.18 vs 172.19) | ✅ Nein |
| Preflight-Check DB-Erreichbarkeit | ❌ Nein | ✅ Ja |
| Fehlerdiagnose-Qualität | 🟡 Schwach | ✅ Stark |
| Dokumentations-Konsistenz | ❌ Widersprüche | ✅ Einheitlich |

### Maintenance-Last
- **Reduziert:** Keine IPs in Config-Files hardcoden
- **Standardisiert:** Ein Netzwerk für alle Apps (corapan-network)
- **Self-Documenting:** `host.docker.internal` ist selbsterklärend

### Developer Experience
- **Bessere Fehler:** Deploy bricht früh ab mit klarer Anleitung
- **Portabilität:** Setup funktioniert auf jedem Docker-Host
- **Konsistenz:** Dev & Prod nutzen gleiche Patterns

---

## 🚀 ROLLOUT-EMPFEHLUNG

### Phase 1: Testing (aktuell abgeschlossen)
- ✅ Patches implementiert
- ✅ Dokumentation aktualisiert
- ⏳ Manueller Test auf Produktionsserver ausstehend

### Phase 2: Production Deployment
1. **Wartungsfenster ankündigen** (5-10 Minuten Downtime erwartet)
2. **Backup der aktuellen Config:**
   ```bash
   cp /srv/webapps/games_hispanistica/config/passwords.env{,.backup}
   ```
3. **Code aktualisieren:**
   ```bash
   cd /srv/webapps/games_hispanistica/app
   git pull origin main
   ```
4. **passwords.env anpassen:**
   ```bash
   # Ändere:
   # AUTH_DATABASE_URL=postgresql://games_app:PWD@172.18.0.1:5432/...
   # Zu:
   # AUTH_DATABASE_URL=postgresql://games_app:PWD@host.docker.internal:5432/...
   ```
5. **Deploy ausführen:**
   ```bash
   bash scripts/deploy/deploy_prod.sh
   ```
6. **Smoke-Tests ausführen** (siehe Verifikations-Plan oben)
7. **Monitoring prüfen:** Logs, Health-Endpoint, DB-Queries

### Phase 3: Monitoring (erste 48h)
- Überwache Container-Restarts: `docker ps -a | grep games-webapp`
- Prüfe Logs auf DB-Connection-Errors: `docker logs games-webapp | grep -i error`
- Bei Problemen: Rollback via `docker run` mit altem Image-Tag

### Rollback-Prozedur (falls nötig)
```bash
# 1. Alte Config wiederherstellen
cp /srv/webapps/games_hispanistica/config/passwords.env{.backup,}

# 2. Altes Image-Tag finden
docker images games-webapp --format "{{.Tag}}\t{{.CreatedAt}}"

# 3. Container mit altem Image starten
docker stop games-webapp
docker rm games-webapp
docker run -d --name games-webapp ... games-webapp:<old-tag>
```

---

## 🎯 SUCCESS CRITERIA

Deploy gilt als erfolgreich, wenn:
1. ✅ `scripts/deploy/deploy_prod.sh` ohne Fehler durchläuft
2. ✅ Preflight-Check bestätigt DB-Erreichbarkeit
3. ✅ Container startet und läuft > 5 Minuten ohne Restart
4. ✅ `/health` Endpoint antwortet mit 200 OK
5. ✅ DB-Queries funktionieren (Admin-Login erfolgreich)
6. ✅ Keine "connection timed out" Errors in Logs

---

## 📚 LESSONS LEARNED

### Was gut lief
- ✅ Systematische Analyse (Phase 1-5)
- ✅ Fail-Fast Preflight-Checks
- ✅ Best Practices aus Docker-Community übernommen

### Was wir vermieden haben
- ❌ "Timeout hochdrehen und hoffen" → Symptom statt Root Cause
- ❌ Statische Container-IPs (`--ip 172.x.0.2`) → unnötige Komplexität
- ❌ Mehrere Netzwerke für verschiedene Apps → Fragmentierung

### Für zukünftige Projekte
- ✅ **Immer:** `host.docker.internal` für Host-Services (DB, Redis, ...)
- ✅ **Niemals:** Gateway-IPs in Config-Files hardcoden
- ✅ **Best Practice:** Preflight-Checks für kritische Dependencies (DB, APIs, ...)

---

**DEPLOY-ROBUSTHEIT: VON FRAGIL ZU FELSENFEST** 🎉
