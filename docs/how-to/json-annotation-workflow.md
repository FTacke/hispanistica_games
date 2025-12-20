---
title: "How-To: JSON Annotation Workflow"
status: active
owner: backend-team
updated: "2025-11-08"
tags: [how-to, annotation, workflow, json, nlp]
links:
  - ../reference/json-annotation-v2-specification.md
  - ../reference/corpus-search-architecture.md
  - ../operations/database-creation.md
---

# How-To: JSON Annotation Workflow

Praktische Anleitung zur Annotation von CO.RA.PAN Transkripten mit v2-Schema.

---

## Ziel

Nach dieser Anleitung können Sie:
- ✅ JSON-Transkripte mit linguistischen Annotationen versehen
- ✅ Idempotente Re-Läufe durchführen
- ✅ Zeitformen robust erkennen (Perfekt, analytisches Futur)
- ✅ Annotationen validieren und statistisch auswerten

---

## Voraussetzungen

### Software

- Python 3.9+
- spaCy 3.x
- Spanisches spaCy-Modell: `es_dep_news_trf`

### Installation

```powershell
# Virtual Environment aktivieren
.\.venv\Scripts\Activate.ps1

# spaCy-Modell installieren (falls noch nicht vorhanden)
python -m spacy download es_dep_news_trf
```

### Datenstruktur

```
media/
  transcripts/
    ARG/
      001.json
      002.json
      ...
    BOL/
      001.json
      ...
    CHI/
      ...
```

---

## Schritte

### Schritt 1: Backup erstellen (empfohlen)

Vor der ersten Annotation oder bei Force-Modus:

```powershell
# Backup-Ordner erstellen
New-Item -ItemType Directory -Path "media\transcripts_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

# Alle JSON-Dateien kopieren
Copy-Item -Path "media\transcripts\*\*.json" -Destination "media\transcripts_backup_*" -Recurse
```

**Wichtig:** Bei v1→v2 Migration werden alte Annotationen überschrieben!

---

### Schritt 2: Script ausführen

**Navigiere zum Script-Ordner:**
```powershell
cd "LOKAL\01 - Add New Transcriptions\02 annotate JSON"
```

#### Option A: Safe-Modus (Standard, empfohlen)

Nur geänderte/neue Dateien annotieren:

```powershell
python annotation_json_in_media_v2.py safe
```

**Ablauf:**
1. Script fragt: `[all]` oder `[Zahl]`
2. Eingabe: `all` (alle Dateien) oder z.B. `5` (erste 5 Dateien)
3. Script analysiert Dateien (Idempotenz-Check)
4. Zeigt Übersicht: X zu annotieren, Y übersprungen
5. Annotiert nur notwendige Dateien

**Wann nutzen:**
- ✅ Reguläre Re-Läufe
- ✅ Nach Content-Änderungen
- ✅ Fehlende Felder ergänzen

#### Option B: Force-Modus

Alle Dateien neu annotieren (ignoriert Idempotenz):

```powershell
python annotation_json_in_media_v2.py force
```

**Wann nutzen:**
- ⚠️ Nach spaCy-Modell-Update
- ⚠️ Nach Script-Änderungen (z.B. Zeitformen-Regeln)
- ⚠️ Validierung/Debugging

**Warnung:** Kann mehrere Stunden dauern bei großem Korpus!

---

### Schritt 3: Fortschritt verfolgen

**Output-Beispiel:**

```
🔧 Modus: SAFE
📁 Gefunden: 156 JSON-Dateien

🔍 Analysiere Dateien (Idempotenz-Check)...

📊 ANNOTATIONSÜBERSICHT
   Zu annotieren:  12 Dateien (45,230 Wörter)
   Übersprungen:   144 Dateien

   Gründe für Übersprungen:
      • up-to-date: 144 Dateien

📄 [1/12] ARG/001.json
   └─ 3,850 Wörter | Grund: missing fields: norm, token_id, sentence_id...
   ├─ Fortschritt: 2,500 / 45,230 Wörter (5.5%)
   ├─ Fortschritt: 3,850 / 45,230 Wörter (8.5%)
   └─ ✓ ARG/001.json (annotated)
```

**Symbole:**
- `✓` = Erfolgreich annotiert
- `⊙` = Übersprungen (bereits aktuell)
- `✗` = Fehler

---

### Schritt 4: Validierung

#### A) Metadaten prüfen

Öffne eine annotierte Datei:

```powershell
code "media\transcripts\ARG\001.json"
```

**Erwartete Struktur (Top-Level):**

