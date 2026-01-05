# Hispanistica Games - Quick Start

## 🚀 Dev-Setup (PostgreSQL + Quiz Module)

**Ein Befehl startet alles:** Docker PostgreSQL, Virtualenv, Dependencies, Auth-DB, Quiz-DB, Dev-Server.

```powershell
# Im Repository-Root ausfuehren
.\scripts\dev-setup.ps1 -UsePostgres
```

Das Skript:
1. Startet PostgreSQL via Docker (Port 54320)
2. Richtet `.venv` + Python-Dependencies ein
3. Erstellt Auth-DB (PostgreSQL)
4. Legt den Admin-User an (admin / change-me)
5. Initialisiert Quiz-Module mit Demo-Daten
6. Startet den Flask Dev-Server unter `http://localhost:8000`

**Login:** `admin` / `change-me`

**Quiz Demo:** http://localhost:8000/quiz

---

## Nur neu starten (ohne Neuinstallation)

Wenn alles bereits eingerichtet ist:

```powershell
.\scripts\dev-start.ps1 -UsePostgres
```

Startet PostgreSQL (falls gestoppt) + Dev-Server mit existierender Konfiguration.

**Auto-Pipeline:** `dev-start.ps1` führt automatisch vor dem Serverstart aus:
1. **Normalize:** Generiert fehlende ULID-IDs und `questions_statistics`
2. **Seed:** Importiert/aktualisiert Quiz-Inhalte aus JSON-Dateien
3. **Prune:** Deaktiviert Topics ohne JSON-Datei (soft: `is_active=false`)

Quiz-Inhalte in `content/quiz/topics/*.json` werden automatisch synchronisiert.

---

## Quiz Content Management (Manuell)

### Quiz-Inhalte normalisieren

```powershell
python scripts/quiz_units_normalize.py --write
```

Generiert fehlende `id`-Felder (ULID-Format) und aktualisiert `questions_statistics`.

**Hinweis:** Standard-Pfad ist jetzt `content/quiz/topics`.

### Komplette Pipeline manuell ausführen

```powershell
# Soft prune (Standard: Topics ohne JSON → is_active=false)
python scripts/quiz_seed.py --prune-soft

# Hard prune (WARNUNG: Löscht Topics + Fragen permanent)
python scripts/quiz_seed.py --prune-hard
```

**Hinweis:** Player-Daten (Runs, Scores) werden nie gelöscht.

---

## Voraussetzungen

- **Python 3.12+** (empfohlen: in `.venv` aktiviert)
- **PowerShell** (Version 5.1 oder 7+)
- **Docker Desktop** (erforderlich für PostgreSQL)

---

## Script-Optionen

### dev-setup.ps1 (Erst-Setup / Vollstaendige Installation)

| Parameter | Beschreibung |
|-----------|-------------|
| `-UsePostgres` | **ERFORDERLICH** - Startet PostgreSQL via Docker |
| `-SkipInstall` | Ueberspringt pip install |
| `-SkipDevServer` | Ueberspringt Dev-Server-Start |
| `-ResetAuth` | Auth-DB zuruecksetzen + Admin neu anlegen |
| `-StartAdminPassword` | Initiales Admin-Passwort (Default: `change-me`) |

### dev-start.ps1 (Taegliches Starten)

| Parameter | Beschreibung |
|-----------|-------------|
| `-UsePostgres` | **ERFORDERLICH** - Startet PostgreSQL wenn noetig |

---

## Environment-Variablen

Die Dev-Skripte setzen automatisch:

| Variable | Dev-Wert |
|----------|----------|
| `AUTH_DATABASE_URL` | `postgresql://hispanistica_auth:hispanistica_auth@localhost:54320/hispanistica_auth` |
| `JWT_SECRET_KEY` | `dev-jwt-secret-change-me` |
| `FLASK_SECRET_KEY` | `dev-secret-change-me` |

> **Wichtig:** Quiz-Module benötigt PostgreSQL mit JSONB-Support (keine SQLite-Kompatibilität)

---

## Docker-Services (nur bei PostgreSQL-Modus)

Der Dev-Stack verwendet `docker-compose.dev-postgres.yml`:

| Service | Contai

Der Dev-Stack verwendet `docker-compose.dev-postgres.yml`:

| Service | Container | Port | Beschreibung |
|---------|-----------|------|-------------|
| PostgreSQL | `hispanistica_auth_db` | `54320` | Auth-DB + Quiz-DB
# Starten
docker compose -f docker-compose.dev-postgres.yml up -d

# Stoppen
docker compose -f docker-compose.dev-postgres.yml down

# Status pruefen
docker compose -f docker-compose.dev-postgres.yml ps

# Logs ansehen
docker compose -f docker-compose.dev-postgres.yml logs -f
```

---

## Health Checks

```powershell
# App Health
Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing

# Auth DB Health
Invoke-WebRequest -Uri "http://localhost:8000/health/auth" -UseBasicParsing
```

---


# Quiz Topics API
Invoke-WebRequest -Uri "http://localhost:8000/api/quiz/topics" -UseBasicParsing
## Troubleshooting

### Docker-Container laeuft nicht (PostgreSQL-Modus)

```powershell
docker ps --filter name=hispanistica
docker logs hispanistica_auth_db
```

### PostgreSQL-Verbindung schlaegt fehl

```powershell
# Healthcheck pruefen
docker inspect --format='{{.State.Health.Status}}' hispanistica_auth_db

# Container neu starten
docker compose -f docker-compose.dev-postgres.yml restart hispanistica_auth_db
```

.\scripts\dev-setup.ps1 -UsePostgres -ResetAuth -StartAdminPassword "neues-passwort"
```

### Quiz-DB neu initialisieren

```powershell
$env:AUTH_DATABASE_URL = "postgresql://hispanistica_auth:hispanistica_auth@localhost:54320/hispanistica_auth"
python scripts/init_quiz_db.py --seed --drop

# PostgreSQL
.\scripts\dev-setup.ps1 -UsePostgres -ResetAuth -StartAdminPassword "neues-passwort"
```
Quiz Integration](docs/quiz-integration-summary.md) - Quiz-Module Dokumentation
- [Quiz Test Results](docs/quiz-integration-test-results.md) - QA Test Report
- [Deployment Guide](docs/operations/deployment.md) - Production-Deployment
- [Project Structure](docs/reference/project_structure.md) - Codebase-Uebersicht

---

## 🎮 Features

- **Quiz-Module:** Interaktives Lernquiz mit Timer, Joker-System, Leaderboards (PostgreSQL-native mit JSONB)
- **Auth-System:** User-Management mit JWT + Session-based Auth
- **MD3 Design:** Material Design 3 UI-Komponenten
- **Responsive:** Mobile-first Layout mit Navigation Drawer
- **i18n-ready:** Mehrsprachigkeit vorbereitet (DE/ES)

## Weiterfuehrende Dokumentation

- [Development Setup](docs/operations/development-setup.md) - Detaillierte Setup-Anleitung
- [Deployment Guide](docs/operations/deployment.md) - Production-Deployment
- [Project Structure](docs/reference/project_structure.md) - Codebase-Uebersicht
