# =============================================================================
# CO.RA.PAN Sync Core Library
# =============================================================================
#
# Gemeinsame Funktionen fuer Data- und Media-Synchronisation Dev -> Prod
#
# Funktionen:
#   - New-DirectoryManifest: Erzeugt JSON-Manifest fuer lokales Verzeichnis
#   - Compare-Manifests: Vergleicht lokales und remote Manifest
#   - Sync-DirTarBase64: Synchronisiert Verzeichnis via tar+base64+SSH (Fallback)
#   - Sync-DirectoryWithRsync: Synchronisiert Verzeichnis via rsync (bevorzugt)
#   - Sync-DirectoryWithDiff: Vollstaendiger Sync mit Diff-Vorschau
#   - Test-And-MigrateManifest: Migriert globale Manifeste zu verzeichnisspezifischen
#   - Test-AndWarnIfPreviousSyncAborted: Warnt bei unterbrochenem vorherigen Sync
#
# Manifest-Speicherung:
#   Jedes synchronisierte Verzeichnis hat sein eigenes Manifest:
#     media/transcripts/.sync_state/transcripts_manifest.json
#     media/mp3-full/.sync_state/mp3-full_manifest.json
#     media/mp3-split/.sync_state/mp3-split_manifest.json
#   Alte globale Manifeste (unter media/.sync_state/) werden automatisch migriert.
#
# Transport-Entscheidung:
#   - Wenn rsync lokal verfuegbar und lauffaehig -> rsync (echter Delta-Sync)
#   - Sonst -> tar+base64 Fallback
#
# rsync Pfad-Logik (Windows/cwRsync):
#   - cwRsync erwartet Cygwin-Pfade: /cygdrive/c/dev/...
#   - Die Funktion Convert-ToRsyncPath konvertiert automatisch.
#   - cwRsync-Pfad: C:\dev\corapan-webapp\tools\cwrsync\bin
#
# rsync-Optionen fuer grosse Dateien (z.B. Audio):
#   - --partial: Ermoeglicht Fortsetzung unterbrochener Transfers.
#     Bei grossen Dateien (mehrere GB) kann ein abgebrochener Upload
#     beim naechsten Aufruf weitergefuehrt werden, statt von vorne zu beginnen.
#   - --progress: Zeigt Fortschrittsanzeige pro Datei.
#   - -z (Kompression): Bleibt aktiv. rsync komprimiert datenbasiert und
#     erkennt bereits komprimierte Daten (MP3, etc.) automatisch.
#     Der Overhead bei bereits komprimierten Dateien ist minimal.
#   - --delete: Entfernt Dateien auf dem Ziel, die lokal nicht mehr existieren.
#
# Force-Modus:
#   - $Force = $true: Alle Dateien uebertragen unabhaengig vom Zustand
#   - rsync-Optionen: --ignore-times (ignoriert mtime-Vergleich)
#   - Nuetzlich nach Manifest-Korruption oder zur vollstaendigen Resynchronisation
#
# Verbose-Modus:
#   - $script:SyncVerbose = $true  -> Ausfuehrliche Ausgaben
#   - $script:SyncVerbose = $false -> Reduzierte Ausgaben (Standard)
#
# SSH-Authentifizierung:
#   - Dedizierter Deploy-Key: $env:USERPROFILE\.ssh\marele (OHNE Passphrase)
#   - Der Key ist passwortlos fuer automatisierte Sync-/Deploy-Operationen
#   - Kein ssh-agent erforderlich
#
# Fehlerhandling:
#   - rsync-Fehler sind kritisch und fuehren zum Abbruch
#   - Manifest-/Post-Sync-Fehler geben Warnung aus, aber kein Fehler-Exit
#   - Manifest wird NUR bei rsync Exitcode=0 aktualisiert
#
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# -----------------------------------------------------------------------------
# Konfiguration
# -----------------------------------------------------------------------------

$script:SyncConfig = @{
    ServerHost     = "marele.online.uni-marburg.de"
    ServerIP       = "137.248.186.51"
    ServerUser     = "root"
    # Deploy-Key ohne Passphrase - 8.3-Format fuer cwRsync-Kompatibilitaet
    SSHKeyPath     = "C:\Users\FELIXT~1\.ssh\marele"
    # Voller Pfad zum Key (fuer Windows OpenSSH)
    SSHKeyPathFull = "$env:USERPROFILE\.ssh\marele"
    # Windows OpenSSH fuer direkte SSH-Aufrufe
    WindowsSSHPath = "C:\Windows\System32\OpenSSH\ssh.exe"
    AppUser        = "hrzadmin"
    AppUid         = 1000
    AppGid         = 1000
    CwRsyncPath    = "C:\dev\corapan-webapp\tools\cwrsync\bin"
}

# Flag um rsync-Verfuegbarkeits-Log nur einmal auszugeben
$script:RsyncAvailabilityLogged = $false

# Verbose-Modus: $true = ausfuehrlich, $false = reduziert (Standard)
$script:SyncVerbose = $false

# -----------------------------------------------------------------------------
# Verbose/Quiet Steuerung
# -----------------------------------------------------------------------------

function Set-SyncVerbose {
    param([bool]$Verbose = $true)
    $script:SyncVerbose = $Verbose
}

function Write-VerboseSync {
    param([string]$Message, [string]$Color = "DarkGray")
    if ($script:SyncVerbose) {
        Write-Host $Message -ForegroundColor $Color
    }
}

