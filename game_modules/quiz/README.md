# Quiz Game Module

Das Quiz-Modul für hispanistica_games bietet ein interaktives Multiple-Choice-Quiz mit den folgenden Features:

## Features

- **5 Schwierigkeitsstufen** (je 2 Fragen pro Run = 10 Fragen)
- **30-Sekunden-Timer** pro Frage mit serverseitiger Deadline-Validierung
- **50:50-Joker** (1× pro Run, eliminiert 2 falsche Antworten)
- **Spieler-Authentifizierung** (Pseudonym + 4-stellige PIN oder anonym)
- **Resume-Funktion** (unterbrochene Runs fortsetzen)
- **Leaderboard** (Top 15, sortiert nach Score)
- **Token-System** (3/2/1/0 Tokens je nach Erfolg)

## Installation

### 1. Abhängigkeiten

Stelle sicher, dass `PyYAML` installiert ist:

```bash
pip install PyYAML>=6.0
```

### 2. Datenbank initialisieren

```bash
python scripts/init_quiz_db.py
```

Dies erstellt alle Quiz-Tabellen und lädt das Demo-Topic.

### 3. Entwicklungsserver starten

```bash
flask run
```

Das Quiz ist erreichbar unter: `http://localhost:5000/games/quiz`

## Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `QUIZ_ADMIN_KEY` | API-Key für Admin-Import (optional) | - |

## Dateistruktur

```
game_modules/quiz/
├── __init__.py           # Module entry point
├── manifest.json         # Module metadata
├── models.py             # SQLAlchemy ORM models
├── services.py           # Business logic
├── routes.py             # Flask routes (pages + API)
├── validation.py         # Content validation
├── seed.py               # Database seeding
├── content/
│   ├── topics/           # Topic YAML files
│   │   └── demo_topic.yml
│   └── i18n/             # Translations
│       └── de.yml
├── styles/
│   └── quiz.css          # Scoped CSS styles
└── templates/            # Jinja2 templates (in templates/games/quiz/)
```

## API-Endpunkte

### Seiten (öffentlich)

| Route | Beschreibung |
|-------|--------------|
| `GET /games/quiz` | Topic-Auswahl |
| `GET /games/quiz/<topic_id>` | Topic-Einstieg (Login/Resume) |
| `GET /games/quiz/<topic_id>/play` | Quiz-Gameplay |

### API

#### Authentifizierung

| Route | Method | Beschreibung |
|-------|--------|--------------|
| `/api/quiz/auth/register` | POST | Spieler registrieren |
| `/api/quiz/auth/login` | POST | Spieler einloggen |
| `/api/quiz/auth/logout` | POST | Session beenden |

#### Topics

| Route | Method | Beschreibung |
|-------|--------|--------------|
| `/api/quiz/topics` | GET | Alle aktiven Topics |
| `/api/quiz/topics/<id>/leaderboard` | GET | Leaderboard für Topic |

#### Runs

| Route | Method | Beschreibung |
|-------|--------|--------------|
| `/api/quiz/<topic_id>/run/start` | POST | Run starten/fortsetzen |
| `/api/quiz/<topic_id>/run/restart` | POST | Run neu starten |
| `/api/quiz/run/current` | GET | Aktuellen Run-Status |
| `/api/quiz/run/<id>/question/start` | POST | Frage-Timer starten |
| `/api/quiz/run/<id>/answer` | POST | Antwort abgeben |
| `/api/quiz/run/<id>/joker` | POST | Joker verwenden |
| `/api/quiz/run/<id>/finish` | POST | Run beenden |

#### Admin

| Route | Method | Beschreibung |
|-------|--------|--------------|
| `/api/admin/quiz/import` | POST | Topic-Content importieren |

## Topic-Format (YAML)

```yaml
topic_id: my_topic
title_key: topics.my_topic.title
description_key: topics.my_topic.description
is_active: true

questions:
  - id: q1
    difficulty: 1
    type: single_choice
    prompt_key: questions.q1.prompt
    explanation_key: questions.q1.explanation
    answers:
      - text_key: questions.q1.a1
        is_correct: true
      - text_key: questions.q1.a2
        is_correct: false
      - text_key: questions.q1.a3
        is_correct: false
      - text_key: questions.q1.a4
        is_correct: false
```

## Scoring

### Punkte pro Schwierigkeit

| Difficulty | Basis-Punkte |
|------------|--------------|
| 1 | 10 |
| 2 | 20 |
| 3 | 30 |
| 4 | 40 |
| 5 | 50 |

### Token-Berechnung

| Ergebnis | Tokens |
|----------|--------|
| 10/10 richtig | 3 |
| 7-9/10 richtig | 2 |
| 5-6/10 richtig | 1 |
| <5/10 richtig | 0 |

### Joker-Effekt

Bei Verwendung des Jokers wird die Punktzahl für die betreffende Frage halbiert.

## Tests ausführen

```bash
pytest tests/test_quiz_module.py -v
```

## Admin-Import

Content kann über die Admin-API importiert werden:

```bash
curl -X POST \
  -H "X-Admin-Key: $QUIZ_ADMIN_KEY" \
  -F "file=@my_topic.yml" \
  -F "mode=upsert" \
  http://localhost:5000/api/admin/quiz/import
```

Modi:
- `upsert`: Bestehende Fragen aktualisieren, neue hinzufügen
- `replace`: Alle bestehenden Fragen löschen und durch neue ersetzen

## Architektur

Das Quiz-Modul folgt der Game-Module-Architektur der hispanistica_games-Plattform:

1. **Eigene Datenbank-Tabellen** (Präfix `quiz_`)
2. **Eigene Authentifizierung** (Cookie `quiz_session`, unabhängig von Webapp-Auth)
3. **Scoped CSS** (`.game-shell[data-game="quiz"]`)
4. **i18n über String-Keys** (Frontend-seitig aufgelöst)

## Troubleshooting

### "Topic not found"
- Prüfen ob `scripts/init_quiz_db.py` erfolgreich ausgeführt wurde
- Prüfen ob das Topic `is_active: true` hat

### "Session expired"
- Cookie `quiz_session` ist nach 30 Tagen abgelaufen
- Erneut einloggen oder als anonym spielen

### "Joker already used"
- Joker kann nur 1× pro Run verwendet werden
- Bei Resume ist Joker-Status erhalten
