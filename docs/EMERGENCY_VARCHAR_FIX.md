# Emergency Fix: varchar(100) Truncation

## The Problem

Import keeps failing with:
```
psycopg2.errors.StringDataRightTruncation: value too long for type character varying(100)
```

## Quick Diagnosis

```bash
cd /srv/webapps/games_hispanistica/app
bash scripts/ops/diagnose_varchar.sh
```

This shows **exactly which columns** are still `varchar(100)` in the PROD database.

## One-Command Fix

```bash
bash scripts/ops/master_fix.sh
```

This will:
1. ✅ Show which columns need fixing
2. ✅ Check if `create_all()` will undo the fix
3. ✅ Apply `ALTER TABLE` directly to PROD DB
4. ✅ Verify the fix worked
5. ✅ Deploy and restart webapp
6. ✅ Final verification

## If You Just Want to Fix NOW (No Questions)

```bash
bash scripts/ops/fix_varchar_now.sh
```

Then:
```bash
cd /srv/webapps/games_hispanistica/app
bash scripts/deploy/deploy_prod.sh
```

## Detailed Steps

### 1. Prove which columns are wrong

```bash
bash scripts/ops/diagnose_varchar.sh
```

Example output:
```
 column_name     | data_type         | max_length
-----------------+-------------------+-----------
 explanation_key | character varying | 100
 prompt_key      | character varying | 100
```

↑ **These are the culprits** (should be `text` with `max_length=null`)

### 2. Check if `create_all()` will break it again

```bash
bash scripts/ops/check_will_create_all_break_it.sh
```

If it says `WARNING: init_quiz_db.py runs on container start!`:
- Edit `/srv/webapps/games_hispanistica/app/scripts/docker-entrypoint.sh`
- Comment out or remove the `init_quiz_db.py` call
- It should only run once during setup, **NOT** on every container start

### 3. Apply the fix

```bash
bash scripts/ops/fix_varchar_now.sh
```

This runs:
```sql
ALTER TABLE quiz_questions
  ALTER COLUMN prompt_key TYPE text,
  ALTER COLUMN explanation_key TYPE text;
ALTER TABLE quiz_questions ALTER COLUMN id TYPE text;
ALTER TABLE quiz_topics
  ALTER COLUMN title_key TYPE text,
  ALTER COLUMN description_key TYPE text;
```

### 4. Verify it worked

```bash
bash scripts/ops/diagnose_varchar.sh
```

Expected: All columns show `text` with `max_length=null`

### 5. Restart webapp

```bash
cd /srv/webapps/games_hispanistica/app
bash scripts/deploy/deploy_prod.sh
```

### 6. Test the import

Via Admin Dashboard:
```
POST /quiz-admin/api/releases/release_20260107_223906_7b66/import
```

Expected 200 OK:
```json
{
  "ok": true,
  "release_id": "release_20260107_223906_7b66",
  "questions_imported": 18,
  "errors": []
}
```

## Troubleshooting

### "ERROR: Could not extract DATABASE_URL"

The container might not have `psql` installed. The script tries to fall back to host `psql`, but if that fails:

```bash
# Get URL manually
docker exec games-webapp bash -lc 'echo $DATABASE_URL'

# Run psql manually on host
psql "$DATABASE_URL_FROM_ABOVE" -c "
  ALTER TABLE quiz_questions
    ALTER COLUMN prompt_key TYPE text,
    ALTER COLUMN explanation_key TYPE text;
"
```

### "Migration applied but import still fails"

1. Check if `create_all()` reset the schema:
   ```bash
   bash scripts/ops/diagnose_varchar.sh
   ```
   
2. If columns are back to `varchar(100)`:
   - Find and comment out `init_quiz_db.py` in `docker-entrypoint.sh`
   - Re-apply fix
   - Restart container

3. Check webapp logs:
   ```bash
   docker logs -f games-webapp | grep -i import
   ```

### "psql not found in container"

Install it in the Dockerfile or run the commands on the host machine with the same `DATABASE_URL`.

## Files

```
scripts/ops/
  ├─ diagnose_varchar.sh              ← Proof (read-only)
  ├─ fix_varchar_now.sh               ← Emergency fix (makes changes)
  ├─ check_will_create_all_break_it.sh ← Trap detection
  └─ master_fix.sh                    ← Full orchestration
```

## Bottom Line

**The fix is one command away.** The database connection and ALTER TABLE are extracted and run against the **exact** database the webapp uses (via `$DATABASE_URL` in the container).

No guessing. No "wrong database" issues.

---

**Status:** Ready for production use  
**Tested:** January 8, 2026
