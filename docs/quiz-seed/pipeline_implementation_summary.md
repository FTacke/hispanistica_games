# Quiz Content Pipeline - Implementation Summary

## Overview

Automated quiz content synchronization pipeline integrated into dev workflow.

**Pipeline Flow:** Normalize → Seed → Prune

**Trigger:** Automatic on `dev-start.ps1 -UsePostgres` (before server start)

## Components

### 1. Normalize Script (`scripts/quiz_units_normalize.py`)

**Purpose:** Ensure all quiz units have valid IDs and statistics

**Actions:**
- Generates ULID-based question IDs (`{slug}_q_{ULID}`)
- Calculates/updates `questions_statistics` (difficulty distribution)
- Validates JSON schema
- Writes changes back to JSON files

**CLI:**
```bash
python scripts/quiz_units_normalize.py --write --topics-dir game_modules/quiz/quiz_units/topics
```

**Key Features:**
- Idempotent (safe to re-run)
- Preserves existing IDs
- Windows CP1252 compatible output (no Unicode symbols)
- `--check` flag returns exit code 1 if changes needed

### 2. Seed Module (`game_modules/quiz/seed.py`)

**Purpose:** Import/update quiz content from JSON to database

**Functions:**
- `seed_quiz_units()`: Main entry point, processes all JSON files in topics directory
- `import_quiz_unit()`: Idempotent upsert of single unit (topic + questions)

**Features:**
- Idempotent upserts (no duplicates on re-run)
- Difficulty distribution logging
- Session-based transaction management
- PostgreSQL JSONB columns for answers/metadata

### 3. Seed CLI (`scripts/quiz_seed.py`)

**Purpose:** Orchestrate complete pipeline with pruning

**Commands:**
```bash
# Standard (normalize + seed + soft prune)
python scripts/quiz_seed.py --prune-soft

# Hard prune (DELETE orphaned topics/questions)
python scripts/quiz_seed.py --prune-hard

# Skip normalization
python scripts/quiz_seed.py --skip-normalize
```

**Pruning:**
- **Soft Prune (default):** Sets `is_active=false` for topics without JSON
- **Hard Prune (--prune-hard):** Permanently deletes topics/questions without JSON
- **Safety:** Player data (runs, scores) never deleted (separate tables)

### 4. Dev Integration (`scripts/dev-start.ps1`)

**Auto-Pipeline (PostgreSQL mode only):**
1. Runs `quiz_seed.py --prune-soft` before server start
2. Aborts startup if pipeline fails (`$LASTEXITCODE -ne 0`)
3. Logs pipeline steps to console

**Benefit:** Quiz content always synchronized with JSON files on dev start

## Database Schema

### Tables

**quiz_topics:**
- `id` VARCHAR(50) - Topic slug (primary key)
- `title_key` VARCHAR(100) - Display title
- `description_key` VARCHAR(100) - Description
- `authors` ARRAY(String) - List of author names
- `is_active` BOOLEAN - Visibility flag (soft delete)
- `order_index` INTEGER - Display order

**quiz_questions:**
- `id` VARCHAR(100) - Question ID (format: `{topic_slug}_q_{ULID}`)
- `topic_id` VARCHAR(50) - Foreign key to quiz_topics
- `difficulty` INTEGER - 1-5 scale
- `type` VARCHAR(20) - Question type (single_choice, etc.)
- `prompt_key` VARCHAR(100) - Question text
- `explanation_key` VARCHAR(100) - Answer explanation
- `answers` JSONB - `[{"id": "a1", "text_key": "...", "correct": true}, ...]`
- `media` JSONB - Optional media attachments
- `sources` JSONB - Optional source references
- `meta` JSONB - Additional metadata
- `is_active` BOOLEAN - Visibility flag

### Migration: Question ID Length

**Issue:** Original schema used VARCHAR(50), insufficient for long slugs
- Example: `variation_in_der_aussprache_q_01KDT5WVTVXYEBZMKK9NWF7SNK` = 58 chars

**Solution:** Migration `001_increase_question_id_length.sql`
- Increased to VARCHAR(100) in all tables
- Applied to: `quiz_questions.id`, `quiz_run_answers.question_id`, `quiz_question_stats.question_id`

**Location:** `game_modules/quiz/migrations/001_increase_question_id_length.sql`

## JSON Schema (quiz_unit_v1)

```json
{
  "schema_version": "quiz_unit_v1",
  "slug": "topic_slug",
  "title": "Display Title",
  "description": "Topic description",
  "authors": ["Author 1", "Author 2"],
  "is_active": true,
  "order_index": 1,
  "questions_statistics": {
    "1": 4,
    "2": 3,
    "3": 5,
    "4": 2,
    "5": 1
  },
  "questions": [
    {
      "id": "topic_slug_q_01KDT5WVTVXYEBZMKK9NWF7SNK",
      "difficulty": 1,
      "type": "single_choice",
      "prompt": "Question text?",
      "explanation": "Answer explanation",
      "answers": [
        {"id": "a1", "text": "Wrong answer", "correct": false},
        {"id": "a2", "text": "Correct answer", "correct": true},
        {"id": "a3", "text": "Another wrong", "correct": false}
      ]
    }
  ]
}
```

**Validation:**
- Slug must be filesystem-safe (no spaces, special chars)
- Questions must have exactly 1 correct answer
- Difficulty must be 1-5
- IDs auto-generated if missing (normalize step)
- Statistics auto-calculated if missing/outdated

## File Structure

