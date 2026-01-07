#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Debug script for content release upload issues

.DESCRIPTION
    Validates release structure and connectivity before upload
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ReleaseId,

    [Parameter(Mandatory=$true)]
    [string]$LocalPath,

    [Parameter(Mandatory=$true)]
    [string]$ServerUser,

    [Parameter(Mandatory=$true)]
    [string]$ServerHost,

    [Parameter(Mandatory=$false)]
    [string]$ServerBasePath = "/srv/webapps/games_hispanistica/media"
)

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "SUCCESS" { "Green" }
        "DEBUG" { "Cyan" }
        default { "White" }
    }
    Write-Host "[$timestamp] ${Level}: $Message" -ForegroundColor $color
}

Write-Log "=== Content Release Upload Debugger ===" -Level "DEBUG"
Write-Log ""
Write-Log "Configuration:" -Level "DEBUG"
Write-Log "  Release ID: $ReleaseId"
Write-Log "  Local Path: $LocalPath"
Write-Log "  Server: $ServerUser@$ServerHost"
Write-Log "  Server Base Path: $ServerBasePath"
Write-Log ""

# --- Step 1: Local Path Validation ---
Write-Log "STEP 1: Validating local release structure..." -Level "DEBUG"

if (-not (Test-Path $LocalPath -PathType Container)) {
    Write-Log "❌ Local path does not exist: $LocalPath" -Level "ERROR"
    exit 1
}
Write-Log "✓ Local path exists" -Level "SUCCESS"

# Check required directories
$requiredDirs = @("units", "audio")
foreach ($dir in $requiredDirs) {
    $fullPath = Join-Path $LocalPath $dir
    if (Test-Path $fullPath -PathType Container) {
        $fileCount = (Get-ChildItem $fullPath -Recurse -File).Count
        Write-Log "✓ $dir/ exists ($fileCount files)" -Level "SUCCESS"
    } else {
        Write-Log "❌ Missing required directory: $dir/" -Level "ERROR"
        exit 1
    }
}

# Check JSON files
$jsonCount = (Get-ChildItem (Join-Path $LocalPath "units") -Filter "*.json" -File).Count
if ($jsonCount -gt 0) {
    Write-Log "✓ Found $jsonCount JSON unit files" -Level "SUCCESS"
} else {
    Write-Log "⚠️  No JSON files found in units/" -Level "WARN"
}

# Sample JSON structure
$jsonFiles = Get-ChildItem (Join-Path $LocalPath "units") -Filter "*.json" -File
if ($jsonFiles.Count -gt 0) {
    $firstJson = $jsonFiles[0]
    Write-Log "Sample JSON structure ($($firstJson.Name)):" -Level "DEBUG"
    try {
        $content = Get-Content $firstJson.FullName | ConvertFrom-Json
        Write-Log "  - slug: $($content.slug)" -Level "DEBUG"
        Write-Log "  - questions: $($content.questions.Count)" -Level "DEBUG"
    } catch {
        Write-Log "❌ JSON parsing failed: $_" -Level "ERROR"
        exit 1
    }
}

Write-Log ""

# --- Step 2: SSH Connectivity ---
Write-Log "STEP 2: Testing SSH connectivity..." -Level "DEBUG"

try {
    # Simple SSH command: test if we can list the target directory
    $testCmd = "ls -la $ServerBasePath 2>&1"
    $output = ssh ${ServerUser}@${ServerHost} $testCmd 2>&1
    
    if ($?) {
        Write-Log "✓ SSH connection successful" -Level "SUCCESS"
        Write-Log "Server base path contents:" -Level "DEBUG"
        $output | ForEach-Object { Write-Log "  $_" -Level "DEBUG" }
    } else {
        Write-Log "❌ SSH command failed" -Level "ERROR"
        Write-Log "Output: $output" -Level "ERROR"
        exit 1
    }
} catch {
    Write-Log "❌ SSH connection error: $_" -Level "ERROR"
    Write-Log "Make sure:" -Level "WARN"
    Write-Log "  1. SSH is configured for passwordless access"
    Write-Log "  2. You can connect: ssh $ServerUser@$ServerHost" -Level "WARN"
    Write-Log "  3. Check your SSH key setup" -Level "WARN"
    exit 1
}

Write-Log ""

# --- Step 3: Rsync Validation ---
Write-Log "STEP 3: Validating rsync..." -Level "DEBUG"

if (-not (Get-Command rsync -ErrorAction SilentlyContinue)) {
    Write-Log "❌ rsync not found" -Level "ERROR"
    Write-Log "Install via: WSL, Cygwin, or native Windows rsync" -Level "WARN"
    exit 1
}
Write-Log "✓ rsync is installed" -Level "SUCCESS"

# --- Step 4: Rsync Dry-Run ---
Write-Log ""
Write-Log "STEP 4: Running rsync dry-run..." -Level "DEBUG"

$localPathUnix = $LocalPath -replace '\\', '/'
if (-not $localPathUnix.EndsWith('/')) {
    $localPathUnix += '/'
}

$targetPath = "${ServerUser}@${ServerHost}:${ServerBasePath}/${ReleaseId}/"

Write-Log "Source: $localPathUnix" -Level "DEBUG"
Write-Log "Target: $targetPath" -Level "DEBUG"
Write-Log ""

$rsyncArgs = @(
    "-avz"
    "--progress"
    "--dry-run"
    $localPathUnix
    $targetPath
)

Write-Log "Running: rsync $($rsyncArgs -join ' ')" -Level "DEBUG"
Write-Log ""

try {
    & rsync @rsyncArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log ""
        Write-Log "✓ Rsync dry-run successful" -Level "SUCCESS"
        Write-Log "Ready to perform real upload with -Execute flag" -Level "SUCCESS"
    } else {
        Write-Log ""
        Write-Log "❌ Rsync dry-run failed with exit code: $LASTEXITCODE" -Level "ERROR"
        exit $LASTEXITCODE
    }
} catch {
    Write-Log ""
    Write-Log "❌ Rsync execution failed: $_" -Level "ERROR"
    exit 1
}

Write-Log ""
Write-Log "=== Debug Summary ===" -Level "DEBUG"
Write-Log "✓ Local release structure is valid" -Level "SUCCESS"
Write-Log "✓ SSH connectivity works" -Level "SUCCESS"
Write-Log "✓ Rsync is configured correctly" -Level "SUCCESS"
Write-Log ""
Write-Log "Next: Run sync_release.ps1 with -Execute flag" -Level "SUCCESS"
