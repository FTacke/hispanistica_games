#!/bin/bash
# =============================================================================
# CO.RA.PAN Deployment Script für Production Server
# =============================================================================
# 
# Dieses Script aktualisiert die Webapp auf dem Server:
# 1. Erstellt Backup von DB und wichtigen Dateien
# 2. Pullt neueste Änderungen von Git
# 3. Baut Docker Image neu
# 4. Startet Container neu
#
# NUTZUNG:
#   ./update.sh              # Normales Update
#   ./update.sh --no-backup  # Update ohne Backup (schneller)
#   ./update.sh --force      # Force rebuild (cache ignored)
#
# =============================================================================

set -e  # Exit on error

# ANSI Color Codes für schöne Ausgaben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Konfiguration
# =============================================================================

BACKUP_DIR="./backups"
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DO_BACKUP=true
FORCE_REBUILD=false

# =============================================================================
# Argument Parsing
# =============================================================================

for arg in "$@"; do
  case $arg in
    --no-backup)
      DO_BACKUP=false
      shift
      ;;
    --force)
      FORCE_REBUILD=true
      shift
      ;;
    --help)
      echo "CO.RA.PAN Deployment Script"
      echo ""
      echo "Optionen:"
      echo "  --no-backup   Kein Backup vor Update"
      echo "  --force       Force rebuild (ignoriert Docker Cache)"
      echo "  --help        Diese Hilfe anzeigen"
      exit 0
      ;;
  esac
done

# =============================================================================
# Funktionen
# =============================================================================

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Pre-Flight Checks
# =============================================================================

log_info "🚀 Starting CO.RA.PAN Deployment..."

# Check if git is available
if ! command -v git &> /dev/null; then
  log_error "git ist nicht installiert!"
  exit 1
fi

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
  log_error "docker ist nicht installiert!"
  exit 1
fi

# Check if we're in a git repository
if [ ! -d .git ]; then
  log_error "Nicht in einem Git-Repository!"
  exit 1
fi

# =============================================================================
# 1. Backup (optional)
# =============================================================================

if [ "$DO_BACKUP" = true ]; then
  log_info "📦 Erstelle Backup..."
  
  mkdir -p "$BACKUP_DIR"
  
  BACKUP_FILE="$BACKUP_DIR/backup_$BACKUP_TIMESTAMP.tar.gz"
  
  # Backup: Nur Counters (diese werden von der App geschrieben)
  # DB und Media werden extern verwaltet, kein Backup nötig
  tar -czf "$BACKUP_FILE" \
    ~/corapan/data/counters/ \
    2>/dev/null || true
  
  if [ -f "$BACKUP_FILE" ]; then
    log_success "Backup erstellt: $BACKUP_FILE"
    
    # Behalte nur die letzten 10 Backups
    ls -t "$BACKUP_DIR"/backup_*.tar.gz | tail -n +11 | xargs -r rm
    log_info "Alte Backups bereinigt (behalte nur 10 neueste)"
  else
    log_warning "Backup konnte nicht erstellt werden"
  fi
else
  log_warning "⚠️  Backup übersprungen (--no-backup)"
fi

# =============================================================================
# 2. Git Pull
# =============================================================================

log_info "📥 Pulling latest changes from Git..."

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  log_warning "Es gibt uncommitted changes auf dem Server!"
  log_info "Stashing changes..."
  git stash
fi

# Pull latest changes
git pull origin main || git pull origin master || {
  log_error "Git pull fehlgeschlagen!"
  exit 1
}

log_success "Code aktualisiert"

# =============================================================================
# 3. Pre-Flight Database Check
# =============================================================================

log_info "🔍 Pre-flight database check..."

# Determine compose file (production or development)
COMPOSE_FILE="docker-compose.yml"
if [ -f "infra/docker-compose.prod.yml" ]; then
    COMPOSE_FILE="infra/docker-compose.prod.yml"
    log_info "Using production compose file"
fi

# Check if database container is running
DB_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q db 2>/dev/null || echo "")

if [ -n "$DB_CONTAINER" ]; then
    log_info "Database container found: $DB_CONTAINER"
    
    # Check database readiness
    if docker exec "$DB_CONTAINER" pg_isready -U corapan_app -d corapan_auth >/dev/null 2>&1; then
        log_success "Database is healthy and ready"
    else
        log_warning "Database container is running but not ready yet"
        log_info "Waiting 10 seconds for database to become ready..."
        sleep 10
        
        if docker exec "$DB_CONTAINER" pg_isready -U corapan_app -d corapan_auth >/dev/null 2>&1; then
            log_success "Database is now ready"
        else
            log_error "Database is not responding. Check database logs:"
            log_error "  docker logs $DB_CONTAINER"
            exit 1
        fi
    fi
    
    # Check Docker network
    DB_NETWORKS=$(docker inspect "$DB_CONTAINER" -f '{{range $net := .NetworkSettings.Networks}}{{$net.NetworkID}} {{end}}' | tr ' ' '\n')
    log_info "Database networks: $(echo $DB_NETWORKS | tr '\n' ' ')"
else
    log_warning "Database container not found or not running"
    log_info "This is OK for SQLite-based deployments"
fi

echo ""

# =============================================================================
# 4. Docker Compose Build & Deploy
# =============================================================================

log_info "🐋 Building and deploying Docker container..."

if [ "$FORCE_REBUILD" = true ]; then
  log_info "Force rebuild (--no-cache)..."
  docker compose -f "$COMPOSE_FILE" build --no-cache
else
  docker compose -f "$COMPOSE_FILE" build
fi

log_info "Starting container..."
docker compose -f "$COMPOSE_FILE" up -d

log_success "Container gestartet"

# Verify web container started and is connecting to database
sleep 3
WEB_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q web 2>/dev/null || echo "")
if [ -n "$WEB_CONTAINER" ]; then
    # Check if web container is still running (didn't crash during DB wait)
    if docker ps -q --filter "id=$WEB_CONTAINER" | grep -q .; then
        log_success "Web container is running"
    else
        log_error "Web container crashed during startup. Check logs:"
        docker logs "$WEB_CONTAINER" --tail=50
        exit 1
    fi
fi

# =============================================================================
# 4. Health Check
# =============================================================================

log_info "🏥 Checking application health..."

# Wait for container to start
sleep 5

# Check if container is running
if docker compose ps | grep -q "Up"; then
  log_success "Container läuft"
else
  log_error "Container läuft nicht!"
  log_info "Logs:"
  docker compose logs --tail=20
  exit 1
fi

# Check health endpoint
if curl -f http://localhost:8000/health &>/dev/null; then
  log_success "Health check passed ✓"
else
  log_warning "Health check fehlgeschlagen (App startet möglicherweise noch...)"
fi

# =============================================================================
# 5. Cleanup
# =============================================================================

log_info "🧹 Cleaning up old Docker images..."
docker image prune -f &>/dev/null || true

# =============================================================================
# Success!
# =============================================================================

echo ""
log_success "✅ Deployment abgeschlossen!"
echo ""
echo "Status:"
docker compose ps
echo ""
log_info "Logs anzeigen: docker compose logs -f"
log_info "Container stoppen: docker compose down"
log_info "Container neustarten: docker compose restart"
