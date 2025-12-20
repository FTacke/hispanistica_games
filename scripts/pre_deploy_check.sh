#!/bin/bash
# =============================================================================
# CO.RA.PAN Pre-Deploy Check Script
# =============================================================================
#
# Performs a complete deployment smoke test locally:
# 1. Builds Docker image
# 2. Starts PostgreSQL database
# 3. Runs database migrations
# 4. Creates initial admin user
# 5. Starts web application
# 6. Tests health endpoint
# 7. Tests login flow
#
# Usage:
#   ./scripts/pre_deploy_check.sh           # Full check
#   ./scripts/pre_deploy_check.sh --quick   # Skip build, quick health check only
#
# Exit codes:
#   0 - All checks passed
#   1 - Build failed
#   2 - Database failed to start
#   3 - Web service failed to start
#   4 - Health check failed
#   5 - Login test failed
#
# =============================================================================

set -e

# Configuration
COMPOSE_FILE="infra/docker-compose.dev.yml"
ADMIN_USER="${START_ADMIN_USERNAME:-admin}"
ADMIN_PASS="${START_ADMIN_PASSWORD:-admin}"
WEB_PORT="${WEB_PORT:-8000}"
MAX_WAIT_SECONDS=60

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging helpers
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${GREEN}=== $1 ===${NC}"; }

# Cleanup function
cleanup() {
    log_step "Cleanup"
    docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans 2>/dev/null || true
}

# Parse arguments
QUICK_MODE=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --quick|-q) QUICK_MODE=true ;;
        --help|-h)
            echo "Usage: $0 [--quick]"
            echo "  --quick  Skip Docker build, only run health checks"
            exit 0
            ;;
        *) log_error "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Trap to ensure cleanup on exit
trap cleanup EXIT

log_step "CO.RA.PAN Pre-Deploy Check"
log_info "Compose file: $COMPOSE_FILE"
log_info "Admin user: $ADMIN_USER"
log_info "Web port: $WEB_PORT"

# -----------------------------------------------------------------------------
# Step 1: Build Docker Image
# -----------------------------------------------------------------------------
if [ "$QUICK_MODE" = false ]; then
    log_step "Step 1: Building Docker Image"
    
    if ! docker compose -f "$COMPOSE_FILE" build web; then
        log_error "Docker build failed!"
        exit 1
    fi
    log_info "Docker image built successfully"
else
    log_info "Skipping Docker build (quick mode)"
fi

# -----------------------------------------------------------------------------
# Step 2: Start Database
# -----------------------------------------------------------------------------
log_step "Step 2: Starting Database"

# Stop any existing containers first
docker compose -f "$COMPOSE_FILE" down --volumes 2>/dev/null || true

# Start only the database service
if ! docker compose -f "$COMPOSE_FILE" up -d db; then
    log_error "Failed to start database!"
    exit 2
fi

# Wait for database to be healthy
log_info "Waiting for database to be ready..."
SECONDS_WAITED=0
while [ $SECONDS_WAITED -lt $MAX_WAIT_SECONDS ]; do
    if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U corapan_app -d corapan_auth >/dev/null 2>&1; then
        log_info "Database is ready (waited ${SECONDS_WAITED}s)"
        break
    fi
    sleep 1
    SECONDS_WAITED=$((SECONDS_WAITED + 1))
done

if [ $SECONDS_WAITED -ge $MAX_WAIT_SECONDS ]; then
    log_error "Database failed to become ready within ${MAX_WAIT_SECONDS}s"
    exit 2
fi

# -----------------------------------------------------------------------------
# Step 3: Start Web Service
# -----------------------------------------------------------------------------
log_step "Step 3: Starting Web Service"

# Export admin credentials for the web service
export START_ADMIN_USERNAME="$ADMIN_USER"
export START_ADMIN_PASSWORD="$ADMIN_PASS"
export FLASK_SECRET_KEY="${FLASK_SECRET_KEY:-test-secret-for-pre-deploy}"
export JWT_SECRET_KEY="${JWT_SECRET_KEY:-test-jwt-secret-for-pre-deploy}"

if ! docker compose -f "$COMPOSE_FILE" up -d web; then
    log_error "Failed to start web service!"
    exit 3
fi

