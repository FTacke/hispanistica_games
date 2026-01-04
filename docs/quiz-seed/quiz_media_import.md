# quiz_media_import.md

Ziel: Quiz-Fragen können optional **Audio** und **Bilder** enthalten – sowohl auf **Question-Level** als auch in **Answer-Optionen**. Medien-Dateien liegen im Seed-Ordner (neben der JSON) und werden beim Seed-Pipeline-Lauf **kopiert**, **deterministisch umbenannt** und als **statische URLs** unter `/static/quiz-media/...` verfügbar gemacht. Zusätzlich gilt: **pauschal +10 Sekunden Timer**, sobald eine Frage irgendein Medium (Question- oder Answer-Media) enthält.

Wichtig: In DEV passiert Seeding bei jedem Start via:
`.\scripts\dev-start.ps1 -UsePostgres`
Das startet bereits die Quiz Content Pipeline (Normalize → Seed → Soft prune).

---

## 0) Nicht verhandelbare Goals

1. **Deterministisch & idempotent**  
   Mehrfaches Seeding darf:
   - keine Duplikate erzeugen
   - keine Medien mehrfach kopieren
   - keine Namen verändern (wenn Input gleich)
   - vorhandene Dateien **nicht still überschreiben**
2. **Seed bleibt “Source of Truth”**  
   Medien im Seed-Ordner werden **kopiert**, nicht verschoben.
3. **URLs im Runtime/DB-Kontext**  
   App arbeitet nach Import nur noch mit finalen URLs:
   `/static/quiz-media/<slug>/<question_id>/<filename>`
4. **Pauschal +10s** bei vorhandenen Medien  
   Einfache Regel: `time_limit_bonus_s = 10` wenn `any_media == true`, sonst 0.
5. **Mehrere Medien** pro Frage/Antwort  
   Jede Media-Unit hat optional `label` (und bei images optional `alt`).

---

## 1) Aktueller Ist-Zustand (was der Agent zuerst aus dem Code holen muss)

Die Pipeline läuft bereits mit Logs wie:
- “Normalize JSON units (IDs + statistics)”
- “Seed database (upsert)”
- “Soft prune removed topics”
und nutzt die Topics-Directory:
`game_modules/quiz/quiz_units/topics`

Der Agent muss diese Stellen im Repo **lokalisieren und lesen** (keine Annahmen):
1. **Normalizer**: Wo werden IDs generiert und JSON normalisiert?  
   Erwartung: ein Script/Modul in `game_modules/quiz/...` oder `src/...`
2. **Seeder/Importer**: Wo passiert UPSERT in DB?  
3. **Validation**: `game_modules/quiz/validation.py` wird im README genannt.
4. **DB-Modelle**: Wo sind Topic/Question/Answer gespeichert?  
   (Wichtig: ob es JSON-Felder gibt oder normalisierte Tabellen.)
5. **Frontend/Template**: Wo wird die Frage im Template gerendert und welche Daten liefert das Backend (z.B. `/status`, Question-Payload etc.)?

> Der Agent darf erst implementieren, wenn er diese 5 Stellen gefunden hat und klar ist, wo “media” aktuell überhaupt durchläuft.

---

## 2) Neues Datenmodell im Seed: `quiz_unit_v2`

### 2.1 Schema-Version
- `schema_version`: `"quiz_unit_v2"`

### 2.2 Media-Felder (neu)
- `question.media`: **Array** statt `null|object`
- `answer.media`: optionales Array, default `[]`

### 2.3 Media-Objekt (einheitlich für audio & image)
Pflicht:
- `id` (string; stabil; innerhalb des Containers eindeutig)
- `type`: `"audio"` oder `"image"`
- `seed_src`: lokaler Pfad relativ zur JSON-Datei (oder zu einem Topic-Media-Ordner)
Optional:
- `label` (string; empfohlen bei `media.length > 1`)
- `alt` (string; nur relevant für image)
- `caption` (string; optional)

