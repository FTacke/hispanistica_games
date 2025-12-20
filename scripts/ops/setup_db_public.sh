#!/usr/bin/env bash
# =============================================================================
# CO.RA.PAN Production DB Public Setup Script
# =============================================================================
#
# Verifies and sets up the db_public directory containing SQLite statistics
# databases. These files are synchronized from the dev environment and used
# read-only by the webapp.
#
# The db_public directory contains:
#   - stats_all.db: Global corpus statistics (total word count, duration)
#
# Prerequisites:
#   - db_public/ directory synchronized from dev
#   - SQLite database files must be valid
#
# Usage:
#   sudo bash /srv/webapps/corapan/app/scripts/ops/setup_db_public.sh
#
# =============================================================================

set -euo pipefail

# Configuration
DATA_ROOT="/srv/webapps/corapan/data"
DB_PUBLIC_DIR="${DATA_ROOT}/db_public"
DB_PRIVATE_DIR="${DATA_ROOT}/db"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo "=============================================="
echo "CO.RA.PAN Production DB Public Setup"
echo "=============================================="
log "Verifying database directories..."

# Step 1: Check db_public directory
if [ ! -d "$DB_PUBLIC_DIR" ]; then
    warn "Creating db_public directory..."
    mkdir -p "$DB_PUBLIC_DIR"
fi

# Step 2: Check for required files
REQUIRED_DBS=("stats_all.db")
MISSING_DBS=()

for db in "${REQUIRED_DBS[@]}"; do
    if [ ! -f "${DB_PUBLIC_DIR}/${db}" ]; then
        MISSING_DBS+=("$db")
    fi
done

if [ ${#MISSING_DBS[@]} -gt 0 ]; then
    warn "Missing database files in db_public:"
    for db in "${MISSING_DBS[@]}"; do
        warn "  - $db"
    done
    warn "These files need to be synchronized from the dev environment"
    warn "Run: rsync -avz dev:/path/to/data/db_public/ $DB_PUBLIC_DIR/"
else
    log "All required database files present"
fi

# Step 3: Verify file integrity (basic check)
for db in "${REQUIRED_DBS[@]}"; do
    if [ -f "${DB_PUBLIC_DIR}/${db}" ]; then
        # Check if it's a valid SQLite file
        if file "${DB_PUBLIC_DIR}/${db}" | grep -q "SQLite"; then
            SIZE=$(du -h "${DB_PUBLIC_DIR}/${db}" | cut -f1)
            log "  ✓ ${db} ($SIZE) - valid SQLite database"
        else
            error "  ✗ ${db} - not a valid SQLite database"
        fi
    fi
done

# Step 4: Check db private directory (if needed)
if [ ! -d "$DB_PRIVATE_DIR" ]; then
    warn "Creating db (private) directory..."
    mkdir -p "$DB_PRIVATE_DIR"
fi

# Check for optional private databases
PRIVATE_DBS=("stats_files.db" "stats_country.db")
for db in "${PRIVATE_DBS[@]}"; do
    if [ -f "${DB_PRIVATE_DIR}/${db}" ]; then
        SIZE=$(du -h "${DB_PRIVATE_DIR}/${db}" | cut -f1)
        log "  ✓ private/${db} ($SIZE)"
    else
        warn "  - private/${db} not present (optional)"
    fi
done

# Step 5: Set permissions
log "Setting file permissions..."
chown -R root:root "$DB_PUBLIC_DIR" 2>/dev/null || warn "Could not change ownership (may need sudo)"
chmod -R 644 "$DB_PUBLIC_DIR"/*.db 2>/dev/null || true
chmod 755 "$DB_PUBLIC_DIR"

# Summary
echo ""
echo "=============================================="
log "DB Public setup complete!"
echo "=============================================="
echo "Public DB directory: $DB_PUBLIC_DIR"
echo "Private DB directory: $DB_PRIVATE_DIR"
echo ""
echo "Files in db_public:"
ls -lah "$DB_PUBLIC_DIR"/ 2>/dev/null || echo "(empty)"
echo ""

if [ ${#MISSING_DBS[@]} -gt 0 ]; then
    warn "Some files are missing - sync from dev environment required"
    exit 1
fi
