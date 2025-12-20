# Transcript JSON Tools

Diese Dokumentation beschreibt alle Skripte, die JSON-Dateien im Ordner `media/transcripts/` lesen, schreiben oder verändern.

## Übersicht

| Skript | Pfad | Zweck | Status |
|--------|------|-------|--------|
| `normalize_transcripts.py` | `scripts/` | Normalisiert Header, Speaker-Daten, entfernt bookmarks | present |
| `migrate_json_v3.py` | `scripts/` | Migriert Token-Felder auf v3-Schema (ms-Zeitstempel, PastType/FutureType in morph) | present |
| `check_normalized_transcripts.py` | `scripts/` | Validiert strukturelle Korrektheit nach Normalisierung | present |
| `prepare_json_for_blacklab.py` | `scripts/blacklab/` | Flattened JSON für BlackLab-Indexierung | present |
| `blacklab_index_creation.py` | `src/scripts/` | Exportiert JSON zu TSV für BlackLab-Index | present |
| `03b_generate_blacklab_export.py` | `LOKAL/01 - Add New Transcriptions/` | Wrapper für BlackLab-Export-Pipeline | present |
| `preprocess_json.py` | `LOKAL/01 - Add New Transcriptions/01 preprocess JSON/` | Vorverarbeitung neuer JSON-Dateien (bereinigt Felder, Speaker-Codes) | present |
| `annotation_json_in_media_v3.py` | `LOKAL/01 - Add New Transcriptions/02 annotate JSON/` | spaCy-Annotation mit v3-Schema (ms-Zeitstempel, engl. Tense-Labels) | present |
| `annotation_json_in_media_v2.py` | `LOKAL/01 - Add New Transcriptions/02 annotate JSON/legacy/` | Legacy v2-Annotation (veraltet) | present (legacy) |
| `annotation_json_in_media.py` | `LOKAL/01 - Add New Transcriptions/02 annotate JSON/legacy/` | Original v1-Annotation (veraltet) | present (legacy) |
| `zenodo_corpus_zip.py` | `LOKAL/01 - Add New Transcriptions/04 update full corpus in Zenodo-Repo/` | Erstellt Corpus-ZIPs für Zenodo-Publikation | present |
| `docmeta_to_metadata_dir.py` | `scripts/blacklab/` | Konvertiert docmeta.jsonl zu einzelnen Metadaten-Dateien | present |
| `docmeta_to_metadata_local.py` | `scripts/blacklab/` | Wie oben, mit CLI-Argumenten | present |

---

## Detailbeschreibung

### 1. `scripts/normalize_transcripts.py`

**Zweck:**  
Normalisiert alle JSON-Transkripte unter `media/transcripts/`:
- Entfernt `bookmarks` und `highlights` aus dem Header
- Normalisiert Header-Felder (`file_id`, `filename`, `country_*`, etc.)
- Reichert Segmente mit strukturierten Speaker-Daten an
- Propagiert Speaker-Felder auf Token-Ebene

**Eingaben:**
- Liest rekursiv alle `*.json` aus `media/transcripts/`
- Keine CLI-Argumente

**Ausgaben:**
- Überschreibt die JSON-Dateien in-place

**Aufrufbeispiel:**
```powershell
cd C:\dev\corapan-webapp
python scripts/normalize_transcripts.py
```

---

### 2. `scripts/migrate_json_v3.py`

**Zweck:**  
Migriert JSON-Transkripte auf das v3-Schema:
- Aktualisiert `ann_meta.version` auf `corapan-ann/v3`
- Verschiebt `past_type`/`future_type` von Token-Ebene in `morph.PastType`/`morph.FutureType`
- Entfernt veraltete Felder (`start`, `end`)
- Normalisiert Legacy-Keys in `morph`

**Eingaben:**
- Liest rekursiv alle `*.json` aus `media/transcripts/`
- Keine CLI-Argumente

**Ausgaben:**
- Überschreibt JSON-Dateien in-place (nur bei Änderungen)

**Aufrufbeispiel:**
```powershell
cd C:\dev\corapan-webapp
python scripts/migrate_json_v3.py
```

---

### 3. `scripts/check_normalized_transcripts.py`

**Zweck:**  
Validiert die strukturelle Korrektheit normalisierter JSON-Transkripte:
- Pflicht-Header-Felder vorhanden und korrekt
- Country-Scope-Logik konsistent
- Speaker-Objekte und Felder komplett
- Token-Level Speaker-Felder nicht mehr vorhanden (nach Normalisierung)

**Eingaben:**
- Liest rekursiv alle `*.json` aus `media/transcripts/`
- Keine CLI-Argumente

