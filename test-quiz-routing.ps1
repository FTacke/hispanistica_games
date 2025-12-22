# Quiz Integration QA - Automated Tests
# Run this after server is started with: python -m src.app.main

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  QUIZ MODULE INTEGRATION QA TESTS  " -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$passed = 0
$failed = 0

function Test-Route {
    param($name, $url, $expectedCode)
    try {
        if ($expectedCode -eq 301) {
            $null = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
            Write-Host "[FAIL] $name : Expected 301, got 200" -ForegroundColor Red
            $script:failed++
        } else {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -eq $expectedCode) {
                Write-Host "[PASS] $name : $($r.StatusCode)" -ForegroundColor Green
                $script:passed++
            } else {
                Write-Host "[FAIL] $name : Got $($r.StatusCode), expected $expectedCode" -ForegroundColor Red
                $script:failed++
            }
        }
    } catch {
        if ($expectedCode -eq 301 -and $_.Exception.Response.StatusCode.value__ -eq 301) {
            Write-Host "[PASS] $name : 301 Redirect" -ForegroundColor Green
            $script:passed++
        } else {
            Write-Host "[FAIL] $name : $($_.Exception.Message)" -ForegroundColor Red
            $script:failed++
        }
    }
}

Write-Host "TEST SUITE A: Routing & Redirects`n" -ForegroundColor Yellow

Test-Route "A1: Canonical /quiz" "http://127.0.0.1:8000/quiz" 200
Test-Route "A2: Legacy /games/quiz redirect" "http://127.0.0.1:8000/games/quiz" 301
Test-Route "A3: Canonical topic entry" "http://127.0.0.1:8000/quiz/demo_topic" 200
Test-Route "A4: Legacy topic redirect" "http://127.0.0.1:8000/games/quiz/demo_topic" 301

Write-Host "`nTEST SUITE C: API Endpoints`n" -ForegroundColor Yellow

try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/quiz/topics" -UseBasicParsing
    $json = $r.Content | ConvertFrom-Json
    if ($json.topics.Count -gt 0) {
        Write-Host "[PASS] C1: /api/quiz/topics : $($r.StatusCode), $($json.topics.Count) topics" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] C1: /api/quiz/topics : No topics found" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "[FAIL] C1: /api/quiz/topics : $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/quiz/topics/demo_topic/leaderboard" -UseBasicParsing
    Write-Host "[PASS] C2: /api/quiz/topics/demo_topic/leaderboard : $($r.StatusCode)" -ForegroundColor Green
    $passed++
} catch {
    Write-Host "[FAIL] C2: /api/quiz/topics/demo_topic/leaderboard : $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

Write-Host "`nTEST SUITE D: Deep Links`n" -ForegroundColor Yellow

try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/quiz/demo_topic" -UseBasicParsing
    if ($r.Content -match "demo_topic" -or $r.Content -match "quiz") {
        Write-Host "[PASS] D1: Direct topic link works" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] D1: Direct topic link : Content doesn't contain expected text" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "[FAIL] D1: Direct topic link : $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $passed passed, $failed failed  " -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
Write-Host "======================================`n" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "All tests passed! Quiz routing integration successful.`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Review output above.`n" -ForegroundColor Red
    exit 1
}
