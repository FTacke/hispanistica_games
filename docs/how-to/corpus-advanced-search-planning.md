---
title: "Corpus Advanced Search Implementation"
status: archived
owner: backend-team
updated: "2025-11-26"
tags: [corpus, advanced-search, implementation, planning, archived]
links:
  - ../reference/corpus-search-architecture.md
  - ../decisions/ADR-0001-docs-reorganization.md
  - ../how-to/token-input-usage.md
---

# Corpus Advanced Search Implementation

> **⚠️ ARCHIVED**: This document describes the original SQLite-based planning approach.
> The implementation has since migrated to **BlackLab-based search**. References to
> `transcription.db` are historical only. The current search architecture uses
> BlackLab indexes under `data/blacklab_index/`. See `docs/reference/` for updated docs.

Detaillierter Planungs- und Implementierungs-Guide für die erweiterte Suchfunktion im CO.RA.PAN Corpus.

---

## Ziel

Diese Anleitung ermöglicht es, die **erweiterte Suche** (Advanced Search) zu planen, zu implementieren und zu testen, ohne die bestehenden **einfachen Suche** und **Token-Suche** zu beeinflussen.

---

## Voraussetzungen

### Erforderliches Wissen
- SQL-Syntax (besonders JOINs, WHERE-Clauses, ORDER BY)
- Python (Flask, dataclasses)
- JavaScript (ES6 Modules, jQuery, DOM-Manipulation)
- DataTables API
- Reguläre Ausdrücke (optional, für Regex-Support)

### Benötigte Tools
- VS Code mit Python/JavaScript-Extensions
- SQLite3 CLI (`sqlite3` Befehl)
- Python 3.11+
- Node.js 18+ (für Frontend-Build, falls erforderlich)

### Systemzustand
- CO.RA.PAN-Web aktiv und lokal laufend
- `data/db/transcription.db` mit Tokens-Tabelle gefüllt
- `src/app/routes/corpus.py` und `src/app/services/corpus_search.py` accessible

---

## Schritte

### Schritt 1: Anforderungen sammeln

**Ziel:** Definiere, welche Suchfunktionen die erweiterte Suche unterstützen soll.

**Aktivitäten:**

1. **Stakeholder-Input einholen**
   - Welche Recherche-Szenarien sind für Linguisten wichtig?
   - Beispiele:
     - "Alle Wort-Sequenzen: [Adjektiv] [Artikel] [Nomen]"
     - "Alle Wörter, die mit 'ar' beginnen und auf 'o' enden"
     - "Häufigste Wörter in Diskurs 'tiempo'"

2. **Feature-Priorisierung**
   | Priorität | Feature | Komplexität | Nutzen |
   |-----------|---------|------------|--------|
   | P0 | Multi-Word Sequenzen | Mittel | Hoch |
   | P1 | Wildcards | Niedrig | Mittel |
   | P2 | Regular Expressions | Hoch | Niedrig |
   | P3 | POS-Filter | Hoch | Mittel |

3. **DB-Schema-Audit**
   ```bash
   # Prüfe, welche Spalten bereits vorhanden sind
   sqlite3 data/db/transcription.db ".schema tokens"
   
   # Beispiel Output:
   # token_id, filename, country_code, radio, date, speaker_type, sex, mode, discourse, text, start, end, context_left, context_right, context_start, context_end, lemma
   # → POS-Daten fehlen! (Zusatz-Migration notwendig?)
   ```

4. **Query-Syntaxen definieren**
   - Beispiel für Multi-Word: `"el" "gato" "negro"` (Sequence)
   - Beispiel für Wildcard: `pa*bra` (Wildcard)
   - Beispiel für Regex: `/^[a-z]{3,5}$/` (Regular Expression)

**Output:** Feature-Liste mit Priorierung, DB-Audit, Query-Syntax-Definition

---

### Schritt 2: Backend-SQL-Queries testen (Dry Run)

**Ziel:** Validiere SQL-Queries lokal, bevor Code geschrieben wird.

**Aktivitäten:**

1. **SQLite CLI öffnen**
   ```bash
   cd c:\Users\Felix Tacke\OneDrive\00 - MARBURG\DH-PROJEKTE\CO.RA.PAN\CO.RA.PAN-WEB_new
   sqlite3 data/db/transcription.db
   ```

