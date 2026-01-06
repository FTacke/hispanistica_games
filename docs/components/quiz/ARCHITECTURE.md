# Quiz Gold Standard – Architektur & Anpassung

> **⚠️ Content-Workflow-Hinweis:**
> Die in diesem Dokument beschriebenen `quiz_seed.py`-Befehle sind **DEV-only**.
> In Production wird Content per rsync hochgeladen und über `./manage import-content`
> oder das Admin-Dashboard importiert.
> Siehe: [games_hispanistica_production.md](../../../games_hispanistica_production.md)

Dieses Dokument beschreibt die "Gold Standard" Implementierung des Quiz-Moduls.

## Architektur

Das Quiz-Modul folgt einer strikten Trennung von Backend-Logik und Frontend-Präsentation.

### Backend (`game_modules/quiz`)
*   **Services (`services.py`)**: Enthält die gesamte Geschäftslogik (Scoring, Run-Lifecycle, Leaderboard).
*   **Routes (`routes.py`)**: Exponiert API-Endpoints und rendert Templates.
*   **Models (`models.py`)**: SQLAlchemy-Modelle für Persistenz.

### Frontend (`static/js/games/quiz-play.js`)
Das Frontend implementiert eine State Machine mit folgenden Views:
1.  **QUESTION**: Zeigt die aktuelle Frage an.
2.  **LEVEL_UP**: Eine Zwischenseite, die nach Abschluss eines Levels (alle 2 Fragen) angezeigt wird. Hier werden Bonus-Punkte visuell "applied".
3.  **FINISH**: Die Endseite mit Zusammenfassung und Leaderboard-Platzierung.

### Design System (MD3)
Das Design nutzt Material Design 3 Tokens (`static/css/md3/tokens.css`) und spezifische Quiz-Styles (`static/css/games/quiz.css`).

## Konfiguration & Anpassung

### Level-Größe & Scoring
Die Logik für Level-Größe und Punkte ist in `services.py` definiert:
*   `QUESTIONS_PER_DIFFICULTY = 2` (Fragen pro Level)
*   `POINTS_PER_DIFFICULTY` (Punkte pro Frage je nach Schwierigkeit)
*   `TIMER_SECONDS = 30` (Zeit pro Frage)

### Content-Format (aktualisiert 2026-01)

**Aktuell:** JSON-Format (quiz_unit_v1/v2 schema) in `quiz_units/topics/`
- Plaintext-Inhalte (direkt in JSON, keine i18n-Keys)
- ULID-basierte Question-IDs (auto-generiert via `quiz_units_normalize.py`)
- Media-Support mit `seed_src` (lokale Dateien) oder `src` (URLs)

**DEV-Workflow:**
1. JSON-Datei in `content/quiz/topics/<slug>.json` erstellen/bearbeiten
2. Normalisieren: `python scripts/quiz_units_normalize.py --write`
3. Importieren: `python scripts/quiz_seed.py --prune-soft`

**Production-Workflow:**
1. Content als Release vorbereiten (außerhalb Repo): `C:\content\games_hispanistica\2026-01-06_1430\`
2. Upload: `rsync -avz <local_path> user@server:/srv/webapps/games_hispanistica/media/releases/<release_id>/`
3. Symlink: `ln -sfn releases/<release_id> media/current`
4. Import: `./manage import-content --release <release_id>`
5. Publish: `./manage publish-release --release <release_id>`

Siehe: [games_hispanistica_production.md](../../../games_hispanistica_production.md) für Details.

**Legacy:** YAML-Format mit i18n-Keys (deprecated, nicht mehr verwendet)

### Neues Quiz-Topic hinzufügen (DEV)
1.  JSON-Datei in `content/quiz/topics/` erstellen (siehe Template unter `content/quiz/topics/`)
2.  Normalisieren und importieren (siehe Content-Format oben)
3.  Das Frontend (`/quiz/<topic_id>`) lädt automatisch das Topic

## Wichtige Implementierungsdetails

### Bonus-Punkte
*   **Backend**: Berechnet Bonus sofort und speichert ihn in `running_score`.
*   **Frontend**: Zeigt im HUD während des Levels nur die Punkte *ohne* Bonus an.
*   **Level-Up Screen**: Zeigt den Bonus explizit an und animiert den HUD-Score auf den vollen Wert (`running_score`).

### Idempotenz
Der `/finish` Endpoint ist idempotent. Mehrfache Aufrufe geben das Ergebnis des ersten erfolgreichen Abschlusses zurück, ohne die Datenbank zu korrumpieren.

### Leaderboard
Sortierung: `total_score DESC`, `created_at ASC` (wer zuerst die Punktzahl erreicht hat, steht oben).
