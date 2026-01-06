#!/bin/bash
# =============================================================================
# games_hispanistica Production Server Bootstrap
# =============================================================================
#
# One-time server preparation script. Run this ONCE on a fresh server to:
#   1. Create directory structure
#   2. Set up Docker network
#   3. Create environment template
#   4. Verify prerequisites
#
# This script is IDEMPOTENT - safe to run multiple times.
#
# Prerequisites:
#   - Docker installed and running
#   - Root access (or docker group membership)
#   - Git installed
#
# Usage:
#   sudo bash scripts/deploy/server_bootstrap.sh
#
# =============================================================================

set -euo pipefail

# Configuration (from app_identity)
APP_SLUG="games_hispanistica"
CONTAINER_NAME="games-webapp"

# Docker network (configurable via env, default: games-network)
# To use existing network: export DOCKER_NETWORK=corapan-network before running
DOCKER_NETWORK="${DOCKER_NETWORK:-games-network}"
DOCKER_SUBNET="172.19.0.0/16"
HOST_PORT=7000
CONTAINER_PORT=5000

# Server paths
BASE_DIR="/srv/webapps/${APP_SLUG}"

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

echo "=============================================="
echo "games_hispanistica Server Bootstrap"
echo "=============================================="
echo "Started at: $(date)"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Verify prerequisites
# -----------------------------------------------------------------------------
log_info "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi
log_success "Docker installed: $(docker --version)"

# Check Docker daemon
if ! docker info &> /dev/null; then
    log_error "Docker daemon is not running or not accessible."
    log_error "Try: sudo systemctl start docker"
    exit 1
fi
log_success "Docker daemon is running"

# Check Git
if ! command -v git &> /dev/null; then
    log_error "Git is not installed. Please install Git first."
    exit 1
fi
log_success "Git installed: $(git --version)"

echo ""

# -----------------------------------------------------------------------------
# Step 2: Create directory structure
# -----------------------------------------------------------------------------
log_info "Creating directory structure..."

DIRS=(
    "${BASE_DIR}/app"
    "${BASE_DIR}/config"
    "${BASE_DIR}/data"
    "${BASE_DIR}/logs"
    "${BASE_DIR}/media/releases"
    "${BASE_DIR}/runner"
)

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        log_info "Directory exists: $dir"
    else
        mkdir -p "$dir"
        log_success "Created: $dir"
    fi
done

# Create media/current symlink placeholder
if [ ! -L "${BASE_DIR}/media/current" ] && [ ! -d "${BASE_DIR}/media/current" ]; then
    log_warn "media/current symlink not set (create after first content release)"
fi

echo ""

# -----------------------------------------------------------------------------
# Step 3: Set up Docker network
# -----------------------------------------------------------------------------
log_info "Checking Docker network: ${DOCKER_NETWORK}..."

if docker network inspect "${DOCKER_NETWORK}" &> /dev/null; then
    NETWORK_SUBNET=$(docker network inspect "${DOCKER_NETWORK}" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')
    log_success "Docker network '${DOCKER_NETWORK}' already exists (subnet: ${NETWORK_SUBNET})"
    log_info "Using existing network (no changes needed)"
else
    log_info "Creating Docker network '${DOCKER_NETWORK}' with subnet ${DOCKER_SUBNET}..."
    docker network create --subnet="${DOCKER_SUBNET}" "${DOCKER_NETWORK}"
    log_success "Created Docker network: ${DOCKER_NETWORK} (${DOCKER_SUBNET})"
fi

echo ""

# -----------------------------------------------------------------------------
# Step 4: Create environment template
# -----------------------------------------------------------------------------
log_info "Creating environment template..."

ENV_TEMPLATE="${BASE_DIR}/config/passwords.env.template"

if [ -f "$ENV_TEMPLATE" ]; then
    log_info "Environment template already exists: $ENV_TEMPLATE"
else
    cat > "$ENV_TEMPLATE" << 'EOF'
# =============================================================================
# games_hispanistica Production Environment
# =============================================================================
# IMPORTANT: Copy this file to passwords.env and fill in the values!
#            NEVER commit passwords.env to Git!
# =============================================================================

# Flask secret key (generate with: openssl rand -hex 32)
FLASK_SECRET_KEY=CHANGE_ME_GENERATE_RANDOM_HEX

# JWT secret key (generate with: openssl rand -hex 32)
JWT_SECRET_KEY=CHANGE_ME_GENERATE_RANDOM_HEX

# PostgreSQL connection (container reaches host via Docker bridge gateway)
AUTH_DATABASE_URL=postgresql://games_app:CHANGE_ME_DB_PASSWORD@172.19.0.1:5432/games_hispanistica

# Password hashing algorithm
AUTH_HASH_ALGO=argon2

# Secure cookies (true for HTTPS)
JWT_COOKIE_SECURE=true

# Environment
FLASK_ENV=production

# Initial admin user (used by setup_prod_db.py)
START_ADMIN_USERNAME=admin
START_ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD
START_ADMIN_EMAIL=admin@games.hispanistica.com
EOF
    log_success "Created environment template: $ENV_TEMPLATE"
    log_warn "IMPORTANT: Copy to passwords.env and fill in real values!"
fi

# Check if passwords.env exists
if [ -f "${BASE_DIR}/config/passwords.env" ]; then
    log_success "passwords.env exists (secrets configured)"
else
    log_warn "passwords.env not found - copy from template and configure!"
fi

echo ""

# -----------------------------------------------------------------------------
# Step 5: Display summary
# -----------------------------------------------------------------------------
echo "=============================================="
echo -e "${GREEN}Server Bootstrap Complete${NC}"
echo "=============================================="
echo ""
echo "Directory structure:"
echo "  ${BASE_DIR}/"
echo "  ├── app/        # Git repository (clone here)"
echo "  ├── config/     # Environment files"
echo "  ├── data/       # Persistent data"
echo "  ├── logs/       # Application logs"
echo "  ├── media/      # Content releases (MP3, etc.)"
echo "  └── runner/     # GitHub Actions runner"
echo ""
echo "Docker network: ${DOCKER_NETWORK} (${DOCKER_SUBNET})"
echo "Container name: ${CONTAINER_NAME}"
echo "Host port: ${HOST_PORT}"
echo ""
echo "Next steps:"
echo "  1. Clone repository to ${BASE_DIR}/app/"
echo "  2. Copy ${ENV_TEMPLATE}"
echo "     to ${BASE_DIR}/config/passwords.env"
echo "  3. Configure PostgreSQL database: games_hispanistica"
echo "  4. Create PostgreSQL user: games_app"
echo "  5. Set up Nginx reverse proxy"
echo "  6. Install GitHub Actions runner (optional)"
echo "  7. Run first deployment: bash scripts/deploy/deploy_prod.sh"
echo ""
echo "Finished at: $(date)"
