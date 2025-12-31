# Quiz-Pipeline: Audit & Refactoring-Plan

**Erstellt:** 2025-12-31  
**Projekt:** HISPANISTICA_GAMES  
**Modul:** `game_modules/quiz/`  
**Ziel:** Content als modular verwaltbare "Quiz Units" strukturieren, robustes Dev-Seeding implementieren.

---

## 1. Kurzfazit

- **Content-Format:** Aktuell YAML-basiert (definiert in `game_modules/quiz/content/topics/*.yml`), aber der Ordner ist derzeit leer.
- **i18n-Trennung:** Content-Texte (Prompts, Antworten, Erklärungen) werden via i18n-Keys in `game_modules/quiz/content/i18n/de.yml` gehalten, nicht direkt in den YAML-Dateien.
- **Seed-Mechanismus:** Es gibt zwei parallele Seed-Implementierungen:
  - **A)** `game_modules/quiz/seed.py` – lädt YAML aus `content/topics/`, nutzt i18n-Keys
  - **B)** `scripts/seed_quiz_content.py` – lädt JSON mit eingebettetem Text, generiert deterministische IDs
  - **C)** `seed_quiz_data.sql` – manuelles SQL-Seed-Script (Docker-exec)
- **Seed-Triggering:** **Kein automatisches Seeding beim Dev-Start**. Developer müssen manuell ein Script oder SQL ausführen.
- **Topic-Auswahl (UI):** JavaScript lädt Topics über `/api/quiz/topics` → `services.get_active_topics()` → DB Query → Topic-Cards werden gerendert.
- **Fehlende Felder:**
  - `description` existiert als `description_key` in `QuizTopic`, wird aber nicht im Frontend gerendert (HTML-Kommentar sagt: "no description available yet").
  - `authors` fehlt komplett (weder in Models noch in Validation-Schemas).
- **DB-Models:** Vollständig mit SQLAlchemy definiert (`models.py`), PostgreSQL-only (JSONB für `answers`, `media`, `sources`, `meta`).

---

## 2. Ist-Stand: Datenfluss (Von JSON/YAML bis UI)

