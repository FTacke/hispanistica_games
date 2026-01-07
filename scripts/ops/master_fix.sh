#!/bin/bash
# MASTER SCRIPT: Prove → Fix → Verify → Deploy
# One command to rule them all

set -e

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  MASTER FIX: varchar(100) → text                          ║"
echo "║  Diagnose → Fix → Verify → Deploy                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Diagnose
echo "STEP 1: Diagnose current state"
echo "=========================================="
bash "$SCRIPTS_DIR/diagnose_varchar.sh"
read -p "Press ENTER to continue..." _

# Step 2: Check for create_all trap
echo ""
echo "STEP 2: Check for create_all trap"
echo "=========================================="
bash "$SCRIPTS_DIR/check_will_create_all_break_it.sh" || {
    echo ""
    echo "ERROR: create_all() will undo the migration!"
    echo "Please fix docker-entrypoint.sh before proceeding"
    exit 1
}
read -p "Press ENTER to continue..." _

# Step 3: Apply fix
echo ""
echo "STEP 3: Apply ALTER TABLE fix"
echo "=========================================="
bash "$SCRIPTS_DIR/fix_varchar_now.sh"
read -p "Press ENTER to continue..." _

# Step 4: Deploy
echo ""
echo "STEP 4: Deploy updated webapp"
echo "=========================================="

cd /srv/webapps/games_hispanistica/app

echo "Running deploy_prod.sh..."
bash scripts/deploy/deploy_prod.sh

# Step 5: Final verification
echo ""
echo "STEP 5: Final verification"
echo "=========================================="

sleep 5

# Re-run diagnose to confirm
bash "$SCRIPTS_DIR/diagnose_varchar.sh"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✓ MIGRATION COMPLETE                                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next: Test import via Admin Dashboard"
echo "  POST /quiz-admin/api/releases/release_20260107_223906_7b66/import"
echo ""
echo "Expected response:"
echo '  {"ok": true, "questions_imported": 18, "errors": []}'
echo ""
