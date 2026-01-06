<#
.SYNOPSIS
    Uploads a content release to production server via rsync

.DESCRIPTION
    This script wraps rsync for uploading quiz content releases.
    
    ⚠️  REPO-ONLY SCRIPT - NO SERVER EXECUTION
    This script runs on your local machine, not on the server.
    
    Features:
    - Dry-run by default (safe)
    - Validates local paths
    - Structured logging
    - Production-safe (no accidental deletions)

.PARAMETER ReleaseId
    Release identifier (format: YYYY-MM-DD_HHMM)
    Example: "2026-01-06_1430"

.PARAMETER LocalPath
    Local path to release content (absolute path)
    Must contain: units/ and audio/ subdirectories
    Example: "C:\content\games_hispanistica\2026-01-06_1430"

.PARAMETER ServerUser
    SSH username for server access
    Example: "ftacke"

.PARAMETER ServerHost
    Server hostname or IP
    Example: "marele.online.uni-marburg.de"

.PARAMETER ServerBasePath
    Base path on server (default: /srv/webapps/games_hispanistica/media/releases)

.PARAMETER Execute
    Actually perform upload (without this, only dry-run)

.PARAMETER Delete
    Use rsync --delete flag (DANGEROUS - removes files not in source)
    Only use if you understand the implications

.EXAMPLE
    # Dry-run (safe, shows what would be uploaded)
    .\sync_release.ps1 `
        -ReleaseId "2026-01-06_1430" `
        -LocalPath "C:\content\games_hispanistica\2026-01-06_1430" `
        -ServerUser "ftacke" `
        -ServerHost "marele.online.uni-marburg.de"

.EXAMPLE
    # Real upload
    .\sync_release.ps1 `
        -ReleaseId "2026-01-06_1430" `
        -LocalPath "C:\content\games_hispanistica\2026-01-06_1430" `
        -ServerUser "ftacke" `
        -ServerHost "marele.online.uni-marburg.de" `
        -Execute

.NOTES
    Requirements:
    - rsync must be installed (via WSL, Cygwin, or native Windows rsync)
    - SSH access to server
    - SSH key authentication recommended (no password prompts)
    
    See also:
    - games_hispanistica_production.md (full production documentation)
    - scripts/content_release/README.md (workflow documentation)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^\d{4}-\d{2}-\d{2}_\d{4}$')]
    [string]$ReleaseId,

    [Parameter(Mandatory=$true)]
    [ValidateScript({Test-Path $_ -PathType Container})]
    [string]$LocalPath,

    [Parameter(Mandatory=$true)]
    [string]$ServerUser,

    [Parameter(Mandatory=$true)]
    [string]$ServerHost,

    [Parameter(Mandatory=$false)]
    [string]$ServerBasePath = "/srv/webapps/games_hispanistica/media/releases",

    [Parameter(Mandatory=$false)]
    [switch]$Execute,

    [Parameter(Mandatory=$false)]
    [switch]$Delete
)

# --- Script Configuration ---
$ErrorActionPreference = "Stop"

# --- Helper Functions ---
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] ${Level}: $Message" -ForegroundColor $color
}

function Test-RsyncAvailable {
    try {
        $null = Get-Command rsync -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Test-ReleaseStructure {
    param([string]$Path)
    
    $requiredDirs = @("units", "audio")
    $missing = @()
    
    foreach ($dir in $requiredDirs) {
        $fullPath = Join-Path $Path $dir
        if (-not (Test-Path $fullPath -PathType Container)) {
            $missing += $dir
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Log "Missing required directories: $($missing -join ', ')" -Level "ERROR"
        return $false
    }
    
    return $true
}

# --- Validation ---
Write-Log "Starting content release upload"
Write-Log "Release ID: $ReleaseId"
Write-Log "Local Path: $LocalPath"
Write-Log "Server: $ServerUser@$ServerHost"
Write-Log "Mode: $(if ($Execute) { 'EXECUTE' } else { 'DRY-RUN' })"

# Check rsync availability
if (-not (Test-RsyncAvailable)) {
    Write-Log "rsync not found. Please install rsync (via WSL, Cygwin, or native Windows)" -Level "ERROR"
    exit 1
}

# Validate local structure
Write-Log "Validating local release structure..."
if (-not (Test-ReleaseStructure -Path $LocalPath)) {
    Write-Log "Release structure validation failed" -Level "ERROR"
    Write-Log "Expected structure: $LocalPath/units/ and $LocalPath/audio/" -Level "ERROR"
    exit 1
}
Write-Log "Release structure valid" -Level "SUCCESS"

# --- Build rsync Command ---
$targetPath = "$ServerUser@${ServerHost}:$ServerBasePath/$ReleaseId/"

# Convert Windows path to Unix-style for rsync (handle backslashes)
$localPathUnix = $LocalPath -replace '\\', '/'
# Ensure trailing slash (important for rsync behavior)
if (-not $localPathUnix.EndsWith('/')) {
    $localPathUnix += '/'
}

# Build rsync arguments
$rsyncArgs = @(
    "-avz"          # Archive mode, verbose, compress
    "--progress"    # Show progress per file
)

if (-not $Execute) {
    $rsyncArgs += "--dry-run"
}

if ($Delete) {
    Write-Log "⚠️  --delete flag enabled (will remove files not in source)" -Level "WARN"
    $rsyncArgs += "--delete"
}

$rsyncArgs += $localPathUnix
$rsyncArgs += $targetPath

# --- Display Command ---
Write-Log "rsync command:"
Write-Host "  rsync $($rsyncArgs -join ' ')" -ForegroundColor Cyan

# --- Confirmation for Execute ---
if ($Execute -and -not $Delete) {
    Write-Log "Ready to upload. Press Enter to continue or Ctrl+C to abort..." -Level "WARN"
    Read-Host
}
elseif ($Execute -and $Delete) {
    Write-Log "⚠️  DANGEROUS: Execute mode with --delete enabled!" -Level "ERROR"
    Write-Log "This will DELETE files on server not present locally!" -Level "ERROR"
    Write-Log "Type 'YES DELETE' to continue or Ctrl+C to abort..." -Level "WARN"
    $confirmation = Read-Host
    if ($confirmation -ne "YES DELETE") {
        Write-Log "Upload aborted by user" -Level "WARN"
        exit 0
    }
}

# --- Execute rsync ---
Write-Log "Starting rsync..."
try {
    & rsync @rsyncArgs
    
    if ($LASTEXITCODE -eq 0) {
        if ($Execute) {
            Write-Log "✓ Upload completed successfully" -Level "SUCCESS"
            Write-Log ""
            Write-Log "Next steps (on server):" -Level "SUCCESS"
            Write-Log "  1. SSH into server: ssh $ServerUser@$ServerHost"
            Write-Log "  2. Set symlink: cd /srv/webapps/games_hispanistica/media && ln -sfn releases/$ReleaseId current"
            Write-Log "  3. Import: ./manage import-content --release $ReleaseId"
            Write-Log "  4. Publish: ./manage publish-release --release $ReleaseId"
        }
        else {
            Write-Log "✓ Dry-run completed successfully" -Level "SUCCESS"
            Write-Log "  Run with -Execute flag to perform real upload"
        }
    }
    else {
        Write-Log "rsync failed with exit code: $LASTEXITCODE" -Level "ERROR"
        exit $LASTEXITCODE
    }
}
catch {
    Write-Log "rsync execution failed: $_" -Level "ERROR"
    exit 1
}
