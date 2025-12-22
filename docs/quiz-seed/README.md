# Quiz Content Authoring Guide

This document describes the **quiz_seed_v1** content format for authoring quiz questions that can be imported into the Hispanistica Games quiz module.

## Purpose

The quiz_seed_v1 format provides a simple, human-readable JSON structure for creating quiz content without dealing with database IDs, mappings, or complex relational structures. The seed script handles all the complexity of generating stable IDs and importing data into the database.

## Content File Location

**Default path:** `docs/games_modules/quiz_content_v1.json`

You can create additional content files and import them using the `--path` option.

## Schema Version

All content files must declare the schema version:

```json
{
  "schema_version": "quiz_seed_v1",
  ...
}
```

## File Structure

```json
{
  "schema_version": "quiz_seed_v1",
  "defaults": {
    "language": "de",
    "missing_explanation_text": "Erklärung folgt."
  },
  "quizzes": [
    {
      "title": "Quiz Title",
      "slug": "quiz-slug",
      "description": "Optional description",
      "is_active": true,
      "questions": [...]
    }
  ]
}
```

### Defaults Section

- **language** (string, optional): Language code (e.g., "de", "en")
- **missing_explanation_text** (string, optional): Default text to display when a question has no explanation. Default: "Erklärung folgt."

### Quiz Object

Each quiz represents a topic in the database.

**Required fields:**
- **title** (string): Display title (used as i18n key)
- **slug** (string): URL-safe identifier (used as database ID)

**Optional fields:**
- **description** (string): Topic description (used as i18n key). Default: empty string
- **is_active** (boolean): Whether topic is published. Default: true

### Question Object

Each question must be fully self-contained.

**Required fields:**
- **author_initials** (string, max 8 chars): Author's initials (e.g., "MS", "LL", "MK")
- **prompt** (string): The question text
- **difficulty** (integer, 1-5): Difficulty level
- **answers** (array): Array of answer objects (minimum 2)

**Optional fields:**
- **explanation** (string): Explanation shown after answering. If empty/missing, `defaults.missing_explanation_text` is used
- **tags** (array of strings): Metadata tags (e.g., ["phonologie", "variation"])
- **type** (string): Question type. Default: "single_choice"
- **is_active** (boolean): Whether question is active. Default: true

### Answer Object

Each answer within a question's `answers` array:

**Required fields:**
- **text** (string): Answer text (used as i18n key)
- **correct** (boolean): Whether this is the correct answer

**Important validation rules:**
- Minimum 2 answers per question (typically 4)
- **Exactly 1** answer must have `correct: true`
- All other answers must have `correct: false`

## Complete Example

```json
{
  "schema_version": "quiz_seed_v1",
  "defaults": {
    "language": "de",
    "missing_explanation_text": "Erklärung folgt."
  },
  "quizzes": [
    {
      "title": "Variation in der Aussprache",
      "slug": "variation-in-der-aussprache",
      "description": "Phonologische Variation im Spanischen",
      "is_active": true,
      "questions": [
        {
          "author_initials": "MS",
          "prompt": "Worum geht es bei der sogenannten distinción?",
          "explanation": "Die distinción bezeichnet die Unterscheidung zwischen den Interdentalllauten /s/ und /θ/, die vor allem in Nordspanien verbreitet ist.",
          "difficulty": 2,
          "tags": ["phonologie", "variation"],
          "is_active": true,
          "answers": [
            {"text": "/s/ am Silbenende", "correct": false},
            {"text": "Interdentalllaute /s/ und /θ/", "correct": true},
            {"text": "Unterscheidung zwischen <ll> und <y>", "correct": false},
            {"text": "Velarisierung des /n/", "correct": false}
          ]
        },
        {
          "author_initials": "MS",
          "prompt": "Was bezeichnet der Begriff 'yeísmo'?",
          "explanation": "",
          "difficulty": 3,
          "tags": ["phonologie"],
          "is_active": true,
          "answers": [
            {"text": "Zusammenfall von /ʎ/ und /ʝ/", "correct": true},
            {"text": "Realisierung von /y/ als [ʒ]", "correct": false},
            {"text": "Elision des /y/ im Anlaut", "correct": false},
            {"text": "Verstärkung des /y/ zu [dʒ]", "correct": false}
          ]
        }
      ]
    }
  ]
}
```

