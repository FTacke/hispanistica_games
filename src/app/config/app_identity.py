"""Application identity constants for games_hispanistica.

This module defines the canonical identifiers and deployment constants
for the games_hispanistica application. These values are used across:
- Scripts and documentation
- Docker container naming
- Logging and health endpoints
- Server path conventions

Note: Server paths like /srv/webapps/... are documentation defaults only.
The application itself does NOT hardcode absolute server paths; these are
resolved at runtime via environment variables or volumes.
"""

from __future__ import annotations

# =============================================================================
# Application Identity
# =============================================================================

# Canonical identifiers
APP_SLUG = "games_hispanistica"
APP_NAME = "games.hispanistica"
APP_DISPLAY_NAME = "games.hispanistica"

# Logging identifier (also used in health endpoint)
LOG_NAME = "games.hispanistica"

# Version (read from pyproject.toml at runtime if needed)
APP_VERSION = "0.1.0"

# =============================================================================
# Deployment Defaults (for scripts/documentation only)
# =============================================================================

# Default ports (production)
DEFAULT_HOST_PORT = 7000
DEFAULT_CONTAINER_PORT = 5000

# Docker container and image names
CONTAINER_NAME = "games-webapp"
IMAGE_NAME = "games-webapp"
IMAGE_TAG = "latest"

# Docker network
# Docker network name (configurable via env)
DOCKER_NETWORK_NAME = os.getenv("DOCKER_NETWORK", "games-network")
DOCKER_NETWORK_SUBNET = "172.19.0.0/16"

# =============================================================================
# Server Paths (documentation defaults - NOT used by app at runtime)
# =============================================================================

# These are the expected paths on the production server.
# The app itself uses relative paths and environment variables.

SERVER_BASE_DIR = "/srv/webapps/games_hispanistica"
SERVER_PATHS = {
    "app": f"{SERVER_BASE_DIR}/app",          # Git repository checkout
    "config": f"{SERVER_BASE_DIR}/config",    # Environment files, secrets
    "data": f"{SERVER_BASE_DIR}/data",        # Persistent data
    "logs": f"{SERVER_BASE_DIR}/logs",        # Application logs
    "media": f"{SERVER_BASE_DIR}/media",      # MP3 files, content releases
    "runner": f"{SERVER_BASE_DIR}/runner",    # GitHub runner (optional)
}

# =============================================================================
# Database Defaults
# =============================================================================

# PostgreSQL database name and user (production)
DB_NAME = "games_hispanistica"
DB_USER = "games_app"

# Database URL template (host IP is docker bridge gateway)
DB_URL_TEMPLATE = "postgresql://{user}:{password}@172.19.0.1:5432/{db}"

# =============================================================================
# Domain Configuration
# =============================================================================

# Production domain
PRODUCTION_DOMAIN = "games.hispanistica.com"

# Health check endpoints
HEALTH_ENDPOINTS = [
    "/health",
    "/health/db",
]
