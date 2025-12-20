# CO.RA.PAN – Server- und Deployment-Setup (marele.online.uni-marburg.de)

## 1. Server / Host

| Eigenschaft | Wert |
|-------------|------|
| Hostname (intern) | `vhrz2184.HRZ.uni-marburg.de` |
| Alias (extern) | `marele.online.uni-marburg.de` |
| Öffentliche URL der App | `https://corapan.online.uni-marburg.de` |
| Reverse Proxy | nginx → `http://127.0.0.1:6000` |
| RAM/CPU | 1 vCPU, 1 GB RAM, 20 GB Disk |

## 2. Verzeichnisstruktur

Root für Webapps: `/srv/webapps/corapan/`

| Pfad | Beschreibung | Quelle |
|------|--------------|--------|
| `/srv/webapps/corapan/app` | Git-Checkout (dieses Repo) | GitHub |
| `/srv/webapps/corapan/data` | Daten (BlackLab-Index, Counters etc.) | rsync vom Laptop |
| `/srv/webapps/corapan/media` | Medien (MP3s, Transkripte) | rsync vom Laptop |
| `/srv/webapps/corapan/config` | Config-Files (`passwords.env`, Keys) | manuell |
| `/srv/webapps/corapan/logs` | App-Logs | Container-Volume |

> **Wichtig:** `data/` und `media/` kommen **nicht** aus Git, sondern werden per rsync auf den Server synchronisiert und im Container nur als Volumes eingehängt.

## 3. Git / Branch-Policy / Runner

- **Repo:** `https://github.com/FTacke/corapan-webapp`
- **Prod-Branch:** `main`
- **Deployment-Trigger:** `push` auf `main`
- **GitHub self-hosted Runner:**
  - läuft auf `marele`-Server
  - Working-Directory: `/srv/webapps/corapan/app`
  - Rechte: RW auf `/srv/webapps/corapan/{app,data,media,config,logs}`

## 4. Docker-Setup für die App

| Eigenschaft | Wert |
|-------------|------|
| Docker-Image-Name | `corapan-webapp:latest` |
| Docker-Container-Name | `corapan-webapp` |
| Container-Port | 5000 |
| Host-Port | 6000 |
| Port-Mapping | `-p 6000:5000` |

### Volumes

| Host-Pfad | Container-Pfad | Mode |
|-----------|----------------|------|
| `/srv/webapps/corapan/data` | `/app/data` | rw |
| `/srv/webapps/corapan/media` | `/app/media` | rw |
| `/srv/webapps/corapan/logs` | `/app/logs` | rw |

> **Secrets:** Die Datei `/srv/webapps/corapan/config/passwords.env` wird per `--env-file` geladen (nicht als Volume gemountet). Die App erwartet die Secrets als Umgebungsvariablen.

### Container-Start (Referenz)

```bash
docker run -d --name corapan-webapp \
  --restart unless-stopped \
  -p 6000:5000 \
  -v /srv/webapps/corapan/data:/app/data \
  -v /srv/webapps/corapan/media:/app/media \
  -v /srv/webapps/corapan/logs:/app/logs \
  --env-file /srv/webapps/corapan/config/passwords.env \
  corapan-webapp:latest
```

## 5. Datenbank (PostgreSQL)

| Eigenschaft | Wert |
|-------------|------|
| Modus | Native PostgreSQL-Installation auf dem Host |
| Host | `localhost` |
| Port | `5432` |
| DB-Name | `corapan_auth` |
| DB-User | `corapan_app` |

**Verbindungs-URL (Umgebungsvariable):**
```
DATABASE_URL=postgresql://corapan_app:***@localhost:5432/corapan_auth
```

> **Hinweis:** Das konkrete Passwort liegt in `/srv/webapps/corapan/config/passwords.env` auf dem Server.

### Prod-DB-Setup-Script

Das Script `scripts/setup_prod_db.py` führt folgende Aktionen aus:
1. Wendet Datenbankmigrationen an (erstellt Schema falls nicht vorhanden)
2. Prüft, ob ein Admin-User existiert
3. Legt bei Bedarf einen Admin-User an:
   - Username: `admin`
   - Password: `change-me`
   - E-Mail: `admin@example.org` (oder `ADMIN_EMAIL` aus ENV)

**Aufruf im Container:**
```bash
docker exec corapan-webapp python scripts/setup_prod_db.py
```

Das Script ist idempotent – mehrfaches Ausführen ist sicher und erzeugt keinen Fehler.

## 6. Daten / Media

| Host-Pfad | Beschreibung |
|-----------|--------------|
| `/srv/webapps/corapan/data` | BlackLab-Index, Counters, DB-Backups |
| `/srv/webapps/corapan/media` | MP3-Dateien, Transkripte |

**Befüllung:** Per rsync vom Entwicklungsrechner (nicht über Git).

**rsync-Beispiel:**
```bash
# Daten
rsync -av \
  --exclude 'stats_temp/' \
  --exclude 'counters/' \
  ./data/ user@marele.online.uni-marburg.de:/srv/webapps/corapan/data/

# Medien
rsync -av \
  --exclude 'mp3-temp/' \
  ./media/ user@marele.online.uni-marburg.de:/srv/webapps/corapan/media/
```

## 7. Reverse Proxy & TLS

| Eigenschaft | Wert |
|-------------|------|
| Reverse Proxy | nginx |
| Backend-Ziel | `http://127.0.0.1:6000` |
| TLS-Zertifikate | Let's Encrypt |

## 8. Deployment-Ablauf

### Automatisch (via GitHub Actions)

1. **Trigger:** Push auf `main` Branch
2. **Job:** Läuft auf self-hosted Runner auf `marele`
3. **Script:** `scripts/deploy_prod.sh` führt aus:
   - `git fetch` / `git reset --hard origin/main`
   - Docker-Image bauen: `docker build -t corapan-webapp:latest .`
   - Alten Container stoppen/entfernen
   - Neuen Container mit Volumes starten
   - (Optional) DB-Setup-Script aufrufen

> **Wichtig:** `data/` und `media/` werden beim Deployment NICHT angefasst – diese werden separat per rsync bereitgestellt.

### Manuell (bei Bedarf)

```bash
cd /srv/webapps/corapan/app
bash scripts/deploy_prod.sh
```

## 9. Checkliste Erstinstallation

- [ ] Server-Verzeichnisse anlegen: `/srv/webapps/corapan/{app,data,media,config,logs}`
- [ ] Host-Verzeichnisse für Container-User beschreibbar machen:
  ```bash
  chown -R 1000:1000 /srv/webapps/corapan/{data,media,logs}
  ```
- [ ] Git-Repo klonen nach `/srv/webapps/corapan/app`
- [ ] `passwords.env` in `/srv/webapps/corapan/config/` anlegen
- [ ] PostgreSQL-Datenbank und User einrichten
- [ ] Daten/Medien per rsync übertragen
- [ ] GitHub self-hosted Runner einrichten
- [ ] nginx-Konfiguration erstellen
- [ ] Erster Deploy via `scripts/deploy_prod.sh`
- [ ] DB-Setup: `docker exec corapan-webapp python scripts/setup_prod_db.py`
- [ ] Admin-Passwort ändern!

