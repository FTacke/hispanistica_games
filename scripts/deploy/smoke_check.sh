#!/bin/bash
# =============================================================================
# games_hispanistica Smoke Check Script
# =============================================================================
#
# Post-deployment health verification. Checks:
#   1. Container is running
#   2. /health endpoint responds
#   3. /health/db endpoint responds (database connection)
#   4. (Optional) Public domain check
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
#
# Usage:
#   bash scripts/deploy/smoke_check.sh
#   bash scripts/deploy/smoke_check.sh --domain games.hispanistica.com
#
# =============================================================================

set -euo pipefail

# Configuration
CONTAINER_NAME="games-webapp"
HOST_PORT=7000
LOCAL_BASE_URL="http://localhost:${HOST_PORT}"
MAX_RETRIES=5
RETRY_DELAY=2

# Parse arguments
DOMAIN=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_check() { echo -e "  Checking: $1"; }
log_pass() { echo -e "  ${GREEN}✓${NC} $1"; }
log_fail() { echo -e "  ${RED}✗${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}!${NC} $1"; }

FAILED=0

echo "=============================================="
echo "games_hispanistica Smoke Check"
echo "=============================================="
echo ""

# -----------------------------------------------------------------------------
# Check 1: Container running
# -----------------------------------------------------------------------------
log_check "Container status"

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    STATUS=$(docker inspect --format='{{.State.Status}}' "${CONTAINER_NAME}")
    log_pass "Container '${CONTAINER_NAME}' is ${STATUS}"
else
    log_fail "Container '${CONTAINER_NAME}' is not running"
    FAILED=1
fi

# -----------------------------------------------------------------------------
# Check 2: Health endpoint (with retries)
# -----------------------------------------------------------------------------
log_check "Health endpoint (${LOCAL_BASE_URL}/health)"

HEALTH_OK=0
for i in $(seq 1 $MAX_RETRIES); do
    RESPONSE=$(curl -sf "${LOCAL_BASE_URL}/health" 2>/dev/null || echo "")
    if [ -n "$RESPONSE" ]; then
        # Check response contains expected fields
        if echo "$RESPONSE" | grep -q '"status".*"ok"'; then
            HEALTH_OK=1
            log_pass "Health endpoint OK: $RESPONSE"
            break
        fi
    fi
    if [ $i -lt $MAX_RETRIES ]; then
        sleep $RETRY_DELAY
    fi
done

if [ $HEALTH_OK -eq 0 ]; then
    log_fail "Health endpoint not responding after ${MAX_RETRIES} attempts"
    FAILED=1
fi

# -----------------------------------------------------------------------------
# Check 3: Database health endpoint
# -----------------------------------------------------------------------------
log_check "Database health endpoint (${LOCAL_BASE_URL}/health/db)"

DB_RESPONSE=$(curl -sf "${LOCAL_BASE_URL}/health/db" 2>/dev/null || echo "")
if [ -n "$DB_RESPONSE" ]; then
    if echo "$DB_RESPONSE" | grep -q '"status".*"ok"'; then
        log_pass "Database connection OK"
    elif echo "$DB_RESPONSE" | grep -q '"status".*"error"'; then
        ERROR=$(echo "$DB_RESPONSE" | grep -o '"error"[^,}]*' || echo "unknown")
        log_fail "Database connection failed: $ERROR"
        FAILED=1
    else
        log_warn "Unexpected database health response: $DB_RESPONSE"
    fi
else
    log_fail "Database health endpoint not responding"
    FAILED=1
fi

# -----------------------------------------------------------------------------
# Check 4: Public domain (optional)
# -----------------------------------------------------------------------------
if [ -n "$DOMAIN" ]; then
    PUBLIC_URL="https://${DOMAIN}"
    log_check "Public domain (${PUBLIC_URL}/health)"

    PUBLIC_RESPONSE=$(curl -sf --max-time 10 "${PUBLIC_URL}/health" 2>/dev/null || echo "")
    if [ -n "$PUBLIC_RESPONSE" ] && echo "$PUBLIC_RESPONSE" | grep -q '"status".*"ok"'; then
        log_pass "Public domain accessible"
    else
        log_warn "Public domain not accessible (may be expected if DNS/SSL not configured)"
    fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "=============================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All smoke checks passed${NC}"
    echo "=============================================="
    exit 0
else
    echo -e "${RED}Some smoke checks failed${NC}"
    echo "=============================================="
    echo ""
    echo "Troubleshooting:"
    echo "  docker logs ${CONTAINER_NAME} --tail 50"
    echo "  docker exec ${CONTAINER_NAME} python -c 'from src.app import create_app; print(\"OK\")'"
    exit 1
fi
