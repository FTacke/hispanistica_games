#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
add_quiz_units.py

Reads CSV/TSV quiz question files (Google Sheets export) and writes quiz_unit_v2 JSON units.

Input dir (default):  scripts/quiz_units/input
Output dir (default): scripts/quiz_units/json_output

Stable columns (must match exactly):
- Schwierigkeit
- Fragetext (DE)
- Erklärung (DE)
- Korrekte Antwort (DE)
- Falsche Antwort 1 (DE)
- Falsche Antwort 2 (DE)
- Falsche Antwort 3 (DE)
- Autor:in

Rules:
- Required-but-missing topic fields become "TODO"
- question IDs: <topic_id>_q_<ULID>
- answers: a1 correct, a2-a4 wrong
- statistics per unit: questions_statistics difficulty_1/2/3
- sort questions by difficulty asc (stable within same difficulty)
- if output exists: ask interactively to overwrite (unless --force)
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import secrets
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


# ---------- ULID handling (as in old script) ----------

CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _encode_crockford_base32(value: int, length: int) -> str:
    chars = ["0"] * length
    for index in range(length - 1, -1, -1):
        value, remainder = divmod(value, 32)
        chars[index] = CROCKFORD_BASE32[remainder]
    return "".join(chars)


def _fallback_ulid_str() -> str:
    """Generate a valid 26-character ULID using only the standard library."""
    timestamp_ms = int(time.time() * 1000)
    if timestamp_ms >= 2**48:
        raise RuntimeError(f"Timestamp exceeds ULID range: {timestamp_ms}")

    randomness = secrets.randbits(80)
    ulid_value = (timestamp_ms << 80) | randomness
    return _encode_crockford_base32(ulid_value, 26)

def new_ulid_str() -> str:
    """
    Returns a 26-character ULID string.

    Preferred path: use an installed ULID library if available.
    Fallback path: generate a standards-compliant ULID locally.
    """
    try:
        import ulid  # type: ignore
    except Exception:
        return _fallback_ulid_str()

    # Try common variants
    if hasattr(ulid, "new"):
        u = ulid.new()
        s = str(u)
    elif hasattr(ulid, "ULID"):
        u = ulid.ULID()
        s = str(u)
    else:
        return _fallback_ulid_str()

    if len(s) != 26:
        return _fallback_ulid_str()

    return s


# ---------- Constants ----------

REQUIRED_HEADERS = [
    "Schwierigkeit",
    "Fragetext (DE)",
    "Erklärung (DE)",
    "Korrekte Antwort (DE)",
    "Falsche Antwort 1 (DE)",
    "Falsche Antwort 2 (DE)",
    "Falsche Antwort 3 (DE)",
    "Autor:in",
]


@dataclass
class RowIssue:
    level: str  # "ERROR" | "WARN"
    file: str
    rownum: int
    message: str


# ---------- Helpers ----------

