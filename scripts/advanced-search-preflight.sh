#!/bin/bash
#
# Advanced Search UI - Pre-Flight Checklist
# Run this script to verify all components are in place before deployment
#
# Usage: bash scripts/advanced-search-preflight.sh
#

set -e

WORKSPACE="${WORKSPACE:-.}"
PASSED=0
FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Advanced Search UI - Pre-Flight Check"
echo "=========================================="
echo ""

# ============ FILE CHECKS ============
echo "📋 Checking files..."
echo ""

check_file() {
  local file=$1
  local desc=$2
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $desc"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} $desc (missing: $file)"
    ((FAILED++))
    return 1
  fi
}

check_dir() {
  local dir=$1
  local desc=$2
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✅${NC} $desc"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌${NC} $desc (missing: $dir)"
    ((FAILED++))
    return 1
  fi
}

# Template
check_file "templates/search/advanced.html" "Template"

# JavaScript
check_file "static/js/modules/advanced/initTable.js" "DataTables Module"
check_file "static/js/modules/advanced/formHandler.js" "Form Handler Module"

# CSS
check_file "static/css/search/advanced.css" "Advanced CSS"

# Documentation
check_file "docs/TESTING-advanced-search-ui.md" "Testing Guide"
check_file "docs/RELEASE-NOTES-2.5.0-UI.md" "Release Notes"
check_file "docs/reference/advanced-search-frontend-quick-ref.md" "Quick Reference"
check_file "docs/archived/IMPLEMENTATION-REPORT-2025-11-10-advanced-search-ui.md" "Implementation Report"

# Dependencies (existing)
# check_file "static/js/modules/corpus/filters.js" "Filters Manager"
# check_file "static/js/modules/corpus/config.js" "Corpus Config"

echo ""
echo "=========================================="
echo ""

# ============ PYTHON SYNTAX CHECKS ============
echo "🐍 Checking Python syntax..."
echo ""

# Backend API endpoints should exist (check routes)
if grep -q "advanced_api" "src/app/search/__init__.py" 2>/dev/null; then
  echo -e "${GREEN}✅${NC} advanced_api imported in search module"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} advanced_api not imported in search module"
  ((FAILED++))
fi

if grep -q "advanced_api.bp" "src/app/routes/__init__.py" 2>/dev/null; then
  echo -e "${GREEN}✅${NC} advanced_api blueprint registered"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️${NC} advanced_api blueprint may not be registered"
  ((FAILED++))
fi

echo ""
echo "=========================================="
echo ""

# ============ HTML VALIDATION ============
echo "🔍 Checking HTML structure..."
echo ""

if grep -q 'id="advanced-search-form"' "templates/search/advanced.html"; then
  echo -e "${GREEN}✅${NC} Main form present"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} Main form missing (id='advanced-search-form')"
  ((FAILED++))
fi

if grep -q 'id="advanced-table"' "templates/search/advanced.html"; then
  echo -e "${GREEN}✅${NC} DataTables table present"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} DataTables table missing (id='advanced-table')"
  ((FAILED++))
fi

if grep -q 'id="search-summary"' "templates/search/advanced.html"; then
  echo -e "${GREEN}✅${NC} Summary box present"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} Summary box missing (id='search-summary')"
  ((FAILED++))
fi

if grep -q 'id="export-csv-btn"' "templates/search/advanced.html"; then
  echo -e "${GREEN}✅${NC} Export buttons present"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} Export buttons missing"
  ((FAILED++))
fi

if grep -q 'id="filter-country-code"' "templates/search/advanced.html"; then
  echo -e "${GREEN}✅${NC} Filter selects present"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} Filter selects missing"
  ((FAILED++))
fi

if grep -q 'aria-live="polite"' "templates/search/advanced.html"; then
  echo -e "${GREEN}✅${NC} Accessibility attributes present"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️${NC} aria-live attribute missing (A11y)"
  ((FAILED++))
fi

echo ""
echo "=========================================="
echo ""

# ============ JAVASCRIPT CHECKS ============
echo "📦 Checking JavaScript structure..."
echo ""

if grep -q "initAdvancedTable" "static/js/modules/advanced/initTable.js"; then
  echo -e "${GREEN}✅${NC} initAdvancedTable function exists"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} initAdvancedTable function missing"
  ((FAILED++))
fi

if grep -q "bindFormSubmit" "static/js/modules/advanced/formHandler.js"; then
  echo -e "${GREEN}✅${NC} bindFormSubmit function exists"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} bindFormSubmit function missing"
  ((FAILED++))
fi

if grep -q "buildQueryParams" "static/js/modules/advanced/formHandler.js"; then
  echo -e "${GREEN}✅${NC} buildQueryParams function exists"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} buildQueryParams function missing"
  ((FAILED++))
fi

if grep -q "bindResetButton" "static/js/modules/advanced/formHandler.js"; then
  echo -e "${GREEN}✅${NC} bindResetButton function exists"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} bindResetButton function missing"
  ((FAILED++))
fi

echo ""
echo "=========================================="
echo ""

# ============ CSS CHECKS ============
echo "🎨 Checking CSS classes..."
echo ""

CSS_FILE="static/css/search/advanced.css"

if grep -q ".md3-search-summary" "$CSS_FILE"; then
  echo -e "${GREEN}✅${NC} Summary box styles present"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} Summary box styles missing"
  ((FAILED++))
fi

if grep -q ".md3-datatable" "$CSS_FILE"; then
  echo -e "${GREEN}✅${NC} DataTables styles present"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} DataTables styles missing"
  ((FAILED++))
fi

if grep -q ".md3-export-buttons" "$CSS_FILE"; then
  echo -e "${GREEN}✅${NC} Export buttons styles present"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} Export buttons styles missing"
  ((FAILED++))
fi

if grep -q ".md3-form-row--4col" "$CSS_FILE"; then
  echo -e "${GREEN}✅${NC} 4-column grid present"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} 4-column grid missing"
  ((FAILED++))
fi

if grep -q "media (max-width: 768px)" "$CSS_FILE"; then
  echo -e "${GREEN}✅${NC} Mobile responsive styles present"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️${NC} Mobile responsive styles may be missing"
  ((FAILED++))
fi

echo ""
echo "=========================================="
echo ""

# ============ SUMMARY ============
TOTAL=$((PASSED + FAILED))

echo "📊 Summary"
echo "=========================================="
echo -e "Total checks: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Ready for deployment.${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. npm run build (if using Vite)"
  echo "  2. python -m src.app.main"
  echo "  3. Open http://localhost:5000/search/advanced"
  echo "  4. Run: python scripts/test_advanced_search_real.py"
  exit 0
else
  echo -e "${RED}❌ Some checks failed. Fix issues above before deploying.${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "  - Check file paths (use absolute paths if needed)"
  echo "  - Verify Python/Flask imports"
  echo "  - Run syntax checks: python -m py_compile"
  exit 1
fi