2. **Multi-Word Sequence Queries testen**
   
   **Test 1: Zwei Wörter in Folge ("el" + "gato")**
   ```sql
   -- Query: find "el" followed by "gato" in same file
   SELECT 
     t1.token_id, t1.text, t2.text, t1.context_left, t2.context_right
   FROM tokens t1
   JOIN tokens t2 ON 
     t2.filename = t1.filename 
     AND t2.id = t1.id + 1
   WHERE 
     t1.text = 'el' 
     AND t2.text = 'gato'
   LIMIT 10;
   ```
   
   **Test 2: Drei Wörter in Folge**
   ```sql
   SELECT 
     t1.token_id, t1.text, t2.text, t3.text
   FROM tokens t1
   JOIN tokens t2 ON t2.filename = t1.filename AND t2.id = t1.id + 1
   JOIN tokens t3 ON t3.filename = t1.filename AND t3.id = t1.id + 2
   WHERE 
     t1.text = 'el' 
     AND t2.text LIKE '%gato%'  -- Wildcard
     AND t3.text = 'negro'
   LIMIT 10;
   ```

3. **Wildcard Queries testen**
   
   ```sql
   -- Query: pa*bra (starts with "pa", ends with "bra")
   SELECT token_id, text FROM tokens 
   WHERE text LIKE 'pa%bra' 
   LIMIT 10;
   
   -- Query: * am Anfang (starts with anything, ends with "o")
   SELECT token_id, text FROM tokens 
   WHERE text LIKE '%o' 
   LIMIT 10;
   ```

4. **Performance testen**
   
   ```sql
   -- Vor der Abfrage: Timing aktivieren
   .timer ON
   
   -- Test: Einfache Suche (Baseline)
   SELECT COUNT(*) FROM tokens WHERE text LIKE '%palabra%';
   -- → Runtime notieren
   
   -- Test: Zwei-Wort-Sequence
   SELECT COUNT(*) FROM (
     SELECT t1.id FROM tokens t1
     JOIN tokens t2 ON t2.filename = t1.filename AND t2.id = t1.id + 1
     WHERE t1.text = 'el' AND t2.text = 'gato'
   );
   -- → Runtime notieren (sollte < 5x Baseline sein)
   
   -- Falls zu langsam: Index erstellen
   CREATE INDEX IF NOT EXISTS idx_filename_id ON tokens(filename, id);
   ```

5. **Ergebnisse dokumentieren**
   ```markdown
   ## SQL Query Test Results
   
   | Query Type | Test | Count | Runtime | Index Status |
   |-----------|------|-------|---------|--------------|
   | Baseline | text LIKE '%palabra%' | 1234 | 45ms | OK (idx_text) |
   | Sequence | t1.text = "el" + t2.text = "gato" | 56 | 120ms | SLOW → CREATE INDEX |
   | Wildcard | text LIKE 'pa%bra' | 23 | 55ms | OK |
   | Regex | REGEXP '^[a-z]{3}$' | N/A | N/A | NOT SUPPORTED |
   ```

**Output:** Validierte SQL-Queries, Performance-Benchmark, Index-Strategien

---

### Schritt 3: Backend-Code-Struktur planen

**Ziel:** Definiere, wie neue Suchtypen im Backend integriert werden.

**Aktivitäten:**

1. **SearchParams erweitern**
   
   **Alt (current):**
   ```python
   @dataclass
   class SearchParams:
       query: str
       search_mode: str = "text"  # text | text_exact | lemma | lemma_exact | token_ids
       token_ids: Sequence[str] = ()
       # Filter...
   ```
   
   **Neu (mit Advanced Search):**
   ```python
   @dataclass
   class SearchParams:
       # ... existing fields ...
       search_mode: str = "text"  # text | text_exact | lemma | lemma_exact | token_ids | advanced
       
       # Advanced Search specific
       advanced_query: str = ""           # z.B. '"el" "gato"' oder 'pa*bra'
       advanced_mode: str = "sequence"    # sequence | wildcard | regex
       sequence_length: int = 1           # 2, 3, 4... Anzahl Wörter
       sequence_values: list[str] = ()    # ["el", "gato", "negro"]
   ```

