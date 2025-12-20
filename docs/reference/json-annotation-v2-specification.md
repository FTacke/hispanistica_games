---
title: "JSON-Annotation v2 Spezifikation"
status: active
owner: backend-team
updated: "2025-11-08"
tags: [annotation, json, nlp, spacy, specification, corpus]
links:
  - ../how-to/json-annotation-workflow.md
  - corpus-search-architecture.md
  - ../operations/database-creation.md
---

# JSON-Annotation v2 Spezifikation

Vollständige Spezifikation des CO.RA.PAN JSON-Annotations-Schemas Version 2.

---

## Überblick

**Version:** `corapan-ann/v2`  
**Script:** `LOKAL/01 - Add New Transcriptions/02 annotate JSON/annotation_json_in_media_v2.py`  
**spaCy-Modell:** `es_dep_news_trf`

### Erweiterungen gegenüber v1

| Feature | v1 | v2 |
|---------|----|----|
| **Token-IDs** | ❌ Keine | ✅ Stabil, hierarchisch |
| **Satz-/Äußerungs-IDs** | ❌ Keine | ✅ Hierarchisch |
| **Zeitstempel** | ✅ Sekunden (float) | ✅ Millisekunden (int) |
| **Normalisierung** | ❌ Keine | ✅ `norm` Feld |
| **Idempotenz** | ⚠️ Grob (pos vorhanden?) | ✅ Text-Hash + Felder |
| **Metadaten** | ❌ Keine | ✅ `ann_meta` Objekt |
| **Perfektformen** | ⚠️ String-basiert (head_text) | ✅ Lemma-/morph-basiert |
| **Analytisches Futur** | ⚠️ Festes 3-Token-Fenster | ✅ Flexibel mit Gap-Handling |
| **BlackLab-Export** | ❌ Nested in morph | ✅ Flache Felder (past_type, future_type) |

---

## JSON-Struktur

### Top-Level Schema

```json
{
  "ann_meta": {
    "version": "corapan-ann/v2",
    "spacy_model": "es_dep_news_trf",
    "text_hash": "abc123...",
    "required": ["token_id", "sentence_id", ...],
    "timestamp": "2025-11-08T14:30:00+00:00"
  },
  "segments": [
    {
      "id": 0,
      "utt_start_ms": 1200,
      "utt_end_ms": 8500,
      "words": [...]
    }
  ]
}
```

---

## Metadaten-Objekt (`ann_meta`)

Pflichtfelder für Idempotenz und Versionskontrolle.

### Felder

| Feld | Typ | Beschreibung | Beispiel |
|------|-----|--------------|----------|
| `version` | String | Schema-Version | `"corapan-ann/v2"` |
| `spacy_model` | String | Verwendetes spaCy-Modell | `"es_dep_news_trf"` |
| `text_hash` | String | SHA1-Hash über alle Token-Texte | `"a1b2c3d4..."` |
| `required` | Array | Liste der Pflicht-Token-Felder | `["token_id", ...]` |
| `timestamp` | String | ISO-8601 Zeitstempel (UTC) | `"2025-11-08T14:30:00+00:00"` |

### Idempotenz-Logik

Datei wird **übersprungen** wenn:
1. `ann_meta.version == "corapan-ann/v2"`
2. `ann_meta.text_hash == aktueller_hash`
3. Alle `required` Felder in allen Tokens vorhanden

Sonst: **Neu annotieren**

---

## Segment-Felder

Pro Äußerung/Segment (entspricht Whisper-Segment).

### Pflichtfelder

| Feld | Typ | Beschreibung | Beispiel |
|------|-----|--------------|----------|
| `utt_start_ms` | Integer | Start der Äußerung in ms | `1200` |
| `utt_end_ms` | Integer | Ende der Äußerung in ms | `8500` |
| `words` | Array | Liste der Token-Objekte | `[...]` |

**Berechnung:**
```python
utt_start_ms = min(word.start_ms for word in words)
utt_end_ms = max(word.end_ms for word in words)
```

