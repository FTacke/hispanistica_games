#!/bin/bash
# Server-Fix-Agent: corapan-network DB connectivity repair
# Run this on your Linux server as root or with sudo

set -e

echo "=== 1. Ermittele corapan-network gateway ==="
GW=$(docker network inspect corapan-network --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}')
echo "Gateway: $GW"

if [ -z "$GW" ]; then
    echo "ERROR: Could not determine corapan-network gateway"
    exit 1
fi

echo ""
echo "=== 2. Prüfe Postgres listen_addresses ==="
sudo -u postgres psql -c "SHOW listen_addresses;"
echo ""
echo "Ports listening on 5432:"
ss -tlnp | grep 5432 || echo "No listeners found on 5432"

echo ""
echo "=== 3. Konfiguriere Postgres für corapan-network ==="
echo "Checking postgresql.conf..."
PGCONF="/etc/postgresql/14/main/postgresql.conf"
PGHBA="/etc/postgresql/14/main/pg_hba.conf"

# Backup configs
sudo cp "$PGCONF" "${PGCONF}.backup.$(date +%Y%m%d_%H%M%S)"
sudo cp "$PGHBA" "${PGHBA}.backup.$(date +%Y%m%d_%H%M%S)"
echo "Backups created"

# Check/update listen_addresses
if grep -q "^listen_addresses.*$GW" "$PGCONF"; then
    echo "listen_addresses already includes $GW"
else
    echo "Updating listen_addresses to include $GW..."
    sudo sed -i.bak "s/^listen_addresses.*/listen_addresses = 'localhost,$GW'/" "$PGCONF"
fi

# Check/update pg_hba.conf
if grep -q "172.18.0.0/16" "$PGHBA"; then
    echo "pg_hba.conf already has 172.18.0.0/16 entry"
else
    echo "Adding corapan-network to pg_hba.conf..."
    echo "host    games_hispanistica    games_app    172.18.0.0/16    md5" | sudo tee -a "$PGHBA"
fi

echo "Restarting PostgreSQL..."
sudo systemctl restart postgresql@14-main
sleep 3
sudo systemctl status postgresql@14-main --no-pager

echo ""
echo "=== 4. Update AUTH_DATABASE_URL in passwords.env ==="
PASSWORDS_ENV="/srv/webapps/games_hispanistica/config/passwords.env"

if [ ! -f "$PASSWORDS_ENV" ]; then
    echo "ERROR: $PASSWORDS_ENV not found"
    exit 1
fi

# Backup passwords.env
sudo cp "$PASSWORDS_ENV" "${PASSWORDS_ENV}.backup.$(date +%Y%m%d_%H%M%S)"
echo "Backup created: ${PASSWORDS_ENV}.backup.*"

# Extract current password from existing DATABASE_URL or AUTH_DATABASE_URL
CURRENT_PASS=$(grep -oP 'games_app:\K[^@]+' "$PASSWORDS_ENV" | head -1)

if [ -z "$CURRENT_PASS" ]; then
    echo "ERROR: Could not extract database password from $PASSWORDS_ENV"
    echo "Please manually set AUTH_DATABASE_URL=postgresql://games_app:<password>@$GW:5432/games_hispanistica"
    exit 1
fi

# Update AUTH_DATABASE_URL
NEW_URL="postgresql://games_app:${CURRENT_PASS}@${GW}:5432/games_hispanistica"
if grep -q "^AUTH_DATABASE_URL=" "$PASSWORDS_ENV"; then
    sudo sed -i "s|^AUTH_DATABASE_URL=.*|AUTH_DATABASE_URL=$NEW_URL|" "$PASSWORDS_ENV"
else
    echo "AUTH_DATABASE_URL=$NEW_URL" | sudo tee -a "$PASSWORDS_ENV"
fi

echo "AUTH_DATABASE_URL updated (password redacted in output)"
echo "AUTH_DATABASE_URL=postgresql://games_app:***@$GW:5432/games_hispanistica"

echo ""
echo "=== 5. Verifiziere Verbindung aus corapan-network ==="
if docker run --rm --network corapan-network postgres:16-alpine pg_isready -h "$GW" -p 5432 -U games_app -d games_hispanistica -q; then
    echo "✓ OK - Database is reachable from corapan-network"
else
    echo "✗ FAILED - Database not reachable from corapan-network"
    echo "Debug: Try manually: docker run --rm --network corapan-network postgres:16-alpine psql -h $GW -U games_app -d games_hispanistica"
    exit 1
fi

echo ""
echo "=== 6. Deploy erneut ausführen ==="
cd /srv/webapps/games_hispanistica/app

if [ -f "scripts/deploy/deploy_prod.sh" ]; then
    echo "Running deploy_prod.sh..."
    bash scripts/deploy/deploy_prod.sh
else
    echo "ERROR: scripts/deploy/deploy_prod.sh not found"
    exit 1
fi

echo ""
echo "=== SUMMARY ==="
echo "Gateway: $GW"
echo "Postgres listen_addresses: updated to include $GW"
echo "pg_isready: OK"
echo "Deploy: completed"
