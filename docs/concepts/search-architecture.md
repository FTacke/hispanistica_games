---
title: "Search Architecture Concept"
status: active
owner: backend-team
updated: "2025-11-10"
tags: [architecture, search, blacklab, cql, flask-proxy]
links:
  - ../how-to/advanced-search.md
  - ../reference/search-params.md
  - ../operations/development-setup.md
---

# Search Architecture Concept

Architektur der erweiterten Korpussuche mit BlackLab-Integration.

---

## Problem

**Anforderung:** Komplexe linguistische Korpussuche mit:
- Wortsequenzen
- POS-Tag-Filterung
- Lemma-basierte Suche
- Metadaten-Filter (Land, Datum, Sprecher)
- Performant bei 146 Transkripten (1,5M Tokens)

**Limitierung der einfachen Suche:**
- Nur Einzelwort-Suche
- Keine Sequenzen
- Keine POS-Filterung
- SQLite-basiert (nicht optimiert für linguistische Queries)

---

## Kontext

**Bestehende Infrastruktur:**
- Flask MPA (Multi-Page Application)
- BlackLab Server läuft auf Port 8081 (lokal)
- Index gebaut unter `data/blacklab_index/` (TSV-Format)
- 146 Transkripte, 1,487,120 Tokens

**Technologien:**
- **BlackLab Server:** Corpus Query Engine (Lucene-basiert)
- **CQL:** Corpus Query Language (Standardsprache für Korpussuchen)
- **htmx:** Fragmentbasierte Ergebnis-Updates (kein Full-Page-Reload)

---

## Lösung / Konzept

