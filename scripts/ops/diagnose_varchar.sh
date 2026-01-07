#!/bin/bash
# DIAGNOSE ONLY - Show proof of which columns are varchar(100)
# Does NOT make any changes

CONTAINER_NAME="games-webapp"

echo "=============================================="
echo "DIAGNOSE: Which columns are varchar(100)?"
echo "=============================================="
echo ""

# Get DATABASE_URL
echo "[1] DATABASE_URL from container:"
docker exec "${CONTAINER_NAME}" bash -lc 'DB_URL="$DATABASE_URL"; echo "${DB_URL%@*}@<redacted>"' 2>/dev/null || echo "ERROR: Could not get DATABASE_URL"
echo ""

# Query column types
echo "[2] Column types in quiz_questions:"
echo "=========================================="
docker exec "${CONTAINER_NAME}" bash -lc '
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT 
  column_name,
  data_type,
  COALESCE(character_maximum_length::text, '\''null'\'') as max_length
FROM information_schema.columns
WHERE table_name = '\''quiz_questions'\''
ORDER BY column_name;
"
' 2>&1 || echo "Could not query - psql might not be in container"

echo ""
echo "PASS condition:"
echo "  - prompt_key: text, max_length=null"
echo "  - explanation_key: text, max_length=null"
echo "  - id: text, max_length=null"
echo ""
echo "If you see character varying(100): Run fix_varchar_now.sh"
echo ""
