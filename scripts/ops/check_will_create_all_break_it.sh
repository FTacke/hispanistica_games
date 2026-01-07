#!/bin/bash
# Check if create_all() or init scripts will undo the migration

echo "=============================================="
echo "Check: Will create_all() undo the migration?"
echo "=============================================="
echo ""

APP_DIR="/srv/webapps/games_hispanistica/app"

if [ ! -d "$APP_DIR" ]; then
    echo "ERROR: App directory not found"
    exit 1
fi

echo "[1] Looking for create_all in app code..."
echo ""

FOUND=0

# Check src/app (Flask startup code)
if grep -r "create_all" "$APP_DIR/src/app" 2>/dev/null | grep -v "__pycache__" | grep -v ".pyc"; then
    echo "  ⚠ Found in src/app - check if it runs on startup"
    FOUND=1
fi

# Check game_modules startup
if grep -r "create_all" "$APP_DIR/game_modules" 2>/dev/null | grep -v "__pycache__" | grep -v ".pyc" | grep -v "init_quiz_db"; then
    echo "  ⚠ Found in game_modules - check if it runs on startup"
    FOUND=1
fi

if [ $FOUND -eq 0 ]; then
    echo "  ✓ No suspicious create_all() found in startup code"
fi

echo ""
echo "[2] Checking docker-entrypoint.sh..."
echo ""

if [ -f "$APP_DIR/scripts/docker-entrypoint.sh" ]; then
    if grep -q "init_quiz_db" "$APP_DIR/scripts/docker-entrypoint.sh"; then
        echo "  ⚠ WARNING: init_quiz_db.py runs on container start!"
        echo "  This will recreate schema with old varchar(100) types"
        echo ""
        echo "  FIX: Comment out or remove this line from docker-entrypoint.sh:"
        grep -n "init_quiz_db" "$APP_DIR/scripts/docker-entrypoint.sh"
        echo ""
        echo "  init_quiz_db.py should only run ONCE during setup, not on every start"
        exit 1
    else
        echo "  ✓ init_quiz_db.py NOT in entrypoint (good)"
    fi
else
    echo "  ! Could not find docker-entrypoint.sh"
fi

echo ""
echo "✓ Check complete - schema should stay fixed"
echo ""
