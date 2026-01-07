# Add this to your PowerShell profile or run directly

function Release-Upload {
    <#
    .SYNOPSIS
        Quick release upload helper function
    
    .DESCRIPTION
        Uploads a release with simple parameter handling
        
    .EXAMPLE
        Release-Upload -Id "20260106_2200" -DryRun
        Release-Upload -Id "20260106_2200" -Execute
    #>
    
    param(
        [Parameter(Mandatory=$true)]
        [string]$Id,
        
        [Parameter(Mandatory=$false)]
        [string]$ContentRoot = "C:\content\quiz_releases",
        
        [Parameter(Mandatory=$false)]
        [string]$ServerUser = "root",
        
        [Parameter(Mandatory=$false)]
        [string]$ServerHost = "games.hispanistica.com",
        
        [Parameter(Mandatory=$false)]
        [string]$ServerBasePath = "/srv/webapps/games_hispanistica/media",
        
        [switch]$DryRun,
        [switch]$Execute
    )
    
    if (-not $DryRun -and -not $Execute) {
        Write-Host "Usage:" -ForegroundColor Cyan
        Write-Host "  Release-Upload -Id 20260106_2200 -DryRun    # Dry run" 
        Write-Host "  Release-Upload -Id 20260106_2200 -Execute  # Real upload"
        exit
    }
    
    # Build release ID with prefix
    if ($Id -match '^\d{8}_\d{4}$') {
        $ReleaseId = "release_$Id"
    } else {
        $ReleaseId = $Id
    }
    
    $LocalPath = Join-Path $ContentRoot $ReleaseId
    
    Write-Host ""
    Write-Host "=== Release Upload Helper ===" -ForegroundColor Cyan
    Write-Host "Release ID: $ReleaseId" -ForegroundColor Yellow
    Write-Host "Local Path: $LocalPath" -ForegroundColor Yellow
    Write-Host "Server: $ServerUser@$ServerHost" -ForegroundColor Yellow
    Write-Host "Mode: $(if ($Execute) { 'EXECUTE' } else { 'DRY-RUN' })" -ForegroundColor Yellow
    Write-Host ""
    
    # Validate local path
    if (-not (Test-Path $LocalPath -PathType Container)) {
        Write-Host "ERROR: Release directory not found!" -ForegroundColor Red
        Write-Host "Expected: $LocalPath" -ForegroundColor Red
        exit 1
    }
    
    # Validate structure
    $unitsPath = Join-Path $LocalPath "units"
    $audioPath = Join-Path $LocalPath "audio"
    
    if (-not (Test-Path $unitsPath -PathType Container)) {
        Write-Host "ERROR: units/ directory missing!" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Test-Path $audioPath -PathType Container)) {
        Write-Host "WARNING: audio/ directory missing (may be OK)" -ForegroundColor Yellow
    }
    
    # Call sync_release script
    $scriptPath = ".\scripts\content_release\sync_release.ps1"
    
    if (-not (Test-Path $scriptPath)) {
        Write-Host "ERROR: sync_release.ps1 not found!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Starting upload..." -ForegroundColor Green
    Write-Host ""
    
    if ($Execute) {
        & $scriptPath `
            -ReleaseId $ReleaseId `
            -LocalPath $LocalPath `
            -ServerUser $ServerUser `
            -ServerHost $ServerHost `
            -ServerBasePath $ServerBasePath `
            -Execute
    } else {
        & $scriptPath `
            -ReleaseId $ReleaseId `
            -LocalPath $LocalPath `
            -ServerUser $ServerUser `
            -ServerHost $ServerHost `
            -ServerBasePath $ServerBasePath
    }
}

# Alias for shorter typing
Set-Alias -Name rupload -Value Release-Upload -Force

Write-Host "Release-Upload function loaded. Usage:" -ForegroundColor Green
Write-Host "  rupload -Id 20260106_2200 -DryRun" -ForegroundColor Cyan
Write-Host "  rupload -Id 20260106_2200 -Execute" -ForegroundColor Cyan
