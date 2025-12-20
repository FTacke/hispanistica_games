<#
.SYNOPSIS
    Full dev setup: install deps, start Postgres + BlackLab (Docker), migrate auth DB, start dev server.

.DESCRIPTION
    One-liner to get a complete CO.RA.PAN development environment running:
    - Python virtualenv and dependencies
    - PostgreSQL (auth DB) via Docker (or SQLite fallback with -UseSQLite)
    - BlackLab Server via Docker
    - Auth DB migration
    - Flask dev server

    Default: Postgres + BlackLab stack (production-representative).
    Use -UseSQLite for lightweight local testing without Docker dependency for the DB.

.EXAMPLE
    # Recommended: Full stack with Postgres + BlackLab
    .\scripts\dev-setup.ps1

.EXAMPLE
    # Skip installing Python deps (already installed)
    .\scripts\dev-setup.ps1 -SkipInstall

.EXAMPLE
    # SQLite fallback (no Postgres Docker needed)
    .\scripts\dev-setup.ps1 -UseSQLite

.EXAMPLE
    # Reset auth DB and create initial admin with explicit password
    .\scripts\dev-setup.ps1 -ResetAuth -StartAdminPassword "my-secret"
#>

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipBlackLab,
    [switch]$SkipDevServer,
    [switch]$UseSQLite,
    [switch]$ResetAuth,
    [string]$StartAdminPassword = 'change-me'
)

$ErrorActionPreference = 'Stop'

# Repository root (scripts is under scripts/) — go up one level
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "`nCO.RA.PAN Dev-Setup" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"

# Determine database mode
if ($UseSQLite) {
    $dbMode = "sqlite"
    $dbPath = "data/db/auth.db"
    $env:AUTH_DATABASE_URL = "sqlite:///$dbPath"
    Write-Host "Database mode: SQLite (fallback)" -ForegroundColor Yellow
} else {
    $dbMode = "postgres"
    # Use 127.0.0.1 instead of localhost to avoid DNS resolution issues with psycopg3 on Windows
    $env:AUTH_DATABASE_URL = "postgresql+psycopg://corapan_auth:corapan_auth@127.0.0.1:54320/corapan_auth"
    Write-Host "Database mode: PostgreSQL (recommended)" -ForegroundColor Green
}

# Set common environment variables
$env:FLASK_SECRET_KEY = "dev-secret-change-me"
$env:JWT_SECRET_KEY = "dev-jwt-secret-change-me"
$env:FLASK_ENV = "development"
$env:BLACKLAB_BASE_URL = "http://localhost:8081/blacklab-server"

# ============================================================================
# Step 1: Python Environment
# ============================================================================
if (-not $SkipInstall) {
    Write-Host "`n[1/5] Setting up Python environment..." -ForegroundColor Yellow

    # Check for virtualenv
    if (-not (Test-Path ".venv")) {
        Write-Host "  Creating virtual environment (.venv)..." -ForegroundColor Gray
        python -m venv .venv
    }

    # Activate virtualenv if not already active
    $activateScript = ".\.venv\Scripts\Activate.ps1"
    if (Test-Path $activateScript) {
        & $activateScript
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        Write-Host "ERROR: 'python' not found. Activate virtualenv or install Python." -ForegroundColor Red
        exit 1
    }

    Write-Host "  Installing Python requirements..." -ForegroundColor Gray
    try {
        & python -m pip install --quiet --upgrade pip
        & python -m pip install --quiet -r requirements.txt
        & python -m pip install --quiet argon2_cffi psycopg[binary]
        Write-Host "  Python requirements installed." -ForegroundColor Green
    } catch {
        Write-Host "WARN: pip install failed: $_" -ForegroundColor Yellow
        Write-Host "  You can re-run with -SkipInstall to continue." -ForegroundColor Gray
    }
} else {
    Write-Host "`n[1/5] Skipping Python installation (-SkipInstall)" -ForegroundColor Gray
}

# ============================================================================
# Step 2: Docker Services (Postgres + BlackLab)
# ============================================================================
$dockerAvailable = Get-Command docker -ErrorAction SilentlyContinue

if ($dbMode -eq "postgres" -or -not $SkipBlackLab) {
    Write-Host "`n[2/5] Starting Docker services..." -ForegroundColor Yellow

    if (-not $dockerAvailable) {
        Write-Host "ERROR: Docker not found on PATH. Install Docker Desktop or use -UseSQLite." -ForegroundColor Red
        exit 1
    }

    # Determine which services to start
    $services = @()
    if ($dbMode -eq "postgres") {
        $services += "corapan_auth_db"
    }
    if (-not $SkipBlackLab) {
        $services += "blacklab-server-v3"
    }

    $servicesStr = $services -join " "
    Write-Host "  Starting: $servicesStr" -ForegroundColor Gray

    # Clean up any conflicting containers first
    foreach ($svc in $services) {
        $existing = docker ps -aq --filter "name=$svc" 2>$null
        if ($existing) {
            Write-Host "  Removing existing container: $svc" -ForegroundColor Gray
            docker rm -f $svc 2>$null | Out-Null
        }
    }

    # Start services (redirect stderr to suppress docker compose progress messages)
    $ErrorActionPreference = 'Continue'
    docker compose -f docker-compose.dev-postgres.yml up -d @services 2>&1 | Out-Null
    $composeExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    
    if ($composeExitCode -ne 0) {
        Write-Host "ERROR: docker compose failed (exit code: $composeExitCode)" -ForegroundColor Red
        Write-Host "  Check: docker compose -f docker-compose.dev-postgres.yml logs" -ForegroundColor Gray
        exit 1
    }

    # Wait for Postgres to be healthy and accepting connections
    if ($dbMode -eq "postgres") {
        Write-Host "  Waiting for PostgreSQL to be ready..." -ForegroundColor Gray
        $maxWait = 60
        $waited = 0
        $ready = $false

        while ($waited -lt $maxWait) {
            # Check container health status first
            $status = docker inspect --format='{{.State.Health.Status}}' corapan_auth_db 2>$null
            if ($status -eq "healthy") {
                # Additional check: can we actually connect?
                $testResult = docker exec corapan_auth_db pg_isready -U corapan_auth -d corapan_auth 2>$null
                if ($LASTEXITCODE -eq 0) {
                    $ready = $true
                    break
                }
            }
            Start-Sleep -Seconds 2
            $waited += 2
            Write-Host "    ... waiting ($waited s)" -ForegroundColor Gray
        }

        if ($ready) {
            # Give it a bit more time for init scripts to complete
            Start-Sleep -Seconds 3
            Write-Host "  PostgreSQL is ready." -ForegroundColor Green
        } else {
            Write-Host "ERROR: PostgreSQL not ready after ${maxWait}s." -ForegroundColor Red
            Write-Host "  Check: docker logs corapan_auth_db" -ForegroundColor Gray
            exit 1
        }
    }
} else {
    Write-Host "`n[2/5] Skipping Docker services (SQLite mode, -SkipBlackLab)" -ForegroundColor Gray
}

