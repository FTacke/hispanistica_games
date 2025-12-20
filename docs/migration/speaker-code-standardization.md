---
title: "Speaker Code Standardization Migration"
status: active
owner: backend-team
updated: "2025-11-08"
tags: [migration, speakers, json-schema, preprocessing]
links:
  - ../reference/json-annotation-v2-schema.md
  - ../how-to/add-new-transcriptions.md
---

# Speaker Code Standardization Migration

Migration von `speakers[]` Array + `segment.speaker` (spkid) zu standardisiertem `segment.speaker_code` in allen JSON-Transkripten.

---

## Scope

**Was ändert sich:**
- Entfernung des `speakers` Arrays aus JSON-Dateien
- Ersetzung von `segment.speaker` (spkid) durch `segment.speaker_code` (standardisierter Code)
- Validierung gegen erlaubte Speaker-Codes
- Markierung migrierter Dateien in `ann_meta`

**Betroffene Dateien:**
- Alle existierenden JSONs: `media/transcripts/**/*.json` (146 Dateien)
- Neue JSONs: automatisch via `preprocess_json.py`

**Zeitraum:** 2025-11-08

---

## Motivation

### Problem (vorher)

```json
{
  "speakers": [
    {"spkid": "spk1", "name": "lib-pm"},
    {"spkid": "spk2", "name": "lib-pf"}
  ],
  "segments": [
    {
      "speaker": "spk1",
      "words": [...]
    }
  ]
}
```

**Nachteile:**
- Indirektion: `speaker` referenziert `spkid` → Lookup erforderlich
- Redundanz: `speakers` Array dupliziert Information
- Inkonsistenz: Keine Validierung der Codes
- Legacy: `spkid` (spk1, spk2, UUIDs) ohne semantischen Wert

### Lösung (nachher)

```json
{
  "segments": [
    {
      "speaker_code": "lib-pm",
      "words": [...]
    }
  ],
  "ann_meta": {
    "speaker_code_migrated": true,
    "speaker_migration_timestamp": "2025-11-08T18:29:04+00:00"
  }
}
```

**Vorteile:**
- ✅ Direkter Zugriff: `speaker_code` enthält validierten Code
- ✅ Keine Indirektion mehr
- ✅ Validierung gegen `ALLOWED_CODES`
- ✅ Kleinere JSON-Dateien
- ✅ Einfacheres DB-Processing

---

## Erlaubte Speaker-Codes

```python
ALLOWED_CODES = {
    "lib-pm",  "lib-pf",  "lib-om",  "lib-of",   # Libre: Politiker/in, andere
    "lec-pm",  "lec-pf",  "lec-om",  "lec-of",   # Lectura
    "pre-pm",  "pre-pf",                         # Presentador/a
    "tie-pm",  "tie-pf",                         # Tie-in (Einspieler)
    "traf-pm", "traf-pf",                        # Tráfico
    "foreign"                                    # Fremdsprache
}
NONE_CODE = "none"  # Fallback für unbekannte Codes
```

**Code-Format:** `{rolle}-{geschlecht}{modus}`
- Rolle: `lib`, `lec`, `pre`, `tie`, `traf`, `foreign`
- Geschlecht: `p` (politician), `o` (other)
- Modus: `m` (masculino), `f` (femenino)

---

## Migration Plan

### Phase 1: Existierende JSONs (einmalig)

**Tool:** `migrate_speakers_to_codes.py`

```bash
cd "LOKAL/01 - Add New Transcriptions"
python migrate_speakers_to_codes.py \
  --root ../../media/transcripts \
  --backup speakers_backup.jsonl
```

**Aktionen:**
1. Erstellt Backup aller `speakers` Arrays in `speakers_backup.jsonl` (JSONL-Format)
2. Mappt `segment.speaker` (spkid) → `speakers[].name` → validierter `speaker_code`
3. Entfernt `speakers` Array
4. Entfernt `segment.speaker` Feld
5. Setzt `ann_meta.speaker_code_migrated = true`
6. Schreibt JSON atomar (via `.tmp` Datei)

**Ergebnis:** 146/146 Dateien migriert ✅

### Phase 2: Neue JSONs (dauerhaft)

**Tool:** `preprocess_json.py` (erweitert)

**Integration:**
- Schritt 4 der Preprocessing-Pipeline
- Läuft automatisch bei `python preprocess_json.py`
- Arbeitet auf `json-pre/` Ordner

