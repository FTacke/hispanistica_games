#!/usr/bin/env python3
"""
md3-autofix.py

Conservative auto-fix script for MD3 structural compliance issues.
Only applies safe, non-destructive fixes.

Features:
- Dry-run mode (default)
- Scoped fixes (--scope path)
- Exclusion of DataTables templates (templates/search/advanced*)
- Detailed change log

Safe auto-fixes:
- Add aria-modal="true" to dialogs
- Add aria-labelledby when title ID exists
- Add form="id" to orphan submit buttons (single-form files)

NOT auto-fixed (manual review required):
- Reordering card/dialog blocks
- Changing class names
- Complex structural changes

Usage:
    python scripts/md3-autofix.py                          # Dry-run all
    python scripts/md3-autofix.py --dry-run                # Explicit dry-run
    python scripts/md3-autofix.py --apply                  # Apply fixes
    python scripts/md3-autofix.py --apply --scope templates/auth  # Scope to auth

See: docs/md3-template/md3-structural-compliance.md
"""

import re
import json
from pathlib import Path
import argparse
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]

# Exclusions: These paths will NEVER be auto-fixed
EXCLUDED_PATHS = {
    "templates/search/advanced",  # DataTables legacy
}

IGNORED_DIRS = {".venv", "node_modules", ".git", "build", "__pycache__", "data"}


@dataclass
class Fix:
    file: str
    line: int
    rule: str
    description: str
    original: str
    fixed: str
    applied: bool = False


def is_excluded_path(path: str) -> bool:
    """Check if path should be excluded from auto-fixes."""
    normalized = path.replace("\\", "/")
    return any(normalized.startswith(ex) for ex in EXCLUDED_PATHS)


def should_skip_file(path: Path) -> bool:
    """Check if file should be skipped."""
    return any(part in IGNORED_DIRS for part in path.parts)


def get_line_number(content: str, pos: int) -> int:
    """Return 1-based line number for a position in content."""
    return content[:pos].count("\n") + 1


# ─────────────────────────────────────────────────────────────────────────────
# Fix Functions
# ─────────────────────────────────────────────────────────────────────────────


def fix_dialog_aria_modal(content: str, rel_path: str) -> Tuple[str, List[Fix]]:
    """Add aria-modal="true" to dialogs that are missing it."""
    fixes = []

    # Find dialogs missing aria-modal
    pattern = re.compile(
        r'(<(?:dialog|div)[^>]*class\s*=\s*"[^"]*\bmd3-dialog\b[^"]*"[^>]*)'
        r"(?![^>]*aria-modal\s*=)"  # Not followed by aria-modal
        r"([^>]*>)",
        re.I,
    )

    def replacer(match):
        tag_start = match.group(1)
        tag_end = match.group(2)
        line = get_line_number(content, match.start())

        # Insert aria-modal="true" before the closing >
        fixed_tag = f'{tag_start} aria-modal="true"{tag_end}'

        fixes.append(
            Fix(
                file=rel_path,
                line=line,
                rule="MD3-DIALOG-005",
                description='Add aria-modal="true"',
                original=match.group(0)[:80],
                fixed=fixed_tag[:80],
            )
        )

        return fixed_tag

    new_content = pattern.sub(replacer, content)
    return new_content, fixes


def fix_dialog_aria_labelledby(content: str, rel_path: str) -> Tuple[str, List[Fix]]:
    """Add aria-labelledby to dialogs when a title with ID exists."""
    fixes = []

    # Find dialogs missing aria-labelledby/aria-label
    dialog_pattern = re.compile(
        r'(<(?:dialog|div)[^>]*class\s*=\s*"[^"]*\bmd3-dialog\b[^"]*"[^>]*)'
        r"(?![^>]*aria-label(?:ledby)?\s*=)"  # Not followed by aria-label or aria-labelledby
        r"([^>]*>)",
        re.I,
    )

    # Find title IDs in the content
    title_id_pattern = re.compile(
        r'<h[1-6][^>]*class\s*=\s*"[^"]*(?:md3-dialog__title|md3-title-large)[^"]*"[^>]*'
        r'id\s*=\s*["\']([^"\']+)["\']',
        re.I,
    )

    # Collect all title IDs
    title_ids = [m.group(1) for m in title_id_pattern.finditer(content)]

    if not title_ids:
        return content, fixes

    # Use the first title ID found
    default_title_id = title_ids[0]

    def replacer(match):
        tag_start = match.group(1)
        tag_end = match.group(2)
        line = get_line_number(content, match.start())

        # Insert aria-labelledby
        fixed_tag = f'{tag_start} aria-labelledby="{default_title_id}"{tag_end}'

        fixes.append(
            Fix(
                file=rel_path,
                line=line,
                rule="MD3-DIALOG-006",
                description=f'Add aria-labelledby="{default_title_id}"',
                original=match.group(0)[:80],
                fixed=fixed_tag[:80],
            )
        )

        return fixed_tag

    new_content = dialog_pattern.sub(replacer, content)
    return new_content, fixes