```
game_modules/quiz/
├── models.py                    # SQLAlchemy models
├── seed.py                      # Seeding functions
├── migrations/
│   ├── README.md
│   └── 001_increase_question_id_length.sql
└── quiz_units/
    ├── PIPELINE_AUDIT.md
    └── topics/
        ├── variation_aussprache.json        # Production topic (18 questions)
        └── variation_test_quiz.json         # Test topic (10 questions)

scripts/
├── quiz_units_normalize.py      # Normalize script
├── quiz_seed.py                 # Pipeline orchestrator
├── init_quiz_db.py              # Schema initialization
├── dev-setup.ps1                # Full setup
└── dev-start.ps1                # Dev server + auto-pipeline
```

## Workflow Examples

### Adding New Quiz Content

1. Create JSON file: `game_modules/quiz/quiz_units/topics/new_topic.json`
2. Run normalize: `python scripts/quiz_units_normalize.py --write`
3. Run pipeline: `python scripts/quiz_seed.py` (or restart dev server)
4. Verify: Check database or `/api/quiz/topics` endpoint

### Removing Quiz Content

1. Delete JSON file: `rm game_modules/quiz/quiz_units/topics/old_topic.json`
2. Restart dev server or run: `python scripts/quiz_seed.py --prune-soft`
3. Topic becomes `is_active=false`, hidden from UI but data preserved

### Content Updates

1. Edit JSON file
2. Restart dev server (auto-pipeline) or run: `python scripts/quiz_seed.py`
3. Changes upserted automatically (idempotent)

## Error Handling

### Unicode Encoding Issues (Windows)

**Problem:** Windows PowerShell uses CP1252 encoding, incompatible with Unicode symbols
**Solution:** Normalize script outputs ASCII-only status messages
- ✓ → "OK:"
- ✗ → "NEEDS CHANGES:"
- ⚠️ → "ERROR:"

### Circular Import Issues

**Problem:** Quiz modules depend on Flask app context
**Solution:** `quiz_seed.py` creates app first, imports modules within context
```python
app = create_app()
with app.app_context():
    from game_modules.quiz.seed import seed_quiz_units
    from game_modules.quiz.models import QuizTopic
```

### Database Schema Mismatches

**Problem:** Question IDs exceed VARCHAR(50) limit
**Solution:** Migration script increases to VARCHAR(100)
**Apply:** `docker exec -i hispanistica_auth_db psql ... < migrations/001_increase_question_id_length.sql`

## Testing

### Manual Pipeline Test

```powershell
# Set environment
$env:AUTH_DATABASE_URL = "postgresql+psycopg://hispanistica_auth:hispanistica_auth@127.0.0.1:54320/hispanistica_auth"
$env:JWT_SECRET_KEY = "dev-jwt-secret-change-me"
$env:FLASK_SECRET_KEY = "dev-secret-change-me"

# Run pipeline
python scripts/quiz_seed.py --prune-soft
```

### Verify Database

```sql
-- Check topics
SELECT id, title_key, is_active, 
       (SELECT COUNT(*) FROM quiz_questions WHERE topic_id = quiz_topics.id) as question_count 
FROM quiz_topics 
ORDER BY is_active DESC, id;

-- Check question IDs
SELECT id, topic_id, difficulty FROM quiz_questions LIMIT 5;
```

### Verify Normalization

```bash
# Check if files need normalization (exit code 1 if changes needed)
python scripts/quiz_units_normalize.py --check
```

## Troubleshooting

### Pipeline Fails on Startup

**Check:** `scripts\quiz_seed.py` output in dev-start.ps1
**Fix:** Run pipeline manually with error details:
```bash
python scripts/quiz_seed.py --prune-soft
```

### Topics Not Appearing in UI

**Check:** `is_active` flag in database
**Fix:** Re-run pipeline or manually update:
```sql
UPDATE quiz_topics SET is_active = true WHERE id = 'topic_slug';
```

### Duplicate Questions

**Check:** Multiple JSON files with same slug or conflicting IDs
**Fix:** Normalize with `--write` flag regenerates consistent IDs

### Old Topics Still Visible

**Check:** Soft prune only sets `is_active=false`
**Fix:** Use hard prune (CAUTION: deletes data):
```bash
python scripts/quiz_seed.py --prune-hard
```

## Future Enhancements

### Potential Improvements

1. **Alembic Integration:** Automatic schema migrations instead of manual SQL
2. **Content Validation:** Pre-commit hook for JSON schema validation
3. **Dry-Run Mode:** Preview pipeline changes without database commits
4. **Rollback Support:** Backup/restore mechanism for content changes
5. **Hash-Based Change Detection:** Skip seeding if content unchanged (performance)
6. **Multi-Language Support:** i18n key resolution in seed pipeline
7. **Content Versioning:** Track quiz content changes over time

## References

- **Spec:** `docs/quiz-seed/quiz_module_implementation.md` - Original implementation plan
- **Audit:** `game_modules/quiz/quiz_units/PIPELINE_AUDIT.md` - Pipeline analysis
- **Models:** `game_modules/quiz/models.py` - Database schema
- **Seeding:** `game_modules/quiz/seed.py` - Import logic
- **Validation:** `game_modules/quiz/validation.py` - JSON schema validation

## Status

✅ **Complete and tested:**
- Normalize script with ULID generation
- Seed pipeline with idempotent upserts
- Soft/hard pruning with safety checks
- Dev-start.ps1 integration
- Database migration for VARCHAR(100) IDs
- Windows CP1252 encoding compatibility
- Documentation (startme.md, migrations/README.md)

**Last Updated:** 2025-12-31
**Version:** v1.0