# -----------------------------------------------------------------------------
# ASCII-Fortschrittsbalken
# -----------------------------------------------------------------------------

function Write-ProgressBar {
    param(
        [int]$Current,
        [int]$Total,
        [string]$Activity = "Fortschritt",
        [int]$BarLength = 30
    )
    
    if ($Total -le 0) { $Total = 1 }
    $percent = [math]::Min(100, [math]::Round(($Current / $Total) * 100))
    $filled = [math]::Round(($percent / 100) * $BarLength)
    $empty = $BarLength - $filled
    
    $bar = "[" + ("#" * $filled) + ("." * $empty) + "]"
    $status = "$bar $Current/$Total ($percent%)"
    
    # Ueberschreibe aktuelle Zeile
    Write-Host "`r    $Activity : $status" -NoNewline
}

function Complete-ProgressBar {
    param([string]$Message = "Abgeschlossen")
    Write-Host "`r    $Message" + (" " * 40)
}

# -----------------------------------------------------------------------------
# Test-AndWarnIfPreviousSyncAborted: Warnt bei unterbrochenem vorherigen Sync
# Heuristik: Manifest-mtime < Sync-Start bedeutet wahrscheinlich Abbruch
# -----------------------------------------------------------------------------

function Test-AndWarnIfPreviousSyncAborted {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RemoteBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName
    )
    
    $syncStateDir = "$RemoteBasePath/$DirName/.sync_state"
    $manifestFile = "$syncStateDir/${DirName}_manifest.json"
    $syncStartFile = "$syncStateDir/.sync_start"
    
    # Pruefe ob beide Dateien existieren und vergleiche mtime
    $checkCmd = @"
if [ -f "$manifestFile" ] && [ -f "$syncStartFile" ]; then
    if [ "$syncStartFile" -nt "$manifestFile" ]; then
        echo "ABORTED"
    else
        echo "OK"
    fi
elif [ -f "$manifestFile" ]; then
    echo "OK"
else
    echo "FIRST_RUN"
fi
"@
    
    try {
        $result = Invoke-SSHCommand -Command $checkCmd -PassThru -NoThrow
        if ($null -ne $result) {
            $status = $result.Trim()
            if ($status -eq "ABORTED") {
                Write-Host "  WARNUNG: Vorheriger Sync wurde wahrscheinlich unterbrochen." -ForegroundColor Yellow
                Write-Host "           rsync fuehrt eine Wiederaufnahme durch." -ForegroundColor Yellow
            }
        }
    }
    catch {
        # Fehler ignorieren - kein kritischer Check
        Write-VerboseSync "    Info: Abbruch-Erkennung fehlgeschlagen (nicht kritisch)"
    }
}

# -----------------------------------------------------------------------------
# Set-SyncStartMarker: Setzt einen Zeitstempel-Marker vor dem Sync
# -----------------------------------------------------------------------------

function Set-SyncStartMarker {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RemoteBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName
    )
    
    $syncStateDir = "$RemoteBasePath/$DirName/.sync_state"
    $syncStartFile = "$syncStateDir/.sync_start"
    
    try {
        Invoke-SSHCommand -Command "mkdir -p '$syncStateDir' && touch '$syncStartFile'" -NoThrow | Out-Null
    }
    catch {
        # Ignorieren - nicht kritisch
    }
}

# -----------------------------------------------------------------------------
# Remove-SyncStartMarker: Entfernt den Zeitstempel-Marker nach erfolgreichem Sync
# -----------------------------------------------------------------------------

function Remove-SyncStartMarker {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RemoteBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName
    )
    
    $syncStateDir = "$RemoteBasePath/$DirName/.sync_state"
    $syncStartFile = "$syncStateDir/.sync_start"
    
    try {
        Invoke-SSHCommand -Command "rm -f '$syncStartFile'" -NoThrow | Out-Null
    }
    catch {
        # Ignorieren - nicht kritisch
    }
}

# -----------------------------------------------------------------------------
# Get-LocalDirectorySize: Berechnet Gesamtgroesse eines Verzeichnisses
# -----------------------------------------------------------------------------

function Get-LocalDirectorySize {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path
    )
    
    if (-not (Test-Path $Path)) {
        return 0
    }
    
    $totalSize = (Get-ChildItem -Path $Path -Recurse -File -ErrorAction SilentlyContinue | 
                  Measure-Object -Property Length -Sum).Sum
    
    if ($null -eq $totalSize) { $totalSize = 0 }
    return $totalSize
}

# -----------------------------------------------------------------------------
# Format-FileSize: Formatiert Bytes in lesbares Format (KB/MB/GB)
# -----------------------------------------------------------------------------

function Format-FileSize {
    param([long]$Bytes)
    
    if ($Bytes -ge 1GB) {
        return "{0:N2} GB" -f ($Bytes / 1GB)
    }
    elseif ($Bytes -ge 1MB) {
        return "{0:N1} MB" -f ($Bytes / 1MB)
    }
    elseif ($Bytes -ge 1KB) {
        return "{0:N0} KB" -f ($Bytes / 1KB)
    }
    else {
        return "$Bytes Bytes"
    }
}

# -----------------------------------------------------------------------------
# rsync-Verfuegbarkeit und Pfadlogik
# -----------------------------------------------------------------------------