## Import Process

### Local Development

1. **Validate content** (dry-run mode, no database changes):
   ```bash
   python scripts/seed_quiz_content.py --dry-run
   ```

2. **Import into database**:
   ```bash
   python scripts/seed_quiz_content.py
   ```

3. **Import custom file**:
   ```bash
   python scripts/seed_quiz_content.py --path path/to/custom.json
   ```

### How It Works

The seed script:

1. **Validates** the JSON structure and question rules
2. **Generates deterministic IDs**:
   - **Topic ID**: Uses the `slug` field directly
   - **Question ID**: SHA-256 hash of `topic_slug|author_initials|prompt` (first 24 hex chars)
   - **Answer IDs**: SHA-256 hash of `question_id|answer_text` (first 16 hex chars)
3. **Upserts data** into the database (idempotent - safe to run multiple times)
4. **Never deletes** existing runs, sessions, or player data

### Idempotent Behavior

- Running the script multiple times with the same content is safe
- Questions are updated if they already exist (based on the generated ID)
- The script does **NOT** delete anything:
  - Player accounts are preserved
  - Quiz runs and sessions are preserved
  - Scores and leaderboards are preserved

## Validation Rules

The script validates content before import and will abort with an error if:

- Schema version is not "quiz_seed_v1"
- Any quiz is missing `title` or `slug`
- Any question is missing required fields (`author_initials`, `prompt`, `difficulty`)
- Difficulty is not an integer between 1 and 5
- Question has fewer than 2 answers
- Question has 0 or more than 1 correct answer
- Any answer is missing `text` field

## Database Schema

Questions are imported into these PostgreSQL tables:

### quiz_topics
- `id`: quiz slug
- `title_key`: quiz title (used as i18n key)
- `description_key`: quiz description
- `is_active`: boolean
- `order_index`: display order

### quiz_questions
- `id`: generated SHA-256 hash (24 chars)
- `topic_id`: references quiz_topics.id
- `difficulty`: 1-5
- `type`: question type ("single_choice")
- `prompt_key`: question text (used as i18n key)
- `explanation_key`: explanation text (used as i18n key)
- `answers`: JSONB array `[{"id": "...", "text_key": "...", "correct": true/false}, ...]`
- `author_initials`: author identifier
- `is_active`: boolean

## Best Practices

1. **Author Initials**: Use consistent initials for tracking content ownership
2. **Explanations**: Provide explanations when possible. Empty explanations show "Erklärung folgt."
3. **Difficulty Distribution**: Aim for 2 questions per difficulty level (1-5) per topic for balanced gameplay
4. **Answer Order**: Write answers in a logical order in the JSON. The frontend shuffles them randomly during play.
5. **Tags**: Use tags consistently for future filtering/analytics
6. **Test Before Import**: Always run with `--dry-run` first to validate

## Troubleshooting

### "Invalid schema_version"
- Ensure `schema_version` is exactly "quiz_seed_v1"

### "Must have exactly 1 correct answer"
- Check that exactly one answer has `correct: true` and all others have `correct: false`

### "Invalid difficulty"
- Difficulty must be an integer from 1 to 5

### "File not found"
- Check the path to your JSON file
- Default path is `docs/games_modules/quiz_content_v1.json`

## Technical Details

### Answer Shuffling

- Answer order in the JSON is for authoring convenience only
- During gameplay, answers are shuffled randomly using Fisher-Yates algorithm
- The frontend uses deterministic answer IDs to track selections
- Server-side validation ensures correct answer evaluation

### ID Stability

- IDs are deterministic: Same content = same ID
- Changing `author_initials`, `prompt`, or `topic_slug` generates a new question ID
- Changing answer text generates a new answer ID
- This allows safe re-imports and content updates

## Support

For issues or questions, refer to:
- Main documentation: `docs/MODULES.md`
- Quiz module: `docs/games_modules/`
- Source code: `scripts/seed_quiz_content.py`
