#!/bin/bash
# Docker entrypoint script for games.hispanistica webapp
# Handles database initialization and admin user creation before starting the app

set -e

echo "=== games.hispanistica Container Startup ==="

# Configuration: Database wait timeout (seconds)
DB_WAIT_SECONDS=${DB_WAIT_SECONDS:-60}

# Wait for database to be ready (if AUTH_DATABASE_URL or DATABASE_URL points to PostgreSQL)
DB_URL="${AUTH_DATABASE_URL:-${DATABASE_URL:-}}"

if [[ "$DB_URL" == *"postgresql"* ]]; then
    echo "PostgreSQL database detected. Waiting for readiness..."
    
    # Parse database URL using Python (robust, handles all edge cases)
    # Extract host, port, database name for diagnostics
    read -r DB_HOST DB_PORT DB_NAME DB_USER <<< $(python3 - <<'PY'
import sys
from urllib.parse import urlparse
import os

db_url = os.environ.get('AUTH_DATABASE_URL') or os.environ.get('DATABASE_URL', '')
if not db_url:
    print("db 5432 unknown unknown", file=sys.stderr)
    sys.exit(1)

try:
    parsed = urlparse(db_url)
    host = parsed.hostname or 'db'
    port = parsed.port or 5432
    dbname = parsed.path.lstrip('/') if parsed.path else 'unknown'
    user = parsed.username or 'unknown'
    print(f"{host} {port} {dbname} {user}")
except Exception as e:
    print(f"db 5432 unknown unknown", file=sys.stderr)
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
            echo ""
            echo "DNS check:"
            getent hosts "$DB_HOST" || echo "  ✗ Cannot resolve hostname"
            echo ""
            echo "Connection attempt (verbose):"
            pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" 2>&1 || true
            echo ""
            echo "Troubleshooting:"
            echo "  1. Verify database container is running: docker ps"
            echo "  2. Check Docker network: docker network inspect <network>"
            echo "  3. Verify AUTH_DATABASE_URL environment variable"
            echo "  4. Check database logs: docker logs <db-container>"
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

# Create initial admin user if START_ADMIN_PASSWORD is set
if [ -n "$START_ADMIN_PASSWORD" ]; then
    echo "Creating/updating initial admin user..."
    python scripts/create_initial_admin.py \
        --username "${START_ADMIN_USERNAME:-admin}" \
        --password "$START_ADMIN_PASSWORD" \
        --allow-production || {
            echo "WARNING: Admin user creation failed (may already exist with different settings)"
        }
else
    echo "Skipping admin user creation (START_ADMIN_PASSWORD not set)"
fi

echo "=== Starting application ==="

# Execute the main command (typically gunicorn)
exec "$@"
