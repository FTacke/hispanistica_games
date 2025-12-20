---
title: "Token-ID Migration: Annotation vs Database"
date: "2025-11-08"
status: in-progress
tags: [migration, token-id, architecture]
---

# Token-ID Migration: Von DB zu Annotation

## Ziel

Token-IDs werden jetzt **ausschließlich** in `annotation_json_in_media_v2.py` generiert und in JSON-Dateien geschrieben. `database_creation_v2.py` liest die IDs nur noch aus den JSONs.

## Status

✅ **ABGESCHLOSSEN:**
- Token-ID-Funktionen nach `annotation_json_in_media_v2.py` kopiert
- Phase A-C (Sammeln, Digest, Schreiben) in Annotation-Script integriert
- `MIGRATE_TOKEN_IDS` Flag hinzugefügt
- Syntax-Check erfolgreich

⏳ **IN ARBEIT:**
- `database_creation_v2.py` Phasen 2-3 entfernen
- Validierung der JSON-IDs implementieren

## Änderungen

### `annotation_json_in_media_v2.py`

**Neu hinzugefügt:**
1. **Imports:** `sys`, `importlib.util`, `Path`, `defaultdict`
2. **Country Code Import:** `normalize_country_code` aus `src/app/config/countries.py`
3. **Token-ID Konstante:** `MIGRATE_TOKEN_IDS = False`
4. **Token-ID Funktionen:**
   - `canon_time(x)`: Zeitstempel auf 2 Dezimalstellen
   - `make_digest(cc, date_iso, start, end, text, use_text_fallback)`: MD5-Hash
   - `assign_min_unique_prefix_lengths(digests, k_start=9, k_max=16)`: Minimale Präfixlängen
   - `make_token_id(cc_normalized, digest, prefix_length)`: ID-Format `CC<digest[:k]>`
5. **Phase-Funktionen:**
   - `generate_all_token_ids(all_files, migrate)`: Phase A-C (Sammeln → Digest → Mapping)
   - `write_token_ids_to_json(file_path, id_list, migrate)`: Schreibe IDs in JSON

**Workflow-Änderung:**
```python
# ALT:
collect_files() → annotate_files() → done

# NEU:
collect_files() 
→ generate_all_token_ids()  # Phase A-C (ALLE Dateien!)
→ write_token_ids_to_json() # Nur bei fehlenden/migrate
→ annotate_files()          # Nur ausgewählte Dateien
→ done
```

**Wichtig:** IDs werden für **ALLE Dateien** berechnet (deterministisch), aber nur geänderte geschrieben.

### `database_creation_v2.py`

**Entfernt:**
- `MIGRATE_V2` Flag
- `canon_time()`, `make_digest()`, `assign_min_unique_prefix_lengths()`, `make_token_id()`
- Phase 2: "Computing deterministic token IDs"
- Phase 3: "Writing token IDs to JSON files"

**Ersetzt durch:**
- Phase 2: "Validiere token_ids aus JSON"
  - Prüfe, ob `token_id` vorhanden
  - Prüfe auf Duplikate
  - **Fehler bei fehlenden IDs** mit klarer Anleitung

**Verhalten bei fehlenden IDs:**
```
❌ FEHLER: 12345 Tokens ohne token_id!
   
   ⚠️  LÖSUNG: Führe zuerst 'annotation_json_in_media_v2.py' aus!
      Dieses Script generiert token_ids für alle JSON-Dateien.
   
   Command: python annotation_json_in_media_v2.py safe
```

## Algorithmus (unverändert)

**Digest-Berechnung:**
```python
composite = f"{CC_normalized}|{date_iso}|{start:.2f}|{end:.2f}|{text}_{global_idx}"
digest = md5(composite).hexdigest()
```

**Präfixlängen:**
- Start: 9 Hex-Zeichen
- Max: 16 Hex-Zeichen
- Iterativ erhöhen bei Kollisionen (ordnungsunabhängig)

