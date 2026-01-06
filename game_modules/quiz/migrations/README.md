# Quiz Database Migrations (Historical)

**Status:** These migrations are historical records. Production database schema is managed via `init_quiz_db.py` models.

## Files

- `001_increase_question_id_length.sql` - Increase ID columns to VARCHAR(100) for ULID support (required for current JSON format)
- `001_add_authors_to_topics.sql` - Add authors column to quiz_topics

## Running (if needed)

```powershell
Get-Content game_modules/quiz/migrations/<file>.sql | docker exec -i hispanistica_auth_db psql -U hispanistica_auth -d hispanistica_auth
```

**Development:** Use `python scripts/init_quiz_db.py --drop` to recreate schema from models.
