# Hispanistica Games - Quick Start

> **⚠️ DEV-ONLY DOCUMENT** – Dieses Dokument beschreibt die **lokale Entwicklungsumgebung**.
> Für Production-Workflows (rsync, Import-CLI, Content-Releases) siehe:
> **[games_hispanistica_production.md](games_hispanistica_production.md)**

## 🚀 Dev-Setup (PostgreSQL + Quiz Module)

**Ein Befehl startet alles:** Docker PostgreSQL, Virtualenv, Dependencies, Auth-DB, Quiz-DB, Dev-Server.

```powershell

.\scripts\dev-start.ps1    # Täglicher Start (Postgres default)

\scripts\dev-setup.ps1 -UsePostgres   # Erstmaliges Setup (nicht verwenden)

$env:QUIZ_DEV_SEED_MODE='single'; .\scripts\dev-start.ps1

```

> **Hinweis (Refactoring-Branch):** v2 ist jetzt Default. Wenn du seeden willst,
> setze vor dem Start `QUIZ_DEV_SEED_MODE=single`.
> Falls `variation_aussprache_v2.json` fehlt, zuerst Migration ausführen:
> `python scripts/quiz_content_migrate_difficulty_1_3.py`.

Das Skript:
1. Startet PostgreSQL via Docker (Ports 54321 Auth + 54322 Quiz)
2. Richtet `.venv` + Python-Dependencies ein
3. Erstellt Auth-DB (PostgreSQL)
4. Legt den Admin-User an (admin / change-me)
5. Initialisiert Quiz-Module mit Demo-Daten
6. Startet den Flask Dev-Server auf einem freien Port (Standard: 8000, wird im Terminal angezeigt)

**Login (DEV):** `admin_dev` / `0000`

**Quiz Demo:** http://localhost:<PORT>/quiz

---

## Nur neu starten (ohne Neuinstallation)

Wenn alles bereits eingerichtet ist:

```powershell
.\scripts\dev-start.ps1
```

> `-UsePostgres` ist deprecated (Postgres ist Default).

Wenn du seeden willst:
```powershell
$env:QUIZ_DEV_SEED_MODE = 'single'
.\scripts\dev-start.ps1
```

**Kopierbarer Single-Seed-Start (v2):**
```powershell
$env:QUIZ_DEV_SEED_MODE = 'single'
.\scripts\dev-start.ps1
```

**Mehrere v2-Units testen:**
```powershell
$env:QUIZ_DEV_SEED_MODE = 'all'
.\scripts\dev-start.ps1
```

Startet PostgreSQL (falls gestoppt) + Dev-Server mit existierender Konfiguration.

**Auto-Pipeline:** `dev-start.ps1` führt automatisch vor dem Serverstart aus:
1. **Normalize:** Generiert fehlende ULID-IDs und `questions_statistics`
2. **Seed:** Importiert/aktualisiert Quiz-Inhalte aus JSON-Dateien
3. **Prune:** Deaktiviert Topics ohne JSON-Datei (soft: `is_active=false`)

Quiz-Inhalte in `content/quiz/topics/*.json` werden automatisch synchronisiert.

> **⚠️ DEV-ONLY:** Diese automatischen Seeds laufen NUR in der lokalen Entwicklung.
> In Production werden Inhalte per rsync hochgeladen und über Import-CLI oder
> Admin-Dashboard importiert. Siehe [games_hispanistica_production.md](games_hispanistica_production.md).

---

## 📦 Production Content Release (Upload & Publish)

> **PRODUCTION-ONLY SECTION** – Diese Sektion beschreibt die Production-Content-Pipeline:
> Vorbereitung → rsync-Upload → Import → Publish

### Schritt 1: Release-Ordner vorbereiten

Erstelle einen Release-Ordner mit dieser **exakten Struktur**:

```
C:\content\quiz_releases\release_YYYYMMDD_HHMM\
├── units\
│   ├── topic_001.json
│   ├── topic_002.json
│   └── ...
└── audio\
    ├── audio_001.mp3
    ├── audio_002.mp3
    └── ...
```

