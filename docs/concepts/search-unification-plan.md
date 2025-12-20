# Search Unification Plan

**Datum:** 2025-11-13  
**Status:** Phase 1 abgeschlossen, BlackLab-Dev-Setup finalisiert  
**Ziel:** Schrittweise Vereinheitlichung von Simple- und Advanced-Search

---

## Aktueller Status (November 2025)

### ✅ Phase 1: Advanced Search Stabilisierung - ABGESCHLOSSEN

- **BlackLab-Docker-Setup:** Funktionsfähig mit korrektem Image und Konfiguration
- **Flask ↔ BlackLab Verbindung:** Etabliert und getestet
- **Fehlerbehandlung:** `upstream_unavailable` vs. `upstream_error` korrekt unterschieden
- **Dokumentation:** Vollständig in `docs/how-to/advanced-search-dev-setup.md`

⚠️ **Bekanntes Problem:** Index-Migration von Lucene 8 → 9 erforderlich.  
Siehe: `docs/troubleshooting/blacklab-index-lucene-migration.md`

---

## Überblick

CO.RA.PAN bietet zwei Suchsysteme:

### Simple Search (Corpus)

- **Datenbasis:** SQLite-Datenbank (`data/db/corpus.db`)
- **Technologie:** Direkter SQL-Zugriff über `src/app/services/corpus_search.py`
- **Response-Format:** Objekte mit `CANON_COLS` Keys
- **Stärken:** 
  - Schnell für einfache Token-Suchen
  - Keine externe Abhängigkeit
  - Vollständige Metadaten in DB
- **Einschränkungen:**
  - Keine linguistischen Annotationen (POS, Lemma nur begrenzt)
  - Keine komplexen CQL-Queries

### Advanced Search (BlackLab)

- **Datenbasis:** BlackLab-Index (`data/blacklab_index/`)
- **Technologie:** BlackLab Server via HTTP-Proxy (Flask → BlackLab)
- **Response-Format:** Objekte mit Keys (seit Phase 1)
- **Stärken:**
  - CQL-Support für komplexe linguistische Queries
  - POS-Tags, Lemma-Zugriff, morphologische Annotationen
  - Leistungsstarke Konkordanz-Engine
- **Einschränkungen:**
  - Externe Abhängigkeit (BlackLab Server muss laufen)
  - Setup komplexer

### Referenzen

Vollständige Bestandsaufnahme siehe:

- `docs/ADVANCED SEARCH/BESTANDSAUFNAHME_SIMPLE_VS_ADVANCED.md` – Gesamtüberblick
- `docs/ADVANCED SEARCH/BESTANDSAUFNAHME_SIMPLE_SEARCH.md` – Simple Search Details
- `docs/ADVANCED SEARCH/BESTANDSAUFNAHME_ADVANCED_SEARCH.md` – Advanced Search Details
- `docs/ADVANCED SEARCH/BESTANDSAUFNAHME_DATATABLES_VERGLEICH.md` – Frontend-Konfiguration
- `docs/ADVANCED SEARCH/BESTANDSAUFNAHME_GEMEINSAME_BASIS.md` – Mapping-Potenzial
- `docs/ADVANCED SEARCH/BESTANDSAUFNAHME_OFFENE_PUNKTE.md` – Stolpersteine

---

## Drei-Phasen-Plan

### Phase 1: Stabile BlackLab-Anbindung ✅ (Abgeschlossen)

**Ziel:** Advanced Search funktioniert zuverlässig mit echtem BlackLab-Index.

**Umgesetzt:**

1. **BlackLab-Konfiguration:**
   - `BLS_BASE_URL` aus Environment-Variable (`passwords.env` oder Laufzeit)
   - Default: `http://localhost:8081/blacklab-server`
   - Zentrale HTTP-Client-Konfiguration in `src/app/extensions/http_client.py`
   - Flask-basierte Proxy-Lösung (Browser → Flask → BlackLab)

2. **Advanced API Fixes:**
   - **Response-Format:** Wechsel von Arrays zu Objekten mit Keys
   - Backend sendet jetzt: `[{left: "...", match: "...", ...}, ...]`
   - Frontend erwartet Keys (`data: 'left'`, `data: 'match'`, etc.)
   - Konsistenz zwischen `/search/advanced/data` (DataTables) und `/search/advanced/export` (CSV/TSV)

