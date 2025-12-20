---
title: "BlackLab Format (BLF) YAML Schema"
status: active
owner: backend-team
updated: "2025-11-10"
tags: [blacklab, configuration, yaml, schema]
links:
  - ../concepts/blacklab-indexing.md
  - ../reference/blacklab-api-proxy.md
  - ../how-to/build-blacklab-index.md
---

# BlackLab Format (BLF) YAML Schema

Konfigurationsdatei für BlackLab Index: `config/blacklab/corapan.blf.yaml`

## Top-Level Properties

```yaml
fileType: tabular              # Dateityp: tabular (TSV) oder xml (WPL)
fileTypeOptions:               # Format-spezifische Optionen
  type: tsv
  columnNames: true            # Erste Zeile = Header

annotatedFields:               # Linguistische Annotationen
  contents:
    displayName: "..."
    annotations:
      - { name: word, ... }
      
metadata:                      # Metadaten für Filterung
  fields:
    - { name: file_id, ... }
```

---

## fileTypeOptions

### TSV Format

```yaml
fileTypeOptions:
  type: tsv
  columnNames: true            # First row is header
```

**Beispiel TSV-Datei:**
```
word	norm	lemma	pos	start_ms	end_ms	...
Buenos	buenos	buenos	PROPN	0	500	...
Aires	aires	aires	PROPN	500	1000	...
```

---

## annotations (Pflichtfeld)

Definiert durchsuchbare Token-Eigenschaften:

```yaml
annotatedFields:
  contents:
    annotations:
      - name: word
        displayName: "Word Form"
        description: "Original word as transcribed"
        valuePath: word              # TSV column name
        sensitivity: INSENSITIVE_DIACRITICS
        
      - name: lemma
        displayName: "Lemma"
        valuePath: lemma
        optional: false
        
      - name: start_ms
        displayName: "Start (ms)"
        valuePath: start_ms
        type: numeric                # Numeric type for range queries
```

### Annotation Properties

| Property | Typ | Beschreibung | Beispiel |
|---|---|---|---|
| `name` | string | Eindeutiger Name | `word`, `lemma` |
| `displayName` | string | UI-Anzeige | "Word Form" |
| `description` | string | Hilfetext | "Original word..." |
| `valuePath` | string | TSV-Spaltenname | "word" |
| `sensitivity` | enum | Case/Diacritic-Handling | `INSENSITIVE_DIACRITICS` |
| `type` | enum | Datentyp | `text` (default), `numeric` |
| `optional` | bool | Optional? | `true` / `false` |

### Sensitivity Values

```
INSENSITIVE_ALL          # Case & diacritics ignored
INSENSITIVE_DIACRITICS   # Only diacritics ignored (case-sensitive)
SENSITIVE                # Exact match (case & diacritics matter)
DIACRITICS_ONLY          # Case-insensitive, diacritics matter
```

### Type Values

```
text                     # Default: string/text
numeric                  # For range queries (start_ms, end_ms)
classification           # Categorical (pos tags, country codes)
```

---

## metadata Fields

Für Facetierung, Filterung, und Dokumentendaten:

```yaml
metadata:
  namingScheme: "file_id"           # Primary key
  fields:
    - name: file_id
      displayName: "File ID"
      description: "Unique document ID"
      valuePath: "@doc"              # @ = attribute (docmeta.jsonl)
      type: tokenized                # Indexed & searchable
      
    - name: country_code
      displayName: "Country"
      valuePath: "@country_code"
      type: classification           # For facets/filters
      uiType: select                 # UI hint
      
    - name: date
      displayName: "Date"
      valuePath: "@date"
      type: range                    # For date range queries
```

### Metadata Field Properties

| Property | Typ | Beschreibung |
|---|---|---|
| `name` | string | Field identifier |
| `displayName` | string | User-facing name |
| `valuePath` | string | `@fieldname` (from docmeta.jsonl) |
| `type` | enum | `tokenized`, `untokenized`, `text`, `classification`, `range` |
| `uiType` | enum | UI hint: `select`, `text`, `date`, `range` |

