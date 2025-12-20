---
title: "Search Parameters Reference"
status: active
owner: backend-team
updated: "2025-11-10"
tags: [search, api, parameters, cql, reference]
links:
  - ../how-to/advanced-search.md
  - ../concepts/search-architecture.md
  - api-blacklab-proxy.md
---

# Search Parameters Reference

Vollständige Dokumentation aller Suchparameter für die erweiterte Korpussuche.

---

## Überblick

Die erweiterte Suche (`/search/advanced`) akzeptiert GET-Parameter und generiert daraus:
1. **CQL-Pattern** für BlackLab-Query
2. **Dokumentfilter** für Metadaten-basierte Einschränkung

---

## Query-Parameter

### Pflichtparameter

#### `q` (Query)
- **Typ:** String
- **Pflicht:** Ja
- **Beschreibung:** Suchbegriff(e) oder Lema(ta)
- **Format:**
  - Einzelwort: `México`
  - Mehrwort (Sequenz): `ir a casa`
  - Tokenisierung: Whitespace-separiert
- **Beispiele:**
  - `q=méxico` → Einzelwort-Suche
  - `q=ir a` → 2-Token-Sequenz

**Validierung:**
- Darf nicht leer sein
- Muss mindestens 1 Token enthalten (nach Tokenisierung)

---

### Mode-Parameter

#### `mode` (Suchmodus)
- **Typ:** String (Enum)
- **Standard:** `forma`
- **Werte:**
  - `forma` - Normalisierte Form (ci/da aktiv)
  - `forma_exacta` - Exakte Form (case-sensitive)
  - `lemma` - Lemma-Suche

**Mapping zu BlackLab-Feldern:**

| Mode | ci/da | BlackLab-Feld | Beschreibung |
|------|-------|---------------|--------------|
| `forma` | ✅ | `norm` | Normalisiert (lowercase + diacritics removed) |
| `forma` | ❌ | `word` | Exakte Form (wenn ci UND da beide inaktiv) |
| `forma_exacta` | - | `word` | Immer exakt (ignoriert ci/da) |
| `lemma` | - | `lemma` | Lemma (immer lowercase) |

**Beispiel:**
```
q=México&mode=forma&ci=true → [norm="mexico"]
q=México&mode=forma_exacta   → [word="México"]
q=ir&mode=lemma              → [lemma="ir"]
```

---

### Boolean-Optionen

#### `ci` (Case Insensitive)
- **Typ:** Boolean
- **Standard:** `true`
- **Werte:** `true`, `false`, `1`, `0`
- **Effekt:**
  - `true` + `mode=forma` → verwendet `norm`-Feld
  - `false` + `mode=forma` + `da=false` → verwendet `word`-Feld

#### `da` (Diacritics Agnostic)
- **Typ:** Boolean
- **Standard:** `true`
- **Werte:** `true`, `false`, `1`, `0`
- **Effekt:**
  - `true` + `mode=forma` → verwendet `norm`-Feld (Diakritika entfernt)
  - `false` + `mode=forma` + `ci=false` → verwendet `word`-Feld

**Wichtig:** Wenn **ci ODER da** aktiv ist, wird immer `norm` verwendet (nur bei `mode=forma`).

---

### POS-Parameter

#### `pos` (Part-of-Speech Tags)
- **Typ:** String (comma-separated)
- **Optional:** Ja
- **Format:** `TAG1,TAG2,TAG3`
- **Anwendung:** Pro Token in der Reihenfolge der Query

**Beispiel:**
```
q=ir a&pos=VERB,ADP
→ [lemma="ir" & pos="VERB"] [lemma="a" & pos="ADP"]
```

**Verfügbare Tags:**
- **Universal Dependencies:** NOUN, VERB, ADJ, ADP, ADV, PRON, DET, AUX, CONJ, SCONJ, NUM, PART, INTJ, X, SYM, PUNCT
- **Tags werden uppercase konvertiert**

**Hinweis:** Wenn mehr POS-Tags als Tokens vorhanden sind, werden überschüssige Tags ignoriert.

---

## Metadaten-Filter

### Filter-Parameter

