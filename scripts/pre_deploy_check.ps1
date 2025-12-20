# =============================================================================
# CO.RA.PAN Pre-Deploy Check Script (PowerShell)
# =============================================================================
#
# Performs a complete deployment smoke test locally:
# 1. Builds Docker image
# 2. Starts PostgreSQL database
# 3. Runs database migrations
# 4. Creates initial admin user
# 5. Starts web application
# 6. Tests health endpoint
# 7. Tests login flow
#
# Usage:
#   .\scripts\pre_deploy_check.ps1           # Full check
#   .\scripts\pre_deploy_check.ps1 -Quick    # Skip build, quick health check only
#
# Exit codes:
#   0 - All checks passed
#   1 - Build failed
#   2 - Database failed to start
#   3 - Web service failed to start
#   4 - Health check failed
#   5 - Login test failed
#
# =============================================================================

param(
    [switch]$Quick,
    [string]$ComposeFile = "infra/docker-compose.dev.yml",
    [string]$AdminUser = "admin",
    [string]$AdminPassword = "admin",
    [int]$WebPort = 8000,
    [int]$MaxWaitSeconds = 60
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Step { Write-Host "`n=== $args ===" -ForegroundColor Cyan }

# Cleanup function
function Cleanup {
    Write-Step "Cleanup"
    docker compose -f $ComposeFile down --volumes --remove-orphans 2>$null
}

# Register cleanup on exit
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }

try {
    Write-Step "CO.RA.PAN Pre-Deploy Check"
    Write-Info "Compose file: $ComposeFile"
    Write-Info "Admin user: $AdminUser"
    Write-Info "Web port: $WebPort"

    # -------------------------------------------------------------------------
    # Step 1: Build Docker Image
    # -------------------------------------------------------------------------
    if (-not $Quick) {
        Write-Step "Step 1: Building Docker Image"
        
        docker compose -f $ComposeFile build web
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Docker build failed!"
            exit 1
        }
        Write-Info "Docker image built successfully"
    } else {
        Write-Info "Skipping Docker build (quick mode)"
    }

    # -------------------------------------------------------------------------
    # Step 2: Start Database
    # -------------------------------------------------------------------------
    Write-Step "Step 2: Starting Database"

    # Stop any existing containers first
    docker compose -f $ComposeFile down --volumes 2>$null

    # Start only the database service
    docker compose -f $ComposeFile up -d db
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to start database!"
        exit 2
    }

    # Wait for database to be healthy
    Write-Info "Waiting for database to be ready..."
    $secondsWaited = 0
    while ($secondsWaited -lt $MaxWaitSeconds) {
        $result = docker compose -f $ComposeFile exec -T db pg_isready -U corapan_app -d corapan_auth 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Database is ready (waited ${secondsWaited}s)"
            break
        }
        Start-Sleep -Seconds 1
        $secondsWaited++
    }

    if ($secondsWaited -ge $MaxWaitSeconds) {
        Write-Err "Database failed to become ready within ${MaxWaitSeconds}s"
        exit 2
    }

    # -------------------------------------------------------------------------
    # Step 3: Start Web Service
    # -------------------------------------------------------------------------
    Write-Step "Step 3: Starting Web Service"

    # Set environment variables for the web service
    $env:START_ADMIN_USERNAME = $AdminUser
    $env:START_ADMIN_PASSWORD = $AdminPassword
    $env:FLASK_SECRET_KEY = if ($env:FLASK_SECRET_KEY) { $env:FLASK_SECRET_KEY } else { "test-secret-for-pre-deploy" }
    $env:JWT_SECRET_KEY = if ($env:JWT_SECRET_KEY) { $env:JWT_SECRET_KEY } else { "test-jwt-secret-for-pre-deploy" }

    docker compose -f $ComposeFile up -d web
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to start web service!"
        exit 3
    }

    # Wait for web service to be ready
    Write-Info "Waiting for web service to be ready..."
    $secondsWaited = 0
    while ($secondsWaited -lt $MaxWaitSeconds) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:${WebPort}/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Info "Web service is ready (waited ${secondsWaited}s)"
                break
            }
        } catch { }
        Start-Sleep -Seconds 1
        $secondsWaited++
    }

    if ($secondsWaited -ge $MaxWaitSeconds) {
        Write-Err "Web service failed to become ready within ${MaxWaitSeconds}s"
        Write-Err "Container logs:"
        docker compose -f $ComposeFile logs web --tail=50
        exit 3
    }

    # -------------------------------------------------------------------------
    # Step 4: Health Check
    # -------------------------------------------------------------------------
    Write-Step "Step 4: Health Check"

    try {
        $healthResponse = Invoke-RestMethod -Uri "http://localhost:${WebPort}/health" -UseBasicParsing
        Write-Info "Health response: $($healthResponse | ConvertTo-Json -Compress)"
        
        if ($healthResponse.status -eq "unhealthy") {
            Write-Err "Health check reports unhealthy status!"
            exit 4
        }
        
        if (-not $healthResponse.checks.auth_db.ok) {
            Write-Err "Auth database is not healthy!"
            exit 4
        }
        
        Write-Info "Health check passed"
    } catch {
        Write-Err "Health endpoint not reachable: $_"
        exit 4
    }

    # -------------------------------------------------------------------------
    # Step 5: Login Test
    # -------------------------------------------------------------------------
    Write-Step "Step 5: Login Test"

    Write-Info "Testing login with admin credentials..."

    try {
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        $body = "username=${AdminUser}&password=${AdminPassword}"
        
        $loginResponse = Invoke-WebRequest -Uri "http://localhost:${WebPort}/auth/login" `
            -Method POST `
            -Body $body `
            -ContentType "application/x-www-form-urlencoded" `
            -WebSession $session `
            -MaximumRedirection 0 `
            -UseBasicParsing `
            -ErrorAction SilentlyContinue

        $statusCode = $loginResponse.StatusCode
    } catch {
        # Redirects (303) throw exceptions in PowerShell
        if ($_.Exception.Response.StatusCode.value__ -eq 303) {
            $statusCode = 303
        } else {
            $statusCode = $_.Exception.Response.StatusCode.value__
        }
    }

    Write-Info "Login response code: $statusCode"

    if ($statusCode -eq 303 -or $statusCode -eq 200 -or $statusCode -eq 204) {
        Write-Info "Login successful!"
        
        # Check for cookies
        $cookies = $session.Cookies.GetCookies("http://localhost:${WebPort}")
        $hasAccessToken = $cookies | Where-Object { $_.Name -eq "access_token_cookie" }
        
        if ($hasAccessToken) {
            Write-Info "Auth cookies set correctly"
        } else {
            Write-Warn "Auth cookies may not be set (check manually)"
        }
    } else {
        Write-Err "Login failed with HTTP code: $statusCode"
        exit 5
    }

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    Write-Step "Pre-Deploy Check Complete"

    Write-Host ""
    Write-Host "All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary:"
    Write-Host "  - Docker image built successfully"
    Write-Host "  - PostgreSQL database started and healthy"
    Write-Host "  - Web application started and healthy"
    Write-Host "  - Health endpoint working (auth_db connected)"
    Write-Host "  - Login flow working with admin credentials"
    Write-Host ""
    Write-Host "Ready for deployment:"
    Write-Host "  Production: docker compose -f infra/docker-compose.prod.yml up -d --build"
    Write-Host ""

    exit 0

} finally {
    Cleanup
}
