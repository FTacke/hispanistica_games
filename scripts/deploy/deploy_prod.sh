#!/bin/bash
# =============================================================================
# games_hispanistica Production Deployment Script
# =============================================================================
#
# This script is executed by the GitHub self-hosted runner (or manually)
# to deploy the application. It performs the following steps:
#   1. Fetch and reset to latest code from origin/main
#   2. Build Docker image (tagged with git SHA)
#   3. Stop and remove old container
#   4. Start new container with configured volumes
#   5. Run database setup (idempotent)
#   6. Execute smoke checks
#
# This script is IDEMPOTENT - safe to run multiple times.
#
# Prerequisites:
#   - Docker installed and running
#   - Git repository cloned to /srv/webapps/games_hispanistica/app
#   - passwords.env configured in /srv/webapps/games_hispanistica/config/
#   - Docker network exists (set via DOCKER_NETWORK env, default: games-network)
#     Production: export DOCKER_NETWORK=corapan-network in passwords.env
#
# Usage:
#   cd /srv/webapps/games_hispanistica/app
#   bash scripts/deploy/deploy_prod.sh
#
# =============================================================================

set -euo pipefail

# Configuration (from app_identity)
CONTAINER_NAME="games-webapp"
IMAGE_NAME="games-webapp"
HOST_PORT=7000
CONTAINER_PORT=5000

# Docker network (configurable via env, default: corapan-network)
# Production: MUST use corapan-network for compatibility with host PostgreSQL
# Containers connect to host PostgreSQL via host.docker.internal (host-gateway mapping)
DOCKER_NETWORK="${DOCKER_NETWORK:-corapan-network}"

# Paths (on the host)
BASE_DIR="/srv/webapps/games_hispanistica"
APP_DIR="${BASE_DIR}/app"
DATA_DIR="${BASE_DIR}/data"
MEDIA_DIR="${BASE_DIR}/media"
CONFIG_DIR="${BASE_DIR}/config"
LOGS_DIR="${BASE_DIR}/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Track if we need to rollback
OLD_IMAGE_ID=""
DEPLOYMENT_FAILED=0

cleanup_on_error() {
    if [ $DEPLOYMENT_FAILED -eq 1 ]; then
        log_error "Deployment failed! Attempting cleanup..."
        # Show recent logs
        log_info "Container logs (last 50 lines):"
        docker logs "${CONTAINER_NAME}" 2>&1 | tail -50 || true
    fi
}
trap cleanup_on_error EXIT

echo "=============================================="
echo "games_hispanistica Production Deployment"
echo "=============================================="
echo "Started at: $(date)"
echo ""

# -----------------------------------------------------------------------------
# Step 0: Pre-flight checks
# -----------------------------------------------------------------------------
log_info "Running pre-flight checks..."

# Verify we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    log_error "Not in repository root. Expected to find pyproject.toml"
    log_error "Run this script from: ${APP_DIR}"
    exit 1
fi

# Verify config exists
if [ ! -f "${CONFIG_DIR}/passwords.env" ]; then
    log_error "Missing ${CONFIG_DIR}/passwords.env"
    log_error "Run server_bootstrap.sh and configure passwords.env first"
    exit 1
fi

# Parse AUTH_DATABASE_URL from passwords.env for preflight checks
log_info "Parsing database configuration from passwords.env..."
if ! AUTH_DATABASE_URL=$(grep '^AUTH_DATABASE_URL=' "${CONFIG_DIR}/passwords.env" | cut -d= -f2- | tr -d '"' | tr -d "'"); then
    log_error "Failed to extract AUTH_DATABASE_URL from passwords.env"
    exit 1
fi

if [ -z "$AUTH_DATABASE_URL" ]; then
    log_error "AUTH_DATABASE_URL is empty in passwords.env"
    exit 1
fi