#### `country_code` (Ländercode)
- **Typ:** String
- **Format:** ISO 3166-1 Alpha-3 (3-stellig, uppercase)
- **Beispiel:** `ARG`, `MEX`, `ESP`, `CHI`
- **BlackLab-Filter:** `country_code:"ARG"`

#### `radio` (Radiostation)
- **Typ:** String
- **Beispiel:** `LRA1`, `XEQK`, `SER`
- **BlackLab-Filter:** `radio:"LRA1"`

#### `speaker_code` (Sprecher)
- **Typ:** String
- **Beispiel:** `SPK001`, `SPK042`
- **BlackLab-Filter:** `speaker_code:"SPK001"`

#### `date_from` (Datum von)
- **Typ:** String (ISO 8601 Date)
- **Format:** `YYYY-MM-DD`
- **Beispiel:** `2020-01-01`
- **BlackLab-Filter:** `date >= "2020-01-01"`

#### `date_to` (Datum bis)
- **Typ:** String (ISO 8601 Date)
- **Format:** `YYYY-MM-DD`
- **Beispiel:** `2020-12-31`
- **BlackLab-Filter:** `date <= "2020-12-31"`

---

### Filter-Kombinierung

Mehrere Filter werden mit `AND` verknüpft:

**Beispiel:**
```
country_code=ARG&date_from=2020-01-01&date_to=2020-12-31

BlackLab-Filter:
country_code:"ARG" AND date >= "2020-01-01" AND date <= "2020-12-31"
```

---

## Pagination-Parameter

#### `hitstart` (Offset)
- **Typ:** Integer
- **Standard:** `0`
- **Beschreibung:** Start-Index der Ergebnisse (0-basiert)
- **Beispiel:** `hitstart=50` → zeige ab Treffer 51

#### `maxhits` (Limit)
- **Typ:** Integer
- **Standard:** `50`
- **Maximum:** 1000 (empfohlen: 50-100)
- **Beschreibung:** Anzahl der Treffer pro Seite

**Beispiel:**
```
hitstart=0&maxhits=50  → Treffer 1-50
hitstart=50&maxhits=50 → Treffer 51-100
```

---

## CQL-Generierung

### Algorithmus

1. **Tokenisierung:** Query nach Whitespace splitten
2. **Pro Token:**
   - Feld auswählen (basierend auf `mode`, `ci`, `da`)
   - Wert escapen (Anführungszeichen, Backslashes, Klammern)
   - POS-Constraint hinzufügen (falls vorhanden)
3. **Sequenz:** Tokens mit Leerzeichen verbinden

### Pseudo-Code

```python
tokens = q.split()
cql_parts = []

for i, token in enumerate(tokens):
    # Feld auswählen
    if mode == "forma_exacta":
        field = "word"
    elif mode == "lemma":
        field = "lemma"
    else:  # forma
        field = "norm" if (ci or da) else "word"
    
    # Escapen
    value = escape_cql(token)
    
    # POS hinzufügen
    constraint = f'{field}="{value}"'
    if pos_tags[i]:
        constraint += f' & pos="{pos_tags[i]}"'
    
    cql_parts.append(f"[{constraint}]")

cql = " ".join(cql_parts)
```

---

## Beispiele

### Beispiel 1: Einfache Suche

**Request:**
```
GET /search/advanced/results?q=méxico&mode=forma&ci=true&da=true
```

**Generierte CQL:**
```cql
[norm="mexico"]
```

**BlackLab-Request:**
```
GET /bls/corapan/hits?patt=[norm="mexico"]&first=0&number=50
```

---

### Beispiel 2: Exakte Suche mit POS

**Request:**
```
GET /search/advanced/results?q=México&mode=forma_exacta&pos=PROPN
```

**Generierte CQL:**
```cql
[word="México" & pos="PROPN"]
```

---

### Beispiel 3: Sequenz mit POS

**Request:**
```
GET /search/advanced/results?q=ir a casa&mode=lemma&pos=VERB,ADP,NOUN
```

**Generierte CQL:**
```cql
[lemma="ir" & pos="VERB"] [lemma="a" & pos="ADP"] [lemma="casa" & pos="NOUN"]
```

