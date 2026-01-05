#!/bin/bash
# =============================================================================
# games_hispanistica Backup Script
# =============================================================================
#
# Erstellt Backups von:
# - Counter-Daten (werden von App geschrieben)
# - Optional: Datenbank (wenn --full)
# - Optional: Media-Dateien (wenn --full)
#
# NUTZUNG:
#   ./backup.sh                    # Nur Counters (schnell)
#   ./backup.sh --full             # Alles (langsam, viel Speicher)
#   ./backup.sh --db-only          # Nur Datenbank + Counters
#
# Backups werden gespeichert in: /srv/webapps/games_hispanistica/backups/
# Alte Backups (>30 Tage) werden automatisch gelöscht
#
# =============================================================================

set -e  # Exit on error

# ANSI Color Codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Konfiguration
# =============================================================================

BACKUP_DIR="/srv/webapps/games_hispanistica/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATA_DIR="/srv/webapps/games_hispanistica/data"
MEDIA_DIR="/srv/webapps/games_hispanistica/media"
RETENTION_DAYS=30  # Behalte Backups für 30 Tage

BACKUP_TYPE="minimal"  # minimal, db-only, oder full

# =============================================================================
# Argument Parsing
# =============================================================================

for arg in "$@"; do
  case $arg in
    --full)
      BACKUP_TYPE="full"
      shift
      ;;
    --db-only)
      BACKUP_TYPE="db-only"
      shift
      ;;
    --help)
      echo "games_hispanistica Backup Script"
      echo ""
      echo "Optionen:"
      echo "  (keine)       Nur Counter-Daten (empfohlen, schnell)"
      echo "  --db-only     Counter + Datenbank"
      echo "  --full        Alles inkl. Media (WARNUNG: sehr groß!)"
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

human_readable_size() {
  du -sh "$1" 2>/dev/null | cut -f1
}

# =============================================================================
# Pre-Flight Checks
# =============================================================================

log_info "📦 Starting CO.RA.PAN Backup (Type: $BACKUP_TYPE)..."

# Check if backup directory exists
mkdir -p "$BACKUP_DIR"

# Check if source directories exist
if [ ! -d "$DATA_DIR/counters" ]; then
  log_error "Counter-Verzeichnis nicht gefunden: $DATA_DIR/counters"
  exit 1
fi

# =============================================================================
# Backup erstellen
# =============================================================================

case $BACKUP_TYPE in
  minimal)
    log_info "Backup-Typ: Minimal (nur Counters)"
    BACKUP_FILE="$BACKUP_DIR/backup_counters_$TIMESTAMP.tar.gz"
    
    tar -czf "$BACKUP_FILE" \
      -C "$DATA_DIR" counters/ \
      2>/dev/null
    ;;
    
  db-only)
    log_info "Backup-Typ: DB + Counters"
    BACKUP_FILE="$BACKUP_DIR/backup_db_$TIMESTAMP.tar.gz"
    
    tar -czf "$BACKUP_FILE" \
      -C "$DATA_DIR" counters/ db/ \
      2>/dev/null
    ;;
    
  full)
    log_warning "⚠️  Full Backup inkl. Media (kann sehr groß werden!)"
    BACKUP_FILE="$BACKUP_DIR/backup_full_$TIMESTAMP.tar.gz"
    
    # Geschätzte Größe anzeigen
    log_info "Berechne Größe..."
    MEDIA_SIZE=$(human_readable_size "$MEDIA_DIR")
    DB_SIZE=$(human_readable_size "$DATA_DIR")
    log_info "Media: $MEDIA_SIZE, Data: $DB_SIZE"
    
    tar -czf "$BACKUP_FILE" \
      -C ~/corapan \
      data/counters/ \
      data/db/ \
      media/ \
      2>/dev/null
    ;;
esac

# =============================================================================
# Backup verifizieren
# =============================================================================

if [ -f "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(human_readable_size "$BACKUP_FILE")
  log_success "✅ Backup erstellt: $BACKUP_FILE ($BACKUP_SIZE)"
else
  log_error "Backup fehlgeschlagen!"
  exit 1
fi

# =============================================================================
# Alte Backups löschen (Retention Policy)
# =============================================================================

log_info "🧹 Bereinige alte Backups (älter als $RETENTION_DAYS Tage)..."

find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f | wc -l)
log_info "Verbleibende Backups: $REMAINING_BACKUPS"

# =============================================================================
# Backup-Liste anzeigen
# =============================================================================

log_info "📋 Letzte 5 Backups:"
ls -lht "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | head -5 | while read -r line; do
  echo "  $line"
done

# =============================================================================
# Erfolg
# =============================================================================

echo ""
log_success "✅ Backup abgeschlossen!"
echo ""
log_info "Backup wiederherstellen:"
log_info "  tar -xzf $BACKUP_FILE -C /root/corapan/"