def fix_orphan_submit_button(content: str, rel_path: str) -> Tuple[str, List[Fix]]:
    """Add form="id" to submit buttons outside forms (single-form files only)."""
    fixes = []

    # Count forms and get their IDs
    form_pattern = re.compile(r'<form[^>]*id\s*=\s*["\']([^"\']+)["\'][^>]*>', re.I)
    forms = list(form_pattern.finditer(content))

    # Only auto-fix if there's exactly one form with an ID
    if len(forms) != 1:
        return content, fixes

    form_id = forms[0].group(1)
    form_start = forms[0].start()
    form_close = content.find("</form>", form_start)
    if form_close == -1:
        form_close = len(content)

    # Find submit buttons without form attribute
    submit_pattern = re.compile(
        r'(<button[^>]*type\s*=\s*["\']submit["\'][^>]*)'
        r"(?![^>]*\bform\s*=)"  # Not followed by form=
        r"([^>]*>)",
        re.I,
    )

    def replacer(match):
        pos = match.start()

        # Check if inside the form
        if form_start < pos < form_close:
            return match.group(0)  # Inside form, no fix needed

        tag_start = match.group(1)
        tag_end = match.group(2)
        line = get_line_number(content, pos)

        # Add form attribute
        fixed_tag = f'{tag_start} form="{form_id}"{tag_end}'

        fixes.append(
            Fix(
                file=rel_path,
                line=line,
                rule="MD3-FORM-001",
                description=f'Add form="{form_id}" to orphan submit button',
                original=match.group(0)[:80],
                fixed=fixed_tag[:80],
            )
        )

        return fixed_tag

    new_content = submit_pattern.sub(replacer, content)
    return new_content, fixes


def fix_legacy_button_contained(content: str, rel_path: str) -> Tuple[str, List[Fix]]:
    """Replace md3-button--contained with md3-button--filled."""
    fixes = []

    pattern = re.compile(r"md3-button--contained")

    def replacer(match):
        line = get_line_number(content, match.start())

        fixes.append(
            Fix(
                file=rel_path,
                line=line,
                rule="MD3-LEGACY-003",
                description="Replace md3-button--contained with md3-button--filled",
                original="md3-button--contained",
                fixed="md3-button--filled",
            )
        )

        return "md3-button--filled"

    new_content = pattern.sub(replacer, content)
    return new_content, fixes


def fix_legacy_login_sheet(content: str, rel_path: str) -> Tuple[str, List[Fix]]:
    """Replace md3-login-sheet with md3-sheet."""
    fixes = []

    pattern = re.compile(r"md3-login-sheet")

    def replacer(match):
        line = get_line_number(content, match.start())

        fixes.append(
            Fix(
                file=rel_path,
                line=line,
                rule="MD3-LEGACY-004",
                description="Replace md3-login-sheet with md3-sheet",
                original="md3-login-sheet",
                fixed="md3-sheet",
            )
        )

        return "md3-sheet"

    new_content = pattern.sub(replacer, content)
    return new_content, fixes


# ─────────────────────────────────────────────────────────────────────────────
# Main Auto-Fix Engine
# ─────────────────────────────────────────────────────────────────────────────


def process_file(path: Path, root: Path, apply: bool = False) -> List[Fix]:
    """Process a single file and return/apply fixes."""
    all_fixes = []

    try:
        content = path.read_text(encoding="utf8", errors="ignore")
    except Exception as e:
        print(f"  ⚠️  Could not read {path}: {e}")
        return all_fixes

    rel_path = str(path.relative_to(root)).replace("\\", "/")

    # Check exclusions
    if is_excluded_path(rel_path):
        print(f"  ⏭️  Skipping (excluded): {rel_path}")
        return all_fixes

    original_content = content

    # Apply fix functions in order
    fix_functions = [
        fix_dialog_aria_modal,
        fix_dialog_aria_labelledby,
        fix_orphan_submit_button,
        fix_legacy_button_contained,
        fix_legacy_login_sheet,
    ]

    for fix_fn in fix_functions:
        content, fixes = fix_fn(content, rel_path)
        all_fixes.extend(fixes)

    # Write back if applying and there were changes
    if apply and content != original_content:
        try:
            path.write_text(content, encoding="utf8")
            for fix in all_fixes:
                fix.applied = True
            print(f"  ✅ Applied {len(all_fixes)} fix(es) to {rel_path}")
        except Exception as e:
            print(f"  ❌ Could not write {path}: {e}")
            for fix in all_fixes:
                fix.applied = False
    elif all_fixes:
        print(f"  📝 Found {len(all_fixes)} potential fix(es) in {rel_path}")

    return all_fixes