# Parse database connection details using Python (never log password)
DB_PARSE_RESULT=$(python3 -c "
from urllib.parse import urlparse
import sys

try:
    url = '${AUTH_DATABASE_URL}'
    parsed = urlparse(url)
    
    # Extract components
    host = parsed.hostname or 'localhost'
    port = parsed.port or 5432
    user = parsed.username or 'postgres'
    dbname = parsed.path.lstrip('/') or 'postgres'
    
    # Output format: host|port|user|dbname (no password)
    print(f'{host}|{port}|{user}|{dbname}')
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
" 2>&1)

if [ $? -ne 0 ]; then
    log_error "Failed to parse AUTH_DATABASE_URL: ${DB_PARSE_RESULT}"
    exit 1
fi

# Split parsed result
IFS='|' read -r DB_HOST DB_PORT DB_USER DB_NAME <<< "$DB_PARSE_RESULT"

log_success "Database config parsed: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Preflight: Test PostgreSQL connectivity from within Docker network
log_info "Preflight: Testing PostgreSQL connectivity via Docker network..."
if docker run --rm --network "${DOCKER_NETWORK}" postgres:16-alpine \
    pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1; then
    log_success "PostgreSQL is reachable from Docker network '${DOCKER_NETWORK}'"
else
    log_error "PostgreSQL preflight check failed!"
    log_error "Cannot reach ${DB_HOST}:${DB_PORT} from Docker network '${DOCKER_NETWORK}'"
    log_error "Verify:"
    log_error "  1. PostgreSQL is running and accessible"
    log_error "  2. AUTH_DATABASE_URL in passwords.env is correct"
    log_error "  3. Network '${DOCKER_NETWORK}' can reach the database host"
    exit 1
fi

# Docker access diagnostics
log_info "Docker diagnostics:"
echo "  User: $(whoami) (UID: $(id -u), GID: $(id -g))"
echo "  Groups: $(groups)"

# Check docker socket
if [ -e /var/run/docker.sock ]; then
    echo "  Socket: /var/run/docker.sock ($(ls -l /var/run/docker.sock | awk '{print $1, $3, $4}'))"
else
    echo "  Socket: /var/run/docker.sock NOT FOUND"
fi

# Check docker context
if command -v docker &> /dev/null; then
    DOCKER_CONTEXT=$(docker context show 2>/dev/null || echo "default")
    echo "  Context: ${DOCKER_CONTEXT}"
else
    log_error "Docker command not found in PATH"
    exit 1
fi

# Test docker daemon access
log_info "Testing Docker daemon access..."
if docker info > /dev/null 2>&1; then
    DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    log_success "Docker daemon accessible (Server version: ${DOCKER_VERSION})"
else
    DOCKER_EXIT_CODE=$?
    log_error "Docker daemon NOT accessible (exit code: ${DOCKER_EXIT_CODE})"
    echo ""
    log_error "Possible causes:"
    log_error "  1. Docker daemon not running"
    log_error "  2. User '$(whoami)' lacks permission to access /var/run/docker.sock"
    log_error "  3. Docker running in rootless mode with different socket"
    log_error "  4. Wrong docker context (current: ${DOCKER_CONTEXT})"
    echo ""
    log_error "Solutions:"
    log_error "  • Add user to docker group: sudo usermod -aG docker $(whoami)"
    log_error "  • Or run as root: sudo bash ${BASH_SOURCE[0]}"
    log_error "  • Or check: systemctl status docker"
    exit 2
fi

# Verify Docker network exists (or auto-create)
log_info "Checking Docker network: ${DOCKER_NETWORK}..."
if docker network inspect "${DOCKER_NETWORK}" &> /dev/null; then
    NETWORK_SUBNET=$(docker network inspect "${DOCKER_NETWORK}" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')
    log_success "Network '${DOCKER_NETWORK}' exists (subnet: ${NETWORK_SUBNET})"
else
    log_warn "Network '${DOCKER_NETWORK}' does not exist"
    log_info "Creating network '${DOCKER_NETWORK}' with subnet 172.18.0.0/16 (corapan standard)..."
    
    if docker network create \
        --driver bridge \
        --subnet=172.18.0.0/16 \
        --gateway=172.18.0.1 \
        "${DOCKER_NETWORK}" > /dev/null 2>&1; then
        log_success "Network '${DOCKER_NETWORK}' created successfully"
    else
        NETWORK_EXIT_CODE=$?
        log_error "Failed to create network '${DOCKER_NETWORK}' (exit code: ${NETWORK_EXIT_CODE})"
        echo ""
        log_error "Possible causes:"
        log_error "  1. Subnet 172.18.0.0/16 already in use by another network"
        log_error "  2. Insufficient Docker permissions"
        echo ""
        log_error "Check existing networks:"
        docker network ls
        echo ""
        log_error "If subnet conflict, run: docker network inspect <conflicting-network>"
        log_error "Then either remove conflict or run server_bootstrap.sh manually"
        exit 3
    fi
fi

# -----------------------------------------------------------------------------
# Step 0.5: Verify Host PostgreSQL Reachability (from Docker context)
# -----------------------------------------------------------------------------
log_info "Verifying host PostgreSQL is reachable from Docker context..."

# Check if PostgreSQL is running on host (if available)
if command -v pg_isready &> /dev/null; then
    if pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
        log_success "PostgreSQL service running on host (127.0.0.1:5432)"
    else
        log_warn "pg_isready failed for host PostgreSQL (may be normal if pg_isready not configured)"
    fi
fi

# CRITICAL: Test DB connectivity from Docker container context using host.docker.internal
log_info "Testing PostgreSQL connectivity from Docker container (host.docker.internal)..."

# Source passwords.env to get DB credentials (without exposing in process list)
if [ -f "${CONFIG_DIR}/passwords.env" ]; then
    # Extract DB_USER and DB_NAME from AUTH_DATABASE_URL (if present)
    # Format: postgresql://user:pass@host:port/dbname
    DB_TEST_USER=$(grep -E '^AUTH_DATABASE_URL=' "${CONFIG_DIR}/passwords.env" | sed -E 's/.*:\/\/([^:]+):.*/\1/' || echo "postgres")
    DB_TEST_NAME=$(grep -E '^AUTH_DATABASE_URL=' "${CONFIG_DIR}/passwords.env" | sed -E 's/.*\/([^?]+).*/\1/' || echo "postgres")
else
    DB_TEST_USER="postgres"
    DB_TEST_NAME="postgres"
fi

log_info "  Testing with: user=${DB_TEST_USER}, db=${DB_TEST_NAME}"

# Run temporary container to test DB connectivity
if docker run --rm \
    --network "${DOCKER_NETWORK}" \
    --add-host=host.docker.internal:host-gateway \
    postgres:16-alpine \
    pg_isready -h host.docker.internal -p 5432 -U "${DB_TEST_USER}" -d "${DB_TEST_NAME}" -q 2>&1; then
    log_success "✓ PostgreSQL reachable from Docker via host.docker.internal"
else
    log_error "✗ PostgreSQL NOT reachable from Docker container!"
    echo ""
    log_error "This is a CRITICAL failure. Container will not be able to connect to database."
    log_error ""
    log_error "Root cause: Host PostgreSQL not accessible via host.docker.internal"
    log_error ""
    log_error "Troubleshooting steps:"
    log_error "  1. Verify PostgreSQL is running on host:"
    log_error "       systemctl status postgresql@14-main"
    log_error "       ss -tlnp | grep 5432"
    log_error "  2. Check PostgreSQL listens on Docker bridge:"
    log_error "       grep 'listen_addresses' /etc/postgresql/*/main/postgresql.conf"
    log_error "       (should include '172.18.0.1' or '0.0.0.0')"
    log_error "  3. Check pg_hba.conf allows Docker network:"
    log_error "       grep '172.18' /etc/postgresql/*/main/pg_hba.conf"
    log_error "  4. Test from host:"
    log_error "       pg_isready -h 172.18.0.1 -p 5432"
    echo ""
    log_error "Deploy ABORTED. Fix database connectivity first."
    exit 10
fi

log_success "Pre-flight checks passed"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Update code from Git
# -----------------------------------------------------------------------------
log_info "Fetching latest code from origin/main..."

git fetch origin
git reset --hard origin/main

GIT_SHA=$(git rev-parse --short HEAD)
GIT_SHA_FULL=$(git rev-parse HEAD)
log_success "Code updated to: ${GIT_SHA}"
echo ""

# -----------------------------------------------------------------------------
# Step 2: Build Docker image
# -----------------------------------------------------------------------------
# Tag with both :latest and :sha for potential rollback
IMAGE_TAG_LATEST="${IMAGE_NAME}:latest"
IMAGE_TAG_SHA="${IMAGE_NAME}:${GIT_SHA}"

log_info "Building Docker image: ${IMAGE_TAG_SHA}..."

# Store old image ID for potential rollback
OLD_IMAGE_ID=$(docker images -q "${IMAGE_TAG_LATEST}" 2>/dev/null || echo "")

# Build without BuildKit (server compatibility)
DOCKER_BUILDKIT=0 docker build \
    -t "${IMAGE_TAG_SHA}" \
    -t "${IMAGE_TAG_LATEST}" \
    --build-arg GIT_COMMIT="${GIT_SHA_FULL}" \
    .

log_success "Docker image built: ${IMAGE_TAG_SHA}"
echo ""

# -----------------------------------------------------------------------------
# Step 3: Stop and remove old container
# -----------------------------------------------------------------------------
log_info "Stopping old container (if running)..."

docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

log_success "Old container removed"
echo ""

# -----------------------------------------------------------------------------
# Step 4: Start new container
# -----------------------------------------------------------------------------
log_info "Starting new container: ${CONTAINER_NAME}..."

# Always remove any leftover container before starting (idempotent)
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

# Run container - must succeed or script aborts
docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --network "${DOCKER_NETWORK}" \
    -p "${HOST_PORT}:${CONTAINER_PORT}" \
    -v "${DATA_DIR}:/app/data" \
    -v "${MEDIA_DIR}:/app/media:ro" \
    -v "${LOGS_DIR}:/app/logs" \
    --env-file "${CONFIG_DIR}/passwords.env" \
    -e "FLASK_ENV=production" \
    -e "GIT_COMMIT=${GIT_SHA}" \
    "${IMAGE_TAG_LATEST}"

# Verify container is actually running after docker run
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    DEPLOYMENT_FAILED=1
    log_error "Container '${CONTAINER_NAME}' is not running after docker run!"
    log_error "Showing container logs:"
    docker logs "${CONTAINER_NAME}" 2>&1 | tail -50 || true
    exit 1
fi

log_success "Container started and verified running"
echo ""

# -----------------------------------------------------------------------------
# Step 5: Wait for container to be ready
# -----------------------------------------------------------------------------
log_info "Waiting for container to be ready..."

WAIT_SECONDS=10
for i in $(seq 1 $WAIT_SECONDS); do
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        # Container is running, check if it's healthy
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "none")
        if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "none" ]; then
            break
        fi
    fi
    sleep 1
