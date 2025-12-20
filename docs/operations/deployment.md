# CO.RA.PAN Deployment Guide

**Letzte Aktualisierung:** 2025-12-03

---

## 📋 Übersicht

Dieser Guide beschreibt das Deployment der CO.RA.PAN-Webapp.

**Architektur:**
- Python/Flask Web-App in Docker-Container
- PostgreSQL für Auth-Datenbank (integriert in Docker Compose)
- BlackLab Server für Corpus-Suche
- nginx als Reverse Proxy (Port 80/443 → 6000)
- Media-Dateien werden extern verwaltet (nicht im Docker-Image)

**Neue Deployment-Pipeline (seit 2025-12):**
- Alle Dependencies sind im Docker-Image eingebaut (kein `pip install` im Container)
- Initial-Admin wird automatisch beim Container-Start erstellt
- Health-Endpoint prüft Flask, Auth-DB und BlackLab
- Pre-Deploy-Check validiert Setup lokal vor Production-Deployment

---

## 🚀 Quick Start

### Lokale Entwicklung

```bash
# 1. Environment-Variablen setzen (optional, defaults vorhanden)
export START_ADMIN_PASSWORD=my-secure-password

# 2. Stack starten
docker compose -f infra/docker-compose.dev.yml up -d

# 3. App öffnen
# http://localhost:8000
# Login: admin / admin (oder START_ADMIN_PASSWORD)
```

### Production Deployment

```bash
# 1. Environment-Variablen setzen (REQUIRED)
export FLASK_SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
export JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
export POSTGRES_PASSWORD=<secure-db-password>
export START_ADMIN_PASSWORD=<secure-admin-password>

# 2. Git Pull + Build + Start
git pull origin main
docker compose -f infra/docker-compose.prod.yml up -d --build

# 3. Health Check
curl http://localhost:6000/health
```

---

## 📁 Compose-Dateien

| Datei | Verwendung |
|-------|-----------|
| `infra/docker-compose.dev.yml` | Lokale Entwicklung mit Hot-Reload |
| `infra/docker-compose.prod.yml` | Production mit Security-Defaults |
| `docker-compose.dev-postgres.yml` | Nur PostgreSQL (Legacy) |

---

## 🔑 Environment-Variablen

### Required (Production)

| Variable | Beschreibung | Beispiel |
|----------|-------------|----------|
| `FLASK_SECRET_KEY` | Flask Session Secret | `<64-char-random>` |
| `JWT_SECRET_KEY` | JWT Signing Key | `<64-char-random>` |
| `POSTGRES_PASSWORD` | PostgreSQL Passwort | `<secure-password>` |

### Optional

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `START_ADMIN_USERNAME` | `admin` | Initial Admin Username |
| `START_ADMIN_PASSWORD` | `admin` | Initial Admin Passwort |
| `AUTH_HASH_ALGO` | `argon2` | Hash-Algorithmus (`argon2` oder `bcrypt`) |

---

## 🗄️ Datenbank-Konfiguration

### Docker Compose (Standard)

Die Compose-Dateien enthalten einen PostgreSQL-Service (`db`). Die App verbindet sich automatisch über den internen Hostnamen `db`:

```
AUTH_DATABASE_URL=postgresql+psycopg2://corapan_app:PASSWORD@db:5432/corapan_auth
```

### Externe PostgreSQL (Optional)

Falls eine externe DB verwendet wird:

```bash
AUTH_DATABASE_URL=postgresql+psycopg2://user:pass@external-host:5432/corapan_auth
```

---

## 🔧 Pre-Deploy Check

**Vor jedem Production-Deployment:**

```bash
# Bash (Linux/Mac/WSL)
./scripts/pre_deploy_check.sh

# PowerShell (Windows)
.\scripts\pre_deploy_check.ps1
```

Der Check validiert:
- ✅ Docker-Image baut erfolgreich
- ✅ PostgreSQL startet und ist healthy
- ✅ Web-App startet und ist healthy
- ✅ Auth-DB verbunden (Health-Endpoint)
- ✅ Login funktioniert

---

## 👤 Admin-User verwalten

### Initial-Admin beim Start

Der Container erstellt automatisch einen Admin-User wenn `START_ADMIN_PASSWORD` gesetzt ist.

### Passwort zurücksetzen

