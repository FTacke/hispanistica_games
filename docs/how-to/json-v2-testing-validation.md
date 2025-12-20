---
title: "JSON v2 Testing & Validation Guide"
status: active
owner: backend-team
updated: "2025-11-08"
tags: [testing, validation, quality-assurance, json]
links:
  - ../reference/json-annotation-v2-specification.md
  - ../how-to/json-annotation-workflow.md
---

# JSON v2 Testing & Validation Guide

Vollständige Test-Suite für JSON-Annotation v2.

---

## Übersicht

**Scripts:**
- `validate_json_v2.py` - Strukturelle Validierung
- `test_idempotency_v2.py` - Idempotenz & Mutations-Tests

**Test-Bereiche:**
1. Pflichtfelder
2. Format-Validierung
3. Konsistenz-Checks
4. Hierarchie-Validierung
5. Idempotenz
6. Kollisions-Tests

---

## 1. Strukturelle Validierung

### Script: `validate_json_v2.py`

**Checks:**
- ✅ `ann_meta` Objekt vorhanden und vollständig
- ✅ Alle Token-Pflichtfelder vorhanden
- ✅ Alle Segment-Pflichtfelder vorhanden
- ✅ Format-Validierung (token_id, start_ms/end_ms Integer)
- ✅ Konsistenz (utt_start_ms = min(start_ms), etc.)
- ✅ Hierarchie (sentence_id/utterance_id)
- ✅ norm-Beispiele (¡Está!→esta, año→año)
- ✅ Token-ID Kollisionstest (eindeutig)

### Verwendung

```powershell
# Aktiviere venv
.\.venv\Scripts\Activate.ps1

# Navigiere zum Script-Ordner
cd "LOKAL\01 - Add New Transcriptions\02 annotate JSON"

# Validiere 5 Dateien (Test)
python validate_json_v2.py 5

# Validiere alle Dateien
python validate_json_v2.py all
```

### Erwartete Ausgabe (v1-Dateien)

```
📁 Validiere 5 Dateien...
[1/5] ARG/001.json... ✗ (12,345 Fehler)
   Fehler:
      ❌ Fehlendes 'ann_meta' Objekt
      ❌ Segment 0 fehlt 'utt_start_ms'
      ❌ Token 0 fehlt 'token_id'
      ❌ Token 0 fehlt 'norm'
      ...

VALIDIERUNGS-ERGEBNISSE
   Total:      5 Dateien
   ✓ Valid:    0 Dateien
   ✗ Invalid:  5 Dateien
   Fehler:     537,428
```

**Interpretation:** v1-Dateien haben erwartete Fehler (fehlendes ann_meta, IDs, norm)

### Erwartete Ausgabe (v2-Dateien, nach Annotation)

```
📁 Validiere 5 Dateien...
[1/5] ARG/001.json... ✓
[2/5] ARG/002.json... ✓
[3/5] BOL/001.json... ✓
[4/5] CHI/001.json... ✓
[5/5] COL/001.json... ✓

VALIDIERUNGS-ERGEBNISSE
   Total:      5 Dateien
   ✓ Valid:    5 Dateien
   ✗ Invalid:  0 Dateien
   Fehler:     0
   Warnungen:  0

🔍 Token-ID Kollisionstest: 18,543 eindeutige IDs

🎉 ALLE DATEIEN VALID!
```

---

## 2. Idempotenz-Tests

### Script: `test_idempotency_v2.py`

**Tests:**
1. **Safe-Run**: Überspringe unveränderte Dateien
2. **Force-Run**: Aktualisiere Timestamp, behalte IDs
3. **Mutations-Test**: Erkenne fehlende Felder

### Verwendung

```powershell
# Navigiere zum Script-Ordner
cd "LOKAL\01 - Add New Transcriptions\02 annotate JSON"

# Führe Idempotenz-Tests aus
python test_idempotency_v2.py
```

### Test 1: Safe-Run (Überspringen)

**Ablauf:**
1. Script erstellt 3 Test-Dateien in `media/transcripts/_TEST/`
2. Simuliert bereits annotierte Dateien (mit ann_meta)
3. **Manuell:** Führe `python annotation_json_in_media_v2.py safe` aus
4. **Erwartung:** Alle 3 Dateien werden übersprungen (Timestamp unverändert)