---

### Beispiel 4: Mit Metadaten-Filtern

**Request:**
```
GET /search/advanced/results?q=covid&mode=forma&country_code=ARG&date_from=2020-03-01&date_to=2020-03-31
```

**Generierte CQL:**
```cql
[norm="covid"]
```

**Filter:**
```
country_code:"ARG" AND date >= "2020-03-01" AND date <= "2020-03-31"
```

**BlackLab-Request:**
```
GET /bls/corapan/hits?patt=[norm="covid"]&filter=country_code:"ARG" AND date >= "2020-03-01" AND date <= "2020-03-31"&first=0&number=50
```

---

## Escaping-Regeln

### CQL-Escaping

Folgende Zeichen müssen escaped werden:

| Zeichen | Escaped | Beschreibung |
|---------|---------|--------------|
| `\` | `\\` | Backslash |
| `"` | `\"` | Doppelte Anführungszeichen |
| `[` | `\[` | Öffnende eckige Klammer |
| `]` | `\]` | Schließende eckige Klammer |

**Reihenfolge:** Backslash zuerst, dann Anführungszeichen, dann Klammern!

**Beispiel:**
```python
text = 'México "2020"'
escaped = text.replace("\\", "\\\\").replace('"', '\\"')
# Ergebnis: 'México \\"2020\\"'
```

---

## Fehlerbehandlung

### Client-seitig (JavaScript)

| Fehler | HTTP-Status | Message |
|--------|-------------|---------|
| Leere Query | 400 | "Query cannot be empty" |
| Keine Tokens | 400 | "Query contains no valid tokens" |

### Server-seitig (Flask)

| Fehler | HTTP-Status | Message |
|--------|-------------|---------|
| Validierungsfehler | 400 | ValueError-Message |
| BlackLab-Fehler | 502 | "BlackLab server error: {status}" |
| Timeout | 504 | "Search timed out. Please try a more specific query." |
| Unbekannter Fehler | 500 | "An unexpected error occurred. Please try again." |

---

## BlackLab-Parameter (Ausgabe)

### An BlackLab übertragen

| Flask-Parameter | BlackLab-Parameter | Beschreibung |
|-----------------|-------------------|--------------|
| (generierte CQL) | `patt` | CQL-Pattern |
| `hitstart` | `first` | Offset (0-basiert) |
| `maxhits` | `number` | Anzahl Treffer |
| (Filter) | `filter` | Metadaten-Filter |
| (fix) | `wordsaroundhit` | Kontext-Wörter (fix: 10) |
| (fix) | `listvalues` | Metadaten-Felder (fix: `tokid,start_ms,end_ms,sentence_id,utterance_id`) |

### CQL Parameter Name Compatibility (Auto-Detection)

**BlackLab Version Differences:**

Different BlackLab Server versions use different parameter names for CQL patterns:

| BlackLab Version | CQL Parameter | Status | Example |
|------------------|---------------|--------|---------|
| **4.0+** | `patt` | Standard (preferred) | `?patt=[word="test"]` |
| **3.x** | `cql` | Legacy | `?cql=[word="test"]` |
| **Alternative** | `cql_query` | Rare | `?cql_query=[word="test"]` |

**Auto-Detection in CO.RA.PAN (v2.3.1+):**

The backend (`src/app/search/advanced.py`) automatically tries all parameter names in order:

```python
# Lines 84-96
cql_param_names = ["patt", "cql", "cql_query"]
for param_name in cql_param_names:
    try:
        test_params = {**bls_params, param_name: cql_pattern}
        response = client.get(bls_url, params=test_params)
        response.raise_for_status()
        # Success - logs which parameter worked
        current_app.logger.info(f"BlackLab CQL parameter detected: {param_name}")
        break
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 400:
            continue  # Try next parameter name
```

**Manual Verification:**

To check which parameter your BlackLab Server accepts:

```bash
# Test patt (standard)
curl "http://localhost:8081/blacklab-server/corapan/hits?patt=[word=\"test\"]"

# Test cql (legacy)
curl "http://localhost:8081/blacklab-server/corapan/hits?cql=[word=\"test\"]"

# Test cql_query (alternative)
curl "http://localhost:8081/blacklab-server/corapan/hits?cql_query=[word=\"test\"]"
```