done

# Verify container is still running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    DEPLOYMENT_FAILED=1
    log_error "Container failed to stay running!"
    exit 1
fi

log_success "Container is ready"
echo ""

# -----------------------------------------------------------------------------
# Postdeploy Assertions
# -----------------------------------------------------------------------------
log_info "Running postdeploy assertions..."

# Assert 1: Verify container is on correct Docker network
CONTAINER_NETWORK=$(docker inspect "${CONTAINER_NAME}" --format='{{.HostConfig.NetworkMode}}' 2>/dev/null || echo "")
if [ "$CONTAINER_NETWORK" != "${DOCKER_NETWORK}" ]; then
    DEPLOYMENT_FAILED=1
    log_error "Postdeploy assertion failed: Container network mismatch!"
    log_error "  Expected: ${DOCKER_NETWORK}"
    log_error "  Actual:   ${CONTAINER_NETWORK}"
    exit 1
fi
log_success "✓ Container on correct network: ${DOCKER_NETWORK}"

# Assert 2: Verify AUTH_DATABASE_URL in container matches expected configuration
CONTAINER_DB_URL=$(docker inspect "${CONTAINER_NAME}" --format='{{range .Config.Env}}{{println .}}{{end}}' | grep '^AUTH_DATABASE_URL=' | cut -d= -f2-)