---

## Token-Felder

Pro Token (Wort) im Korpus.

### Pflichtfelder

| Feld | Typ | Beschreibung | Beispiel |
|------|-----|--------------|----------|
| **IDs** | | | |
| `token_id` | String | Eindeutige Token-ID | `"ARG_001:0:0:5"` |
| `sentence_id` | String | Satz-ID | `"ARG_001:0:s0"` |
| `utterance_id` | String | Äußerungs-ID | `"ARG_001:0"` |
| **Zeit** | | | |
| `start_ms` | Integer | Token-Start in ms | `1200` |
| `end_ms` | Integer | Token-Ende in ms | `1500` |
| **Text & Basis-Annotation** | | | |
| `text` | String | Original-Text | `"Está"` |
| `lemma` | String | Lemma (Grundform) | `"estar"` |
| `pos` | String | Part-of-Speech Tag | `"AUX"` |
| `dep` | String | Dependency-Relation | `"cop"` |
| `head_text` | String | Head-Token Text | `"bien"` |
| `morph` | Object | Morphologische Features | `{"Mood": "Ind", ...}` |
| **Normalisierung & Zeitformen** | | | |
| `norm` | String | Normalisierte Suchform | `"esta"` |
| `past_type` | String | Vergangenheitsform-Label | `"PerfectoCompuesto"` |
| `future_type` | String | Zukunftsform-Label | `"analyticalFuture"` |

### Optionale Felder

| Feld | Typ | Beschreibung | Beispiel |
|------|-----|--------------|----------|
| `start` | Float | Original-Start in Sekunden | `1.2` |
| `end` | Float | Original-Ende in Sekunden | `1.5` |
| `foreign` | String | Fremdwort-Flag | `"1"` |

---

## ID-Hierarchie

### Format

```
token_id      = "{file_id}:{utt_idx}:{sent_idx}:{token_idx}"
sentence_id   = "{file_id}:{utt_idx}:s{sent_idx}"
utterance_id  = "{file_id}:{utt_idx}"
file_id       = "{country}_{file_number}"
```

### Beispiel

**Datei:** `media/transcripts/ARG/001.json`  
**File-ID:** `ARG_001`

**Token 6 in Satz 1 der Äußerung 2:**
- `token_id`: `"ARG_001:2:1:6"`
- `sentence_id`: `"ARG_001:2:s1"`
- `utterance_id`: `"ARG_001:2"`

### Eigenschaften

- ✅ **Deterministisch**: Gleiche Datei → gleiche IDs
- ✅ **Stabil**: IDs ändern sich nicht bei Re-Annotation (solange Text gleich)
- ✅ **Hierarchisch**: Token → Satz → Äußerung → Datei
- ✅ **Sortierbar**: Lexikographisch sortiert = chronologisch

---

## Normalisierung (`norm`)

Deterministische Pipeline für akzent-/case-indifferente Suche.

### Algorithmus

```python
1. Unicode NFKD-Normalisierung
2. Entferne kombinierende Akzente außer Tilde (ñ bleibt ñ)
3. Lowercase
4. Entferne führende/trailing Interpunktion (inkl. ¿¡)
5. Whitespace komprimieren
```

### Beispiele

| Original | `norm` | Erklärung |
|----------|--------|-----------|
| `"¡Está!"` | `"esta"` | Akzent weg, lowercase, Interpunktion weg |
| `"año"` | `"año"` | Tilde bleibt! |
| `"México"` | `"mexico"` | Akzent weg |
| `"  café  "` | `"cafe"` | Whitespace komprimiert, Akzent weg |
| `"¿Qué?"` | `"que"` | Akzent weg, Interpunktion weg |

### Verwendung

**Such-Query:** `"esta"` → findet `"Está"`, `"está"`, `"ESTÁ"`, `"¡está!"`

**Datenbank:**
```sql
WHERE norm LIKE '%esta%'
```

