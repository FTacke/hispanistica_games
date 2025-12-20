# =============================================================================
# CO.RA.PAN Data+Media Maintenance-Sync
# =============================================================================
#
# Zweck:
#   Interaktiver Maintenance-Runner fuer den regulaeren Data-/Media-Sync von
#   Dev -> Prod. Dieses Skript deployt KEINEN neuen Code und greift NICHT in
#   Auth- oder Anwendungs-Datenbanken ein.
#
#   Typischer Anwendungsfall: Neue Transkripte, Metadaten oder Audio-Dateien
#   auf den Produktions-Server uebertragen, ohne die Anwendung neu zu deployen.
#
# Was wird synchronisiert?
#   [D] Data (sync_data.ps1):
#       - counters, db_public, metadata, exports, blacklab_export
#       - Stats-DBs: stats_files.db, stats_country.db
#
#   [M] Media (sync_media.ps1):
#       - transcripts, mp3-full, mp3-split
#       - HINWEIS: Audio-Verzeichnisse koennen mehrere GB umfassen!
#
# Sync-Verhalten:
#   - Delta-Sync: nur neue/geaenderte Dateien werden uebertragen
#   - Geaenderte Dateien ueberschreiben die Version auf dem Server
#   - rsync zeigt den Fortschritt waehrend der Uebertragung an
#
# Force-Modus:
#   Mit -ForceData oder -ForceMedia werden ALLE Dateien uebertragen,
#   unabhaengig vom Manifest-Zustand. Nuetzlich bei:
#   - Manifest-Korruption
#   - Nach manuellem Eingriff auf dem Server
#   - Zur vollstaendigen Resynchronisation
#
#   Mit -ForceMP3 werden nur die MP3-Verzeichnisse (mp3-full, mp3-split)
#   vollstaendig uebertragen, waehrend transcripts im Delta-Modus bleibt.
#
# Verwendung:
#   cd C:\dev\corapan-webapp
#   .\scripts\deploy_sync\update_data_media.ps1              # Interaktiv
#   .\scripts\deploy_sync\update_data_media.ps1 -ForceData   # Force Data
#   .\scripts\deploy_sync\update_data_media.ps1 -ForceMedia  # Force Media
#   .\scripts\deploy_sync\update_data_media.ps1 -ForceMP3    # Force nur MP3s
#
#   Das Skript zeigt ein Menue und fragt nach der gewuenschten Aktion:
#   [D]  Nur Data syncen (Delta)
#   [M]  Nur Media syncen (Delta)
#   [A]  Alle (Data + Media, Delta)
#   [FD] Force Data (alle Dateien)
#   [FM] Force Media (alle Dateien)
#   [F3] Force MP3 (nur mp3-full/mp3-split)
#   [Q]  Abbrechen
#
# Fuer ein vollstaendiges Deploy (inkl. App-Code):
#   Verwende stattdessen: .\scripts\deploy_sync\deploy_full_prod.ps1
#
# =============================================================================