3. **Fehlerbehandlung:**
   - `upstream_unavailable` bei BlackLab-Ausfall (ConnectError)
   - `upstream_timeout` bei Timeout
   - `invalid_cql` bei CQL-Syntaxfehlern
   - MD3-Error-Banner im Frontend
   - Sauberes Logging (keine Stacktrace-Spam)

4. **Frontend:**
   - DataTables-Konfiguration nutzt Objekt-Keys
   - Audio-Player nutzt `start_ms`/`end_ms` für Segment-URL
   - Fehler-Banner bei Backend-Errors (JSON `error`-Feld)

**Akzeptanzkriterien (erfüllt):**

- ✅ BlackLab läuft → Advanced Search zeigt Treffer, kein Error-Banner
- ✅ BlackLab gestoppt → JSON mit `error`, MD3-Banner, kein JS-Fehler
- ✅ DataTables rendert stabil (keine Array-Index-Fehler)

**Nicht umgesetzt (bewusst verschoben):**

- Unified Mapping (`serialize_hit_to_row()`) → Phase 2
- UI-Vereinheitlichung → Phase 3

---

### Phase 2: Unified Mapping (Geplant)

**Ziel:** Beide Endpoints liefern identische Datenstrukturen basierend auf `CANON_COLS`.

**Vorgehen:**

1. **Zentrale Mapping-Funktion erstellen:**
   
   Ort: `src/app/services/corpus_search.py` (nach L473, nach `_row_to_dict()`)

   ```python
   def serialize_hit_to_row(
       hit: dict | sqlite3.Row,
       source: Literal['db', 'blacklab'] = 'db',
       row_number: int | None = None
   ) -> dict[str, object]:
       """
       Unified Hit → Row Mapping für Simple (DB) und Advanced (BlackLab).
       
       Garantiert:
       - Identische Keys aus CANON_COLS für beide Quellen
       - Zeit in Sekunden (konvertiert von MS wenn nötig)
       - Helper-Felder (audio_available, word_count)
       
       Args:
           hit: Hit-Objekt (sqlite3.Row oder BlackLab-JSON-Dict)
           source: 'db' für Simple (SQLite), 'blacklab' für Advanced
           row_number: Optional Zeilennummer
       
       Returns:
           Dict mit CANON_COLS Keys + Helper-Felder
       """
       if source == 'db':
           # Simple: Nutze vorhandene _row_to_dict()
           result = _row_to_dict(hit)
           if row_number is not None:
               result['row_number'] = row_number
           return result
       
       elif source == 'blacklab':
           # Advanced: BlackLab JSON → CANON_COLS
           # (Details siehe BESTANDSAUFNAHME_GEMEINSAME_BASIS.md)
           ...
   ```

2. **Advanced API refactoren:**
   
   - `advanced_api.py` L240-291: Nutze `serialize_hit_to_row(hit, source='blacklab')`
   - `advanced_api.py` L586-612: Nutze im Export (DRY)

3. **Vorteile:**
   
   - DRY: Mapping-Logik nur an einer Stelle
   - Wartbarkeit: Änderungen an CANON_COLS zentral
   - Konsistenz: Beide Systeme liefern identische Keys
   - Testbarkeit: Mapping separat unit-testbar

**Offene Punkte (vor Umsetzung klären):**

- **BlackLab-Metadaten komplett?**
  - `date` vorhanden? (Simple hat es, BlackLab?)
  - `radio` vorhanden? (in Config, aber im Index?)
  - `context_start`/`context_end` verfügbar? (oder schätzen?)

- **Zeit-Konvertierung:**
  - Simple: Sekunden (REAL, z.B. 42.5)
  - Advanced: Millisekunden (INTEGER, z.B. 42500)
  - Unified: Sekunden (konvertiere Advanced: `start_ms / 1000.0`)

- **Normalisierung:**
  - Simple `sensitive=0`: `norm`-Spalte (lowercase, no accents)
  - Advanced `case_sensitive=0`: CQL `(?i)` Flag
  - Verhalten bei Akzenten identisch? (Test: "año" vs. "ano")

**Checkliste Phase 2:**