---

## Vergangenheitsformen (Perfekt)

Robuste Erkennung via **lemma + morph** statt String-Listen.

### Strategie

1. **PerfectoSimple**: `Tense=Past` + `VerbForm=Fin` (nicht-AUX)
2. **Partizip + AUX haber**: Suche AUX mit `lemma="haber"` innerhalb ≤3 nicht-ignorierbarer Tokens
3. **Tense-Mapping**: Tense des AUX → Perfektform-Label

### Erkannte Labels (`past_type`)

| Label | Beschreibung | Beispiel | AUX Tense |
|-------|--------------|----------|-----------|
| `PerfectoSimple` | Einfache Vergangenheit | `"canté"` | - |
| `PerfectoCompuesto` | Zusammengesetztes Perfekt | `"he cantado"` | `Pres` |
| `Pluscuamperfecto` | Plusquamperfekt | `"había cantado"` | `Imp` |
| `FuturoPerfecto` | Futur II | `"habré cantado"` | `Fut` |
| `CondicionalPerfecto` | Konditional Perfekt | `"habría cantado"` | `Cond` |
| `OtroCompuesto` | Andere zusammengesetzte Form | - | (andere) |
| `PastOther` | Andere Vergangenheit | - | - |

### Gap-Handling

**Erlaubte Zwischentokens** (werden übersprungen):
- **POS**: `PRON`, `ADV`, `PART`, `ADP`, `SCONJ`, `PUNCT`
- **Tokens**: `no`, `ya`, `aún`, `todavía`, `también`, `solo`, `sólo`

**Beispiele:**
```
"ya ha cantado"         → PerfectoCompuesto (1 Gap: 'ya')
"no ha cantado aún"     → PerfectoCompuesto (2 Gaps: 'no', 'aún')
"lo ha cantado"         → PerfectoCompuesto (1 Gap: 'lo')
"había ya cantado"      → Pluscuamperfecto (1 Gap: 'ya')
```

### Exklusionen

❌ **Existential haber**: Partizip mit `lemma="haber"` → **nicht** als Perfekt klassifizieren

```
"hubo lluvia"  → PastOther (nicht PerfectoSimple auf AUX)
"había gente"  → Keine Perfekt-Label
```

---

## Zukunftsformen (Analytisches Futur)

Flexibles Fenster für `ir + a + Infinitiv`.

### Strategie

1. **Finde `ir`**: Token mit `lemma="ir"` und `POS in {AUX, VERB}`
2. **Finde `a`**: ADP innerhalb ≤3 nicht-ignorierbarer Tokens
3. **Finde Infinitiv**: VERB mit `VerbForm=Inf` innerhalb ≤3 nicht-ignorierbarer Tokens nach `a`
4. **Label nach Tense**: `Pres` → `analyticalFuture`, `Imp` → `analyticalFuture_past`

### Erkannte Labels (`future_type`)

| Label | Beschreibung | Beispiel | ir Tense |
|-------|--------------|----------|----------|
| `analyticalFuture` | Analytisches Futur (Präsens) | `"voy a cantar"` | `Pres` |
| `analyticalFuture_past` | Analytisches Futur (Imperfekt) | `"iba a cantar"` | `Imp` |

### Gap-Handling

**Beispiele:**
```
"voy a cantar"          → analyticalFuture
"no voy a cantar"       → analyticalFuture (1 Gap: 'no')
"voy a cantar ya"       → analyticalFuture
"iba a cantar"          → analyticalFuture_past
"vamos a ir a Madrid"   → analyticalFuture (nur 1. Infinitiv markiert)
```

### Exklusionen

❌ **`ir a` + Nomen**: Kein `future_type` Label

```
"voy a Madrid"     → Kein Label (kein Infinitiv)
"ir a la tienda"   → Kein Label
```

---

## Flache Felder für BlackLab

Für einfachen Export und Indizierung.

### `past_type` & `future_type`

