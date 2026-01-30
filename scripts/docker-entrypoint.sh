#!/bin/bash
# Docker entrypoint script for games.hispanistica webapp
# Handles database initialization and admin user creation before starting the app

set -e

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

for dir in "quiz" "releases"; do
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

# Default database host (robust against Docker network gateway changes)
# host.docker.internal is mapped via --add-host=host.docker.internal:host-gateway in docker run
DEFAULT_DB_HOST="host.docker.internal"

# Wait for database to be ready (if AUTH_DATABASE_URL or DATABASE_URL points to PostgreSQL)
DB_URL="${AUTH_DATABASE_URL:-${DATABASE_URL:-}}"

if [[ "$DB_URL" == *"postgresql"* ]]; then
    echo "PostgreSQL database detected. Waiting for readiness..."
    
    # Parse database URL using Python (robust, handles all edge cases)
    # Extract host, port, database name for diagnostics
    # Use host.docker.internal as default if parsing fails
    read -r DB_HOST DB_PORT DB_NAME DB_USER <<< $(python3 - <<'PY'
import sys
from urllib.parse import urlparse
import os

db_url = os.environ.get('AUTH_DATABASE_URL') or os.environ.get('DATABASE_URL', '')
default_host = os.environ.get('DEFAULT_DB_HOST', 'host.docker.internal')

if not db_url:
    print(f"{default_host} 5432 unknown unknown", file=sys.stderr)
    sys.exit(1)

try:
    parsed = urlparse(db_url)
    host = parsed.hostname or default_host
    port = parsed.port or 5432
    dbname = parsed.path.lstrip('/') if parsed.path else 'unknown'
    user = parsed.username or 'unknown'
    print(f"{host} {port} {dbname} {user}")
except Exception as e:
    print(f"{default_host} 5432 unknown unknown", file=sys.stderr)
    sys.exit(1)
PY
)
    
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to parse database URL"
        exit 1
    fi
    
    echo "  Database connection info:"
    echo "    Host: $DB_HOST"
    echo "    Port: $DB_PORT"
    echo "    Database: $DB_NAME"
    echo "    User: $DB_USER"
    echo ""
    
    # DNS resolution check
    echo "  Checking DNS resolution for $DB_HOST..."
    if getent hosts "$DB_HOST" >/dev/null 2>&1; then
        DB_IP=$(getent hosts "$DB_HOST" | awk '{ print $1 }' | head -n1)
        echo "    ✓ Resolved to: $DB_IP"
    else
        echo "    ✗ WARNING: Cannot resolve hostname '$DB_HOST'"
        echo "    This may indicate a Docker network configuration issue."
    fi
    echo ""
    
    # Wait for PostgreSQL to be ready
    echo "  Waiting for PostgreSQL (max ${DB_WAIT_SECONDS}s)..."
    TRIES=0
    while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q 2>/dev/null; do
        TRIES=$((TRIES + 1))
        if [ $TRIES -ge $DB_WAIT_SECONDS ]; then
            echo ""
            echo "============================================"
            echo "ERROR: Database not ready after ${DB_WAIT_SECONDS} seconds"
            echo "============================================"
            echo ""
            echo "Diagnostics:"
            echo "  Host: $DB_HOST"
            echo "  Port: $DB_PORT"
            echo "  User: $DB_USER"
            echo "  Database: $DB_NAME"
            echo ""
            echo "IMPORTANT: Verify AUTH_DATABASE_URL uses 'host.docker.internal' as hostname"
            echo "  Example: postgresql://user:pass@host.docker.internal:5432/dbname"
            echo "  NOT: postgresql://user:pass@172.18.0.1:5432/dbname (fragile!)"
            echo ""
            echo "DNS check:"
            getent hosts "$DB_HOST" || echo "  ✗ Cannot resolve hostname"
            echo ""
            echo "Connection attempt (verbose):"
            pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" 2>&1 || true
            echo ""
            echo "Troubleshooting:"
            echo "  1. Verify host PostgreSQL is running:"
            echo "       systemctl status postgresql"
            echo "  2. Verify container has host.docker.internal mapping:"
            echo "       docker run must include: --add-host=host.docker.internal:host-gateway"
            echo "  3. Test from host: pg_isready -h 172.18.0.1 -p 5432"
            echo "  4. Check PostgreSQL listens on Docker network (pg_hba.conf, listen_addresses)"
            echo ""
            exit 1
        fi
        
        # Progress indicator every 5 seconds
        if [ $((TRIES % 5)) -eq 0 ]; then
            echo "    Still waiting... ($TRIES/${DB_WAIT_SECONDS}s)"
        fi
        sleep 1
    done
    
    echo "  ✓ Database is ready (${TRIES}s)"
    echo ""
fi

# Initialize database tables (idempotent - safe to run multiple times)
echo "Initializing database tables..."
python -c "
from src.app.extensions.sqlalchemy_ext import init_engine, get_engine
from src.app.auth.models import Base

class FakeApp:
    def __init__(self):
        import os
        self.config = {
            'AUTH_DATABASE_URL': os.environ.get('AUTH_DATABASE_URL', os.environ.get('DATABASE_URL', 'sqlite:///data/db/auth.db'))
        }

app = FakeApp()
init_engine(app)
engine = get_engine()
Base.metadata.create_all(bind=engine)
print('Database tables initialized.')
"

# Create initial admin user ONLY on first deployment (ADMIN_BOOTSTRAP=1)
# This flag must be explicitly set and should ONLY be used during initial deployment
# or when recovering from a complete database reset.
# For production deployments, ADMIN_BOOTSTRAP should NOT be set, preventing accidental
# password overwrites.
#
# To set admin password on initial deployment:
#   ADMIN_BOOTSTRAP=1 START_ADMIN_PASSWORD=secret docker-compose up
#
# To reset admin password in production, use the dedicated CLI command:
#   python scripts/admin_reset_password.py --username admin --password newpass
if [ "${ADMIN_BOOTSTRAP:-0}" = "1" ]; then
    if [ -z "$START_ADMIN_PASSWORD" ]; then
        echo "ERROR: ADMIN_BOOTSTRAP=1 but START_ADMIN_PASSWORD not set"
        exit 1
    fi
    echo "Bootstrapping initial admin user (ADMIN_BOOTSTRAP=1)..."
    python scripts/create_initial_admin.py \
        --username "${START_ADMIN_USERNAME:-admin}" \
        --password "$START_ADMIN_PASSWORD" \
        --allow-production || {
            echo "ERROR: Admin user bootstrap failed"
            exit 1
        }
else
    echo "Skipping admin user bootstrap (ADMIN_BOOTSTRAP not set)"
    echo "  To enable on initial deployment, set: ADMIN_BOOTSTRAP=1"
    echo "  For password reset, use: scripts/admin_reset_password.py"
fi

echo "=== Starting application ==="

# Execute the main command (typically gunicorn)
exec "$@"
