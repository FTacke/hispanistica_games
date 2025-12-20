#!/usr/bin/env python3
"""Test login with admin credentials."""

import requests
import re

BASE_URL = "http://127.0.0.1:8000"


def test_login():
    """Test login with admin/Felix1!!!"""
    session = requests.Session()

    # Get login page and extract CSRF token
    resp = session.get(f"{BASE_URL}/auth/login")
    print(f"GET /auth/login: {resp.status_code}")

    # Extract CSRF token
    csrf_match = re.search(r'name="csrf_token"\s*value="([^"]+)"', resp.text)
    if not csrf_match:
        print("ERROR: No CSRF token found in response")
        return

    csrf_token = csrf_match.group(1)
    print(f"CSRF Token: {csrf_token[:30]}...")

    # Attempt login
    login_data = {
        "username": "admin",
        "password": "Felix1!!!",
        "csrf_token": csrf_token,
    }

    resp = session.post(
        f"{BASE_URL}/auth/login", data=login_data, allow_redirects=False
    )

    print(f"\nPOST /auth/login: {resp.status_code}")
    print(f"Headers: {dict(resp.headers)}")

    if resp.status_code in (302, 303):
        print(f"Redirect to: {resp.headers.get('Location')}")
        print("LOGIN SUCCESS!")
    elif resp.status_code == 204:
        print(f"HX-Redirect: {resp.headers.get('HX-Redirect')}")
        print("LOGIN SUCCESS (HTMX)!")
    else:
        print("\nResponse body snippet:")
        # Show relevant part of error
        if "500" in resp.text or "Error" in resp.text:
            print("SERVER ERROR DETECTED")
            # Try to find traceback
            if "Traceback" in resp.text:
                start = resp.text.find("Traceback")
                print(resp.text[start : start + 2000])
            else:
                print(resp.text[:1000])
        else:
            print(resp.text[:500])


if __name__ == "__main__":
    test_login()
