# Quiz Content – JSON Schema & Validation

**Purpose:** Definiert quiz_unit_v2 Format, Regeln, Beispiele.

**Markdown-Regeln:** Siehe [CONTENT_MARKDOWN.md](CONTENT_MARKDOWN.md)

---

## Schema Version

**Current:** `quiz_unit_v2` (mit Media Arrays)
**Legacy:** `quiz_unit_v1` (single media string, deprecated)

**Code:** `game_modules/quiz/validation.py:321` – `SUPPORTED_SCHEMA_VERSIONS = {'quiz_unit_v1', 'quiz_unit_v2'}`

---

## File Structure

**Path (DEV):** `content/quiz/topics/<topic_slug>.json`
**Path (Production):** `media/releases/<release_id>/units/<topic_slug>.json`

**Example Filename:** `aussprache.json`, `grammatik_modalverben.json`

---

## Top-Level Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Quiz Unit v2",
  "type": "object",
  "required": ["schemaVersion", "topic", "questions"],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "enum": ["quiz_unit_v2"]
    },
    "topic": {
      "type": "object",
      "required": ["id", "title_key", "description_key"],
      "properties": {
        "id": "...",
        "title_key": "...",
        "description_key": "...",
        "authors": "..."
      }
    },
    "questions": {
      "type": "array",
      "items": "..."
    }
  }
}
```

---

## Topic Object

```json
{
  "id": "aussprache",
  "title_key": "Aussprache & Akzente",
  "description_key": "Teste dein Wissen über die korrekte Aussprache spanischer Wörter.",
  "authors": ["Dr. Maria Garcia", "Prof. Juan Lopez"]
}
```

**Fields:**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | ✅ | Lowercase slug, no spaces, max 50 chars |
| `title_key` | string | ✅ | Plaintext (no i18n), max 100 chars |
| `description_key` | string | ✅ | Plaintext, max 500 chars |
| `authors` | string[] | ❌ | Array of author names |

**Validation:**
- `id` must match filename (e.g., `aussprache.json` → `"id": "aussprache"`)
- `title_key` and `description_key` are **plaintext** (not i18n keys)
- `authors` can be empty array

---

## Question Object

```json
{
  "id": "aussprache_q_01KE59P9ABC123XYZ456",
  "type": "single_choice",
  "difficulty": 3,
  "prompt_key": "Welches Wort hat den Akzent auf der letzten Silbe?",
  "answers": [...],
  "explanation_key": "Im Spanischen enden Wörter mit Akzent auf der letzten Silbe oft auf Vokal.",
  "media": [...],
  "sources": [...],
  "meta": {...}
}
```

**Fields:**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | ✅ | ULID format: `<topic>_q_<26-char-ulid>` |
| `type` | string | ❌ | Default: `"single_choice"` (only type supported) |
| `difficulty` | integer | ✅ | 1-3 |
| `prompt_key` | string | ✅ | Plaintext question, max 500 chars |
| `answers` | array | ✅ | 2-6 answers, exactly 1 correct |
| `explanation_key` | string | ❌ | Plaintext explanation, shown after answer |
| `media` | array | ❌ | Media items (images, audio) |
| `sources` | array | ❌ | References (books, URLs) |
| `meta` | object | ❌ | Arbitrary metadata |

### ID Format (ULID)

**Structure:** `<topic_id>_q_<26-char-ulid>`

**Example:** `aussprache_q_01KE59P9ABC123XYZ456`

**Generator:**
```python
import ulid
question_id = f"{topic_id}_q_{ulid.new()}"
```

**Rules:**
- Must start with topic_id
- Must contain `_q_` separator
- ULID part is **exactly 26 chars** (Crockford's Base32)
- ULIDs are time-sortable (first 10 chars = timestamp)

### Difficulty Distribution

| Difficulty | Questions per Run | Recommended per Topic |
|------------|-------------------|----------------------|
| 1 | 4 | 10+ |
| 2 | 4 | 10+ |
| 3 | 2 | 10+ |

**Total:** Min 30 questions per topic (für Variety), optimal 60+.

---

## Answer Object

```json
{
  "id": "a1",
  "text": "café",
  "correct": true,
  "media": [...]
}
```

**Fields:**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | ✅ | Unique within question (a1, a2, a3, a4) |
| `text` | string | ✅ | Plaintext answer, max 200 chars |
| `correct` | boolean | ✅ | Exactly **1 answer** must be `true` |
| `media` | array | ❌ | Media items (images, audio) |

**Validation:**
- Exactly **1 answer** has `"correct": true`
- All other answers have `"correct": false`
- Min 2 answers, max 6 answers
- `id` must be unique (a1, a2, a3, a4, a5, a6)

**Order:**
- Frontend randomizes answer order (not fixed in JSON)
- `id` used for backend validation (not display order)

---

## Media Object

```json
{
  "id": "img_pronunciation_example",
  "type": "image",
  "seed_src": "aussprache_accent_diagram.jpg",
  "label": "Akzent-Diagramm"
}
```

**Fields:**

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | string | ✅ | Unique identifier (for reference) |
| `type` | string | ✅ | `"image"` or `"audio"` |
| `seed_src` | string | ✅ | Filename (relative to audio/ or units/) |
| `label` | string | ❌ | Display label (alt text, caption) |

**Types:**
- `"image"` – PNG, JPG, WebP
- `"audio"` – MP3, OGG

**Path Resolution:**

**DEV:**
```
seed_src: "accent_diagram.jpg"
→ content/quiz/topics/aussprache/accent_diagram.jpg
→ media/quiz/<topic_id>/accent_diagram.jpg (after seed)
```

**Production:**
```
seed_src: "accent_diagram.jpg"
→ media/releases/<release_id>/audio/accent_diagram.jpg
→ media/quiz/<release_id>/accent_diagram.jpg (after import)
```

**Database Storage:**
- `media` array stored as **JSONB** in `quiz_questions.media`
- `seed_src` replaced with hash-based filename: `<sha256>.ext`

---

## Sources Object (Optional)

```json
{
  "sources": [
    {
      "type": "book",
      "title": "Gramática Española",
      "author": "Juan Lopez",
      "publisher": "Editorial XYZ",
      "year": 2020,
      "page": 42
    },
    {
      "type": "url",
      "url": "https://rae.es/drae/café",
      "title": "RAE: café",
      "accessed": "2025-01-06"
    }
  ]
}
```

**Types:**
- `"book"` – Book reference
- `"url"` – Web reference
- `"other"` – Arbitrary source

**No validation:** Freeform object, für Authoring-Traceability.

---

## Meta Object (Optional)

```json
{
  "meta": {
    "reviewed_by": "Prof. Garcia",
    "reviewed_at": "2025-01-01",
    "difficulty_rationale": "Requires understanding of syllable stress rules",
    "tags": ["phonetics", "stress", "beginner-friendly"]
  }
}
```

**No schema:** Arbitrary metadata, nicht von Backend verwendet.

---

## Validation Rules

### Required Fields Check

```python
# validation.py
def validate_quiz_unit(data: dict):
    assert data.get('schemaVersion') == 'quiz_unit_v2'
    assert 'topic' in data
    assert 'questions' in data
    validate_topic(data['topic'])
    for q in data['questions']:
        validate_question(q)