- [ ] `serialize_hit_to_row()` in `corpus_search.py` implementieren
- [ ] Unit-Tests (DB-Mock + BlackLab-JSON-Fixtures)
- [ ] Advanced API: `/data` Endpoint umstellen
- [ ] Advanced API: `/export` Endpoint umstellen
- [ ] Integration testen: Simple + Advanced identische Keys
- [ ] Export: CSV/TSV mit konsistenten Headers
- [ ] Dokumentation: `docs/reference/corpus-api-canonical-columns.md` aktualisieren

---

### Phase 3: UI-Vereinheitlichung (Optional, später)

**Ziel:** Ein gemeinsames UI für beide Suchsysteme.

**Ideen:**

1. **Basis-Suche + Erweitert-Toggle:**
   - Einfache Token-Suche → nutzt Simple (schnell)
   - "Erweitert"-Sektion → CQL-Editor, POS-Filter → nutzt Advanced
   - Automatische Fallback-Logik

2. **Zusätzliche Spalten (nur Advanced):**
   - `lemma` (Simple hat es in DB, Advanced in BlackLab)
   - `pos` (nur Advanced, nicht in Simple-DB)
   - UI: Spalten ein-/ausblendbar

3. **Export-Vereinheitlichung:**
   - Beide nutzen gleiche CSV-Headers
   - Export-Button zeigt verfügbare Felder dynamisch

**Nicht zwingend:**

- Simple und Advanced können auch als separate UIs koexistieren
- Wichtig: Backend-Konsistenz (Phase 2), UI optional

---

## Aktuelle Implementierung (Phase 1)

### BlackLab-Konfiguration

**Environment-Variable:**

```bash
# In passwords.env oder zur Laufzeit:
BLS_BASE_URL=http://localhost:8081/blacklab-server
```

**Defaults:**

- Development (empfohlen): `http://localhost:8081/blacklab-server` (Docker-BlackLab auf Port 8081)
- Alternative (manuell): `http://localhost:8080/blacklab-server` (bei Bedarf)

**Standard-Dev-Workflow:**

Für lokale Entwicklung mit echten Suchergebnissen:

```powershell
# Terminal 1: BlackLab starten (Docker, Port 8081)
.\scripts\blacklab\start_blacklab_docker_v3.ps1

# Terminal 2: Flask starten (nutzt Default-BLS_BASE_URL)
.venv\Scripts\activate
$env:FLASK_ENV="development"
python -m src.app.main
```

**Hintergrund:**
- Flask läuft lokal (Python-Prozess)
- BlackLab läuft in Docker-Container, erreichbar auf Host-Port 8081
- Default `BLS_BASE_URL` passt direkt → keine Env-Var-Konfiguration nötig
- Siehe: `docs/how-to/advanced-search-dev-setup.md` für Details

### Response-Format (Advanced API)

**`/search/advanced/data` (DataTables):**

```json
{
  "draw": 1,
  "recordsTotal": 342,
  "recordsFiltered": 342,
  "data": [
    {
      "left": "en la",
      "match": "casa",
      "right": "de mis padres",
      "country": "ARG",
      "speaker_type": "pro",
      "sex": "m",
      "mode": "pre",
      "discourse": "general",
      "filename": "ARG_pro_m_pre_general_001.mp3",
      "radio": "Radio 10",
      "tokid": "ARG_..._00123",
      "start_ms": 42500,
      "end_ms": 43200
    }
  ]
}
```

**Bei Fehler (BlackLab down):**

```json
{
  "draw": 1,
  "recordsTotal": 0,
  "recordsFiltered": 0,
  "data": [],
  "error": "upstream_unavailable",
  "message": "Search backend (BlackLab) is currently not reachable..."
}
```

### Frontend-Handling

**DataTables-Konfiguration:**

- `columnDefs` nutzt Keys: `data: 'left'`, `data: 'match'`, etc.
- `dataSrc`-Callback prüft `json.error` → zeigt MD3-Banner
- Audio-Player rendert `<audio>`-Tag mit `/media/segment/{filename}/{start_ms}/{end_ms}`

**Fehler-Banner:**

- `handleBackendError(json)` zeigt MD3-Error-Alert
- User-freundliche Meldungen (keine technischen Details)
- Banner verschwindet bei erfolgreicher Suche

---

