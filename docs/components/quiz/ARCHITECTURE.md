# Quiz Component – Architecture

> **⚠️ WICHTIG: DEV vs Production**  
> Dieses Dokument beschreibt die Architektur und Mechaniken des Quiz-Moduls.  
> **Content-Workflows sind in [OPERATIONS.md](OPERATIONS.md) dokumentiert.**  
> - **DEV:** `scripts/quiz_seed.py` (direkter DB-Zugriff)  
> - **Production:** `./manage import-content` oder Admin Dashboard (Release-basiert)

Dieses Dokument beschreibt die technische Architektur und Spielmechanik des Quiz-Moduls.

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

**Aktuell:** JSON-Format (quiz_unit_v1/v2 schema) in `content/quiz/topics/` (DEV) oder `media/releases/<release_id>/units/` (Production)
- Plaintext-Inhalte (direkt in JSON, keine i18n-Keys)
- ULID-basierte Question-IDs (auto-generiert via `quiz_units_normalize.py`)
- Media-Support mit `seed_src` (lokale Dateien) oder `src` (URLs)

**Siehe:** [CONTENT.md](CONTENT.md) für vollständige Schema-Dokumentation  
**Siehe:** [OPERATIONS.md](OPERATIONS.md) für DEV vs Production Workflows

**Legacy:** YAML-Format mit i18n-Keys (deprecated, nicht mehr verwendet)

### Neues Quiz-Topic hinzufügen

**DEV:**  
Siehe [OPERATIONS.md - Add New Topic](OPERATIONS.md#add-new-topic)

**Production:**  
Siehe [OPERATIONS.md - Production Workflow](OPERATIONS.md#production-workflow)

## Wichtige Implementierungsdetails

### Bonus-Punkte
*   **Backend**: Berechnet Bonus sofort und speichert ihn in `running_score`.
*   **Frontend**: Zeigt im HUD während des Levels nur die Punkte *ohne* Bonus an.
*   **Level-Up Screen**: Zeigt den Bonus explizit an und animiert den HUD-Score auf den vollen Wert (`running_score`).

### Idempotenz
Der `/finish` Endpoint ist idempotent. Mehrfache Aufrufe geben das Ergebnis des ersten erfolgreichen Abschlusses zurück, ohne die Datenbank zu korrumpieren.

### Leaderboard
Sortierung: `total_score DESC`, `created_at ASC` (wer zuerst die Punktzahl erreicht hat, steht oben).
