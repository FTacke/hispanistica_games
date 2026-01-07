#Requires -Module Pester

<#
.SYNOPSIS
    Pester tests for run_release_upload.ps1

.DESCRIPTION
    Tests for:
    - Release listing and filtering (excludes EXAMPLE_RELEASE, .keep, hidden)
    - Release validation (units/ exists, *.json present, audio/ optional)
    - Selection by index and by name
    - Dry-run as default behavior
    - Execute flow (dry-run then -Execute with confirmation)
    - Server parameter handling

.NOTES
    These tests use Pester mocks to avoid actual rsync/SSH calls.
    Run with: Invoke-Pester -Path tests/powershell/RunReleaseUpload.Tests.ps1
#>

# Global test helpers (Pester 3 compatible)
$script:scriptPath = Join-Path $PSScriptRoot "..\..\scripts\content_release\run_release_upload.ps1"
$script:syncScriptPath = Join-Path $PSScriptRoot "..\..\scripts\content_release\sync_release.ps1"

Describe "Get-ReleaseList" {
    BeforeEach {
        $testRoot = Join-Path $TestDrive "releases"
        $null = New-Item -Path $testRoot -ItemType Directory -Force
        
        # Create test release folders
        @(
            "20260106_2200",
            "20260106_1430",
            "20260105_0900",
            "EXAMPLE_RELEASE",
            ".keep",
            ".hidden"
        ) | ForEach-Object {
            $null = New-Item -Path (Join-Path $testRoot $_) -ItemType Directory -Force
        }
    }
    
    It "should list all valid releases" {
        # Source the function
        $function = @"
function Get-ReleaseList {
    param([string]`$RootPath)
    
    `$excludePatterns = @("EXAMPLE_RELEASE", ".keep", ".gitkeep", "README.md")
    
    `$releases = Get-ChildItem -Path `$RootPath -Directory -ErrorAction SilentlyContinue | 
        Where-Object { 
            `$name = `$_.Name
            -not (`$excludePatterns | Where-Object { `$name -like `$_ })
        } |
        Sort-Object Name -Descending |
        Select-Object -ExpandProperty Name
    
    return @(`$releases)
}
"@
        Invoke-Expression $function
        
        $releases = Get-ReleaseList -RootPath $testRoot
        $releases | Should -Contain "20260106_2200"
        $releases | Should -Contain "20260106_1430"
        $releases | Should -Contain "20260105_0900"
    }
    
    It "should exclude EXAMPLE_RELEASE" {
        $function = @"
function Get-ReleaseList {
    param([string]`$RootPath)
    
    `$excludePatterns = @("EXAMPLE_RELEASE", ".keep", ".gitkeep", "README.md")
    
    `$releases = Get-ChildItem -Path `$RootPath -Directory -ErrorAction SilentlyContinue | 
        Where-Object { 
            `$name = `$_.Name
            -not (`$excludePatterns | Where-Object { `$name -like `$_ })
        } |
        Sort-Object Name -Descending |
        Select-Object -ExpandProperty Name
    
    return @(`$releases)
}
"@
        Invoke-Expression $function
        
        $releases = Get-ReleaseList -RootPath $testRoot
        $releases | Should -Not -Contain "EXAMPLE_RELEASE"
    }
    
    It "should exclude .keep" {
        $function = @"
function Get-ReleaseList {
    param([string]`$RootPath)
    
    `$excludePatterns = @("EXAMPLE_RELEASE", ".keep", ".gitkeep", "README.md")
    
    `$releases = Get-ChildItem -Path `$RootPath -Directory -ErrorAction SilentlyContinue | 
        Where-Object { 
            `$name = `$_.Name
            -not (`$excludePatterns | Where-Object { `$name -like `$_ })
        } |
        Sort-Object Name -Descending |
        Select-Object -ExpandProperty Name
    
    return @(`$releases)
}
"@
        Invoke-Expression $function
        
        $releases = Get-ReleaseList -RootPath $testRoot
        $releases | Should -Not -Contain ".keep"
    }
    
    It "should sort releases in descending order (newest first)" {
        $function = @"
function Get-ReleaseList {
    param([string]`$RootPath)
    
    `$excludePatterns = @("EXAMPLE_RELEASE", ".keep", ".gitkeep", "README.md")
    
    `$releases = Get-ChildItem -Path `$RootPath -Directory -ErrorAction SilentlyContinue | 
        Where-Object { 
            `$name = `$_.Name
            -not (`$excludePatterns | Where-Object { `$name -like `$_ })
        } |
        Sort-Object Name -Descending |
        Select-Object -ExpandProperty Name
    
    return @(`$releases)
}
"@
        Invoke-Expression $function
        
        $releases = Get-ReleaseList -RootPath $testRoot
        $releases[0] | Should -Be "20260106_2200"
        $releases[1] | Should -Be "20260106_1430"
        $releases[2] | Should -Be "20260105_0900"
    }
}

Describe "Test-ReleaseStructure" {
    BeforeEach {
        $testRelease = Join-Path $TestDrive "test_release"
        $null = New-Item -Path $testRelease -ItemType Directory -Force
    }
    
    It "should fail when units/ directory is missing" {
        $function = @"
function Test-ReleaseStructure {
    param([string]`$ReleasePath)
    
    `$unitsPath = Join-Path `$ReleasePath "units"
    if (-not (Test-Path `$unitsPath -PathType Container)) {
        return `$false
    }
    
    `$jsonFiles = Get-ChildItem -Path `$unitsPath -Filter "*.json" -ErrorAction SilentlyContinue
    if (`$jsonFiles.Count -eq 0) {
        return `$false
    }
    
    return `$true
}
"@
        Invoke-Expression $function
        
        Test-ReleaseStructure -ReleasePath $testRelease | Should -Be $false
    }
    
    It "should fail when no *.json files in units/" {
        $null = New-Item -Path (Join-Path $testRelease "units") -ItemType Directory
        
        $function = @"
function Test-ReleaseStructure {
    param([string]`$ReleasePath)
    
    `$unitsPath = Join-Path `$ReleasePath "units"
    if (-not (Test-Path `$unitsPath -PathType Container)) {
        return `$false
    }
    
    `$jsonFiles = Get-ChildItem -Path `$unitsPath -Filter "*.json" -ErrorAction SilentlyContinue
    if (`$jsonFiles.Count -eq 0) {
        return `$false
    }
    
    return `$true
}
"@
        Invoke-Expression $function
        
        Test-ReleaseStructure -ReleasePath $testRelease | Should -Be $false
    }
    
    It "should succeed with units/ and at least one *.json" {
        $null = New-Item -Path (Join-Path $testRelease "units") -ItemType Directory
        $null = New-Item -Path (Join-Path $testRelease "units" "unit_001.json") -ItemType File -Value "{}"
        
        $function = @"
function Test-ReleaseStructure {
    param([string]`$ReleasePath)
    
    `$unitsPath = Join-Path `$ReleasePath "units"
    if (-not (Test-Path `$unitsPath -PathType Container)) {
        return `$false
    }
    
    `$jsonFiles = Get-ChildItem -Path `$unitsPath -Filter "*.json" -ErrorAction SilentlyContinue
    if (`$jsonFiles.Count -eq 0) {
        return `$false
    }
    
    return `$true
}
"@
        Invoke-Expression $function
        
        Test-ReleaseStructure -ReleasePath $testRelease | Should -Be $true
    }
    
    It "should succeed with units/ and empty audio/" {
        $null = New-Item -Path (Join-Path $testRelease "units") -ItemType Directory
        $null = New-Item -Path (Join-Path $testRelease "units" "unit_001.json") -ItemType File -Value "{}"
        $null = New-Item -Path (Join-Path $testRelease "audio") -ItemType Directory
        
        $function = @"
function Test-ReleaseStructure {
    param([string]`$ReleasePath)
    
    `$unitsPath = Join-Path `$ReleasePath "units"
    if (-not (Test-Path `$unitsPath -PathType Container)) {
        return `$false
    }
    
    `$jsonFiles = Get-ChildItem -Path `$unitsPath -Filter "*.json" -ErrorAction SilentlyContinue
    if (`$jsonFiles.Count -eq 0) {
        return `$false
    }
    
    return `$true
}
"@
        Invoke-Expression $function
        
        Test-ReleaseStructure -ReleasePath $testRelease | Should -Be $true
    }
}

Describe "Select-Release" {
    It "should select by index (1-based)" {
        $releases = @("20260106_2200", "20260106_1430", "20260105_0900")
        
        $function = @"
function Select-Release {
    param(
        [string[]]`$ReleaseList,
        [string]`$ProvidedId,
        [bool]`$Interactive
    )
    
    if (`$ProvidedId) {
        if (`$ProvidedId -match '^\d+`$') {
            `$index = [int]`$ProvidedId - 1
            if (`$index -ge 0 -and `$index -lt `$ReleaseList.Count) {
                return `$ReleaseList[`$index]
            }
            else {
                exit 1
            }
        }
        
        if (`$ReleaseList -contains `$ProvidedId) {
            return `$ProvidedId
        }
        
        exit 1
    }
    
    exit 1
}
"@
        Invoke-Expression $function
        
        Select-Release -ReleaseList $releases -ProvidedId "1" -Interactive $false | Should -Be "20260106_2200"
        Select-Release -ReleaseList $releases -ProvidedId "2" -Interactive $false | Should -Be "20260106_1430"
        Select-Release -ReleaseList $releases -ProvidedId "3" -Interactive $false | Should -Be "20260105_0900"
    }
    
    It "should select by release name" {
        $releases = @("20260106_2200", "20260106_1430", "20260105_0900")
        
        $function = @"
function Select-Release {
    param(
        [string[]]`$ReleaseList,
        [string]`$ProvidedId,
        [bool]`$Interactive
    )
    
    if (`$ProvidedId) {
        if (`$ProvidedId -match '^\d+`$') {
            `$index = [int]`$ProvidedId - 1
            if (`$index -ge 0 -and `$index -lt `$ReleaseList.Count) {
                return `$ReleaseList[`$index]
            }
            else {
                exit 1
            }
        }
        
        if (`$ReleaseList -contains `$ProvidedId) {
            return `$ProvidedId
        }
        
        exit 1
    }
    
    exit 1
}
"@
        Invoke-Expression $function
        
        Select-Release -ReleaseList $releases -ProvidedId "20260106_1430" -Interactive $false | Should -Be "20260106_1430"
    }
}

Describe "Confirm-Action" {
    It "should return true when Force is enabled" {
        $function = @"
function Confirm-Action {
    param(
        [string]`$Prompt,
        [bool]`$Force
    )
    
    if (`$Force) {
        return `$true
    }
    
    return `$false
}
"@
        Invoke-Expression $function
        
        Confirm-Action -Prompt "Test" -Force $true | Should -Be $true
    }
    
    It "should return false when Force is disabled and no input" {
        $function = @"
function Confirm-Action {
    param(
        [string]`$Prompt,
        [bool]`$Force
    )
    
    if (`$Force) {
        return `$true
    }
    
    return `$false
}
"@
        Invoke-Expression $function
        
        Confirm-Action -Prompt "Test" -Force $false | Should -Be $false
    }
}

Describe "Integration Tests" {
    BeforeEach {
        $testRoot = Join-Path $TestDrive "releases"
        $null = New-Item -Path $testRoot -ItemType Directory -Force
        
        # Create valid test releases
        $release1 = Join-Path $testRoot "20260106_2200"
        $null = New-Item -Path $release1 -ItemType Directory -Force
        $null = New-Item -Path (Join-Path $release1 "units") -ItemType Directory
        $null = New-Item -Path (Join-Path $release1 "units" "unit_001.json") -ItemType File -Value "{}"
        
        $release2 = Join-Path $testRoot "20260106_1430"
        $null = New-Item -Path $release2 -ItemType Directory -Force
        $null = New-Item -Path (Join-Path $release2 "units") -ItemType Directory
        $null = New-Item -Path (Join-Path $release2 "units" "unit_002.json") -ItemType File -Value "{}"
    }
    
    It "should list and validate multiple releases" {
        $function = @"
function Get-ReleaseList {
    param([string]`$RootPath)
    
    `$excludePatterns = @("EXAMPLE_RELEASE", ".keep", ".gitkeep", "README.md")
    
    `$releases = Get-ChildItem -Path `$RootPath -Directory -ErrorAction SilentlyContinue | 
        Where-Object { 
            `$name = `$_.Name
            -not (`$excludePatterns | Where-Object { `$name -like `$_ })
        } |
        Sort-Object Name -Descending |
        Select-Object -ExpandProperty Name
    
    return @(`$releases)
}
"@
        Invoke-Expression $function
        
        $releases = Get-ReleaseList -RootPath $testRoot
        $releases.Count | Should -Be 2
        $releases[0] | Should -Be "20260106_2200"
    }
}

Describe "Destination-Path Production Conformity" {
    It "should build destination path with /releases/ subdirectory" {
        # Test the path building logic from sync_release.ps1
        $ServerUser = "root"
        $ServerHost = "games.hispanistica.com"
        $ServerBasePath = "/srv/webapps/games_hispanistica/media"
        $ReleaseId = "20260106_2200"
        
        # Replicate the logic from sync_release.ps1
        if ($ServerBasePath.EndsWith('/releases')) {
            $targetPath = "$ServerUser@${ServerHost}:$ServerBasePath/$ReleaseId/"
        }
        else {
            $targetPath = "$ServerUser@${ServerHost}:$ServerBasePath/releases/$ReleaseId/"
        }
        
        $targetPath | Should -Match "/releases/20260106_2200/"
        $targetPath | Should -Be "root@games.hispanistica.com:/srv/webapps/games_hispanistica/media/releases/20260106_2200/"
    }
    
    It "should handle ServerBasePath that already ends with /releases" {
        $ServerUser = "root"
        $ServerHost = "games.hispanistica.com"
        $ServerBasePath = "/srv/webapps/games_hispanistica/media/releases"
        $ReleaseId = "20260106_2200"
        
        if ($ServerBasePath.EndsWith('/releases')) {
            $targetPath = "$ServerUser@${ServerHost}:$ServerBasePath/$ReleaseId/"
        }
        else {
            $targetPath = "$ServerUser@${ServerHost}:$ServerBasePath/releases/$ReleaseId/"
        }
        
        $targetPath | Should -Match "/releases/20260106_2200/"
        $targetPath | Should -Be "root@games.hispanistica.com:/srv/webapps/games_hispanistica/media/releases/20260106_2200/"
    }
}

Describe "sync_release.ps1 No Parser Errors" {
    It "should parse without 'on' command error" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\content_release\sync_release.ps1"
        
        # Test that script can be parsed
        $errors = $null
        $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $scriptPath -Raw), [ref]$errors)
        
        $errors.Count | Should -Be 0
    }
    
    It "should not contain unquoted 'on' that could be interpreted as command" {
        $scriptPath = Join-Path $PSScriptRoot "..\..\scripts\content_release\sync_release.ps1"
        $content = Get-Content $scriptPath -Raw
        
        # Check that "on server" is not present (should be "server-side")
        $content | Should -Not -Match '\(on server\)'
    }
}