```json
{
  "ann_meta": {
    "version": "corapan-ann/v2",
    "spacy_model": "es_dep_news_trf",
    "text_hash": "a1b2c3d4e5...",
    "required": ["token_id", "sentence_id", ...],
    "timestamp": "2025-11-08T14:30:00+00:00"
  },
  "segments": [...]
}
```

#### B) Token-Felder prüfen

**Erwartete Token-Struktur:**

```json
{
  "text": "cantado",
  "start": 1.2,
  "end": 1.5,
  "token_id": "ARG_001:0:0:5",
  "sentence_id": "ARG_001:0:s0",
  "utterance_id": "ARG_001:0",
  "start_ms": 1200,
  "end_ms": 1500,
  "lemma": "cantar",
  "pos": "VERB",
  "dep": "ROOT",
  "head_text": "cantado",
  "morph": {
    "VerbForm": ["Part"],
    "Tense": ["Past"],
    "Past_Tense_Type": "PerfectoCompuesto"
  },
  "norm": "cantado",
  "past_type": "PerfectoCompuesto",
  "future_type": ""
}
```

#### C) Smoke-Tests (manuelle Suche)

Suche nach typischen Konstruktionen in JSON-Dateien:

| Suche nach | Erwartetes Label | Feld |
|------------|------------------|------|
| `"ha cantado"` | `PerfectoCompuesto` | `past_type` |
| `"había cantado"` | `Pluscuamperfecto` | `past_type` |
| `"voy a cantar"` | `analyticalFuture` | `future_type` |
| `"iba a cantar"` | `analyticalFuture_past` | `future_type` |

**Beispiel (VS Code Search):**
1. `Ctrl+Shift+F` (Suche in Dateien)
2. Suche: `"text": "cantado"`
3. Prüfe `past_type` Feld im gleichen Token-Objekt

#### D) Statistik-Ausgabe prüfen

Am Ende des Laufs zeigt das Script automatisch:

```
📊 ZEITFORMEN-STATISTIKEN (aus annotierten Dateien)
   Tokens analysiert: 50,000

   🕐 Vergangenheitsformen:
      • PerfectoSimple          3,456 (6.91%)
      • PerfectoCompuesto        1,234 (2.47%)
      • Pluscuamperfecto          234 (0.47%)
      • FuturoPerfecto             12 (0.02%)
      • CondicionalPerfecto         5 (0.01%)

   🕑 Zukunftsformen:
      • analyticalFuture          567 (1.13%)
      • analyticalFuture_past      89 (0.18%)
```

**Sanity-Checks:**
- ✅ PerfectoSimple sollte häufigster Wert sein
- ✅ PerfectoCompuesto sollte 2-5% der Tokens sein
- ✅ analyticalFuture sollte 1-2% sein
- ⚠️ Wenn alle Werte 0: Script-Problem!

---

### Schritt 5: Fehlerbehandlung

#### Fehler: spaCy-Modell nicht gefunden

```
❌ Can't find model 'es_dep_news_trf'
```

**Lösung:**
```powershell
python -m spacy download es_dep_news_trf
```

#### Fehler: Alte v1-Imports

```
❌ "PRESENT_FORMS" is not defined
```

**Lösung:** Nutze `annotation_json_in_media_v2.py` (nicht v1!)

#### Fehler: Datei-Encoding

```
❌ UnicodeDecodeError: 'charmap' codec can't decode...
```

**Lösung:** Script nutzt automatisch `utf-8`. Falls Problem besteht:
```python
# In Script ändern:
open(file, "r", encoding="utf-8")
```

#### Einzelne Datei überspringen

Falls eine Datei Probleme macht:

1. **Temporär entfernen:**
   ```powershell
   Move-Item "media\transcripts\ARG\problematic.json" "media\transcripts\problematic_temp.json"
   ```

2. **Annotation durchführen**

3. **Datei zurück und einzeln debuggen:**
   ```powershell
   Move-Item "media\transcripts\problematic_temp.json" "media\transcripts\ARG\problematic.json"
   ```

---

### Schritt 6: Re-Runs (Idempotenz)

**Szenario:** Einige Dateien haben neuen Content

```powershell
# Safe-Modus läuft automatisch nur neue/geänderte Dateien
python annotation_json_in_media_v2.py safe
# Eingabe: all
```

**Erwartetes Verhalten:**
- ✅ Dateien mit gleichem `text_hash` werden übersprungen
- ✅ Nur geänderte Dateien werden annotiert
- ✅ Neue Dateien werden vollständig annotiert

