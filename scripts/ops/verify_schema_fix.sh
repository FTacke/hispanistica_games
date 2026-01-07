#!/bin/bash
# Verification script for schema fix deployment
# Run on server after deploying dd30911

set -e

echo "=== Schema Fix Verification ==="
echo ""

# 1. Apply migration
echo "Step 1: Apply migration 0011..."
sudo -u postgres psql -d games_hispanistica -f /srv/webapps/games_hispanistica/app/migrations/0011_increase_quiz_questions_varchar_limits.sql

echo ""
echo "Step 2: Verify schema changes..."
sudo -u postgres psql -d games_hispanistica -c "
SELECT 
    table_name, 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns
WHERE table_name IN ('quiz_questions', 'quiz_topics')
  AND column_name IN ('id', 'prompt_key', 'explanation_key', 'title_key', 'description_key')
ORDER BY table_name, column_name;
"

echo ""
echo "✓ Migration applied successfully"
echo ""
echo "Step 3: Restart webapp to load updated models..."
cd /srv/webapps/games_hispanistica/app
bash scripts/deploy/deploy_prod.sh

echo ""
echo "=== Verification Complete ==="
echo "Next: Test import via Admin Dashboard"
