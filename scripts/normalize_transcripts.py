#!/usr/bin/env python3
"""
Script zur Normalisierung aller JSON-Transkripte unter media/transcripts/.

Führt folgende Operationen durch:
1. Entfernt bookmarks und highlights aus dem Header
2. Normalisiert Header-Felder (file_id, filename, country_*, etc.)
3. Reichert Segmente mit strukturierten Speaker-Daten an
4. Propagiert Speaker-Felder auf Token-Ebene

Nutzung:
    cd C:\\dev\\corapan-webapp
    python scripts/normalize_transcripts.py
"""

import json
import sys
from pathlib import Path
from typing import Dict

# Projekt-Root ermitteln (scripts/ -> Root)
ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPTS_ROOT = ROOT / "media" / "transcripts"

# Speaker-Code-Mapping (fix kodiert)
SPEAKER_MAP = {
    "lib-pm": {
        "speaker_type": "pro",
        "speaker_sex": "m",
        "speaker_mode": "libre",
        "speaker_discourse": "general",
    },
    "lib-pf": {
        "speaker_type": "pro",
        "speaker_sex": "f",
        "speaker_mode": "libre",
        "speaker_discourse": "general",
    },
    "lib-om": {
        "speaker_type": "otro",
        "speaker_sex": "m",
        "speaker_mode": "libre",
        "speaker_discourse": "general",
    },
    "lib-of": {
        "speaker_type": "otro",
        "speaker_sex": "f",
        "speaker_mode": "libre",
        "speaker_discourse": "general",
    },
    "lec-pm": {
        "speaker_type": "pro",
        "speaker_sex": "m",
        "speaker_mode": "lectura",
        "speaker_discourse": "general",
    },
    "lec-pf": {
        "speaker_type": "pro",
        "speaker_sex": "f",
        "speaker_mode": "lectura",
        "speaker_discourse": "general",
    },
    "lec-om": {
        "speaker_type": "otro",
        "speaker_sex": "m",
        "speaker_mode": "lectura",
        "speaker_discourse": "general",
    },
    "lec-of": {
        "speaker_type": "otro",
        "speaker_sex": "f",
        "speaker_mode": "lectura",
        "speaker_discourse": "general",
    },
    "pre-pm": {
        "speaker_type": "pro",
        "speaker_sex": "m",
        "speaker_mode": "pre",
        "speaker_discourse": "general",
    },
    "pre-pf": {
        "speaker_type": "pro",
        "speaker_sex": "f",
        "speaker_mode": "pre",
        "speaker_discourse": "general",
    },
    "tie-pm": {
        "speaker_type": "pro",
        "speaker_sex": "m",
        "speaker_mode": "n/a",
        "speaker_discourse": "tiempo",
    },
    "tie-pf": {
        "speaker_type": "pro",
        "speaker_sex": "f",
        "speaker_mode": "n/a",
        "speaker_discourse": "tiempo",
    },
    "traf-pm": {
        "speaker_type": "pro",
        "speaker_sex": "m",
        "speaker_mode": "n/a",
        "speaker_discourse": "tránsito",
    },
    "traf-pf": {
        "speaker_type": "pro",
        "speaker_sex": "f",
        "speaker_mode": "n/a",
        "speaker_discourse": "tránsito",
    },
    "foreign": {
        "speaker_type": "n/a",
        "speaker_sex": "n/a",
        "speaker_mode": "n/a",
        "speaker_discourse": "foreign",
    },
    "none": {
        "speaker_type": "",
        "speaker_sex": "",
        "speaker_mode": "",
        "speaker_discourse": "",
    },
}

DEFAULT_SPEAKER = {
    "speaker_type": "",
    "speaker_sex": "",
    "speaker_mode": "",
    "speaker_discourse": "",
}


def classify_country(code: str) -> Dict[str, str]:
    """
    Leitet country_scope, country_parent_code und country_region_code
    aus dem country_code ab.

    Logik:
    - Kein Bindestrich → national, parent_code = code, region_code = ""
    - Mit Bindestrich → regional, parent_code = Teil vor '-', region_code = Teil nach '-'
    """
    code = (code or "").strip()
    if not code:
        return {
            "country_code": code,
            "country_scope": "",
            "country_parent_code": "",
            "country_region_code": "",
        }

    if "-" in code:
        parent, region = code.split("-", 1)
        return {
            "country_code": code,
            "country_scope": "regional",
            "country_parent_code": parent,
            "country_region_code": region,
        }
    else:
        return {
            "country_code": code,
            "country_scope": "national",
            "country_parent_code": code,
            "country_region_code": "",
        }


def derive_file_id(filename: str, json_path: Path) -> str:
    """
    Leitet file_id aus filename ab (alles vor dem ersten Punkt).
    Falls filename leer, nutze JSON-Dateinamen als Fallback.
    """
    if not filename:
        filename = json_path.name
    # Entferne Extension
    return filename.split(".", 1)[0]


