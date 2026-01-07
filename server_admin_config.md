# games_hispanistica Server Admin Configuration

**Dokumentation der Produktions-Setup und kritischen Netzwerk-Fixes**  
Erstellt: 2026-01-07  
Server: vhrz2184 (Ubuntu 22.04, Docker 24.0.7, PostgreSQL 14)

---

## Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Kritisches Netzwerk-Problem & Lösung](#kritisches-netzwerk-problem--lösung)
3. [PostgreSQL Konfiguration](#postgresql-konfiguration)
4. [Docker-Container Setup](#docker-container-setup)
5. [Admin-Passwort Reset](#admin-passwort-reset)
6. [Deployment-Prozess](#deployment-prozess)
7. [Verifikation & Tests](#verifikation--tests)
8. [Troubleshooting](#troubleshooting)

---

## Übersicht

### Server-Infrastruktur

**Host-System:**
- Hostname: `vhrz2184`
- OS: Linux 5.15.0-130-generic (Ubuntu)
- Docker: 24.0.7
- PostgreSQL: 14-main
- Nginx: 1.18.0

**Container:**
- Name: `games-webapp`
- Image: `games-webapp:latest` (02ec01d)
- Port: 7000 (Host) → 5000 (Container)
- Network: `corapan-network` (172.18.0.0/16, Gateway: 172.18.0.1)
- Status: healthy, restart policy: unless-stopped

**Datenbank:**
- Name: `games_hispanistica`
- User: `games_app`
- Host: `host.docker.internal` (172.18.0.1)
- Port: 5432

**Verzeichnisse:**
```
/srv/webapps/games_hispanistica/
├── app/                    # Git repository
├── config/                 # passwords.env
├── data/                   # Persistent data
├── logs/                   # Application logs
└── media/                  # Media files (releases/)
```

---

## Kritisches Netzwerk-Problem & Lösung

### Problem-Beschreibung

**Ausgangssituation:**
- PostgreSQL hört auf `localhost` (127.0.0.1) und `172.18.0.1` (corapan-network Gateway)
- Container nutzt `host.docker.internal` in `AUTH_DATABASE_URL`
- Docker's default `--add-host=host.docker.internal:host-gateway` löst zu `172.17.0.1` (docker0) auf
- PostgreSQL hört NICHT auf `172.17.0.1` → Container kann DB nicht erreichen

**Falsche Lösung (NICHT verwenden):**
```bash
# FALSCH: Postgres auf docker0 öffnen (Sicherheitsrisiko!)
listen_addresses = 'localhost,172.17.0.1,172.18.0.1'
```

**Problem mit falscher Lösung:**
- Öffnet PostgreSQL für ALLE Container auf docker0 (default bridge)
- Keine Netzwerk-Isolation mehr
- Sicherheitsrisiko: unbeabsichtigte DB-Zugriffe möglich

### Korrekte Lösung

**Ansatz:** Container-Netzwerk fixen, NICHT PostgreSQL aufbohren

**Implementierung:**
1. PostgreSQL bleibt auf `localhost + 172.18.0.1` (nur corapan-network)
2. Container wird mit explizitem host.docker.internal Mapping gestartet:
   ```bash
   --add-host=host.docker.internal:172.18.0.1
   ```
3. Statt host-gateway (→ 172.17.0.1) zeigt es nun auf corapan-network Gateway (172.18.0.1)

**Vorteile:**
- ✅ Netzwerk-Isolation erhalten
- ✅ Nur Container im corapan-network haben DB-Zugriff
- ✅ Keine zusätzlichen offenen Postgres-Interfaces
- ✅ Explizit & nachvollziehbar

---

## PostgreSQL Konfiguration

### Listen Addresses

**Datei:** `/etc/postgresql/14/main/postgresql.conf`

**Korrekte Konfiguration:**
```bash
listen_addresses = 'localhost,172.18.0.1'
```

**Erklärung:**
- `localhost` (127.0.0.1): lokale Verbindungen (psql auf Host)
- `172.18.0.1`: corapan-network Gateway (Docker-Container)

**Verifikation:**
```bash
# PostgreSQL listen_addresses anzeigen
sudo -u postgres psql -c "SHOW listen_addresses;"

# Tatsächlich geöffnete Ports prüfen
ss -tlnp | egrep ':(5432)\b'
```

**Erwartete Ausgabe:**
```
LISTEN 0  244  127.0.0.1:5432   0.0.0.0:*
LISTEN 0  244  172.18.0.1:5432  0.0.0.0:*
```

### Host-Based Authentication (pg_hba.conf)

**Datei:** `/etc/postgresql/14/main/pg_hba.conf`

**Relevante Einträge:**
```bash
# corapan_auth database (corapan-webapp)
host    corapan_auth          corapan_app    172.18.0.0/16    scram-sha-256

# games_hispanistica database (games-webapp)
host    games_hispanistica    games_app      172.18.0.0/16    scram-sha-256
```

**Wichtig:**
- Nur `172.18.0.0/16` (corapan-network) erlaubt
- KEINE `172.17.0.0/16` (docker0) Freigaben
- Authentifizierung: `scram-sha-256`

### PostgreSQL Neustart nach Änderungen

```bash
# Konfiguration testen
sudo nginx -t  # (falls Nginx auch geändert wurde)

# PostgreSQL neu starten
sudo systemctl restart postgresql@14-main

# Status prüfen
systemctl status postgresql@14-main --no-pager

# Verifizieren
sudo -u postgres psql -c "SHOW listen_addresses;"
```

---

## Docker-Container Setup

### Deploy-Script: deploy_prod.sh

**Datei:** `/srv/webapps/games_hispanistica/app/scripts/deploy/deploy_prod.sh`

**Kritische Änderungen:**

#### 1. Preflight Check (Zeile ~147)

**Vorher:**
```bash
if docker run --rm --network "${DOCKER_NETWORK}" postgres:16-alpine \
    pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1; then
```

**Nachher:**
```bash
# Map host.docker.internal to corapan-network gateway (NOT docker0)
CORAPN_GATEWAY="172.18.0.1"
if docker run --rm --network "${DOCKER_NETWORK}" --add-host=host.docker.internal:${CORAPN_GATEWAY} postgres:16-alpine \
    pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1; then
```

#### 2. Container Start (Zeile ~293)

**Vorher:**
```bash
docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --network "${DOCKER_NETWORK}" \
    -p "${HOST_PORT}:${CONTAINER_PORT}" \
    # ... weitere Optionen
```

**Nachher:**
```bash
# Map host.docker.internal to corapan-network gateway (172.18.0.1)
# This allows the container to reach host PostgreSQL via the correct network
CORAPN_GATEWAY="172.18.0.1"
docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --network "${DOCKER_NETWORK}" \
    --add-host=host.docker.internal:${CORAPN_GATEWAY} \
    -p "${HOST_PORT}:${CONTAINER_PORT}" \
    # ... weitere Optionen
```

### Passwords.env Konfiguration

**Datei:** `/srv/webapps/games_hispanistica/config/passwords.env`

**Kritische Einstellungen:**

```bash
# PostgreSQL connection - MUST use host.docker.internal
AUTH_DATABASE_URL=postgresql://games_app:<PASSWORD>@host.docker.internal:5432/games_hispanistica

# Database readiness wait (seconds)
DB_WAIT_SECONDS=120

# Flask configuration
FLASK_SECRET_KEY=<generated-secret>
JWT_SECRET_KEY=<generated-secret>

# Password hashing
AUTH_HASH_ALGO=argon2

# Secure cookies (production)
JWT_COOKIE_SECURE=true

# Environment
FLASK_ENV=production

# Initial admin user (for setup_prod_db.py)
START_ADMIN_USERNAME=admin
START_ADMIN_PASSWORD=<hashed-in-db>
START_ADMIN_EMAIL=admin@games.hispanistica.com

# Docker network
DOCKER_NETWORK=corapan-network
```

**Wichtige Punkte:**
- `AUTH_DATABASE_URL` nutzt `host.docker.internal` (NICHT 172.x.x.x)
- `DB_WAIT_SECONDS=120` für DB-Readiness-Check
- `JWT_COOKIE_SECURE=true` in Produktion
- Secrets werden mit `openssl rand -hex 32` generiert

### Container Deployment

**Standard-Deployment:**
```bash
cd /srv/webapps/games_hispanistica/app
bash scripts/deploy/deploy_prod.sh
```

**Manueller Container-Start (falls nötig):**
```bash
# Container stoppen
docker stop games-webapp
docker rm games-webapp

# Neu starten mit korrektem Mapping
docker run -d \
    --name games-webapp \
    --restart unless-stopped \
    --network corapan-network \
    --add-host=host.docker.internal:172.18.0.1 \
    -p 7000:5000 \
    -v /srv/webapps/games_hispanistica/data:/app/data \
    -v /srv/webapps/games_hispanistica/media:/app/media:ro \
    -v /srv/webapps/games_hispanistica/logs:/app/logs \
    --env-file /srv/webapps/games_hispanistica/config/passwords.env \
    -e "FLASK_ENV=production" \
    -e "GIT_COMMIT=$(git rev-parse --short HEAD)" \
    games-webapp:latest
```

### Connectivity-Verifikation

**Im Container prüfen:**
```bash
# host.docker.internal Auflösung
docker exec games-webapp getent hosts host.docker.internal
# Erwartete Ausgabe: 172.18.0.1      host.docker.internal

# PostgreSQL Erreichbarkeit
docker exec games-webapp pg_isready -h host.docker.internal -p 5432 -U games_app -d games_hispanistica
# Erwartete Ausgabe: host.docker.internal:5432 - accepting connections
```

**Von außerhalb des Containers:**
```bash
# Mit korrektem Mapping testen
docker run --rm --network corapan-network \
    --add-host=host.docker.internal:172.18.0.1 \
    postgres:16-alpine \
    pg_isready -h host.docker.internal -p 5432 -U games_app -d games_hispanistica -q

# Exit code 0 = OK
echo $?
```

---

## Admin-Passwort Reset

### Prozedur

**Wenn Admin-Zugang verloren:**

#### 1. Reset-Script erstellen

**Datei:** `/tmp/reset_admin_password.py`

```python
#!/usr/bin/env python3
"""Reset admin password in production database."""
import os
import sys

# Add app to path
sys.path.insert(0, '/app')

from argon2 import PasswordHasher
from src.app.extensions.sqlalchemy_ext import init_engine, get_session
from src.app.auth.models import User

class AppLike:
    """Minimal Flask app stub."""
    def __init__(self):
        self.config = {
            "AUTH_DATABASE_URL": os.environ.get("AUTH_DATABASE_URL"),
            "AUTH_HASH_ALGO": os.environ.get("AUTH_HASH_ALGO", "argon2"),
        }

def main():
    if len(sys.argv) != 3:
        print("Usage: python reset_admin_password.py <username> <new_password>")
        sys.exit(1)
    
    username = sys.argv[1]
    new_password = sys.argv[2]
    
    # Initialize DB
    app = AppLike()
    init_engine(app)
    
    # Hash password with argon2
    ph = PasswordHasher()
    new_hash = ph.hash(new_password)
    
    # Update user
    with get_session() as session:
        user = session.query(User).filter_by(username=username).first()
        
        if not user:
            print(f"ERROR: User '{username}' not found")
            sys.exit(1)
        
        if user.role != 'admin':
            print(f"ERROR: User '{username}' is not an admin (role={user.role})")
            sys.exit(1)
        
        # Update password and ensure account is active
        user.password_hash = new_hash
        user.is_active = True
        
        session.commit()
        
        print(f"✓ Password updated for admin user '{username}'")
        print(f"  User ID: {user.id}")
        print(f"  Email: {user.email}")
        print(f"  Active: {user.is_active}")
        return 0

if __name__ == "__main__":
    sys.exit(main())
```

#### 2. Neues Passwort generieren

```bash
# Starkes Passwort generieren (24 Zeichen)
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 24)
echo "Generated password: $NEW_PASSWORD"

# WICHTIG: Passwort sicher notieren!
```

#### 3. Script im Container ausführen

```bash
# Script in Container kopieren
docker cp /tmp/reset_admin_password.py games-webapp:/tmp/

# Passwort zurücksetzen
docker exec games-webapp python /tmp/reset_admin_password.py admin "$NEW_PASSWORD"
```

**Erwartete Ausgabe:**
```
✓ Password updated for admin user 'admin'
  User ID: f02b5633-9831-4aa2-927e-3c45e244ef90
  Email: felix.tacke@uni-marburg.de
  Active: True
```

#### 4. Login testen

```bash
# Login-Test (lokal)
curl -X POST http://localhost:7000/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"admin\",\"password\":\"$NEW_PASSWORD\"}" \
    -c /tmp/cookies.txt \
    -w "\nHTTP Status: %{http_code}\n"

# Admin-Dashboard testen
curl -b /tmp/cookies.txt http://localhost:7000/quiz-admin/ \
    -w "\nHTTP Status: %{http_code}\n"

# Admin-API testen
curl -b /tmp/cookies.txt http://localhost:7000/quiz-admin/api/releases
```

### Sicherheits-Hinweise

**Passwort-Handling:**
- ✅ Passwörter mit `openssl rand` generieren (nicht manuell)
- ✅ Mindestens 20-24 Zeichen
- ✅ NIEMALS Passwörter in Git committen
- ✅ NIEMALS Passwörter in Shell-History belassen (verwende Variablen)
- ✅ Nach Reset sofort sicher speichern (Passwort-Manager)

**Cleanup nach Reset:**
```bash
# Temporäre Dateien entfernen
rm -f /tmp/reset_admin_password.py
docker exec games-webapp rm -f /tmp/reset_admin_password.py

# Shell History bereinigen (optional)
history -c
```

---

## Deployment-Prozess

### Standard-Deployment

**Kompletter Deployment-Ablauf:**

```bash
# 1. Repository aktualisieren
cd /srv/webapps/games_hispanistica/app
git pull origin main

# 2. Deploy-Script ausführen
bash scripts/deploy/deploy_prod.sh
```

**Das Script führt automatisch aus:**
1. Pre-flight checks (DB-Connectivity, Docker-Zugriff)
2. Git fetch und reset zu origin/main
3. Docker-Image build (mit Git SHA Tag)
4. Alter Container stoppen und entfernen
5. Neuer Container starten (mit korrekt gemapptem host.docker.internal)
6. DB-Setup ausführen (setup_prod_db.py, idempotent)
7. Smoke-Tests (Container running, /health endpoint)

### Post-Deployment Checks

```bash
# Container-Status
docker ps | grep games-webapp

# Logs prüfen
docker logs games-webapp --tail 50

# Health-Check
curl http://localhost:7000/health

# DB-Connectivity im Container
docker exec games-webapp python -c "
from src.app.extensions.sqlalchemy_ext import init_engine, get_engine
import os
class App:
    config = {'AUTH_DATABASE_URL': os.environ['AUTH_DATABASE_URL']}
init_engine(App())
engine = get_engine()
with engine.connect() as conn:
    result = conn.execute('SELECT 1')
    print('✓ DB connection OK')
"
```

### Rollback bei Problemen

```bash
# Zu vorheriger Version zurück
cd /srv/webapps/games_hispanistica/app
git log --oneline -5  # Vorherige Commits anzeigen
git reset --hard <commit-sha>

# Re-deploy
bash scripts/deploy/deploy_prod.sh
```

---

## Verifikation & Tests

### System-Level Tests

```bash
# 1. PostgreSQL Status
systemctl status postgresql@14-main
sudo -u postgres psql -c "SELECT version();"

# 2. PostgreSQL Listen Addresses
ss -tlnp | egrep ':(5432)\b'
# Erwartete Ausgabe:
# LISTEN 0  244  127.0.0.1:5432
# LISTEN 0  244  172.18.0.1:5432

# 3. Docker Network
docker network inspect corapan-network --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}'
# Erwartete Ausgabe: 172.18.0.1

# 4. Container Status
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep games-webapp
# Erwartete Ausgabe: games-webapp   Up X minutes (healthy)   0.0.0.0:7000->5000/tcp
```

### Application-Level Tests

```bash
# 1. Health Endpoint
curl -fsS http://localhost:7000/health
# Erwartete Ausgabe: {"service":"games.hispanistica","status":"healthy"}

# 2. Datenbank-Tabellen
sudo -u postgres psql games_hispanistica -c "\dt"
# Erwartete Tabellen: users, quiz_*, refresh_tokens, reset_tokens

# 3. Admin-User in DB
sudo -u postgres psql games_hispanistica -c \
  "SELECT username, email, role, is_active FROM users WHERE role='admin';"

# 4. host.docker.internal im Container
docker exec games-webapp getent hosts host.docker.internal
# Erwartete Ausgabe: 172.18.0.1      host.docker.internal

# 5. DB-Connectivity aus Container
docker exec games-webapp pg_isready -h host.docker.internal -p 5432 -U games_app -d games_hispanistica
# Erwartete Ausgabe: host.docker.internal:5432 - accepting connections
```

### Web-Interface Tests

```bash
# 1. Login-Test (lokal)
curl -X POST http://localhost:7000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}' \
  -c /tmp/cookies.txt -w "\nHTTP: %{http_code}\n"
# Erwartete Ausgabe: HTTP: 303 (Redirect)

# 2. Admin-Dashboard
curl -b /tmp/cookies.txt http://localhost:7000/quiz-admin/ -I
# Erwartete Ausgabe: HTTP/1.1 200 OK

# 3. Admin-API (Releases)
curl -b /tmp/cookies.txt http://localhost:7000/quiz-admin/api/releases
# Erwartete Ausgabe: JSON mit releases

# 4. Volume-Schreibrechte
docker exec games-webapp sh -c "touch /app/data/test.tmp && rm /app/data/test.tmp && echo OK"
# Erwartete Ausgabe: OK
```

### Nginx Tests (falls Domain aktiv)

```bash
# 1. Nginx Konfiguration
nginx -t

# 2. Proxy zu games-webapp
curl -I http://localhost/health -H "Host: games.hispanistica.com"
# Erwartete Ausgabe: HTTP/1.1 301 (Redirect zu HTTPS)

# 3. HTTPS (falls SSL konfiguriert)
curl -I https://games.hispanistica.com/health
# Erwartete Ausgabe: HTTP/2 200
```

---

## Troubleshooting

### Container startet nicht / wird sofort unhealthy

**Diagnose:**
```bash
# Container-Logs anzeigen
docker logs games-webapp --tail 100

# DB-Connectivity prüfen
docker exec games-webapp getent hosts host.docker.internal
docker exec games-webapp ping -c 2 host.docker.internal
```

**Häufige Ursachen:**
1. **host.docker.internal zeigt auf falsche IP:**
   - Prüfen: `docker exec games-webapp getent hosts host.docker.internal`
   - Sollte sein: `172.18.0.1`
   - Fix: Container mit `--add-host=host.docker.internal:172.18.0.1` neu starten

2. **PostgreSQL nicht erreichbar:**
   - Prüfen: `ss -tlnp | egrep ':(5432)\b'`
   - PostgreSQL muss auf 172.18.0.1 hören
   - Fix: `listen_addresses` in postgresql.conf korrigieren

3. **Falsche AUTH_DATABASE_URL:**
   - Prüfen: `grep '^AUTH_DATABASE_URL=' /srv/webapps/games_hispanistica/config/passwords.env`
   - Muss enthalten: `host.docker.internal`
   - Fix: In passwords.env korrigieren

### DB-Connectivity-Fehler

**Symptom:** Container-Logs zeigen "Connection refused" oder "timeout"

**Diagnose:**
```bash
# 1. PostgreSQL läuft?
systemctl status postgresql@14-main

# 2. PostgreSQL hört auf richtiger IP?
ss -tlnp | egrep '172.18.0.1:5432'

# 3. pg_hba.conf erlaubt Zugriff?
grep '172.18.0.0/16' /etc/postgresql/14/main/pg_hba.conf

# 4. Container im richtigen Netzwerk?
docker inspect games-webapp | grep NetworkMode
# Sollte sein: "corapan-network"

# 5. Test aus Container
docker run --rm --network corapan-network \
  --add-host=host.docker.internal:172.18.0.1 \
  postgres:16-alpine \
  pg_isready -h host.docker.internal -p 5432 -U games_app -d games_hispanistica
```

**Lösung:**
```bash
# PostgreSQL Listen-Adresse korrigieren
sudo sed -i "s/listen_addresses = .*/listen_addresses = 'localhost,172.18.0.1'/" \
  /etc/postgresql/14/main/postgresql.conf

# PostgreSQL neu starten
sudo systemctl restart postgresql@14-main

# Container neu deployen
cd /srv/webapps/games_hispanistica/app
bash scripts/deploy/deploy_prod.sh
```

### Admin-Login funktioniert nicht

**Symptom:** Login schlägt fehl oder 401 Unauthorized

**Diagnose:**
```bash
# 1. Admin-User existiert und ist aktiv?
sudo -u postgres psql games_hispanistica -c \
  "SELECT username, email, role, is_active FROM users WHERE username='admin';"

# 2. Passwort-Hash vorhanden?
sudo -u postgres psql games_hispanistica -c \
  "SELECT LENGTH(password_hash) FROM users WHERE username='admin';"
# Sollte > 80 Zeichen sein (Argon2-Hash)

# 3. Login-Endpoint erreichbar?
curl -X POST http://localhost:7000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test"}' \
  -w "\nHTTP: %{http_code}\n"
# Sollte 401 oder 303 zurückgeben (nicht 404/500)
```

**Lösung:**
```bash
# Passwort zurücksetzen (siehe Abschnitt "Admin-Passwort Reset")
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 24)
docker cp /tmp/reset_admin_password.py games-webapp:/tmp/
docker exec games-webapp python /tmp/reset_admin_password.py admin "$NEW_PASSWORD"
echo "Neues Passwort: $NEW_PASSWORD"
```

### Nginx 502 Bad Gateway

**Symptom:** Nginx antwortet mit 502 bei Zugriff auf Domain

**Diagnose:**
```bash
# 1. Container läuft?
docker ps | grep games-webapp

# 2. Container-Port erreichbar?
curl http://localhost:7000/health

# 3. Nginx-Konfiguration korrekt?
nginx -t
grep proxy_pass /etc/nginx/sites-enabled/games-hispanistica.conf
# Sollte sein: proxy_pass http://127.0.0.1:7000;

# 4. Nginx-Logs
tail -f /var/log/nginx/error.log
```

**Lösung:**
```bash
# Container neu starten
docker restart games-webapp

# Nginx neu laden
systemctl reload nginx
```

### Deployment schlägt fehl: Preflight Check Failed

**Symptom:** deploy_prod.sh bricht mit "PostgreSQL preflight check failed" ab

**Ursache:** Deploy-Script nutzt falsches host.docker.internal Mapping

**Lösung:**
```bash
# Prüfe deploy_prod.sh enthält:
grep -A2 "CORAPN_GATEWAY" /srv/webapps/games_hispanistica/app/scripts/deploy/deploy_prod.sh

# Sollte enthalten:
# CORAPN_GATEWAY="172.18.0.1"
# --add-host=host.docker.internal:${CORAPN_GATEWAY}

# Falls nicht vorhanden: In deploy_prod.sh hinzufügen (siehe Abschnitt "Docker-Container Setup")
```

---

## Backup & Recovery

### Datenbank-Backup

```bash
# Komplettes Backup
sudo -u postgres pg_dump games_hispanistica > /tmp/games_hispanistica_backup_$(date +%Y%m%d_%H%M%S).sql

# Nur Schema
sudo -u postgres pg_dump --schema-only games_hispanistica > /tmp/games_schema.sql

# Nur Daten
sudo -u postgres pg_dump --data-only games_hispanistica > /tmp/games_data.sql
```

### Konfiguration-Backup

```bash
# passwords.env sichern
cp /srv/webapps/games_hispanistica/config/passwords.env \
   /srv/webapps/games_hispanistica/config/passwords.env.backup_$(date +%Y%m%d_%H%M%S)

# PostgreSQL-Konfiguration sichern
sudo tar czf /tmp/postgresql_config_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  /etc/postgresql/14/main/postgresql.conf \
  /etc/postgresql/14/main/pg_hba.conf

# Nginx-Konfiguration sichern
sudo tar czf /tmp/nginx_config_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  /etc/nginx/sites-available/games-hispanistica.conf
```

### Recovery

```bash
# Datenbank wiederherstellen
sudo -u postgres psql games_hispanistica < /tmp/games_hispanistica_backup_YYYYMMDD_HHMMSS.sql

# Container mit gesichterter Konfiguration neu deployen
cd /srv/webapps/games_hispanistica/app
git checkout <commit-sha>  # Falls Code-Rollback nötig
bash scripts/deploy/deploy_prod.sh
```

---

## Wartungs-Checkliste

### Wöchentlich

- [ ] Container-Logs prüfen: `docker logs games-webapp --tail 100`
- [ ] Festplattenplatz: `df -h /srv/webapps/games_hispanistica`
- [ ] Health-Check: `curl http://localhost:7000/health`

### Monatlich

- [ ] Datenbank-Backup erstellen
- [ ] Konfiguration sichern (passwords.env, postgresql.conf, nginx)
- [ ] Logs rotieren/archivieren
- [ ] Docker-Images aufräumen: `docker system prune -a`

### Bei Updates

- [ ] Vor Update: Backup erstellen
- [ ] Code-Review der Änderungen
- [ ] Test-Deployment auf Staging (falls vorhanden)
- [ ] Deployment durchführen
- [ ] Post-Deployment Tests
- [ ] Monitoring für 24h nach Update

---

## Kontakt & Support

**Server:** vhrz2184  
**Deployment-Datum:** 2026-01-07  
**Letztes Update dieser Dokumentation:** 2026-01-07

**Admin-Login:**
- URL: https://games.hispanistica.com/quiz-admin/
- Username: admin
- Email: felix.tacke@uni-marburg.de

**Wichtige Dateien:**
- Deploy-Script: `/srv/webapps/games_hispanistica/app/scripts/deploy/deploy_prod.sh`
- Config: `/srv/webapps/games_hispanistica/config/passwords.env`
- Repo: `/srv/webapps/games_hispanistica/app/`
- Logs: `/srv/webapps/games_hispanistica/logs/`

**Weitere Dokumentation:**
- `production_server.md` - Server-Übersicht und Konzept
- `games_hispanistica_production.md` - Produktions-Deployment-Guide (im Repo)
- `DEPLOY_ROBUSTNESS_PATCH.md` - Deploy-Robustheit-Patch
- `db_readiness_fix.md` - DB-Readiness-Fix

---

**Ende der Dokumentation**