def scan_and_fix(
    root: Path, scope: Optional[str] = None, apply: bool = False
) -> List[Fix]:
    """Scan directory and collect/apply fixes."""
    all_fixes = []
    include_exts = {".html", ".jinja", ".jinja2"}

    if scope:
        scan_path = root / scope
        if not scan_path.exists():
            print(f"❌ Scope path does not exist: {scan_path}")
            return all_fixes

        if scan_path.is_file():
            all_fixes.extend(process_file(scan_path, root, apply))
        else:
            for p in scan_path.rglob("*"):
                if should_skip_file(p):
                    continue
                if p.is_file() and p.suffix.lower() in include_exts:
                    all_fixes.extend(process_file(p, root, apply))
    else:
        # Scan templates directory
        templates_dir = root / "templates"
        if templates_dir.exists():
            for p in templates_dir.rglob("*"):
                if should_skip_file(p):
                    continue
                if p.is_file() and p.suffix.lower() in include_exts:
                    all_fixes.extend(process_file(p, root, apply))

    return all_fixes


def generate_report(fixes: List[Fix], output_path: Path):
    """Generate JSON report of fixes."""
    report = {
        "generated": datetime.now().isoformat(),
        "summary": {
            "total": len(fixes),
            "applied": len([f for f in fixes if f.applied]),
            "pending": len([f for f in fixes if not f.applied]),
        },
        "by_rule": {},
        "fixes": [asdict(f) for f in fixes],
    }

    # Group by rule
    for fix in fixes:
        if fix.rule not in report["by_rule"]:
            report["by_rule"][fix.rule] = {"count": 0, "applied": 0}
        report["by_rule"][fix.rule]["count"] += 1
        if fix.applied:
            report["by_rule"][fix.rule]["applied"] += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf8") as f:
        json.dump(report, f, indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="MD3 Conservative Auto-Fix Script")
    parser.add_argument("--root", default=str(ROOT), help="Root directory")
    parser.add_argument("--scope", help="Scope to specific path (relative to root)")
    parser.add_argument(
        "--apply", action="store_true", help="Actually apply fixes (default: dry-run)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be fixed without changing files",
    )
    parser.add_argument(
        "--report",
        default="docs/md3-template/md3_autofix_report.json",
        help="JSON report output path",
    )

    args = parser.parse_args()
    root = Path(args.root)

    # --dry-run is default, --apply overrides
    apply = args.apply and not args.dry_run

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"🔧 MD3 Auto-Fix ({mode})")
    print(f"   Root: {root}")
    if args.scope:
        print(f"   Scope: {args.scope}")
    print(f"   Excluded: {', '.join(EXCLUDED_PATHS)}")
    print()

    fixes = scan_and_fix(root, args.scope, apply)

    # Generate report
    report_path = root / args.report
    generate_report(fixes, report_path)
    print(f"\n📄 Report: {report_path}")

    # Summary
    applied = len([f for f in fixes if f.applied])
    pending = len([f for f in fixes if not f.applied])

    print("\n📋 Summary:")
    print(f"   Total fixes found: {len(fixes)}")
    if apply:
        print(f"   Applied: {applied}")
        print(f"   Failed: {pending}")
    else:
        print(f"   Pending (dry-run): {pending}")

    # Show fix details
    if fixes:
        print("\n📝 Fix Details:")
        for fix in fixes[:20]:  # Show first 20
            status = "✅" if fix.applied else "📝"
            print(f"   {status} {fix.file}:{fix.line} [{fix.rule}] {fix.description}")
        if len(fixes) > 20:
            print(f"   ... and {len(fixes) - 20} more")

    if not apply and fixes:
        print("\n💡 Run with --apply to apply these fixes")


if __name__ == "__main__":
    main()
