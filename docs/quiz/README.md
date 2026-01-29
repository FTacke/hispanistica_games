# Quiz System

**Ein Multiple-Choice-Quiz mit Timer, Joker-System und Leaderboard.**

---

## Was ist das Quiz-System?

Ein vollständiges Quiz-Spielmodul mit eigener Spieler-Authentifizierung (getrennt von Webapp-Usern), Punktesystem, Timer-Enforcement und Release-Management für Content.

**High-Level Flow:**

```
Content (JSON) → Normalisierung → Import → DB → Runtime → Spieler
                                      ↓
                              Release-Tracking
                              (Draft/Published)
```

---

## Kernbegriffe

| Begriff | Definition |
|---------|------------|
| **Unit** | Eine JSON-Datei mit einem Quiz-Topic (Titel + Fragen) |
| **Topic** | Ein thematisches Quiz (z.B. "Aussprache") |
| **Question** | Eine Frage mit 2-6 Antwortoptionen (genau 1 korrekt) |
| **Run** | Ein Durchlauf: 10 Fragen (5 Levels × 2 Fragen) |
| **Level** | Ein Schwierigkeitsgrad (1-5), je 2 Fragen |
| **Token** | Erfolgsmetrik (0-3 pro Level, max 15 pro Run) |
| **Joker** | 50:50 Hilfe (eliminiert 2 falsche Antworten, 2× pro Run) |
| **Release** | Versioniertes Content-Paket (Production) |
| **Leaderboard** | Top 30 Scores pro Topic |

---

## Dokumentations-Set

**Vier Dateien. Keine Überschneidungen.**

| Datei | Verantwortlich für |
|-------|-------------------|
| **[README.md](README.md)** | Überblick (diese Datei) |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System-Design, Mechanik-Invarianten, Breakpoints |
| **[CONTENT.md](CONTENT.md)** | JSON-Schema, Content-Authoring, Validierung |
| **[OPERATIONS.md](OPERATIONS.md)** | DEV/Prod Workflows, Import/Publish, Rollback |

**Quick-Start:**
- Content erstellen (DEV) → [OPERATIONS.md#dev-workflow](OPERATIONS.md#dev-workflow)
- Production-Deploy → [OPERATIONS.md#production-workflow](OPERATIONS.md#production-workflow)
- Mechanik ändern → [ARCHITECTURE.md#mechanic-change-safety](ARCHITECTURE.md#mechanic-change-safety)
- JSON-Schema → [CONTENT.md](CONTENT.md)

---

## System-Überblick

### Verantwortlichkeiten

1. **Player Auth** – Pseudonym + 4-Digit-PIN (separate from webapp)
2. **Run Management** – Start/Resume/Restart/Finish
3. **Question Selection** – Weighted randomization (history-based)
4. **Timer** – 30s per question (server-enforced)
5. **Joker** – 50:50 (2× per run)
6. **Scoring** – Difficulty-based points + tokens
7. **Leaderboard** – Top 30 per topic

### Komponenten

**Backend:**
- `game_modules/quiz/models.py` – ORM (PostgreSQL-only)
- `game_modules/quiz/services.py` – Business logic
- `game_modules/quiz/routes.py` – API endpoints
- `game_modules/quiz/validation.py` – JSON schema validation
- `game_modules/quiz/import_service.py` – Production import
- `game_modules/quiz/seed.py` – DEV seeding

**Frontend:**
- `templates/games/quiz/` – Jinja2 templates
- `static/js/games/quiz-play.js` – State machine (QUESTION/LEVEL_UP/FINISH)
- `static/css/games/quiz.css` – Styles (Material Design 3)

**Content:**
- `content/quiz/topics/*.json` – DEV source
- `media/releases/<release_id>/units/*.json` – Production source

---

## Game-Regeln (Kurzfassung)

**Run:** 10 Fragen (5 Levels × 2)  
**Timer:** 30 Sekunden pro Frage  
**Joker:** 2× pro Run (50:50)

**Scoring:**
- Base Points: `difficulty × 10` (10/20/30/40/50)
- Time Bonus: Schneller = mehr Punkte
- Tokens: 0-3 pro Level (beide korrekt = 3, eine korrekt = 2, Joker genutzt = max 1)

**Leaderboard:** 
- Sort: `total_score DESC`, dann `created_at ASC` (ältester Eintrag gewinnt Ties)
- Limit: Top 30
- Filter: Keine anonymen Spieler

**Details:** [ARCHITECTURE.md#game-mechanics](ARCHITECTURE.md#game-mechanics)

---

## API (Kurzfassung)

**Public:**
- `GET /games/quiz` – Topic-Auswahl
- `GET /games/quiz/<topic_id>` – Login/Resume
- `POST /api/quiz/<topic_id>/run/start` – Run starten
- `POST /api/quiz/run/<run_id>/answer` – Antwort submitten
- `POST /api/quiz/run/<run_id>/joker` – Joker verwenden
- `POST /api/quiz/run/<run_id>/finish` – Run beenden

**Admin (JWT + ADMIN Role):**
- `POST /quiz-admin/api/releases/<id>/import` – Release importieren
- `POST /quiz-admin/api/releases/<id>/publish` – Release publishen

**Details:** [ARCHITECTURE.md#api-contracts](ARCHITECTURE.md#api-contracts)

---

## Content-Format

**JSON (quiz_unit_v2)** – Plaintext, keine i18n-Keys

**Details:** Vollständiges Schema, Validierung und Authoring-Guidelines in [CONTENT.md](CONTENT.md)

---

## Workflows (Kurzfassung)

**DEV:**
```bash
# Edit JSON
notepad content/quiz/topics/my_topic.json

# Normalize + Seed
python scripts/quiz_seed.py

# Test
http://localhost:5000/games/quiz
```

**Production:**
```bash
# Normalize lokal
python scripts/quiz_units_normalize.py --write --topics-dir <path>

# Upload
rsync <local> server:/media/releases/<release_id>/

# Import
./manage import-content --release <release_id>

# Publish
./manage publish-release --release <release_id>
```

**Details:** [OPERATIONS.md](OPERATIONS.md)

---

## Database (PostgreSQL-only)

| Table | Purpose |
|-------|---------|
| `quiz_players` | Player accounts (UUID, name, PIN hash) |
| `quiz_sessions` | Session tokens (30-day expiry) |
| `quiz_topics` | Topic definitions (slug, title, active) |
| `quiz_questions` | Question bank (ULID IDs, JSONB answers) |
| `quiz_runs` | Run state (JSONB run_questions) |
| `quiz_run_answers` | Answer records |
| `quiz_scores` | Leaderboard entries (topic_id, score, tokens) |
| `quiz_content_releases` | Release tracking (draft/published) |

**Details:** [ARCHITECTURE.md#database-schema](ARCHITECTURE.md#database-schema)

---

## Wichtige Invarianten

**Niemals brechen:**
1. Run hat exakt 10 Fragen (5 Levels × 2)
2. Genau 1 korrekte Antwort pro Frage
3. Timer server-seitig validiert (Client-Timer nur UI)
4. Leaderboard-Sortierung: score DESC, created_at ASC
5. Nur eine Published Release gleichzeitig

**Details:** [ARCHITECTURE.md#invariants](ARCHITECTURE.md#invariants)
