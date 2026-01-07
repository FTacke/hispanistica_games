<#
.SYNOPSIS
    Interactive release upload wrapper

.DESCRIPTION
    Guides you through uploading a release

.PARAMETER ReleaseId
    Release identifier

.PARAMETER ReleaseRoot
    Root directory (default: .\content\quiz_releases)

.PARAMETER ServerUser
    SSH username (default: root)

.PARAMETER ServerHost
    Server hostname (default: games.hispanistica.com)

.PARAMETER ServerBasePath
    Server path (default: /srv/webapps/games_hispanistica/media)

.PARAMETER NonInteractive
    CI mode: no prompts

.PARAMETER Force
    Auto-confirm all prompts
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$ReleaseId,

    [Parameter(Mandatory=$false)]
    [string]$ReleaseRoot = ".\content\quiz_releases",

    [Parameter(Mandatory=$false)]
    [string]$ServerUser = "root",

    [Parameter(Mandatory=$false)]
    [string]$ServerHost = "games.hispanistica.com",

    [Parameter(Mandatory=$false)]
    [string]$ServerBasePath = "/srv/webapps/games_hispanistica/media",

    [Parameter(Mandatory=$false)]
    [switch]$NonInteractive,

    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# --- Logging ---
function logInfo($msg) { Write-Host "[$(Get-Date -Format HH:mm:ss)] INFO: $msg" -ForegroundColor Cyan }
function logOK($msg) { Write-Host "[$(Get-Date -Format HH:mm:ss)] OK: $msg" -ForegroundColor Green }
function logWarn($msg) { Write-Host "[$(Get-Date -Format HH:mm:ss)] WARN: $msg" -ForegroundColor Yellow }
function logErr($msg) { Write-Host "[$(Get-Date -Format HH:mm:ss)] ERROR: $msg" -ForegroundColor Red }

# --- Main Script ---
Write-Host ""
logInfo "Release Upload Tool"

# Resolve root
$resolvedRoot = if ([System.IO.Path]::IsPathRooted($ReleaseRoot)) {
    $ReleaseRoot
} else {
    Join-Path (Get-Location).Path $ReleaseRoot
}

if (-not (Test-Path $resolvedRoot -PathType Container)) {
    logErr "Release root not found: $resolvedRoot"
    exit 1
}

logInfo "Release root: $resolvedRoot"

# List releases
$excludes = @("EXAMPLE_RELEASE", ".keep", ".gitkeep", "README.md")
$releaseList = @(Get-ChildItem -Path $resolvedRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { -not ($excludes -contains $_.Name) } |
    Sort-Object Name -Descending |
    ForEach-Object { $_.Name })

if ($releaseList.Count -eq 0) {
    logErr "No releases found"
    exit 1
}

logInfo "Found $($releaseList.Count) release(s)"

# Select release
$selected = $null

if ($ReleaseId) {
    if ($ReleaseId -match '^\d+$') {
        $idx = [int]$ReleaseId - 1
        if ($idx -ge 0 -and $idx -lt $releaseList.Count) {
            $selected = $releaseList[$idx]
        }
    } elseif ($releaseList -contains $ReleaseId) {
        $selected = $ReleaseId
    }
    
    if (-not $selected) {
        logErr "Release not found: $ReleaseId"
        exit 1
    }
} elseif (-not $NonInteractive) {
    Write-Host ""
    Write-Host "Available releases:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $releaseList.Count; $i++) {
        Write-Host "  [$($i+1)] $($releaseList[$i])"
    }
    Write-Host ""
    
    $input = Read-Host "Select [1-$($releaseList.Count)] or name"
    
    if ($input -match '^\d+$') {
        $idx = [int]$input - 1
        if ($idx -ge 0 -and $idx -lt $releaseList.Count) {
            $selected = $releaseList[$idx]
        }
    } elseif ($releaseList -contains $input) {
        $selected = $input
    }
    
    if (-not $selected) {
        logErr "Invalid selection"
        exit 1
    }
} else {
    logErr "No release specified"
    exit 1
}

