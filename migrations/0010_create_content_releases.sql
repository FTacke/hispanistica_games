-- Migration: Create quiz_content_releases table
-- Purpose: Track content releases for production deployment
-- Date: 2026-01-06

CREATE TABLE IF NOT EXISTS quiz_content_releases (
    release_id VARCHAR(50) PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    
    -- Import metadata
    imported_at TIMESTAMP WITH TIME ZONE,
    units_path TEXT,
    audio_path TEXT,
    
    -- Counts
    units_count INTEGER NOT NULL DEFAULT 0,
    audio_count INTEGER NOT NULL DEFAULT 0,
    questions_count INTEGER NOT NULL DEFAULT 0,
    
    -- Publish tracking
    published_at TIMESTAMP WITH TIME ZONE,
    unpublished_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Optional: checksum manifest
    checksum_manifest TEXT,
    
    -- Constraints
    CHECK (status IN ('draft', 'published', 'unpublished'))
);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_quiz_content_releases_status ON quiz_content_releases(status);

-- Index for published releases
CREATE INDEX IF NOT EXISTS idx_quiz_content_releases_published_at ON quiz_content_releases(published_at) WHERE published_at IS NOT NULL;

-- Add release_id column to quiz_topics (for tracking which release a topic belongs to)
ALTER TABLE quiz_topics ADD COLUMN IF NOT EXISTS release_id VARCHAR(50);

-- Add release_id column to quiz_questions (for tracking which release a question belongs to)
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS release_id VARCHAR(50);

-- Add foreign key constraints (if topics/questions exist)
-- Note: These are advisory - we don't enforce CASCADE DELETE to preserve historical data
CREATE INDEX IF NOT EXISTS idx_quiz_topics_release_id ON quiz_topics(release_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_release_id ON quiz_questions(release_id);
