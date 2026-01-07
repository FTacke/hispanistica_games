-- Migration: Increase varchar limits for quiz_questions to prevent truncation
-- Date: 2026-01-07
-- Issue: StringDataRightTruncation on import - varchar(100) too short for i18n keys and question IDs
--
-- Affected columns:
--   - id: String(100) -> text (stable question IDs can exceed 100 chars with topic slugs)
--   - prompt_key: String(100) -> text (i18n keys can be long)
--   - explanation_key: String(100) -> text (i18n keys can be long)
--
-- This migration is IDEMPOTENT - safe to run multiple times.

BEGIN;

-- Increase id column to text
ALTER TABLE quiz_questions 
ALTER COLUMN id TYPE text;

-- Increase prompt_key column to text
ALTER TABLE quiz_questions 
ALTER COLUMN prompt_key TYPE text;

-- Increase explanation_key column to text
ALTER TABLE quiz_questions 
ALTER COLUMN explanation_key TYPE text;

-- Also check quiz_topics for consistency (i18n keys)
ALTER TABLE quiz_topics
ALTER COLUMN title_key TYPE text;

ALTER TABLE quiz_topics
ALTER COLUMN description_key TYPE text;

COMMIT;

-- Verification query (run after migration):
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name IN ('quiz_questions', 'quiz_topics')
--   AND column_name IN ('id', 'prompt_key', 'explanation_key', 'title_key', 'description_key')
-- ORDER BY table_name, column_name;
