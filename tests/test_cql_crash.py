"""Quick test to reproduce CQL crash."""

import sys
import os

# Set environment
os.environ["FLASK_ENV"] = "development"
os.environ["BLS_BASE_URL"] = "http://localhost:8081/blacklab-server"

# Add src to path
sys.path.insert(0, "src")

from app import create_app
from werkzeug.test import Client

print("=" * 80)
print("Testing CQL crash scenario with full Flask app")
print("=" * 80)

try:
    print("\n1. Creating Flask app...")
    app = create_app("development")

    print("\n2. Creating test client...")
    client = Client(app)

    print("\n3. Making test request...")
    response = client.get(
        "/search/advanced/data?q=casa&mode=lemma&country_code=VEN&length=5&draw=1"
    )

    print(f"\n4. Response status: {response.status_code}")
    print(f"   Response data length: {len(response.data)} bytes")

    if response.status_code == 200:
        import json

        data = json.loads(response.data)
        print(f"   recordsTotal: {data.get('recordsTotal')}")
        print(f"   recordsFiltered: {data.get('recordsFiltered')}")
        print(f"   data length: {len(data.get('data', []))}")
        print("\n✓ SUCCESS - No crash!")
    else:
        print(f"\n✗ ERROR: Status {response.status_code}")
        print(response.data.decode("utf-8")[:500])

except Exception as e:
    print(f"\n✗ CRASH: {type(e).__name__}: {e}")
    import traceback

    traceback.print_exc()
