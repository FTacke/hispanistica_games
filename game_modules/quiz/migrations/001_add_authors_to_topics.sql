-- Migration: Add authors column to quiz_topics
-- Date: 2025-12-31
-- Description: Add support for storing quiz authors as text array

-- Add authors column to quiz_topics
ALTER TABLE quiz_topics 
ADD COLUMN IF NOT EXISTS authors text[] NOT NULL DEFAULT '{}';

-- Create index for authors search (optional, for future queries)
CREATE INDEX IF NOT EXISTS idx_quiz_topics_authors ON quiz_topics USING GIN (authors);

-- Comment for documentation
COMMENT ON COLUMN quiz_topics.authors IS 'List of author names/initials for this quiz topic';
