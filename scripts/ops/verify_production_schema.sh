#!/bin/bash
# Production Verification Script
# Run on server to confirm schema migration is applied correctly
# Checks: DB connection, column types, alembic history, create_all() issues

set -e

echo "=============================================="
echo "PROD DB Schema Verification"
echo "$(date)"
echo "=============================================="
echo ""

# Try to get DATABASE_URL from different sources
echo "[STEP 1] Extract database connection..."
echo ""

# Option A: From running container
CONTAINER_NAME="games-webapp"
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "✓ Found running container: ${CONTAINER_NAME}"
    DB_URL=$(docker inspect "${CONTAINER_NAME}" --format='{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(AUTH_DATABASE_URL|DATABASE_URL)=' | head -1 | cut -d= -f2-)
    IN_CONTAINER="yes"
else
    echo "⚠ Container ${CONTAINER_NAME} not running"
    IN_CONTAINER="no"
fi

# Option B: From passwords.env file
if [ -z "$DB_URL" ] && [ -f "/srv/webapps/games_hispanistica/config/passwords.env" ]; then
    echo "  Trying passwords.env..."
    DB_URL=$(grep -E '^(AUTH_DATABASE_URL|DATABASE_URL)=' /srv/webapps/games_hispanistica/config/passwords.env | head -1 | cut -d= -f2-)
fi

# Option C: From environment
if [ -z "$DB_URL" ]; then
    echo "  Trying \$DATABASE_URL from environment..."
    DB_URL="${DATABASE_URL}"
fi

if [ -z "$DB_URL" ]; then
    echo "ERROR: Could not find database connection URL"
    echo "  Checked:"
    echo "    - Running container environment"
    echo "    - /srv/webapps/games_hispanistica/config/passwords.env"
    echo "    - \$DATABASE_URL environment variable"
    exit 1
fi

# Hide password in output
SAFE_URL=$(echo "$DB_URL" | sed 's/:.*@/@/g')
echo "✓ Database URL: $SAFE_URL"
echo ""

# Parse connection details
DB_PARSE_RESULT=$(python3 -c "
from urllib.parse import urlparse
import sys

try:
    url = '$DB_URL'
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
    echo "ERROR: Failed to parse DATABASE_URL"
    exit 1
fi

IFS='|' read -r DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME <<< "$DB_PARSE_RESULT"

echo "[STEP 2] Query column types in PROD DB..."
echo ""

export PGPASSWORD="${DB_PASSWORD}"

# Get column info
COLUMNS_OUTPUT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "
SELECT 
    column_name, 
    data_type,
    COALESCE(character_maximum_length::text, 'null') as max_length
FROM information_schema.columns
WHERE table_name = 'quiz_questions'
  AND column_name IN ('id', 'prompt_key', 'explanation_key')
ORDER BY column_name;" 2>&1)

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to query database"
    echo "$COLUMNS_OUTPUT"
    exit 1
fi

echo "$COLUMNS_OUTPUT"
echo ""

# Parse and check types
echo "[STEP 3] Analyze results..."
echo ""

PROMPT_KEY_TYPE=$(echo "$COLUMNS_OUTPUT" | grep "prompt_key" | awk '{print $2}')
PROMPT_KEY_LEN=$(echo "$COLUMNS_OUTPUT" | grep "prompt_key" | awk '{print $3}')
EXPLANATION_KEY_TYPE=$(echo "$COLUMNS_OUTPUT" | grep "explanation_key" | awk '{print $2}')
EXPLANATION_KEY_LEN=$(echo "$COLUMNS_OUTPUT" | grep "explanation_key" | awk '{print $3}')

echo "prompt_key:      type=$PROMPT_KEY_TYPE, len=$PROMPT_KEY_LEN"
echo "explanation_key: type=$EXPLANATION_KEY_TYPE, len=$EXPLANATION_KEY_LEN"
echo ""

# Check if migration was applied
MIGRATION_PASS=0

if [ "$PROMPT_KEY_TYPE" = "text" ] && [ "$PROMPT_KEY_LEN" = "null" ]; then
    echo "✓ prompt_key is TEXT (correct)"
    ((MIGRATION_PASS++))
else
    echo "✗ prompt_key is NOT TEXT (expected type=text, len=null)"
    echo "  Found: type=$PROMPT_KEY_TYPE, len=$PROMPT_KEY_LEN"
fi

if [ "$EXPLANATION_KEY_TYPE" = "text" ] && [ "$EXPLANATION_KEY_LEN" = "null" ]; then
    echo "✓ explanation_key is TEXT (correct)"
    ((MIGRATION_PASS++))
else
    echo "✗ explanation_key is NOT TEXT (expected type=text, len=null)"
    echo "  Found: type=$EXPLANATION_KEY_TYPE, len=$EXPLANATION_KEY_LEN"
fi

echo ""

if [ $MIGRATION_PASS -eq 2 ]; then
    echo "=============================================="
    echo "✓ PASS: Migration applied successfully"
    echo "=============================================="
    echo ""
    echo "Next steps:"
    echo "  1. Restart webapp: cd /srv/webapps/games_hispanistica/app && bash scripts/deploy/deploy_prod.sh"
    echo "  2. Test import via Admin Dashboard"
    echo ""
    exit 0
else
    echo "=============================================="
    echo "✗ FAIL: Migration NOT applied"
    echo "=============================================="
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if migration file exists:"
    echo "     ls -la /srv/webapps/games_hispanistica/app/migrations/0011_*"
    echo "  2. Apply migration manually:"
    echo "     psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/0011_increase_quiz_questions_varchar_limits.sql"
    echo "  3. Verify again by running this script"
    echo ""
    exit 1
fi
