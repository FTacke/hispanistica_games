#!/bin/bash
# =============================================================================
# CO.RA.PAN Production Deployment Script
# =============================================================================
#
# This script is executed by the GitHub self-hosted runner on the server
# after a push to the main branch. It performs the following steps:
#   1. Fetches latest code from origin/main
#   2. Builds the Docker image
#   3. Stops and removes the old container
#   4. Starts a new container with the configured volumes
#   5. Optionally runs the database setup script
#
# Prerequisites:
#   - Docker installed and running
#   - Git repository cloned to /srv/webapps/corapan/app
#   - Data/media directories populated via rsync
#   - passwords.env configured in /srv/webapps/corapan/config/
#
# Usage:
#   cd /srv/webapps/corapan/app
#   bash scripts/deploy_prod.sh
#
# =============================================================================

set -e  # Exit on any error

# Configuration
CONTAINER_NAME="corapan-webapp"
IMAGE_NAME="corapan-webapp:latest"
HOST_PORT=6000
CONTAINER_PORT=5000

# Paths (on the host)
BASE_DIR="/srv/webapps/corapan"
DATA_DIR="${BASE_DIR}/data"
MEDIA_DIR="${BASE_DIR}/media"
CONFIG_DIR="${BASE_DIR}/config"
LOGS_DIR="${BASE_DIR}/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=============================================="
echo "CO.RA.PAN Production Deployment"
echo "=============================================="
echo "Started at: $(date)"
echo ""

# Step 1: Update code from Git
log_info "Fetching latest code from origin/main..."
git fetch origin
git reset --hard origin/main
log_info "Code updated to: $(git rev-parse --short HEAD)"
echo ""

# Step 2: Build Docker image
# Note: BuildKit disabled - server lacks buildx component
log_info "Building Docker image: ${IMAGE_NAME}..."
DOCKER_BUILDKIT=0 docker build -t "${IMAGE_NAME}" .
log_info "Docker image built successfully"
echo ""

# Step 3: Stop and remove old container (if exists)
log_info "Stopping old container (if running)..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true
log_info "Old container removed"
echo ""

# Step 4: Ensure corapan-network exists
log_info "Ensuring Docker network corapan-network exists..."
docker network inspect corapan-network >/dev/null 2>&1 || {
    log_info "Creating Docker network: corapan-network (172.18.0.0/16)"
    docker network create --subnet=172.18.0.0/16 corapan-network
}

# Step 5: Start new container
log_info "Starting new container: ${CONTAINER_NAME}..."
docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --network corapan-network \
    -p "${HOST_PORT}:${CONTAINER_PORT}" \
    -v "${DATA_DIR}:/app/data" \
    -v "${MEDIA_DIR}:/app/media" \
    -v "${LOGS_DIR}:/app/logs" \
    --env-file "${CONFIG_DIR}/passwords.env" \
    -e "FLASK_ENV=production" \
    "${IMAGE_NAME}"

log_info "Container started successfully"
echo ""

# Step 6: Wait for container to be healthy
log_info "Waiting for container to be ready..."
sleep 5

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_info "Container is running"
else
    log_error "Container failed to start!"
    docker logs "${CONTAINER_NAME}" 2>&1 | tail -20
    exit 1
fi
echo ""

# Step 7: Run database setup (optional - uncomment if needed)
# This creates tables and ensures admin user exists
log_info "Running database setup..."
docker exec "${CONTAINER_NAME}" python scripts/setup_prod_db.py || {
    log_warn "Database setup failed or skipped. Check logs for details."
}
echo ""

# Summary
echo "=============================================="
log_info "Deployment completed successfully!"
echo "=============================================="
echo "Container: ${CONTAINER_NAME}"
echo "Image: ${IMAGE_NAME}"
echo "Port: ${HOST_PORT} -> ${CONTAINER_PORT}"
echo "Commit: $(git rev-parse --short HEAD)"
echo "Finished at: $(date)"
echo ""

# Show container status
docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