**Response:**
- **200 OK:** Parameter accepted ✅
- **400 Bad Request:** Parameter rejected, try next ❌

---

### BlackLab-Response

**Struktur:**
```json
{
  "summary": {
    "numberOfHits": 1487,
    "searchTime": 234
  },
  "hits": [
    {
      "docPid": "ESP_20200315_...",
      "start": 42,
      "end": 43,
      "left": { "word": ["en", "el", "país", "de"] },
      "match": { "word": ["México"], "lemma": ["méxico"], "pos": ["PROPN"] },
      "right": { "word": ["y", "en", "otros"] }
    }
  ]
}
```

---

## Performance-Hinweise

### Optimierung

1. **Spezifische Queries:**
   - ✅ `[lemma="ir"]` → schnell (spezifisch)
   - ❌ `[pos="VERB"]` → langsam (generisch)

2. **Filter nutzen:**
   - Reduziert Dokumente vor Volltextsuche
   - Besonders effektiv: `country_code`, `date_from/to`

3. **Pagination:**
   - Standard `maxhits=50` ist optimal
   - Höhere Werte (>100) können Performance beeinträchtigen

### Timeouts

- **Read-Timeout:** 180s (3 Minuten)
- **Bei Timeout:** Query vereinfachen oder Filter hinzufügen

---

---

## Server-Side Filter Detection

**Indicator:** When filters are applied, CO.RA.PAN checks if `docsRetrieved < numberOfDocs` in BlackLab's response summary.

**Implementation (advanced.py lines 115-120):**
```python
server_filtered = False
if filter_query:
    docs_retrieved = summary.get("docsRetrieved", 0)
    number_of_docs = summary.get("numberOfDocs", 0)
    server_filtered = docs_retrieved < number_of_docs
```

**UI Indicator:** Badge **"filtrado activo"** appears in results summary when `server_filtered == True`.

**Visual Example:**
```html
<div class="md3-search-summary" aria-live="polite">
  <span>Mostrando 1-20 de 1487 concordancias</span>
  <span class="md3-badge md3-badge--info" role="status">
    filtrado activo
  </span>
</div>
```

**Example Response:**
```json
{
  "summary": {
    "numberOfHits": 1487,
    "numberOfDocs": 146,
    "docsRetrieved": 42
  }
}
```

**Interpretation:**
- **Totale Dokumente im Korpus:** 146
- **Nach Filter:** 42 Dokumente
- **Hits in gefilterten Dokumenten:** 1487

**Nutzen:**
- Transparenz für User: Sichtbar, dass Filter aktiv ist
- Debugging: Verify filter applied (check `docsRetrieved` vs `numberOfDocs`)

**Test:**
```bash
# Ohne Filter
curl -s 'http://localhost:8000/bls/corapan/hits?patt=[word="test"]&maxhits=1' \
  | jq '.summary | {docsRetrieved, numberOfDocs}'
# Output: {"docsRetrieved": 146, "numberOfDocs": 146}

# Mit Filter
curl -s 'http://localhost:8000/bls/corapan/hits?filter=country:"ARG"&patt=[word="test"]&maxhits=1' \
  | jq '.summary | {docsRetrieved, numberOfDocs}'
# Output: {"docsRetrieved": 42, "numberOfDocs": 146}
```

**Siehe auch:** [Live Testing Guide](../how-to/advanced-search.md#live-testing-production)

---

## Siehe auch

- [Advanced Search Usage Guide](../how-to/advanced-search.md) - User guide with Flask-Proxy tests
- [Search Architecture Concept](../concepts/search-architecture.md) - Flask-Proxy architecture diagram
- [BlackLab API Proxy Reference](api-blacklab-proxy.md) - Proxy implementation details
- [BlackLab Issues Troubleshooting](../troubleshooting/blacklab-issues.md) - Common problems
- [BlackLab CQL Documentation](https://inl.github.io/BlackLab/guide/corpus-query-language.html) - External CQL reference
