#!/usr/bin/env python3
"""Migrate quiz content difficulty from 1-5 to 1-3 and write *_v2.json files.

Mapping (documented, deterministic):
- 1 -> 1
- 2 -> 1
- 3 -> 2
- 4 -> 2
- 5 -> 3

Writes new <basename>_v2.json files in the same directory.
Validates migrated content with validate_quiz_unit and enforces minimum counts (4/4/2).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from game_modules.quiz.validation import validate_quiz_unit, ValidationError


logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


DIFFICULTY_MAP = {
    1: 1,
    2: 1,
    3: 2,
    4: 2,
    5: 3,
}


def _load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _update_question_stats(data: Dict[str, Any]) -> None:
    if "questions_statistics" not in data:
        return
    counts: Dict[str, int] = {"1": 0, "2": 0, "3": 0}
    for q in data.get("questions", []):
        diff = q.get("difficulty")
        if isinstance(diff, int) and 1 <= diff <= 3:
            counts[str(diff)] += 1
    data["questions_statistics"] = counts


def _check_min_counts(data: Dict[str, Any]) -> list[str]:
    errors = []
    counts: Dict[int, int] = {1: 0, 2: 0, 3: 0}
    for q in data.get("questions", []):
        diff = q.get("difficulty")
        if isinstance(diff, int) and diff in counts:
            counts[diff] += 1
    required = {1: 4, 2: 4, 3: 2}
    for d, req in required.items():
        if counts.get(d, 0) < req:
            errors.append(f"Difficulty {d}: need at least {req}, got {counts.get(d, 0)}")
    return errors


def migrate_file(json_path: Path, patch_to_min: bool = False) -> bool:
    data = _load_json(json_path)
    questions = data.get("questions", [])
    if not isinstance(questions, list):
        logger.error("%s: missing or invalid 'questions' array", json_path.name)
        return False

    for q in questions:
        if "difficulty" not in q:
            continue
        diff = q.get("difficulty")
        if not isinstance(diff, int):
            logger.error("%s: invalid difficulty value: %s", json_path.name, diff)
            return False
        if diff not in DIFFICULTY_MAP:
            logger.error("%s: unsupported difficulty %s (expected 1-5)", json_path.name, diff)
            return False
        q["difficulty"] = DIFFICULTY_MAP[diff]

    _update_question_stats(data)

    try:
        validate_quiz_unit(data, filename=json_path.name)
    except ValidationError as exc:
        logger.error("%s: validation failed after migration", json_path.name)
        for err in exc.errors:
            logger.error("  - %s", err)
        return False

    min_errors = _check_min_counts(data)
    if min_errors:
        logger.error("%s: minimum count check failed", json_path.name)
        for err in min_errors:
            logger.error("  - %s", err)
        if patch_to_min:
            logger.error("--patch-to-min requested, but auto-duplication is not supported. Please add questions manually.")
        return False

    output_path = json_path.with_name(f"{json_path.stem}_v2.json")
    _write_json(output_path, data)
    logger.info("Wrote %s", output_path.name)

    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate quiz unit difficulties to 1-3.")
    parser.add_argument(
        "--input-dir",
        default=str(Path("content") / "quiz" / "topics"),
        help="Directory with quiz unit JSON files (default: content/quiz/topics)",
    )
    parser.add_argument(
        "--patch-to-min",
        action="store_true",
        help="(Not supported) Do not use: requires manual question additions.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    if not input_dir.exists() or not input_dir.is_dir():
        logger.error("Input directory not found: %s", input_dir)
        return 1

    json_files = sorted(p for p in input_dir.glob("*.json") if not p.name.endswith("_v2.json"))
    if not json_files:
        logger.warning("No JSON files found in %s", input_dir)
        return 0

    failed = 0
    for json_path in json_files:
        logger.info("Migrating %s", json_path.name)
        if not migrate_file(json_path, patch_to_min=args.patch_to_min):
            failed += 1

    if failed:
        logger.error("Migration completed with %s failures", failed)
        return 1

    logger.info("Migration completed successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