param(
    [switch]$ForceData,
    [switch]$ForceMedia,
    [switch]$ForceMP3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# -----------------------------------------------------------------------------
# Skript-Verzeichnis ermitteln
# -----------------------------------------------------------------------------

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Pfade zu den Sync-Skripten
$syncDataScript  = Join-Path $scriptDir "sync_data.ps1"
$syncMediaScript = Join-Path $scriptDir "sync_media.ps1"

# -----------------------------------------------------------------------------
# Hilfsfunktionen
# -----------------------------------------------------------------------------

function Write-Header {
    Write-Host ""
    Write-Host "===================================================================" -ForegroundColor Cyan
    Write-Host " CO.RA.PAN Data+Media Maintenance-Sync" -ForegroundColor Cyan
    Write-Host "===================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Dieses Skript deployt keinen neuen Code, sondern synchronisiert" -ForegroundColor DarkGray
    Write-Host "nur Daten und Medien von Dev -> Prod." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Datum: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
    
    # Zeige Force-Parameter wenn angegeben
    if ($ForceData -or $ForceMedia -or $ForceMP3) {
        Write-Host ""
        Write-Host "FORCE-MODUS AKTIV:" -ForegroundColor Yellow
        if ($ForceData) {
            Write-Host "  - ForceData: Alle Data-Dateien werden uebertragen" -ForegroundColor Yellow
        }
        if ($ForceMedia) {
            Write-Host "  - ForceMedia: Alle Media-Dateien werden uebertragen" -ForegroundColor Yellow
        }
        if ($ForceMP3) {
            Write-Host "  - ForceMP3: Nur MP3-Verzeichnisse werden uebertragen" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

function Write-SyncOverview {
    Write-Host "-------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " Verfuegbare Sync-Bereiche:" -ForegroundColor Yellow
    Write-Host "-------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  `[D`]  Data-Sync (Delta)" -ForegroundColor Green
    Write-Host "       - counters, db_public, metadata, exports, blacklab_export" -ForegroundColor DarkGray
    Write-Host "       - Stats-DBs: stats_files.db, stats_country.db" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  `[M`]  Media-Sync (Delta)" -ForegroundColor Magenta
    Write-Host "       - transcripts, mp3-full, mp3-split" -ForegroundColor DarkGray
    Write-Host "       HINWEIS: Audio-Ordner koennen mehrere GB enthalten!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  `[FD`] Force Data (alle Dateien uebertragen)" -ForegroundColor DarkYellow
    Write-Host "  `[FM`] Force Media (alle Dateien uebertragen)" -ForegroundColor DarkYellow
    Write-Host "  `[F3`] Force MP3 (nur mp3-full/mp3-split)" -ForegroundColor DarkYellow
    Write-Host ""
    Write-Host "-------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
}

function Invoke-SyncScript {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ScriptPath,
        
        [Parameter(Mandatory=$true)]
        [string]$SyncName,
        
        [switch]$Force,
        
        [switch]$ForceMP3
    )
    
    if (-not (Test-Path $ScriptPath)) {
        Write-Host "FEHLER: Sync-Skript nicht gefunden: $ScriptPath" -ForegroundColor Red
        return $false
    }
    
    Write-Host ""
    Write-Host "===================================================================" -ForegroundColor DarkGray
    if ($Force -or $ForceMP3) {
        Write-Host " Starte $SyncName (FORCE-MODUS)..." -ForegroundColor Yellow
    } else {
        Write-Host " Starte $SyncName..." -ForegroundColor Cyan
    }
    Write-Host "===================================================================" -ForegroundColor DarkGray
    
    try {
        if ($Force) {
            & $ScriptPath -Force
        } elseif ($ForceMP3) {
            & $ScriptPath -ForceMP3
        } else {
            & $ScriptPath
        }
        $exitCode = $LASTEXITCODE
        
        if ($exitCode -ne 0) {
            Write-Host ""
            Write-Host "`[FEHLER`] $SyncName fehlgeschlagen (Exit-Code: $exitCode)" -ForegroundColor Red
            return $false
        }
        
        Write-Host ""
        Write-Host "`[OK`] $SyncName erfolgreich" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host ""
        Write-Host "`[FEHLER`] $SyncName fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# -----------------------------------------------------------------------------
# Hauptprogramm
# -----------------------------------------------------------------------------

Write-Header
Write-SyncOverview

# Benutzerabfrage
Write-Host "Aktion waehlen:" -ForegroundColor White
Write-Host "  `[D`]  Nur Data syncen (Delta)" -ForegroundColor Green
Write-Host "  `[M`]  Nur Media syncen (Delta)" -ForegroundColor Magenta
Write-Host "  `[A`]  Alle (Data + Media, Delta)" -ForegroundColor Cyan
Write-Host "  `[FD`] Force Data (alle Dateien)" -ForegroundColor DarkYellow
Write-Host "  `[FM`] Force Media (alle Dateien)" -ForegroundColor DarkYellow
Write-Host "  `[F3`] Force MP3 (nur mp3-full/mp3-split)" -ForegroundColor DarkYellow
Write-Host "  `[Q`]  Abbrechen" -ForegroundColor DarkGray
Write-Host ""

$choice = Read-Host "Eingabe"

# Eingabe normalisieren (case-insensitive)
$choice = $choice.Trim().ToUpper()

# Ergebnis-Tracking
$dataSuccess  = $true
$mediaSuccess = $true
$anyRun       = $false

switch ($choice) {
    "D" {
        $anyRun = $true
        $dataSuccess = Invoke-SyncScript -ScriptPath $syncDataScript -SyncName "Data-Sync" -Force:$ForceData
    }
    "M" {
        $anyRun = $true
        $mediaSuccess = Invoke-SyncScript -ScriptPath $syncMediaScript -SyncName "Media-Sync" -Force:$ForceMedia
    }
    "A" {
        $anyRun = $true
        $dataSuccess = Invoke-SyncScript -ScriptPath $syncDataScript -SyncName "Data-Sync" -Force:$ForceData
        
        if ($dataSuccess) {
            $mediaSuccess = Invoke-SyncScript -ScriptPath $syncMediaScript -SyncName "Media-Sync" -Force:$ForceMedia
        }
        else {
            Write-Host ""
            Write-Host "`[WARNUNG`] Data-Sync fehlgeschlagen - Media-Sync wird uebersprungen" -ForegroundColor Yellow
            $mediaSuccess = $false
        }
    }
    "FD" {
        $anyRun = $true
        Write-Host ""
        Write-Host "FORCE DATA-SYNC: Alle Dateien werden uebertragen!" -ForegroundColor Yellow
        $dataSuccess = Invoke-SyncScript -ScriptPath $syncDataScript -SyncName "Data-Sync (FORCE)" -Force
    }
    "FM" {
        $anyRun = $true
        Write-Host ""
        Write-Host "FORCE MEDIA-SYNC: Alle Dateien werden uebertragen!" -ForegroundColor Yellow
        Write-Host "ACHTUNG: Bei grossen Audio-Verzeichnissen kann dies sehr lange dauern!" -ForegroundColor Red
        $mediaSuccess = Invoke-SyncScript -ScriptPath $syncMediaScript -SyncName "Media-Sync (FORCE)" -Force
    }
    "F3" {
        $anyRun = $true
        Write-Host ""
        Write-Host "FORCE MP3-SYNC: Nur mp3-full und mp3-split werden uebertragen!" -ForegroundColor Yellow
        Write-Host "transcripts bleibt im Delta-Modus." -ForegroundColor DarkGray
        $mediaSuccess = Invoke-SyncScript -ScriptPath $syncMediaScript -SyncName "Media-Sync (FORCE-MP3)" -ForceMP3
    }
    "Q" {
        Write-Host ""
        Write-Host "Abgebrochen, keine Syncs ausgefuehrt." -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host ""
        Write-Host "Ungueltige Eingabe: '$choice'" -ForegroundColor Red
        Write-Host "Erwartete Werte: D, M, A, FD, FM, F3 oder Q" -ForegroundColor DarkGray
        exit 1
    }
}

# Zusammenfassung
Write-Host ""
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host " Zusammenfassung" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

if ($anyRun) {
    if ($dataSuccess -and $mediaSuccess) {
        Write-Host "`[OK`] Alle ausgewaehlten Syncs erfolgreich abgeschlossen." -ForegroundColor Green
        exit 0
    }
    else {
        if (-not $dataSuccess) {
            Write-Host "`[FEHLER`] Data-Sync: fehlgeschlagen" -ForegroundColor Red
        }
        if (-not $mediaSuccess) {
            Write-Host "`[FEHLER`] Media-Sync: fehlgeschlagen" -ForegroundColor Red
        }
        exit 1
    }
}