2. **SQL-Builder erweitern**
   
   **Struktur:**
   ```python
   # src/app/services/corpus_search.py
   
   def _build_advanced_query(
       mode: str,
       sequence_values: list[str],
       exact: bool = False
   ) -> tuple[str, list[str]]:
       """Build SQL for advanced search modes."""
       
       if mode == "sequence":
           return _build_sequence_query(sequence_values, exact)
       elif mode == "wildcard":
           return _build_wildcard_query(sequence_values[0])
       elif mode == "regex":
           return _build_regex_query(sequence_values[0])
       else:
           raise ValueError(f"Unknown advanced mode: {mode}")
   
   def _build_sequence_query(
       values: list[str],
       exact: bool = False
   ) -> tuple[str, list[str]]:
       """Generate SQL for multi-word sequences."""
       # Beispiel Output:
       # SQL: "SELECT t1.* FROM tokens t1 JOIN tokens t2 ... WHERE t1.text = ? AND t2.text = ?"
       # Params: ["el", "gato"]
   
   def _build_wildcard_query(pattern: str) -> tuple[str, list[str]]:
       """Convert wildcard pattern to SQL LIKE."""
       # Beispiel: "pa*bra" → "pa%bra"
   
   def _build_regex_query(pattern: str) -> tuple[str, list[str]]:
       """Convert regex to SQL (with fallback for SQLite)."""
       # SQLite hat kein REGEXP → Python regex + Filter
   ```

3. **search_tokens() integrieren**
   
   ```python
   def search_tokens(params: SearchParams) -> dict[str, object]:
       # ... existing code ...
       
       if params.search_mode == "advanced":
           sql_words, word_params = _build_advanced_query(
               params.advanced_mode,
               params.sequence_values,
               exact=False
           )
       else:
           # Existing logic für text/lemma/token_ids
           sql_words, word_params = _build_word_query(...)
       
       # Rest bleibt gleich
   ```

4. **Route-Handler vorbereiten**
   
   ```python
   @blueprint.route("/search", methods=["GET", "POST"])
   def search() -> Response:
       # ... existing code ...
       
       # Parse advanced search parameters
       if data_source.get("search_mode") == "advanced":
           advanced_mode = data_source.get("advanced_mode", "sequence")
           advanced_query = data_source.get("advanced_query", "")
           
           # Parse query string (z.B. '"el" "gato"' → ["el", "gato"])
           sequence_values = _parse_query_string(advanced_query)
           
           params.advanced_query = advanced_query
           params.advanced_mode = advanced_mode
           params.sequence_values = sequence_values
   ```

**Output:** Updated SearchParams, SQL-Builder-Struktur, Integration-Plan

---

### Schritt 4: Frontend UI-Mockup

**Ziel:** Definiere, wie der Advanced-Search-Tab aussieht und funktioniert.

**Aktivitäten:**

1. **UI-Struktur skizzieren**
   
   ```html
   <!-- Tab "Búsqueda avanzada" (currently disabled) -->
   <div id="tab-advanced" class="md3-tab-content">
     
     <!-- Query Builder Section -->
     <div class="md3-advanced-query-builder">
       
       <!-- Mode Selection -->
       <div class="md3-outlined-textfield md3-outlined-textfield--compact">
         <select id="advanced-mode" name="advanced_mode">
           <option value="sequence">Secuencia de palabras</option>
           <option value="wildcard">Patrón (Wildcard)</option>
           <option value="regex">Expresión regular</option>
         </select>
         <label>Tipo de búsqueda</label>
       </div>
       
       <!-- Input je nach Mode -->
       <div id="query-builder-sequence" class="md3-query-builder-mode">
         <!-- TokenTab (MD3 chips) für Wort-Sequenz -->
         <input type="text" id="sequence-input" placeholder="Eingabe: Wort 1, Wort 2, ...">
         <p class="md3-caption">z.B. "el", "gato", "negro"</p>
       </div>
       
       <div id="query-builder-wildcard" class="md3-query-builder-mode" hidden>
         <!-- Text-Input für Wildcard -->
         <input type="text" id="wildcard-input" placeholder="z.B. pa*bra">
         <p class="md3-caption">* steht für eine beliebige Zeichenkette</p>
       </div>
       
       <!-- ... weitere Modes ... -->
     </div>
     
     <!-- Preview Section -->
     <div class="md3-advanced-preview">
       <h3>Vorschau der Suchanfrage</h3>
       <pre id="query-preview"># SQL Query wird hier angezeigt</pre>
     </div>
     
     <!-- Existing Filters -->
     <div class="md3-corpus-filter-grid">
       <!-- Länder, Hablante, Sexo, etc. (wie bei Simple Search) -->
     </div>
     
     <!-- Actions -->
     <div class="md3-corpus-actions">
       <button type="submit" class="md3-button-filled">Buscar</button>
     </div>
   </div>
   ```

