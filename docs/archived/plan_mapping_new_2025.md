Ja, du hast genug Infos geliefert, das kriegen wir sauber designt.

---

## 1. Zieldesign der Pipeline (Endzustand)

### 1.1 JSON-Header (pro Datei)

Top-Level Felder im JSON nach Normalisierung:

Pflicht:

* `file_id`
  – abgeleitet aus `filename` ohne Extension, z. B.
  `"filename": "2023-08-10_ARG_Mitre.mp3"` → `"file_id": "2023-08-10_ARG_Mitre"`

* `filename`
  – Original-Filename mit Extension (wie bisher).

* `date`
  – ISO-String `"YYYY-MM-DD"`

* `country_code`
  – Originalcode aus Rohdaten, z. B. `ARG`, `ARG-CBA`, `ESP`, `ESP-SEV`.

* `country_scope`
  – neu, abgeleitet:

  * `"national"` wenn kein Bindestrich (z. B. `ARG`, `ESP`)
  * `"regional"` wenn Bindestrich (z. B. `ARG-CBA`, `ESP-SEV`)

* `country_parent_code`
  – neu:

  * bei national: `ARG` → `"ARG"`
  * bei regional: `ARG-CBA` → `"ARG"`, `ESP-SEV` → `"ESP"`

* `country_region_code`
  – neu:

  * bei national: leer `""`
  * bei regional: Teil nach Bindestrich, z. B. `CBA`, `SEV`, `CAN`, `CHU`, `SDE`

* `city`

* `radio`

* `revision`

Optional/Bestandsfelder, aber nicht kritisch für die Pipeline:

* `country_display` (kann bleiben, aber ist nur UI-Bequemlichkeit)
* `bookmarks`, `highlights` → werden entfernt.

### 1.2 JSON-Segmente

Segmentstruktur nach Umbau (pro Segment):

```jsonc
{
  "utt_start_ms": 1410,
  "utt_end_ms": 3840,

  "speaker": {
    "code": "lib-pm",
    "speaker_type": "pro",
    "speaker_sex": "m",
    "speaker_mode": "libre",
    "speaker_discourse": "general"
  },

  // optional für Rückwärtskompatibilität:
  "speaker_code": "lib-pm",

  "words": [
    {
      "text": "5",
      "norm": "5",
      "lemma": "5",
      "pos": "NUM",
      // ...
      "start_ms": 1410,
      "end_ms": 1460,

      // neu: pro Token dupliziert
      "speaker_code": "lib-pm",
      "speaker_type": "pro",
      "speaker_sex": "m",
      "speaker_mode": "libre",
      "speaker_discourse": "general"
    },
    ...
  ]
}
```

**Speaker-Mapping (fix hinterlegt):**

| code    | speaker_type | speaker_sex | speaker_mode | speaker_discourse |
| ------- | ------------ | ----------- | ------------ | ----------------- |
| lib-pm  | pro          | m           | libre        | general           |
| lib-pf  | pro          | f           | libre        | general           |
| lib-om  | otro         | m           | libre        | general           |
| lib-of  | otro         | f           | libre        | general           |
| lec-pm  | pro          | m           | lectura      | general           |
| lec-pf  | pro          | f           | lectura      | general           |
| lec-om  | otro         | m           | lectura      | general           |
| lec-of  | otro         | f           | lectura      | general           |
| pre-pm  | pro          | m           | pre          | general           |
| pre-pf  | pro          | f           | pre          | general           |
| tie-pm  | pro          | m           | n/a          | tiempo            |
| tie-pf  | pro          | f           | n/a          | tiempo            |
| traf-pm | pro          | m           | n/a          | tránsito          |
| traf-pf | pro          | f           | n/a          | tránsito          |
| foreign | n/a          | n/a         | n/a          | foreign           |
| none    |              |             |              |                   |

Alle anderen Codes → leer `""` für alle vier Attribute.

### 1.3 docmeta.jsonl (Stage nach JSON)

Eine Zeile pro Dokument, z. B.:

```json
{"file_id":"2023-08-10_ARG_Mitre",
 "filename":"2023-08-10_ARG_Mitre.mp3",
 "date":"2023-08-10",
 "country_code":"ARG",
 "country_scope":"national",
 "country_parent_code":"ARG",
 "country_region_code":"",
 "city":"Buenos Aires",
 "radio":"Radio Mitre",
 "revision":"YB"}
```

Das ist die Quelle für:

* BlackLab Doc-Metadaten (Facetten, Filter).
* Advanced Search Metadaten (für Datatables-Output).

### 1.4 TSV-Spalten (Stage vor BlackLab)

Pro Token eine Zeile, typische Spalten (vereinfachte Sicht):

1. `token_id`
2. `sentence_id`
3. `utterance_id`
4. `start_ms`
5. `end_ms`
6. `word`
7. `norm`
8. `lemma`
9. `pos`
10. `dep`
11. `head_text`
12. `morph` (flach oder aufgesplittet)
13. `file_id`              ← von Header/docmeta
14. `country_code`         ← von Header
15. `country_scope`        ← von Header
16. `country_parent_code`  ← von Header
17. `country_region_code`  ← von Header
18. `city`
19. `radio`
20. `speaker_code`         ← aus Segment
21. `speaker_type`         ← aus Segment
22. `speaker_sex`          ← aus Segment
23. `speaker_mode`         ← aus Segment
24. `speaker_discourse`    ← aus Segment

Die exakte Spaltenreihenfolge muss natürlich zu deiner bestehenden 23-Spalten-Konfiguration passen, aber inhaltlich sieht es so aus.

### 1.5 BlackLab-Felder

In `corapan-tsv.blf.yaml`:

* Token-Annotationen:

  * `word`, `norm`, `lemma`, `pos`, `dep`, `head_text`, `speaker_code`, `speaker_type`, `speaker_sex`, `speaker_mode`, `speaker_discourse` etc.
* Doc-Metadaten (aus docmeta.jsonl oder wiederholten TSV-Spalten):

  * `file_id`, `date`, `country_code`, `country_scope`,
    `country_parent_code`, `country_region_code`, `city`, `radio`.

### 1.6 Datatables-Felder (Advanced Search)

Typische Spalten pro Treffer:

* `text` (Snippet um den Treffer)
* `left_context`, `right_context`
* `lemma`, `pos`
* `file_id`
* `date`
* `country_code` (evtl. als Display-Label mit national/regional-Farbe)
* `city`, `radio`
* `speaker_code`
* `speaker_type`, `speaker_sex`, `speaker_mode`, `speaker_discourse`

Die Werte kommen:

* docmeta-Felder aus `_DOCMETA_CACHE` (JSONL).
* token-level Felder aus dem Hit (speaker*, pos, lemma, etc.).

---

## 2. Script zum Umbau aller JSON unter `media/transcripts/`

### 2.1 Annahmen

* Projekt-Root: `C:\dev\corapan-webapp`
* JSON-Dateien liegen unter `media/transcripts/**`, z. B.:

  * `media/transcripts/ARG/*.json`
  * `media/transcripts/ESP/*.json`
* Dateinamen enden auf `.json`
* Header sieht ungefähr so aus wie dein Beispiel.

### 2.2 Python-Script (z. B. `scripts/normalize_transcripts.py`)

