#!/bin/bash
# Check for create_all() issues that might reset schema
# Run on server to verify no automatic schema recreation

set -e

echo "=============================================="
echo "Checking for create_all() issues"
echo "=============================================="
echo ""

APP_DIR="/srv/webapps/games_hispanistica/app"

if [ ! -d "$APP_DIR" ]; then
    echo "ERROR: App directory not found: $APP_DIR"
    exit 1
fi

echo "[1] Searching for create_all() in startup code..."
echo ""

# Search for create_all patterns that might be in startup code
echo "Checking in src/app (startup):"
grep -r "create_all" "$APP_DIR/src/app" 2>/dev/null | grep -v ".pyc" | grep -v "__pycache__" || echo "  (no create_all found)"

echo ""
echo "Checking in game_modules (startup):"
grep -r "create_all" "$APP_DIR/game_modules" 2>/dev/null | grep -v ".pyc" | grep -v "__pycache__" || echo "  (no create_all found)"

echo ""
echo "[2] Checking if there are multiple DATABASE_URL variables..."
echo ""

if [ -f "$APP_DIR/../config/passwords.env" ]; then
    echo "Database URLs in passwords.env:"
    grep -E "DATABASE_URL|_URL=" "$APP_DIR/../config/passwords.env" | sed 's/:.*@/@/g' || echo "  (none found)"
else
    echo "  passwords.env not found"
fi

echo ""
echo "[3] Check if init_quiz_db.py uses create_all (safe only in init, not startup)..."
echo ""

if grep -q "metadata.create_all" "$APP_DIR/scripts/init_quiz_db.py"; then
    echo "✓ init_quiz_db.py has create_all (OK - only runs on init)"
else
    echo "  (no create_all in init_quiz_db.py)"
fi

echo ""
echo "Checking if Docker entrypoint runs init_quiz_db.py on every start:"
if grep -q "init_quiz_db" "$APP_DIR/scripts/docker-entrypoint.sh" 2>/dev/null; then
    echo "⚠ WARNING: init_quiz_db.py is run on every container start!"
    echo "  This might reset schema types. Check:"
    echo "  grep init_quiz_db /srv/webapps/games_hispanistica/app/scripts/docker-entrypoint.sh"
else
    echo "✓ init_quiz_db.py not in entrypoint (good)"
fi

echo ""
echo "=============================================="
echo "Analysis complete"
echo "=============================================="