2. **JavaScript-Module planen**
   
   ```javascript
   // static/js/modules/corpus/advanced-search.js (neu)
   
   export class CorpusAdvancedSearchManager {
       constructor() {
           this.modeSelect = document.getElementById('advanced-mode')
           this.sequenceInput = document.getElementById('sequence-input')
           this.wildcardInput = document.getElementById('wildcard-input')
           this.previewPre = document.getElementById('query-preview')
       }
       
       initialize() {
           // Event-Handler für Mode-Änderung
           this.modeSelect.addEventListener('change', 
               () => this.onModeChanged()
           )
           
           // Live Preview bei Input
           this.sequenceInput.addEventListener('change',
               () => this.updatePreview()
           )
       }
       
       onModeChanged() {
           const mode = this.modeSelect.value
           
           document.querySelectorAll('.md3-query-builder-mode').forEach(el => {
               el.hidden = true
           })
           document.getElementById(`query-builder-${mode}`).hidden = false
           
           this.updatePreview()
       }
       
       updatePreview() {
           // Generiere SQL-Preview und zeige diese an
           const mode = this.modeSelect.value
           const sql = this.generateSQL(mode)
           this.previewPre.textContent = sql
       }
       
       generateSQL(mode) {
           if (mode === 'sequence') {
               const words = this.getSequenceWords()
               // Generiere SQL für Sequenz
               return `SELECT t1.* FROM tokens t1\n${joinClauses}\nWHERE ${conditions}`
           }
           // ... weitere Modes ...
       }
   }
   ```

3. **Form-Integration**
   
   ```html
   <!-- corpus.html anpassen -->
   
   <!-- Form erweitern: hidden field für advanced_query -->
   <input type="hidden" id="advanced_query" name="advanced_query" value="">
   <input type="hidden" id="advanced_mode" name="advanced_mode" value="">
   
   <!-- Tab-Button aktivieren (enabled statt disabled) -->
   <button type="button" class="md3-tab" data-tab="advanced">
     Búsqueda avanzada
   </button>
   ```

**Output:** UI-Mockup mit HTML/CSS, JavaScript-Modul-Struktur, Integration-Punkte

---

### Schritt 5: Implementierungs-Checklist

**Ziel:** Schritt-für-Schritt Implementierung mit Validierung.

**Backend-Implementierung:**

- [ ] **SearchParams erweitern**
  - Datei: `src/app/services/corpus_search.py`
  - Neue Felder: `advanced_query`, `advanced_mode`, `sequence_values`

- [ ] **SQL-Builder schreiben**
  - `_build_sequence_query()` für Multi-Word-Sequenzen
  - `_build_wildcard_query()` für Wildcard-Matching
  - `_build_regex_query()` für Regex (optional)
  - Tests für jede Funktion

- [ ] **search_tokens() anpassen**
  - Prüfe `params.search_mode == "advanced"`
  - Rufe `_build_advanced_query()` auf
  - Integriere in bestehende Filter-Logik

- [ ] **Route-Handler aktualisieren**
  - `corpus.search()` erweitern um `advanced_*` Parameter
  - `corpus.search_datatables()` unterstützen

- [ ] **Tests schreiben**
  - Unit-Tests für `_build_*_query()` Funktionen
  - Integration-Tests für `search_tokens()` mit Advanced-Mode
  - Performance-Tests

**Frontend-Implementierung:**

- [ ] **HTML erweitern**
  - Tab "Búsqueda avanzada" aktivieren (entfernen von `disabled`)
  - Query-Builder UI hinzufügen
  - Preview-Sektion hinzufügen

- [ ] **CorpusAdvancedSearchManager schreiben**
  - Datei: `static/js/modules/corpus/advanced-search.js`
  - Mode-Switching UI
  - Live Preview-Generation
  - Form-Serialisierung

- [ ] **Corpus-App integrieren**
  - `index.js` aktualisieren
  - CorpusAdvancedSearchManager initialisieren

- [ ] **Styling**
  - CSS für Query-Builder (md3/components/corpus-advanced.css)
  - Preview-Box-Styling
  - Responsive Design

- [ ] **Tests**
  - Manual testing der UI
  - Edge-Cases (leere Input, spezielle Zeichen, etc.)
  - Browser-Kompatibilität

---

### Schritt 6: Validierung

**Ziel:** Stelle sicher, dass die Implementierung korrekt ist.

**Aktivitäten:**

