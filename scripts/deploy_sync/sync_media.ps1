# =============================================================================
# CO.RA.PAN Media Sync: Dev -> Prod
# =============================================================================
#
# Synchronisiert die Media-Verzeichnisse vom Dev-Rechner auf den Prod-Server.
# Der Sync erfolgt als Delta-Sync: nur neue oder geaenderte Dateien werden
# uebertragen, geaenderte Dateien ueberschreiben die Version auf dem Server.
#
# SYNCHRONISIERTE VERZEICHNISSE (unter media/):
#   - transcripts   -> Transkript-Dateien (JSON, TSV, etc.)
#   - mp3-full      -> Vollstaendige Audio-Aufnahmen (kann mehrere GB umfassen)
#   - mp3-split     -> Aufgeteilte Audio-Segmente (kann mehrere GB umfassen)
#
# MANIFEST-SPEICHERUNG:
#   Jedes Verzeichnis hat sein eigenes Manifest zur Aenderungsverfolgung:
#     media/transcripts/.sync_state/transcripts_manifest.json
#     media/mp3-full/.sync_state/mp3-full_manifest.json
#     media/mp3-split/.sync_state/mp3-split_manifest.json
#
#   Alte globale Manifeste (unter media/.sync_state/) werden automatisch
#   in die korrekten verzeichnisspezifischen Pfade migriert.
#
# NICHT SYNCHRONISIERT:
#   - mp3-temp      -> temporaere Dateien (lokale Verarbeitung)
#
# HINWEIS ZU GROSSEN DATENMENGEN:
#   Die Audio-Verzeichnisse (mp3-full, mp3-split) koennen mehrere Gigabyte
#   enthalten. Der Sync verwendet rsync mit folgenden Optimierungen:
#   - Delta-Transfer: nur tatsaechliche Aenderungen werden uebertragen
#   - --partial: unterbrochene Transfers koennen fortgesetzt werden
#   - Fortschrittsanzeige: zeigt globalen Fortschritt waehrend des Uploads
#   - Kompression (-z): ist fuer rsync-Effizienz aktiviert
#
#   Bei sehr grossen Erstuebertragungen kann der Sync mehrere Stunden dauern.
#   Der Fortschritt wird im Terminal angezeigt.
#
# FORCE-MODUS (-Force):
#   Mit dem Parameter -Force werden alle Dateien uebertragen, unabhaengig
#   vom Manifest-Zustand. Nuetzlich nach Manifest-Korruption oder zur
#   vollstaendigen Resynchronisation.
#   
#   Beispiel: .\sync_media.ps1 -Force
#
# FORCE-MP3-MODUS (-ForceMP3):
#   Mit dem Parameter -ForceMP3 werden nur die MP3-Verzeichnisse
#   (mp3-full, mp3-split) vollstaendig uebertragen. Transcripts bleiben
#   im Delta-Modus. Nuetzlich wenn nur Audio-Dateien resynchronisiert
#   werden sollen.
#   
#   Beispiel: .\sync_media.ps1 -ForceMP3
#
# VERWENDUNG:
#   cd C:\dev\corapan-webapp
#   .\scripts\deploy_sync\sync_media.ps1              # Normal (Delta-Sync)
#   .\scripts\deploy_sync\sync_media.ps1 -Force       # Force (alle Dateien)
#   .\scripts\deploy_sync\sync_media.ps1 -ForceMP3    # Force nur MP3s
#
# Siehe auch:
#   - update_data_media.ps1  -> Interaktiver Maintenance-Runner
#   - sync_data.ps1          -> Data-Verzeichnisse synchronisieren
#   - sync_core.ps1          -> Gemeinsame Sync-Funktionen
#
# =============================================================================

param(
    [switch]$Force,
    [switch]$ForceMP3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# -----------------------------------------------------------------------------
# Konfiguration
# -----------------------------------------------------------------------------

$LOCAL_BASE_PATH  = "C:\dev\corapan-webapp\media"
$REMOTE_BASE_PATH = "/srv/webapps/corapan/media"

# Zu synchronisierende Verzeichnisse
# Alle aktiven Media-Verzeichnisse inkl. grosser Audio-Ordner:
$MEDIA_DIRECTORIES = @(
    "transcripts",
    "mp3-full",
    "mp3-split"
)

# -----------------------------------------------------------------------------
# Core-Bibliothek laden
# -----------------------------------------------------------------------------

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$coreScript = Join-Path $scriptDir "sync_core.ps1"

if (-not (Test-Path $coreScript)) {
    Write-Host "FEHLER: sync_core.ps1 nicht gefunden: $coreScript" -ForegroundColor Red
    exit 1
}

. $coreScript

# -----------------------------------------------------------------------------
# Hauptprogramm
# -----------------------------------------------------------------------------

Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host " CO.RA.PAN Media Sync: Dev -> Prod" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Quelle:  $LOCAL_BASE_PATH" -ForegroundColor DarkGray
Write-Host "Ziel:    $REMOTE_BASE_PATH" -ForegroundColor DarkGray
Write-Host "Datum:   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
if ($Force) {
    Write-Host "Modus:   FORCE (alle Dateien uebertragen)" -ForegroundColor Yellow
} elseif ($ForceMP3) {
    Write-Host "Modus:   FORCE-MP3 (nur mp3-full/mp3-split)" -ForegroundColor Yellow
} else {
    Write-Host "Modus:   Delta-Sync (nur Aenderungen)" -ForegroundColor DarkGray
}
Write-Host ""

# Prüfen ob lokales Verzeichnis existiert
if (-not (Test-Path $LOCAL_BASE_PATH)) {
    Write-Host "FEHLER: Lokales Medienverzeichnis nicht gefunden: $LOCAL_BASE_PATH" -ForegroundColor Red
    exit 1
}

# Synchronisation für jedes Verzeichnis
$errorCount = 0
foreach ($dir in $MEDIA_DIRECTORIES) {
    $localDir = Join-Path $LOCAL_BASE_PATH $dir
    
    if (-not (Test-Path $localDir)) {
        Write-Host ""
        Write-Host "[$dir]" -ForegroundColor Yellow
        Write-Host "  WARNUNG: Lokales Verzeichnis nicht gefunden - übersprungen" -ForegroundColor Yellow
        continue
    }
    
    try {
        # Force-Logik: -Force gilt fuer alle, -ForceMP3 nur fuer mp3-*
        $useForce = $Force -or ($ForceMP3 -and $dir -like "mp3-*")
        
        Sync-DirectoryWithDiff `
            -LocalBasePath $LOCAL_BASE_PATH `
            -RemoteBasePath $REMOTE_BASE_PATH `
            -DirName $dir `
            -Force:$useForce
    } catch {
        $errorCount++
        Write-Host "  FEHLER bei $dir : $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Rechte auf Server setzen
if ($errorCount -eq 0) {
    Set-RemoteOwnership -RemotePath $REMOTE_BASE_PATH
}

# Zusammenfassung
Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host " Media Sync abgeschlossen" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host ""

if ($errorCount -gt 0) {
    Write-Host "WARNUNG: $errorCount Fehler aufgetreten!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Alle $($MEDIA_DIRECTORIES.Count) Verzeichnisse erfolgreich synchronisiert." -ForegroundColor Green
    exit 0
}
