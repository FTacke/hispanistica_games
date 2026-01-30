param(
    [string]$ReleaseId = $("release_" + (Get-Date -Format "yyyyMMdd_HHmmss") + "_dev"),
    [switch]$StartDocker
)

$ErrorActionPreference = "Continue"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Project root
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
$MediaRoot = Join-Path $ProjectRoot "media"
$ReleaseRoot = Join-Path $MediaRoot ("releases\" + $ReleaseId)
$UnitsDir = Join-Path $ReleaseRoot "units"
$AudioDir = Join-Path $ReleaseRoot "audio"
$CurrentLink = Join-Path $MediaRoot "current"

# ENV for v2 flow
$env:ENV = "dev"
$env:QUIZ_MECHANICS_VERSION = "v2"
$env:QUIZ_DEV_SEED_MODE = "none"
if (-not $env:FLASK_SECRET_KEY) { $env:FLASK_SECRET_KEY = "dev" }
$env:PYTHONIOENCODING = "utf-8"

function Invoke-QuietCommand {
    param([scriptblock]$Command)
    $prevErrAction = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $output = & $Command 2>&1
    $ErrorActionPreference = $prevErrAction
    return $output
}

# Default AUTH_DB_* for local dev-postgres (override if already set)
if (-not $env:AUTH_DB_HOST) { $env:AUTH_DB_HOST = "127.0.0.1" }
if (-not $env:AUTH_DB_PORT) { $env:AUTH_DB_PORT = "54321" }
if (-not $env:AUTH_DB_USER) { $env:AUTH_DB_USER = "hispanistica_auth" }
if (-not $env:AUTH_DB_PASSWORD) { $env:AUTH_DB_PASSWORD = "hispanistica_auth" }
if (-not $env:AUTH_DB_NAME) { $env:AUTH_DB_NAME = "hispanistica_auth" }

if (-not $env:AUTH_DATABASE_URL) {
    $env:AUTH_DATABASE_URL = "postgresql+psycopg2://$($env:AUTH_DB_USER):$($env:AUTH_DB_PASSWORD)@$($env:AUTH_DB_HOST):$($env:AUTH_DB_PORT)/$($env:AUTH_DB_NAME)"
}

# Default QUIZ_DB_* for local dev-postgres (override if already set)
if (-not $env:QUIZ_DB_HOST) { $env:QUIZ_DB_HOST = "127.0.0.1" }
if (-not $env:QUIZ_DB_PORT) { $env:QUIZ_DB_PORT = "54322" }
if (-not $env:QUIZ_DB_USER) { $env:QUIZ_DB_USER = "hispanistica_quiz" }
if (-not $env:QUIZ_DB_PASSWORD) { $env:QUIZ_DB_PASSWORD = "hispanistica_quiz" }
if (-not $env:QUIZ_DB_NAME) { $env:QUIZ_DB_NAME = "hispanistica_quiz" }

if (-not $env:QUIZ_DATABASE_URL) {
    $env:QUIZ_DATABASE_URL = "postgresql+psycopg2://$($env:QUIZ_DB_USER):$($env:QUIZ_DB_PASSWORD)@$($env:QUIZ_DB_HOST):$($env:QUIZ_DB_PORT)/$($env:QUIZ_DB_NAME)"
}

$report = @()
$report += "dev_release_flow_v2.ps1"
$report += ("Timestamp: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
$report += ("Release ID: " + $ReleaseId)
$report += ("Project Root: " + $ProjectRoot)
$report += "ENV=dev"
$report += "QUIZ_MECHANICS_VERSION=v2"
$report += "QUIZ_DEV_SEED_MODE=none"
$report += ("AUTH_DB_HOST=" + $env:AUTH_DB_HOST)
$report += ("AUTH_DB_PORT=" + $env:AUTH_DB_PORT)
$report += ("AUTH_DB_USER=" + $env:AUTH_DB_USER)
$report += ("AUTH_DB_NAME=" + $env:AUTH_DB_NAME)
$report += ("AUTH_DATABASE_URL set: " + [bool]$env:AUTH_DATABASE_URL)
$report += ("QUIZ_DB_HOST=" + $env:QUIZ_DB_HOST)
$report += ("QUIZ_DB_PORT=" + $env:QUIZ_DB_PORT)
$report += ("QUIZ_DB_USER=" + $env:QUIZ_DB_USER)
$report += ("QUIZ_DB_NAME=" + $env:QUIZ_DB_NAME)
$report += ("QUIZ_DATABASE_URL set: " + [bool]$env:QUIZ_DATABASE_URL)
$report += ("FLASK_SECRET_KEY set: " + [bool]$env:FLASK_SECRET_KEY)
$report += ""

# Create release structure
New-Item -ItemType Directory -Path $UnitsDir -Force | Out-Null
New-Item -ItemType Directory -Path $AudioDir -Force | Out-Null

# Copy unit JSON (rename to slug-based filename)
$SourceUnit = Join-Path $ProjectRoot "content\quiz\topics\variation_aussprache_v2.json"
if (-not (Test-Path $SourceUnit)) {
    throw "Source unit not found: $SourceUnit"
}
$TargetUnit = Join-Path $UnitsDir "variation_aussprache.json"
Copy-Item -Path $SourceUnit -Destination $TargetUnit -Force
$report += "Copied unit: content/quiz/topics/variation_aussprache_v2.json -> media/releases/$ReleaseId/units/variation_aussprache.json"

# Reset media/current link
if (Test-Path $CurrentLink) {
    try {
        Remove-Item -Path $CurrentLink -Recurse -Force
    } catch {
        # Best effort removal
    }
}

$currentLinkMode = ""
try {
    New-Item -ItemType SymbolicLink -Path $CurrentLink -Target $ReleaseRoot -ErrorAction Stop | Out-Null
    $currentLinkMode = "symlink"
} catch {
    try {
        New-Item -ItemType Junction -Path $CurrentLink -Target $ReleaseRoot -ErrorAction Stop | Out-Null
        $currentLinkMode = "junction"
    } catch {
        # Fallback: copy structure (documented in report)
        New-Item -ItemType Directory -Path $CurrentLink -Force | Out-Null
        Copy-Item -Path (Join-Path $ReleaseRoot "*") -Destination $CurrentLink -Recurse -Force
        $currentLinkMode = "fallback-copy"
    }
}
$report += ("media/current link mode: " + $currentLinkMode)
$report += ""

# Run import + publish
$python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $python = "python"
}

# Optional: ensure dev-postgres is running
if ($StartDocker) {
    $report += "Command: docker compose -f docker-compose.dev-postgres.yml up -d"
    $dockerOutput = Invoke-QuietCommand { docker compose -f (Join-Path $ProjectRoot "docker-compose.dev-postgres.yml") up -d }
    $report += $dockerOutput
    $report += ""
    if ($LASTEXITCODE -ne 0) {
        $report += "ERROR: Docker compose failed. Ensure Docker Desktop is running."
        $ReportPath = Join-Path $ProjectRoot "docs\quiz\refactoring\dev_release_flow_report_phase3b_1.txt"
        $report | Out-File -FilePath $ReportPath -Encoding utf8
        Write-Host "Release flow aborted (docker compose failed). Report written to: $ReportPath"
        exit 1
    }
}

# Guard: auth + quiz DB must be PostgreSQL
$report += "Command: python -c 'check auth DB dialect'"
$authDialect = Invoke-QuietCommand { & $python -c "import os; from sqlalchemy.engine import make_url; url=os.getenv('AUTH_DATABASE_URL'); print(make_url(url).get_backend_name())" }
$report += ("Auth DB dialect: " + $authDialect)
if ($authDialect -notmatch "postgres") {
    $report += "ERROR: Wrong DB: auth module requires PostgreSQL. Set AUTH_DATABASE_URL."
    $ReportPath = Join-Path $ProjectRoot "docs\quiz\refactoring\dev_release_flow_report_phase3b_1.txt"
    $report | Out-File -FilePath $ReportPath -Encoding utf8
    Write-Host "Release flow aborted (wrong auth DB). Report written to: $ReportPath"
    exit 1
}

$report += "Command: python -c 'check quiz DB dialect'"
$dialect = Invoke-QuietCommand { & $python -c "import os; from sqlalchemy.engine import make_url; url=os.getenv('QUIZ_DATABASE_URL'); print(make_url(url).get_backend_name())" }
$report += ("Quiz DB dialect: " + $dialect)
if ($dialect -notmatch "postgres") {
    $report += "ERROR: Wrong DB: quiz module requires PostgreSQL. Set QUIZ_DB_* or QUIZ_DATABASE_URL and start dev-postgres."
    $ReportPath = Join-Path $ProjectRoot "docs\quiz\refactoring\dev_release_flow_report_phase3b_1.txt"
    $report | Out-File -FilePath $ReportPath -Encoding utf8
    Write-Host "Release flow aborted (wrong quiz DB). Report written to: $ReportPath"
    exit 1
}

# Ensure quiz schema exists (uses QUIZ_DATABASE_URL)
$report += "Command: python scripts/init_quiz_db.py"
$prevAuth = $env:AUTH_DATABASE_URL
$env:AUTH_DATABASE_URL = $env:QUIZ_DATABASE_URL
$initOutput = Invoke-QuietCommand { & $python (Join-Path $ProjectRoot "scripts\init_quiz_db.py") }
$report += $initOutput
if ($prevAuth) {
    $env:AUTH_DATABASE_URL = $prevAuth
} else {
    Remove-Item env:AUTH_DATABASE_URL -ErrorAction SilentlyContinue
}
$report += ""
if ($LASTEXITCODE -ne 0) {
    $report += "ERROR: Quiz DB init failed. Ensure Postgres is reachable."
    $ReportPath = Join-Path $ProjectRoot "docs\quiz\refactoring\dev_release_flow_report_phase3b_1.txt"
    $report | Out-File -FilePath $ReportPath -Encoding utf8
    Write-Host "Release flow aborted (quiz DB init failed). Report written to: $ReportPath"
    exit 1
}

$report += "Command: python manage.py import-content --units-path media/current/units --audio-path media/current/audio --release $ReleaseId"
$importOutput = Invoke-QuietCommand { & $python (Join-Path $ProjectRoot "manage.py") import-content --units-path "media/current/units" --audio-path "media/current/audio" --release $ReleaseId }
$report += $importOutput
$report += ""

$report += "Command: python manage.py publish-release --release $ReleaseId"
$publishOutput = Invoke-QuietCommand { & $python (Join-Path $ProjectRoot "manage.py") publish-release --release $ReleaseId }
$report += $publishOutput
$report += ""

# Incremental patch import (same release)
$PatchSource = Join-Path $ProjectRoot "content\quiz\topics\variation_aussprache_v2_patch.json"
if (Test-Path $PatchSource) {
    Copy-Item -Path $PatchSource -Destination $TargetUnit -Force
    $report += "Patched unit copied to media/current/units/variation_aussprache.json"
    $report += "Command: python manage.py import-content --units-path media/current/units --audio-path media/current/audio --release $ReleaseId"
    $importPatchOutput = Invoke-QuietCommand { & $python (Join-Path $ProjectRoot "manage.py") import-content --units-path "media/current/units" --audio-path "media/current/audio" --release $ReleaseId }
    $report += $importPatchOutput
    $report += ""

    # Capture evidence of UPSERT (release record updated) from import log
    $importLogDir = Join-Path $ProjectRoot "data\import_logs"
    if (Test-Path $importLogDir) {
        $report += ("Import log search: " + (Join-Path $importLogDir "*import_$ReleaseId*.log"))
        $latestImportLog = Get-ChildItem -Path $importLogDir -Filter "*import_$ReleaseId*.log" -File | Sort-Object LastWriteTime | Select-Object -Last 1
        if ($latestImportLog) {
            $report += ("Import log (latest): " + $latestImportLog.Name)
            $updatedLine = Select-String -Path $latestImportLog.FullName -Pattern "Updated release record" | Select-Object -First 1
            if ($updatedLine) {
                $report += ("Log evidence: " + $updatedLine.Line)
            }
        } else {
            $report += "Import log not found for this release."
        }
        $report += ""
    }

    $report += "Command: python manage.py publish-release --release $ReleaseId"
    $publishPatchOutput = Invoke-QuietCommand { & $python (Join-Path $ProjectRoot "manage.py") publish-release --release $ReleaseId }
    $report += $publishPatchOutput
    $report += ""
}

$report += "Command: python manage.py quiz-db-report"
$dbReport = Invoke-QuietCommand { & $python (Join-Path $ProjectRoot "manage.py") quiz-db-report }
$report += $dbReport
$report += ""

# Verify updated explanation text
$report += "Command: python scripts/verify_patch.py --question-id variation_aussprache_q_01KDT5WVTVXYEBZMKK9NWF7SNK"
$verifyOutput = Invoke-QuietCommand { & $python (Join-Path $ProjectRoot "scripts\verify_patch.py") --question-id "variation_aussprache_q_01KDT5WVTVXYEBZMKK9NWF7SNK" }
$report += $verifyOutput
$report += ""

# Write report file
$ReportPath = Join-Path $ProjectRoot "docs\quiz\refactoring\dev_release_flow_report_phase3b_1.txt"
$report | Out-File -FilePath $ReportPath -Encoding utf8

Write-Host "Release flow completed. Report written to: $ReportPath"
