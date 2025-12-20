#!/usr/bin/env python3
"""Quick test script for BlackLab Advanced Search."""

import httpx

BLS_BASE_URL = "http://localhost:8081/blacklab-server"

# Test 1: Direct BlackLab query
print("Test 1: Direct BlackLab API call")
client = httpx.Client()
response = client.get(
    f"{BLS_BASE_URL}/corpora/corapan/hits",
    params={"patt": '[lemma="casa"]', "number": "5"},
    headers={"Accept": "application/json"},
)
print(f"  Status: {response.status_code}")
print(f"  Content-Type: {response.headers.get('content-type', 'N/A')}")
print(f"  Content length: {len(response.content)} bytes")
print(f"  First 200 chars: {response.text[:200]}")
if response.headers.get("content-type", "").startswith("application/json"):
    data = response.json()
    print(f"  Total hits: {data['summary']['resultsStats']['hits']}")
    print(f"  Returned: {data['summary']['resultWindow']['actualSize']}")
else:
    print("  ERROR: Not JSON response")
print()

# Test 2: Flask Advanced Search API
print("Test 2: Flask /search/advanced/data endpoint")
flask_response = httpx.get(
    "http://localhost:8000/search/advanced/data",
    params={"q": "casa", "mode": "lemma", "draw": "1", "start": "0", "length": "5"},
)
print(f"  Status: {flask_response.status_code}")
flask_data = flask_response.json()
print(f"  recordsTotal: {flask_data.get('recordsTotal', 'N/A')}")
print(f"  recordsFiltered: {flask_data.get('recordsFiltered', 'N/A')}")
print(f"  data items: {len(flask_data.get('data', []))}")
if flask_data.get("error"):
    print(f"  ERROR: {flask_data['error']}")
