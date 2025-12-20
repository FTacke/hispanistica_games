#!/usr/bin/env bash
# Deployment Checklist for Advanced Search Backend Stabilization [2.5.0]
# 
# Use this checklist to verify all changes before deploying to production.
# Status: 2025-11-10

set -e

echo "=================================================="
echo "Advanced Search Backend Deployment Checklist"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    local file=$1
    local name=$2
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $name exists: $file"
        return 0
    else
        echo -e "${RED}✗${NC} $name missing: $file"
        return 1
    fi
}

check_dir() {
    local dir=$1
    local name=$2
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $name exists: $dir"
        return 0
    else
        echo -e "${RED}✗${NC} $name missing: $dir"
        return 1
    fi
}

echo "1. Core Files"
echo "============="
check_file "src/app/search/advanced_api.py" "Advanced API module"
check_file "src/app/search/cql.py" "CQL Builder (refactored)"
check_file "src/app/search/advanced.py" "Advanced Search (updated)"
check_file "scripts/test_advanced_search_real.py" "Live test suite"

echo ""
echo "2. Index"
echo "========"
check_dir "data/blacklab_index" "BlackLab index"
check_file "data/blacklab_index/index.json" "Index metadata"

echo ""
echo "3. Configuration"
echo "==============="
echo -e "${YELLOW}→${NC} Verify environment variables:"
echo "   FLASK_ENV=production"
echo "   BLS_BASE_URL=http://127.0.0.1:8081/blacklab-server"
echo ""
echo -e "${YELLOW}→${NC} Verify gunicorn settings:"
echo "   --timeout 180"
echo "   --keep-alive 5"
echo ""

echo "4. Documentation"
echo "================"
check_file "docs/how-to/advanced-search.md" "How-to guide (updated with export)"
check_file "docs/operations/runbook-advanced-search.md" "Runbook (updated with incident 5)"
check_file "CHANGELOG.md" "Changelog (added [2.5.0])"

echo ""
echo "5. Python Syntax Check"
echo "======================"
python -m py_compile src/app/search/advanced_api.py && \
    echo -e "${GREEN}✓${NC} advanced_api.py syntax OK" || \
    echo -e "${RED}✗${NC} advanced_api.py syntax ERROR"

python -m py_compile src/app/search/cql.py && \
    echo -e "${GREEN}✓${NC} cql.py syntax OK" || \
    echo -e "${RED}✗${NC} cql.py syntax ERROR"

python -m py_compile scripts/test_advanced_search_real.py && \
    echo -e "${GREEN}✓${NC} test_advanced_search_real.py syntax OK" || \
    echo -e "${RED}✗${NC} test_advanced_search_real.py syntax ERROR"

echo ""
echo "6. Pre-Deployment Tests"
echo "======================="
echo -e "${YELLOW}→${NC} Start BlackLab Server (if not running):"
echo "   bash scripts/run_bls.sh 8081 4g 1g"
echo ""
echo -e "${YELLOW}→${NC} Start Flask App:"
echo "   export FLASK_ENV=production"
echo "   export BLS_BASE_URL=http://127.0.0.1:8081/blacklab-server"
echo "   python scripts/start_waitress.py"
echo ""
echo -e "${YELLOW}→${NC} Run live tests (in another terminal):"
echo "   python scripts/test_advanced_search_real.py"
echo ""
echo "   Expected: 3/3 tests passed (all green)"
echo ""

echo "7. Deployment Steps"
echo "==================="
echo "1. Run this checklist to verify all files"
echo "2. Backup current version (git tag)"
echo "3. Pull code changes"
echo "4. Run tests: python scripts/test_advanced_search_real.py"
echo "5. Monitor logs:"
echo "   - Flask: tail -f logs/flask.log"
echo "   - Gunicorn: sudo journalctl -u corapan-gunicorn -f"
echo "6. Check monitoring dashboard (if exists)"
echo ""

echo "8. Post-Deployment Validation"
echo "=============================="
echo "- [ ] /search/advanced/data returns 200 (DataTables)"
echo "- [ ] /search/advanced/export returns 200 (CSV)"
echo "- [ ] All filters working (country, speaker, sex, mode, discourse)"
echo "- [ ] Export respects 50k row cap"
echo "- [ ] Rate limits active (30/min DataTables, 5/min Export)"
echo ""

echo "=================================================="
echo "Checklist Complete!"
echo "=================================================="
