#!/usr/bin/env python3
"""
REPRO Script: Test Anonymous Session Flow for Quiz

Tests the complete flow:
1. GET /quiz/<topic>/play - Should set quiz_session cookie
2. POST /api/quiz/<topic>/run/start - Should use cookie, return run_id
3. GET /api/quiz/run/<id>/state - Should return phase, expires_at_ms
4. POST /api/quiz/run/<id>/question/start - Should start timer

Exit codes:
- 0: All tests PASS
- 1: Test FAILED
"""

import requests
import sys
import json
from typing import Optional

BASE_URL = "http://localhost:8000"
TOPIC = "variation_aussprache"
COOKIE_NAME = "quiz_session"


def log(message: str, level: str = "INFO"):
    """Print formatted log message."""
    print(f"[{level}] {message}")


def check_response(response: requests.Response, expected_status: int, step: str) -> bool:
    """Check if response has expected status code."""
    if response.status_code != expected_status:
        log(f"{step} FAILED - Expected {expected_status}, got {response.status_code}", "ERROR")
        log(f"Response: {response.text}", "ERROR")
        return False
    log(f"{step} PASSED - Status {response.status_code}", "SUCCESS")
    return True


def main():
    """Run the test flow."""
    session = requests.Session()
    
    # ========================================================================
    # STEP 1: GET /quiz/<topic>/play - Should set cookie
    # ========================================================================
    log("=" * 60)
    log("STEP 1: GET /quiz/<topic>/play")
    log("=" * 60)
    
    url = f"{BASE_URL}/quiz/{TOPIC}/play"
    log(f"Request: GET {url}")
    
    response = session.get(url)
    
    if not check_response(response, 200, "STEP 1"):
        return 1
    
    # Check if cookie was set
    cookie_value = session.cookies.get(COOKIE_NAME)
    if cookie_value:
        log(f"✅ Cookie '{COOKIE_NAME}' was set: {cookie_value[:20]}...", "SUCCESS")
    else:
        log(f"❌ Cookie '{COOKIE_NAME}' was NOT set!", "ERROR")
        log(f"Available cookies: {list(session.cookies.keys())}", "ERROR")
        return 1
    
    print()
    
    # ========================================================================
    # STEP 2: POST /api/quiz/<topic>/run/start
    # ========================================================================
    log("=" * 60)
    log("STEP 2: POST /api/quiz/<topic>/run/start")
    log("=" * 60)
    
    url = f"{BASE_URL}/api/quiz/{TOPIC}/run/start"
    log(f"Request: POST {url}")
    log(f"Cookie: {COOKIE_NAME}={cookie_value[:20]}...")
    
    response = session.post(url, json={})
    
    if not check_response(response, 200, "STEP 2"):
        return 1
    
    data = response.json()
    run_id = data.get("run_id")
    
    if not run_id:
        log("❌ No run_id in response!", "ERROR")
        log(f"Response: {json.dumps(data, indent=2)}", "ERROR")
        return 1
    
    log(f"✅ run_id: {run_id}", "SUCCESS")
    log(f"Response keys: {list(data.keys())}", "INFO")
    
    print()
    
    # ========================================================================
    # STEP 3: GET /api/quiz/run/<id>/state
    # ========================================================================
    log("=" * 60)
    log("STEP 3: GET /api/quiz/run/<id>/state")
    log("=" * 60)
    
    url = f"{BASE_URL}/api/quiz/run/{run_id}/state"
    log(f"Request: GET {url}")
    
    response = session.get(url)
    
    if not check_response(response, 200, "STEP 3"):
        return 1
    
    data = response.json()
    phase = data.get("phase")
    expires_at_ms = data.get("expires_at_ms")
    remaining_seconds = data.get("remaining_seconds")
    
    log(f"phase: {phase}", "INFO")
    log(f"expires_at_ms: {expires_at_ms}", "INFO")
    log(f"remaining_seconds: {remaining_seconds}", "INFO")
    
    if phase is None:
        log("❌ No 'phase' in response!", "ERROR")
        return 1
    
    log(f"✅ Phase received: {phase}", "SUCCESS")
    
    print()
    
    # ========================================================================
    # STEP 4: POST /api/quiz/run/<id>/question/start
    # ========================================================================
    log("=" * 60)
    log("STEP 4: POST /api/quiz/run/<id>/question/start")
    log("=" * 60)
    
    url = f"{BASE_URL}/api/quiz/run/{run_id}/question/start"
    log(f"Request: POST {url}")
    
    payload = {"question_index": 0}
    response = session.post(url, json=payload)
    
    if not check_response(response, 200, "STEP 4"):
        return 1
    
    data = response.json()
    success = data.get("success")
    expires_at_ms = data.get("expires_at_ms")
    remaining_seconds = data.get("remaining_seconds")
    
    log(f"success: {success}", "INFO")
    log(f"expires_at_ms: {expires_at_ms}", "INFO")
    log(f"remaining_seconds: {remaining_seconds}", "INFO")
    
    if not success:
        log("❌ Timer start failed (success=False)!", "ERROR")
        return 1
    
    if not expires_at_ms:
        log("❌ No expires_at_ms in response!", "ERROR")
        return 1
    
    log(f"✅ Timer started successfully", "SUCCESS")
    
    print()
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    log("=" * 60)
    log("ALL TESTS PASSED ✅", "SUCCESS")
    log("=" * 60)
    
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log(f"Unhandled exception: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)
