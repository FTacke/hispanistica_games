#!/bin/bash
# DIRECT PROOF + IMMEDIATE FIX
# Shows exactly which columns are still varchar(100) and fixes them on the PROD DB

set -e

echo "=============================================="
echo "DIRECT DB FIX: varchar(100) → text"
echo "Target: The EXACT database the webapp uses"
echo "=============================================="
echo ""

CONTAINER_NAME="games-webapp"

# Step 1: Get DATABASE_URL from running container
echo "[1] Extract DATABASE_URL from container..."
echo ""

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '${CONTAINER_NAME}' not running"
    exit 1
fi

DB_URL=$(docker exec "${CONTAINER_NAME}" bash -lc 'echo "${DATABASE_URL:-$AUTH_DATABASE_URL}"' 2>/dev/null || echo "")

if [ -z "$DB_URL" ]; then
    echo "ERROR: Could not extract DATABASE_URL or AUTH_DATABASE_URL from container"
    echo "Try: docker exec -it ${CONTAINER_NAME} bash -lc 'echo \${DATABASE_URL:-\$AUTH_DATABASE_URL}'"
    exit 1
fi

# Show safe version (hide password)
SAFE_URL=$(echo "$DB_URL" | sed -E 's/([^:]+):[^@]*@/@/g')
echo "✓ Connected to: $SAFE_URL"
echo ""

# Step 2: Check which columns are still varchar(100)
echo "[2] PROOF: Which columns are still varchar(100)?"
echo "=========================================="
echo ""

RESULT=$(docker exec "${CONTAINER_NAME}" bash -lc "
psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -t -c \"
SELECT 
  column_name,
  data_type,
  COALESCE(character_maximum_length::text, 'null') as max_length
FROM information_schema.columns
WHERE table_name = 'quiz_questions'
  AND data_type = 'character varying'
ORDER BY column_name;
\" 2>/dev/null
" || echo "ERROR")

if [ "$RESULT" = "ERROR" ]; then
    echo "ERROR: Could not query database from container"
    echo "Trying alternative method (psql on host)..."
    
    # Try on host
    if command -v psql &> /dev/null; then
        export PGPASSWORD=$(echo "$DB_URL" | grep -oP '(?<=:)\K[^@]+(?=@)')
        DB_HOST=$(echo "$DB_URL" | grep -oP '(?<=//).*?(?=:)' || echo 'localhost')
        DB_USER=$(echo "$DB_URL" | grep -oP '(?<=//).*(?=:)')
        DB_NAME=$(echo "$DB_URL" | grep -oP '(?<=/)[^/?]+$')
        
        RESULT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -t -c "
          SELECT column_name, data_type, COALESCE(character_maximum_length::text, 'null')
          FROM information_schema.columns
          WHERE table_name = 'quiz_questions' AND data_type = 'character varying'
          ORDER BY column_name;" 2>/dev/null || echo "ERROR")
    fi
fi

if [ "$RESULT" = "ERROR" ] || [ -z "$RESULT" ]; then
    echo "Could not connect to database"
    exit 1
fi

if [ -z "$RESULT" ]; then
    echo "✓ NO varchar(100) columns found in quiz_questions!"
    echo "Migration is already applied."
    echo ""
    exit 0
fi

echo "Found varchar(100) columns:"
echo "$RESULT"
echo ""

# Step 3: Apply immediate fix
echo "[3] Applying ALTER TABLE to convert to text..."
echo "=========================================="
echo ""

docker exec "${CONTAINER_NAME}" bash -lc "
psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -c \"
BEGIN;
  ALTER TABLE quiz_questions
    ALTER COLUMN prompt_key TYPE text,
    ALTER COLUMN explanation_key TYPE text;
  ALTER TABLE quiz_questions ALTER COLUMN id TYPE text;
  ALTER TABLE quiz_topics
    ALTER COLUMN title_key TYPE text,
    ALTER COLUMN description_key TYPE text;
COMMIT;
\" 2>&1
" || {
    echo ""
    echo "ERROR: ALTER TABLE failed"
    exit 1
}

echo "✓ ALTER TABLE executed successfully"
echo ""

# Step 4: Verify fix was applied
echo "[4] VERIFICATION: Are they now text?"
echo "=========================================="
echo ""

VERIFY=$(docker exec "${CONTAINER_NAME}" bash -lc "
psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -t -c \"
SELECT 
  column_name,
  data_type,
  COALESCE(character_maximum_length::text, 'null') as max_length
FROM information_schema.columns
WHERE table_name = 'quiz_questions'
  AND column_name IN ('id', 'prompt_key', 'explanation_key')
ORDER BY column_name;
\"
" 2>/dev/null)

echo "$VERIFY"
echo ""

# Check if all are text
if echo "$VERIFY" | grep -q "character varying"; then
    echo "✗ FAIL: Some columns are still varchar"
    exit 1
fi

if ! echo "$VERIFY" | grep -q "text"; then
    echo "✗ FAIL: Could not verify column types"
    exit 1
fi

echo "✓ PASS: All critical columns are now TEXT"
echo ""

# Step 5: Check for create_all issues
echo "[5] Checking if create_all might reset schema..."
echo "=========================================="
echo ""

if docker exec "${CONTAINER_NAME}" bash -lc "grep -r 'create_all' /app 2>/dev/null" | grep -v "__pycache__" | grep -v ".pyc" > /dev/null 2>&1; then
    echo "⚠ WARNING: create_all() found in code"
    echo "  If this runs on container startup, it will reset schema types!"
    echo "  Check: grep -n 'create_all' /app/scripts/docker-entrypoint.sh"
    echo "  Remove or comment out if present"
else
    echo "✓ No create_all() in startup code"
fi

echo ""
echo "=============================================="
echo "✓ FIX COMPLETE"
echo "=============================================="
echo ""
echo "Next: Restart webapp and test import"
echo ""
echo "Commands:"
echo "  cd /srv/webapps/games_hispanistica/app"
echo "  bash scripts/deploy/deploy_prod.sh"
echo ""
echo "Then test import:"
echo "  POST /quiz-admin/api/releases/release_20260107_223906_7b66/import"
echo ""
