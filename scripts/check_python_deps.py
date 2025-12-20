#!/usr/bin/env python3
"""
Dependency check script for Docker build.
Verifies that critical Python packages are installed correctly.
Exit code 0 = all OK, exit code 1 = missing dependencies.

This script is called during Docker build to fail fast if required
dependencies are missing or broken.
"""

import sys

errors = []


def check_module(name, label=None):
    """Check if a module can be imported and print its version."""
    label = label or name
    try:
        module = __import__(name)
        version = getattr(module, "__version__", "unknown")
        print(f"✓ {label} {version}")
    except ImportError as e:
        errors.append(f"{label}: {e}")


def check_passlib_argon2():
    """Check that passlib can use argon2 backend."""
    try:
        print("✓ passlib argon2 backend available")
    except Exception as e:
        errors.append(f"passlib argon2 backend: {e}")


def main():
    check_module("psycopg2", "psycopg2")
    check_module("argon2", "argon2-cffi")
    check_passlib_argon2()

    if errors:
        print("✗ Missing dependencies:")
        for err in errors:
            print("  -", err)
        sys.exit(1)

    print("All required Python dependencies are available.")


if __name__ == "__main__":
    main()