```

### Answer Correctness

```python
def validate_question(q: dict):
    answers = q['answers']
    correct_count = sum(1 for a in answers if a.get('correct') == True)
    assert correct_count == 1, "Exactly one answer must be correct"
```

### ID Uniqueness

```python
def validate_question_ids(questions: list):
    ids = [q['id'] for q in questions]
    assert len(ids) == len(set(ids)), "Question IDs must be unique"
```

### Media File Existence (DEV)

```python
def validate_media_files(media: list, base_path: Path):
    for item in media:
        file_path = base_path / item['seed_src']
        assert file_path.exists(), f"Media not found: {item['seed_src']}"
```

---

## Example Unit

**File:** `content/quiz/topics/aussprache.json`

```json
{
  "schemaVersion": "quiz_unit_v2",
  "topic": {
    "id": "aussprache",
    "title_key": "Aussprache & Akzente",
    "description_key": "Teste dein Wissen über die korrekte Aussprache spanischer Wörter.",
    "authors": ["Dr. Maria Garcia"]
  },
  "questions": [
    {
      "id": "aussprache_q_01KE59P9ABC123XYZ456",
      "type": "single_choice",
      "difficulty": 1,
      "prompt_key": "Wie wird das Wort 'café' ausgesprochen?",
      "answers": [
        {
          "id": "a1",
          "text": "ca-FÉ (Akzent auf letzter Silbe)",
          "correct": true
        },
        {
          "id": "a2",
          "text": "CÁ-fe (Akzent auf erster Silbe)",
          "correct": false
        },
        {
          "id": "a3",
          "text": "ca-fe (kein Akzent)",
          "correct": false
        }
      ],
      "explanation_key": "Das Wort 'café' hat einen geschriebenen Akzent auf dem é, was bedeutet, dass die Betonung auf der letzten Silbe liegt.",
      "media": [
        {
          "id": "audio_cafe",
          "type": "audio",
          "seed_src": "cafe_pronunciation.mp3",
          "label": "Aussprache von 'café'"
        }
      ]
    },
    {
      "id": "aussprache_q_01KE59PADEF456UVW789",
      "type": "single_choice",
      "difficulty": 2,
      "prompt_key": "Welches Wort hat den Akzent NICHT auf der vorletzten Silbe?",
      "answers": [
        {
          "id": "a1",
          "text": "música",
          "correct": false
        },
        {
          "id": "a2",
          "text": "jardín",
          "correct": true
        },
        {
          "id": "a3",
          "text": "ventana",
          "correct": false
        },
        {
          "id": "a4",
          "text": "profesor",
          "correct": false
        }
      ],
      "explanation_key": "'jardín' hat den Akzent auf der letzten Silbe (wegen des geschriebenen Akzents). Die anderen Wörter folgen der Standard-Betonungsregel (vorletzte Silbe)."
    }
  ]
}
```

---

## Legacy Format (quiz_unit_v1)

**Deprecated:** Use quiz_unit_v2 for new content.

**Difference:**
- `media` is **single string** (not array)
- `media` is **optional** (not always array)

**Example:**
```json
{
  "schemaVersion": "quiz_unit_v1",
  "questions": [
    {
      "id": "q1",
      "media": "audio_file.mp3"
    }
  ]
}
```

**Migration:** Use `scripts/quiz_units_normalize.py` to convert v1 → v2.

---

## Authoring Guidelines

### Question Quality

**Good Questions:**
- ✅ Clear, unambiguous prompt
- ✅ Exactly 1 correct answer
- ✅ Plausible distractors (not obviously wrong)
- ✅ Explanation that teaches (not just "this is correct")

**Bad Questions:**
- ❌ Trick questions (relying on misleading wording)
- ❌ Multiple correct answers
- ❌ Obvious distractors ("The answer is always X")
- ❌ No explanation

### Difficulty Levels

| Level | Description | Example |
|-------|-------------|---------|
| 1 | Basic recognition, definitions | "Wie sagt man 'Hallo' auf Spanisch?" |
| 2 | Application, simple grammar | "Welche Form ist korrekt: 'Yo hablo' oder 'Yo habla'?" |
| 3 | Analysis, exceptions | "Welches Verb ist unregelmäßig im Präteritum?" |

### Media Usage

**When to use:**
- Audio: Pronunciation, listening comprehension
- Images: Visual context, diagrams, cultural references

**When NOT to use:**
- Text-only questions (unnecessary complexity)
- Large files (>5MB, slows loading)
- Copyrighted material (unless licensed)

### Content Coverage

**Balanced Distribution:**
- All 3 difficulty levels represented
- 30+ questions per topic (min)
- No duplication (same question with different wording)

---

## Normalization

**Tool:** `scripts/quiz_units_normalize.py`

**Purpose:** Converts quiz_unit_v1 → v2, validates schema, fixes common issues.

**Usage:**
```powershell
python scripts/quiz_units_normalize.py
```

**Changes:**
- Adds `schemaVersion: "quiz_unit_v2"`
- Converts `media: "file.mp3"` → `media: [{"id":"auto","type":"audio","seed_src":"file.mp3"}]`
- Validates all required fields
- Generates ULIDs for questions without IDs

**Output:** Normalized files in-place (backs up originals as `.bak`).

---

## Import Process

**DEV:**
1. Write JSON to `content/quiz/topics/<topic>.json`
2. Run `python scripts/quiz_seed.py` (imports to DB)
3. Media copied to `media/quiz/<topic_id>/`

**Production:**
1. Upload to `media/releases/<release_id>/units/<topic>.json`
2. POST `/quiz-admin/api/releases/<release_id>/import` (imports to DB, status=draft)
3. POST `/quiz-admin/api/releases/<release_id>/publish` (makes visible)

**See:** [OPERATIONS.md](OPERATIONS.md) for detailed workflows.

---

**This document is the single source of truth for Quiz content format.**
