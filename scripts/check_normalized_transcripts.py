#!/usr/bin/env python3
"""
Script zur Validierung der normalisierten JSON-Transkripte.

Prüft strukturelle Korrektheit nach der Normalisierung:
1. Pflicht-Header-Felder vorhanden und korrekt
2. Country-Scope-Logik konsistent
3. Speaker-Objekte und Felder komplett
4. Token-Level Speaker-Felder vorhanden

Nutzung:
    cd C:\\dev\\corapan-webapp
    python scripts/check_normalized_transcripts.py
"""

import json
import sys
from pathlib import Path
from typing import List

# Projekt-Root ermitteln
ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPTS_ROOT = ROOT / "media" / "transcripts"

# Pflicht-Header-Felder
REQUIRED_HEADER_FIELDS = [
    "file_id",
    "filename",
    "date",
    "country_code",
    "country_scope",
    "country_parent_code",
    "country_region_code",
    "city",
    "radio",
    "revision",
]

# Speaker-Felder im Segment-Objekt
REQUIRED_SPEAKER_FIELDS = [
    "code",
    "speaker_type",
    "speaker_sex",
    "speaker_mode",
    "speaker_discourse",
]

# Speaker-Felder die auf Token-Ebene NICHT vorhanden sein dürfen
FORBIDDEN_TOKEN_SPEAKER_FIELDS = [
    "speaker_code",
    "speaker_type",
    "speaker_sex",
    "speaker_mode",
    "speaker_discourse",
]


class ValidationError:
    """Repräsentiert einen einzelnen Validierungsfehler."""

    def __init__(self, file_path: Path, error_type: str, message: str):
        self.file_path = file_path
        self.error_type = error_type
        self.message = message

    def __str__(self):
        rel_path = self.file_path.relative_to(ROOT)
        return f"[{self.error_type}] {rel_path}: {self.message}"


def validate_header(data: dict, json_path: Path) -> List[ValidationError]:
    """Validiert Header-Felder."""
    errors = []

    # 1. Prüfe ob alle Pflichtfelder existieren
    for field in REQUIRED_HEADER_FIELDS:
        if field not in data:
            errors.append(
                ValidationError(
                    json_path, "MISSING_FIELD", f"Pflichtfeld '{field}' fehlt im Header"
                )
            )

    # 2. Prüfe country_scope
    country_scope = data.get("country_scope", "")
    if country_scope not in ["", "national", "regional"]:
        errors.append(
            ValidationError(
                json_path,
                "INVALID_VALUE",
                f"country_scope hat ungültigen Wert: '{country_scope}'",
            )
        )

    # 3. Prüfe Konsistenz bei regional
    if country_scope == "regional":
        parent = data.get("country_parent_code", "")
        region = data.get("country_region_code", "")

        if not parent:
            errors.append(
                ValidationError(
                    json_path,
                    "INCONSISTENT",
                    "country_scope='regional' aber country_parent_code ist leer",
                )
            )

        if not region:
            errors.append(
                ValidationError(
                    json_path,
                    "INCONSISTENT",
                    "country_scope='regional' aber country_region_code ist leer",
                )
            )

    # 4. Prüfe Konsistenz bei national
    if country_scope == "national":
        country_code = data.get("country_code", "")
        parent = data.get("country_parent_code", "")
        region = data.get("country_region_code", "")

        if parent != country_code:
            errors.append(
                ValidationError(
                    json_path,
                    "INCONSISTENT",
                    f"country_scope='national' aber country_parent_code ('{parent}') != country_code ('{country_code}')",
                )
            )

        if region != "":
            errors.append(
                ValidationError(
                    json_path,
                    "INCONSISTENT",
                    f"country_scope='national' aber country_region_code ist nicht leer: '{region}'",
                )
            )

    return errors


def validate_segment(
    segment: dict, seg_idx: int, json_path: Path
) -> List[ValidationError]:
    """Validiert ein einzelnes Segment."""
    errors = []

    # 1. Prüfe speaker-Objekt
    speaker = segment.get("speaker")
    if not isinstance(speaker, dict):
        errors.append(
            ValidationError(
                json_path,
                "MISSING_OBJECT",
                f"Segment {seg_idx}: 'speaker' ist kein Objekt",
            )
        )
    else:
        # Prüfe alle Speaker-Felder
        for field in REQUIRED_SPEAKER_FIELDS:
            if field not in speaker:
                errors.append(
                    ValidationError(
                        json_path,
                        "MISSING_FIELD",
                        f"Segment {seg_idx}: speaker.{field} fehlt",
                    )
                )

    # 2. Prüfe speaker_code auf Segment-Ebene (Backwards-Kompatibilität)
    if "speaker_code" not in segment:
        errors.append(
            ValidationError(
                json_path, "MISSING_FIELD", f"Segment {seg_idx}: 'speaker_code' fehlt"
            )
        )
    elif isinstance(speaker, dict):
        # Prüfe ob speaker_code mit speaker.code übereinstimmt
        seg_code = segment.get("speaker_code", "")
        obj_code = speaker.get("code", "")
        if seg_code != obj_code:
            errors.append(
                ValidationError(
                    json_path,
                    "INCONSISTENT",
                    f"Segment {seg_idx}: speaker_code ('{seg_code}') != speaker.code ('{obj_code}')",
                )
            )

    return errors