**Aktionen (identisch zu Phase 1):**
1. Liest `speakers` Array (falls vorhanden)
2. Setzt `speaker_code` in allen Segmenten
3. Validiert gegen `ALLOWED_CODES`
4. Entfernt `speakers` Array und `segment.speaker`
5. Markiert in `ann_meta`

---

## Datenänderungen

### JSON-Schema

**Entfernt:**
```json
{
  "speakers": [...],           // ❌ Gelöscht
  "segments": [
    {
      "speaker": "spk1",       // ❌ Gelöscht
      ...
    }
  ]
}
```

**Hinzugefügt:**
```json
{
  "segments": [
    {
      "speaker_code": "lib-pm",  // ✅ Neu, validiert
      ...
    }
  ],
  "ann_meta": {
    "speaker_code_migrated": true,              // ✅ Flag
    "speaker_migration_timestamp": "2025-11-08..." // ✅ Zeitstempel
  }
}
```

### Validierung

**Unbekannte Codes → `"none"`:**
- Beispiel gefunden: `"rev"` → `"none"`
- Werden in Statistik ausgegeben

**Backup-Format (JSONL):**
```json
{"file": "path/to/file.json", "removed_speakers": [...], "timestamp": "..."}
```

---

## Ausführung

### Schritt 1: Backup überprüfen

```bash
ls -l "LOKAL/01 - Add New Transcriptions/speakers_backup.jsonl"
```

### Schritt 2: Stichprobe prüfen

```bash
# Beispiel-Datei vor/nach
git diff media/transcripts/ARG/2023-08-10_ARG_Mitre.json
```

**Erwartung:**
- ❌ `"speakers": [...]` entfernt
- ❌ `"speaker": "spk1"` entfernt  
- ✅ `"speaker_code": "lib-pm"` vorhanden
- ✅ `"ann_meta.speaker_code_migrated": true` vorhanden

### Schritt 3: Preprocessing testen

```bash
cd "LOKAL/01 - Add New Transcriptions/01 preprocess JSON"

# Test mit einer neuen JSON
python preprocess_json.py
```

**Erwartete Ausgabe:**
```
Speaker-Blöcke migriert:        1
Speaker-Codes gesetzt:          42
```

---

## Rollback / Backout

### Option 1: Backup wiederherstellen

```bash
# Speakers aus Backup extrahieren (Python-Script nötig)
python restore_speakers_from_backup.py speakers_backup.jsonl
```

**Hinweis:** `speakers` Array kann rekonstruiert werden, aber `spkid` Werte gehen verloren (waren ohnehin ohne Semantik).

### Option 2: Git Revert

```bash
git revert <commit-hash>
```

---

## Risiken

### Bekannte Probleme

1. **Unbekannte Speaker-Codes:**
   - Gefunden: `"rev"` → auf `"none"` gesetzt
   - **Lösung:** Falls `"rev"` valide sein soll, zu `ALLOWED_CODES` hinzufügen und erneut migrieren

2. **spkid-Verlust:**
   - Original `spkid` (z.B. UUIDs) gehen verloren
   - **Mitigation:** Backup in `speakers_backup.jsonl` vorhanden

3. **Downstream-Abhängigkeiten:**
   - `database_creation_v3.py` muss auf `speaker_code` umgestellt werden
   - Export-Skripte müssen angepasst werden
   - **Status:** ⚠️ TODO

### Prävention

- ✅ Atomares Schreiben (`.tmp` Datei)
- ✅ Backup vor Migration
- ✅ Dry-Run verfügbar (`--dry-run`)
- ✅ Validierung gegen `ALLOWED_CODES`

---

## Nächste Schritte

### Immediate (P0)

- [ ] `database_creation_v3.py` auf `speaker_code` umstellen
- [ ] Export-Skripte (TSV, TXT) anpassen
- [ ] Suche im Corpus: Speaker-Filter auf `speaker_code` umstellen

### Follow-Up (P1)

- [ ] `"rev"` Code validieren oder dokumentieren
- [ ] Preprocessing-Pipeline dokumentieren
- [ ] Unit-Tests für Speaker-Migration

### Optional (P2)

- [ ] `restore_speakers_from_backup.py` erstellen
- [ ] Validierungs-Script für `speaker_code` Konsistenz

---

## Siehe auch

- [JSON Annotation v2 Schema](../reference/json-annotation-v2-schema.md) - Vollständiges Schema
- [Add New Transcriptions How-To](../how-to/add-new-transcriptions.md) - Workflow
- [Preprocessing Documentation](../reference/preprocessing-pipeline.md) - Pipeline-Details