function Test-RsyncAvailable {
    [OutputType([bool])]
    param()
    
    # Stelle sicher, dass cwRsync im PATH ist
    if ($script:SyncConfig.CwRsyncPath -and (Test-Path $script:SyncConfig.CwRsyncPath)) {
        if ($env:Path -notlike "*$($script:SyncConfig.CwRsyncPath)*") {
            $env:Path = "$($script:SyncConfig.CwRsyncPath);$env:Path"
        }
    }
    
    try {
        $cmd = Get-Command rsync -ErrorAction Stop
        
        if (-not $script:RsyncAvailabilityLogged) {
            Write-Host "[Sync] rsync verfuegbar ($($cmd.Source)) - rsync-Modus aktiv" -ForegroundColor DarkGreen
            $script:RsyncAvailabilityLogged = $true
        }
        return $true
    }
    catch {
        if (-not $script:RsyncAvailabilityLogged) {
            Write-Host "[Sync] rsync nicht gefunden - verwende tar+base64 Fallback" -ForegroundColor DarkYellow
            $script:RsyncAvailabilityLogged = $true
        }
        return $false
    }
}

function Convert-ToRsyncPath {
    param(
        [Parameter(Mandatory=$true)]
        [string]$WindowsPath,
        
        [switch]$PreserveShortName
    )
    
    if ($PreserveShortName) {
        # Behalte 8.3-Namen bei (wichtig fuer Pfade mit Leerzeichen)
        $path = $WindowsPath
    }
    else {
        # Volle Normalisierung (loest 8.3-Namen auf)
        $path = [System.IO.Path]::GetFullPath($WindowsPath)
    }
    
    # Laufwerksbuchstabe und Rest trennen
    if ($path -match '^([a-zA-Z]):(.*)$') {
        $drive = $Matches[1].ToLower()
        $rest = $Matches[2] -replace '\\', '/'
        
        # cwRsync / Cygwin-Style Pfad
        return "/cygdrive/$drive$rest"
    }
    
    # Falls kein Laufwerkspfad, einfach Backslashes ersetzen
    return $path -replace '\\', '/'
}

function Sync-DirectoryWithRsync {
    param(
        [Parameter(Mandatory=$true)]
        [string]$LocalBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$RemoteBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName,
        
        [int]$LocalFileCount = 0,
        
        [long]$LocalTotalSize = 0,
        
        [switch]$Force
    )
    
    $localPath = Join-Path $LocalBasePath $DirName
    $remotePath = "$RemoteBasePath/$DirName"
    
    if (-not (Test-Path $localPath)) {
        throw "Lokales Verzeichnis existiert nicht: $localPath"
    }
    
    $server = "$($script:SyncConfig.ServerUser)@$($script:SyncConfig.ServerHost)"
    
    Write-Host "    [rsync] $DirName -> ${server}:$remotePath" -ForegroundColor Cyan
    
    # Anzahl lokaler Dateien und Groesse anzeigen
    if ($LocalFileCount -gt 0) {
        $sizeStr = if ($LocalTotalSize -gt 0) { ", Groesse: $(Format-FileSize $LocalTotalSize)" } else { "" }
        Write-Host "    Lokale Dateien: $LocalFileCount$sizeStr" -ForegroundColor DarkGray
    }
    
    # Force-Modus Info
    if ($Force) {
        Write-Host "    FORCE-MODUS: Alle Dateien werden uebertragen (--ignore-times)" -ForegroundColor Yellow
    }
    
    # Konvertiere lokalen Pfad fuer rsync (mit trailing slash fuer Inhalt)
    $rsyncSource = (Convert-ToRsyncPath $localPath) + "/"
    
    # cwRsync verwendet sein eigenes ssh - Key-Pfad in Cygwin-Format
    # Verwende 8.3-Pfad um Leerzeichen zu vermeiden
    $sshKeyCygwin = Convert-ToRsyncPath $script:SyncConfig.SSHKeyPath -PreserveShortName
    
    # SSH-Optionen: Key ohne Passphrase, Timeout-Schutz
    $sshCmd = "ssh -i '$sshKeyCygwin' -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -o ServerAliveCountMax=3"
    
    # rsync-Befehl zusammenbauen
    # --partial: Ermoeglicht Fortsetzung unterbrochener Transfers bei grossen Dateien
    # --progress: Zeigt Fortschritt pro Datei (kompatibel mit cwRsync)
    $rsyncArgs = @(
        "-avz",
        "--partial",
        "--progress",
        "--delete",
        "-e", $sshCmd,
        "--exclude", "blacklab_index",
        "--exclude", "blacklab_index.backup",
        "--exclude", "stats_temp",
        "--exclude", "db",
        "--exclude", ".sync_state"
    )
    
    # Force-Modus: --ignore-times ignoriert Dateizeit-Vergleich
    if ($Force) {
        $rsyncArgs += "--ignore-times"
    }
    
    # Quell- und Zielpfad anhaengen
    $rsyncArgs += "$rsyncSource"
    $rsyncArgs += "${server}:$remotePath/"
    
    Write-VerboseSync "    Fuehre aus: rsync $($rsyncArgs -join ' ')"
    
    $startTime = Get-Date
    
    # Zaehler fuer uebertragene Dateien
    $transferredCount = 0
    $skippedCount = 0
    $currentFile = ""
    
    # rsync ausfuehren und Output parsen fuer Fortschrittsanzeige
    $rsyncOutput = @()
    
    # rsync direkt ausfuehren
    & rsync @rsyncArgs 2>&1 | ForEach-Object {
        $line = $_
        $rsyncOutput += $line
        
        # Zeige rsync-Output wenn verbose
        if ($script:SyncVerbose) {
            Write-Host $line
        }
        else {
            # Parse rsync Output fuer Fortschritt
            # Dateitransfer-Zeilen enthalten Prozentangaben
            if ($line -match '^\s*[\d,]+\s+\d+%') {
                # Fortschrittszeile - zeige wenn verbose
            }
            elseif ($line -match '^([\w\-_./]+)\s*$' -or $line -match '^.+\.(mp3|json|tsv|db|txt)$') {
                # Moegliche Datei - zaehle
                $transferredCount++
                $currentFile = $line.Trim()
                
                # Kompakter Fortschrittsticker alle 10 Dateien
                if ($LocalFileCount -gt 0 -and ($transferredCount % 10 -eq 0 -or $transferredCount -eq $LocalFileCount)) {
                    $percent = [math]::Min(100, [math]::Round(($transferredCount / $LocalFileCount) * 100))
                    $barLen = 20
                    $filled = [math]::Round(($percent / 100) * $barLen)
                    $bar = "[" + ("#" * $filled) + ("." * ($barLen - $filled)) + "]"
                    
                    # Kuerze Dateinamen
                    $shortFile = if ($currentFile.Length -gt 30) { 
                        "..." + $currentFile.Substring($currentFile.Length - 27) 
                    } else { 
                        $currentFile 
                    }
                    
                    Write-Host "`r    $bar $transferredCount/$LocalFileCount Dateien ($percent%) - $shortFile    " -NoNewline
                }
            }
        }
    }
    
    $exitCode = $LASTEXITCODE
    
    # Zeilenumbruch nach Fortschrittsanzeige
    if (-not $script:SyncVerbose -and $LocalFileCount -gt 0 -and $transferredCount -gt 10) {
        Write-Host ""
    }
    
    $duration = (Get-Date) - $startTime
    
    if ($exitCode -ne 0) {
        throw "rsync fuer $DirName fehlgeschlagen (Exit-Code: $exitCode)"
    }
    
    # Zusammenfassung extrahieren aus rsync-Output
    $sentLine = $rsyncOutput | Where-Object { $_ -match '^sent\s+[\d,]+\s+bytes' } | Select-Object -Last 1
    $totalLine = $rsyncOutput | Where-Object { $_ -match '^total\s+size\s+is' } | Select-Object -Last 1
    
    if ($sentLine) {
        Write-Host "    $sentLine" -ForegroundColor DarkGray
    }
    
    Write-Host "    [rsync] $DirName - OK ($('{0:mm\:ss}' -f $duration))" -ForegroundColor Green
    
    return @{
        ExitCode = $exitCode
        Duration = $duration
        TransferredFiles = $transferredCount
    }
}