### ASCII-Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│ Content-Quellen (IST)                                            │
│ ─────────────────────────────────────────────────────────────────│
│ A) game_modules/quiz/content/topics/*.yml (leer)                 │
│    + game_modules/quiz/content/i18n/de.yml (i18n keys)           │
│ B) scripts/seed_quiz_content.py (JSON-basiert, eigenes Format)   │
│ C) seed_quiz_data.sql (manuelles SQL)                            │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Seeding (manuell getriggert)                                     │
│ ─────────────────────────────────────────────────────────────────│
│ • game_modules/quiz/seed.py → import_topic_from_yaml()           │
│   - load_yaml_file() → validate_topic_content() → UPSERT         │
│ • scripts/seed_quiz_content.py → SQLAlchemy bulk upserts         │
│ • seed_quiz_data.sql → psql -U hispanistica_auth                 │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ PostgreSQL DB (hispanistica_auth)                                │
│ ─────────────────────────────────────────────────────────────────│
│ Tables:                                                           │
│ • quiz_topics (id, title_key, description_key, is_active, ...)   │
│ • quiz_questions (id, topic_id, difficulty, prompt_key,          │
│                   explanation_key, answers::JSONB, ...)          │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Backend-Services & Routes                                        │
│ ─────────────────────────────────────────────────────────────────│
│ • /api/quiz/topics → routes.py:api_get_topics()                  │
│   → services.get_active_topics(session)                          │
│   → SELECT * FROM quiz_topics WHERE is_active=true               │
│   → Returns: [{topic_id, title_key, description_key, href}, ...]│
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Frontend (JavaScript)                                            │
│ ─────────────────────────────────────────────────────────────────│
│ • static/js/games/quiz-topics.js:loadTopics()                    │
│   → fetch('/api/quiz/topics')                                    │
│   → renderTopics() → creates HTML cards                          │
│ • Optional: QuizI18n.getTopicTitle/Description (i18n fallback)   │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ HTML Template (Topic-Cards)                                      │
│ ─────────────────────────────────────────────────────────────────│
│ • templates/games/quiz/index.html                                │
│   → <div id="quiz-topics-container">                             │
│     JS inserts: <div class="quiz-topic-card">                    │
│                   <h2>{{ title }}</h2>                           │
│                   <p>{{ description }}</p> (falls vorhanden)     │
│                   <a href="/games/quiz/{{ topic_id }}">Spielen   │
└──────────────────────────────────────────────────────────────────┘
```

### Detaillierte Schritte

1. **Content-Definition:**
   - **YAML-Weg (Option A):** Autor erstellt `game_modules/quiz/content/topics/my_topic.yml` mit Struktur:
     ```yaml
     topic_id: my_topic
     questions:
       - id: "my_topic-001"
         difficulty: 1
         type: single_choice
         prompt_key: "q.my_topic-001.prompt"
         explanation_key: "q.my_topic-001.explanation"
         answers:
           - id: 1
             text_key: "q.my_topic-001.answer.1"
             correct: true
           - id: 2
             text_key: "q.my_topic-001.answer.2"
             correct: false
           # ... 2 more answers
     ```
   - Parallel dazu: i18n-Texte in `game_modules/quiz/content/i18n/de.yml`:
     ```yaml
     q:
       my_topic-001:
         prompt: "Fragetitel hier"
         explanation: "Erklärung hier"
         answer:
           1: "Antwort 1"
           2: "Antwort 2"
     ```
   - **JSON-Weg (Option B):** `scripts/seed_quiz_content.py` erwartet eigenes JSON-Format mit eingebettetem Text.
   - **SQL-Weg (Option C):** Direktes INSERT in `seed_quiz_data.sql`.

2. **Seeding (manuell):**
   - **Option A:** Developer ruft explizit auf:
     ```python
     from game_modules.quiz.seed import import_topic_from_yaml
     with Session() as session:
         import_topic_from_yaml(session, Path("content/topics/my_topic.yml"))
     ```
     Oder via CLI-Command (falls vorhanden – aktuell nicht gefunden).
   - **Option B:** `python scripts/seed_quiz_content.py --path docs/games_modules/quiz_content_v1.json`
   - **Option C:** `Get-Content seed_quiz_data.sql | docker exec -i hispanistica_auth_db psql -U hispanistica_auth`

3. **DB-Layer:**
   - `game_modules/quiz/seed.py:import_topic_from_yaml()`
     - Zeilen 49-152 in `seed.py`
     - Lädt YAML mit `load_yaml_file()`
     - Validiert via `validate_topic_content()` → `validation.py:validate_topic_content()`
     - Upsert: `session.query(QuizTopic).filter(...).first()` → wenn nicht vorhanden: `session.add(QuizTopic(...))`
     - Questions: foreach → check existing → update or insert
     - **Idempotent:** Ja (upsert), aber keine Prune-Option für gelöschte Fragen.

4. **Backend-API:**
   - `game_modules/quiz/routes.py` Zeile 209-224:
     ```python
     @blueprint.route("/api/quiz/topics")
     def api_get_topics():
         with get_session() as session:
             topics = services.get_active_topics(session)
             return jsonify({
                 "topics": [
                     {
                         "topic_id": t.id,
                         "title_key": t.title_key,
                         "description_key": t.description_key,
                         "href": f"/games/quiz/{t.id}",
                     }
                     for t in topics
                 ]
             })
     ```
   - `game_modules/quiz/services.py` Zeile 467-470:
     ```python
     def get_active_topics(session: Session) -> List[QuizTopic]:
         stmt = select(QuizTopic).where(QuizTopic.is_active == True).order_by(QuizTopic.order_index)
         return list(session.execute(stmt).scalars().all())
     ```

5. **Frontend-Rendering:**
   - `static/js/games/quiz-topics.js` Zeile 15-100:
     - `loadTopics()` → `fetch('/api/quiz/topics')`
     - `renderTopics(container, topics)` → für jedes Topic:
       ```javascript
       let title = topic.title_key || topic.topic_id;
       let description = topic.description_key || '';
       // Try QuizI18n for translation if available
       // Render HTML card with title, description (if any), play button
       ```
   - `templates/games/quiz/index.html` Zeile 31:
     ```html
     <div class="quiz-topics" id="quiz-topics-container">
       <!-- JS lädt hier die Cards -->
     </div>
     ```

---

## 3. Ist-Stand: Content-Format

### Aktuelles YAML-Schema (Option A)

**Datei-Struktur:**
```
game_modules/quiz/content/
├── topics/
│   └── [LEER – noch keine Files]
└── i18n/
    └── de.yml
```

**Erwartetes YAML-Schema** (siehe `validation.py` Zeile 43-49):
```yaml
topic_id: "demo_topic"
questions:
  - id: "demo-0001"
    difficulty: 1  # 1-5
    type: "single_choice"
    prompt_key: "q.demo-0001.prompt"
    explanation_key: "q.demo-0001.explanation"
    answers:
      - id: 1
        text_key: "q.demo-0001.answer.1"
        correct: true
      - id: 2
        text_key: "q.demo-0001.answer.2"
        correct: false
      # ... 2 more (total 4 required)
    media: null  # optional JSONB
    sources: null  # optional JSONB array
    meta: null  # optional JSONB
```

### JSON-Schema (Option B: `seed_quiz_content.py`)

**Datei:** `scripts/seed_quiz_content.py` erwartet:
```json
{
  "schema_version": "quiz_seed_v1",
  "defaults": {
    "missing_explanation_text": "Erklärung folgt."
  },
  "quizzes": [
    {
      "slug": "demo_topic",
      "title": "Demo Quiz",
      "questions": [
        {
          "author_initials": "AB",
          "prompt": "Frage hier?",
          "difficulty": 1,
          "correct_answer": "Richtig",
          "wrong_answers": ["Falsch A", "Falsch B", "Falsch C"],
          "explanation": "Erklärung hier."
        }
      ]
    }
  ]
}
```

### Fehlende Felder

- **`description`:** Existiert als `description_key` in `QuizTopic.description_key` (Zeile 92 in `models.py`), aber:
  - Im Frontend (quiz-topics.js) wird `description` gerendert, aber oft leer.
  - Keine Default-Logik für aussagekräftige Descriptions.
- **`authors`:** **Komplett fehlend.**
  - Weder in `QuizTopic` noch in `QuizQuestion` Model.
  - Weder in `validation.py` Schema.
  - JSON-Format (`seed_quiz_content.py`) hat `author_initials` auf Question-Ebene, aber wird nicht in DB persistiert.

---

## 4. Ist-Stand: DB / Models

### Relevante Tabellen

**Pfad:** `game_modules/quiz/models.py`

#### `QuizTopic` (Zeile 84-94)
```python
class QuizTopic(QuizBase):
    __tablename__ = "quiz_topics"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    title_key: Mapped[str] = mapped_column(String(100), nullable=False)  # i18n key
    description_key: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    questions: Mapped[List["QuizQuestion"]] = relationship(...)
```

**Felder für Card-Infos:**
- ✅ `title_key` (i18n key)
- ✅ `description_key` (i18n key, optional)
- ❌ **`authors` fehlt** – mögliche Optionen:
  - Neues Feld: `authors: Mapped[Optional[str]]` (Text-Komma-Liste)
  - PostgreSQL: `authors: Mapped[Optional[List[str]]]` + `mapped_column(ARRAY(String))` (native Array)
  - JSONB: `authors: Mapped[Optional[dict]]` + `mapped_column(JSONB)` → `{"authors": ["AB", "CD"]}`

#### `QuizQuestion` (Zeile 98-121)
```python
class QuizQuestion(QuizBase):
    __tablename__ = "quiz_questions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    topic_id: Mapped[str] = mapped_column(String(50), ForeignKey(...), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="single_choice")
    prompt_key: Mapped[str] = mapped_column(String(100), nullable=False)
    explanation_key: Mapped[str] = mapped_column(String(100), nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, nullable=False)  # [{id, text_key, correct}, ...]
    media: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    sources: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
```

**Observations:**
- `sources` (JSONB) existiert → könnte genutzt werden für bibliographische Referenzen.
- Kein `author` Feld auf Question-Level.

### Wo `authors` sinnvoll wäre

**Empfehlung:** Topic-Level (`QuizTopic`), da ein Quiz-Unit meist ein konsistentes Autoren-Team hat.

**Implementierungs-Optionen:**
1. **PostgreSQL ARRAY (native):**
   ```python
   from sqlalchemy import ARRAY, String
   authors: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True)
   ```
   → Pro: typsicher, effizient. Con: PostgreSQL-only (aber Quiz-Modul ist bereits PostgreSQL-only).

2. **JSONB:**
   ```python
   authors: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
   # Speichern als: {"authors": ["AB", "CD", "EF"]}
   ```
   → Pro: flexibel (später mehr Metadaten). Con: lose Schema-Kontrolle.

3. **Text (Komma-getrennt):**
   ```python
   authors: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
   # Speichern als: "AB, CD, EF"
   ```
   → Pro: simpel. Con: keine strukturierte Query-Möglichkeit.

**Favorit:** Option 1 (ARRAY) – passt zum PostgreSQL-Profil des Projekts.

---

## 5. Ist-Stand: Seeding

### Seed-Implementierungen

#### A) `game_modules/quiz/seed.py`

**Funktion:** `import_topic_from_yaml()` (Zeile 49-108)

**Logik:**
- Lädt YAML via `load_yaml_file()`
- Validiert via `validate_topic_content()` → `validation.py`
- Upsert Topic: `session.query(QuizTopic).filter(QuizTopic.id == topic_id).first()` → wenn None: `session.add()`
- Upsert Questions: foreach Question → check `session.query(QuizQuestion).filter(QuizQuestion.id == q_id).first()` → update existierende oder `session.add()` neue
- `session.flush()`

**Idempotent:** ✅ Ja (upsert)  
**Transaktion:** Teilweise – `session.flush()` aber kein explizites `session.commit()` innerhalb Funktion (Caller muss commit).  
**Prune:** ❌ Nein – alte Fragen, die nicht mehr im YAML sind, bleiben in DB.

#### B) `scripts/seed_quiz_content.py`

**Funktion:** Standalone CLI-Tool (Zeile 1-465)

**Logik:**
- Lädt JSON (eigenes Format mit `schema_version: "quiz_seed_v1"`)
- Generiert deterministische IDs via SHA256-Hash (`generate_question_id()`)
- SQLAlchemy bulk upserts:
  ```python
  session.execute(update(...).where(...))  # or insert if not exists
  session.commit()
  ```

**Idempotent:** ✅ Ja (deterministische IDs + upsert)  
**Transaktion:** ✅ Ja – `session.commit()` am Ende  
**Prune:** ❌ Nein

#### C) `seed_quiz_data.sql`

**Funktion:** Manuelles SQL-Script (Zeile 1-71 in `seed_quiz_data.sql`)

**Logik:**
```sql
INSERT INTO quiz_topics (...) VALUES (...) ON CONFLICT (id) DO NOTHING;
INSERT INTO quiz_questions (...) VALUES (...);  -- kein ON CONFLICT, würde bei Duplikaten fehlschlagen
```

**Idempotent:** ⚠️ Teilweise – Topics ja (DO NOTHING), Questions nein (würde bei re-run crashen wenn IDs kollidieren).  
**Transaktion:** ❌ Nein (kein explizites BEGIN/COMMIT, aber psql default ist auto-commit pro Statement).

### Automatisches Triggering

**Befund:** ❌ **Kein automatisches Seeding beim Dev-Start.**

**Geprüfte Stellen:**
- `src/app/__init__.py:create_app()` (Zeile 73-411): Keine Quiz-Seed-Initialisierung.
- `scripts/dev-start.ps1` (Zeile 1-100): Startet nur Flask, kein Seed-Aufruf.
- `game_modules/quiz/__init__.py` (Zeile 1-14): Registriert nur Blueprint, kein Startup-Hook.

**Status:** Developer müssen manuell seeden.

---

## 6. Soll-Ziel: Quiz Units

### Zielpfad

```
game_modules/quiz/quiz_units/
├── README.md                     # Erklärung für Content-Autoren
├── schema.json                   # JSON-Schema für Validation
└── topics/
    ├── demo_topic.json           # 1 JSON pro Quiz-Unit
    ├── grammar_basics.json
    ├── literature_golden_age.json
    └── ...
```

### Unterstruktur Details

#### `quiz_units/README.md`

**Inhalt:**
- Was ist eine Quiz-Unit?
- JSON-Schema-Dokumentation (Felder: `slug`, `title`, `description`, `authors`, `questions`)
- Wie füge ich eine neue Unit hinzu? (JSON erstellen → Dev-Start lädt automatisch)
- Best Practices (Naming, Authors-Format, Difficulty-Balance)

#### `quiz_units/schema.json`

**JSON-Schema für Validation:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["slug", "title", "questions"],
  "properties": {
    "slug": { "type": "string", "pattern": "^[a-z0-9_]+$" },
    "title": { "type": "string", "minLength": 3 },
    "description": { "type": "string" },
    "authors": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "questions": {
      "type": "array",
      "minItems": 10,
      "items": {
        "type": "object",
        "required": ["prompt", "difficulty", "correct_answer", "wrong_answers"],
        "properties": {
          "prompt": { "type": "string" },
          "difficulty": { "type": "integer", "minimum": 1, "maximum": 5 },
          "correct_answer": { "type": "string" },
          "wrong_answers": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": { "type": "string" }
          },
          "explanation": { "type": "string" },
          "media": { "type": "object" },
          "sources": { "type": "array" }
        }
      }
    }
  }
}
```

#### `quiz_units/topics/*.json` (Beispiel)

**Dateiname:** `demo_topic.json` (slug = `demo_topic`)

```json
{
  "slug": "demo_topic",
  "title": "Demo-Quiz: Erste Schritte",
  "description": "Ein einfaches Beispiel-Quiz zum Kennenlernen der Spielmechanik.",
  "authors": ["AB", "CD"],
  "questions": [
    {
      "prompt": "Welche Farbe hat der Himmel?",
      "difficulty": 1,
      "correct_answer": "Blau",
      "wrong_answers": ["Grün", "Rot", "Gelb"],
      "explanation": "Der Himmel ist blau wegen Rayleigh-Streuung.",
      "media": null,
      "sources": [{"type": "wikipedia", "url": "https://de.wikipedia.org/wiki/Himmel"}]
    }
    // ... 9 more questions (total 10)
  ]
}
```

### Naming-Konzept

**Slug-basiert:**
- Dateiname = `{slug}.json`
- `slug` muss match: `^[a-z0-9_]+$` (lowercase, Underscores erlaubt)
- Beispiele:
  - `demo_topic.json`
  - `grammar_basics.json`
  - `literature_golden_age.json`

**Warum Slug statt ID:**
- URL-freundlich (z.B. `/games/quiz/demo_topic`)
- Human-readable
- Git-freundlich (lesbares Diff)

---

## 7. Soll-Ziel: Robust Seed in DEV

### Anforderungen

1. **Automatisch beim Dev-Start:** Seed läuft bei `scripts/dev-start.ps1` oder Flask-App-Startup.
2. **Idempotent:** Mehrfaches Ausführen schadet nicht (upsert, keine Duplikate).
3. **Optional: Hash-basiert "seed_if_changed":** Nur seeden wenn JSON geändert wurde (Performance-Optimierung für große Content-Mengen).
4. **Validation:** JSON wird gegen Schema validiert, fehlerhafte Units werden abgelehnt mit klarer Fehlermeldung.
5. **Prune-Option:** Optional Flag `--prune` um Topics/Questions zu löschen, die nicht mehr im Content-Ordner sind (für Dev-Cleanup).
6. **Transaktional:** Bei Fehler Rollback, keine halb-importierten Units.

### Prod-Abgrenzung

**In DEV:** Seed bei jedem Start (oder bei Änderung).  
**In PROD:** **Kein Auto-Seed.** Deployment-Pipeline triggert Seed explizit als separater Step (z.B. via CI/CD, Kubernetes Job, oder Admin-API).

**Empfehlung für später:**
- Environment-Variable: `QUIZ_AUTO_SEED=true` (nur in Dev-Umgebungen gesetzt)
- Prod-Config: `QUIZ_AUTO_SEED=false` oder undefined.

### Hash-basierte Optimierung ("seed_if_changed")

**Konzept:**
- Berechne SHA256-Hash aller JSON-Files im `quiz_units/topics/` Ordner.
- Speichere Hash in DB-Metadaten-Tabelle: `quiz_seed_metadata (key, value)` → `("content_hash", "abc123...")`.
- Bei Start: Berechne aktuellen Hash → vergleiche mit DB-Hash → wenn identisch: skip seeding.
- Bei Änderung: neuer Hash → re-seed → update DB-Hash.

**Implementierung:**
```python
def get_content_hash(topics_dir: Path) -> str:
    """Calculate SHA256 hash of all JSON files in topics/ (sorted by filename)."""
    hasher = hashlib.sha256()
    for json_file in sorted(topics_dir.glob("*.json")):
        with open(json_file, "rb") as f:
            hasher.update(f.read())
    return hasher.hexdigest()

def should_seed(session: Session, topics_dir: Path) -> bool:
    """Check if content has changed since last seed."""
    current_hash = get_content_hash(topics_dir)
    stored_hash = session.execute(
        select(QuizSeedMetadata.value).where(QuizSeedMetadata.key == "content_hash")
    ).scalar_one_or_none()
    return current_hash != stored_hash

def update_content_hash(session: Session, topics_dir: Path):
    """Update stored content hash after successful seed."""
    current_hash = get_content_hash(topics_dir)
    # Upsert metadata
    session.execute(
        insert(QuizSeedMetadata).values(key="content_hash", value=current_hash)
        .on_conflict_do_update(index_elements=["key"], set_={"value": current_hash})
    )
```

**Neue Tabelle (optional):**
```python
class QuizSeedMetadata(QuizBase):
    __tablename__ = "quiz_seed_metadata"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
```

---

## 8. Konkrete ToDo-Liste (Dateien + Schritte)

### Phase 1: Content-Struktur + Schema

#### 1.1 Content-Ordner erstellen
- **Datei:** ✅ `game_modules/quiz/quiz_units/` (bereits erledigt in diesem Audit)
- **Aktion:**
  ```bash
  mkdir -p game_modules/quiz/quiz_units/topics
  ```

#### 1.2 README für Content-Autoren
- **Datei:** `game_modules/quiz/quiz_units/README.md`
- **Aktion:** Schreiben:
  - Was ist eine Quiz-Unit?
  - JSON-Schema-Erklärung
  - Beispiel-JSON
  - Wie man eine neue Unit hinzufügt
  - Authors-Format (Initialen-Liste)

#### 1.3 JSON-Schema erstellen
- **Datei:** `game_modules/quiz/quiz_units/schema.json`
- **Aktion:** Schreiben (siehe Abschnitt 6).

#### 1.4 Erste Beispiel-Unit erstellen
- **Datei:** `game_modules/quiz/quiz_units/topics/demo_topic.json`
- **Aktion:** Migrieren von existierendem Content (z.B. aus `de.yml` oder `seed_quiz_data.sql`) → vollständiges JSON mit `authors`, `description`, 10 Fragen.

---

### Phase 2: Validation + Seeding-Logik

#### 2.1 Validation erweitern
- **Datei:** `game_modules/quiz/validation.py`
- **Änderungen:**
  - Neues Schema `QuizUnitSchema`:
    ```python
    @dataclass
    class QuizUnitSchema:
        slug: str
        title: str
        description: str
        authors: List[str]  # Neu!
        questions: List[QuestionSchema]
    ```
  - Funktion `validate_quiz_unit(data: Dict[str, Any]) -> tuple[QuizUnitSchema, List[str]]`
  - JSON-Schema-Validation mit `jsonschema` package (optional, aber empfohlen).

#### 2.2 Seed-Funktion für JSON-Units
- **Datei:** `game_modules/quiz/seed.py`
- **Neue Funktionen:**
  ```python
  def import_unit_from_json(session: Session, json_path: Path) -> tuple[QuizTopic, int]:
      """Import a quiz unit from JSON file (new format)."""
      # 1. Load JSON
      # 2. Validate against schema
      # 3. Upsert QuizTopic (including authors!)
      # 4. Upsert QuizQuestions
      # 5. Return (topic, questions_count)
  
  def seed_all_units(session: Session, units_dir: Path, prune: bool = False) -> Dict[str, int]:
      """Import all quiz units from quiz_units/topics/*.json."""
      # 1. Glob all *.json
      # 2. Foreach: import_unit_from_json()
      # 3. If prune: delete topics not in JSON files
      # 4. Return {slug: questions_count}
  
  def get_content_hash(topics_dir: Path) -> str:
      """Calculate SHA256 hash of all JSON files."""
  
  def should_seed(session: Session, topics_dir: Path) -> bool:
      """Check if content has changed since last seed."""
  
  def seed_if_changed(session: Session, units_dir: Path):
      """Seed only if content hash changed (idempotent optimization)."""
  ```

#### 2.3 ID-Generierung
- **Datei:** `game_modules/quiz/seed.py`
- **Aktion:** Übernehmen von `scripts/seed_quiz_content.py:generate_question_id()` (deterministische SHA256-basierte IDs).

---

### Phase 3: Models + Migration

#### 3.1 QuizTopic erweitern (authors)
- **Datei:** `game_modules/quiz/models.py`
- **Änderung:**
  ```python
  from sqlalchemy import ARRAY, String
  
  class QuizTopic(QuizBase):
      # ... existing fields
      authors: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True)
  ```

#### 3.2 QuizSeedMetadata Tabelle (optional, für Hash-Tracking)
- **Datei:** `game_modules/quiz/models.py`
- **Aktion:** Neue Model-Klasse (siehe Abschnitt 7).

#### 3.3 Alembic Migration erstellen
- **Aktion:**
  ```bash
  alembic revision -m "Add authors to QuizTopic and QuizSeedMetadata table"
  ```
- **Migration-File:** Editieren:
  ```python
  def upgrade():
      op.add_column('quiz_topics', sa.Column('authors', postgresql.ARRAY(sa.String()), nullable=True))
      op.create_table('quiz_seed_metadata', ...)
  
  def downgrade():
      op.drop_column('quiz_topics', 'authors')
      op.drop_table('quiz_seed_metadata')
  ```
- **Apply Migration:** `alembic upgrade head`

---

### Phase 4: Startup-Hook in DEV

#### 4.1 Dev-Seed-Hook in Flask App
- **Datei:** `src/app/__init__.py`
- **Änderung:** In `create_app()` nach DB-Initialisierung:
  ```python
  # Auto-seed quiz content in development
  if app.config.get("ENV") == "development" and app.config.get("QUIZ_AUTO_SEED", True):
      from game_modules.quiz.seed import seed_if_changed
      from game_modules.quiz import QUIZ_UNITS_DIR
      with get_session() as session:
          try:
              seed_if_changed(session, QUIZ_UNITS_DIR)
              session.commit()
              app.logger.info("Quiz content seeded successfully.")
          except Exception as e:
              session.rollback()
              app.logger.error(f"Quiz content seeding failed: {e}")
  ```

#### 4.2 Quiz-Module exportiert QUIZ_UNITS_DIR
- **Datei:** `game_modules/quiz/__init__.py`
- **Änderung:**
  ```python
  from pathlib import Path
  QUIZ_UNITS_DIR = Path(__file__).parent / "quiz_units"
  __all__ = ["quiz_blueprint", "QUIZ_UNITS_DIR"]
  ```

#### 4.3 Environment-Variable
- **Datei:** `scripts/dev-start.ps1`
- **Änderung:** Setze `$env:QUIZ_AUTO_SEED = "true"` (optional, da Dev-Mode bereits default True).

---

### Phase 5: Frontend (Authors + Description)

#### 5.1 API erweitern (Authors in Response)
- **Datei:** `game_modules/quiz/routes.py`
- **Änderung:** In `api_get_topics()` (Zeile 209-224):
  ```python
  return jsonify({
      "topics": [
          {
              "topic_id": t.id,
              "title_key": t.title_key,
              "description_key": t.description_key,
              "description": t.description_key or "",  # Fallback
              "authors": t.authors or [],  # Neu!
              "href": f"/games/quiz/{t.id}",
          }
          for t in topics
      ]
  })
  ```

#### 5.2 Frontend rendert Authors + Description
- **Datei:** `static/js/games/quiz-topics.js`
- **Änderung:** In `renderTopics()` (Zeile 45-90):
  ```javascript
  let description = topic.description || topic.description_key || '';
  let authors = topic.authors && topic.authors.length > 0 
      ? `Von: ${topic.authors.join(', ')}` 
      : '';
  
  return `
    <div class="quiz-topic-card">
      <h2>${escapeHtml(title)}</h2>
      ${description ? `<p class="quiz-topic-card__description">${escapeHtml(description)}</p>` : ''}
      ${authors ? `<p class="quiz-topic-card__authors">${escapeHtml(authors)}</p>` : ''}
      <a href="${escapeHtml(topic.href)}" class="quiz-btn quiz-btn--primary">Spielen</a>
    </div>
  `;
  ```

#### 5.3 CSS anpassen (Description Truncation)
- **Datei:** `static/css/games/quiz.css`
- **Aktion:** Füge hinzu:
  ```css
  .quiz-topic-card__description {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;  /* Max 3 Zeilen */
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.875rem;
      line-height: 1.4;
      margin-bottom: 0.5rem;
  }
  
  .quiz-topic-card__authors {
      font-size: 0.75rem;
      color: var(--md-sys-color-on-surface-variant);
      font-style: italic;
      margin-bottom: 1rem;
  }
  ```

---

### Phase 6: Testing + Documentation

#### 6.1 Unit-Tests für Seed
- **Datei:** `tests/game_modules/quiz/test_seed.py` (neu)
- **Aktion:**
  - Test `test_import_unit_from_json_valid()`
  - Test `test_import_unit_from_json_invalid_schema()`
  - Test `test_seed_if_changed_no_change()`
  - Test `test_seed_if_changed_with_change()`
  - Test `test_prune_removed_topics()`

#### 6.2 Integration-Test (E2E)
- **Datei:** `tests/e2e/test_quiz_seed.py` (neu)
- **Aktion:**
  - Start App → check `/api/quiz/topics` → verify authors, description in response.

#### 6.3 Dokumentation aktualisieren
- **Datei:** `game_modules/quiz/README.md`
- **Änderung:**
  - Update "Content Management" Sektion: neue JSON-Unit-Struktur, Auto-Seed in Dev.
  - Entferne veraltete Referenzen auf manuelle Seed-Scripts.

---

## 9. Anhang: Relevante Codeauszüge

### A) Seed-Logik (`game_modules/quiz/seed.py`)

**Zeile 49-108** – `import_topic_from_yaml()`:
```python
def import_topic_from_yaml(
    session: Session,
    yaml_path: Path,
    i18n_locale: str = "de",
    validate_i18n: bool = True,
) -> tuple[QuizTopic, int]:
    """Import a topic and its questions from YAML file."""
    logger.info(f"Importing topic from {yaml_path}")
    
    # Load and validate content
    data = load_yaml_file(yaml_path)
    topic_content = validate_topic_content(data)
    
    # Optionally validate i18n keys
    if validate_i18n:
        i18n_data = get_i18n_data(i18n_locale)
        if i18n_data:
            i18n_errors = validate_i18n_keys(topic_content, i18n_data)
            # ... warnings only, no fail
    
    # Get or create topic
    topic = session.query(QuizTopic).filter(QuizTopic.id == topic_content.topic_id).first()
    if not topic:
        topic = QuizTopic(
            id=topic_content.topic_id,
            title_key=title_key,
            description_key=f"topics.{topic_content.topic_id}.description",
            is_active=True,
            order_index=0,
            created_at=datetime.now(timezone.utc),
        )
        session.add(topic)
    
    # Import/update questions (foreach loop, upsert)
    # ...
    session.flush()
    return topic, questions_count