**Beispiel deiner aktuellen Structure:**
```
C:\dev\games_hispanistica\content\quiz_releases\release_20260106_2200\
├── units\               <- JSON-Dateien (quiz-units)
├── audio\               <- MP3-Dateien (Audio-Ref aus JSON)
```

**JSON-Format (units/*.json):**
```json
{
  "slug": "topic_001",
  "title": "topic.001.title",
  "description": "topic.001.description",
  "authors": ["Author Name"],
  "based_on": null,
  "questions": [
    {
      "id": "q_001",
      "type": "multiple-choice",
      "difficulty": 1,
      "prompt": "question.prompt.key",
      "explanation": "question.explanation.key",
      "answers": [
        {"id": "a1", "text": "Answer Text", "correct": true, "media": []},
        {"id": "a2", "text": "Wrong Answer", "correct": false, "media": []}
      ],
      "media": [],
      "sources": [],
      "meta": {}
    }
  ]
}
```

### Schritt 2: Local Upload-Test (Dry-Run)

Vor dem echten Upload: **Immer einen Dry-Run machen!**

```powershell
# Variable setzen
$ReleaseId = "release_20260106_2200"
$LocalPath = "C:\dev\games_hispanistica\content\quiz_releases\release_20260106_2200"
$ServerUser = "root"
$ServerHost = "games.hispanistica.com"

# Dry-Run (zeigt was hochgeladen würde, ändert nichts)
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId $ReleaseId `
  -LocalPath $LocalPath `
  -ServerUser $ServerUser `
  -ServerHost $ServerHost
```

**Output sollte zeigen:**
- Lokale Struktur: units/ + audio/
- Datei-Count
- Keine Fehler

### Schritt 3: Echten Upload durchführen

Wenn der Dry-Run OK ist:

```powershell
# Mit -Execute Flag
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId $ReleaseId `
  -LocalPath $LocalPath `
  -ServerUser $ServerUser `
  -ServerHost $ServerHost `
  -Execute
```

**Bestätigung:** Der Upload wird am Ende zusammengefasst:
```
✓ Upload completed successfully

Next steps (on server):
  1. SSH into server: ssh root@games.hispanistica.com
  2. Set symlink: cd /srv/webapps/games_hispanistica/media && ln -sfn releases/release_20260106_2200 current
  3. Import: ./manage import-content --release release_20260106_2200
  4. Publish: ./manage publish-release --release release_20260106_2200
```

### Schritt 4: Auf dem Server - Import durchführen

SSH in den Server:

```bash
ssh root@games.hispanistica.com

# Zum richtigen Verzeichnis
cd /srv/webapps/games_hispanistica/app

# Symlink setzen
cd ../media
ln -sfn releases/release_20260106_2200 current
cd ../app

# Import (Content als Draft, nicht sichtbar)
python manage.py import-content \
  --units-path media/current/units \
  --audio-path media/current/audio \
  --release release_20260106_2200

# Output sollte zeigen: "✓ Import successful"
```

### Schritt 5: Auf dem Server - Publish durchführen

```bash
# Nur ein Release kann published sein - dieses hier aktivieren
python manage.py publish-release --release release_20260106_2200

# Output: "✓ Release 'release_20260106_2200' published"
```

**Das wars!** Content ist jetzt sichtbar im Frontend.

### Rollback (falls nötig)

```bash
# Unpublish aktuelles Release
python manage.py unpublish-release --release release_20260106_2200

# Vorheriges Release wieder publishen (falls vorhanden)
python manage.py list-releases
python manage.py publish-release --release <previous_release_id>
```

### Troubleshooting

**Problem: SSH funktioniert nicht**
```
ssh: permission denied (publickey)
```
→ SSH-Key nicht konfiguriert. Siehe [games_hispanistica_production.md § A3](games_hispanistica_production.md#a3-ssh-setup)

**Problem: rsync nicht gefunden**
```
rsync : The term 'rsync' is not recognized
```
→ Installiere rsync via WSL, Cygwin, oder native Windows-Binary. Siehe Dokumentation.

**Problem: Dry-Run zeigt Fehler**
```
ERROR: Validation failed for ... (invalid JSON)
```
→ Check deine JSON-Dateien in `units/`:
```powershell
python scripts/quiz_units_normalize.py --write
```

**Problem: Import war erfolgreich aber Content nicht sichtbar**
- Check ob `publish-release` aufgerufen wurde
- Verifizieren: `python manage.py list-releases`
- Content ist nur nach Publish sichtbar, nicht nach Import

---

## 📋 Quick Reference: Complete Release Workflow

**Lokal:**
```powershell
# Dry-Run
.\scripts\content_release\sync_release.ps1 -ReleaseId release_20260106_2200 -LocalPath "C:\..." -ServerUser root -ServerHost games.hispanistica.com

# Real Upload
.\scripts\content_release\sync_release.ps1 -ReleaseId release_20260106_2200 -LocalPath "C:\..." -ServerUser root -ServerHost games.hispanistica.com -Execute
```

**Server:**
```bash
# Prepare
cd /srv/webapps/games_hispanistica/media
ln -sfn releases/release_20260106_2200 current
cd ../app

# Import (Draft)
python manage.py import-content --units-path media/current/units --audio-path media/current/audio --release release_20260106_2200

# Publish (Visible)
python manage.py publish-release --release release_20260106_2200

# Verify
python manage.py list-releases
```

---

---

## Quiz Content Management (Manuell – DEV-only)

> **⚠️ DEV-ONLY SECTION** – Diese Befehle sind NUR für lokale Entwicklung.
> In Production wird Content per rsync hochgeladen und über `./manage import-content`
> oder das Admin-Dashboard importiert.

### Quiz-Inhalte normalisieren

```powershell
python scripts/quiz_units_normalize.py --write
```

Generiert fehlende `id`-Felder (ULID-Format) und aktualisiert `questions_statistics`.

**Hinweis:** Content liegt unter `content/quiz/topics/`. Releases werden in `content/quiz_releases/` versioniert.

### Komplette Pipeline manuell ausführen

```powershell
# Soft prune (Standard: Topics ohne JSON → is_active=false)
python scripts/quiz_seed.py --prune-soft

# Hard prune (WARNUNG: Löscht Topics + Fragen permanent)
python scripts/quiz_seed.py --prune-hard
```

**Hinweis:** Player-Daten (Runs, Scores) werden nie gelöscht.

**Production-Alternative:**
```bash
# Production: Import via CLI (nach rsync-Upload)
./manage import-content --units-path media/current/units --audio-path media/current/audio --release 2026-01-06_1430
./manage publish-release --release 2026-01-06_1430
```

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
| `AUTH_DATABASE_URL` | `postgresql://hispanistica_auth:hispanistica_auth@localhost:54321/hispanistica_auth` |
| `QUIZ_DATABASE_URL` | `postgresql://hispanistica_quiz:hispanistica_quiz@localhost:54322/hispanistica_quiz` |
| `JWT_SECRET_KEY` | `dev-jwt-secret-change-me` |
| `FLASK_SECRET_KEY` | `dev-secret-change-me` |

> **Wichtig:** Quiz-Module benötigt PostgreSQL mit JSONB-Support (keine SQLite-Kompatibilität)

---

## Docker-Services (nur bei PostgreSQL-Modus)

Der Dev-Stack verwendet `docker-compose.dev-postgres.yml`:

| Service | Container | Port | Beschreibung |
|---------|-----------|------|-------------|
| PostgreSQL (Auth) | `hispanistica_auth_db` | `54321` | Auth-DB |
| PostgreSQL (Quiz) | `hispanistica_quiz_db` | `54322` | Quiz-DB |

```powershell
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
Invoke-WebRequest -Uri "http://localhost:<PORT>/health" -UseBasicParsing

# Auth DB Health
Invoke-WebRequest -Uri "http://localhost:<PORT>/health/auth" -UseBasicParsing
```

---


# Quiz Topics API
Invoke-WebRequest -Uri "http://localhost:<PORT>/api/quiz/topics" -UseBasicParsing
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
$env:AUTH_DATABASE_URL = "postgresql://hispanistica_auth:hispanistica_auth@localhost:54321/hispanistica_auth"
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