**Ausgaben:**
- Konsolenausgabe mit Validierungsfehlern

**Aufrufbeispiel:**
```powershell
cd C:\dev\corapan-webapp
python scripts/check_normalized_transcripts.py
```

---

### 4. `scripts/blacklab/prepare_json_for_blacklab.py`

**Zweck:**  
Bereitet v3-JSON-Transkripte für BlackLab JSON-Indexierung vor:
- Flattened `segments[].words[]` zu Top-Level `tokens[]` Array
- Kopiert Segment-Speaker-Info auf jedes Token
- Kopiert Dokument-Metadaten auf jedes Token

**Eingaben:**
- `--in`: Eingabeverzeichnis (Standard: `media/transcripts`)
- `--out`: Ausgabeverzeichnis (z.B. `data/blacklab_export/json_ready`)
- `--limit`: Optionale Begrenzung der Dateianzahl

**Ausgaben:**
- Schreibt geflattete JSON-Dateien nach `--out`

**Aufrufbeispiel:**
```powershell
python scripts/blacklab/prepare_json_for_blacklab.py --in media/transcripts --out data/blacklab_export/json_ready
```

---

### 5. `src/scripts/blacklab_index_creation.py`

**Zweck:**  
Exportiert JSON v3-Corpus zu TSV + docmeta.jsonl für BlackLab-Indexierung:
- Idempotent (Hash-basiert, überspringt unveränderte Dateien)
- Validiert mandatory Token-Felder
- Unicode NFKC-Normalisierung
- Fehlerprotokollierung in `export_errors.jsonl`

**Eingaben:**
- `--in`: Eingabeverzeichnis (Standard: `media/transcripts`)
- `--out`: Ausgabeverzeichnis (Standard: `data/blacklab_export/tsv`)
- `--docmeta`: Pfad für docmeta.jsonl
- `--format`: Export-Format (`tsv`)
- `--workers`: Anzahl Worker-Threads
- `--limit`: Optionale Begrenzung
- `--dry-run`: Trockenlauf ohne Schreiboperationen

**Ausgaben:**
- TSV-Dateien in `--out`
- `docmeta.jsonl` mit Dokumentmetadaten

**Aufrufbeispiel:**
```powershell
python -m src.scripts.blacklab_index_creation --in media/transcripts --out data/blacklab_export/tsv --format tsv
```

---

### 6. `LOKAL/01 - Add New Transcriptions/03b_generate_blacklab_export.py`

**Zweck:**  
Wrapper-Skript, das die BlackLab-Export-Pipeline (`src/scripts/blacklab_index_creation`) auslöst.

**Eingaben:**
- Keine CLI-Argumente (nutzt Standardpfade)

**Ausgaben:**
- TSV-Dateien in `data/blacklab_export/tsv/`
- DocMeta in `data/blacklab_export/docmeta.jsonl`

**Aufrufbeispiel:**
```powershell
python "LOKAL/01 - Add New Transcriptions/03b_generate_blacklab_export.py"
```

---

### 7. `LOKAL/01 - Add New Transcriptions/01 preprocess JSON/preprocess_json.py`

**Zweck:**  
Vorverarbeitung neuer JSON-Dateien vor der Annotation:
- Entfernt unerwünschte Felder (`duration`, `conf`, `pristine`)
- Bereinigt abgebrochene Wörter (`-,` und `-.` → `-`)
- Entfernt `(foreign)`-Tags und markiert Fremdwörter
- Standardisiert Speaker-Mapping (`speakers` → `speaker_code`)

**Eingaben:**
- Arbeitet auf `json-pre/` Unterordner relativ zum Skript
- Erstellt automatisch Backup in `json-backup/`

**Ausgaben:**
- Überschreibt JSON-Dateien in `json-pre/` in-place

**Aufrufbeispiel:**
```powershell
cd "LOKAL/01 - Add New Transcriptions/01 preprocess JSON"
python preprocess_json.py
```

---

### 8. `LOKAL/01 - Add New Transcriptions/02 annotate JSON/annotation_json_in_media_v3.py`

**Zweck:**  
Vollständige spaCy-Annotation mit v3-Schema:
- Morphologische Annotation (POS, Lemma, Dep, Morph)
- Zeitstempel in Millisekunden (`start_ms`, `end_ms`)
- Englische Tense-Labels (`PastType`, `FutureType` in `morph`)
- Idempotenzcheck (nur neu annotieren bei Änderungen)
- Stabile Token-IDs

**Eingaben:**
- Durchsucht rekursiv `media/transcripts/`
- CLI-Argument: `safe` (Standard, Idempotenzcheck) oder `force` (alle neu)

**Ausgaben:**
- Überschreibt JSON-Dateien in-place