### 3-Schichten-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Presentation Layer (Frontend)                            │
│    - templates/search/advanced.html (MD3 Form)              │
│    - templates/search/_results.html (KWIC Fragment)         │
│    - static/js/modules/search/cql-utils.js (Validation)    │
└──────────────────────────┬──────────────────────────────────┘
                           │ htmx GET /search/advanced/results
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Application Layer (Flask)                                │
│    - src/app/search/advanced.py (Blueprint)                 │
│    - src/app/search/cql.py (CQL Builder)                    │
│         → build_cql(params) → CQL String                    │
│         → build_filters(params) → Filter Dict               │
└──────────────────────────┬──────────────────────────────────┘
                           │ httpx GET /bls/corapan/hits
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Proxy Layer (Flask → BlackLab)                           │
│    - src/app/routes/bls_proxy.py (HTTP Proxy)              │
│         → Forward /bls/** → localhost:8081                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP GET :8081/blacklab-server/...
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Data Layer (BlackLab Server)                             │
│    - Java-basiert, läuft auf :8081                          │
│    - Index: data/blacklab_index/ (Lucene)                   │
│    - Corpus: "corapan"                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Komponenten

### 1. Frontend (Presentation)

#### `templates/search/advanced.html`
**Verantwortung:** Formular + Ergebniscontainer

**Features:**
- MD3-konforme Textfelder (outlined, gefüllt)
- Switches für ci/da (case/diacritics)
- Metadaten-Filter (Land, Radio, Sprecher, Datum)
- htmx-Attribute:
  - `hx-get="/search/advanced/results"` - Endpoint
  - `hx-target="#adv-results"` - Ziel-Container
  - `hx-indicator="#search-progress"` - Fortschrittsbalken
  - `hx-push-url="true"` - URL-Update (Browser-History)

**Wichtig:** Kein `hx-boost` (explizite htmx-Trigger nur für Results).

#### `templates/search/_results.html`
**Verantwortung:** KWIC-Rendering + Pagination

**Struktur:**
```html
<div class="md3-search-results">
  <!-- Summary -->
  <p>1,487 resultados encontrados</p>
  
  <!-- KWIC List -->
  <div class="md3-kwic-item">
    <div class="md3-kwic-context">
      <span class="md3-kwic-left">en el país de</span>
      <mark class="md3-kwic-hit">México</mark>
      <span class="md3-kwic-right">y en otros</span>
    </div>
    <div class="md3-kwic-meta">...</div>
    <a href="/player?...#t=42.5">Abrir en Player</a>
  </div>
  
  <!-- Pagination -->
  <nav class="md3-pagination">...</nav>
</div>
```

**Escaping:** Alle Texte via Jinja2 `{{ text }}` (automatisch escaped).

---

### 2. Backend (Application Layer)

#### `src/app/search/advanced.py`
**Verantwortung:** Flask-Blueprint mit 2 Endpoints

**Endpoints:**

1. **`GET /search/advanced`**
   - Rendert Formular-Seite
   - Keine Logik, nur Template-Rendering

2. **`GET /search/advanced/results`**
   - Nimmt Query-Parameter entgegen
   - Ruft `build_cql()` + `build_filters()` auf
   - Macht httpx-Request zu `/bls/corapan/hits`
   - Verarbeitet BlackLab-Response
   - Rendert `_results.html`-Fragment

**Error-Handling:**
- `ValueError` → 400 (Validierung)
- `httpx.HTTPStatusError` → 502 (BlackLab-Fehler)
- `httpx.TimeoutException` → 504 (Timeout)
- `Exception` → 500 (Unbekannter Fehler)

#### `src/app/search/cql.py`
**Verantwortung:** CQL-Generierung + Filter-Bau

**Funktionen:**

1. **`escape_cql(text: str) -> str`**
   - Escaped: `\`, `"`, `[`, `]`
   - Reihenfolge wichtig: Backslash zuerst!

2. **`tokenize_query(query: str) -> List[str]`**
   - Splittet nach Whitespace
   - Filtert leere Tokens

3. **`build_token_cql(token, mode, ci, da, pos) -> str`**
   - Wählt Feld (`word`, `norm`, `lemma`)
   - Fügt POS-Constraint hinzu
   - Escaped Wert
   - Gibt `[field="value" & pos="TAG"]` zurück

4. **`build_cql(params: Dict) -> str`**
   - Tokenisiert Query
   - Baut CQL pro Token
   - Verbindet mit Leerzeichen (Sequenz)
   - Raises `ValueError` bei leerer Query

5. **`build_filters(params: Dict) -> Dict`**
   - Extrahiert Metadaten-Filter
   - Gibt strukturiertes Dict zurück

6. **`filters_to_blacklab_query(filters: Dict) -> str`**
   - Konvertiert Dict zu BlackLab-Filter-String
   - Format: `field:"value" AND field2:"value2"`

---

### 3. Proxy Layer

#### `src/app/routes/bls_proxy.py`
**Verantwortung:** HTTP-Proxy zu BlackLab Server

**Konfiguration:**
- Ziel: `http://localhost:8081`
- Prefix: `/bls/**` → `/blacklab-server/**`
- Timeout: 180s read, 30s connect

**Wichtig:**
- Keine CORS-Header (same-origin)
- Keine Hop-by-Hop-Header duplizieren
- Streaming für große Responses

**Details:** Siehe [BlackLab API Proxy Reference](../reference/api-blacklab-proxy.md)

---

### 4. Data Layer

#### BlackLab Server
**Verantwortung:** Indexierung + Query-Execution

**Index-Format:**
- TSV-only (kein WPL)
- Felder: `word`, `norm`, `lemma`, `pos`, `tokid`, `start_ms`, `end_ms`
- Annotierte Felder: `word`, `norm`, `lemma`, `pos` (via `.blf.yaml`)

**Query-Endpoint:**
```
GET /blacklab-server/corapan/hits?patt=[norm="mexico"]&first=0&number=50
```

**Response:**
```json
{
  "summary": {"numberOfHits": 1487},
  "hits": [
    {
      "docPid": "ESP_...",
      "left": {"word": [...]},
      "match": {"word": [...], "lemma": [...], "pos": [...]},
      "right": {"word": [...]}
    }
  ]
}
```

---

## Datenfluss (Query Execution)

### Schritt 1: User-Eingabe

**Formular:**
- q: `ir a`
- mode: `lemma`
- pos: `VERB,ADP`
- country_code: `ARG`

### Schritt 2: CQL-Generierung (Flask)

**Python:**
```python
cql = build_cql({
    "q": "ir a",
    "mode": "lemma",
    "pos": "VERB,ADP"
})
# cql = '[lemma="ir" & pos="VERB"] [lemma="a" & pos="ADP"]'

filters = build_filters({"country_code": "ARG"})
# filters = {"country_code": "ARG"}

filter_str = filters_to_blacklab_query(filters)
# filter_str = 'country_code:"ARG"'
```

### Schritt 3: BlackLab-Request (via Proxy)

**HTTP:**
```
GET /bls/corapan/hits?patt=[lemma="ir"%20&%20pos="VERB"]%20[lemma="a"%20&%20pos="ADP"]&filter=country_code:"ARG"&first=0&number=50
```

**Proxy forwarded zu:**
```
GET http://localhost:8081/blacklab-server/corapan/hits?...
```

### Schritt 4: BlackLab-Response

**JSON:**
```json
{
  "summary": {"numberOfHits": 42},
  "hits": [
    {
      "docPid": "ARG_20200315_LRA1_...",
      "match": {"word": ["voy", "a"], "lemma": ["ir", "a"], "pos": ["VERB", "ADP"]},
      "left": {"word": ["yo"]},
      "right": {"word": ["casa"]}
    }
  ]
}
```

### Schritt 5: KWIC-Rendering (Flask)

**Template-Variablen:**
```python
{
  "hits": [
    {
      "left": "yo",
      "match": "voy a",
      "right": "casa",
      "lemma": "ir a",
      "pos": "VERB ADP",
      "start_ms": 12345
    }
  ],
  "total": 42
}
```

**HTML:**
```html
<div class="md3-kwic-item">
  <span class="md3-kwic-left">yo</span>
  <mark class="md3-kwic-hit">voy a</mark>
  <span class="md3-kwic-right">casa</span>
</div>
```

---

## Entscheidungen

### Warum Proxy statt direkter Zugriff?

**Vorteile:**
1. **Same-Origin:** Keine CORS-Probleme
2. **Sicherheit:** BlackLab nicht direkt exponiert
3. **Flexibilität:** Zentraler Punkt für Logging/Caching
4. **Konsistenz:** Alle Requests über Flask

**Nachteil:** Zusätzlicher Hop (minimale Latenz)

### Warum CQL-Builder in Python?

**Alternativen:**
- **Client-seitig (JavaScript):** Sicherheitsrisiko (User kann CQL manipulieren)
- **Direkt an BlackLab:** Keine Validierung, keine Filter-Logik

**Vorteile Python:**
- **Validierung:** Serverseitig, sicher
- **Escaping:** Zentral gehandhabt
- **Testbar:** Unit-Tests für CQL-Generierung
- **Filter-Logik:** Kombination von CQL + Metadaten-Filtern

### Warum TSV-only?

**Kontext:** WPL (XML-basiert) vs. TSV (tabellarisch)

**Entscheidung:** TSV-only

**Gründe:**
- **Einfacher Export:** Keine XML-Escaping-Komplexität
- **Performanter:** Weniger Overhead als XML
- **Ausreichend:** Alle benötigten Felder vorhanden (word, norm, lemma, pos)

**Trade-off:** Keine hierarchischen Strukturen (Sätze, Absätze) im Index.

---

## Performance-Überlegungen

### Indexgröße

- **Tokens:** 1,487,120
- **Dokumente:** 146
- **Index-Size:** ~50MB (Lucene komprimiert)

### Query-Performance

| Query-Typ | Geschwindigkeit | Grund |
|-----------|-----------------|-------|
| Einzelwort (`[norm="mexico"]`) | **Schnell** (< 1s) | Direkter Lucene-Lookup |
| Sequenz (`[lemma="ir"] [lemma="a"]`) | **Schnell** (< 2s) | Zwei Lookups + Positionscheck |
| Generisch (`[pos="VERB"]`) | **Langsam** (> 10s) | Millionen Treffer, alle Verben |
| Mit Filter (`country_code:"ARG"`) | **Mittel** (< 5s) | Dokumente zuerst gefiltert |

**Empfehlung:** Immer spezifische Queries + Filter bevorzugen.

### Caching

**Aktuell:** Kein Caching (alle Requests live)

**Mögliche Optimierung:**
- Flask-Caching für häufige Queries
- BlackLab-Response-Cache (TTL: 1h)

**Trade-off:** Stale-Data bei Index-Updates.

---

## Sicherheit

### Input-Validierung

1. **Query:** Darf nicht leer sein, max. 1000 Zeichen
2. **POS-Tags:** Whitelist (nur valide UD-Tags)
3. **Metadaten-Filter:** Format-Validierung (ISO-Datum, 3-stelliger Ländercode)

### Escaping

- **CQL:** Alle Sonderzeichen escaped (siehe `escape_cql()`)
- **HTML:** Jinja2 Auto-Escaping aktiv
- **SQL:** Nicht relevant (kein direkter DB-Zugriff in Advanced Search)

### Rate-Limiting

**Aktuell:** Keine speziellen Limits für `/search/advanced`

**Empfehlung:** Flask-Limiter hinzufügen:
```python
@limiter.limit("30 per minute")
def results():
    ...
```

---

## Bekannte Einschränkungen

### 1. Filter-Unterstützung

**Problem:** BlackLab `filter`-Parameter funktioniert nur, wenn Index Metadaten enthält.

**Status (TSV-Index):** Metadaten **nicht** im Index (nur in `docmeta.jsonl`).

**Aktuell:** Filter werden via `filter`-Parameter übertragen, aber:
- Wenn BLS keine Metadaten hat → Filter wird ignoriert
- **Fallback:** Client-seitige Postfilterung (nicht implementiert in v1)

**Lösung langfristig:** WPL-Index mit eingebetteten Metadaten.

### 2. Highlighting-Grenzen

**Problem:** Kontext-Wörter (left/right) sind fix (`wordsaroundhit=10`).

**Effekt:** Manchmal werden Sätze abgeschnitten.

**Alternative:** `wordsaroundhit=-1` (ganzer Satz), aber Performance-Impact.

### 3. Keine Fuzzy-Suche

**Aktuell:** Nur exakte Matches (nach ci/da-Normalisierung).

**Feature-Request:** Levenshtein-Distanz, Wildcard-Matching (`M*xico`).

**BlackLab-Unterstützung:** Möglich via `.*` Regex, aber langsam.

---

## Erweiterungsmöglichkeiten

### 1. Erweiterte CQL-Features

**Aktuell:** Nur Sequenzen + POS

**Möglich:**
- **Wildcards:** `[word="M.*"]` (Regex)
- **Optional:** `[pos="ADJ"]? [pos="NOUN"]` (ADJ optional)
- **Wiederholung:** `[pos="ADJ"]{1,3}` (1-3 Adjektive)
- **Negation:** `[pos!="VERB"]` (alles außer Verben)

**Implementation:** Erweitere `build_cql()` mit zusätzlichen Parametern.

### 2. Export-Funktion

**Feature:** Ergebnisse als CSV/JSON exportieren

**Endpoint:** `GET /search/advanced/export?format=csv`

**Daten:**
- KWIC-Triples (left, match, right)
- Metadaten (doc_pid, timestamp, lemma, pos)

### 3. Visualisierung

**Feature:** Frequenz-Charts, Kollokationen

**Tools:** D3.js, Chart.js

**Daten:** Aggregierte BlackLab-Stats (`/corpus/{corpus}/termfreq`)

### 4. Gespeicherte Queries

**Feature:** User kann Queries speichern + teilen

**Storage:** User-DB (neue Tabelle `saved_queries`)

**URL:** `/search/advanced?qid=42` (lädt Query aus DB)

---

---

## Deployment Notes

### Flask-Proxy Architecture (No Docker/Nginx)

**Development:**
- Flask dev server (Werkzeug) with hot-reload
- `/bls/**` → `localhost:8081` (HTTP proxy)

**Production:**
- Gunicorn/Waitress WSGI server (stable process management)
- Same `/bls/**` proxy (no Nginx reverse proxy needed)
- Configuration: `--timeout 180 --keep-alive 5` (matches httpx timeouts)

**Known Limitation (Dev Only):**
- Hot-reload can drop connections to mock BLS (Werkzeug child process management)
- Non-blocking: retry request or use direct tests (`python scripts/test_mock_bls_direct.py`)
- Production: Gunicorn/Waitress have stable connections (no hot-reload)

---

## Siehe auch

- [Advanced Search Usage Guide](../how-to/advanced-search.md) - Flask-Proxy usage with live tests
- [Search Parameters Reference](../reference/search-params.md) - CQL parameter compatibility table
- [Development Setup](../operations/development-setup.md) - WSGI deployment (Gunicorn)
- [BlackLab Proxy API Reference](../reference/api-blacklab-proxy.md) - Proxy implementation details
- [BlackLab Architecture](https://inl.github.io/BlackLab/guide/how-blacklab-works.html) - External reference
