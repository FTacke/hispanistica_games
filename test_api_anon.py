#!/usr/bin/env python3
"""Test Quiz API calls without authentication (Anonymous mode)."""
import requests
import json

BASE_URL = "http://localhost:8000"
TOPIC = "variation_aussprache"

print("=" * 80)
print("QUIZ API TEST - ANONYMOUS MODE (No Session Cookie)")
print("=" * 80)

# Test 1: POST /run/start
print("\n[TEST 1] POST /api/quiz/{}/run/start".format(TOPIC))
print("-" * 80)
try:
    response = requests.post(
        f"{BASE_URL}/api/quiz/{TOPIC}/run/start",
        json={},
        timeout=5
    )
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    try:
        data = response.json()
        print(f"Response JSON:")
        print(json.dumps(data, indent=2))
    except:
        print(f"Response Text: {response.text[:500]}")
except Exception as e:
    print(f"ERROR: {e}")

# Test 2: GET /run/<run_id>/state (if we got a run_id from Test 1)
print("\n[TEST 2] GET /api/quiz/run/<run_id>/state")
print("-" * 80)
# We can't test this without a run_id, but we'll try with a fake ID to see the error
try:
    response = requests.get(
        f"{BASE_URL}/api/quiz/run/fake-run-id/state",
        timeout=5
    )
    print(f"Status Code: {response.status_code}")
    try:
        data = response.json()
        print(f"Response JSON:")
        print(json.dumps(data, indent=2))
    except:
        print(f"Response Text: {response.text[:500]}")
except Exception as e:
    print(f"ERROR: {e}")

# Test 3: POST /run/<run_id>/question/start
print("\n[TEST 3] POST /api/quiz/run/<run_id>/question/start")
print("-" * 80)
try:
    response = requests.post(
        f"{BASE_URL}/api/quiz/run/fake-run-id/question/start",
        json={"question_index": 0},
        timeout=5
    )
    print(f"Status Code: {response.status_code}")
    try:
        data = response.json()
        print(f"Response JSON:")
        print(json.dumps(data, indent=2))
    except:
        print(f"Response Text: {response.text[:500]}")
except Exception as e:
    print(f"ERROR: {e}")

print("\n" + "=" * 80)
print("ROOT CAUSE ANALYSIS")
print("=" * 80)
print("If all tests return 401 Unauthorized with 'AUTH_REQUIRED':")
print("  → quiz_auth_required decorator blocks anonymous users")
print("  → No session cookie = No API access")
print("  → UI freezes because timer/state endpoints are blocked")
