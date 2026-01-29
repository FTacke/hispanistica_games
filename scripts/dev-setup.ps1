<#
.SYNOPSIS
    Full dev setup: install deps, start DB (Docker or SQLite), migrate auth DB, start dev server.

.DESCRIPTION
    One-liner to get hispanistica_games development environment running:
    - Python virtualenv and dependencies
    - SQLite auth DB (default) or PostgreSQL via Docker (with -UsePostgres)
    - Auth DB migration
    - Flask dev server

    Default: SQLite (no Docker needed, simple local development).
    Use -UsePostgres for production-like testing with PostgreSQL.

.EXAMPLE
    # Recommended: Quick start with SQLite
    .\scripts\dev-setup.ps1

.EXAMPLE
    # Skip installing Python deps (already installed)
    .\scripts\dev-setup.ps1 -SkipInstall

.EXAMPLE
    # PostgreSQL mode (requires Docker)
    .\scripts\dev-setup.ps1 -UsePostgres

.EXAMPLE
    # Reset auth DB and create initial admin with explicit password
    .\scripts\dev-setup.ps1 -ResetAuth -StartAdminPassword "my-secret"
#>

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipDevServer,
    [switch]$UsePostgres,
    [switch]$ResetAuth,
    [string]$StartAdminPassword = 'change-me'
)

$ErrorActionPreference = 'Stop'

# Repository root (scripts is under scripts/) — go up one level
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "`nHispanistica Games Dev-Setup" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"

# Determine database mode
if ($UsePostgres) {
    $dbMode = "postgres"
    # Use 127.0.0.1 instead of localhost to avoid DNS resolution issues with psycopg3 on Windows
    $env:AUTH_DATABASE_URL = "postgresql+psycopg://hispanistica_auth:hispanistica_auth@127.0.0.1:54321/hispanistica_auth"
    Write-Host "Database mode: PostgreSQL (production-like)" -ForegroundColor Green
} else {
    $dbMode = "sqlite"
    $dbPath = "data/db/auth.db"
    $env:AUTH_DATABASE_URL = "sqlite:///$dbPath"
    Write-Host "Database mode: SQLite (recommended for dev)" -ForegroundColor Yellow
}

# Set common environment variables
$env:FLASK_SECRET_KEY = "dev-secret-change-me"
$env:JWT_SECRET_KEY = "dev-jwt-secret-change-me"
$env:FLASK_ENV = "development"

# ============================================================================
# Step 1: Python Environment
# ============================================================================
if (-not $SkipInstall) {
    Write-Host "`n[1/4] Setting up Python environment..." -ForegroundColor Yellow

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
        & python -m pip install --quiet -r requirements.txt -c requirements/constraints.txt
        & python -m pip install --quiet argon2_cffi psycopg[binary]
        Write-Host "  Python requirements installed." -ForegroundColor Green
    } catch {
        Write-Host "WARN: pip install failed: $_" -ForegroundColor Yellow
        Write-Host "  You can re-run with -SkipInstall to continue." -ForegroundColor Gray
    }
} else {
    Write-Host "`n[1/4] Skipping Python installation (-SkipInstall)" -ForegroundColor Gray
}

# ============================================================================
# Step 2: Docker Services (PostgreSQL only if needed)
# ============================================================================
$dockerAvailable = Get-Command docker -ErrorAction SilentlyContinue

if ($dbMode -eq "postgres") {
    Write-Host "`n[2/4] Starting Docker services..." -ForegroundColor Yellow

    if (-not $dockerAvailable) {
        Write-Host "ERROR: Docker not found on PATH. Install Docker Desktop or use default SQLite mode." -ForegroundColor Red
        exit 1
    }

    Write-Host "  Starting: hispanistica_auth_db" -ForegroundColor Gray

    # Clean up any conflicting containers first
    $existing = docker ps -aq --filter "name=hispanistica_auth_db" 2>$null
    if ($existing) {
        Write-Host "  Stopping and removing existing container: hispanistica_auth_db" -ForegroundColor Gray
        docker compose -f docker-compose.dev-postgres.yml down 2>&1 | Out-Null
    }

    # Start PostgreSQL service
    Write-Host "  Starting PostgreSQL container..." -ForegroundColor Gray
    $ErrorActionPreference = 'Continue'
    docker compose -f docker-compose.dev-postgres.yml up -d hispanistica_auth_db
    $composeExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    
    if ($composeExitCode -ne 0) {
        Write-Host "ERROR: docker compose failed (exit code: $composeExitCode)" -ForegroundColor Red
        Write-Host "  Check: docker compose -f docker-compose.dev-postgres.yml logs" -ForegroundColor Gray
        exit 1
    }
    
    Write-Host "  Container started, waiting for health check..." -ForegroundColor Gray

    # Wait for Postgres to be healthy and accepting connections
    Write-Host "  Waiting for PostgreSQL to be ready..." -ForegroundColor Gray
    $maxWait = 60
    $waited = 0
    $ready = $false

    while ($waited -lt $maxWait) {
        # Check container health status first
        $status = docker inspect --format='{{.State.Health.Status}}' hispanistica_auth_db 2>$null
        if ($status -eq "healthy") {
            # Additional check: can we actually connect?
            $testResult = docker exec hispanistica_auth_db pg_isready -U hispanistica_auth -d hispanistica_auth 2>$null
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
        Write-Host "  Check: docker logs hispanistica_auth_db" -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host "`n[2/4] Skipping Docker services (SQLite mode)" -ForegroundColor Gray
}

# ============================================================================
# Step 3: Auth DB Migration
# ============================================================================
Write-Host "`n[3/4] Auth database setup..." -ForegroundColor Yellow

# Determine Python executable (prefer venv)
$pythonExe = if (Test-Path ".\.venv\Scripts\python.exe") { ".\.venv\Scripts\python.exe" } else { "python" }

if ($dbMode -eq "postgres") {
    # Postgres migration with error handling
    if ($ResetAuth) {
        Write-Host "  Resetting Postgres auth DB..." -ForegroundColor Gray
        & $pythonExe scripts/init_auth_db.py
    } else {
        Write-Host "  Initializing Postgres..." -ForegroundColor Gray
        & $pythonExe scripts/init_auth_db.py
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: PostgreSQL initialization failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "  Check that PostgreSQL container is running and healthy." -ForegroundColor Red
        Write-Host "  Try: docker logs hispanistica_auth_db" -ForegroundColor Gray
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
        
        # Ensure directory exists
        $dbDir = Split-Path $dbPath
        if (-not (Test-Path $dbDir)) {
            New-Item -ItemType Directory -Path $dbDir -Force | Out-Null
        }
        
        # Initialize database
        & $pythonExe scripts/init_auth_db.py
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: SQLite initialization failed." -ForegroundColor Red
            exit 1
        }
        
        # Create admin user
        & $pythonExe scripts/create_initial_admin.py --username admin --password $StartAdminPassword --db $dbPath
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
# Step 4: Start Dev Server
# ============================================================================
if (-not $SkipDevServer) {
    Write-Host "`n[4/4] Starting Flask dev server..." -ForegroundColor Yellow
    Write-Host "  AUTH_DATABASE_URL = $($env:AUTH_DATABASE_URL)" -ForegroundColor Gray
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
    Write-Host "`n[4/4] Skipping dev server (-SkipDevServer)" -ForegroundColor Gray
}

Write-Host "`nDev-setup complete." -ForegroundColor Cyan