**Erfolgskriterium:**
```
✓ ARG_001.json: Übersprungen (Timestamp unverändert)
✓ BOL_002.json: Übersprungen (Timestamp unverändert)
✓ CHI_003.json: Übersprungen (Timestamp unverändert)
```

### Test 2: Force-Run (Timestamp-Update)

**Ablauf:**
1. Nimmt 1 Test-Datei mit ann_meta
2. Speichert Token-IDs und Timestamp
3. **Manuell:** Führe `python annotation_json_in_media_v2.py force` aus
4. **Erwartung:** Timestamp aktualisiert, Token-IDs bleiben gleich

**Erfolgskriterium:**
```
✓ Timestamp aktualisiert
⚠️  Token-ID Vergleich: TEST:0:0:5 vs TEST:0:0:5 (gleich)
```

### Test 3: Mutations-Test (Fehlende Felder)

**Ablauf:**
1. Nimmt 1 vollständig annotierte Datei
2. Entfernt `norm` bei 2 Tokens (Mutation)
3. **Manuell:** Führe `python annotation_json_in_media_v2.py safe` aus
4. **Erwartung:** Datei wird NEU ANNOTIERT, `norm` wiederhergestellt

**Erfolgskriterium:**
```
✓ Alle 'norm' Felder wiederhergestellt
```

---

## 3. Manuelle Smoke-Tests

### Perfekt-Erkennung

**Suche in annotierten JSONs nach:**

| Suche | Erwartetes `past_type` |
|-------|------------------------|
| `"ha cantado"` | `PerfectoCompuesto` |
| `"ya ha cantado"` | `PerfectoCompuesto` |
| `"había cantado"` | `Pluscuamperfecto` |
| `"habrá cantado"` | `FuturoPerfecto` |
| `"habría cantado"` | `CondicionalPerfecto` |
| `"canté"` (Verb) | `PerfectoSimple` |

**Wie prüfen:**
```powershell
# In VS Code: Suche in Dateien (Ctrl+Shift+F)
"text": "cantado"
# → Prüfe past_type im gleichen Token-Objekt
```

### Analytisches Futur

| Suche | Erwartetes `future_type` |
|-------|--------------------------|
| `"voy a cantar"` | `analyticalFuture` |
| `"no voy a cantar"` | `analyticalFuture` |
| `"iba a cantar"` | `analyticalFuture_past` |
| `"voy a Madrid"` (Nomen) | `""` (leer) |

### Normalisierung

| Original | Erwartetes `norm` |
|----------|-------------------|
| `"¡Está!"` | `"esta"` |
| `"año"` | `"año"` (Tilde bleibt!) |
| `"México"` | `"mexico"` |
| `"¿Qué?"` | `"que"` |

---

## 4. Performance-Tests

### Laufzeit-Messung

**Test:** Annotiere 1 Datei mit ~3.500 Tokens

```powershell
# Messung starten
$start = Get-Date

# Annotation
python annotation_json_in_media_v2.py safe
# → Wähle 1 Datei

# Messung stoppen
$end = Get-Date
$duration = ($end - $start).TotalSeconds
Write-Host "Dauer: $duration Sekunden"
```

**Erwartung:**
- 40-50 Sekunden pro 3.500 Tokens
- ~12 Tokens/Sekunde

### Speicher-Verbrauch

**Test:** JSON-Dateigröße

```powershell
# Größe vor Annotation (v1)
Get-Item "media\transcripts\ARG\001.json" | Select Length

# Größe nach Annotation (v2)
Get-Item "media\transcripts\ARG\001.json" | Select Length
```

**Erwartung:**
- v1: ~150 KB
- v2: ~220 KB (+47%)

---

## 5. Konsistenz-Tests

### Token-ID Format

**Regex:** `^[A-Z]{3}_[0-9]{3}:\d+:\d+:\d+$`

**Beispiel:** `ARG_001:2:1:6`

**Check:**
```python
import re
pattern = r'^[A-Z]{3}_[0-9]{3}:\d+:\d+:\d+$'
assert re.match(pattern, "ARG_001:2:1:6")
```

### Hierarchie-Konsistenz

**Check:**
```python
# sentence_id muss utterance_id als Präfix haben
token_id = "ARG_001:2:1:6"
sentence_id = "ARG_001:2:s1"
utterance_id = "ARG_001:2"

assert sentence_id.startswith(utterance_id + ":")
assert token_id.startswith(sentence_id.rsplit(":", 1)[0])
```