1. **Functional Testing**
   
   **Test 1: Sequence Search**
   ```
   Input: Advanced Mode = "Secuencia", Wörter = ["el", "gato"]
   Expected: 
     - SQL Query korrekt
     - Ergebnisse in Tabelle
     - Statistiken aktualisiert
   ```
   
   **Test 2: Wildcard Search**
   ```
   Input: Advanced Mode = "Patrón", Pattern = "pa*bra"
   Expected:
     - Matches: "palabra", "pabra", "parte", "para"
     - Keine False-Positives
   ```

2. **Performance Testing**
   
   ```
   Baseline (Simple Search): 100ms für ~1000 Ergebnisse
   Sequence Search (2 Wörter): < 500ms (5x Baseline)
   Wildcard Search: < 200ms (2x Baseline)
   Regex Search: < 1000ms (10x Baseline, acceptable)
   ```

3. **Compatibility Testing**
   
   - [ ] Chrome/Edge (Desktop)
   - [ ] Firefox (Desktop)
   - [ ] Safari (Desktop)
   - [ ] Mobile (iPhone/Android, falls relevant)
   - [ ] SQLite 3.35+ (regex support)

4. **Edge Cases**
   
   - [ ] Leere Sequenz
   - [ ] Sehr lange Sequenzen (100+ Wörter)
   - [ ] Spezielle Zeichen in Patterns
   - [ ] Kombinationen mit bestehenden Filtern
   - [ ] Pagination mit großen Ergebnismengen

**Output:** Test-Report mit Ergebnissen, Performance-Metriken, Compatibility-Matrix

---

### Schritt 7: Rollback / Backout

**Ziel:** Bei Problemen schnell zurückkehren zur bekannten stabilen Version.

**Maßnahmen:**

1. **Git-Branches**
   ```bash
   # Feature-Branch erstellen
   git checkout -b feature/advanced-search
   
   # Falls Rollback nötig
   git checkout main
   git reset --hard HEAD~1  # Nur wenn lokal
   git revert <commit-hash>  # Production
   ```

2. **Database-Rollback**
   ```bash
   # Backup vor Änderungen
   cp data/db/transcription.db data/db/transcription.db.backup-2025-11-08
   
   # Bei Problem
   cp data/db/transcription.db.backup-2025-11-08 data/db/transcription.db
   ```

3. **Disable-Flag**
   ```python
   # Temporärer Feature-Flag
   if not current_app.config.get("ENABLE_ADVANCED_SEARCH", False):
       return redirect("/corpus")
   ```

---

## Validierung

**Checklist für erfolgreiche Implementierung:**

1. ✅ SQL-Queries funktionieren lokal
2. ✅ Backend-Code geschrieben und getestet
3. ✅ Frontend UI implementiert
4. ✅ Integration in bestehende Suchergebnisse
5. ✅ DataTables Server-Side Pagination funktioniert
6. ✅ Alle bestehenden Filter funktionieren noch
7. ✅ Performance akzeptabel (< 5x Baseline)
8. ✅ Edge-Cases behandelt
9. ✅ Dokumentation aktualisiert

---

## Rollback

**Falls Probleme:**

1. **Sofort deaktivieren:**
   ```python
   # In corpus.py
   if params.search_mode == "advanced":
       return "Advanced search temporarily disabled"
   ```

2. **Zu letzter stabilen Version:**
   ```bash
   git checkout HEAD -- src/app/services/corpus_search.py
   git checkout HEAD -- static/js/modules/corpus/advanced-search.js
   git checkout HEAD -- templates/pages/corpus.html
   ```

3. **Datenbank-Reset:**
   ```bash
   cp data/db/transcription.db.backup-2025-11-08 data/db/transcription.db
   ```

---

## Prävention

**Best Practices für zukünftige Änderungen:**

1. **Immmer Feature-Branch nutzen:** `git checkout -b feature/name`
2. **Vor größeren Änderungen backup:** `cp data/db/transcription.db data/db/transcription.db.backup-YYYY-MM-DD`
3. **Tests vor Commit:** `pytest src/app/tests/`
4. **Code Review:** Mindestens eine zweite Person prüft Änderungen
5. **Staging-Umgebung:** Testen auf Test-Datenbank vor Production

---

## Siehe auch

- [Corpus Search Architecture](../reference/corpus-search-architecture.md) - Detaillierte Architektur-Referenz
- [CONTRIBUTING Guidelines](/CONTRIBUTING.md) - Dokumentations- und Commit-Konventionen
- [Database Schema Reference](database-schema.md) - Token-Tabelle und Indizes
- [Deployment Guide](../operations/deployment.md) - Production-Deployment mit DB-Optimierung