**Quelle:** Nested in `morph.Past_Tense_Type` und `morph.Future_Type`  
**Ziel:** Flache String-Felder im Token-Objekt

**Extraktion:**
```python
w["past_type"] = w.get("morph", {}).get("Past_Tense_Type", "")
w["future_type"] = w.get("morph", {}).get("Future_Type", "")
```

**Vorteile:**
- ✅ Triviales Mapping für DB-Export
- ✅ Direkte CQL-Abfragen in BlackLab
- ✅ Keine Nested-Dict-Navigation nötig

**Beispiel-CQL:**
```
[past_type="PerfectoCompuesto"]  # Alle Perfecto-Compuesto Formen
[future_type="analyticalFuture"] # Alle 'ir a + Inf' Formen
```

---

## Satz-Bildung

Algorithmus zur Unterteilung von Äußerungen in Sätze.

### Regel

Token mit Satzende-Zeichen (`.`, `?`, `!`) markieren Satzgrenze.

### Beispiel

**Äußerung:** `"Hola. ¿Cómo estás? Bien."`

**Sätze:**
1. `["Hola", "."]` → `sentence_id: "...:s0"`
2. `["¿", "Cómo", "estás", "?"]` → `sentence_id: "...:s1"`
3. `["Bien", "."]` → `sentence_id: "...:s2"`

### Kontext-Annotation

**spaCy-Parsing:** Satz-1 + Satz + Satz+1 (für bessere Dependency-Auflösung)

---

## Spezialfälle

### Foreign-Wörter

**Kennzeichnung:** `"foreign": "1"` im Token-Objekt

**Verhalten:**
- ✅ IDs werden generiert
- ✅ Zeit-Felder werden gesetzt
- ❌ **Keine spaCy-Annotation** (pos, lemma, etc. fehlen)

### Self-Correction (Abgebrochene Wörter)

**Muster:** Token endet mit `-` (z.B. `"tu-"`, `"est-,"`)

**Annotation:**
```json
{
  "text": "tu-",
  "pos": "self-correction",
  "lemma": "tu-",
  "dep": "",
  "head_text": "",
  "morph": {}
}
```

### Interjektionen

**Beispiel:** `"eeh"`

**Annotation:**
```json
{
  "text": "eeh",
  "pos": "INTJ",
  "lemma": "eeh",
  "dep": "",
  "head_text": "",
  "morph": {}
}
```

---

## Idempotenz & Modi

### Safe-Modus (Standard)

**Ablauf:**
1. Lade Datei
2. Prüfe `ann_meta.version`
3. Berechne `text_hash`
4. Prüfe Required Fields
5. **Überspringe** wenn alles aktuell
6. Sonst: Annotiere neu

**Kommando:**
```bash
python annotation_json_in_media_v2.py safe
```

### Force-Modus

**Ablauf:**
1. Ignoriere Idempotenz-Check
2. Annotiere **alle** Dateien neu

**Kommando:**
```bash
python annotation_json_in_media_v2.py force
```

### Logging

Pro Lauf werden geloggt:
- ✅ Anzahl übersprungene Dateien (+ Grund)
- ✅ Anzahl neu annotierte Dateien
- ✅ Fehlende Felder vor/nach Lauf
- ✅ Zeitformen-Statistiken (Sample)

---

## Validierung & Smoke-Tests

### Erwartete Ergebnisse

| Kontext | Token | Erwartetes Label | Feld |
|---------|-------|------------------|------|
| `"ya ha cantado"` | `"cantado"` | `PerfectoCompuesto` | `past_type` |
| `"había cantado"` | `"cantado"` | `Pluscuamperfecto` | `past_type` |
| `"habrá cantado"` | `"cantado"` | `FuturoPerfecto` | `past_type` |
| `"habría cantado"` | `"cantado"` | `CondicionalPerfecto` | `past_type` |
| `"canté"` | `"canté"` | `PerfectoSimple` | `past_type` |
| `"no vamos a cantar"` | `"cantar"` | `analyticalFuture` | `future_type` |
| `"iba a cantar"` | `"cantar"` | `analyticalFuture_past` | `future_type` |
| `"ir a Madrid"` | `"ir"` | `""` (kein Label) | `future_type` |
| `"hubo lluvia"` | `"hubo"` | `""` (kein Label) | `past_type` |

