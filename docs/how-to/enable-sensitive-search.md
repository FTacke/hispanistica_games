---
title: "How to: Enable & Test Case/Accent-Insensitive Search (Legacy)"
status: archived
owner: backend-team
updated: "2025-11-26"
tags: [search, deployment, testing, how-to, archived]
links:
  - decisions/ADR-0005-sensitive-search.md
  - reference/sensitive-search-specification.md
  - reference/database-creation-v3.md
---

# How to: Enable & Test Case/Accent-Insensitive Search (Legacy)

> **⚠️ ARCHIVED**: This guide describes configuration for the legacy SQLite-based search.
> The application now uses **BlackLab-based search** which handles case/accent sensitivity
> via CQL query modifiers. The `transcription.db` and `norm` column no longer exist.
> For current search configuration, see BlackLab documentation.

Step-by-step guide to deploy and verify sensitive/insensitive search functionality.

---

## Ziel

Nach dieser Anleitung:
- ✅ Sensitive-Search Feature ist deployed
- ✅ `norm` column und Index existieren
- ✅ UI-Checkbox funktioniert
- ✅ localStorage speichert Benutzer-Preference
- ✅ Suchergebnisse unterscheiden sich zwischen sensitive=0/1

---

## Voraussetzungen

- CO.RA.PAN v3.0+ (database mit `norm` column)
- Python 3.9+
- Flask läuft
- SQLite Browser (optional: db inspection)
- Browser DevTools (F12)

---

## Schritt 1: Code Deployment

### 1.1 Code ist bereits committed

```bash
# Navigiere zu Projekt-Root
cd "c:\Users\Felix Tacke\OneDrive\00 - MARBURG\DH-PROJEKTE\CO.RA.PAN\CO.RA.PAN-WEB_new"

# Prüfe Status
git status
# Modified files sollten bereits committed sein:
# - templates/pages/corpus.html
# - static/js/modules/corpus/datatables.js
# - src/app/services/corpus_search.py
# - src/app/routes/corpus.py
# - src/app/__init__.py
```

### 1.2 Pull latest changes (falls von anderen Branch)

```bash
git pull origin main
# (oder aktuellen Branch)
```

---

## Schritt 2: Database Vorbereitung

### 2.1 Prüfe norm Column

**Terminal:**
```bash
sqlite3 data/db/transcription.db
PRAGMA table_info(tokens);
```

**Output (prüfe auf 'norm'):**
```
...
15|context_end|REAL|0||0
16|norm|TEXT|0||0     ← MUSS hier sein
17|lemma|TEXT|0||0
...
```

✅ Wenn `norm` in der Liste: **Weiter zu Schritt 2.2**

❌ Wenn `norm` FEHLT: **Database-Rebuild erforderlich**

```bash
cd LOKAL/database
python database_creation_v2.py
# Warte auf Completion (10-15 Min)
```

### 2.2 Prüfe Index

**Terminal:**
```bash
sqlite3 data/db/transcription.db
PRAGMA index_list('tokens');
```

**Output (suche nach 'idx_tokens_norm'):**
```
...
6|idx_tokens_norm|0|c|0    ← MUSS hier sein
...
```

✅ Wenn Index vorhanden: **Weiter zu Schritt 3**

⚠️ Wenn Index FEHLT: **Wird automatisch beim App-Start erstellt** (Schritt 3.1)

### 2.3 Sample Data Prüfen (Optional)

```bash
sqlite3 data/db/transcription.db
SELECT text, norm FROM tokens LIMIT 5;
```

**Output (Beispiele):**
```
text       | norm
-----------|----------
México     | mexico
ESPAÑA     | espana
está       | esta
café       | cafe
SEÑOR      | senor
```

✅ Wenn `norm` gefüllt: Perfekt!

---

## Schritt 3: App Deployment

### 3.1 App Starten

**Terminal:**
```bash
$env:FLASK_ENV="development"
python -m src.app.main
```

**Logs prüfen (suche nach diesen Zeilen):**
```
[STARTUP] Starting DB schema validation...
[STARTUP] Creating idx_tokens_norm index...     ← Falls Index fehlt
[STARTUP] idx_tokens_norm index created successfully
[STARTUP] DB schema validation passed - all CANON_COLS present
```

✅ Alle Zeilen sichtbar = **Ready**

