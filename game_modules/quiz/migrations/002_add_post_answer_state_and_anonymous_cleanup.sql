-- Migration: Persist post-answer resume state and support anonymous cleanup/isolation
-- Date: 2026-04-20
-- Description:
--   - add persisted post-answer fields on quiz_runs for deterministic refresh/resume
--   - add indexes for anonymous cleanup lookups
--   - add partial unique index to prevent multiple in-progress runs per player/topic

ALTER TABLE quiz_runs
ADD COLUMN IF NOT EXISTS post_answer_pending BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE quiz_runs
ADD COLUMN IF NOT EXISTS post_answer_question_index INTEGER NULL;

ALTER TABLE quiz_runs
ADD COLUMN IF NOT EXISTS post_answer_result VARCHAR(20) NULL;

ALTER TABLE quiz_runs
ADD COLUMN IF NOT EXISTS post_answer_selected_answer_id VARCHAR(16) NULL;

ALTER TABLE quiz_runs
ADD COLUMN IF NOT EXISTS post_answer_correct_option_id VARCHAR(16) NULL;

ALTER TABLE quiz_runs
ADD COLUMN IF NOT EXISTS post_answer_explanation_key TEXT NULL;

CREATE INDEX IF NOT EXISTS ix_quiz_players_anonymous_last_seen
ON quiz_players (is_anonymous, last_seen_at);

CREATE INDEX IF NOT EXISTS ix_quiz_runs_finished_at
ON quiz_runs (finished_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_runs_active_player_topic
ON quiz_runs (player_id, topic_id)
WHERE status = 'in_progress';