---

## inlineTags (für WPL Format)

(Nur relevant wenn `fileType: xml`)

```yaml
inlineTags:
  - path: ".//utt"           # XPath: Utterance
    displayName: "Utterance"
    
  - path: ".//s"             # XPath: Sentence
    displayName: "Sentence"
```

---

## CO.RA.PAN Annotation Set

Vollständige Liste aller CO.RA.PAN-Annotationen:

```yaml
annotatedFields:
  contents:
    annotations:
      # Required
      - { name: word,        valuePath: word,        sensitivity: INSENSITIVE_DIACRITICS }
      - { name: norm,        valuePath: norm,        sensitivity: INSENSITIVE_DIACRITICS }
      - { name: lemma,       valuePath: lemma,       sensitivity: INSENSITIVE_DIACRITICS }
      - { name: pos,         valuePath: pos }
      - { name: tokid,       valuePath: tokid }
      - { name: start_ms,    valuePath: start_ms,    type: numeric }
      - { name: end_ms,      valuePath: end_ms,      type: numeric }
      - { name: sentence_id, valuePath: sentence_id }
      - { name: utterance_id, valuePath: utterance_id }
      
      # Optional (Grammatical)
      - { name: past_type,   valuePath: past_type,   optional: true }
      - { name: future_type, valuePath: future_type, optional: true }
      - { name: tense,       valuePath: tense,       optional: true }
      - { name: mood,        valuePath: mood,        optional: true }
      - { name: person,      valuePath: person,      optional: true }
      - { name: number,      valuePath: number,      optional: true }
      - { name: aspect,      valuePath: aspect,      optional: true }
      
      # Optional (Other)
      - { name: speaker_code, valuePath: speaker_code, optional: true }

metadata:
  fields:
    - { name: file_id,       valuePath: "@doc",            type: tokenized }
    - { name: country_code,  valuePath: "@country_code",   type: classification, uiType: select }
    - { name: date,          valuePath: "@date",           type: range }
    - { name: radio,         valuePath: "@radio",          type: tokenized, uiType: select }
    - { name: city,          valuePath: "@city",           type: tokenized, uiType: select }
    - { name: audio_path,    valuePath: "@audio_path",     type: text }
```

---

## Docmeta Format

Die `docmeta.jsonl` Datei muss folgendes Format haben:

```json
{"doc": "ARG_2023-08-10_ARG_Mitre", "country_code": "ARG", "date": "2023-08-10", "radio": "Radio Mitre", "city": "Buenos Aires", "audio_path": "2023-08-10_ARG_Mitre.mp3"}
```

**Felder:**
- `doc` (required): Matches TSV filename without extension
- `country_code`: ISO 3-letter code
- `date`: YYYY-MM-DD format
- `radio`: Station name
- `city`: City name
- `audio_path`: Path to audio file (for playback)

---

## Indexing Configuration

```yaml
indexing:
  indexed: true              # Create Lucene index
  analyzer: standard         # Lucene analyzer
  defaultSort: file_id       # Default sort order
```

---

## Validation Checklist

- [ ] `fileType`: ist `tabular` oder `xml`?
- [ ] TSV: `columnNames: true` gesetzt?
- [ ] Alle Annotation-Namen eindeutig?
- [ ] `valuePath` entspricht TSV-Spalten?
- [ ] Metadata `@` Präfixe vorhanden?
- [ ] Docmeta `doc` Feld = TSV-Dateiname (ohne .tsv)?
- [ ] Unicode: UTF-8 encoding?
- [ ] YAML: Valid YAML syntax (no tabs)?

---

## Siehe auch

- [BlackLab Indexing Architecture](../concepts/blacklab-indexing.md) - Design & implementation
- [Build BlackLab Index (How-To)](../how-to/build-blacklab-index.md) - Practical guide
- [BlackLab API Reference](../reference/blacklab-api-proxy.md) - API endpoints