```bash
# Im Container
docker exec -it corapan-web-prod python scripts/reset_user_password.py admin --unlock

# Lokal (mit AUTH_DATABASE_URL)
python scripts/reset_user_password.py admin --password new-password --unlock
```

### Neuen Admin erstellen

```bash
docker exec -it corapan-web-prod python scripts/create_initial_admin.py \
    --username newadmin \
    --password secure-pass \
    --email admin@example.org \
    --allow-production
```

---

## 🩺 Health Monitoring

### Endpoints

| Endpoint | Beschreibung |
|----------|-------------|
| `/health` | Gesamtstatus (Flask + Auth-DB + BlackLab) |
| `/health/auth` | Auth-DB Status |
| `/health/bls` | BlackLab Status |

### Response Format

```json
{
  "status": "healthy",
  "service": "corapan-web",
  "checks": {
    "flask": {"ok": true},
    "auth_db": {"ok": true, "backend": "postgresql"},
    "blacklab": {"ok": true, "url": "http://..."}
  }
}
```

### Docker Healthcheck

Die Container haben eingebaute Healthchecks:

```bash
docker ps  # STATUS zeigt "(healthy)" wenn OK
docker inspect --format='{{json .State.Health}}' corapan-web-prod
```

---

**Von lokalem Rechner:**

```powershell
# Media-Dateien (initial, einmalig)
scp -r ./media/mp3-full/* user@server:/root/corapan/media/mp3-full/
scp -r ./media/mp3-split/* user@server:/root/corapan/media/mp3-split/
scp -r ./media/transcripts/* user@server:/root/corapan/media/transcripts/

# Datenbank (initial, einmalig)
scp -r ./data/db/* user@server:/root/corapan/data/db/

# Config (Passwörter, JWT-Keys)
scp ./passwords.env user@server:/root/corapan/
scp ./config/keys/* user@server:/root/corapan/config/keys/
```

### 4. Update-Script ausführbar machen

```bash
chmod +x /root/corapan/update.sh
```

### 5. Erstes Deployment

```bash
cd /root/corapan
./update.sh --no-backup  # Erstes Mal, kein Backup nötig
```

### 6. nginx Reverse Proxy konfigurieren (falls noch nicht)

**`/etc/nginx/sites-available/corapan`:**

```nginx
server {
    listen 80;
    server_name corapan.yourdomain.com;

    # Optional: Redirect to HTTPS
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:6000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket Support (falls benötigt)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Aktivieren:**

```bash
ln -s /etc/nginx/sites-available/corapan /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 🔄 Workflow: Code-Änderungen deployen

### Lokaler Rechner (Windows)

```powershell
# 1. Änderungen committen
git add .
git commit -m "Beschreibung der Änderungen"

# 2. Zu Git pushen
git push origin main
```

### Server (über VPN + SSH)

```bash
# 3. Auf Server einloggen
ssh user@server

# 4. Update ausführen
cd /root/corapan
./update.sh
```

**Fertig!** ✅

---

## 📁 Neue Media-Dateien hinzufügen

Wenn neue Audio-Dateien und Transkripte hinzukommen:

### 1. Lokal: Datenbank neu erstellen

```powershell
# Neue Dateien zu media/ hinzufügen
# Dann DB neu generieren (verwende dein existierendes Script)
python LOKAL/database/database_creation_v2.py
```

### 2. Dateien auf Server kopieren

```powershell
# Neue Media-Dateien
scp -r ./media/mp3-full/neue-datei.mp3 user@server:/root/corapan/media/mp3-full/
scp -r ./media/mp3-split/neue-datei/* user@server:/root/corapan/media/mp3-split/

# Aktualisierte Datenbank
scp -r ./data/db/* user@server:/root/corapan/data/db/
```

### 3. Docker Container neustarten (damit DB neu geladen wird)

```bash
ssh user@server
cd /root/corapan
docker compose restart
```

---

## 📊 Data-Sync: Dev → Prod

Für die Synchronisation von Daten-Verzeichnissen und Statistik-Datenbanken existieren PowerShell-Skripte unter `scripts/deploy_sync/`.

### Synchronisierte Daten