# -----------------------------------------------------------------------------
# Helper: SSH-Befehl ausfuehren (Windows OpenSSH)
# -----------------------------------------------------------------------------

function Invoke-SSHCommand {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Command,
        [switch]$PassThru,
        [switch]$NoThrow
    )
    
    # Verwende Windows OpenSSH mit dem passwortlosen Deploy-Key
    $sshExe = $script:SyncConfig.WindowsSSHPath
    $sshKeyPath = $script:SyncConfig.SSHKeyPathFull
    
    $sshArgs = @(
        "-i", $sshKeyPath,
        "-o", "StrictHostKeyChecking=no",
        "-o", "ServerAliveInterval=60",
        "-o", "ServerAliveCountMax=3",
        "-o", "ConnectTimeout=30",
        "$($script:SyncConfig.ServerUser)@$($script:SyncConfig.ServerHost)",
        $Command
    )
    
    if ($PassThru) {
        $result = & $sshExe @sshArgs 2>&1
        if ($LASTEXITCODE -ne 0) {
            if ($NoThrow) {
                return $null
            }
            throw "SSH command failed (exit code $LASTEXITCODE): $result"
        }
        return $result
    }
    else {
        & $sshExe @sshArgs
        if ($LASTEXITCODE -ne 0) {
            if ($NoThrow) {
                return $false
            }
            throw "SSH command failed with exit code $LASTEXITCODE"
        }
        return $true
    }
}

# -----------------------------------------------------------------------------
# Test-And-MigrateManifest: Migriert globale Manifeste zu verzeichnisspezifischen
# Prueft ob ein globales Manifest unter $RemoteBasePath/.sync_state/ existiert
# und verschiebt es ggf. an den korrekten Ort $RemoteBasePath/$DirName/.sync_state/
# -----------------------------------------------------------------------------

function Test-And-MigrateManifest {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RemoteBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName
    )
    
    $globalManifestDir = "$RemoteBasePath/.sync_state"
    $globalManifestFile = "$globalManifestDir/${DirName}_manifest.json"
    $targetManifestDir = "$RemoteBasePath/$DirName/.sync_state"
    $targetManifestFile = "$targetManifestDir/${DirName}_manifest.json"
    
    # Einfaches Shell-Skript fuer Migration (robuster als Python mit Escaping)
    $migrationCmd = @"
