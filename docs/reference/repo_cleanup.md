# Repository Cleanup Summary

**Datum:** 2025-11-26  
**Branch:** feature/auth-migration

## Durchgeführte Änderungen

### 1. Entfernte Legacy-Dateien

| Datei | Grund |
|-------|-------|
| `static/js/turbo.esm.js` | Turbo wurde durch htmx ersetzt (siehe `docs/migration/turbo-to-htmx-*`) |
| `static/js/app.js` | Legacy Turbo-Adapter, nicht mehr verwendet |
| `static/js/test-transcript-fetch.js` | Debug-Skript für Konsolen-Tests |
| `build.log` | Leere Build-Log-Datei im Root |

### 2. Ins Archiv verschobene Dateien

| Quelle | Ziel | Grund |
|--------|------|-------|
| `static/css/md3/MIGRATE_CSS.md` | `docs/md3/90_archive/css-migration/` | Migrations-Doku abgeschlossen |
| `docs/md3-template/md3_lint_report_auto.md` | `docs/md3/90_archive/` | Fehlplatzierter Auto-Report |
| `docs/finalizing/` | `docs/archived/finalizing-2025/` | Historische Audit-Dokumente |
| `docs/reports/` | `docs/archived/reports-2025/` | Historische Reports (2025-11) |
| `docs/auth-migration/` | `docs/archived/auth-migration/` | Auth-Migration abgeschlossen |
| `docs/migration/turbo-to-htmx-*` | `docs/archived/migration/` | htmx-Migration abgeschlossen |

### 3. Entfernte leere Ordner

- `scripts/admin/`
- `scripts/analysis/`
- `scripts/design/`
- `docs/md3-template/`

### 4. Aktualisierte `.gitignore`

Neue Einträge:
- `tests/e2e/playwright-results/` - Playwright Test-Outputs (unter tests/e2e/)
- `tests/e2e/playwright-report/` - Playwright HTML-Reports (unter tests/e2e/)
- `test-results/` - Legacy Playwright Test-Outputs (Root, für Abwärtskompatibilität)
- `playwright-report/` - Legacy Playwright Reports
- `reports/*.json` - Generierte Lint-Reports (temporär)
- `build.log` - Build-Logs
- `auth.db` - Root-Level Dev-Datenbank (Legacy, nicht mehr verwendet)
- `opt/` - Lokale Binaries/Tools (z.B. blacklab-server.war)
- `LOKAL/` - Lokale Workflow-Ordner (separates Git-Repo)

### 5. Harmonisierte DB-Pfade

Die PowerShell-Skripte und `startme.md` wurden aktualisiert, um konsistent `data/db/auth.db` zu verwenden:
- `scripts/dev-setup.ps1` - Default-DbPath geändert
- `scripts/dev-start.ps1` - Default-DbPath geändert
- `startme.md` - Alle Befehle aktualisiert
- Root-`auth.db` aus Git-Index entfernt (war Legacy aus alter Konvention)

### 6. Root-Cleanup (2025-11-28)

Entfernte Root-Ordner:
- `reports/` - Generierte Lint-JSONs (temporär, können jederzeit neu erzeugt werden)
- `test-results/` - Playwright-Outputs (jetzt unter `tests/e2e/playwright-results/`)

Diese Ordner waren bereits gitignored und enthielten nur temporäre, regenerierbare Dateien.

## Archivstruktur

```
docs/
├── archived/                    # Historische Dokumente
│   ├── auth-migration/          # Auth-Migration 2025
│   ├── finalizing-2025/         # Audit & Cleanup Logs
│   ├── migration/               # Abgeschlossene Migrationen (Turbo→htmx)
│   ├── reports-2025/            # Historische Reports
│   └── *.md                     # Einzelne archivierte Dokumente
├── md3/
│   ├── 00_overview.md           # MD3 Einstieg
│   ├── 10_md3_spec_core.md      # Core Specification
│   ├── 20_app_spec_corapan.md   # App-spezifische Patterns
│   ├── 30_patterns_and_skeletons.md
│   ├── 40_tooling_and_ci.md
│   └── 90_archive/              # MD3-spezifisches Archiv
│       ├── css-migration/
│       └── *.md
└── ...
```

## Richtlinien für zukünftige Änderungen

### Neue Dokumentation

| Typ | Zielort |
|-----|---------|
| MD3 Core Spec | `docs/md3/10_md3_spec_core.md` |
| App-spezifische Patterns | `docs/md3/20_app_spec_corapan.md` |
| Skeletons/Templates | `docs/md3/30_patterns_and_skeletons.md` |
| Tooling/CI | `docs/md3/40_tooling_and_ci.md` |
| How-To Guides | `docs/how-to/` |
| Konzepte/Architektur | `docs/concepts/` |
| Referenz-Dokumentation | `docs/reference/` |
| Troubleshooting | `docs/troubleshooting/` |
| Operations/Deployment | `docs/operations/` |

### Neue Skripte

- Alle Skripte unter `scripts/` mit kurzer Beschreibung in Header
- Einmal-Migrationen nach Abschluss archivieren oder löschen
- CI-relevante Skripte in `.github/workflows/` referenzieren

### Neue Templates

- MD3-Spec + Skeletons befolgen (`docs/md3/30_patterns_and_skeletons.md`)
- Neue Skeletons in `templates/_md3_skeletons/` ablegen
- Bei Abweichungen vom Standard dokumentieren

## Validierung

Nach dem Cleanup:
- [x] App startet lokal (`python -m flask run`)
- [x] MD3-Lint läuft (`python scripts/md3-lint.py`)
- [x] Auth-Guard läuft (`python scripts/md3-forms-auth-guard.py`)
- [x] Keine Template-NotFound-Fehler
- [x] .gitignore ignoriert alle genannten Dateien