# ============================================================================
# Step 3: Auth DB Migration
# ============================================================================
Write-Host "`n[3/5] Auth database setup..." -ForegroundColor Yellow

# Determine Python executable (prefer venv)
$pythonExe = if (Test-Path ".\.venv\Scripts\python.exe") { ".\.venv\Scripts\python.exe" } else { "python" }

if ($dbMode -eq "postgres") {
    # Postgres migration with error handling
    if ($ResetAuth) {
        Write-Host "  Resetting Postgres auth DB..." -ForegroundColor Gray
        & $pythonExe scripts/apply_auth_migration.py --engine postgres --reset
    } else {
        Write-Host "  Applying Postgres migration..." -ForegroundColor Gray
        & $pythonExe scripts/apply_auth_migration.py --engine postgres
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: PostgreSQL migration failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "  Check that PostgreSQL container is running and healthy." -ForegroundColor Red
        Write-Host "  Try: docker logs corapan_auth_db" -ForegroundColor Gray
        exit 1
    }
    Write-Host "  PostgreSQL migration complete." -ForegroundColor Green
    
    # Create initial admin if needed
    Write-Host "  Ensuring admin user exists..." -ForegroundColor Gray
    & $pythonExe scripts/create_initial_admin.py --username admin --password $StartAdminPassword
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to create admin user." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Postgres auth DB ready." -ForegroundColor Green
} else {
    # SQLite migration
    if ($ResetAuth -or -not (Test-Path $dbPath)) {
        Write-Host "  Initializing SQLite auth DB ($dbPath)..." -ForegroundColor Gray
        if ($ResetAuth) {
            & $pythonExe scripts/apply_auth_migration.py --db $dbPath --reset
        } else {
            & $pythonExe scripts/apply_auth_migration.py --db $dbPath
        }
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: SQLite migration failed." -ForegroundColor Red
            exit 1
        }
        & $pythonExe scripts/create_initial_admin.py --db $dbPath --username admin --password $StartAdminPassword
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: Failed to create admin user." -ForegroundColor Red
            exit 1
        }
        Write-Host "  SQLite auth DB ready." -ForegroundColor Green
    } else {
        Write-Host "  SQLite auth DB already exists at $dbPath" -ForegroundColor Gray
    }
}

# ============================================================================
# Step 4: BlackLab Healthcheck
# ============================================================================
if (-not $SkipBlackLab) {
    Write-Host "`n[4/5] Checking BlackLab Server..." -ForegroundColor Yellow
    $blUrl = "http://localhost:8081/blacklab-server/"
    $maxWait = 90
    $waited = 0
    $blReady = $false

    while ($waited -lt $maxWait) {
        try {
            $resp = Invoke-WebRequest -Uri $blUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) {
                $blReady = $true
                break
            }
        } catch {
            # Ignore and retry
        }
        Start-Sleep -Seconds 5
        $waited += 5
        Write-Host "  ... waiting for BlackLab ($waited s)" -ForegroundColor Gray
    }

    if ($blReady) {
        Write-Host "  BlackLab Server ready at $blUrl" -ForegroundColor Green
    } else {
        Write-Host "WARN: BlackLab not responding after ${maxWait}s. Check docker logs." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[4/5] Skipping BlackLab check (-SkipBlackLab)" -ForegroundColor Gray
}

# ============================================================================
# Step 5: Start Dev Server
# ============================================================================
if (-not $SkipDevServer) {
    Write-Host "`n[5/5] Starting Flask dev server..." -ForegroundColor Yellow
    Write-Host "  AUTH_DATABASE_URL = $($env:AUTH_DATABASE_URL)" -ForegroundColor Gray
    Write-Host "  BLACKLAB_BASE_URL = $($env:BLACKLAB_BASE_URL)" -ForegroundColor Gray
    Write-Host "`n  Dev server will run in foreground. Press Ctrl+C to stop." -ForegroundColor Cyan
    Write-Host "  Open http://localhost:8000 in your browser" -ForegroundColor Cyan
    Write-Host "  Login: admin / $StartAdminPassword`n" -ForegroundColor Cyan

    # Use venv Python (should be set up by this point)
    $venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        & $venvPython -m src.app.main
    } else {
        python -m src.app.main
    }
} else {
    Write-Host "`n[5/5] Skipping dev server (-SkipDevServer)" -ForegroundColor Gray
}

Write-Host "`nDev-setup complete." -ForegroundColor Cyan
