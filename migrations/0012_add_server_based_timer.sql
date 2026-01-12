-- Migration: Add server-based timer fields to quiz_runs
-- Date: 2026-01-12
-- Purpose: Replace client-controlled timer with server-side UTC timestamps

-- Add new server-based timer columns
ALTER TABLE quiz_runs 
  ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER NOT NULL DEFAULT 30;

-- Legacy columns (question_started_at_ms, deadline_at_ms) are kept for backward compatibility
-- They will be populated by the application code but are no longer the source of truth

-- Create index on expires_at for efficient timeout queries
CREATE INDEX IF NOT EXISTS ix_quiz_runs_expires_at ON quiz_runs(expires_at) 
  WHERE expires_at IS NOT NULL AND status = 'in_progress';

-- Migration Notes:
-- 1. This is a NON-BREAKING migration - old fields remain functional
-- 2. Application code will populate both old and new fields during transition period
-- 3. After deployment and verification, old fields can be deprecated in a future migration
-- 4. Run this migration BEFORE deploying the updated application code

COMMENT ON COLUMN quiz_runs.question_started_at IS 'Server UTC timestamp when question timer started';
COMMENT ON COLUMN quiz_runs.expires_at IS 'Server UTC timestamp when timer expires (source of truth for timeout)';
COMMENT ON COLUMN quiz_runs.time_limit_seconds IS 'Time limit in seconds (30 base + bonus for media)';