if [ -f "$globalManifestFile" ]; then
    mkdir -p "$targetManifestDir"
    if [ -f "$targetManifestFile" ]; then
        # Ziel existiert - vergleiche mtime
        if [ "$globalManifestFile" -nt "$targetManifestFile" ]; then
            cp "$globalManifestFile" "$targetManifestFile"
            rm "$globalManifestFile"
            echo "updated_newer"
        else
            rm "$globalManifestFile"
            echo "removed_old_global"
        fi
    else
        mv "$globalManifestFile" "$targetManifestFile"
        echo "moved"
    fi
    # Loesche globales Verzeichnis wenn leer
    rmdir "$globalManifestDir" 2>/dev/null || true
else
    echo "no_action"
fi
"@
    
    try {
        $result = Invoke-SSHCommand -Command $migrationCmd -PassThru -NoThrow
        if ($null -ne $result) {
            $action = $result.Trim()
            switch ($action) {
                "moved" {
                    Write-Host "    Info: Globales Manifest gefunden - migriert nach $DirName/.sync_state/" -ForegroundColor Yellow
                }
                "updated_newer" {
                    Write-Host "    Info: Globales Manifest (neuer) - aktualisiert in $DirName/.sync_state/" -ForegroundColor Yellow
                }
                "removed_old_global" {
                    Write-VerboseSync "    Info: Veraltetes globales Manifest entfernt"
                }
                "no_action" {
                    # Nichts zu tun - kein globales Manifest vorhanden
                }
            }
        }
    }
    catch {
        Write-VerboseSync "    Info: Manifest-Migration-Check fehlgeschlagen (nicht kritisch)"
    }
}

# -----------------------------------------------------------------------------
# New-DirectoryManifest: Erzeugt JSON-Manifest fuer lokales Verzeichnis
# -----------------------------------------------------------------------------

function New-DirectoryManifest {
    param(
        [Parameter(Mandatory=$true)]
        [string]$BasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName
    )
    
    $fullPath = Join-Path $BasePath $DirName
    
    if (-not (Test-Path $fullPath)) {
        throw "Verzeichnis nicht gefunden: $fullPath"
    }
    
    $manifest = @()
    $files = Get-ChildItem -Path $fullPath -Recurse -File -ErrorAction SilentlyContinue
    
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($fullPath.Length + 1) -replace '\\', '/'
        $mtime = [int][double]::Parse(
            (Get-Date $file.LastWriteTimeUtc -UFormat %s)
        )
        
        $manifest += [PSCustomObject]@{
            path  = "$DirName/$relativePath"
            size  = $file.Length
            mtime = $mtime
        }
    }
    
    return $manifest
}

# -----------------------------------------------------------------------------
# Get-RemoteManifest: Liest oder erzeugt Manifest auf dem Server
# Verwendet verzeichnisspezifischen Pfad: $RemoteBasePath/$DirName/.sync_state/
# -----------------------------------------------------------------------------

function Get-RemoteManifest {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RemoteBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName
    )
    
    # NEUER verzeichnisspezifischer Pfad
    $syncStateDir = "$RemoteBasePath/$DirName/.sync_state"
    $manifestFile = "$syncStateDir/${DirName}_manifest.json"
    $targetDir = "$RemoteBasePath/$DirName"
    
    # Versuche zuerst das gespeicherte Manifest zu lesen
    $readManifestCmd = "cat '$manifestFile' 2>/dev/null || echo '[]'"
    
    try {
        $result = Invoke-SSHCommand -Command $readManifestCmd -PassThru -NoThrow
        if ($null -ne $result -and $result.Trim() -ne "[]" -and $result.Trim() -ne "") {
            $manifest = $result | ConvertFrom-Json
            if ($null -ne $manifest -and $manifest.Count -gt 0) {
                Write-VerboseSync "    Manifest gelesen: $($manifest.Count) Eintraege"
                if ($manifest -isnot [array]) {
                    return ,@($manifest)
                }
                return ,$manifest
            }
        }
    }
    catch {
        Write-VerboseSync "    Info: Gespeichertes Manifest nicht lesbar, erzeuge dynamisch..."
    }
    
    # Fallback: Manifest dynamisch auf dem Server erzeugen
    $pythonScript = @"
import json
import os
import sys

base_path = '$targetDir'
manifest = []

if os.path.exists(base_path):
    for root, dirs, files in os.walk(base_path):
        # Ueberspringe .sync_state Verzeichnisse
        dirs[:] = [d for d in dirs if d != '.sync_state']
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, os.path.dirname(base_path))
            stat = os.stat(full)
            manifest.append({
                'path': rel.replace('\\\\', '/'),
                'size': stat.st_size,
                'mtime': int(stat.st_mtime)
            })

print(json.dumps(manifest))
"@
    
    $escapedPython = $pythonScript -replace "'", "'\\''"
    $command = "python3 -c '$escapedPython'"
    
    try {
        $result = Invoke-SSHCommand -Command $command -PassThru
        $manifest = $result | ConvertFrom-Json
        # Sicherstellen dass immer ein Array zurueckgegeben wird
        if ($null -eq $manifest) {
            return ,@()
        }
        # Einzelnes Objekt in Array wrappen
        if ($manifest -isnot [array]) {
            return ,@($manifest)
        }
        return ,$manifest
    }
    catch {
        Write-Host "    Info: Konnte Remote-Manifest nicht lesen (Verzeichnis evtl. neu)" -ForegroundColor DarkGray
        return ,@()
    }
}