| Pfad | Inhalt | Skript |
|------|--------|--------|
| `data/counters/` | Zähler-Daten | `sync_data.ps1` |
| `data/db_public/` | Öffentliche Stats-DBs (`stats_all.db`) | `sync_data.ps1` |
| `data/metadata/` | Metadaten-Dateien | `sync_data.ps1` |
| `data/exports/` | Export-Dateien | `sync_data.ps1` |
| `data/blacklab_export/` | BlackLab-Exportdaten | `sync_data.ps1` |
| `data/db/stats_files.db` | Atlas-Statistiken pro Datei | `sync_data.ps1` |
| `data/db/stats_country.db` | Atlas-Statistiken pro Land | `sync_data.ps1` |
| `media/mp3-full/` | Vollständige Audio-Dateien | `sync_media.ps1` |
| `media/mp3-split/` | Segmentierte Audio-Dateien | `sync_media.ps1` |
| `media/transcripts/` | Transkript-Dateien | `sync_media.ps1` |

### NICHT synchronisiert (bewusst ausgeschlossen)

| Pfad | Grund |
|------|-------|
| `data/blacklab_index/` | Wird auf Server neu gebaut |
| `data/blacklab_index.backup/` | Nur lokales Backup |
| `data/stats_temp/` | Temporäre Dateien |
| `data/db/auth.db` | Prod-Auth-DB ist unabhängig |
| `data/db/transcription.db` | Prod-Transkriptions-DB ist unabhängig |

### Verwendung

```powershell
# Vom lokalen Dev-Rechner (PowerShell)
cd C:\dev\corapan-webapp

# Daten synchronisieren (inkl. Stats-DBs)
.\scripts\deploy_sync\sync_data.ps1

# Media synchronisieren
.\scripts\deploy_sync\sync_media.ps1
```

### Stats-DBs für Atlas-Funktionen

Die Dateien `stats_files.db` und `stats_country.db` werden lokal generiert und sind für die Atlas-/Stats-Funktionen erforderlich:
- `/api/v1/atlas/files` - Dateien mit Metadaten
- `/api/v1/atlas/countries` - Länder-Statistiken
- `/corpus_metadata` - Metadaten-Übersicht im UI

Bei fehlendem Sync dieser Dateien liefern die Endpunkte 500-Fehler.

---

## 🛠️ Nützliche Befehle

### Container Management

```bash
# Status prüfen
docker compose ps

# Logs anzeigen
docker compose logs -f
docker compose logs --tail=100

# Container neustarten
docker compose restart

# Container stoppen
docker compose down

# Container starten
docker compose up -d

# In Container einloggen (debugging)
docker exec -it corapan-container bash
```

### Update-Script Optionen

```bash
# Normales Update (mit Backup)
./update.sh

# Update ohne Backup (schneller)
./update.sh --no-backup

# Force Rebuild (ignoriert Docker Cache)
./update.sh --force

# Hilfe anzeigen
./update.sh --help
```

### Health Check

```bash
# App-Status prüfen
curl http://localhost:6000/health

# Von außen (mit nginx)
curl http://corapan.yourdomain.com/health
```

### Backups

```bash
# Backups anzeigen
ls -lh /root/corapan/backups/

# Backup manuell wiederherstellen
tar -xzf /root/corapan/backups/backup_20251019_143022.tar.gz -C /root/corapan/
```

---

## 🔧 Manuelles Deployment (alter Workflow)

Falls das Update-Script nicht funktioniert:

```bash
# 1. Code aktualisieren
cd /root/corapan
git pull origin main

# 2. Alten Container stoppen und löschen
docker stop corapan-container
docker rm corapan-container

# 3. Neues Image bauen
docker build -t corapan-app .

# 4. Container starten (mit allen Volumes)
docker run -d --name corapan-container \
  --restart unless-stopped \
  -p 6000:8000 \
  -v /root/corapan/media/mp3-full:/app/media/mp3-full:ro \
  -v /root/corapan/media/mp3-split:/app/media/mp3-split:ro \
  -v /root/corapan/media/mp3-temp:/app/media/mp3-temp \
  -v /root/corapan/media/transcripts:/app/media/transcripts:ro \
  -v /root/corapan/passwords.env:/app/passwords.env:ro \
  -v /root/corapan/config/keys:/app/config/keys:ro \
  -v /root/corapan/data/db:/app/data/db:ro \
  -v /root/corapan/data/counters:/app/data/counters \
  -v /root/corapan/logs:/app/logs \
  corapan-app

# 5. Health Check
sleep 5
curl http://localhost:6000/health
```