```

**Zeile 160-178** – `seed_demo_topic()`:
```python
def seed_demo_topic(session: Session) -> bool:
    """Seed the demo topic with questions."""
    demo_yaml = TOPICS_DIR / "demo_topic.yml"
    
    if not demo_yaml.exists():
        logger.error(f"Demo topic YAML not found at {demo_yaml}")
        return False
    
    # Check if demo topic already has questions
    existing_count = session.query(QuizQuestion).filter(
        QuizQuestion.topic_id == "demo_topic"
    ).count()
    
    if existing_count >= 10:
        logger.info("Demo topic already seeded with questions")
        return False
    
    try:
        topic, count = import_topic_from_yaml(session, demo_yaml, validate_i18n=False)
        logger.info(f"Seeded demo topic with {count} questions")
        return True
    except (ValidationError, Exception) as e:
        logger.error(f"Failed to seed demo topic: {e}")
        raise
```

**Observations:**
- Seed-Funktionen sind vorhanden, aber werden nicht automatisch aufgerufen.
- Keine Hash-basierte Optimierung.
- Keine Prune-Logik.

---

### B) API Route (`game_modules/quiz/routes.py`)

**Zeile 209-224** – `/api/quiz/topics`:
```python
@blueprint.route("/api/quiz/topics")
def api_get_topics():
    """Get list of active quiz topics."""
    with get_session() as session:
        topics = services.get_active_topics(session)
        return jsonify({
            "topics": [
                {
                    "topic_id": t.id,
                    "title_key": t.title_key,
                    "description_key": t.description_key,
                    "href": f"/games/quiz/{t.id}",
                }
                for t in topics
            ]
        })