# -----------------------------------------------------------------------------
# Compare-Manifests: Vergleicht lokales und remote Manifest
# -----------------------------------------------------------------------------

function Compare-Manifests {
    param(
        [Parameter(Mandatory=$true)]
        [AllowNull()]
        [AllowEmptyCollection()]
        $LocalManifest,
        
        [Parameter(Mandatory=$true)]
        [AllowNull()]
        [AllowEmptyCollection()]
        $RemoteManifest
    )
    
    # Null-Safety: Sicherstellen dass wir mit Arrays arbeiten
    if ($null -eq $LocalManifest) { $LocalManifest = @() }
    if ($null -eq $RemoteManifest) { $RemoteManifest = @() }
    
    # Hashmaps fuer schnellen Zugriff
    $localMap = @{}
    foreach ($item in $LocalManifest) {
        if ($null -ne $item) { $localMap[$item.path] = $item }
    }
    
    $remoteMap = @{}
    foreach ($item in $RemoteManifest) {
        if ($null -ne $item) { $remoteMap[$item.path] = $item }
    }
    
    $newFiles = @()
    $changedFiles = @()
    $deletedFiles = @()
    
    # Neue und geaenderte Dateien finden
    foreach ($path in $localMap.Keys) {
        if (-not $remoteMap.ContainsKey($path)) {
            $newFiles += $path
        }
        else {
            $local = $localMap[$path]
            $remote = $remoteMap[$path]
            # Geaendert wenn Groesse oder mtime unterschiedlich
            if ($local.size -ne $remote.size -or $local.mtime -ne $remote.mtime) {
                $changedFiles += $path
            }
        }
    }
    
    # Geloeschte Dateien finden (auf Remote, nicht mehr lokal)
    foreach ($path in $remoteMap.Keys) {
        if (-not $localMap.ContainsKey($path)) {
            $deletedFiles += $path
        }
    }
    
    # Zusammenfassung erstellen
    $summaryLines = @()
    $summaryLines += "    Dateien lokal: $($LocalManifest.Count), remote: $($RemoteManifest.Count)"
    $summaryLines += "    Neu: $($newFiles.Count), Geaendert: $($changedFiles.Count), Geloescht: $($deletedFiles.Count)"
    
    # Beispieldateien anzeigen (max 3 pro Kategorie)
    if ($newFiles.Count -gt 0) {
        $examples = ($newFiles | Select-Object -First 3) -join ", "
        if ($newFiles.Count -gt 3) { $examples += ", ..." }
        $summaryLines += "      + Neu: $examples"
    }
    if ($changedFiles.Count -gt 0) {
        $examples = ($changedFiles | Select-Object -First 3) -join ", "
        if ($changedFiles.Count -gt 3) { $examples += ", ..." }
        $summaryLines += "      ~ Geaendert: $examples"
    }
    if ($deletedFiles.Count -gt 0) {
        $examples = ($deletedFiles | Select-Object -First 3) -join ", "
        if ($deletedFiles.Count -gt 3) { $examples += ", ..." }
        $summaryLines += "      - Geloescht: $examples"
    }
    
    $summary = $summaryLines -join "`n"
    
    return [PSCustomObject]@{
        New        = $newFiles
        Changed    = $changedFiles
        Deleted    = $deletedFiles
        Summary    = $summary
        HasChanges = ($newFiles.Count -gt 0 -or $changedFiles.Count -gt 0 -or $deletedFiles.Count -gt 0)
    }
}

# -----------------------------------------------------------------------------
# Sync-DirTarBase64: Synchronisiert Verzeichnis via tar+base64+SSH (Fallback)
# -----------------------------------------------------------------------------

function Sync-DirTarBase64 {
    param(
        [Parameter(Mandatory=$true)]
        [string]$LocalBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName,
        
        [Parameter(Mandatory=$true)]
        [string]$RemoteBasePath
    )
    
    $tarFile = Join-Path $env:TEMP "$DirName.tar.gz"
    
    try {
        # Zum Basisverzeichnis wechseln
        Push-Location $LocalBasePath
        
        # tar erstellen
        & tar -czf $tarFile $DirName 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "tar-Erstellung fehlgeschlagen fuer $DirName"
        }
        
        $sizeMB = [math]::Round((Get-Item $tarFile).Length / 1MB, 2)
        Write-Host "    [tar+base64] Uploading ($sizeMB MB)..." -ForegroundColor DarkGray
        
        # base64-encode und via SSH uebertragen
        # Verwende Windows OpenSSH mit dem passwortlosen Deploy-Key
        $sshExe = $script:SyncConfig.WindowsSSHPath
        $sshArgs = @(
            "-i", $script:SyncConfig.SSHKeyPathFull,
            "-o", "StrictHostKeyChecking=no",
            "-o", "ServerAliveInterval=60",
            "-o", "ServerAliveCountMax=3",
            "$($script:SyncConfig.ServerUser)@$($script:SyncConfig.ServerHost)",
            "python3 -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' > /tmp/$DirName.tar.gz && cd $RemoteBasePath && tar -xzf /tmp/$DirName.tar.gz && rm /tmp/$DirName.tar.gz"
        )
        
        # Python fuer base64-Encoding
        $base64Data = & python -c "import base64; print(base64.b64encode(open(r'$tarFile','rb').read()).decode())"
        if ($LASTEXITCODE -ne 0) {
            throw "base64-Encoding fehlgeschlagen"
        }
        
        $base64Data | & $sshExe @sshArgs
        if ($LASTEXITCODE -ne 0) {
            throw "SSH-Upload fehlgeschlagen fuer $DirName"
        }
        
        Write-Host "    [tar+base64] $DirName - OK" -ForegroundColor Green
        
    }
    finally {
        Pop-Location
        # Aufraeumen
        if (Test-Path $tarFile) {
            Remove-Item $tarFile -ErrorAction SilentlyContinue
        }
    }
}