```python
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # geht von scripts/ aus eine Ebene hoch
TRANSCRIPTS_ROOT = ROOT / "media" / "transcripts"

SPEAKER_MAP = {
    "lib-pm": {"speaker_type": "pro", "sex": "m", "mode": "libre", "discourse": "general"},
    "lib-pf": {"speaker_type": "pro", "sex": "f", "mode": "libre", "discourse": "general"},
    "pre-pm": {"speaker_type": "pro", "sex": "m", "mode": "pre", "discourse": "general"},
    "tie-pf": {"speaker_type": "pro", "sex": "f", "mode": "", "discourse": "tiempo"},
    "foreign": {"speaker_type": "", "sex": "", "mode": "", "discourse": "foreign"},
    "none": {"speaker_type": "", "sex": "", "mode": "", "discourse": ""},
}

DEFAULT_SPEAKER = {"speaker_type": "", "sex": "", "mode": "", "discourse": ""}


def classify_country(code: str):
    code = (code or "").strip()
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
            "country_scope": "national" if code else "",
            "country_parent_code": code,
            "country_region_code": "",
        }


def derive_file_id(filename: str, json_path: Path) -> str:
    if not filename:
        filename = json_path.name  # fallback
    # nimm alles vor dem ersten Punkt
    return filename.split(".", 1)[0]


def enrich_speaker(segment: dict):
    # Hole Code aus segment["speaker_code"] oder ggf. aus segment["speaker"]["code"]
    code = segment.get("speaker_code") or (
        segment.get("speaker", {}).get("code") if isinstance(segment.get("speaker"), dict) else ""
    )
    code = code or "none"

    speaker_info = SPEAKER_MAP.get(code, DEFAULT_SPEAKER)

    # Einheitliche Speaker-Section
    segment["speaker"] = {
        "code": code,
        "speaker_type": speaker_info["speaker_type"],
        "sex": speaker_info["sex"],
        "mode": speaker_info["mode"],
        "discourse": speaker_info["discourse"],
    }

    # optional: speaker_code oben erhalten für Backwards-Kompatibilität
    segment["speaker_code"] = code

    # Auf alle Tokens ausrollen
    words = segment.get("words") or []
    for w in words:
        w["speaker_code"] = code
        w["speaker_type"] = speaker_info["speaker_type"]
        w["sex"] = speaker_info["sex"]
        w["mode"] = speaker_info["mode"]
        w["discourse"] = speaker_info["discourse"]


def normalize_json(json_path: Path):
    with json_path.open("r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"[WARN] JSON-Fehler in {json_path}: {e}")
            return

    changed = False

    # 1) Bookmarks / Highlights entfernen
    for key in ("bookmarks", "highlights"):
        if key in data:
            data.pop(key, None)
            changed = True

    # 2) Datei-Infos
    filename = data.get("filename")
    file_id = derive_file_id(filename, json_path)
    if data.get("file_id") != file_id:
        data["file_id"] = file_id
        changed = True
    if not filename:
        data["filename"] = json_path.name
        changed = True

    # 3) Ländermetadaten
    country_code = data.get("country_code", "")
    country_info = classify_country(country_code)
    for k, v in country_info.items():
        if data.get(k) != v:
            data[k] = v
            changed = True

    # 4) Segmente + Speaker anreichern
    segments = data.get("segments")
    if isinstance(segments, list):
        for seg in segments:
            if not isinstance(seg, dict):
                continue
            enrich_speaker(seg)
        changed = True

    if not changed:
        return

    # 5) Zurückschreiben
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[OK] Normalisiert: {json_path.relative_to(ROOT)}")


def main():
    if not TRANSCRIPTS_ROOT.exists():
        print(f"Transcripts-Verzeichnis nicht gefunden: {TRANSCRIPTS_ROOT}")
        return

    json_files = list(TRANSCRIPTS_ROOT.rglob("*.json"))
    print(f"Gefundene JSON-Dateien: {len(json_files)}")

    for path in json_files:
        normalize_json(path)


if __name__ == "__main__":
    main()
```

### 2.3 Nutzung

Im Projekt-Root:

```bash
cd C:\dev\corapan-webapp
python scripts/normalize_transcripts.py
```

Danach:

1. JSON → TSV / docmeta Export-Script erneut laufen lassen.
2. BlackLab-Index neu bauen.
3. Advanced-Search testen (insb. Country-Filter & speaker_* in Datatables).

Wenn du willst, kann ich dir als nächsten Schritt auch noch den gewünschten TSV-Export (Mapping von diesen JSON-Feldern zu den 23 Spalten) explizit als Code-Snippet bauen.