### 3.2 Browser öffnen

```
http://localhost:8000/corpus
```

---

## Schritt 4: UI Verification

### 4.1 Checkbox sichtbar?

**Visual Check:**
- [ ] Neuer Checkbox "Sensibilidad a mayúsculas y acentos" vorhanden
  - Position: Unter "Incluir emisoras regionales"
  - Default: ✅ CHECKED
  - Label: Spanisch

### 4.2 Label korrekt?

- [ ] Dropdown neben "Búsqueda" hat Label **"Forma/lema"** (nicht "Modo")

---

## Schritt 5: localStorage Test

### 5.1 Browser DevTools öffnen

```
F12 → Storage → localStorage → http://localhost:8000
```

### 5.2 Initial State

**Console:**
```javascript
localStorage.getItem('corapan_sensitive')
// → Should be: '1' (checked by default)
```

### 5.3 Toggle Checkbox

```
Uncheck the checkbox
→ Browser automatically saves to localStorage
```

**Console:**
```javascript
localStorage.getItem('corapan_sensitive')
// → Should now be: '0'
```

### 5.4 Reload Test

```
F5 (page reload)
```

**Visual Check:**
- [ ] Checkbox sollte noch **UNCHECKED** sein ✅

**Console:**
```javascript
localStorage.getItem('corapan_sensitive')
// → Should still be: '0'
```

✅ localStorage funktioniert! **Weiter zu Schritt 6**

---

## Schritt 6: AJAX Parameter Test

### 6.1 Network Tab öffnen

```
DevTools → Network Tab
```

### 6.2 Suche mit sensitive=1

**UI:**
1. Checkbox **CHECK** ("Sensibilidad..." checked)
2. Search Term: "méxico"
3. Click "Buscar"

**Network Tab:**
1. Filter: Requests zu `/corpus/search/datatables`
2. Klick auf Request
3. Query String prüfen:
   - [ ] `sensitive=1` vorhanden ✅

### 6.3 Suche mit sensitive=0

**UI:**
1. Checkbox **UNCHECK** ("Sensibilidad..." unchecked)
2. Search Term: "méxico" (gleich wie vorher)
3. Click "Buscar"

**Network Tab:**
1. Filter: `/corpus/search/datatables`
2. Klick auf neuester Request
3. Query String prüfen:
   - [ ] `sensitive=0` vorhanden ✅

---

## Schritt 7: Suchergebnisse Vergleich

### 7.1 Test: "méxico"

**Setup:**
- Land: Beliebig (z.B. "Todos")
- Hablante: Beliebig
- Modo (Forma/lema): "Forma"

**Lauf 1 - sensitive=1:**
1. Checkbox **CHECK** (angehakt)
2. Suchfeld: "méxico"
3. Click "Buscar"
4. Zähle Ergebnisse: **`N_sensitive_1 = ___`**
   - Notiere: Nur exakte Treffer

**Lauf 2 - sensitive=0:**
1. Checkbox **UNCHECK** (abgehakt)
2. Suchfeld: "méxico" (identisch)
3. Click "Buscar"
4. Zähle Ergebnisse: **`N_sensitive_0 = ___`**
   - Notiere: Alle Varianten ("mexico", "MÉXICO", etc.)

**Erwartung:**
```
N_sensitive_0 >= N_sensitive_1
```

✅ Wenn erfüllt: **Feature funktioniert!**

### 7.2 Test: "está" vs "esta"

**Lauf 1 - sensitive=1:**
1. Checkbox CHECK
2. Suchfeld: "está"
3. Zähle: `X_1 = ___`

**Lauf 2 - sensitive=0:**
1. Checkbox UNCHECK
2. Suchfeld: "está"
3. Zähle: `X_0 = ___`

**Erwartung:**
```
X_0 > X_1
(sensitive=0 findet auch "esta" ohne Akzent)
```

✅ Wenn erfüllt: **Akzent-Normalisierung funktioniert!**

---

## Schritt 8: Performance Test

### 8.1 Query Speed Messen

**Lauf 1 - sensitive=1:**
1. DevTools → Network Tab → clear
2. Checkbox CHECK
3. Suchfeld: "mexicano"
4. Click "Buscar"
5. Datatable Request zeit notieren: **`T_1 = ___ ms`**