logOK "Selected: $selected"

# Validate structure
$releasePath = Join-Path $resolvedRoot $selected
$unitsPath = Join-Path $releasePath "units"

if (-not (Test-Path $unitsPath -PathType Container)) {
    logErr "Missing units/ directory"
    exit 1
}

$jsonFiles = @(Get-ChildItem -Path $unitsPath -Filter "*.json" -ErrorAction SilentlyContinue)
if ($jsonFiles.Count -eq 0) {
    logErr "No *.json files in units/"
    exit 1
}

logInfo "Found $($jsonFiles.Count) unit file(s)"

$audioPath = Join-Path $releasePath "audio"
if (Test-Path $audioPath -PathType Container) {
    $audioFiles = @(Get-ChildItem -Path $audioPath -ErrorAction SilentlyContinue)
    logInfo "Found $($audioFiles.Count) audio file(s)"
} else {
    logWarn "No audio/ directory"
}

logOK "Release validation passed"

# Get server config
$srvUser = $ServerUser
$srvHost = $ServerHost
$srvPath = $ServerBasePath

if (-not $NonInteractive) {
    Write-Host ""
    Write-Host "Server Config (Enter for defaults):" -ForegroundColor Cyan
    
    $u = Read-Host "ServerUser [$srvUser]"
    if ($u) { $srvUser = $u }
    
    $h = Read-Host "ServerHost [$srvHost]"
    if ($h) { $srvHost = $h }
    
    $p = Read-Host "ServerBasePath [$srvPath]"
    if ($p) { $srvPath = $p }
}

Write-Host ""
logInfo "Configuration:"
Write-Host "  Release:  $selected"
Write-Host "  Path:     $releasePath"
Write-Host "  Server:   $srvUser@$srvHost"
Write-Host "  Base:     $srvPath"

# DRY-RUN
Write-Host ""
logInfo "=== PHASE 1: DRY-RUN ==="

& ".\scripts\content_release\sync_release.ps1" `
    -ReleaseId $selected `
    -LocalPath $releasePath `
    -ServerUser $srvUser `
    -ServerHost $srvHost `
    -ServerBasePath $srvPath

if ($LASTEXITCODE -ne 0) {
    logErr "Dry-run failed"
    exit 1
}

# Ask to execute
$doExecute = $false

if ($Force) {
    $doExecute = $true
} else {
    Write-Host ""
    $response = Read-Host "Execute upload now? (y/N)"
    $doExecute = ($response -eq "y" -or $response -eq "Y")
}

if (-not $doExecute) {
    logWarn "Upload cancelled"
    exit 0
}

# EXECUTE
Write-Host ""
logInfo "=== PHASE 2: REAL UPLOAD ==="

& ".\scripts\content_release\sync_release.ps1" `
    -ReleaseId $selected `
    -LocalPath $releasePath `
    -ServerUser $srvUser `
    -ServerHost $srvHost `
    -ServerBasePath $srvPath `
    -Execute

if ($LASTEXITCODE -ne 0) {
    logErr "Upload failed"
    exit 1
}

logOK "Upload completed!"

# Show next steps
Write-Host ""
logInfo "Next steps on server (copy-paste):"
Write-Host ""
Write-Host "# SSH into server:" -ForegroundColor Cyan
Write-Host "ssh $srvUser@$srvHost"
Write-Host ""
Write-Host "# Set symlink:" -ForegroundColor Cyan
Write-Host "cd $srvPath; ln -sfn releases/$selected current"
Write-Host ""
Write-Host "# Import content:" -ForegroundColor Cyan
Write-Host "cd /srv/webapps/games_hispanistica/app; python manage.py import-content --release $selected"
Write-Host ""
Write-Host "# Publish release:" -ForegroundColor Cyan
Write-Host "cd /srv/webapps/games_hispanistica/app; python manage.py publish-release --release $selected"
Write-Host ""

Write-Host ""
logOK "Done!"
