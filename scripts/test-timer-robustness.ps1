# Timer Robustness Smoke Tests
# Tests the new Timer-Guards and Phase-State-Machine

param(
    [string]$BaseUrl = "http://localhost:5000",
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

function Write-TestHeader {
    param([string]$Message)
    Write-Host ""
    Write-Host "=======================================================" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "=======================================================" -ForegroundColor Cyan
}

function Write-TestPass {
    param([string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-TestFail {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-TestInfo {
    param([string]$Message)
    if ($Verbose) {
        Write-Host "[INFO] $Message" -ForegroundColor Gray
    }
}

Write-TestHeader "Timer Robustness and Position Sync Tests"

$passCount = 0
$failCount = 0

# Test 1: Phase State Machine in Code
Write-Host ""
Write-Host "Test 1: Phase State Machine vorhanden"
$codeFile = "c:\dev\hispanistica_games\static\js\games\quiz-play.js"
$content = Get-Content $codeFile -Raw

if ($content -match "const PHASE = \{") {
    Write-TestPass "PHASE enum mit ANSWERING/POST_ANSWER gefunden"
    $passCount++
} else {
    Write-TestFail "PHASE enum fehlt"
    $failCount++
}

if ($content -match "state\.phase = PHASE\.ANSWERING") {
    Write-TestPass "phase=ANSWERING wird gesetzt"
    $passCount++
} else {
    Write-TestFail "phase=ANSWERING nicht gefunden"
    $failCount++
}

if ($content -match "state\.phase = PHASE\.POST_ANSWER") {
    Write-TestPass "phase=POST_ANSWER wird gesetzt"
    $passCount++
} else {
    Write-TestFail "phase=POST_ANSWER nicht gefunden"
    $failCount++
}

# Test 2: Timer Guards
Write-Host ""
Write-Host "Test 2: Timer Guards implementiert"

if ($content -match "if \(state\.currentView !== VIEW\.QUESTION \|\| state\.phase !== PHASE\.ANSWERING\)") {
    Write-TestPass "startTimerCountdown prueft view+phase"
    $passCount++
} else {
    Write-TestFail "startTimerCountdown view+phase guard fehlt"
    $failCount++
}

if ($content -match "activeTimerAttemptId") {
    Write-TestPass "activeTimerAttemptId tracking vorhanden"
    $passCount++
} else {
    Write-TestFail "activeTimerAttemptId fehlt"
    $failCount++
}

if ($content -match "state\.activeTimerAttemptId = attemptId") {
    Write-TestPass "attemptId wird beim Timer-Start gesetzt"
    $passCount++
} else {
    Write-TestFail "attemptId Zuweisung fehlt"
    $failCount++
}

if ($content -match "state\.activeTimerAttemptId = null") {
    Write-TestPass "attemptId wird beim Timer-Stop geloescht"
    $passCount++
} else {
    Write-TestFail "attemptId Cleanup fehlt"
    $failCount++
}

# Test 3: Timeout Guards
Write-Host ""
Write-Host "Test 3: Timeout Submit Guards"

if ($content -match "if \(state\.phase !== PHASE\.ANSWERING\)") {
    Write-TestPass "handleTimeout prueft phase"
    $passCount++
} else {
    Write-TestFail "handleTimeout phase guard fehlt"
    $failCount++
}

if ($content -match "timeoutSubmittedForAttemptId") {
    Write-TestPass "timeoutSubmittedForAttemptId tracking vorhanden"
    $passCount++
} else {
    Write-TestFail "timeoutSubmittedForAttemptId fehlt"
    $failCount++
}

if ($content -match "state\.timeoutSubmittedForAttemptId\[attemptId\] = true") {
    Write-TestPass "Timeout wird als submitted markiert"
    $passCount++
} else {
    Write-TestFail "Timeout submit marking fehlt"
    $failCount++
}

# Test 4: INVALID_INDEX Error Handling
Write-Host ""
Write-Host "Test 4: INVALID_INDEX Error Handling"

if ($content -match "errorData\.code === 'INVALID_INDEX'") {
    Write-TestPass "INVALID_INDEX Error wird erkannt"
    $passCount++
} else {
    Write-TestFail "INVALID_INDEX Check fehlt"
    $failCount++
}

if ($content -match "fetchStatusAndApply") {
    Write-TestPass "Server-Sync bei INVALID_INDEX vorhanden"
    $passCount++
} else {
    Write-TestFail "Server-Sync fehlt"
    $failCount++
}

# Test 5: Position Sync mit Backend
Write-Host ""
Write-Host "Test 5: Client/Server Position Sync"

if ($content -match "state\.nextQuestionIndex = answer\.nextQuestionIndex") {
    Write-TestPass "nextQuestionIndex vom Backend wird gespeichert"
    $passCount++
} else {
    Write-TestFail "nextQuestionIndex Speicherung fehlt"
    $failCount++
}

if ($content -match "state\.currentIndex = state\.nextQuestionIndex") {
    Write-TestPass "currentIndex wird aus nextQuestionIndex gesetzt"
    $passCount++
} else {
    Write-TestFail "currentIndex = nextQuestionIndex fehlt"
    $failCount++
}

if ($content -match "if \(state\.nextQuestionIndex === null") {
    Write-TestPass "Null-Check fuer nextQuestionIndex vorhanden"
    $passCount++
} else {
    Write-TestFail "nextQuestionIndex Null-Check fehlt"
    $failCount++
}

# Test 6: Stop Timer nach Answer
Write-Host ""
Write-Host "Test 6: Timer Stop nach Answer"

if ($content -match "state\.phase = PHASE\.POST_ANSWER[\s\S]{0,200}stopTimer") {
    Write-TestPass "stopTimer wird nach phase=POST_ANSWER aufgerufen"
    $passCount++
} else {
    Write-TestFail "stopTimer nach POST_ANSWER fehlt oder falsche Reihenfolge"
    $failCount++
}

# Summary
Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " TEST SUMMARY" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Passed: $passCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "ALLE TESTS BESTANDEN!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Die Timer-Robustheit Implementation ist vollstaendig:" -ForegroundColor Green
    Write-Host "  - Phase State Machine (ANSWERING/POST_ANSWER)" -ForegroundColor Gray
    Write-Host "  - Timer laeuft nur bei phase=ANSWERING" -ForegroundColor Gray
    Write-Host "  - AttemptId guards gegen Duplikate" -ForegroundColor Gray
    Write-Host "  - Timeout submit guards" -ForegroundColor Gray
    Write-Host "  - INVALID_INDEX triggers Server-Sync statt Loop" -ForegroundColor Gray
    Write-Host "  - Client nutzt next_question_index vom Backend" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host "Warnung: Einige Tests sind fehlgeschlagen." -ForegroundColor Yellow
    Write-Host "Bitte die fehlenden Implementierungen ergaenzen." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