```

**Missing:** `authors` im Response.

---

### C) Frontend (`static/js/games/quiz-topics.js`)

**Zeile 45-90** – `renderTopics()`:
```javascript
function renderTopics(container, topics) {
  if (topics.length === 0) {
    container.innerHTML = `<div class="quiz-empty">Keine Quiz-Themen verfügbar.</div>`;
    return;
  }

  const html = topics.map(topic => {
    let title = topic.title_key || topic.topic_id || 'Quiz';
    let description = topic.description_key || '';
    
    // Try to get i18n translations if QuizI18n is available
    if (window.QuizI18n && typeof window.QuizI18n.getTopicTitle === 'function') {
      const i18nTitle = window.QuizI18n.getTopicTitle(topic.topic_id);
      if (i18nTitle && i18nTitle !== topic.topic_id) {
        title = i18nTitle;
      }
      
      const i18nDesc = window.QuizI18n.getTopicDescription(topic.topic_id);
      if (i18nDesc && i18nDesc !== topic.topic_id) {
        description = i18nDesc;
      }
    }
    
    return `
      <div class="quiz-topic-card">
        <div class="quiz-topic-card__icon">
          <span class="material-symbols-rounded">quiz</span>
        </div>
        <h2 class="quiz-topic-card__title">${escapeHtml(title)}</h2>
        ${description ? `<p class="quiz-topic-card__description">${escapeHtml(description)}</p>` : ''}
        <a href="${escapeHtml(topic.href)}" class="quiz-btn quiz-btn--primary">
          <span>Spielen</span>
        </a>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}
```

**Observations:**
- Description wird gerendert (falls vorhanden), aber oft leer.
- Keine Authors-Darstellung.

---

### D) Models (`game_modules/quiz/models.py`)

**Zeile 84-94** – `QuizTopic`:
```python
class QuizTopic(QuizBase):
    __tablename__ = "quiz_topics"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    title_key: Mapped[str] = mapped_column(String(100), nullable=False)
    description_key: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
```

**Missing:** `authors` column.

---

### E) Validation (`game_modules/quiz/validation.py`)

**Zeile 43-49** – `TopicContentSchema`:
```python
@dataclass
class TopicContentSchema:
    """Complete topic content file."""
    topic_id: str
    questions: List[QuestionSchema]
```

**Missing:** `authors`, `description` (nur `topic_id` und `questions`).

---

## 10. Nächste Schritte (Quick-Win Priorität)

1. **Phase 1.4:** Erstelle `demo_topic.json` mit vollständigem Content (authors, description, 10 Fragen).
2. **Phase 2.1 + 2.2:** Erweitere Validation + implementiere `import_unit_from_json()` in `seed.py`.
3. **Phase 3.1 + 3.3:** Füge `authors` Column zu `QuizTopic` hinzu via Migration.
4. **Phase 4.1 + 4.2:** Implementiere Auto-Seed-Hook in `create_app()`.
5. **Phase 5.1 + 5.2:** API + Frontend erweitern um Authors-Darstellung.
6. **Phase 6.1 + 6.3:** Tests schreiben + Doku aktualisieren.

---

## 11. Offene Fragen / Unklar

- **i18n-Strategie für neue Units:** Sollen Quiz-Units weiterhin i18n-Keys verwenden, oder direkte Texte (mit separater i18n-Layer später)?  
  → **Empfehlung:** Für schnelle Iteration direkte Texte in JSON. Später optional i18n-Layer (z.B. Transifex-Integration).
  
- **Prune-Strategie in Prod:** Wie soll Deletion von obsoleten Topics gehandhabt werden?  
  → **Empfehlung:** Manueller Admin-Workflow (nicht automatisch prunen in Prod). Dev: optional `--prune` Flag.

- **Versionierung von Quiz-Units:** Soll es eine Version-History geben (z.B. via Git-Tags, oder DB-basiert)?  
  → **Empfehlung:** Git-basiert (Content as Code). DB speichert nur aktuellen Stand.

---

**Ende des Audits.**