### Zeit-Konsistenz

**Check:**
```python
# utt_start_ms = min(word.start_ms)
# utt_end_ms = max(word.end_ms)
words = segment["words"]
assert segment["utt_start_ms"] == min(w["start_ms"] for w in words)
assert segment["utt_end_ms"] == max(w["end_ms"] for w in words)
```

---

## 6. Fehlerkriterien

| Fehler | Bedeutung | Kritikalität |
|--------|-----------|--------------|
| **Fehlendes `ann_meta`** | Datei nicht v2-annotiert | 🔴 Kritisch |
| **Fehlende Token-IDs** | IDs nicht generiert | 🔴 Kritisch |
| **Fehlende `norm`** | Normalisierung fehlgeschlagen | 🔴 Kritisch |
| **Doppelte `token_id`** | Kollision! | 🔴 Kritisch |
| **Negative `start_ms`** | Ungültiger Timestamp | 🔴 Kritisch |
| **Float `start_ms`** | Falscher Typ | 🟡 Warnung |
| **Leeres `past_type`** | Normal (kein Perfekt) | ⚪ OK |
| **Hierarchie inkonsistent** | IDs passen nicht | 🔴 Kritisch |

---

## 7. Test-Checklist

### Vor Produktion

- [ ] `validate_json_v2.py 5` → 0 Fehler auf Test-Sample
- [ ] Idempotenz-Test → Safe-Run überspringt
- [ ] Force-Run → Timestamp aktualisiert
- [ ] Mutations-Test → Fehlende Felder erkannt
- [ ] Smoke-Tests → Perfekt-Labels korrekt
- [ ] Smoke-Tests → Futur-Labels korrekt
- [ ] Smoke-Tests → norm-Beispiele korrekt
- [ ] Performance → <60 Sek pro 3.500 Tokens
- [ ] Kollisions-Test → Alle IDs eindeutig

### Nach Vollständiger Annotation

- [ ] `validate_json_v2.py all` → Alle Dateien valid
- [ ] Statistik plausibel (PerfectoSimple >5%)
- [ ] DB-Import funktioniert
- [ ] Corpus-Search findet Tokens via `norm`

---

## 8. Troubleshooting

### Problem: Validierung zeigt viele Fehler nach Annotation

**Diagnose:**
```powershell
# Prüfe eine Datei manuell
code "media\transcripts\ARG\001.json"
# → Suche nach "ann_meta"
```

**Ursachen:**
- Annotation nicht ausgeführt
- Annotation fehlgeschlagen (Check Logs)
- Falsche Dateien validiert

### Problem: Token-IDs nicht eindeutig

**Diagnose:**
```python
# Suche Duplikate
from collections import Counter
token_ids = [...alle token_ids...]
dupes = [id for id, count in Counter(token_ids).items() if count > 1]
print(dupes)
```

**Ursache:**
- File-ID-Generierung fehlerhaft
- Zwei Dateien mit gleichem Namen

### Problem: norm falsch

**Diagnose:**
```python
# Test Normalisierung
from annotation_json_in_media_v2 import normalize_token
assert normalize_token("¡Está!") == "esta"
assert normalize_token("año") == "año"
```

**Ursache:**
- Normalisierungs-Algorithmus fehlerhaft
- Unicode-Handling Problem

---

## 9. Continuous Testing

### Bei jedem Script-Update

```powershell
# 1. Syntax-Check
python -m py_compile annotation_json_in_media_v2.py

# 2. Validierung auf Sample
python validate_json_v2.py 3

# 3. Annotation auf 1 Datei
python annotation_json_in_media_v2.py safe
# → Wähle 1 Datei

# 4. Re-Validierung
python validate_json_v2.py 1
```

### Bei Content-Änderungen

```powershell
# Safe-Run sollte nur geänderte Dateien erkennen
python annotation_json_in_media_v2.py safe
# → Check: "text changed (hash mismatch): X Dateien"
```

---

## Siehe auch

- [JSON Annotation v2 Specification](../reference/json-annotation-v2-specification.md)
- [JSON Annotation Workflow](../how-to/json-annotation-workflow.md)
- [JSON Annotation v2 Summary](../JSON_ANNOTATION_V2_SUMMARY.md)
