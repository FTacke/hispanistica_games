#!/usr/bin/env python3
"""
Project Structure Check

Validates basic project structure is intact.
Exits with code 0 if OK, 2 if problems found.
"""
import sys
from pathlib import Path

# Critical directories that must exist
REQUIRED_DIRS = [
    "src/app",
    "tests",
    "scripts",
    "templates",
    "static",
]

# Critical files that must exist
REQUIRED_FILES = [
    "pyproject.toml",
    "requirements.txt",
    "README.md",
    "Dockerfile",
]


def main():
    """Check project structure."""
    repo_root = Path(__file__).parent.parent
    errors = []
    
    print("Checking project structure...")
    
    # Check directories
    for dir_path in REQUIRED_DIRS:
        full_path = repo_root / dir_path
        if not full_path.exists():
            errors.append(f"Missing directory: {dir_path}")
        elif not full_path.is_dir():
            errors.append(f"Not a directory: {dir_path}")
    
    # Check files
    for file_path in REQUIRED_FILES:
        full_path = repo_root / file_path
        if not full_path.exists():
            errors.append(f"Missing file: {file_path}")
        elif not full_path.is_file():
            errors.append(f"Not a file: {file_path}")
    
    if errors:
        print("❌ Structure check FAILED:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(2)
    
    print("✅ Structure check passed")
    sys.exit(0)


if __name__ == "__main__":
    main()
