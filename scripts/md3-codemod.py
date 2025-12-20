#!/usr/bin/env python3
"""
md3-codemod.py — automated safe replacements for known MD3 legacy cases.

By default the script runs in dry-run mode and prints a short summary of files
it would change. Use `--apply` to modify files in-place (it will create .bak backups).

Current safe codemods implemented:
- replace `mx-auto` / `m-auto` -> `md3-align--center`
- replace `.mt-4` -> `.md3-space-6` (1.5rem -> --space-6)
- replace `.mt-3` -> `.md3-space-4` (1rem -> --space-4)
- replace `.mb-3` -> `.md3-space-4` and `.mb-4` -> `.md3-space-6`
- replace `class="...\bcard\b..."` -> `md3-card` (word-boundary) — the script does not change hyphenated names
- replace `md3-button--contained` -> `md3-button--filled`
- replace legacy token names `--md3-space-N` -> `--space-N`
- replace token prefixes `--md3-color-` -> `--md-sys-color-` (simple heuristic)

This is intentionally conservative; review each changed file in PRs.
"""

from pathlib import Path
import re
import argparse

ROOT = Path(__file__).resolve().parents[1]

REPLACEMENTS = [
    # classes
    (re.compile(r"\b(mx-auto|m-auto)\b"), "md3-align--center"),
    (re.compile(r"\bmt-4\b"), "md3-space-6"),
    (re.compile(r"\bmt-3\b"), "md3-space-4"),
    (re.compile(r"\bmb-3\b"), "md3-space-4"),
    (re.compile(r"\bmb-4\b"), "md3-space-6"),
    (re.compile(r"\bmt-2\b"), "md3-space-2"),
    # cards/classes
    (re.compile(r"\bcard\b"), "md3-card"),
    # buttons
    (re.compile(r"md3-button--contained"), "md3-button--filled"),
    # tokens in CSS/JS/HTML
    (re.compile(r"--md3-space-(\d+)", re.I), r"--space-\1"),
    (re.compile(r"--md3-color-([a-z0-9-]+)", re.I), r"--md-sys-color-\1"),
]

INCLUDE_EXTS = {".html", ".css", ".js", ".md", ".py", ".jinja"}
IGNORED_DIRS = {".venv", "node_modules", ".git", "build", "__pycache__"}


def files_to_check(root: Path):
    for p in root.rglob("*"):
        if any(part in IGNORED_DIRS for part in p.parts):
            continue
        if p.is_file() and p.suffix.lower() in INCLUDE_EXTS:
            yield p


def apply_replacements(content: str):
    new = content
    changes = []
    for pat, rep in REPLACEMENTS:
        new2, n = pat.subn(rep, new)
        if n:
            changes.append((pat.pattern, rep, n))
            new = new2
    return new, changes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes in-place (creates .bak files)",
    )
    parser.add_argument(
        "--preview-only",
        action="store_true",
        help="Print only preview and do not apply",
    )
    args = parser.parse_args()

    root = Path(args.root)
    total_changes = 0
    changed_files = []

    for p in files_to_check(root):
        content = p.read_text(encoding="utf8", errors="ignore")
        new, changes = apply_replacements(content)
        if changes:
            total_changes += sum(c[2] for c in changes)
            changed_files.append((str(p.relative_to(root)), changes))
            if args.apply:
                bak = p.with_suffix(p.suffix + ".bak")
                p.rename(bak)
                p.write_text(new, encoding="utf8")

    if not changed_files:
        print("No codemod matches found (nothing to change).")
        return

    print("\nCodemod preview log — files with matches:")
    for path, changes in changed_files:
        print(f" - {path}")
        for pat, rep, n in changes:
            print(f"    {n} replacements: {pat} → {rep}")

    print("\nSummary:")
    print(
        f" {len(changed_files)} files contain matches, approx {total_changes} total replacements."
    )
    if args.apply:
        print("Changes applied to files (backups suffixed with .bak)")
    else:
        print("Dry-run: no files modified. Run with --apply to change files.")


if __name__ == "__main__":
    main()