**ID-Format:**
```
ARG4eaa21699  # ARG + 9 Hex
BOLa39e5c014d # BOL + 11 Hex
CHI2bf12f81d7a # CHI + 12 Hex
```

## Migration-Workflow

### 1. Erste Ausführung (Token-IDs setzen)

```bash
# Setze MIGRATE_TOKEN_IDS = True für einmaliges Überschreiben
python annotation_json_in_media_v2.py safe

# Erwartung:
# - Phase A-C: Berechne IDs für alle Dateien
# - Schreibe IDs in alle JSONs
# - Annotation läuft normal weiter
```

### 2. Weitere Ausführungen (Idempotent)

```bash
# Setze MIGRATE_TOKEN_IDS = False (Standard)
python annotation_json_in_media_v2.py safe

# Erwartung:
# - Phase A-C: IDs werden berechnet
# - Schreiben: Nur fehlende IDs setzen
# - Keine Änderung bei vorhandenen IDs
```

### 3. Database-Rebuild

```bash
python database_creation_v2.py build

# Erwartung:
# - Phase 1: Sammle Tokens aus JSON
# - Phase 2: Validiere vorhandene token_ids
# - Phase 3: Insert in DB
# - KEINE ID-Neuberechnung
# - KEIN JSON-Schreiben
```

## Tests

### Test 1: Syntax-Check ✅

```bash
python -m py_compile annotation_json_in_media_v2.py
# Exit Code: 0 (erfolgreich)
```

### Test 2: Token-ID Generierung (ausstehend)

```bash
# Trockenlauf auf 2 Dateien
python annotation_json_in_media_v2.py safe
# Input: 2

# Erwartung:
# - Phase A-C läuft für ALLE Dateien
# - IDs werden in 2 Dateien geschrieben
# - Annotation läuft für 2 Dateien
```

### Test 3: DB ohne IDs (ausstehend)

```bash
# Ohne vorherige Annotation
python database_creation_v2.py build

# Erwartung:
# - Fehler: "X Tokens ohne token_id"
# - Klare Anleitung: "Führe annotation_json_in_media_v2.py aus"
# - Abbruch mit Exit Code 0
```

### Test 4: DB mit IDs (ausstehend)

```bash
# Nach Annotation
python database_creation_v2.py build

# Erwartung:
# - Validierung: Alle IDs vorhanden
# - DB-Insert erfolgreich
# - Keine JSON-Schreibvorgänge
```

## Offene Punkte

1. ⏳ `database_creation_v2.py` Funktion `run_transcription()` vollständig ersetzen
2. ⏳ Test auf 2-3 Dateien ausführen
3. ⏳ Validierung mit `validate_json_v2.py` nach Annotation
4. ⏳ DB-Rebuild testen
5. ⏳ Idempotenz-Tests durchführen

## Rollback-Plan

Falls Probleme auftreten:

1. **JSON-Dateien wiederherstellen:** Aus Git-History oder Backup
2. **Alte Version nutzen:** `git checkout HEAD~1 database_creation_v2.py`
3. **IDs neu generieren:** `python database_creation_v2.py build` mit alter Version

## Nächste Schritte

1. Vervollständige `database_creation_v2.py` Vereinfachung
2. Trockenlauf: Annotation auf 2 Dateien
3. Validierung: Prüfe token_ids in JSONs
4. DB-Rebuild: Teste Validierung und Insert
5. Korpuslauf: Annotation auf alle Dateien
6. Finaler DB-Rebuild

## Abnahmekriterien

✅ **Erfolg wenn:**
- Annotation-Script generiert IDs für alle Dateien
- IDs sind deterministisch (gleiche Eingabe → gleiche IDs)
- IDs sind eindeutig (keine Duplikate)
- DB-Script liest IDs aus JSON (keine Neuberechnung)
- DB-Script bricht ab bei fehlenden IDs
- Re-Runs sind idempotent (keine unnötigen Schreibvorgänge)
- Algorithmus bleibt unverändert (exakt wie zuvor)
