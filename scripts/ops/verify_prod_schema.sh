#!/bin/bash
# Prod DB Schema Verification - Run on server BEFORE migration
# This checks which columns need to be fixed

set -e

echo "=============================================="
echo "Prod DB Schema Verification"
echo "=============================================="
echo ""

# Get DB credentials from container
echo "Step 1: Extract DB connection from running container..."
CONTAINER_NAME="games-webapp"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '${CONTAINER_NAME}' is not running"
    exit 1
fi

# Extract AUTH_DATABASE_URL from container
DB_URL=$(docker inspect "${CONTAINER_NAME}" --format='{{range .Config.Env}}{{println .}}{{end}}' | grep '^AUTH_DATABASE_URL=' | cut -d= -f2-)

if [ -z "$DB_URL" ]; then
    echo "ERROR: Could not extract AUTH_DATABASE_URL from container"
    exit 1
fi

# Parse DB connection details
DB_PARSE_RESULT=$(python3 -c "
from urllib.parse import urlparse
import sys

try:
    url = '${DB_URL}'
    parsed = urlparse(url)
    
    host = parsed.hostname or 'localhost'
    port = parsed.port or 5432
    user = parsed.username or 'postgres'
    password = parsed.password or ''
    dbname = parsed.path.lstrip('/') or 'postgres'
    
    print(f'{host}|{port}|{user}|{password}|{dbname}')
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
" 2>&1)

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to parse AUTH_DATABASE_URL: ${DB_PARSE_RESULT}"
    exit 1
fi

IFS='|' read -r DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME <<< "$DB_PARSE_RESULT"

echo "✓ Connected to: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# Check schema (CRITICAL: This is the DB the container uses)
echo "Step 2: Check current column types in PROD DB..."
echo "=========================================="
export PGPASSWORD="${DB_PASSWORD}"

psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "
SELECT 
    table_name, 
    column_name, 
    data_type,
    COALESCE(character_maximum_length::text, 'N/A') as max_length
FROM information_schema.columns
WHERE table_name IN ('quiz_questions', 'quiz_topics')
  AND column_name IN ('id', 'prompt_key', 'explanation_key', 'title_key', 'description_key')
ORDER BY table_name, column_name;
" || {
    echo "ERROR: Failed to query database"
    exit 1
}

echo ""
echo "=========================================="
echo ""
echo "ANALYSIS:"
echo "  - If you see 'character varying' with '100': NEEDS MIGRATION"
echo "  - If you see 'text' with 'N/A': ALREADY MIGRATED"
echo ""
echo "Next steps:"
echo "  1. If needs migration: run apply_schema_migration.sh"
echo "  2. If already migrated: test import directly"
echo ""
