#!/bin/bash
# =============================================================================
# games_hispanistica Production Deployment Script
# =============================================================================

set -euo pipefail

CONTAINER_NAME="games-web-prod"
COMPOSE_FILE="infra/docker-compose.prod.yml"
BASE_DIR="/srv/webapps/games_hispanistica"
CONFIG_DIR="${BASE_DIR}/config"
ENV_FILE="${CONFIG_DIR}/passwords.env"
DEFAULT_DB_HOST="games-db-prod"
DEFAULT_BACKEND_NETWORK="games-backend-prod"
EXPECTED_DB_HOST="${GAMES_DB_HOST:-${DEFAULT_DB_HOST}}"
BACKEND_NETWORK="${GAMES_BACKEND_NETWORK:-${DEFAULT_BACKEND_NETWORK}}"
HOST_HEALTH_URL="http://127.0.0.1:7000/health"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_container_logs() {
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Recent logs for ${CONTAINER_NAME}:"
        docker logs "${CONTAINER_NAME}" 2>&1 | tail -50 || true
    fi
}

trap show_container_logs ERR

read_env_var() {
    local key="$1"
    local value
    value=$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d= -f2- || true)
    value="${value#\"}"
    value="${value%\"}"
    value="${value#\'}"
    value="${value%\'}"
    printf '%s' "${value}"
}

read_env_or_default() {
    local key="$1"
    local default_value="$2"
    local file_value
    file_value=$(read_env_var "$key")
    if [ -n "$file_value" ]; then
        printf '%s' "$file_value"
    else
        printf '%s' "$default_value"
    fi
}

assert_isolation_rules() {
    case "${BACKEND_NETWORK}" in
        corapan-network|corapan-network-prod|corapan-*)
            log_error "Refusing to use foreign network '${BACKEND_NETWORK}'"
            log_error "games deployment must stay isolated from corapan resources"
            exit 1
            ;;
    esac

    case "${EXPECTED_DB_HOST}" in
        corapan-db-prod|corapan-db|db)
            log_error "Refusing to use foreign database host '${EXPECTED_DB_HOST}'"
            log_error "games deployment must not target corapan database services"
            exit 1
            ;;
    esac
}

parse_db_url() {
    local db_url="$1"
    python3 - "$db_url" <<'PY'
from urllib.parse import urlparse
import sys

url = sys.argv[1]
parsed = urlparse(url)
host = parsed.hostname or ""
port = parsed.port or 5432
user = parsed.username or ""
database = parsed.path.lstrip("/") if parsed.path else ""

if not host or not user or not database:
    raise SystemExit("invalid database URL")

print(f"{host}|{port}|{user}|{database}")
PY
}

assert_db_target() {
    local label="$1"
    local host="$2"
    local port="$3"
    local database="$4"

    if [ "${host}" != "${EXPECTED_DB_HOST}" ]; then
        log_error "${label} must target ${EXPECTED_DB_HOST}, got ${host}"
        exit 1
    fi

    if [ "${port}" != "5432" ]; then
        log_error "${label} must target port 5432, got ${port}"
        exit 1
    fi

    if [ -z "${database}" ]; then
        log_error "${label} must include a database name"
        exit 1
    fi
}

check_db_connectivity() {
    local label="$1"
    local host="$2"
    local user="$3"
    local database="$4"

    log_info "Checking ${label} reachability via ${BACKEND_NETWORK}: ${user}@${host}:5432/${database}"
    local output
    if output=$(docker run --rm --network "${BACKEND_NETWORK}" postgres:16-alpine \
        pg_isready -h "${host}" -p 5432 -U "${user}" -d "${database}" 2>&1); then
        log_success "${label} is reachable"
    else
        log_error "${label} is not reachable via backend network '${BACKEND_NETWORK}'"
        if [ -n "${output}" ]; then
            log_error "pg_isready output: ${output}"
        fi
        log_error "The backend network belongs to games and may be created by this script, but the database service remains an external prerequisite."
        log_error "Provision the dedicated DB service '${EXPECTED_DB_HOST}' and attach it to '${BACKEND_NETWORK}' before deploying."
        exit 1
    fi
}

ensure_backend_network() {
    if docker network inspect "${BACKEND_NETWORK}" > /dev/null 2>&1; then
        log_success "Backend network available: ${BACKEND_NETWORK}"
        return 0
    fi

    log_warn "Backend network '${BACKEND_NETWORK}' does not exist"
    log_info "Creating backend network '${BACKEND_NETWORK}' for the games stack..."
    docker network create "${BACKEND_NETWORK}" > /dev/null

    if docker network inspect "${BACKEND_NETWORK}" > /dev/null 2>&1; then
        log_success "Backend network created: ${BACKEND_NETWORK}"
        return 0
    fi

    log_error "Failed to create backend network '${BACKEND_NETWORK}'"
    exit 1
}

