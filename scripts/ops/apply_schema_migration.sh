#!/bin/bash
# Apply schema migration 0011 to PROD DB
# Run AFTER verify_prod_schema.sh confirms migration is needed

set -e

echo "=============================================="
echo "Applying Schema Migration 0011"
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

echo "✓ Target DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# Verify migration file exists
MIGRATION_FILE="/srv/webapps/games_hispanistica/app/migrations/0011_increase_quiz_questions_varchar_limits.sql"

if [ ! -f "${MIGRATION_FILE}" ]; then
    echo "ERROR: Migration file not found: ${MIGRATION_FILE}"
    echo "Run 'git pull origin main' first"
    exit 1
fi

echo "Step 2: Backup current schema..."
BACKUP_FILE="/tmp/quiz_schema_backup_$(date +%Y%m%d_%H%M%S).sql"
export PGPASSWORD="${DB_PASSWORD}"

pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --schema-only -t quiz_questions -t quiz_topics > "${BACKUP_FILE}"

echo "✓ Backup saved to: ${BACKUP_FILE}"
echo ""

echo "Step 3: Apply migration..."
echo "=========================================="

psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    -f "${MIGRATION_FILE}" || {
    echo ""
    echo "ERROR: Migration failed!"
    echo "Backup available at: ${BACKUP_FILE}"
    exit 1
}

echo "=========================================="
echo ""
echo "✓ Migration applied successfully"
echo ""

echo "Step 4: Verify migration..."
echo "=========================================="

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
"

echo "=========================================="
echo ""
echo "✓ Schema migration complete!"
echo ""
echo "Next steps:"
echo "  1. Restart webapp: cd /srv/webapps/games_hispanistica/app && bash scripts/deploy/deploy_prod.sh"
echo "  2. Test import via Admin Dashboard"
echo ""
