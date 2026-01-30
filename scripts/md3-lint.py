#!/usr/bin/env python3
"""MD3 Linting

Checks Material Design 3 compliance in templates and CSS.
Includes dashboard-specific token guardrails.
"""
from __future__ import annotations

from pathlib import Path
import re
import sys


DASHBOARD_FILES = [
    Path("templates/admin/quiz_content.html"),
    Path("static/css/admin/quiz_content.css"),
    Path("static/js/admin/quiz_content.js"),
]

INLINE_STYLE_RE = re.compile(r"\bstyle\s*=", re.IGNORECASE)
HARDCODED_COLOR_RE = re.compile(r"#(?:[0-9a-fA-F]{3,8})\b|rgb\(|hsl\(", re.IGNORECASE)


def _scan_file(path: Path) -> list[str]:
    errors: list[str] = []
    if not path.exists():
        return errors

    for idx, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if INLINE_STYLE_RE.search(line):
            errors.append(f"{path}:{idx}: Inline styles are not allowed in dashboard UI.")
        if HARDCODED_COLOR_RE.search(line):
            errors.append(f"{path}:{idx}: Hardcoded color values are not allowed in dashboard UI.")
    return errors


def main() -> None:
    """Run MD3 lint checks."""
    print("Running MD3 lint checks...")
    print("  Note: Full linting is done via md3-forms-auth-guard.py")

    errors: list[str] = []
    for file_path in DASHBOARD_FILES:
        errors.extend(_scan_file(file_path))

    if errors:
        print("❌ MD3 lint failed (dashboard token guard)")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)

    print("✅ MD3 lint passed")
    sys.exit(0)


if __name__ == "__main__":
    main()