**Log:**
```
   Gründe für Übersprungen:
      • up-to-date: 144 Dateien
      • text changed: 8 Dateien  → werden annotiert
      • missing fields: 4 Dateien → werden annotiert
```

---

## Validierungs-Checklist

Nach jedem Lauf:

- [ ] `ann_meta.version == "corapan-ann/v2"`
- [ ] `ann_meta.text_hash` vorhanden (40 Zeichen SHA1)
- [ ] `ann_meta.timestamp` im ISO-8601 Format
- [ ] Alle Tokens haben `token_id` (Format: `COUNTRY_FILE:UTT:SENT:TOKEN`)
- [ ] Alle Tokens haben `sentence_id` (Format: `COUNTRY_FILE:UTT:sSENT`)
- [ ] Alle Tokens haben `start_ms`/`end_ms` (Integer)
- [ ] Alle Tokens haben `norm` (lowercase, ohne Akzente außer ñ)
- [ ] Alle Tokens haben `past_type`/`future_type` (kann leer sein)
- [ ] Alle Segmente haben `utt_start_ms`/`utt_end_ms`
- [ ] Statistik zeigt plausible Werte (PerfectoSimple > 5%)

---

## Rollback

Falls Annotation fehlschlägt oder unerwünschte Ergebnisse:

```powershell
# Backup wiederherstellen
Remove-Item -Path "media\transcripts" -Recurse
Copy-Item -Path "media\transcripts_backup_YYYYMMDD_HHmmss" -Destination "media\transcripts" -Recurse
```

---

## Performance-Tipps

### Kleine Test-Läufe

Vor vollständigem Lauf auf Sample testen:

```powershell
python annotation_json_in_media_v2.py safe
# Eingabe: 5  (nur erste 5 Dateien)
```

### Parallele Verarbeitung (fortgeschritten)

Für sehr große Korpora:

```powershell
# Split nach Ländern und parallel verarbeiten (manuell)
# Terminal 1:
python annotation_json_in_media_v2.py safe  # Nur ARG/BOL/CHI auswählen

# Terminal 2:
python annotation_json_in_media_v2.py safe  # Nur COL/CRI/etc. auswählen
```

**Achtung:** Erfordert manuelle Selektion!

### Monitoring

Bei großen Läufen:

```powershell
# Fortschritt verfolgen
Get-Content "annotation.log" -Wait  # Falls Logging implementiert
```

---

## Integration mit nachfolgenden Steps

### → Database Creation

Nach erfolgreicher Annotation:

```powershell
cd "..\03 update DB"
python database_creation_v2.py
```

**Nutzt automatisch:**
- ✅ `token_id` für eindeutige Token-Referenzen
- ✅ `norm` für Suchindex
- ✅ `past_type`/`future_type` für Filter
- ✅ `start_ms`/`end_ms` für Timeline

### → Corpus Search

Nach DB-Import:

```python
# In Search-Backend
WHERE norm LIKE '%cantado%'
  AND past_type = 'PerfectoCompuesto'
```

---

## Prävention

### Vor jedem Lauf

1. **Backup** (bei Force-Modus)
2. **Git Commit** der aktuellen JSONs (falls versioniert)
3. **Test auf Sample** (erste 5 Dateien)

### Regelmäßige Wartung

- **Monatlich:** Idempotenz-Check auf allen Dateien (`safe` Modus)
- **Nach Content-Updates:** Re-Annotation betroffener Dateien
- **Nach spaCy-Update:** Force-Modus auf kompletten Korpus

---

## Troubleshooting-Guide

| Problem | Diagnose | Lösung |
|---------|----------|--------|
| **Alle Dateien übersprungen** | `up-to-date` | Normal! Keine Aktion nötig |
| **Keine Zeitformen erkannt** | Statistik zeigt 0% | Prüfe spaCy-Modell, Force-Modus testen |
| **Zu viele False Positives** | PerfectoCompuesto bei Nomen | Bug! Report an Dev-Team |
| **Langsame Performance** | >1 Min pro 1000 Tokens | Normal bei `es_dep_news_trf` (Transformer) |
| **Out of Memory** | RAM >8GB | Kleinere Batches (z.B. 10 Dateien) |

---

## Siehe auch

- [JSON Annotation v2 Specification](../reference/json-annotation-v2-specification.md) - Vollständige Schema-Dokumentation
- [Corpus Search Architecture](../reference/corpus-search-architecture.md) - Integration mit Such-Backend
- [Database Creation](../operations/database-creation.md) - DB-Import nach Annotation
- [spaCy Spanish Models](https://spacy.io/models/es) - Modell-Dokumentation
