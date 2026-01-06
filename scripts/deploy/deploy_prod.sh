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
#   - Docker network 'games-network' exists (run server_bootstrap.sh first)
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
DOCKER_NETWORK="corapan-network"

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

# Verify Docker network exists
if ! docker network inspect "${DOCKER_NETWORK}" &> /dev/null; then
    log_error "Docker network '${DOCKER_NETWORK}' does not exist"
    log_error "Run server_bootstrap.sh first"
    exit 1
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

log_success "Container started"
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

# Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    DEPLOYMENT_FAILED=1
    log_error "Container failed to start!"
    exit 1
fi

log_success "Container is running"
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
