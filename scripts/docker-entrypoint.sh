#!/bin/bash
# Docker entrypoint script for games.hispanistica webapp
# Performs runtime checks before starting the app

set -euo pipefail

echo "=== games.hispanistica Container Startup ==="

# Media storage guard (fail-fast if /app/media is not writable)
MEDIA_ROOT=${MEDIA_ROOT:-/app/media}
MEDIA_UID=${MEDIA_UID:-}
MEDIA_GID=${MEDIA_GID:-}

echo "Media storage check: $MEDIA_ROOT"

if [ ! -d "$MEDIA_ROOT" ]; then
    echo "Creating media root: $MEDIA_ROOT"
    if ! mkdir -p "$MEDIA_ROOT"; then
        echo "ERROR: Failed to create media root: $MEDIA_ROOT"
        exit 1
    fi
fi

for dir in "quiz"; do
    target="$MEDIA_ROOT/$dir"
    if ! mkdir -p "$target"; then
        echo "ERROR: Failed to create media directory: $target"
        exit 1
    fi
done

if [ -n "$MEDIA_UID" ] || [ -n "$MEDIA_GID" ]; then
    if [ "$(id -u)" -eq 0 ]; then
        echo "Setting media ownership to ${MEDIA_UID:-0}:${MEDIA_GID:-0}"
        chown -R "${MEDIA_UID:-0}:${MEDIA_GID:-0}" "$MEDIA_ROOT"
    else
        echo "WARNING: MEDIA_UID/GID set but container is not running as root; skipping chown."
    fi
fi

TEST_FILE="$MEDIA_ROOT/.rw_test_$$"
if ! (echo "ok" > "$TEST_FILE" 2>/dev/null); then
    echo "ERROR: Media storage is not writable: $MEDIA_ROOT"
    echo "Fix: Ensure /app/media is a read-write mount and owned by UID/GID running the app."
    exit 1
fi
rm -f "$TEST_FILE"
echo "Media storage OK (rw + dirs created)"

# Configuration: Database wait timeout (seconds)
DB_WAIT_SECONDS=${DB_WAIT_SECONDS:-60}

wait_for_postgres_url() {
    local env_var_name="$1"
    local db_url="${!env_var_name:-}"

    if [ -z "$db_url" ]; then
        echo "ERROR: Required database setting is missing: ${env_var_name}"
        exit 1
    fi

    if [[ "$db_url" != postgres* ]]; then
        echo "Skipping readiness check for ${env_var_name} (non-PostgreSQL DSN)"
        return 0
    fi

    read -r DB_HOST DB_PORT DB_NAME DB_USER <<< "$(python3 - "$db_url" <<'PY'
from urllib.parse import urlparse
import sys

parsed = urlparse(sys.argv[1])
host = parsed.hostname or ""
port = parsed.port or 5432
database = parsed.path.lstrip("/") if parsed.path else ""
user = parsed.username or ""

if not host or not database or not user:
    raise SystemExit("invalid database URL")

print(f"{host} {port} {database} {user}")
PY
)"

    echo "Waiting for ${env_var_name}: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

    local tries=0
    while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q 2>/dev/null; do
        tries=$((tries + 1))
        if [ "$tries" -ge "$DB_WAIT_SECONDS" ]; then
            echo "ERROR: ${env_var_name} not ready after ${DB_WAIT_SECONDS} seconds"
            echo "Host: $DB_HOST"
            echo "Port: $DB_PORT"
            echo "Database: $DB_NAME"
            echo "User: $DB_USER"
            if command -v getent > /dev/null 2>&1; then
                echo "DNS:"
                getent hosts "$DB_HOST" || echo "  unresolved"
            fi
            pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" || true
            exit 1
        fi

        if [ $((tries % 5)) -eq 0 ]; then
            echo "  still waiting for ${env_var_name} (${tries}/${DB_WAIT_SECONDS}s)"
        fi
        sleep 1
    done

    echo "${env_var_name} is ready"
}

wait_for_postgres_url "AUTH_DATABASE_URL"
wait_for_postgres_url "QUIZ_DATABASE_URL"

echo "=== Starting application ==="

# Execute the main command (typically gunicorn)
exec "$@"