# -----------------------------------------------------------------------------
# Update-RemoteManifest: Aktualisiert das Manifest auf dem Server
# Verwendet verzeichnisspezifischen Pfad: $RemoteBasePath/$DirName/.sync_state/
# Gibt $true bei Erfolg, $false bei Fehler zurueck (kein throw)
# Bei grossen Manifests wird das JSON in eine temporaere Datei geschrieben
# und dann via SCP/rsync uebertragen
# -----------------------------------------------------------------------------

function Update-RemoteManifest {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RemoteBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName,
        
        [Parameter(Mandatory=$true)]
        [AllowEmptyCollection()]
        [array]$Manifest
    )
    
    # NEUER verzeichnisspezifischer Pfad
    $syncStateDir = "$RemoteBasePath/$DirName/.sync_state"
    $manifestFile = "$syncStateDir/${DirName}_manifest.json"
    
    $json = $Manifest | ConvertTo-Json -Compress
    if ([string]::IsNullOrEmpty($json) -or $json -eq "null") {
        $json = "[]"
    }
    
    # Bei grossen Manifests (>7KB) via temporaere Datei + rsync uebertragen
    # Windows-Limit ist ca. 8191 Zeichen
    $MAX_INLINE_SIZE = 7000
    
    try {
        # Ensure .sync_state directory exists
        Invoke-SSHCommand -Command "mkdir -p '$syncStateDir'" -NoThrow | Out-Null
        
        if ($json.Length -lt $MAX_INLINE_SIZE) {
            # Kleines Manifest: inline via echo
            $escapedJson = $json -replace "'", "'\\''"
            $command = "echo '$escapedJson' > '$manifestFile'"
            $result = Invoke-SSHCommand -Command $command -NoThrow
            return [bool]$result
        }
        else {
            # Grosses Manifest: via temporaere Datei + rsync
            Write-VerboseSync "    Info: Grosses Manifest ($($json.Length) bytes) - uebertrage via rsync"
            
            $tempFile = Join-Path $env:TEMP "${DirName}_manifest.json"
            try {
                # Schreibe Manifest in temporaere Datei
                $json | Out-File -FilePath $tempFile -Encoding utf8 -NoNewline
                
                # Konvertiere Pfad fuer rsync
                $rsyncSource = Convert-ToRsyncPath $tempFile
                
                # rsync SSH-Optionen
                $sshKeyCygwin = Convert-ToRsyncPath $script:SyncConfig.SSHKeyPath -PreserveShortName
                $sshCmd = "ssh -i '$sshKeyCygwin' -o StrictHostKeyChecking=no -o ServerAliveInterval=60"
                
                $server = "$($script:SyncConfig.ServerUser)@$($script:SyncConfig.ServerHost)"
                
                # rsync ausfuehren
                & rsync -avz -e $sshCmd "$rsyncSource" "${server}:$manifestFile" 2>&1 | Out-Null
                $result = ($LASTEXITCODE -eq 0)
                return $result
            }
            finally {
                # Aufraeumen
                if (Test-Path $tempFile) {
                    Remove-Item $tempFile -ErrorAction SilentlyContinue
                }
            }
        }
    }
    catch {
        Write-Host "    WARNUNG: Manifest-Update fuer $DirName fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Yellow
        return $false
    }
}

# -----------------------------------------------------------------------------
# Sync-DirectoryWithDiff: Vollstaendiger Sync mit Diff-Vorschau
# Gibt ein Objekt mit RsyncSuccess und ManifestSuccess zurueck
# Bei Force=true werden alle Dateien uebertragen (--ignore-times)
# -----------------------------------------------------------------------------