## Test-Szenarien

### Manueller Test 1: BlackLab läuft

**Setup:**

1. Starte BlackLab: `.\scripts\blacklab\start_blacklab_docker_v3.ps1` (Docker, Port 8081)
2. Starte Flask: `python -m src.app.main`

**Schritte:**

1. Browser → `http://localhost:8000/search/advanced`
2. Suche nach Token: `casa` (Mode: "Forma exacta")
3. Submit

**Erwartung:**

- Keine Fehler in Flask-Logs
- Keine `ConnectError`
- DataTables zeigt Trefferzeilen
- Kein Error-Banner
- Audio-Player (falls Datei vorhanden)

---

### Manueller Test 2: BlackLab gestoppt

**Setup:**

1. Stoppe BlackLab: `.\scripts\stop_blacklab_docker.ps1`
2. Flask läuft weiter

**Schritte:**

1. Browser → `http://localhost:8000/search/advanced`
2. Suche nach `casa`
3. Submit

**Erwartung:**

- Flask-Log: **Ein** `WARNING`-Log pro Request
  ```
  BLS connection failed (server not reachable at http://localhost:8081/blacklab-server)
  ```
- **Kein** Stacktrace-Spam
- JSON-Response: `"error": "upstream_unavailable"`
- Browser: MD3-Error-Banner
- DataTables: Leer, aber **kein** JS-Error in Konsole

---

### Manueller Test 3: CQL-Fehler

**Setup:**

1. BlackLab läuft
2. Flask läuft

**Schritte:**

1. Advanced Search → Mode: "CQL (experto)"
2. Query: `[word="invalid` (fehlende Klammer)
3. Submit

**Erwartung:**

- JSON-Response: `"error": "invalid_cql"`
- Browser: MD3-Banner mit CQL-Fehlermeldung
- DataTables: Leer

---

## Nächste Schritte

1. **Phase 1 validieren:**
   - Manuelle Tests durchführen (siehe oben)
   - Falls Probleme: Logs prüfen, ggf. `BLS_BASE_URL` anpassen

2. **Phase 2 vorbereiten:**
   - BlackLab-Index prüfen: Welche Metadaten sind vorhanden?
     - `data/blacklab_index/index.json` öffnen
     - `config/blacklab/*.blf.yaml` überprüfen
   - Offene Punkte klären (siehe oben)

3. **Phase 2 umsetzen:**
   - `serialize_hit_to_row()` implementieren
   - Unit-Tests schreiben
   - Advanced API refactoren
   - Integration testen

4. **Phase 3 evaluieren:**
   - User-Feedback zu separaten UIs einholen
   - UI-Vereinheitlichung nur wenn sinnvoll

---

## Technische Referenzen

### Dateien (Backend)

- `src/app/extensions/http_client.py` – HTTP-Client + BLS_BASE_URL
- `src/app/search/advanced_api.py` – Advanced-Search Endpoints
- `src/app/search/cql.py` – CQL-Builder
- `src/app/services/corpus_search.py` – Simple-Search + CANON_COLS

### Dateien (Frontend)

- `static/js/modules/advanced/initTable.js` – DataTables-Init
- `static/js/modules/advanced/formHandler.js` – Form-Submission
- `templates/search/advanced.html` – Template

### Konfiguration

- `passwords.env` – Secrets + BLS_BASE_URL (optional)
- `config/blacklab/*.blf.yaml` – BlackLab-Index-Config

### Dokumentation

- `docs/ADVANCED SEARCH/` – Vollständige Bestandsaufnahme (6 Dateien)
- `docs/concepts/search-unification-plan.md` – Dieses Dokument

---

## Zusammenfassung

**Phase 1 (✅):** Advanced Search nutzt stabilen BlackLab-Server, liefert Objekte mit Keys, Frontend zeigt Treffer korrekt.

**Phase 2 (📋):** Unified Mapping via `serialize_hit_to_row()` für beide Endpoints, zentrale CANON_COLS-Logik.

**Phase 3 (💡):** Optional UI-Vereinheitlichung, wenn fachlich sinnvoll.

**Ziel:** Wartbarer, skalierbarer Code mit klarer Trennung zwischen Simple (schnell) und Advanced (mächtig), aber identischer Datenstruktur für beide.
