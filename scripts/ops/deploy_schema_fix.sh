#!/bin/bash
# Complete deployment workflow for schema migration
# Use this as the primary deployment script

set -e

echo "=============================================="
echo "DEPLOYMENT: Schema Fix for varchar(100) truncation"
echo "Fixes: prompt_key, explanation_key → text"
echo "=============================================="
echo ""

APP_DIR="/srv/webapps/games_hispanistica/app"
SCRIPTS_DIR="$APP_DIR/scripts/ops"

# Function to run a script
run_script() {
    local script=$1
    local name=$2
    
    if [ ! -f "$SCRIPTS_DIR/$script" ]; then
        echo "ERROR: Script not found: $SCRIPTS_DIR/$script"
        exit 1
    fi
    
    echo ""
    echo "[STEP] $name"
    echo "=========================================="
    bash "$SCRIPTS_DIR/$script"
    local EXIT_CODE=$?
    
    if [ $EXIT_CODE -ne 0 ]; then
        echo ""
        echo "ERROR: $name failed (exit code: $EXIT_CODE)"
        exit $EXIT_CODE
    fi
}

# Step 1: Verify current state
run_script "verify_production_schema.sh" "Verify current schema"

# If we get here, schema is already fixed
if [ $? -eq 0 ]; then
    echo ""
    echo "Schema is already migrated!"
    echo ""
    echo "Proceeding to restart webapp..."
fi

# Step 2: Check for create_all issues
run_script "check_create_all_issues.sh" "Check for create_all() issues"

# Step 3: Restart webapp
echo ""
echo "[STEP] Restart webapp"
echo "=========================================="
cd "$APP_DIR"
echo "Deploying updated code and models..."
bash "$APP_DIR/scripts/deploy/deploy_prod.sh"

# Step 4: Post-deployment verification
echo ""
echo "[STEP] Post-deployment verification"
echo "=========================================="

sleep 5  # Give container time to start

# Check if container is healthy
CONTAINER_NAME="games-webapp"
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "✓ Container $CONTAINER_NAME is running"
    
    # Quick health check
    if curl -sf http://localhost:7000/health > /dev/null 2>&1; then
        echo "✓ Health check passed"
    else
        echo "⚠ Health check may have failed (container might still be starting)"
    fi
else
    echo "⚠ Container $CONTAINER_NAME is not running"
fi

# Final schema verification
echo ""
echo "Final schema verification:"
bash "$SCRIPTS_DIR/verify_production_schema.sh"

echo ""
echo "=============================================="
echo "✓ DEPLOYMENT COMPLETE"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Test import via Admin Dashboard"
echo "  2. Import should complete without 500 errors"
echo "  3. Check database for successful import"
echo ""