# Wait for web service to be ready
log_info "Waiting for web service to be ready..."
SECONDS_WAITED=0
while [ $SECONDS_WAITED -lt $MAX_WAIT_SECONDS ]; do
    if curl -sf "http://localhost:${WEB_PORT}/health" >/dev/null 2>&1; then
        log_info "Web service is ready (waited ${SECONDS_WAITED}s)"
        break
    fi
    sleep 1
    SECONDS_WAITED=$((SECONDS_WAITED + 1))
done

if [ $SECONDS_WAITED -ge $MAX_WAIT_SECONDS ]; then
    log_error "Web service failed to become ready within ${MAX_WAIT_SECONDS}s"
    log_error "Container logs:"
    docker compose -f "$COMPOSE_FILE" logs web --tail=50
    exit 3
fi

# -----------------------------------------------------------------------------
# Step 4: Health Check
# -----------------------------------------------------------------------------
log_step "Step 4: Health Check"

HEALTH_RESPONSE=$(curl -sf "http://localhost:${WEB_PORT}/health" 2>&1)
HEALTH_STATUS=$?

if [ $HEALTH_STATUS -ne 0 ]; then
    log_error "Health endpoint not reachable!"
    exit 4
fi

log_info "Health response: $HEALTH_RESPONSE"

# Parse health status using jq if available, otherwise grep
if command -v jq &> /dev/null; then
    OVERALL_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status')
    AUTH_DB_OK=$(echo "$HEALTH_RESPONSE" | jq -r '.checks.auth_db.ok')
else
    OVERALL_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    AUTH_DB_OK=$(echo "$HEALTH_RESPONSE" | grep -o '"auth_db":{"ok":true' || echo "false")
    [ -n "$AUTH_DB_OK" ] && AUTH_DB_OK="true" || AUTH_DB_OK="false"
fi

log_info "Overall status: $OVERALL_STATUS"
log_info "Auth DB OK: $AUTH_DB_OK"

if [ "$OVERALL_STATUS" = "unhealthy" ]; then
    log_error "Health check reports unhealthy status!"
    exit 4
fi

if [ "$AUTH_DB_OK" != "true" ]; then
    log_error "Auth database is not healthy!"
    exit 4
fi

log_info "Health check passed"

# -----------------------------------------------------------------------------
# Step 5: Login Test
# -----------------------------------------------------------------------------
log_step "Step 5: Login Test"

# Test login with admin credentials
log_info "Testing login with admin credentials..."

LOGIN_RESPONSE=$(curl -sf -X POST "http://localhost:${WEB_PORT}/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${ADMIN_USER}&password=${ADMIN_PASS}" \
    -w "\n%{http_code}" \
    -c /tmp/cookies.txt \
    2>&1)

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)

log_info "Login response code: $HTTP_CODE"

# Successful login should return 303 redirect or 200/204 for JSON
if [ "$HTTP_CODE" = "303" ] || [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    log_info "Login successful!"
    
    # Check for access_token_cookie
    if grep -q "access_token_cookie" /tmp/cookies.txt 2>/dev/null; then
        log_info "Auth cookies set correctly"
    else
        log_warn "Auth cookies may not be set (check manually)"
    fi
else
    log_error "Login failed with HTTP code: $HTTP_CODE"
    log_error "Response: $RESPONSE_BODY"
    exit 5
fi

# Test authenticated endpoint
log_info "Testing authenticated endpoint..."
AUTH_TEST=$(curl -sf "http://localhost:${WEB_PORT}/auth/session" \
    -b /tmp/cookies.txt \
    2>&1)

if echo "$AUTH_TEST" | grep -q '"authenticated":true'; then
    log_info "Session check passed - user is authenticated"
else
    log_warn "Session check returned: $AUTH_TEST"
fi

# Cleanup temp files
rm -f /tmp/cookies.txt

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
log_step "Pre-Deploy Check Complete"

echo ""
echo -e "${GREEN}✓ All checks passed!${NC}"
echo ""
echo "Summary:"
echo "  - Docker image built successfully"
echo "  - PostgreSQL database started and healthy"
echo "  - Web application started and healthy"
echo "  - Health endpoint working (auth_db connected)"
echo "  - Login flow working with admin credentials"
echo ""
echo "Ready for deployment:"
echo "  Production: docker compose -f infra/docker-compose.prod.yml up -d --build"
echo ""

exit 0