**Oder mit Docker Compose:**

```bash
docker compose down
docker compose build
docker compose up -d
```

---

## 🐛 Troubleshooting

### Problem: Container startet nicht

```bash
# Logs checken
docker compose logs

# Letzten Build-Fehler sehen
docker compose build

# Force rebuild
docker compose build --no-cache
```

### Problem: "Permission denied" auf Volumes

```bash
# Permissions auf Server prüfen
ls -la /root/corapan/data/counters/

# Falls nötig: Permissions anpassen
chmod -R 755 /root/corapan/data/counters/
```

### Problem: Health Check schlägt fehl

```bash
# Container läuft?
docker compose ps

# Port erreichbar?
curl http://localhost:6000/health

# Logs prüfen
docker compose logs --tail=50
```

### Problem: Git Pull schlägt fehl

```bash
# Uncommitted changes?
git status

# Falls ja: Stash oder Commit
git stash
git pull origin main
```

### Problem: Alte Images füllen Festplatte

```bash
# Alte Images löschen
docker image prune -a

# Alle ungenutzten Ressourcen löschen
docker system prune -a
```

---

## 📊 Monitoring

### Log-Dateien

```bash
# App-Logs (im Container)
docker compose logs -f

# App-Logs (auf Host persistiert)
tail -f /root/corapan/logs/corapan.log

# nginx Logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Resource Usage

```bash
# Container Stats (CPU, RAM, Network)
docker stats corapan-container

# Disk Usage
df -h
du -sh /root/corapan/*
```

---

## 🔐 Security Checklist

- [ ] `passwords.env` ist nur auf Server (nicht in Git!)
- [ ] JWT Keys sind nur auf Server (nicht in Git!)
- [ ] nginx HTTPS konfiguriert (Let's Encrypt)
- [ ] Firewall aktiv (nur VPN + Port 80/443)
- [ ] SSH Key-basiert (kein Passwort-Login)
- [ ] Regelmäßige Backups der Counter-Daten
- [ ] Logs werden rotiert (nicht unbegrenzt wachsen)

---

## 📝 Verzeichnisstruktur auf Server

```
/root/corapan/
├── src/                    # App-Code (aus Git)
├── static/                 # Frontend-Assets (aus Git)
├── templates/              # HTML-Templates (aus Git)
├── media/                  # Media-Dateien (NICHT in Git)
│   ├── mp3-full/          # Original-Audios
│   ├── mp3-split/         # Segmentierte Audios
│   ├── mp3-temp/          # Temp-Verarbeitung
│   └── transcripts/       # Transkript-Dateien
├── data/                   # Datenbank (NICHT in Git)
│   ├── db/                # SQLite-Datenbanken
│   └── counters/          # JSON-Counter-Dateien
├── config/                 # Credentials (NICHT in Git)
│   └── keys/              # JWT Public/Private Keys
├── logs/                   # Log-Dateien
├── backups/                # Automatische Backups
├── passwords.env           # Environment-Variablen (NICHT in Git)
├── docker-compose.yml      # Docker Compose Config (aus Git)
├── update.sh               # Update-Script (aus Git)
└── Dockerfile              # Docker Build (aus Git)
```

---

## 🚨 Emergency Rollback

Falls ein Update Probleme verursacht:

```bash
# 1. Letztes Backup wiederherstellen
cd /root/corapan
tar -xzf backups/backup_TIMESTAMP.tar.gz

# 2. Zum vorherigen Git-Commit zurück
git log --oneline  # Commit-Hash finden
git reset --hard <commit-hash>

# 3. Container neu bauen mit alter Version
docker compose down
docker compose build
docker compose up -d
```

---

## 📧 Support

Bei Problemen:
1. Logs prüfen: `docker compose logs -f`
2. Health Check: `curl http://localhost:6000/health`
3. Container Status: `docker compose ps`

**Hilfreich für Debugging:**
- Git Commit-Hash: `git rev-parse --short HEAD`
- Docker Image ID: `docker images corapan-app`
- Container Start-Zeit: `docker inspect corapan-container | grep StartedAt`

---

**Ende des Deployment-Guides**