def validate_token(
    word: dict, seg_idx: int, word_idx: int, json_path: Path
) -> List[ValidationError]:
    """Validiert ein einzelnes Token (word) - Speaker-Felder dürfen NICHT vorhanden sein."""
    errors = []

    # Prüfe dass KEINE Speaker-Felder auf Token-Ebene vorhanden sind
    for field in FORBIDDEN_TOKEN_SPEAKER_FIELDS:
        if field in word:
            errors.append(
                ValidationError(
                    json_path,
                    "FORBIDDEN_FIELD",
                    f"Segment {seg_idx}, Token {word_idx}: '{field}' darf nicht auf Token-Ebene vorhanden sein",
                )
            )

    return errors


def validate_json(json_path: Path) -> List[ValidationError]:
    """Validiert eine einzelne JSON-Datei."""
    errors = []

    try:
        with json_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        errors.append(
            ValidationError(json_path, "JSON_ERROR", f"JSON-Dekodierungsfehler: {e}")
        )
        return errors
    except Exception as e:
        errors.append(
            ValidationError(json_path, "READ_ERROR", f"Fehler beim Lesen: {e}")
        )
        return errors

    # 1. Validiere Header
    errors.extend(validate_header(data, json_path))

    # 2. Validiere Segmente
    segments = data.get("segments")
    if not isinstance(segments, list):
        errors.append(
            ValidationError(
                json_path, "MISSING_OBJECT", "'segments' ist keine Liste oder fehlt"
            )
        )
        return errors

    for seg_idx, segment in enumerate(segments):
        if not isinstance(segment, dict):
            errors.append(
                ValidationError(
                    json_path, "INVALID_TYPE", f"Segment {seg_idx} ist kein Objekt"
                )
            )
            continue

        # Validiere Segment
        errors.extend(validate_segment(segment, seg_idx, json_path))

        # Validiere Tokens im Segment
        words = segment.get("words")
        if isinstance(words, list):
            for word_idx, word in enumerate(words):
                if not isinstance(word, dict):
                    continue
                errors.extend(validate_token(word, seg_idx, word_idx, json_path))

    return errors


def main():
    """Hauptfunktion: Validiert alle JSONs."""

    if not TRANSCRIPTS_ROOT.exists():
        print(f"[ERROR] Transcripts-Verzeichnis nicht gefunden: {TRANSCRIPTS_ROOT}")
        sys.exit(1)

    json_files = list(TRANSCRIPTS_ROOT.rglob("*.json"))

    # Filtere edit_log.jsonl aus
    json_files = [f for f in json_files if f.name != "edit_log.jsonl"]

    print(f"Validiere {len(json_files)} JSON-Dateien...")
    print()

    all_errors = []
    files_with_errors = 0

    for path in json_files:
        errors = validate_json(path)
        if errors:
            all_errors.extend(errors)
            files_with_errors += 1

    # Ausgabe der Ergebnisse
    print("=" * 80)
    if not all_errors:
        print("✓ Alle Validierungen erfolgreich!")
        print(f"  {len(json_files)} Dateien geprüft, keine Fehler gefunden.")
    else:
        print("✗ Validierungsfehler gefunden:")
        print()

        # Gruppiere Fehler nach Typ
        error_by_type = {}
        for err in all_errors:
            error_by_type.setdefault(err.error_type, []).append(err)

        # Zeige erste 50 Fehler detailliert
        for i, err in enumerate(all_errors[:50]):
            print(f"  {i + 1}. {err}")

        if len(all_errors) > 50:
            print()
            print(f"  ... und {len(all_errors) - 50} weitere Fehler")

        print()
        print("-" * 80)
        print("Zusammenfassung:")
        print(f"  Dateien mit Fehlern: {files_with_errors} von {len(json_files)}")
        print(f"  Gesamt-Fehler:       {len(all_errors)}")
        print()
        print("Fehler nach Typ:")
        for error_type, errors in sorted(error_by_type.items()):
            print(f"  {error_type:20s}: {len(errors)}")

    print("=" * 80)

    # Exit mit Fehlercode wenn Validierung fehlschlug
    if all_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