def slugify(name: str) -> str:
    """
    Conservative slugify: lowercase, keep a-z0-9 and underscores, collapse others to '_'.
    Ensures <= 50 chars (as per topic id rules in docs).
    """
    s = name.strip().lower()
    s = s.replace(" ", "_")
    s = re.sub(r"[^a-z0-9_]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        s = "todo"
    return s[:50]


def detect_delimiter(sample_line: str, sample_text: str) -> str:
    """
    Prefer TSV if tabs are present; else sniff among ',' and ';'.
    """
    if "\t" in sample_line:
        return "\t"
    sniffer = csv.Sniffer()
    try:
        dialect = sniffer.sniff(sample_text, delimiters=[",", ";"])
        return dialect.delimiter
    except Exception:
        # Fallback: prefer semicolon in DE locales, else comma
        return ";" if sample_line.count(";") >= sample_line.count(",") else ","


def read_text(path: Path) -> str:
    # UTF-8 with BOM tolerant (Google exports sometimes include BOM)
    return path.read_text(encoding="utf-8-sig", errors="strict")


def normalize_cell(s: Optional[str]) -> str:
    if s is None:
        return ""
    # keep internal newlines (explanations might have them)
    return s.strip()


def prompt_overwrite(out_path: Path) -> bool:
    while True:
        ans = input(f"Output exists: {out_path.name}. Overwrite? [y/N] ").strip().lower()
        if ans in ("y", "yes"):
            return True
        if ans in ("", "n", "no"):
            return False
        print("Please answer 'y' or 'n'.")


# ---------- Core transformation ----------

def validate_headers(headers: List[str]) -> Tuple[bool, List[str]]:
    missing = [h for h in REQUIRED_HEADERS if h not in headers]
    return (len(missing) == 0, missing)


def parse_rows_with_line_numbers(text: str, delim: str) -> Tuple[List[str], List[Tuple[int, Dict[str, str]]]]:
    """
    Parse tabular text into headers + row dicts with original source line numbers.

    Robustness behavior:
    - Trailing/inner fully empty lines are ignored.
    - Header-duplicate rows inside the data section are dropped.
    """
    reader = csv.reader(text.splitlines(), delimiter=delim)
    parsed = list(reader)
    if not parsed:
        return [], []

    headers = [normalize_cell(cell) for cell in parsed[0]]
    data_rows: List[Tuple[int, Dict[str, str]]] = []

    for rownum, raw_row in enumerate(parsed[1:], start=2):
        cells = [normalize_cell(cell) for cell in raw_row]

        # Drop fully empty rows (including trailing empties).
        if not any(cells):
            continue

        if len(cells) < len(headers):
            cells.extend([""] * (len(headers) - len(cells)))

        row_dict = {headers[idx]: cells[idx] for idx in range(len(headers))}

        # Drop accidental header-duplicate rows inside data.
        if all(row_dict.get(h, "") == h for h in headers):
            continue

        data_rows.append((rownum, row_dict))

    return headers, data_rows


def build_unit_from_rows(
    slug: str,
    topic_title: str,
    rows: List[Tuple[int, Dict[str, str]]],
    source_file: str,
) -> Tuple[dict, List[RowIssue]]:
    issues: List[RowIssue] = []
    questions: List[Tuple[int, int, dict]] = []

    # Collect authors
    authors_set = set()

    stats = {1: 0, 2: 0, 3: 0}

    for stable_index, (idx, row) in enumerate(rows):
        diff_raw = normalize_cell(row.get("Schwierigkeit"))
        prompt = normalize_cell(row.get("Fragetext (DE)"))
        expl = normalize_cell(row.get("Erklärung (DE)"))
        correct = normalize_cell(row.get("Korrekte Antwort (DE)"))
        wrong1 = normalize_cell(row.get("Falsche Antwort 1 (DE)"))
        wrong2 = normalize_cell(row.get("Falsche Antwort 2 (DE)"))
        wrong3 = normalize_cell(row.get("Falsche Antwort 3 (DE)"))
        author = normalize_cell(row.get("Autor:in"))

        if author:
            authors_set.add(author)

        # Difficulty
        try:
            difficulty = int(diff_raw)
        except Exception:
            issues.append(RowIssue("ERROR", source_file, idx, f"Invalid Schwierigkeit: '{diff_raw}' (must be 1-3)"))
            continue

        if difficulty not in (1, 2, 3):
            issues.append(RowIssue("ERROR", source_file, idx, f"Invalid Schwierigkeit: {difficulty} (must be 1-3)"))
            continue

        # Required question fields
        if not prompt:
            issues.append(RowIssue("ERROR", source_file, idx, "Fragetext (DE) is empty"))
            continue
        if not correct:
            issues.append(RowIssue("ERROR", source_file, idx, "Korrekte Antwort (DE) is empty"))
            continue

        # Wrong answers: fill with TODO if missing, but warn
        wrongs = [wrong1, wrong2, wrong3]
        for wi, w in enumerate(wrongs, start=1):
            if not w:
                issues.append(RowIssue("WARN", source_file, idx, f"Falsche Antwort {wi} is empty -> using 'TODO'"))
                wrongs[wi - 1] = "TODO"

        qid = f"{slug}_q_{new_ulid_str()}"

        qobj = {
            "difficulty": difficulty,
            "type": "single_choice",
            "prompt": prompt,
            "explanation": expl if expl else "TODO",
            "answers": [
                {"text": correct, "correct": True, "id": "a1", "media": []},
                {"text": wrongs[0], "correct": False, "id": "a2", "media": []},
                {"text": wrongs[1], "correct": False, "id": "a3", "media": []},
                {"text": wrongs[2], "correct": False, "id": "a4", "media": []},
            ],
            "media": [],
            "sources": [],
            "id": qid,
        }

        if author:
            qobj["meta"] = {"author_initials": author}

        questions.append((difficulty, stable_index, qobj))
        stats[difficulty] += 1

    # Sort by difficulty ascending, stable within same difficulty
    questions_sorted = [q for _, __, q in sorted(questions, key=lambda t: (t[0], t[1]))]

    unit = {
        "schema_version": "quiz_unit_v2",
        "slug": slug,
        "title": topic_title,
        "description": "TODO",
        "authors": sorted(authors_set) if authors_set else ["TODO"],
        "based_on": {
            "chapter_title": topic_title,
            "chapter_url": None,
            "course_title": "TODO",
            "course_url": None,
        },
        "is_active": True,
        "order_index": 1,
        "questions_statistics": {
            "1": stats[1],
            "2": stats[2],
            "3": stats[3],
        },
        "questions": questions_sorted,
    }

    return unit, issues


def process_file(in_path: Path, out_dir: Path, force: bool) -> Tuple[Optional[Path], List[RowIssue]]:
    issues: List[RowIssue] = []
    try:
        text = read_text(in_path)
    except Exception as e:
        return None, [RowIssue("ERROR", in_path.name, 0, f"Failed to read file: {e}")]

    lines = text.splitlines()
    if not lines:
        return None, [RowIssue("ERROR", in_path.name, 0, "Empty file")]

    delim = detect_delimiter(lines[0], text)

    # Parse with robust row preprocessing
    headers, rows = parse_rows_with_line_numbers(text, delim)
    ok, missing = validate_headers(headers)
    if not ok:
        return None, [RowIssue("ERROR", in_path.name, 1, f"Missing required headers: {missing}")]

    topic_title = in_path.stem  # readable title
    slug = slugify(in_path.stem)  # required id

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{slug}.json"

    if out_path.exists() and not force:
        if not prompt_overwrite(out_path):
            issues.append(RowIssue("WARN", in_path.name, 0, f"Skipped (output exists): {out_path.name}"))
            return None, issues

    unit, unit_issues = build_unit_from_rows(slug, topic_title, rows, in_path.name)
    issues.extend(unit_issues)

    # If any ERROR issues, do not write
    if any(i.level == "ERROR" for i in issues):
        return None, issues

    try:
        out_path.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception as e:
        return None, [RowIssue("ERROR", in_path.name, 0, f"Failed to write JSON: {e}")]

    return out_path, issues


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Build quiz_unit_v2 JSON units from CSV/TSV inputs.")
    parser.add_argument(
        "--input-dir",
        type=str,
        default=None,
        help="Directory containing CSV/TSV input files. Default: scripts/quiz_units/csv_input",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Directory to write JSON output files. Default: scripts/quiz_units/json_output",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing output files without prompting.",
    )

    args = parser.parse_args(argv)

    script_dir = Path(__file__).resolve().parent
    if args.input_dir:
        input_dir = Path(args.input_dir)
    else:
        preferred_input_dir = script_dir / "csv_input"
        legacy_input_dir = script_dir / "input"
        input_dir = preferred_input_dir if preferred_input_dir.exists() else legacy_input_dir
    output_dir = Path(args.output_dir) if args.output_dir else (script_dir / "json_output")

    if not input_dir.exists():
        print(f"ERROR: Input dir not found: {input_dir}", file=sys.stderr)
        return 1

    input_files = sorted(
        [p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() in (".csv", ".tsv", ".txt")]
    )
    if not input_files:
        print(f"ERROR: No input files found in: {input_dir}", file=sys.stderr)
        return 1

    any_errors = False
    written = 0

    for in_path in input_files:
        out_path, issues = process_file(in_path, output_dir, force=args.force)

        # Print issues
        for iss in issues:
            stream = sys.stderr if iss.level == "ERROR" else sys.stdout
            loc = f"{iss.file}:{iss.rownum}" if iss.rownum else iss.file
            print(f"{iss.level}: {loc}: {iss.message}", file=stream)

        if out_path:
            written += 1
            print(f"OK: Wrote {out_path}")
        else:
            # If not written because of errors, mark
            if any(i.level == "ERROR" for i in issues):
                any_errors = True

    print(f"Done. Files written: {written} / {len(input_files)}")
    return 1 if any_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
