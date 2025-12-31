-- Migration: Increase question ID column length
-- Reason: Support ULID-based IDs with long topic slugs (e.g., "variation_in_der_aussprache_q_<ULID>" = 58 chars)
-- Previous: VARCHAR(50)
-- New: VARCHAR(100)
-- 
-- Run this migration before using quiz_seed.py with long topic slugs

-- Alter quiz_questions primary key
ALTER TABLE quiz_questions ALTER COLUMN id TYPE VARCHAR(100);

-- Alter quiz_run_answers foreign key reference
ALTER TABLE quiz_run_answers ALTER COLUMN question_id TYPE VARCHAR(100);

-- Alter quiz_question_stats foreign key reference
ALTER TABLE quiz_question_stats ALTER COLUMN question_id TYPE VARCHAR(100);

-- Verify changes
SELECT 
    table_name,
    column_name,
    character_maximum_length,
    data_type
FROM information_schema.columns
WHERE table_name IN ('quiz_questions', 'quiz_run_answers', 'quiz_question_stats')
    AND column_name IN ('id', 'question_id')
ORDER BY table_name, column_name;
