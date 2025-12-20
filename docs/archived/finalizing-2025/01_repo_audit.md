# Repository Audit Report (Phase 1)

**Datum:** 21.11.2025
**Status:** Initial Audit

## 1. Projektüberblick

- **Typ:** Webanwendung (Flask Backend + Jinja2 Templates + Vanilla JS/CSS)
- **Zweck:** Korpusanalyse-Plattform (CO.RA.PAN)
- **Kern-Technologien:**
  - Python 3.12 (Flask, Gunicorn)
  - BlackLab Server (Suchmaschine, via Proxy angebunden)
  - Docker & Docker Compose (Deployment)
  - PowerShell & Bash Scripts (Automatisierung)

## 2. Verzeichnisstruktur (Ist-Zustand)

- `src/app/`: Hauptanwendungscode (Flask Blueprints, Views)
- `static/`: Frontend-Assets (CSS, JS, Fonts, Images)
- `templates/`: Jinja2 HTML-Templates
- `config/`: Konfigurationsdateien (BlackLab, Keys)
- `data/`: Persistente Daten (DB, Indizes, Exporte)
- `docs/`: Projektdokumentation
- `scripts/`: Hilfsskripte für Build, Deploy, Maintenance
- `tests/`: Test-Suite (Pytest)
- `LOKAL/`: Lokale Arbeitsdateien (vermutlich nicht für Repo gedacht)
- `media/`: Mediendateien (MP3s, Transkripte) - teils read-only gemountet

## 3. Mögliche Legacy- und Müll-Kandidaten

| Pfad/Pattern | Art | Risiko | Empfohlene Prüfung |
|--------------|-----|--------|--------------------|
| `LOKAL/` | Lokale Arbeitsordner | Niedrig | Inhalt prüfen, Relevantes nach `docs/` oder `scripts/` migrieren, Rest löschen. |
| `backup.sh` | Shell Script | Mittel | Prüfen, ob durch `scripts/` oder CI ersetzt. |
| `update.sh` | Shell Script | Mittel | Prüfen, ob noch aktuell für Deployment. |
| `startme.md` | Doku | Niedrig | Wahrscheinlich redundant zu `README.md`. |
| `tools/` | Ordner | Mittel | Inhalt prüfen. Oft Ort für One-Off-Skripte. |
| `scripts/debug/` | Ordner | Niedrig | Debug-Skripte, evtl. nicht mehr benötigt. |
| `docs/split_mp3/` | Doku-Ordner | Niedrig | Scheint spezifisch für einen Task zu sein. Integrieren oder Archivieren. |
| `docs/mapping_new/` | Doku-Ordner | Niedrig | Veraltete Planung? Prüfen. |
| `requirements.txt` | Dependency | Hoch | Enthält lokalen Pfad (`-e c:\users\...`). Muss bereinigt werden. |

## 4. Konfiguration & Environment

- **Env-Files:** `passwords.env`, `passwords.env.template`.
- **Config-Files:** `config/blacklab/`, `config/keys/`.
- **Empfehlung:** Vereinheitlichung auf `.env` für Secrets und Umgebungsvariablen (via `python-dotenv`). `passwords.env` ist ein ungewöhnlicher Name.

## 5. Dependencies & Build

- **Python:** `requirements.txt` und `pyproject.toml` vorhanden. `requirements.txt` enthält absolute lokale Pfade (Bad Practice).
- **Docker:** `Dockerfile` (Multi-Stage) und `docker-compose.yml` vorhanden. Wirken solide.
- **Auffälligkeiten:** `requirements.txt` sollte aus `pyproject.toml` oder via `uv`/`poetry` generiert werden, um sauber zu sein.

## 6. Tests & CI

- **Tests:** `tests/` Ordner vorhanden mit diversen Test-Dateien (`test_*.py`).
- **CI:** `.github/` Ordner existiert (Inhalt noch nicht geprüft).
- **Bewertung:** Grundstruktur für Tests ist da. Muss in Phase 3/4 auf Lauffähigkeit geprüft werden.