Beispiel:
```json
{
  "schema_version": "quiz_unit_v2",
  "slug": "variation_test_quiz",
  "title": "…",
  "description": "…",
  "authors": ["AB"],
  "is_active": true,
  "order_index": 0,
  "questions": [
    {
      "difficulty": 2,
      "type": "single_choice",
      "prompt": "Was hörst du?",
      "explanation": "…",
      "media": [
        {
          "id": "m1",
          "type": "audio",
          "seed_src": "variation_test_quiz.media/q01_audio_1.mp3",
          "label": "Audio 1"
        },
        {
          "id": "m2",
          "type": "image",
          "seed_src": "variation_test_quiz.media/q01_img_1.jpg",
          "label": "Abbildung 1",
          "alt": "…"
        }
      ],
      "answers": [
        { "text": "A", "correct": false, "media": [] },
        {
          "text": "B",
          "correct": true,
          "media": [
            {
              "id": "m1",
              "type": "audio",
              "seed_src": "variation_test_quiz.media/q01_a2_audio_1.mp3",
              "label": "Antwort B abspielen"
            }
          ]
        }
      ],
      "sources": [],
      "meta": {}
    }
  ]
}
````

### 2.4 Backward Compatibility (v1 weiter unterstützen)

`quiz_unit_v1` existiert bereits. Der Import muss weiterhin funktionieren:

* `question.media` kann in v1 `null` oder `object` sein
* v1-media wird intern in v2-array konvertiert (so dass Renderer/DB nur noch ein Format sieht)

---

## 3) Seed-Datei-Struktur: Wo liegen Medien?

Empfohlen pro Topic:

```
game_modules/quiz/quiz_units/topics/
  <slug>.json
  <slug>.media/
    q01_audio_1.mp3
    q01_img_1.jpg
    q01_a2_audio_1.mp3
