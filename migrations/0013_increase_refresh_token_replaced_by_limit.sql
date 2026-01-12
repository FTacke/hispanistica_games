-- Migration: Increase refresh_tokens.replaced_by varchar limit
-- Date: 2026-01-12
-- Issue: StringDataRightTruncation on token rotation - varchar(36) too short for rotation markers
--
-- Root Cause:
--   Token rotation uses markers like "concurrent_refresh_<uuid>" which exceed 36 chars
--   Caused 500 errors on /auth/refresh endpoint
--
-- Change:
--   replaced_by: varchar(36) -> varchar(64)
--
-- This migration is IDEMPOTENT - safe to run multiple times.

BEGIN;

-- Increase replaced_by column from varchar(36) to varchar(64)
ALTER TABLE refresh_tokens 
ALTER COLUMN replaced_by TYPE varchar(64);

COMMIT;
