# Quiz Gold Standard – Architektur & Anpassung

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

### Neues Quiz-Topic hinzufügen
1.  Eintrag in `QuizTopic` Tabelle (via Admin oder Seed-Skript).
2.  Fragen in `QuizQuestion` Tabelle importieren.
3.  Das Frontend (`/quiz/<topic_id>`) lädt automatisch das konfiguriert Topic.

## Wichtige Implementierungsdetails

### Bonus-Punkte
*   **Backend**: Berechnet Bonus sofort und speichert ihn in `running_score`.
*   **Frontend**: Zeigt im HUD während des Levels nur die Punkte *ohne* Bonus an.
*   **Level-Up Screen**: Zeigt den Bonus explizit an und animiert den HUD-Score auf den vollen Wert (`running_score`).

### Idempotenz
Der `/finish` Endpoint ist idempotent. Mehrfache Aufrufe geben das Ergebnis des ersten erfolgreichen Abschlusses zurück, ohne die Datenbank zu korrumpieren.

### Leaderboard
Sortierung: `total_score DESC`, `created_at ASC` (wer zuerst die Punktzahl erreicht hat, steht oben).