**Lauf 2 - sensitive=0:**
1. DevTools → Network Tab → clear
2. Checkbox UNCHECK
3. Suchfeld: "mexicano"
4. Click "Buscar"
5. DataTables Request zeit notieren: **`T_0 = ___ ms`**

**Akzeptanzkriterien:**
```
T_0 / T_1 <= 1.5  (max 50% langsamer)
```

✅ Wenn erfüllt: **Performance ist akzeptabel**

---

## Schritt 9: Regression Tests

### 9.1 Bestehende Features

Stelle sicher, dass keine Features kaputt sind:

- [ ] Standard-Suche (checkbox ignored)
- [ ] Filter (Land, Hablante, Sexo, Modo, Discurso)
- [ ] Token-Tab funktioniert
- [ ] Statistiken/Charts funktionieren
- [ ] Export funktioniert
- [ ] Pagination funktioniert

---

## Schritt 10: Browser Compatibility

Teste auf mehreren Browsern:

- [ ] Chrome
- [ ] Firefox
- [ ] Edge
- [ ] Safari (falls verfügbar)

---

## Troubleshooting

### Problem 1: Checkbox nicht sichtbar

**Diagnose:**
```
Browser DevTools → Inspector
Suche nach: id="sensitive-search"
```

**Lösung:**
```bash
# Cache leeren
Ctrl+Shift+Delete

# oder Hard-Reload
Ctrl+Shift+R
```

### Problem 2: localStorage funktioniert nicht

**Diagnose:**
```javascript
// Console
localStorage.getItem('corapan_sensitive')
// → Should return: '1' or '0', not null
```

**Lösung:**
```bash
# Prüfe Browser-Einstellungen
# localStorage muss enabled sein
# Private Browsing deaktivieren
```

### Problem 3: AJAX Parameter fehlt (`sensitive`)

**Diagnose:**
```
Network Tab → DataTables Request → Query String
sensitive=0 oder sensitive=1 NICHT vorhanden?
```

**Lösung:**
```bash
# Prüfe JavaScript-Fehler
DevTools → Console
# Sollte keine Fehler zeigen
```

### Problem 4: Suchergebnisse gleich bei sensitive=0/1

**Ursache:** `norm`-Spalte leer

**Diagnose:**
```bash
sqlite3 data/db/transcription.db
SELECT COUNT(*) FROM tokens WHERE norm IS NULL;
# Sollte: 0 (alle gefüllt)
```

**Lösung:**
```bash
cd LOKAL/database
python database_creation_v2.py
# Database rebuild erforderlich
```

### Problem 5: Index fehlt beim Startup

**Diagnose:**
```
Logs:
[STARTUP] Creating idx_tokens_norm index...
[STARTUP] ⚠️  Error creating index
```

**Lösung:**
```bash
# Manuell erstellen
sqlite3 data/db/transcription.db
CREATE INDEX IF NOT EXISTS idx_tokens_norm ON tokens(norm);
ANALYZE;
.quit
```

---

## Validation Checklist

Nach jedem Schritt abhaken:

- [ ] Schritt 1: Code deployed
- [ ] Schritt 2: Database vorbereitet (norm + index)
- [ ] Schritt 3: App startet ohne Fehler
- [ ] Schritt 4: UI sichtbar
- [ ] Schritt 5: localStorage funktioniert
- [ ] Schritt 6: AJAX Parameter korrekt
- [ ] Schritt 7: Suchergebnisse unterschiedlich (sensitive=0/1)
- [ ] Schritt 8: Performance akzeptabel
- [ ] Schritt 9: Keine Regressions
- [ ] Schritt 10: Cross-Browser kompatibel

---

## Sign-Off

**Deployment Date:** ___________________

**Tested By:** ___________________

**Status:** ✅ READY / ⚠️ ISSUES / ❌ FAILED

**Notes:**
```
_________________________________________________
_________________________________________________
_________________________________________________
```

---

## Siehe auch

- [ADR-0005: Decision Record](../decisions/ADR-0005-sensitive-search.md) - Why and how
- [Sensitive Search Specification](../reference/sensitive-search-specification.md) - Technical details
- [Database Creation v3](../reference/database-creation-v3.md) - Database schema
- [Corpus Search Architecture](../reference/corpus-search-architecture.md) - Search flow