**Aufrufbeispiel:**
```powershell
cd "LOKAL/01 - Add New Transcriptions/02 annotate JSON"
python annotation_json_in_media_v3.py safe
```

---

### 9. `LOKAL/01 - Add New Transcriptions/04 update full corpus in Zenodo-Repo/zenodo_corpus_zip.py`

**Zweck:**  
Erstellt ZIP-Archive für Zenodo-Publikation:
- Sammelt JSON-Dateien aus `media/transcripts/` nach Länderordner
- Kopiert zugehörige MP3-Dateien aus `media/mp3-full/`
- Kopiert Metadaten-Dateien
- Inkrementelles Update (nur geänderte Dateien)

**Eingaben:**
- Liest aus `media/transcripts/` und `media/mp3-full/`
- Metadaten aus `data/metadata/latest/`

**Ausgaben:**
- ZIP-Dateien in `LOKAL/.../ZIPs/`
- Log-Datei `zip_process.log`

**Aufrufbeispiel:**
```powershell
cd "LOKAL/01 - Add New Transcriptions/04 update full corpus in Zenodo-Repo"
python zenodo_corpus_zip.py
```

---

### 10. `scripts/blacklab/docmeta_to_metadata_dir.py`

**Zweck:**  
Konvertiert `data/blacklab_export/docmeta.jsonl` zu einzelnen Metadaten-JSON-Dateien.

**Eingaben:**
- Fest kodierter Pfad: `data/blacklab_export/docmeta.jsonl`

**Ausgaben:**
- Einzelne JSON-Dateien in `data/blacklab_export/metadata/`

**Aufrufbeispiel:**
```powershell
python scripts/blacklab/docmeta_to_metadata_dir.py
```

---

### 11. `scripts/blacklab/docmeta_to_metadata_local.py`

**Zweck:**  
Wie oben, aber mit flexiblen CLI-Argumenten.

**Eingaben:**
- Argument 1: Pfad zu `docmeta.jsonl`
- Argument 2: Ausgabeverzeichnis

**Ausgaben:**
- Einzelne JSON-Dateien im angegebenen Ausgabeverzeichnis

**Aufrufbeispiel:**
```powershell
python scripts/blacklab/docmeta_to_metadata_local.py data/blacklab_export/docmeta.jsonl data/blacklab_export/metadata
```

---

## Legacy-Skripte (veraltet)

Die folgenden Skripte sind unter `LOKAL/01 - Add New Transcriptions/02 annotate JSON/legacy/` archiviert:

| Skript | Beschreibung |
|--------|--------------|
| `annotation_json_in_media.py` | Original v1-Annotation |
| `annotation_json_in_media_v2.py` | v2-Annotation mit ms-Zeitstempeln und stabilen IDs |
| `annotation_fix_tense_types_temp.py` | Temporäres Fix-Skript für Tense-Typen |
| `annotation_migrate_tense_schema.py` | Migration des Tense-Schemas |
| `validate_json_v2.py` | Validierung für v2-Schema |
| `test_idempotency_v2.py` | Tests für v2-Idempotenz |

---

## Gelöschte Skripte (nicht mehr relevant)

Die folgenden Skripte wurden aus der Git-History gelöscht, da sie für den alten SQLite-basierten Ansatz verwendet wurden und **nicht** mit den JSON-Dateien unter `media/transcripts/` arbeiteten:

- `scripts/create_minimal_transcription_db.py` – Erstellte SQLite-DB für Token-Suche
- `scripts/check_token_db.py` – Überprüfte Token in SQLite-DB

Diese Skripte wurden durch die BlackLab-Pipeline ersetzt und müssen nicht wiederhergestellt werden.

---

## Typischer Workflow

1. **Neue Rohdaten vorbereiten:**
   ```
   LOKAL/01 - Add New Transcriptions/01 preprocess JSON/preprocess_json.py
   ```

2. **spaCy-Annotation durchführen:**
   ```
   LOKAL/01 - Add New Transcriptions/02 annotate JSON/annotation_json_in_media_v3.py
   ```

3. **JSON normalisieren:**
   ```
   scripts/normalize_transcripts.py
   ```

4. **Normalisierung validieren:**
   ```
   scripts/check_normalized_transcripts.py
   ```

5. **BlackLab-Export erstellen:**
   ```
   LOKAL/01 - Add New Transcriptions/03b_generate_blacklab_export.py
   ```
   oder direkt:
   ```
   python -m src.scripts.blacklab_index_creation
   ```

6. **Für Zenodo-Publikation:**
   ```
   LOKAL/01 - Add New Transcriptions/04 update full corpus in Zenodo-Repo/zenodo_corpus_zip.py
   ```