wait_for_container_health() {
    local timeout_seconds="$1"
    local attempt=0

    while [ "${attempt}" -lt "${timeout_seconds}" ]; do
        local status
        status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${CONTAINER_NAME}" 2>/dev/null || echo "missing")

        if [ "${status}" = "healthy" ] || [ "${status}" = "none" ]; then
            log_success "Container health status: ${status}"
            return 0
        fi

        if [ "${status}" = "unhealthy" ] || [ "${status}" = "missing" ]; then
            log_error "Container health status: ${status}"
            return 1
        fi

        attempt=$((attempt + 2))
        sleep 2
    done

    log_error "Timed out waiting for container health"
    return 1
}

wait_for_host_health() {
    local timeout_seconds="$1"
    local attempt=0

    while [ "${attempt}" -lt "${timeout_seconds}" ]; do
        if curl -sf "${HOST_HEALTH_URL}" > /dev/null; then
            log_success "Host health check passed: ${HOST_HEALTH_URL}"
            return 0
        fi
        attempt=$((attempt + 2))
        sleep 2
    done

    log_error "Host health check failed: ${HOST_HEALTH_URL}"
    return 1
}

echo "=============================================="
echo "games_hispanistica Production Deployment"
echo "=============================================="
echo "Started at: $(date)"
echo ""

log_info "Running pre-flight checks..."

if [ ! -f "pyproject.toml" ]; then
    log_error "Run this script from the repository root"
    exit 1
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
    log_error "Missing compose file: ${COMPOSE_FILE}"
    exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
    log_error "Missing environment file: ${ENV_FILE}"
    log_error "Provision the production environment file before deploying."
    exit 1
fi

BACKEND_NETWORK=$(read_env_or_default "GAMES_BACKEND_NETWORK" "${BACKEND_NETWORK}")
EXPECTED_DB_HOST=$(read_env_or_default "GAMES_DB_HOST" "${EXPECTED_DB_HOST}")

assert_isolation_rules

if ! command -v docker > /dev/null 2>&1; then
    log_error "Docker is not installed or not in PATH"
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    log_error "Docker daemon is not accessible"
    exit 1
fi

if ! docker compose version > /dev/null 2>&1; then
    log_error "docker compose is required for production deployments"
    exit 1
fi

ensure_backend_network

AUTH_DATABASE_URL=$(read_env_var "AUTH_DATABASE_URL")
QUIZ_DATABASE_URL=$(read_env_var "QUIZ_DATABASE_URL")

if [ -z "${AUTH_DATABASE_URL}" ]; then
    log_error "AUTH_DATABASE_URL is missing in ${ENV_FILE}"
    exit 1
fi

if [ -z "${QUIZ_DATABASE_URL}" ]; then
    log_error "QUIZ_DATABASE_URL is missing in ${ENV_FILE}"
    exit 1
fi

IFS='|' read -r AUTH_DB_HOST AUTH_DB_PORT AUTH_DB_USER AUTH_DB_NAME <<< "$(parse_db_url "${AUTH_DATABASE_URL}")"
IFS='|' read -r QUIZ_DB_HOST QUIZ_DB_PORT QUIZ_DB_USER QUIZ_DB_NAME <<< "$(parse_db_url "${QUIZ_DATABASE_URL}")"

assert_db_target "AUTH_DATABASE_URL" "${AUTH_DB_HOST}" "${AUTH_DB_PORT}" "${AUTH_DB_NAME}"
assert_db_target "QUIZ_DATABASE_URL" "${QUIZ_DB_HOST}" "${QUIZ_DB_PORT}" "${QUIZ_DB_NAME}"

if [ "${AUTH_DB_NAME}" = "${QUIZ_DB_NAME}" ]; then
    log_error "AUTH_DATABASE_URL and QUIZ_DATABASE_URL must point to different databases"
    exit 1
fi

log_success "Auth DB target: ${AUTH_DB_USER}@${AUTH_DB_HOST}:${AUTH_DB_PORT}/${AUTH_DB_NAME}"
log_success "Quiz DB target: ${QUIZ_DB_USER}@${QUIZ_DB_HOST}:${QUIZ_DB_PORT}/${QUIZ_DB_NAME}"

log_info "Validating compose configuration..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" config > /dev/null
log_success "Compose configuration is valid"

check_db_connectivity "Auth DB" "${AUTH_DB_HOST}" "${AUTH_DB_USER}" "${AUTH_DB_NAME}"
check_db_connectivity "Quiz DB" "${QUIZ_DB_HOST}" "${QUIZ_DB_USER}" "${QUIZ_DB_NAME}"

log_info "Deploying web service via docker compose..."
export GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build --force-recreate

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_error "Container '${CONTAINER_NAME}' is not running after compose up"
    exit 1
fi
log_success "Container is running: ${CONTAINER_NAME}"

log_info "Running auth database setup..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T web python scripts/setup_prod_db.py
log_success "Auth database setup completed"

log_info "Running quiz database setup..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T web python scripts/init_quiz_db.py
log_success "Quiz database setup completed"

wait_for_container_health 90
wait_for_host_health 60

echo ""
echo "=============================================="
echo -e "${GREEN}Deployment Successful${NC}"
echo "=============================================="
echo "Container: ${CONTAINER_NAME}"
echo "Compose:   ${COMPOSE_FILE}"
echo "Network:   ${BACKEND_NETWORK}"
echo "Health:    ${HOST_HEALTH_URL}"
echo "Finished:  $(date)"
echo ""

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
