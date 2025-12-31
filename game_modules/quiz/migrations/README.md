# Quiz Database Migrations

Manual SQL migrations for the Quiz module schema.

## Running Migrations

### Via Docker (Recommended)

```powershell
Get-Content game_modules/quiz/migrations/<migration_file>.sql | docker exec -i hispanistica_auth_db psql -U hispanistica_auth -d hispanistica_auth
```

### Via psql (if installed locally)

```bash
psql -h 127.0.0.1 -p 54320 -U hispanistica_auth -d hispanistica_auth -f game_modules/quiz/migrations/<migration_file>.sql
```

## Migration History

### 001_increase_question_id_length.sql
- **Date:** 2025-12-31
- **Purpose:** Increase `id` column length from VARCHAR(50) to VARCHAR(100)
- **Reason:** Support ULID-based question IDs with long topic slugs (e.g., `variation_in_der_aussprache_q_<ULID>` = 58 chars)
- **Tables affected:** `quiz_questions`, `quiz_run_answers`, `quiz_question_stats`

## Development Workflow

For development environments using `init_quiz_db.py --drop`, migrations are not needed as the schema is recreated from models.

For production environments, run migrations manually before deploying new code.

## Notes

- Migrations are idempotent (safe to re-run)
- Always backup database before running migrations in production
- Test migrations in development environment first
