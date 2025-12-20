---
title: "Quick Start (Windows)"
status: active
owner: devops
updated: "2025-11-21"
tags: [quickstart, windows, powershell, setup]
links:
  - ../operations/development-setup.md
  - ../troubleshooting/blacklab-issues.md
---

# Quick Start (Windows)

Diese Anleitung beschreibt den Schnellstart der Entwicklungsumgebung unter Windows mit PowerShell.

## Voraussetzungen

- **Docker Desktop** muss laufen (für BlackLab)
- **Python venv** aktiviert (`.venv`)
- **PowerShell** (Version 5.1 oder 7+)

## 1. BlackLab-Index aufbauen

**System nutzt BlackLab 5.x (Lucene 9) - stabile Produktivversion**

Nur notwendig beim ersten Setup oder nach einem Reset der Daten.

### Kompletter Workflow: JSON → TSV → Index

```powershell
# Vollautomatisch: JSON->TSV Export und Index-Build
.\LOKAL\01 - Add New Transcriptions\03b build blacklab_index\build_index.ps1
```

Oder **manuell in Einzelschritten**:

```powershell
# Schritt 1: JSON → TSV Export
python "LOKAL\01 - Add New Transcriptions\03b build blacklab_index\blacklab_index_creation.py"

# Schritt 2: TSV → Lucene Index (BlackLab 5.x)
.\scripts\blacklab\build_blacklab_index.ps1
```

Dieser Prozess:
- Exportiert 146 JSON-Dateien nach TSV (`data/blacklab_export/`)
- Baut Lucene-9-Index mit BlackLab 5.x im Docker-Container
- Dauert ca. 5-10 Minuten (~1.5M Tokens)
- Erstellt automatisch ein rotierendes Backup (`data/blacklab_index.backup/`)

**Mehr Details:** Siehe `../troubleshooting/blacklab-issues.md` (oder ehemals `blacklab-index-lucene-migration.md`)

## 2. BlackLab starten (Docker, BlackLab 5.x)

```powershell
.\scripts\start_blacklab_docker_v3.ps1 -Detach
```

Hinweis:
- Das Start-Skript wartet jetzt automatisch (bis zu 90 Sekunden), bis der BlackLab HTTP-Endpunkt antwortet.
- Wenn der Dienst nicht erreichbar ist, zeigt das Skript Container-Logs an.
- `-Detach` verhindert, dass der Container beim Beenden gelöscht wird (kein `--rm`).

**URL**: http://localhost:8081/blacklab-server

Tipp: Um BlackLab dauerhaft automatisch neugestartet zu lassen (z.B. nach einem Docker/Host-Reboot), verwenden Sie die `-Restart` Option.

## Siehe auch

- [Development Setup](../operations/development-setup.md)
- [Troubleshooting](../troubleshooting/blacklab-issues.md)

bei `start_blacklab_docker_v3.ps1`:

```powershell
.\scripts\start_blacklab_docker_v3.ps1 -Detach -Restart
```

Hinweis: Bei Verwendung von `-Detach -Restart` entfernt das Skript den Container nicht automatisch; dies ist bewusst so, um das Untersuchung von Container-Logs zu erleichtern.

## 3. Flask App starten

```powershell
.venv\Scripts\activate

$env:FLASK_ENV="development"; python -m src.app.main
```

**URL**: http://localhost:8000

## 4. Health Check

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/health/bls" -UseBasicParsing | Select-Object -ExpandProperty Content
```
### Combined Dev Start (BlackLab + Flask)

Use the helper script to start BlackLab (with optional restart policy) and the Flask dev server, then wait for `/health/bls`.

```powershell
# Start BLS (detached) with restart policy and start Flask; wait for /health/bls
.\scripts\dev-start.ps1 -Restart

# Start BLS only (skip Flask)
.\scripts\dev-start.ps1 -NoFlask

# Start Flask only (skip BLS)
.\scripts\dev-start.ps1 -NoBlackLab
```

The dev-start script will wait up to 120s for `/health/bls` to report `ok: true` and prints progress updates. If healthcheck fails, check Flask logs and the BlackLab container logs (see `docker logs --tail 100 blacklab-server-v3`).


Erwartung: `"ok": true` wenn BlackLab erreichbar ist.

## Passwords neu generieren

```powershell
python LOKAL\security\hash_passwords_v2.py
```

## Vite Dev Server (optional)

```powershell
npm run dev
```

