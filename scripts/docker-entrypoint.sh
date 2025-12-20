#!/bin/bash
# Docker entrypoint script for CO.RA.PAN webapp
# Handles database initialization and admin user creation before starting the app

set -e

echo "=== CO.RA.PAN Container Startup ==="

# Wait for database to be ready (if AUTH_DATABASE_URL is set and points to PostgreSQL)
if [[ "$AUTH_DATABASE_URL" == *"postgresql"* ]] || [[ "$DATABASE_URL" == *"postgresql"* ]]; then
    echo "Waiting for PostgreSQL database to be ready..."
    
    # Extract host and port from DATABASE_URL
    # Format: postgresql+psycopg2://user:pass@host:port/dbname
    DB_HOST=$(echo "$AUTH_DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$AUTH_DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    DB_HOST=${DB_HOST:-db}
    DB_PORT=${DB_PORT:-5432}
    
    # Wait up to 30 seconds for database
    MAX_TRIES=30
    TRIES=0
    while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; do
        TRIES=$((TRIES + 1))
        if [ $TRIES -ge $MAX_TRIES ]; then
            echo "ERROR: Database not ready after ${MAX_TRIES} seconds"
            exit 1
        fi
        echo "  Waiting for database... ($TRIES/$MAX_TRIES)"
        sleep 1
    done
    echo "Database is ready."
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