def enrich_speaker(segment: dict) -> bool:
    """
    Reichert ein Segment mit strukturierten Speaker-Daten an.

    - Liest speaker_code aus dem Segment
    - Erstellt segment["speaker"] als verschachteltes Objekt
    - ENTFERNT Speaker-Felder von Token-Ebene (words)

    Returns:
        bool: True wenn Änderungen vorgenommen wurden
    """
    changed = False

    # Hole speaker_code aus Segment (oder aus verschachteltem speaker-Objekt)
    code = segment.get("speaker_code")
    if not code and isinstance(segment.get("speaker"), dict):
        code = segment.get("speaker", {}).get("code")

    code = code or "none"

    # Lookup Speaker-Informationen
    speaker_info = SPEAKER_MAP.get(code, DEFAULT_SPEAKER.copy())

    # Erstelle einheitliches Speaker-Objekt
    new_speaker = {
        "code": code,
        "speaker_type": speaker_info["speaker_type"],
        "speaker_sex": speaker_info["speaker_sex"],
        "speaker_mode": speaker_info["speaker_mode"],
        "speaker_discourse": speaker_info["speaker_discourse"],
    }

    # Prüfe ob Speaker-Objekt geändert werden muss
    if segment.get("speaker") != new_speaker:
        segment["speaker"] = new_speaker
        changed = True

    # Backwards-Kompatibilität: speaker_code auf Segment-Ebene
    if segment.get("speaker_code") != code:
        segment["speaker_code"] = code
        changed = True

    # ENTFERNE Speaker-Felder von allen Tokens (falls vorhanden)
    words = segment.get("words")
    if isinstance(words, list):
        for word in words:
            if not isinstance(word, dict):
                continue

            # Entferne Speaker-Felder falls vorhanden
            speaker_fields = [
                "speaker_code",
                "speaker_type",
                "speaker_sex",
                "speaker_mode",
                "speaker_discourse",
            ]
            for field_name in speaker_fields:
                if field_name in word:
                    word.pop(field_name)
                    changed = True

    return changed


def normalize_json(json_path: Path) -> bool:
    """
    Normalisiert eine einzelne JSON-Datei.

    Returns:
        bool: True wenn erfolgreich, False bei Fehler
    """
    try:
        with json_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"[WARN] JSON-Fehler in {json_path.relative_to(ROOT)}: {e}")
        return False
    except Exception as e:
        print(f"[WARN] Fehler beim Lesen von {json_path.relative_to(ROOT)}: {e}")
        return False

    changed = False

    # 1. Entferne bookmarks und highlights
    for key in ("bookmarks", "highlights"):
        if key in data:
            data.pop(key, None)
            changed = True

    # 2. Normalisiere Datei-Infos
    filename = data.get("filename", "")
    file_id = derive_file_id(filename, json_path)

    if data.get("file_id") != file_id:
        data["file_id"] = file_id
        changed = True

    if not filename:
        data["filename"] = json_path.name
        changed = True

    # Stelle sicher dass date, city, radio, revision existieren
    for field in ["date", "city", "radio", "revision"]:
        if field not in data:
            data[field] = ""
            changed = True

    # 3. Normalisiere Länder-Metadaten
    country_code = data.get("country_code", "")
    country_info = classify_country(country_code)

    for key, value in country_info.items():
        if data.get(key) != value:
            data[key] = value
            changed = True

    # 4. Reichere Segmente mit Speaker-Daten an
    segments = data.get("segments")
    if isinstance(segments, list):
        for seg in segments:
            if not isinstance(seg, dict):
                continue
            if enrich_speaker(seg):
                changed = True

    # 5. Schreibe nur zurück wenn sich etwas geändert hat
    if not changed:
        return True

    try:
        # Erstelle neu strukturiertes JSON mit kontrollierter Feld-Reihenfolge
        output = {}

        # 1. Header-Felder ZUERST (in gewünschter Reihenfolge)
        header_fields = [
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
        for field in header_fields:
            if field in data:
                output[field] = data[field]

        # 2. Andere existierende Header-Felder (z.B. startTimeOffset)
        for key in data.keys():
            if key not in output and key != "segments":
                output[key] = data[key]

        # 3. Segmente mit kontrollierter Struktur
        if "segments" in data and isinstance(data["segments"], list):
            output["segments"] = []
            for seg in data["segments"]:
                if not isinstance(seg, dict):
                    output["segments"].append(seg)
                    continue

                # Erstelle Segment mit gewünschter Feld-Reihenfolge
                new_seg = {}

                # 3a. Timing-Felder
                if "utt_start_ms" in seg:
                    new_seg["utt_start_ms"] = seg["utt_start_ms"]
                if "utt_end_ms" in seg:
                    new_seg["utt_end_ms"] = seg["utt_end_ms"]

                # 3b. Speaker-Felder
                if "speaker_code" in seg:
                    new_seg["speaker_code"] = seg["speaker_code"]
                if "speaker" in seg:
                    new_seg["speaker"] = seg["speaker"]

                # 3c. Words (kommt als letztes im Segment)
                if "words" in seg:
                    new_seg["words"] = seg["words"]

                # 3d. Alle anderen Segment-Felder (falls vorhanden)
                for key, value in seg.items():
                    if key not in new_seg:
                        new_seg[key] = value

                output["segments"].append(new_seg)

        # Schreibe finale Struktur
        with json_path.open("w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        print(f"[OK] Normalisiert: {json_path.relative_to(ROOT)}")
        return True
    except Exception as e:
        print(f"[ERROR] Fehler beim Schreiben von {json_path.relative_to(ROOT)}: {e}")
        return False


def main():
    """Hauptfunktion: Traversiert alle JSONs und normalisiert sie."""

    if not TRANSCRIPTS_ROOT.exists():
        print(f"[ERROR] Transcripts-Verzeichnis nicht gefunden: {TRANSCRIPTS_ROOT}")
        sys.exit(1)

    json_files = list(TRANSCRIPTS_ROOT.rglob("*.json"))

    # Filtere edit_log.jsonl aus (kein Transkript)
    json_files = [f for f in json_files if f.name != "edit_log.jsonl"]

    print(f"Gefundene JSON-Dateien: {len(json_files)}")
    print()

    success_count = 0
    error_count = 0

    for path in json_files:
        if normalize_json(path):
            success_count += 1
        else:
            error_count += 1

    print()
    print("=" * 60)
    print("Normalisierung abgeschlossen:")
    print(f"  Erfolgreich: {success_count}")
    print(f"  Fehler:      {error_count}")
    print("=" * 60)

    if error_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