```

`seed_src` zeigt dann auf:

* `<slug>.media/<filename>`

Warum so:

* Autoren können neue Fragen schreiben, auch ohne IDs.
* Dateinamen dürfen index-basiert sein (q01…), IDs werden beim Normalize deterministisch gesetzt.

---

## 4) Ziel-Layout in Static: `/static/quiz-media/...`

Alle Medien werden beim Seeding **kopiert nach**:
`<APP_ROOT>/static/quiz-media/<slug>/<question_id>/...`

URL-Format (final):
`/static/quiz-media/<slug>/<question_id>/<filename>`

### 4.1 Naming-Regeln (Collision-frei)

Wenn `question.media`:

* Datei heißt `<media_id>.<ext>` (z.B. `m1.mp3`, `m2.jpg`)

Wenn `answer.media`:

* Datei heißt `<answer_id>_<media_id>.<ext>` (z.B. `a2_m1.mp3`)

Damit können Autoren bei Answer-media ebenfalls `m1, m2` nutzen ohne Kollision.

### 4.2 Filetypes

Erlaubte Extensions (mindestens):

* Audio: `.mp3` (optional zusätzlich `.ogg`, `.wav` wenn gewünscht)
* Images: `.jpg`, `.jpeg`, `.png`, `.webp`

Der Importer muss die Extension aus `seed_src` übernehmen und validieren.

---

## 5) Timer-Regel: pauschal +10s bei Media

**Regel:** Eine Frage erhält `time_limit_bonus_s = 10`, sobald:

* `question.media.length > 0` OR
* irgendeine Answer-Option `answer.media.length > 0`

### Implementations-Optionen

A) Im Normalizer: Feld setzen und mit-normalisieren
B) Im Backend beim Ausliefern der Frage: berechnen und als Payload-Feld senden
C) In DB persistieren (wenn Zeit pro Frage gespeichert wird)

Empfehlung: **B**, weil minimal invasiv und robust, solange Payload ohnehin gebaut wird.
Wenn ihr aber ohnehin Normalize-Statistiken schreibt, kann A auch passen.

Wichtig: Frontend soll **nur** das Feld nutzen (`time_limit_bonus_s`) und daraus `base + bonus` rechnen.

---

## 6) Implementierungsplan: Schritt-für-Schritt für den Agenten

### Schritt 1: Code-Discovery (pflicht) ✅ ABGESCHLOSSEN

Der Agent muss im Repo gezielt suchen und die Dateien öffnen:

* Normalizer Entry-Point (Pipeline Step 1)
* Seeder/Importer Entry-Point (Pipeline Step 2)
* Soft prune (Pipeline Step 3)
* Validation (`game_modules/quiz/validation.py` laut README)
* DB Models / Repositories für quiz content
* Frontend Template + JS, wo Frage/Answers gerendert werden (Play-Seite)

Ziel: Klarheit, wo das Media-Feld aktuell "hängen bleibt".

---

#### Discovery-Ergebnisse (Stand: 2026-01-04)

**1. NORMALIZER (Pipeline Step 1)**

Datei: `scripts/quiz_units_normalize.py`

- Entry-Point: `normalize_quiz_unit(unit_data, slug, verbose=False)` (Zeile 39-76)
- Was passiert:
  - Fügt fehlende Question-IDs hinzu (ULID-basiert: `{slug}_q_{ULID()}`)
  - Berechnet/aktualisiert `questions_statistics` (Difficulty Distribution)
  - Deterministisches JSON-Format (Zeile 78-109: `format_json_deterministic()`)
- CLI: `python scripts/quiz_units_normalize.py --write --topics-dir <path>`
- **Media-Relevanz:** Hier werden IDs generiert und Defaults gesetzt. Aktuell keine Media-Behandlung, aber idealer Ort für:
  - `question.media` default zu `[]` setzen wenn fehlend
  - `answer.media` default zu `[]` setzen wenn fehlend
  - v1→v2 backward compatibility (media object → media array)

**2. SEEDER/IMPORTER (Pipeline Step 2)**

Datei: `game_modules/quiz/seed.py`

- Entry-Point: `import_quiz_unit(session, unit)` (Zeile 113-222)
- Was passiert:
  - Lädt JSON via `load_quiz_unit(json_path)` (Zeile 95-109)
  - Validiert via `validate_quiz_unit()` aus validation.py
  - UPSERT Topic: `QuizTopic` (id, title_key, description_key, authors, based_on, is_active, order_index)
  - UPSERT Questions: Loop über `unit.questions`
    - `QuizQuestion` (id, topic_id, difficulty, type, prompt_key, explanation_key, answers, **media**, sources, meta)
    - `answers` wird als JSONB gespeichert: `[{id, text_key, correct}, ...]`
    - **media** wird als JSONB gespeichert (bereits unterstützt!)
- Aufgerufen von: `seed_quiz_units(session, units_dir)` (Zeile 224-332)
- **Media-Relevanz:** 
  - Seeder unterstützt bereits `media` als JSONB in DB
  - **NEU:** Media Copy-Importer muss hier integriert werden (nach Validation, vor/während import_quiz_unit)
  - Zielpfad: `static/quiz-media/<slug>/<question_id>/...`
  - Idempotenz: Hash-basierter Vergleich bei existierenden Dateien

**3. SOFT PRUNE (Pipeline Step 3)**

Datei: `scripts/quiz_seed.py`

- Entry-Point: `prune_topics_soft(session, topics_dir, QuizTopic)` (Zeile 85-117)
- Was passiert:
  - Holt Slugs aus JSON-Dateien
  - Deaktiviert Topics in DB ohne JSON (`is_active = false`)
- Hard Prune: `prune_topics_hard()` (Zeile 120-185) - löscht Topics ohne Runs
- **Media-Relevanz:** 
  - Bei Soft Prune: Medien bleiben (Topic nur inaktiv)
  - Bei Hard Prune: Medien-Cleanup könnte nötig sein (orphaned files)
  - **Optional:** Media-Cleanup-Funktion für verwaiste Dateien in `static/quiz-media/`

**4. VALIDATION**

Datei: `game_modules/quiz/validation.py`

- Entry-Point: `validate_quiz_unit(data, filename="")` (Zeile 315-444)
- Schema-Klassen:
  - `QuizUnitSchema` (Zeile 93-102): top-level unit mit questions
  - `UnitQuestionSchema` (Zeile 72-84): question mit prompt, explanation, answers, **media**
  - `UnitAnswerSchema` (Zeile 60-65): answer mit id, text, correct (kein media hier, aber möglich zu erweitern)
- Validierung:
  - Schema-Version prüfen (aktuell nur `quiz_unit_v1`)
  - Slug-Format: `^[a-z0-9_]+$`
  - Questions: min 1, each mit difficulty 1-5, prompt, explanation, answers (2-6 Stück, genau 1 correct)
  - **media** wird aktuell als optional Dict akzeptiert (`media: Optional[Dict[str, Any]]`)
- **Media-Relevanz:**
  - **NEU:** Schema-Version `quiz_unit_v2` akzeptieren
  - **NEU:** Media-Validierung erweitern:
    - `question.media`: v1 `null|object`, v2 `array`
    - `answer.media`: v2 `array` (optional, default `[]`)
    - Media-Objekt: `{id, type, seed_src, label?, alt?, caption?}`
    - Validierung: id required, type in {audio, image}, seed_src required, Datei-Existenz prüfen

**5. DB MODELS**

Datei: `game_modules/quiz/models.py`

- Klasse: `QuizQuestion` (Zeile 109-130)
- Relevante Spalten:
  - `id: str` (PK, bis zu 100 chars für ULID-basierte IDs)
  - `topic_id: str` (FK zu QuizTopic)
  - `prompt_key: str` (100 chars) - gespeichert als plaintext (pragmatisch)
  - `explanation_key: str` (100 chars) - gespeichert als plaintext
  - `answers: JSONB` - Array von `{id, text_key, correct}`
  - **`media: Optional[JSONB]`** - bereits vorhanden! (Zeile 122)
  - `sources: Optional[JSONB]`
  - `meta: Optional[JSONB]`
- **Media-Relevanz:**
  - DB unterstützt bereits `media` als JSONB-Spalte
  - **Format nach Import:** `media` wird Array mit finalen URLs sein:
    ```json
    [
      {"id": "m1", "type": "audio", "src": "/static/quiz-media/slug/q_id/m1.mp3", "label": "Audio 1"},
      {"id": "m2", "type": "image", "src": "/static/quiz-media/slug/q_id/m2.jpg", "alt": "...", "label": "Bild 1"}
    ]
    ```
  - Answer-media ist nicht in DB normalisiert, sondern Teil des `answers` JSONB:
    - **Erweiterung nötig:** `answers` array erweitern um `media` sub-array pro Answer:
      ```json
      [
        {"id": "a1", "text_key": "...", "correct": false, "media": []},
        {"id": "a2", "text_key": "...", "correct": true, "media": [{"id": "m1", "type": "audio", "src": "...", "label": "..."}]}
      ]
      ```

**6. FRONTEND: TEMPLATE + JS**

Dateien:
- Template: `templates/games/quiz/play.html`
- JavaScript: `static/js/games/quiz-play.js`
- API-Endpunkt: `game_modules/quiz/routes.py`

**Template (play.html):**
- Zeile 90-92: `<div class="quiz-question__media" id="quiz-question-media" hidden>` - Platzhalter für Audio/Image
- Fragen-Prompt: `<p class="quiz-question__prompt" id="quiz-question-prompt">`
- Answers: `<div class="quiz-answers" id="quiz-answers">` - dynamisch befüllt via JS

**JavaScript (quiz-play.js):**
- State-Machine: idle → answered_locked → transitioning
- Question-Rendering: dynamisch via API-Daten
- Timer: 30s base (Zeile 185: `const TIMER_SECONDS = 30`)
- **Erweiterung nötig:** 
  - Question-media rendern (Audio-Player, Image-Tags)
  - Answer-media rendern (Audio-Player in Answer-Optionen)
  - Timer-Bonus: `+10s` wenn `question.media.length > 0` oder `answer.media` vorhanden

**Backend API (routes.py):**
- `api_get_question(question_id)` (Zeile 845-868):
  - Liefert Question-Payload:
    ```json
    {
      "id": "...",
      "difficulty": 2,
      "type": "single_choice",
      "prompt_key": "...",
      "explanation_key": "...",
      "answers": [...],
      "media": {...}  // aktuell single object, wird array
    }
    ```
- `api_get_run_status(run_id)` (Zeile 652-734):
  - Liefert Run-Status inkl. `running_score`, `current_index`, `joker_remaining`
  - **Erweiterung möglich:** Timer-Bonus-Feld (`time_limit_bonus_s`) hier berechnen und mitsenden

**Media-Relevanz Frontend:**
- **NEU:** Question-Media-Block im Template (Audio/Image rendern)
- **NEU:** Answer-Media in JS-Rendering integrieren
- **NEU:** Timer-Berechnung erweitern: `base_time + bonus` (bonus = 10 wenn media vorhanden)
- **Kommentare:** Pflicht-Kommentare zu `media.src` vs. `media.seed_src` und Nummerierung ("Audio 1", "Bild 2")

---

#### Zusammenfassung: Wo "hängt" Media aktuell?

| Component | Aktueller Stand | Media-Unterstützung |
|-----------|-----------------|---------------------|
| **JSON Schema** | `quiz_unit_v1` | `media: null\|object` (optional, single object) |
| **Normalizer** | Generiert IDs, berechnet Stats | ❌ Keine Media-Behandlung |
| **Validation** | Validiert JSON-Schema | ⚠️ Akzeptiert `media` als optional Dict, keine Struktur-Validierung |
| **Seeder** | UPSERT in DB | ✅ Speichert `media` JSONB, aber keine File-Copy |
| **DB Model** | `QuizQuestion.media: JSONB` | ✅ Spalte vorhanden, Format flexibel |
| **Backend API** | `api_get_question()` | ✅ Liefert `media` aus DB |
| **Frontend JS** | Rendert Question/Answers | ❌ Kein Media-Rendering |
| **Template** | Play-Seite | ⚠️ Media-Placeholder vorhanden, aber nicht genutzt |

**Critical Path für Media-Import:**
1. **Normalizer:** v1→v2 conversion, media defaults setzen
2. **Validation:** v2-Schema + media-array validieren, `seed_src` prüfen
3. **Seeder:** Media-Copy-Importer (Dateien kopieren, URLs generieren)
4. **Backend:** Timer-Bonus berechnen (+10s bei media)
5. **Frontend:** Media rendern (Audio-Player, Images) + Timer-Bonus verwenden

---

### Schritt 2: Schema/Validation erweitern

* `schema_version` akzeptiert `quiz_unit_v2`
* `question.media`:

  * v1: `null|object` erlauben
  * v2: `array` erlauben
* `answer.media`: optional array
* Validierung:

  * `media.id` required
  * `media.type` in {audio,image}
  * `media.seed_src` required (für lokale Dateien)
  * Datei muss existieren (Seed-Ordner)
  * Extension whitelist

Bei v1-media-object:

* mappe auf v2-array:

  * `id = "m1"`
  * `type` aus v1
  * `seed_src` oder `url` nach v2 (`seed_src` bevorzugen für lokale Medien)

### Schritt 3: Normalizer erweitert IDs + Media Defaults

* Wenn `question.id` fehlt: `{slug}_q{index:02d}`
* Wenn `answer.id` fehlt: `a{index}`
* Wenn `question.media` fehlt: setze `[]`
* Wenn `answer.media` fehlt: setze `[]`
* Optional: wenn `media.label` fehlt und `media_count>1`: Auto-Fallback “Audio 1”, “Bild 2”
  (Renderer kann das auch, aber Normalize ist ok.)

### Schritt 4: Media Copy-Importer (neu / integriert in Seed Step)

In den Seeder (Step 2) einbauen:

1. Für jede Question:

   * Collect question.media + all answer.media
2. Resolve `seed_src`:

   * Pfad relativ zur JSON-Datei (dirname)
3. Zielpfad bauen:

   * `static/quiz-media/<slug>/<question_id>/...`
4. File copy:

   * Wenn Ziel nicht existiert: kopieren
   * Wenn Ziel existiert:

     * Hash vergleichen
     * gleich => skip
     * ungleich => fail mit klarer Fehlermeldung
5. In finalem Datenobjekt:

   * `src` setzen auf URL `/static/quiz-media/...`
   * optional `content_hash` speichern (wenn DB Platz hat, sonst nur für Vergleich nutzen)

**Idempotenz ist Pflicht.**

### Schritt 5: DB/Content-Model anpassen

Abhängig davon, wie Questions gespeichert werden:

* Wenn Questions als JSON in DB landen: `media` arrays + `src` persistieren
* Wenn normalisierte Tabellen: entweder:

  * neue Tabelle `quiz_media` (question_id, answer_id nullable, type, src, label, alt, caption, hash)
  * oder JSON-Spalte an Question/Answer

Agent muss sich nach Step 1 entscheiden und konsistent implementieren.

### Schritt 6: Backend Payload erweitern

Bei “Question liefern” (egal ob eigener Endpoint oder via status/next):

* media arrays mit `src` (final URLs) liefern
* `time_limit_bonus_s` berechnen oder übernehmen

### Schritt 7: Template + Frontend Rendering anpassen (mit Kommentierung)

#### 7.1 Template: klare Kommentare zu src und Nummerierung

Im Question-Template (oder dem Partial, das Prompt+Answers zeigt) hinzufügen:

* Question-Media Block:

  * Für jedes Medium:

    * `label` anzeigen (oder Fallback “Audio 1/Bild 1”)
    * Audio: `<audio controls preload="metadata" playsinline src="{{ media.src }}"></audio>`
    * Image: `<img src="{{ media.src }}" alt="{{ media.alt or media.label or '' }}">`
  * Optional `caption` darunter

* Answer-Optionen:

  * Wenn `answer.media` vorhanden:

    * Audio-Play UI integrieren (oder ebenfalls `<audio controls ...>`)
    * Wichtig: Play darf nicht automatisch Answer auswählen (separater Button oder eigener Click-Handler)

**Kommentar im Template (Pflicht):**

* `media.seed_src` ist nur im Seed, nicht im Runtime
* `media.src` ist die vom Importer erzeugte URL
* Nummerierung:

  * wenn kein label: UI zeigt “Audio 1”, “Bild 2”, basierend auf Reihenfolge im JSON

Beispiel-Kommentartext (im Template einfügen):

* “`media.src` wird beim Seeding aus `seed_src` erzeugt und zeigt auf `/static/quiz-media/...`. Die Reihenfolge im JSON bestimmt die Anzeige-Reihenfolge (Audio 1, Audio 2, ...).”

#### 7.2 Frontend JS: Timer +10s bei Media

* Wenn Backend `time_limit_bonus_s` liefert:

  * `effective_time = base_time + bonus`
* Beim Rendern neue Frage:

  * eventuell Audio-Players stoppen/resetten beim Weiterklick

### Schritt 8: Tests / Checks

Minimal:

* Seed run in DEV startet ohne Fehler
* Ein Topic mit Medien:

  * kopiert Files nach `static/quiz-media/...`
  * generiert korrekte URLs
  * wiederholter Seed: keine Änderungen, keine Duplikate
* Fehlerfall:

  * fehlende Datei => Seed stoppt mit klarer Meldung
* Frontend:

  * Medien erscheinen
  * Timer ist +10s (sichtbar via Timer-Verhalten)

---

## 7) Autoren-Guideline: Wie verknüpfe ich Medien ohne IDs?

Auch ohne `question.id` / `answer.id` geht’s sauber:

* Dateien benennen indexbasiert (q01..., q02...)
* Im JSON `seed_src` referenzieren
* `media.id` innerhalb des Blocks vergeben (`m1`, `m2`, ...)

Beispiel (ohne question.id / answer.id):

```json
{
  "difficulty": 2,
  "type": "single_choice",
  "prompt": "Was hörst du?",
  "media": [
    { "id": "m1", "type": "audio", "seed_src": "my_topic.media/q01_audio_1.mp3", "label": "Audio 1" }
  ],
  "answers": [
    { "text": "A", "correct": false },
    {
      "text": "B",
      "correct": true,
      "media": [
        { "id": "m1", "type": "audio", "seed_src": "my_topic.media/q01_a2_audio_1.mp3", "label": "Antwort B" }
      ]
    }
  ],
  "explanation": "…"
}
```

Der Normalizer setzt dann:

* `question.id = <slug>_q01`
* `answer.id = a1, a2...`
  und der Importer erzeugt:
* question-media: `m1.mp3`
* answer-media: `a2_m1.mp3`

---

## 8) Operatives: Seeding in DEV beim Start

Beim Start via `.\scripts\dev-start.ps1 -UsePostgres` läuft automatisch:

1. Normalize (IDs + statistics)
2. Seed DB (upsert)
3. Soft prune

Erwartetes Ergebnis in Logs:

* Normalization complete
* Importing quiz unit ...
* Seeding topic ... questions ...
* Zusätzlich neu: “Copying media assets …” / “Media copy complete …”
* Bei Fehler: klare Meldung inkl. Topic + question index + seed_src Pfad

---

## 9) Definition of Done

* v1 Topics laufen unverändert weiter.
* v2 Topics können Medien in Frage und Antworten enthalten.
* Medien werden in `static/quiz-media/...` kopiert, deterministisch benannt.
* Wiederholtes DEV-Start-Seeding ist idempotent.
* Frontend zeigt Medien, Labels/Fallbacks, und Timer ist bei Medienfragen +10s.
* Template enthält die erklärenden Kommentare zu `src` und Nummerierung.

---