function Sync-DirectoryWithDiff {
    param(
        [Parameter(Mandatory=$true)]
        [string]$LocalBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$RemoteBasePath,
        
        [Parameter(Mandatory=$true)]
        [string]$DirName,
        
        [switch]$SkipIfNoChanges,
        
        [switch]$ForceTarFallback,
        
        [switch]$Force
    )
    
    $result = [PSCustomObject]@{
        DirName         = $DirName
        RsyncSuccess    = $false
        ManifestSuccess = $false
        Skipped         = $false
    }
    
    Write-Host ""
    Write-Host "[$DirName]" -ForegroundColor Cyan
    
    # Force-Modus Hinweis
    if ($Force) {
        Write-Host "  FORCE-MODUS aktiv - alle Dateien werden uebertragen" -ForegroundColor Yellow
    }
    
    # SCHRITT 1: Manifest-Migration pruefen (globale -> verzeichnisspezifische)
    Test-And-MigrateManifest -RemoteBasePath $RemoteBasePath -DirName $DirName
    
    # SCHRITT 2: Abbruch-Erkennung - warnt bei unterbrochenem vorherigen Sync
    Test-AndWarnIfPreviousSyncAborted -RemoteBasePath $RemoteBasePath -DirName $DirName
    
    Write-Host "  Analysiere Aenderungen..." -ForegroundColor DarkGray
    
    # Lokales Manifest erzeugen
    $localManifest = New-DirectoryManifest -BasePath $LocalBasePath -DirName $DirName
    $localFileCount = $localManifest.Count
    
    # Lokale Groesse berechnen
    $localPath = Join-Path $LocalBasePath $DirName
    $localTotalSize = Get-LocalDirectorySize -Path $localPath
    
    # Remote Manifest lesen (Fehler hier sind nicht kritisch)
    $remoteManifest = Get-RemoteManifest -RemoteBasePath $RemoteBasePath -DirName $DirName
    
    # Vergleichen
    $diff = Compare-Manifests -LocalManifest $localManifest -RemoteManifest $remoteManifest
    
    # Diff-Zusammenfassung ausgeben
    Write-Host ""
    Write-Host "  Diff-Zusammenfassung:" -ForegroundColor Yellow
    Write-Host $diff.Summary
    Write-Host ""
    
    # Optional: Ueberspringen wenn keine Aenderungen (ausser bei Force)
    if ($SkipIfNoChanges -and -not $diff.HasChanges -and -not $Force) {
        Write-Host "  Status: Keine Aenderungen - uebersprungen" -ForegroundColor Green
        $result.Skipped = $true
        $result.RsyncSuccess = $true
        $result.ManifestSuccess = $true
        return $result
    }
    
    # Transport-Methode waehlen: rsync bevorzugt, tar+base64 als Fallback
    $useRsync = (Test-RsyncAvailable) -and (-not $ForceTarFallback)
    
    # Groesse formatieren
    $sizeStr = Format-FileSize $localTotalSize
    
    if ($useRsync) {
        Write-Host "  Starte Sync fuer $DirName : $localFileCount Dateien, Gesamtgroesse: $sizeStr" -ForegroundColor DarkGray
        Write-Host "  Methode: rsync mit Fortschrittsanzeige" -ForegroundColor DarkGray
    }
    else {
        Write-Host "  Starte Upload (tar+base64 Fallback)..." -ForegroundColor DarkGray
    }
    
    # SCHRITT 3: Sync-Start-Marker setzen (fuer Abbruch-Erkennung)
    Set-SyncStartMarker -RemoteBasePath $RemoteBasePath -DirName $DirName
    
    # Rsync/Upload - kritischer Schritt
    try {
        if ($useRsync) {
            $rsyncResult = Sync-DirectoryWithRsync `
                -LocalBasePath $LocalBasePath `
                -RemoteBasePath $RemoteBasePath `
                -DirName $DirName `
                -LocalFileCount $localFileCount `
                -LocalTotalSize $localTotalSize `
                -Force:$Force
        }
        else {
            Sync-DirTarBase64 `
                -LocalBasePath $LocalBasePath `
                -DirName $DirName `
                -RemoteBasePath $RemoteBasePath
        }
        
        $result.RsyncSuccess = $true
        Write-Host "  Daten-Sync: OK" -ForegroundColor Green
    }
    catch {
        Write-Host "  Daten-Sync: FEHLER" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
        $result.RsyncSuccess = $false
        # Bei rsync-Fehler direkt zurueckgeben - nicht weiter versuchen
        # Sync-Start-Marker bleibt bestehen -> Warnung beim naechsten Lauf
        return $result
    }
    
    # SCHRITT 4: Manifest-Update - NUR bei erfolgreichem rsync
    # Dies ist kritisch: Manifest darf nur aktualisiert werden wenn rsync OK war
    $result.ManifestSuccess = Update-RemoteManifest -RemoteBasePath $RemoteBasePath -DirName $DirName -Manifest $localManifest
    
    # SCHRITT 5: Sync-Start-Marker entfernen nach erfolgreichem Sync
    Remove-SyncStartMarker -RemoteBasePath $RemoteBasePath -DirName $DirName
    
    if ($result.ManifestSuccess) {
        Write-Host "  Status: OK" -ForegroundColor Green
    }
    else {
        Write-Host "  Status: Daten synchronisiert (Manifest-Update fehlgeschlagen)" -ForegroundColor Yellow
    }
    
    return $result
}

# -----------------------------------------------------------------------------
# Set-RemoteOwnership: Setzt Besitzer auf dem Server
# Gibt $true bei Erfolg, $false bei Fehler zurueck (kein throw)
# -----------------------------------------------------------------------------

function Set-RemoteOwnership {
    param(
        [Parameter(Mandatory=$true)]
        [string]$RemotePath
    )
    
    $uid = $script:SyncConfig.AppUid
    $gid = $script:SyncConfig.AppGid
    
    Write-Host ""
    Write-Host "Setze Besitzer auf $RemotePath..." -ForegroundColor Cyan
    
    $result = Invoke-SSHCommand -Command "chown -R ${uid}:${gid} '$RemotePath'" -NoThrow
    if ($result) {
        Write-Host "  Ownership: ${uid}:${gid} - OK" -ForegroundColor Green
        return $true
    }
    else {
        Write-Host "  WARNUNG: Ownership-Aenderung fehlgeschlagen" -ForegroundColor Yellow
        return $false
    }
}
