import json
import logging
from pathlib import Path
import sys

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

TRANSCRIPTS_DIR = Path("media/transcripts")
ANN_VERSION = "corapan-ann/v3"

REQUIRED_TOKEN_FIELDS = [
    "token_id",
    "sentence_id",
    "utterance_id",
    "start_ms",
    "end_ms",
    "text",
    "lemma",
    "pos",
    "dep",
    "morph",
    "norm",
]


def migrate_file(json_file: Path):
    try:
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        changed = False

        # 1. Update ann_meta
        ann_meta = data.get("ann_meta", {})
        if ann_meta.get("version") != ANN_VERSION:
            ann_meta["version"] = ANN_VERSION
            changed = True

        # Ensure required fields list is correct
        current_required = ann_meta.get("required", [])
        if set(current_required) != set(REQUIRED_TOKEN_FIELDS):
            ann_meta["required"] = REQUIRED_TOKEN_FIELDS
            changed = True

        data["ann_meta"] = ann_meta

        # 2. Process tokens
        for segment in data.get("segments", []):
            for token in segment.get("words", []):
                # Prepare morph container (may be empty) and track changes
                morph = token.get("morph", {})
                morph_changed = False

                # Move legacy top-level past_type/future_type into morph (preserve data)
                # Some JSON variants stored these as token-level fields (e.g. 'past_type').
                # When migrating, preserve these values in morph['PastType']/['FutureType']
                # so subsequent tooling (exporter) can read a single canonical key.
                if "past_type" in token and token.get("past_type"):
                    morph_val = token.get("past_type")
                    morph.setdefault("PastType", morph_val)
                    morph_changed = True
                    token.pop("past_type")
                    changed = True

                if "future_type" in token and token.get("future_type"):
                    morph_val = token.get("future_type")
                    morph.setdefault("FutureType", morph_val)
                    morph_changed = True
                    token.pop("future_type")
                    changed = True

                # Remove legacy positional/time fields if present
                for field in ["start", "end"]:
                    if field in token:
                        token.pop(field)
                        changed = True

                # Ensure start_ms/end_ms exist (should already be there if start/end were present, but good to check)
                # If start/end were floats, we might need to convert them if start_ms/end_ms are missing
                # But assuming v2 already had ms fields or we just rely on what's there.
                # The user said: "Tokens entsprechen bereits weitgehend dem v3-Schema (Zeit in ms...)"

                # Rename/Move legacy morph keys if they exist

                # Rename/Move legacy morph keys if they exist
                if "Past_Tense_Type" in morph:
                    morph["PastType"] = morph.pop("Past_Tense_Type")
                    morph_changed = True
                if "Future_Type" in morph:
                    morph["FutureType"] = morph.pop("Future_Type")
                    morph_changed = True

                if morph_changed:
                    token["morph"] = morph
                    changed = True

        if changed:
            with open(json_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info(f"Migrated {json_file.name}")
        else:
            logger.debug(f"No changes for {json_file.name}")

    except Exception as e:
        logger.error(f"Error processing {json_file}: {e}")


def main():
    if not TRANSCRIPTS_DIR.exists():
        logger.error(f"Directory not found: {TRANSCRIPTS_DIR}")
        return

    files = list(TRANSCRIPTS_DIR.rglob("*.json"))
    logger.info(f"Found {len(files)} JSON files to check.")

    for json_file in files:
        migrate_file(json_file)

    logger.info("Migration complete.")


if __name__ == "__main__":
    main()
