<#
.SYNOPSIS
    Quick dev server start (assumes setup is already complete).

.DESCRIPTION
    Use this script for daily development after initial setup with dev-setup.ps1.
    - Starts Docker PostgreSQL (Auth + Quiz)
    - Starts the Flask dev server

    For first-time setup or full reinstall, use: .\scripts\dev-setup.ps1

.EXAMPLE
    # PostgreSQL mode (default)
    .\scripts\dev-start.ps1
#>

[CmdletBinding()]
param(
    [switch]$UsePostgres
)

$ErrorActionPreference = 'Stop'

function Test-TcpPort {
    param(
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutMs = 1000
    )

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            return $false
        }

        $client.EndConnect($connect)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Wait-ForPostgresService {
    param(
        [Parameter(Mandatory = $true)][string]$ContainerName,
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$MaxWaitSeconds = 60
    )

    $waited = 0
    while ($waited -lt $MaxWaitSeconds) {
        $status = docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $ContainerName 2>$null
        if (($status -eq 'healthy' -or $status -eq 'running') -and (Test-TcpPort -HostName $HostName -Port $Port)) {
            return $true
        }

        Start-Sleep -Seconds 2
        $waited += 2
    }

    return $false
}

function Test-ContainerPortPublished {
    param(
        [Parameter(Mandatory = $true)][string]$ContainerName,
        [Parameter(Mandatory = $true)][int]$ContainerPort,
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$HostPort
    )

    $portSpec = docker inspect --format="{{with index .NetworkSettings.Ports '$($ContainerPort)/tcp'}}{{(index . 0).HostIp}}:{{(index . 0).HostPort}}{{end}}" $ContainerName 2>$null
    if (-not $portSpec) {
        return $false
    }

    $expectedPorts = @("$HostPort", "$HostName`:$HostPort", "0.0.0.0:$HostPort", "::$HostPort")
    if ($expectedPorts -notcontains $portSpec.Trim()) {
        return $false
    }

    return (Test-TcpPort -HostName $HostName -Port $HostPort)
}

function Get-ContainerComposeWorkingDir {
    param(
        [Parameter(Mandatory = $true)][string]$ContainerName
    )

    try {
        $inspectJson = docker inspect $ContainerName 2>$null | ConvertFrom-Json
        if (-not $inspectJson) {
            return $null
        }

        return $inspectJson[0].Config.Labels.'com.docker.compose.project.working_dir'
    } catch {
        return $null
    }
}