# Parse container's AUTH_DATABASE_URL
CONTAINER_DB_PARSE=$(python3 -c "
from urllib.parse import urlparse
import sys

try:
    url = '${CONTAINER_DB_URL}'
    parsed = urlparse(url)
    
    host = parsed.hostname or 'localhost'
    port = parsed.port or 5432
    user = parsed.username or 'postgres'
    dbname = parsed.path.lstrip('/') or 'postgres'
    
    print(f'{host}|{port}|{user}|{dbname}')
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
" 2>&1)

if [ $? -ne 0 ]; then
    DEPLOYMENT_FAILED=1
    log_error "Failed to parse container's AUTH_DATABASE_URL"
    exit 1
fi

IFS='|' read -r CONT_DB_HOST CONT_DB_PORT CONT_DB_USER CONT_DB_NAME <<< "$CONTAINER_DB_PARSE"

# Compare database config (without password)
if [ "$CONT_DB_HOST" != "$DB_HOST" ] || \
   [ "$CONT_DB_PORT" != "$DB_PORT" ] || \
   [ "$CONT_DB_USER" != "$DB_USER" ] || \
   [ "$CONT_DB_NAME" != "$DB_NAME" ]; then
    DEPLOYMENT_FAILED=1
    log_error "Postdeploy assertion failed: Database config mismatch!"
    log_error "  Expected: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    log_error "  Container: ${CONT_DB_USER}@${CONT_DB_HOST}:${CONT_DB_PORT}/${CONT_DB_NAME}"
    exit 1
fi
log_success "✓ Container database config matches: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

log_success "All postdeploy assertions passed"
echo ""

# -----------------------------------------------------------------------------
# Step 6: Run database setup
# -----------------------------------------------------------------------------
log_info "Running database setup (idempotent)..."

if docker exec "${CONTAINER_NAME}" python scripts/setup_prod_db.py; then
    log_success "Database setup completed"
else
    log_warn "Database setup returned non-zero (check logs above)"
    log_warn "Continuing with deployment..."
fi
echo ""

# -----------------------------------------------------------------------------
# Step 7: Run smoke checks
# -----------------------------------------------------------------------------
log_info "Running smoke checks..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/smoke_check.sh" ]; then
    if bash "${SCRIPT_DIR}/smoke_check.sh"; then
        log_success "Smoke checks passed"
    else
        DEPLOYMENT_FAILED=1
        log_error "Smoke checks failed!"
        exit 1
    fi
else
    # Inline basic health check
    sleep 2
    if curl -sf "http://localhost:${HOST_PORT}/health" > /dev/null; then
        log_success "Basic health check passed"
    else
        DEPLOYMENT_FAILED=1
        log_error "Health check failed!"
        exit 1
    fi
fi
echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "=============================================="
echo -e "${GREEN}Deployment Successful${NC}"
echo "=============================================="
echo "Container: ${CONTAINER_NAME}"
echo "Image:     ${IMAGE_TAG_SHA}"
echo "Port:      ${HOST_PORT} -> ${CONTAINER_PORT}"
echo "Commit:    ${GIT_SHA}"
echo "Finished:  $(date)"
echo ""

# Show container status
docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
