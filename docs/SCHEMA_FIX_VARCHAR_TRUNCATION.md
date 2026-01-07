# Schema Fix: varchar(100) Truncation on Import

## Problem

Import endpoint `/quiz-admin/api/releases/{id}/import` fails with HTTP 500:

```
psycopg2.errors.StringDataRightTruncation: value too long for type character varying(100)
```

**Root Cause:** 
- `quiz_questions.prompt_key` and `explanation_key` contain full question/explanation text (not i18n keys)
- These can easily exceed 100 characters
- Schema was too narrow

## Solution

### Commits

| Commit | Changes |
|--------|---------|
| `dd30911` | Schema migration + transaction safety |
| `2da6ef3` | Production verification scripts |

### Schema Changes

Migrated these columns to `text` (unlimited length):

```
quiz_questions:
  - id:              varchar(100) → text
  - prompt_key:      varchar(100) → text  [CRITICAL]
  - explanation_key: varchar(100) → text  [CRITICAL]

quiz_topics:
  - title_key:       varchar(100) → text
  - description_key: varchar(100) → text
```

### Migration

**File:** `migrations/0011_increase_quiz_questions_varchar_limits.sql`

Features:
- ✅ Idempotent (safe to run multiple times)
- ✅ Single transaction (all-or-nothing)
- ✅ Prod-safe (no data loss)
- ✅ Rollback-safe

### Transaction Safety

Added `session.rollback()` in exception handlers:

```python
# game_modules/quiz/import_service.py
except Exception as e:
    logger.error(f"...: {e}", exc_info=True)
    session.rollback()  # ← Clean up on error
    return ImportResult(...)
```

## Deployment

### Option A: Automated (Recommended)

```bash
cd /srv/webapps/games_hispanistica/app
bash scripts/ops/deploy_schema_fix.sh
```

This runs:
1. ✅ `verify_production_schema.sh` - Check current state
2. ✅ `check_create_all_issues.sh` - Check for schema recreation bugs
3. ✅ Deploy with `scripts/deploy/deploy_prod.sh`
4. ✅ Post-deployment verification

### Option B: Manual

**Step 1: Verify current state**
```bash
bash scripts/ops/verify_production_schema.sh
```

Expected output:
```
prompt_key:      type=text, len=null       ✓ PASS
explanation_key: type=text, len=null       ✓ PASS
```

If you see `character varying(100)`, the migration hasn't been applied yet.

**Step 2: Apply migration (if needed)**
```bash
# Connection details extracted from running container
psql "$DATABASE_URL" -f migrations/0011_increase_quiz_questions_varchar_limits.sql
```

**Step 3: Restart webapp**
```bash
cd /srv/webapps/games_hispanistica/app
bash scripts/deploy/deploy_prod.sh
```

**Step 4: Verify again**
```bash
bash scripts/ops/verify_production_schema.sh
```

## Testing

After deployment, test the import that previously failed:

```bash
# Via Admin Dashboard
POST /quiz-admin/api/releases/release_20260107_223906_7b66/import

# Expected response
{
  "ok": true,
  "release_id": "release_20260107_223906_7b66",
  "units_imported": 1,
  "questions_imported": 18,
  "errors": [],
  "warnings": []
}
```

## Troubleshooting

### Schema still shows varchar(100)?

**Cause 1:** Migration didn't run
```bash
# Apply it manually
psql "$DATABASE_URL" -f migrations/0011_increase_quiz_questions_varchar_limits.sql

# Verify
bash scripts/ops/verify_production_schema.sh
```

**Cause 2:** Wrong database connection
```bash
# Check which DB the container uses
docker exec games-webapp env | grep DATABASE_URL

# Should match:
# - /srv/webapps/games_hispanistica/config/passwords.env
# - AUTH_DATABASE_URL in container
```

**Cause 3:** `create_all()` resets schema on startup
```bash
bash scripts/ops/check_create_all_issues.sh

# If init_quiz_db.py is in docker-entrypoint.sh:
# Remove it (only run once, not on every start)
grep -n init_quiz_db /srv/webapps/games_hispanistica/app/scripts/docker-entrypoint.sh
```

### Import still fails?

1. Check webapp logs:
```bash
docker logs -f games-webapp | head -100
```

2. Check database logs:
```bash
docker logs -f <postgres-container> | grep -i error
```

3. Verify column types one more time:
```bash
psql "$DATABASE_URL" -c "
  SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns
  WHERE table_name='quiz_questions'
    AND column_name IN ('prompt_key','explanation_key');
"
```

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `migrations/0011_increase_quiz_questions_varchar_limits.sql` | New | Migrate columns to TEXT |
| `game_modules/quiz/models.py` | Updated | QuizQuestion model schema |
| `game_modules/quiz/import_service.py` | Updated | Add session.rollback() on error |
| `scripts/ops/verify_production_schema.sh` | New | Check if migration applied |
| `scripts/ops/check_create_all_issues.sh` | New | Detect schema recreation bugs |
| `scripts/ops/deploy_schema_fix.sh` | New | Complete deployment workflow |

## References

- **Bug:** Import fails on long question text
- **Root Cause:** `varchar(100)` too narrow for full question/explanation content
- **Fix:** Migrate to `text` (unlimited) + transaction safety
- **Status:** Ready for production deployment

---

**Last Updated:** January 8, 2026  
**Tested On:** PostgreSQL 14+, SQLAlchemy 2.0, Docker Compose
