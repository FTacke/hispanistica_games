---
title: "Migration auf neuen Windows-PC"
status: active
owner: backend-team
updated: "2026-02-12"
tags: [migration, windows, setup, data]
links:
  - README.md
  - .env.example
  - scripts/bootstrap.ps1
  - startme.md
---

# Migration auf neuen Windows-PC

Diese Datei beschreibt, welche großen/generierten Ordner **nicht** aus Git rekonstruiert werden und wie sie beim Rechnerwechsel zu behandeln sind.

## Manuell migrieren

- `media/releases/` – produktive Release-Snapshots (Units + Audio), nicht regenerierbar aus Code.
- `media/current/` – aktive Release-Struktur/Symlink-Ziel auf dem System.
- `content/quiz_releases/<release-id>/` – lokale Release-Pakete außerhalb des regulären Quellstands.

## Regenerierbar

- `data/db/` – lokale Dev-Datenbanken, per Setup-Skripten neu anlegbar.
- `data/import_logs/` – Import-/Publish-Logs, nicht für Funktionsfähigkeit erforderlich.
- `logs/` – Laufzeitlogs, werden neu erzeugt.

## Empfohlener externer Pfad (Windows)

Große Inhalte außerhalb des Repo halten, z. B.:

- `C:\dev\games.hispanistica\media\releases\`
- `C:\dev\games.hispanistica\data\`
- `C:\dev\games.hispanistica\logs\`

Empfohlenes lokales Modell:

```text
C:\dev\games.hispanistica\
├── app\
├── config\
├── data\
├── logs\
└── media\
```

Anschließend über bestehende Release-/Deploy-Skripte synchronisieren.

## Git-Regel

Diese Inhalte bleiben gitignored. Es werden nur Platzhalter/README-Dateien versioniert, keine Nutzdaten.

## Siehe auch

- [README.md](README.md)
- [.env.example](.env.example)
- [scripts/bootstrap.ps1](scripts/bootstrap.ps1)
- [startme.md](startme.md)