### Prüf-Query (nach Annotation)

**In Python:**
```python
import json

with open("media/transcripts/ARG/001.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Prüfe Metadaten
assert data["ann_meta"]["version"] == "corapan-ann/v2"

# Prüfe Token-Felder
for seg in data["segments"]:
    for w in seg["words"]:
        assert "token_id" in w
        assert "sentence_id" in w
        assert "past_type" in w  # Kann leer sein
        assert "future_type" in w
        assert "norm" in w
```

### Statistik-Prüfung

Nach Lauf wird automatisch geloggt:
```
📊 ZEITFORMEN-STATISTIKEN
   🕐 Vergangenheitsformen:
      • PerfectoCompuesto        1,234 (2.45%)
      • PerfectoSimple          3,456 (6.89%)
      • Pluscuamperfecto          234 (0.47%)
   
   🕑 Zukunftsformen:
      • analyticalFuture          567 (1.13%)
      • analyticalFuture_past      89 (0.18%)
```

---

## Performance

### Laufzeit

**Benchmark** (typische Datei mit 3.500 Tokens):
- **v1 (String-basiert):** ~45 Sekunden
- **v2 (Lemma-basiert):** ~48 Sekunden (+7%)

**Overhead durch Gap-Handling:** Minimal (<10%)

### Speicher

**JSON-Dateigröße:**
- **v1:** ~150 KB (ohne IDs/norm)
- **v2:** ~220 KB (mit IDs/norm/flachen Feldern) (+47%)

### Optimierungen

- ✅ Idempotenz verhindert unnötige Re-Annotationen
- ✅ Gap-Search limitiert auf ±3 Tokens
- ✅ Lokale Suche pro Satz (nicht global)

---

## Migration von v1 zu v2

### Automatische Migration

**Script führt automatisch durch:**
1. Entfernt alte Annotations-Felder (außer text/start/end)
2. Generiert IDs
3. Führt spaCy-Annotation aus
4. Post-Processing (Zeitformen)
5. Flatten für BlackLab
6. Schreibt `ann_meta`

### Kompatibilität

**v1-Dateien:**
- ✅ Werden erkannt (fehlende `ann_meta.version`)
- ✅ Automatisch auf v2 migriert
- ⚠️ Alte Felder werden überschrieben

**Backup empfohlen vor Migration!**

---

## Fehlerbehandlung

### Häufige Fehler

| Fehler | Ursache | Lösung |
|--------|---------|--------|
| `"PRESENT_FORMS" is not defined` | Alte v1-Imports | Nutze v2-Script |
| `Missing ann_meta` | v1-Datei | Normal, wird migriert |
| `text_hash mismatch` | Content geändert | Normal, wird neu annotiert |
| `spaCy model not found` | Modell nicht installiert | `python -m spacy download es_dep_news_trf` |

### Fallback-Strategie

**Token-Matching fehlgeschlagen:**
1. Versuche vorwärts-Suche in spaCy-Doc
2. Falls nicht gefunden: Parse Token einzeln (`annotate_fallback`)
3. Setze minimale Annotation (pos/lemma/morph)

---

## Siehe auch

- [How-To: JSON Annotation Workflow](../how-to/json-annotation-workflow.md) - Praktische Anleitung
- [Corpus Search Architecture](corpus-search-architecture.md) - Such-Backend Integration
- [Database Creation](../operations/database-creation.md) - DB-Import nach Annotation
- [spaCy Documentation](https://spacy.io/models/es) - Spanische Modelle
- [Universal Dependencies](https://universaldependencies.org/) - POS/Morph-Tags
