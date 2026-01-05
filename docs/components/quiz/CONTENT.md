# Quiz Units – Content Management

**Zweck:** Dieser Ordner enthält alle Quiz-Inhalte als strukturierte JSON-Dateien. Jede JSON-Datei ist eine eigenständige "Quiz-Unit" mit Titel, Beschreibung, Autor:innen und Fragen.

## Struktur

```
quiz_units/
├── README.md          # Diese Datei
└── topics/
    ├── variation_in_der_aussprache.json
    ├── grammar_basics.json
    └── ...
```

**1 JSON-Datei = 1 Quiz-Thema**

---

## JSON-Schema (quiz_unit_v1)

Jede Unit-Datei muss diesem Schema folgen:

```json
{
  "schema_version": "quiz_unit_v1",
  "slug": "my_topic",
  "title": "Mein Quiz-Titel",
  "description": "Eine kurze Beschreibung (3-6 Sätze) über den Inhalt dieses Quiz.",
  "authors": ["AB", "CD"],
  "is_active": true,
  "order_index": 0,
  "questions": [
    {
      "id": "my_topic_q01",
      "difficulty": 1,
      "type": "single_choice",
      "prompt": "Was ist die richtige Antwort?",
      "explanation": "Dies ist die Erklärung nach der Antwort.",
      "answers": [
        {"id": "a1", "text": "Richtige Antwort", "correct": true},
        {"id": "a2", "text": "Falsche Antwort 1", "correct": false},
        {"id": "a3", "text": "Falsche Antwort 2", "correct": false},
        {"id": "a4", "text": "Falsche Antwort 3", "correct": false}
      ],
      "media": null,
      "sources": [{"type": "book", "title": "Quelle XYZ"}],
      "meta": {}
    }
  ]
}
```

### Pflichtfelder (Root-Level)

| Feld              | Typ       | Beschreibung                                                      |
|-------------------|-----------|-------------------------------------------------------------------|
| `schema_version`  | string    | Muss `"quiz_unit_v1"` sein                                        |
| `slug`            | string    | Eindeutiger Identifier (lowercase, `[a-z0-9_]+`)                  |
| `title`           | string    | Anzeige-Titel des Quiz (Klartext)                                 |
| `description`     | string    | Kurzbeschreibung (3-6 Sätze, wird in Topic-Card angezeigt)       |
| `authors`         | array     | Liste der Autor:innen (mind. 1, z.B. `["Müller", "Schmidt"]`)    |
| `is_active`       | boolean   | `true` = sichtbar, `false` = versteckt                            |
| `questions`       | array     | Liste der Fragen (mind. 1)                                        |

**Optional:**
- `order_index` (integer, default 0): Sortierung in der Topic-Liste

### Pflichtfelder (Question-Level)

| Feld          | Typ       | Beschreibung                                                       |
|---------------|-----------|--------------------------------------------------------------------|
| `difficulty`  | integer   | Schwierigkeitsgrad 1-5                                             |
| `type`        | string    | Immer `"single_choice"` (vorerst einziger Typ)                     |
| `prompt`      | string    | Die Frage (Klartext)                                               |
| `explanation` | string    | Erklärung nach der Antwort (Klartext)                              |
| `answers`     | array     | 2-6 Antworten (mind. 2, genau 1 mit `correct: true`)              |

**Optional:**
- `id` (string): Stabile Question-ID (wenn fehlt, wird automatisch `{slug}_q{index}` generiert)
- `media` (object): z.B. `{"type": "audio", "url": "..."}`
- `sources` (array): Quellenangaben
- `meta` (object): Zusätzliche Metadaten

### Answer-Format

```json
{
  "id": "a1",
  "text": "Antworttext hier",
  "correct": true
}
```

- `id` (optional): Answer-ID (wenn fehlt, wird `a1`, `a2`, ... generiert)
- `text` (required): Antworttext (Klartext)
- `correct` (required): Boolean, **genau eine** Antwort muss `true` sein

---

## Naming Convention

**Dateiname = `{slug}.json`**

Der `slug` muss:
- Lowercase sein
- Nur `[a-z0-9_]` enthalten (keine Leerzeichen, Umlaute, Bindestriche)
- Eindeutig sein

**Beispiele:**
- ✅ `variation_in_der_aussprache.json` (slug: `variation_in_der_aussprache`)
- ✅ `grammar_basics.json` (slug: `grammar_basics`)
- ❌ `Quiz-Titel mit Leerzeichen.json` (ungültig)
- ❌ `Ñ_test.json` (ungültig wegen Ñ)

---

## Workflow: Neue Unit hinzufügen

1. **JSON-Datei erstellen:**
   ```bash
   cd game_modules/quiz/quiz_units/topics/
   # Erstelle neue Datei: my_new_quiz.json
   ```

2. **Schema ausfüllen:**
   - Kopiere ein bestehendes Beispiel (z.B. `variation_in_der_aussprache.json`)
   - Passe `slug`, `title`, `description`, `authors` an
   - Füge mindestens 1 Frage hinzu

3. **App starten (DEV-Modus):**
   ```bash
   .\scripts\dev-start.ps1 -UsePostgres
   ```
   → **Automatisches Seeding:** Die App lädt alle Units beim Start!

4. **Überprüfen:**
   - Öffne: http://localhost:8000/games/quiz
   - Die neue Topic-Card sollte sichtbar sein mit Titel, Beschreibung, Autor:innen

---

## Technische Details (für Developer)

### Klartext vs. i18n-Keys

**Wichtig:** Das aktuelle DB-Schema nutzt `*_key` Felder (z.B. `title_key`, `prompt_key`), die ursprünglich für i18n-Keys gedacht waren. 

**Pragmatische Lösung:**
- Wir schreiben **Klartext** in diese Felder.
- Das ist bewusster "Key-Missbrauch", aber minimal-invasiv und sofort nutzbar.
- Beispiel: `title_key = "Variation in der Aussprache"` (statt `"topics.variation.title"`)

**Zukunft:** Später kann auf echtes i18n umgestellt werden (neue Felder `title`, `title_i18n_key`, etc.).

### ID-Generierung

- **Question-IDs:** Wenn `question.id` fehlt → `{slug}_q{index:02d}` (z.B. `demo_topic_q01`)
- **Answer-IDs:** Wenn `answer.id` fehlt → `a{index}` (z.B. `a1`, `a2`, ...)

### Seeding-Mechanik

- **Idempotent:** Mehrfaches Seeding erzeugt keine Duplikate (UPSERT via `slug` als PK)
- **Advisory Lock:** Postgres-Lock verhindert parallele Seed-Runs
- **Validation:** Ungültige Units werden abgelehnt mit klarer Fehlermeldung

---

## Beispiel-Unit

Siehe: `topics/variation_in_der_aussprache.json`

---

## Fragen?

Bei Problemen:
1. Prüfe JSON-Syntax (z.B. via https://jsonlint.com)
2. Prüfe Schema-Konformität (alle Pflichtfelder vorhanden?)
3. Schaue in App-Logs (Seed-Fehler werden beim Start ausgegeben)
4. Siehe: `game_modules/quiz/validation.py` für Details zur Validierung

---

**Happy Quiz-Creating! 🎯**