function Test-ContainerMatchesRepo {
    param(
        [Parameter(Mandatory = $true)][string]$ContainerName,
        [Parameter(Mandatory = $true)][string]$ExpectedWorkingDir
    )

    $containerWorkingDir = Get-ContainerComposeWorkingDir -ContainerName $ContainerName
    if (-not $containerWorkingDir) {
        return $false
    }

    $expected = [System.IO.Path]::GetFullPath($ExpectedWorkingDir).TrimEnd('\').ToLowerInvariant()
    $actual = [System.IO.Path]::GetFullPath($containerWorkingDir).TrimEnd('\').ToLowerInvariant()
    return $actual -eq $expected
}

# Repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Determine database mode (PostgreSQL default)
$dbMode = "postgres"
if ($UsePostgres) {
    Write-Host "[DEPRECATED] -UsePostgres is no longer needed; PostgreSQL is the default." -ForegroundColor Yellow
}

# Use 127.0.0.1 instead of localhost to avoid DNS resolution issues with psycopg3 on Windows
$env:AUTH_DATABASE_URL = "postgresql+psycopg://hispanistica_auth:hispanistica_auth@127.0.0.1:54321/hispanistica_auth"
if (-not $env:QUIZ_DB_HOST) { $env:QUIZ_DB_HOST = "127.0.0.1" }
if (-not $env:QUIZ_DB_PORT) { $env:QUIZ_DB_PORT = "54322" }
if (-not $env:QUIZ_DB_USER) { $env:QUIZ_DB_USER = "hispanistica_quiz" }
if (-not $env:QUIZ_DB_PASSWORD) { $env:QUIZ_DB_PASSWORD = "hispanistica_quiz" }
if (-not $env:QUIZ_DB_NAME) { $env:QUIZ_DB_NAME = "hispanistica_quiz" }
$env:QUIZ_DATABASE_URL = "postgresql+psycopg://$($env:QUIZ_DB_USER):$($env:QUIZ_DB_PASSWORD)@$($env:QUIZ_DB_HOST):$($env:QUIZ_DB_PORT)/$($env:QUIZ_DB_NAME)"
Write-Host "Database mode: PostgreSQL" -ForegroundColor Green

# Set common environment variables
$env:FLASK_SECRET_KEY = "dev-secret-change-me"
$env:JWT_SECRET_KEY = "dev-jwt-secret-change-me"
$env:FLASK_ENV = "development"
if (-not $env:ENV) {
    $env:ENV = "dev"
}

$quizMechanicsNote = ""
if (-not $env:QUIZ_MECHANICS_VERSION) {
    $env:QUIZ_MECHANICS_VERSION = "v2"
    $quizMechanicsNote = " (default)"
}

$quizSeedNote = ""
if (-not $env:QUIZ_DEV_SEED_MODE) {
    $env:QUIZ_DEV_SEED_MODE = "none"
    $quizSeedNote = " (default)"
}

Write-Host "Starting Hispanistica Games dev server..." -ForegroundColor Cyan
$maskedAuthUrl = $env:AUTH_DATABASE_URL -replace ':(.+?)@', ':*****@'
$maskedQuizUrl = $env:QUIZ_DATABASE_URL -replace ':(.+?)@', ':*****@'
Write-Host "AUTH_DATABASE_URL = $maskedAuthUrl"
Write-Host "QUIZ_DATABASE_URL = $maskedQuizUrl"
Write-Host "QUIZ_MECHANICS_VERSION = $($env:QUIZ_MECHANICS_VERSION)$quizMechanicsNote"
Write-Host "QUIZ_DEV_SEED_MODE = $($env:QUIZ_DEV_SEED_MODE)$quizSeedNote"

# Check and start Docker PostgreSQL if needed
$dockerAvailable = Get-Command docker -ErrorAction SilentlyContinue

if ($dockerAvailable) {
    $pgRunning = docker ps --filter "name=hispanistica_auth_db" --format "{{.Names}}" 2>$null
    $quizPgRunning = docker ps --filter "name=hispanistica_quiz_db" --format "{{.Names}}" 2>$null
    $authPortReady = $false
    $quizPortReady = $false
    $authMatchesRepo = $false
    $quizMatchesRepo = $false

    if ($pgRunning) {
        $authMatchesRepo = Test-ContainerMatchesRepo -ContainerName 'hispanistica_auth_db' -ExpectedWorkingDir $repoRoot
    }

    if ($quizPgRunning) {
        $quizMatchesRepo = Test-ContainerMatchesRepo -ContainerName 'hispanistica_quiz_db' -ExpectedWorkingDir $repoRoot
    }

    if ($pgRunning -and $authMatchesRepo) {
        $authPortReady = Test-ContainerPortPublished -ContainerName 'hispanistica_auth_db' -ContainerPort 5432 -HostName '127.0.0.1' -HostPort 54321
    }

    if ($quizPgRunning -and $quizMatchesRepo) {
        $quizPortReady = Test-ContainerPortPublished -ContainerName 'hispanistica_quiz_db' -ContainerPort 5432 -HostName '127.0.0.1' -HostPort 54322
    }

    if ($pgRunning -and -not $authMatchesRepo) {
        Write-Host "Removing stale auth DB container from a different compose workspace..." -ForegroundColor Yellow
        docker rm -f hispanistica_auth_db | Out-Null
        $pgRunning = $null
    }

    if ($quizPgRunning -and -not $quizMatchesRepo) {
        Write-Host "Removing stale quiz DB container from a different compose workspace..." -ForegroundColor Yellow
        docker rm -f hispanistica_quiz_db | Out-Null
        $quizPgRunning = $null
    }

    if (-not $pgRunning -or -not $quizPgRunning -or -not $authPortReady -or -not $quizPortReady) {
        Write-Host "Starting Docker PostgreSQL..." -ForegroundColor Yellow
        if (($pgRunning -and -not $authPortReady) -or ($quizPgRunning -and -not $quizPortReady)) {
            Write-Host "Detected stale PostgreSQL containers without usable host port bindings. Recreating..." -ForegroundColor Yellow
            if ($pgRunning) {
                docker rm -f hispanistica_auth_db | Out-Null
            }
            if ($quizPgRunning) {
                docker rm -f hispanistica_quiz_db | Out-Null
            }
            docker compose -f docker-compose.dev-postgres.yml up -d hispanistica_auth_db hispanistica_quiz_db
        } else {
            docker compose -f docker-compose.dev-postgres.yml up -d hispanistica_auth_db hispanistica_quiz_db
        }

        Write-Host "Waiting for PostgreSQL..." -ForegroundColor Gray
        $authReady = Wait-ForPostgresService -ContainerName 'hispanistica_auth_db' -HostName '127.0.0.1' -Port 54321
        $quizReady = Wait-ForPostgresService -ContainerName 'hispanistica_quiz_db' -HostName '127.0.0.1' -Port 54322
        if (-not $authReady -or -not $quizReady) {
            Write-Host "ERROR: PostgreSQL host ports are not reachable after startup." -ForegroundColor Red
            Write-Host "  Check: docker compose -f docker-compose.dev-postgres.yml ps" -ForegroundColor Gray
            Write-Host "  Check: docker inspect hispanistica_auth_db" -ForegroundColor Gray
            exit 1
        }
    } else {
        Write-Host "Docker PostgreSQL already running." -ForegroundColor Gray
    }
} else {
    Write-Host "ERROR: Docker not available. PostgreSQL dev stack is required." -ForegroundColor Red
    exit 1
}

# Activate venv if available
$venvActivate = Join-Path $repoRoot ".venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    Write-Host "Activating Python virtual environment..." -ForegroundColor Gray
    & $venvActivate
    $venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
} else {
    $venvPython = "python"
}

# Quiz content pipeline (DEV only, PostgreSQL only)
Write-Host "`nEnsuring Auth DB schema..." -ForegroundColor Cyan
$authInitScript = Join-Path $repoRoot "scripts\init_auth_db.py"
& $venvPython $authInitScript
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Auth DB initialization failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Auth DB schema ready`n" -ForegroundColor Green

Write-Host "Ensuring DEV admin (admin_dev/0000)..." -ForegroundColor Cyan
& $venvPython (Join-Path $repoRoot "manage.py") ensure-dev-admin
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: DEV admin provisioning failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] DEV admin ensured`n" -ForegroundColor Green

Write-Host "Ensuring Quiz DB schema..." -ForegroundColor Cyan
$quizInitScript = Join-Path $repoRoot "scripts\init_quiz_db.py"
$prevAuthDbUrl = $env:AUTH_DATABASE_URL
$env:AUTH_DATABASE_URL = $env:QUIZ_DATABASE_URL
& $venvPython $quizInitScript
$initExit = $LASTEXITCODE
if ($prevAuthDbUrl) {
    $env:AUTH_DATABASE_URL = $prevAuthDbUrl
} else {
    Remove-Item env:AUTH_DATABASE_URL -ErrorAction SilentlyContinue
}

if ($initExit -ne 0) {
    Write-Host "`nERROR: Quiz DB initialization failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Quiz DB schema ready`n" -ForegroundColor Green

Write-Host "Applying DEV-only quiz migrations..." -ForegroundColor Cyan
$quizMigrateScript = Join-Path $repoRoot "scripts\quiz_dev_migrate.py"
& $venvPython $quizMigrateScript
$migrateExit = $LASTEXITCODE

if ($migrateExit -ne 0) {
    Write-Host "`nERROR: Quiz DEV migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Quiz DEV migrations applied`n" -ForegroundColor Green

if ($env:QUIZ_DEV_MIGRATE_CONTENT -eq "1") {
    Write-Host "`n[DEV] Migrating quiz content to v2..." -ForegroundColor Cyan
    $quizContentMigrate = Join-Path $repoRoot "scripts\quiz_content_migrate_difficulty_1_3.py"
    & $venvPython $quizContentMigrate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nERROR: Quiz content migration failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Quiz content migration complete`n" -ForegroundColor Green
}

$quizDevSeedMode = $env:QUIZ_DEV_SEED_MODE

Write-Host "`nRunning quiz content pipeline..." -ForegroundColor Cyan
Write-Host "  Seed mode: $quizDevSeedMode" -ForegroundColor Gray

if ($quizDevSeedMode -eq "none") {
    Write-Host "[SKIP] Quiz seeding skipped (QUIZ_DEV_SEED_MODE=none)" -ForegroundColor Yellow
} elseif ($quizDevSeedMode -eq "single") {
    $quizSeedSingleScript = Join-Path $repoRoot "scripts\quiz_seed_single.py"
    $quizSeedSingleFile = Join-Path $repoRoot "content\quiz\topics\variation_aussprache_v2.json"
    if (-not (Test-Path $quizSeedSingleFile)) {
        Write-Host "`nERROR: Missing $quizSeedSingleFile" -ForegroundColor Red
        Write-Host "Run: python scripts/quiz_content_migrate_difficulty_1_3.py" -ForegroundColor Yellow
        exit 1
    }
    & $venvPython $quizSeedSingleScript --file $quizSeedSingleFile
} else {
    Write-Host "  1) Normalize JSON units (IDs + statistics)" -ForegroundColor Gray
    Write-Host "  2) Seed database (upsert)" -ForegroundColor Gray
    Write-Host "  3) Soft prune removed topics" -ForegroundColor Gray
    
    $quizSeedScript = Join-Path $repoRoot "scripts\quiz_seed.py"
    & $venvPython $quizSeedScript --prune-soft
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Quiz seed pipeline failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Quiz content ready`n" -ForegroundColor Green

# Pick a free port (default 8000)
$port = 8000
while (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    $port++
    if ($port -gt 8100) {
        Write-Host "ERROR: No free port found in range 8000-8100." -ForegroundColor Red
        exit 1
    }
}
$env:PORT = $port

# Run the dev server
Write-Host "Starting Flask dev server at http://localhost:$port" -ForegroundColor Cyan
Write-Host "Login: admin_dev / 0000`n" -ForegroundColor Cyan

$serverProcess = Start-Process -FilePath $venvPython -ArgumentList "-m", "src.app.main" -NoNewWindow -PassThru

# Smoke check (DEV only)
if ($env:ENV -eq "dev") {
    $healthUrls = @(
        "http://127.0.0.1:$port/health",
        "http://127.0.0.1:$port/api/quiz/topics"
    )
    $smokeOk = $false
    for ($i = 0; $i -lt 15 -and -not $smokeOk; $i++) {
        Start-Sleep -Seconds 1
        foreach ($url in $healthUrls) {
            try {
                $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
                if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                    Write-Host "[OK] Smoke check: $url" -ForegroundColor Green
                    $smokeOk = $true
                    break
                }
            } catch {
                # try next URL
            }
        }
    }

    if (-not $smokeOk) {
        Write-Host "ERROR: Smoke check failed (server not reachable)." -ForegroundColor Red
        if ($serverProcess -and -not $serverProcess.HasExited) {
            Stop-Process -Id $serverProcess.Id -Force
        }
        exit 1
    }
}

Wait-Process -Id $serverProcess.Id

