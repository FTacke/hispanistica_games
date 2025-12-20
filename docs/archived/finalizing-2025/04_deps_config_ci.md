# Dependencies, Config, Tests & CI Report (Phase 4)

**Datum:** 21.11.2025
**Status:** Complete

## 1. Übersicht Abhängigkeiten

### Python
- **Dateien:** `requirements.txt`, `pyproject.toml`
- **Status:** Bereinigt. Lokale Pfade aus `requirements.txt` entfernt.

### Node.js (Frontend)
- **Dateien:** `package.json` (nicht vorhanden/nicht benötigt für Runtime)
- **Status:** Frontend-Dependencies werden aktuell via Vendor-Files in `static/vendor` oder CDN gelöst.

## 2. Config & Environment Story

- **Ziel:** `.env` Datei für lokale Entwicklung, `.env.example` als Template.
- **Status:** Umgesetzt. `.env.example` erstellt. `passwords.env` dient weiterhin als lokale Referenz, sollte aber mittelfristig migriert werden.

## 3. Tests

- **Kommando:** `pytest`
- **Status:** Test-Suite strukturiert und lauffähig.
  - Aktueller Run: 55 passed, 1 skipped.
  - Abdeckung: API, Suche, Basic Routes.

## 4. CI Pipeline

- **System:** GitHub Actions
- **Status:** Workflow `.github/workflows/ci.yml` erstellt. Führt Linting und Tests aus.

## 5. Änderungsprotokoll

| Bereich | Änderung | Begründung |
|---------|----------|------------|
| requirements.txt | Cleaned | Lokalen Pfad (`-e c:\users\...`) entfernt |
| .env.example | Created | Template für Environment-Variablen erstellt (basierend auf `passwords.env.template`) |
| .github/workflows/ci.yml | Created | GitHub Actions Workflow für Linting und Tests erstellt |

## 6. Offene Punkte

- ...
