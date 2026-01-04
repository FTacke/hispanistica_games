#!/usr/bin/env python3
"""
Quiz Units Normalize Script

Ensures all quiz unit JSON files have:
1. Stable ULID-based question IDs (never overwrites existing IDs)
2. Correct questions_statistics object
3. Deterministic formatting (sorted keys, indent=2)
4. Media defaults (empty arrays for questions and answers without media)

Supports both quiz_unit_v1 and quiz_unit_v2 formats.

Usage:
  python scripts/quiz_units_normalize.py --check                    # Check only, exit 1 if changes needed
  python scripts/quiz_units_normalize.py --write                    # Write changes back to files
  python scripts/quiz_units_normalize.py --check --verbose          # Show detailed report
  python scripts/quiz_units_normalize.py --topics-dir custom/path   # Use custom topics directory
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Tuple
from ulid import ULID


def generate_question_id(slug: str) -> str:
    """Generate a new ULID-based question ID."""
    return f"{slug}_q_{ULID()}"


def calculate_questions_statistics(questions: List[Dict[str, Any]]) -> Dict[str, int]:
    """Calculate difficulty distribution from questions list."""
    difficulties = [q.get("difficulty", 1) for q in questions]
    counter = Counter(difficulties)
    # Return as dict with string keys and sorted by difficulty
    return {str(k): counter[k] for k in sorted(counter.keys())}


def normalize_media_array(media: Any) -> List[Dict[str, Any]]:
    """Normalize media field to v2 array format.
    
    v1: null or single object {"type": "audio", "url": "..."}
    v2: array of media objects [{id, type, seed_src, ...}]
    
    Returns normalized array (may be empty).
    """
    if media is None:
        return []
    
    if isinstance(media, list):
        # Already v2 format, ensure each item has id
        normalized = []
        for idx, item in enumerate(media):
            if isinstance(item, dict):
                if 'id' not in item:
                    item = dict(item)  # Copy to avoid mutation
                    item['id'] = f"m{idx+1}"
                normalized.append(item)
        return normalized
    
    if isinstance(media, dict):
        # v1 format: convert to array
        converted = dict(media)
        if 'id' not in converted:
            converted['id'] = 'm1'
        # Convert legacy 'url' to 'src' if present
        if 'url' in converted and 'src' not in converted:
            converted['src'] = converted.pop('url')
        return [converted]
    
    return []


def normalize_quiz_unit(
    unit_data: Dict[str, Any],
    slug: str,
    verbose: bool = False
) -> Tuple[Dict[str, Any], bool]:
    """
    Normalize a quiz unit by:
    - Adding missing question IDs (never overwrites existing)
    - Adding missing answer IDs
    - Normalizing media arrays (v1 -> v2 conversion)
    - Updating questions_statistics
    
    Returns: (normalized_data, was_modified)
    """
    modified = False
    questions = unit_data.get("questions", [])
    
    # Step 1: Add missing question IDs
    ids_added = 0
    for q_idx, question in enumerate(questions):
        if "id" not in question or not question["id"]:
            question["id"] = generate_question_id(slug)
            ids_added += 1
            modified = True
    
    if verbose and ids_added > 0:
        print(f"  -> Added {ids_added} question IDs")
    
    # Step 2: Normalize answers (add IDs if missing)
    answer_ids_added = 0
    for question in questions:
        answers = question.get("answers", [])
        for ans_idx, answer in enumerate(answers):
            if "id" not in answer or not answer["id"]:
                answer["id"] = f"a{ans_idx + 1}"
                answer_ids_added += 1
                modified = True
    
    if verbose and answer_ids_added > 0:
        print(f"  -> Added {answer_ids_added} answer IDs")
    
    # Step 3: Normalize media (v1 -> v2 format)
    media_normalized = 0
    for question in questions:
        # Question media
        old_media = question.get("media")
        new_media = normalize_media_array(old_media)
        if old_media != new_media:
            question["media"] = new_media
            media_normalized += 1
            modified = True
        
        # Answer media (ensure each answer has media field)
        for answer in question.get("answers", []):
            old_ans_media = answer.get("media")
            new_ans_media = normalize_media_array(old_ans_media)
            if old_ans_media != new_ans_media:
                answer["media"] = new_ans_media
                media_normalized += 1
                modified = True
    
    if verbose and media_normalized > 0:
        print(f"  -> Normalized {media_normalized} media fields")
    
    # Step 4: Calculate and update questions_statistics
    calculated_stats = calculate_questions_statistics(questions)
    current_stats = unit_data.get("questions_statistics", {})
    
    if calculated_stats != current_stats:
        unit_data["questions_statistics"] = calculated_stats
        modified = True
        if verbose:
            print(f"  -> Updated questions_statistics: {calculated_stats}")
    
    return unit_data, modified


def format_json_deterministic(data: Dict[str, Any]) -> str:
    """
    Format JSON with deterministic ordering:
    - Top-level keys in specific order
    - indent=2, ensure_ascii=False
    """
    # Define key order for top-level
    key_order = [
        "schema_version",
        "slug",
        "title",
        "description",
        "authors",
        "is_active",
        "order_index",
        "questions_statistics",
        "questions"
    ]
    
    # Build ordered dict
    ordered = {}
    for key in key_order:
        if key in data:
            ordered[key] = data[key]
    
    # Add any remaining keys that weren't in our order
    for key, value in data.items():
        if key not in ordered:
            ordered[key] = value
    
    return json.dumps(ordered, indent=2, ensure_ascii=False, sort_keys=False) + "\n"


def process_quiz_unit_file(
    file_path: Path,
    write: bool = False,
    verbose: bool = False
) -> Tuple[bool, str]:
    """
    Process a single quiz unit file.
    
    Returns: (needs_changes, status_message)
    """
    try:
        # Load JSON
        with open(file_path, "r", encoding="utf-8") as f:
            unit_data = json.load(f)
        
        slug = unit_data.get("slug", "")
        if not slug:
            return False, f"⚠️  Missing slug in {file_path.name}"
        
        # Normalize
        normalized_data, was_modified = normalize_quiz_unit(unit_data, slug, verbose)
        
        if not was_modified:
            status = f"OK: {file_path.name}"
            return False, status
        
        # Format deterministically
        formatted_json = format_json_deterministic(normalized_data)
        
        if write:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(formatted_json)
            status = f"WRITTEN: {file_path.name}"
        else:
            status = f"NEEDS CHANGES: {file_path.name}"
        
        return was_modified, status
        
    except json.JSONDecodeError as e:
        return False, f"JSON ERROR in {file_path.name}: {e}"
    except Exception as e:
        return False, f"ERROR processing {file_path.name}: {e}"


def main():
    parser = argparse.ArgumentParser(
        description="Normalize quiz unit JSON files (IDs + statistics)"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        default=False,
        help="Check mode: exit 1 if changes needed (default behavior if no flags)"
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write changes back to files"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed output"
    )
    parser.add_argument(
        "--topics-dir",
        type=str,
        default="game_modules/quiz/quiz_units/topics",
        help="Path to topics directory (default: game_modules/quiz/quiz_units/topics)"
    )
    
    args = parser.parse_args()
    
    # Default behavior: --check if neither --check nor --write specified
    if not args.write and not args.check:
        args.check = True
    
    # Find topics directory
    topics_dir = Path(args.topics_dir)
    if not topics_dir.exists():
        print(f"Error: Topics directory not found: {topics_dir}", file=sys.stderr)
        sys.exit(1)
    
    # Find all JSON files
    json_files = sorted(topics_dir.glob("*.json"))
    if not json_files:
        print(f"No JSON files found in {topics_dir}", file=sys.stderr)
        sys.exit(1)
    
    if args.verbose:
        print(f"Processing {len(json_files)} quiz unit(s)...\n")
    
    # Process all files
    needs_changes_files = []
    for json_file in json_files:
        needs_changes, status = process_quiz_unit_file(json_file, args.write, args.verbose)
        print(status)
        if needs_changes:
            needs_changes_files.append(json_file.name)
    
    # Summary
    if args.verbose:
        print(f"\n{'='*60}")
        print(f"Processed: {len(json_files)} file(s)")
        if needs_changes_files:
            print(f"Changes: {len(needs_changes_files)} file(s)")
        else:
            print("All files OK")
    
    # Exit code logic
    if args.check and not args.write:
        if needs_changes_files:
            if args.verbose:
                print("\nFiles needing normalization:")
                for filename in needs_changes_files:
                    print(f"  - {filename}")
            sys.exit(1)
        else:
            sys.exit(0)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