## 7. Risiken & offene Fragen

- **Lokale Pfade in `requirements.txt`:** Das Deployment wird fehlschlagen, wenn dies nicht korrigiert wird.
  - *Empfehlung:* `requirements.txt` bereinigen.
- **`LOKAL/` Ordner im Git:** Sollte vermutlich nicht im Repo sein.
  - *Empfehlung:* Prüfen, ob Secrets enthalten sind, dann entfernen und in `.gitignore`.
- **Skript-Wildwuchs:** Mix aus `.sh`, `.ps1`, `.py` in Root und `scripts/`.
  - *Empfehlung:* Konsolidieren nach `scripts/` und Dokumentieren in `docs/operations/`.

## 8. Dokumentations-Cleanup (Phase 1)

*Dieser Abschnitt dokumentiert die durchgeführten Aufräumarbeiten.*

- **Verschoben/Archiviert:**
  - `cleanup-templates.md` → `docs/archived/report_cleanup_templates_2025.md`
  - `TEST_SCRIPTS_CLEANUP_PLAN.md` → `docs/finalizing/02_test_cleanup_plan.md`
  - `docs/mapping_new/BLACKLAB_CLEANUP_2025-11-16.md` → `docs/archived/report_blacklab_cleanup_2025-11-16.md`
  - `docs/mapping_new/mapping_new_pipeline_status.md` → `docs/archived/status_mapping_pipeline_2025.md`
  - `docs/mapping_new/mapping_new_plan.md` → `docs/archived/plan_mapping_new_2025.md`
- **Konsolidiert & Integriert:**
  - `startme.md` → `docs/how-to/quickstart-windows.md` (Inhalt aktualisiert und formatiert)
  - `docs/split_mp3/audio_play.md` → `docs/concepts/audio-playback.md`
  - `docs/mapping_new/e2e_testing_guide.md` → `docs/how-to/e2e-testing.md`
- **Gelöscht:**
  - Ordner `docs/split_mp3/` und `docs/mapping_new/` (nach Migration der Inhalte).
- **Aktualisiert:**
  - `README.md`: Link zu Quickstart angepasst.
  - `docs/index.md`: Neue Links aufgenommen.
- **Neu:**
  - `docs/finalizing/01_repo_audit.md` (dieser Bericht).

## 9. Geplanter weiterer Ablauf (Phase 2–4)

### Phase 2: Struktur-Cleanup (Branch: `chore/cleanup-structure`)
- **Ziel:** Entfernen von `LOKAL/`, `backup.sh`, `tools/` (nach Prüfung).
- **Tools:** Manuelle Prüfung, `git rm`.
- **Schutz:** Review vor Merge.

### Phase 3: Code-Quality & Dead Code (Branch: `refactor/code-quality`)
- **Ziel:** Linter-Setup, ungenutzte Imports/Funktionen entfernen.

## 10. Nachtrag (21.11.2025)

Die geplanten Phasen 2–4 wurden erfolgreich umgesetzt.
- Die Details zur Bereinigung finden sich in `docs/finalizing/02_cleanup_log.md`.
- Maßnahmen zur Code-Qualität sind in `docs/finalizing/03_code_quality.md` dokumentiert.
- Abhängigkeiten, Konfiguration und CI-Status sind in `docs/finalizing/04_deps_config_ci.md` festgehalten.
- Der finale Statusbericht liegt unter `docs/finalizing/05_final_status.md`.
- **Tools:** `ruff` (Linting/Formatting), `vulture` (Dead Code).
- **Schutz:** Tests müssen pass (sofern lauffähig).

### Phase 4: Stabilisierung (Branch: `fix/stabilization`)
- **Ziel:** Dependencies fixen (`requirements.txt`), Tests zum Laufen bringen, CI härten.
- **Tools:** `pytest`, `pip-audit`.
- **Schutz:** Erfolgreicher CI-Run.
