# Quiz Refactoring – Plan

**Stand:** 29. Januar 2026  
**Zweck:** Strukturierter, umsetzbarer Umbauplan für großes Refactoring

**Basis:** [refactoring_baseline.md](refactoring_baseline.md) – Alle Referenzen beziehen sich auf die dort dokumentierten Code-Stellen.

---

## Zielbild

### Endzustand der Mechanik

**3 Levels statt 5:**
- Level 1: 4 Fragen (difficulty=1)
- Level 2: 4 Fragen (difficulty=2)
- Level 3: 2 Fragen (difficulty=3)
- **Gesamt:** 10 Fragen (unverändert)

**Neue Difficulty-Range:** 1-3

**Timer-Änderungen:**
- Named Mode: 40 Sekunden (statt 30)
- Anonym Mode: 240 Sekunden (statt 30)
- Media-Bonus: Bleibt 10 Sekunden (optional anpassen)

**Scoring:**
- Base Points + Level-Bonus (bei perfektem Level)
- Keine Zusatzmetriken

**Textformatierung:**
- Markdown-Subset in Prompts/Answers/Explanations: `**bold**`, `*italic*`
- Kein HTML, kein Underline, keine Links (erstmal)

**Admin/Import:**
- Unterstützt neues Schema (Difficulty 1-3)
- Validierung akzeptiert neue Ranges
- Release-Pipeline unverändert

### Was bewusst NICHT Teil des Refactorings ist

❌ Scoring-Formeln (außer Level-Bonus-Regel)  
❌ Joker-Logik (bleibt 50:50, 2× pro Run)  
❌ Leaderboard-Sortierung (bleibt: score DESC, created_at ASC)  
❌ Player-Auth (bleibt separates System)  
❌ Question-Selection-Algorithmus (bleibt weighted random)  
❌ Database-Schema-Migration (nur Content-Migration)  
❌ UI-Bugs (erst nach Refactoring)

---

## Phasenplan

### Übersicht

| Phase | Ziel | Duration | Risk |
|-------|------|----------|------|
| Phase 0 | Vorbereitung & Safety | 1 Tag | 🟢 Low |
| Phase 1 | Mechanik + Content + Schema | 3-5 Tage | 🔴 Critical |
| Phase 2 | Timer, HUD, Layout | 1-2 Tage | 🟠 High |
| Phase 3a | Markdown finalisieren | 1-2 Tage | 🟡 Medium |
| Phase 3b | Server / Admin / Import / Prod-Prep | 1-2 Tage | 🟠 High |
| Phase 4 | Stabilität & Bugfixes | 2-3 Tage | 🟠 High |
| Phase 5 | Cleanup & Merge | 0.5-1 Tag | 🟡 Medium |

**Gesamt:** 9-14 Tage

---

## Status

- **Phase 0 – Done (29.01.2026):** Feature-Flag + Safety-Grundlagen dokumentiert.
- **DEV-Unblock – Done (29.01.2026):** Dev-Start/Seed-Modi stabilisiert.
- **Phase 1 (inkl. 1C/1D) – Done (29.01.2026):** v2-Mechanik, Content-Migration, Seeds/Prune, Dev-Docs.
- **Phase 2 (inkl. 2b/2c/2d) – Done (29.01.2026):** Timer 40/240, HUD/Meta-Layout finalisiert.
- **Phase 3a – In Progress (29.01.2026):** Markdown finalisieren (Renderer + Regeln + Doku).

---

## Phase 0 – Vorbereitung / Safety

**Ziel:** Umbau ohne Chaos, saubere Testbarkeit, keine Regressionen.

### Aufgaben

#### 0.1 – Mechanics-Version oder Feature-Flag (empfohlen)

**Option A: Config-Flag**
```python
# config.py oder .env
QUIZ_MECHANICS_VERSION = "v2"  # oder "v1"
```

**Option B: DB-Feld**
```sql
ALTER TABLE quiz_runs ADD COLUMN mechanics_version INTEGER DEFAULT 1;
```

**Entscheidung:** Config-Flag (einfacher, kein Schema-Change)

**Verwendung:**
- In `start_run()`: Neue Runs mit v2-Mechanik
- In `calculate_running_score()`, `finish_run()`: Check Version
- Backward-Compat für alte in-progress Runs

**Code-Stellen:**
- `services.py` Z.74-93: Konstanten v1/v2 unterscheiden
- `services.py` Z.642: Selection-Logik v1/v2

**Was darf sich ändern:** Config-Loading
**Was darf sich NICHT ändern:** Bestehende DB-Daten

**Abnahmekriterium:** Feature-Flag existiert, kann per ENV umgeschaltet werden

---

#### 0.2 – Minimal-Tests definieren

**E2E-Tests (manuell oder automatisch):**
1. Start Run → Answer 10 Questions → Finish → Check Leaderboard
2. Anonymous Run → Answer 10 Questions → Finish (kein Leaderboard)
3. Use Joker 2× → Verify disabled answers
4. Timeout Test → Let timer expire → Verify 0 points

**Unit-Tests (Python):**
- `test_question_selection_v2()` – 4/4/2 Verteilung
- `test_level_detection_v2()` – Level-Complete bei idx 3, 7, 9
- `test_scoring_v2()` – Neue Bonus-Regeln (Level-Bonus)

**Frontend-Tests (manuell):**
- Load Question → Answer → Level-Up Animation
- Timer Countdown → Auto-Submit

**Was darf sich ändern:** Test-Code (neu erstellt)
**Was darf sich NICHT ändern:** Prod-Code

**Abnahmekriterium:** Test-Suite läuft durch (v1-Mechanik), kann für v2 adaptiert werden

---

### Abhängigkeiten

**Keine.** Phase 0 ist unabhängig, kann parallel zu Content-Authoring laufen.

**Blocker für:** Keine Phase blockiert, aber Phase 1 profitiert stark von 0.1 (Feature-Flag)

---

## Phase 1 – Mechanik + Content + Schema

**Ziel:** 3 Levels, Difficulty 1-3, Fragen-Verteilung 4/4/2, Level-Bonus aktiv.

**Risk:** 🔴 Critical – Diese Phase ändert Core-Mechanik, Scoring und Content.

### 1A – Neue Mechanik festnageln (zuerst, schriftlich)

**Dokument:** Erstelle `docs/quiz/MECHANICS_V2.md`

**Inhalt:**
- 3 Level: L1 (4×D1), L2 (4×D2), L3 (2×D3)
- Bonus-Regel: "Alle Fragen eines Levels korrekt" → Bonus = 2 × Difficulty × Base-Points
- Keine Zusatzmetriken neben Base-Points + Level-Bonus.
- Points: Unverändert (10/20/30 für D1/D2/D3)

**Code-Stellen (Referenz):**
- Baseline Z.74-93: Konstanten

**Was darf sich ändern:** Dokumentation (neu)
**Was darf sich NICHT ändern:** Code

**Abnahmekriterium:** Dokument existiert, alle Beteiligten haben Review bestätigt

---

### 1B – Backend-Umsetzung

#### 1B.1 – Konstanten ändern

**Datei:** `game_modules/quiz/services.py` Z.74-93

**Änderungen:**
```python
# ALT (v1):
DIFFICULTY_LEVELS = 5
QUESTIONS_PER_DIFFICULTY = 2

# NEU (v2):
DIFFICULTY_LEVELS = 3
QUESTIONS_PER_LEVEL = {1: 4, 2: 4, 3: 2}  # Statt fixer Zahl

# Oder wenn dynamisch:
if MECHANICS_VERSION == "v2":
    DIFFICULTY_LEVELS = 3
    QUESTIONS_PER_LEVEL = [4, 4, 2]
else:
    DIFFICULTY_LEVELS = 5
    QUESTIONS_PER_LEVEL = [2, 2, 2, 2, 2]
```

**Impacted Functions:**
- `_build_run_questions()` Z.642-720
- `calculate_running_score()` Z.1137-1198
- `finish_run()` Z.1201-1312

**Was darf sich ändern:** Konstanten, Selection-Logik, Scoring
**Was darf sich NICHT ändern:** API-Contracts (Responses), DB-Schema

**Abnahmekriterium:** Unit-Tests für Selection + Scoring laufen durch

---

#### 1B.2 – Selection-Algorithmus anpassen

**Datei:** `game_modules/quiz/services.py`, Function `_build_run_questions()` Z.642-720

**Aktuelle Logik:**
```python
for difficulty in range(1, DIFFICULTY_LEVELS + 1):  # 1-3
    # Select 2 questions per difficulty
    for _ in range(QUESTIONS_PER_DIFFICULTY):  # 2
        ...
```

**Neue Logik:**
```python
for difficulty, count in enumerate(QUESTIONS_PER_LEVEL, start=1):  # [(1,4), (2,4), (3,2)]
    # Select `count` questions for this difficulty
    for _ in range(count):
        ...
```

**Wichtig:** Weighted-Random bleibt (History-Based)

**Was darf sich ändern:** Loop-Struktur, Difficulty-Range
**Was darf sich NICHT ändern:** Weighted-Logic, ULID-Format

**Abnahmekriterium:** `test_question_selection_v2()` ergibt 4+4+2=10 Fragen

---

#### 1B.3 – Level-Progress anpassen

**Datei:** `game_modules/quiz/services.py`, Function `calculate_running_score()` Z.1137-1198

**Aktuelle Level-Complete-Detection:**
```python
# Z.1191: Check if current answer completed this level
if difficulty == current_difficulty and len(results) == 2:
    level_completed = True
```

**Neue Detection:**
```python
# Level 1 complete bei idx 3 (4 Fragen: 0,1,2,3)
# Level 2 complete bei idx 7 (4 Fragen: 4,5,6,7)
# Level 3 complete bei idx 9 (2 Fragen: 8,9)

expected_count = QUESTIONS_PER_LEVEL[difficulty]  # 4 or 2
if difficulty == current_difficulty and len(results) == expected_count:
    level_completed = True
```

**Was darf sich ändern:** Level-Complete-Logik, Bonus-Berechnung
**Was darf sich NICHT ändern:** Response-Format (noch)

**Abnahmekriterium:** `test_level_detection_v2()` erkennt Level-Complete bei idx 3, 7, 9

---

#### 1B.4 – Scoring anpassen (Level-Bonus)

**Datei:** `game_modules/quiz/services.py`, Function `finish_run()` Z.1201-1312

**Regel:** Level-Bonus = Summe der Punkte des Levels, nur bei 100% korrekt.

**Was darf sich ändern:** Bonus-Berechnung
**Was darf sich NICHT ändern:** Base-Points pro Frage

**Abnahmekriterium:** Bonus wird nur bei perfektem Level addiert

---

#### 1B.5 – API-Responses anpassen

**Dateien:**
- `game_modules/quiz/services.py` (Dataclasses)
- `src/app/routes/quiz.py` (nicht analysiert, aber aus Docs bekannt)

**Response-Änderungen:**

**AnswerResult:**
```python
# ALT:
level_perfect: bool = False

# NEU:
level_perfect: bool = False  # Bleibt (für Bonus-Anzeige)
# Keine Zusatzfelder für Bonus-Tracking außerhalb von `level_bonus`
```

**ScoreResult:**
```python
# NEU:
level_bonus: int  # Bonus pro Level (wenn perfekt)
```

**Breakdown-Item:**
```python
# NEU:
"level_bonus": level_bonus,
```

**Was darf sich ändern:** Response-Werte für Bonus
**Was darf sich NICHT ändern:** Response-Struktur für bestehende Felder

**Abnahmekriterium:** Bonus wird korrekt im Breakdown abgebildet

---

### 1C – Content-Refactor

#### 1C.1 – JSON-Schema anpassen

**Datei:** `game_modules/quiz/validation.py`

**Änderungen:**

**Difficulty-Range (Z.171-173):**
```python
# ALT:
if not isinstance(difficulty, int) or difficulty < 1 or difficulty > 5:

# NEU:
if not isinstance(difficulty, int) or difficulty < 1 or difficulty > 3:
```

**Count-Validation (Z.257-265):**
```python
# ALT:
for d in range(1, 4):  # 1-3
    count = difficulty_counts.get(d, 0)
    if count < 2:
        errors.append(f"Difficulty {d}: need at least 2 questions, got {count}")

# NEU:
# Level 1: min 4, Level 2: min 4, Level 3: min 2
required_counts = {1: 4, 2: 4, 3: 2}
for d, required in required_counts.items():
    count = difficulty_counts.get(d, 0)
    if count < required:
        errors.append(f"Difficulty {d}: need at least {required} questions, got {count}")
```

**Was darf sich ändern:** Validation-Rules
**Was darf sich NICHT ändern:** JSON-Format (quiz_unit_v2 bleibt)

**Abnahmekriterium:** Validator akzeptiert Difficulty 1-3, lehnt >3 ab

---

#### 1C.2 – Content-Migration-Script

**Tool:** `scripts/quiz_content_migrate_v2.py` (neu erstellen)

**Ziel:** Alle existierenden Units mit Difficulty >3 → 1-3 konvertieren

**Mapping (Beispiel):**
```python
DIFFICULTY_MAP = {
    1: 1,  # Easy → Easy
    2: 1,  # Medium-Easy → Easy
    3: 2,  # Medium → Medium
    4: 2,  # Medium-Hard → Medium
    5: 3,  # Hard → Hard
}
```

**Oder:** Manuelle Review (wenn wenige Topics)

**Script-Ablauf:**
1. Lese alle JSON-Files aus `content/quiz/topics/`
2. Für jede Question: `question["difficulty"] = DIFFICULTY_MAP[old_difficulty]`
3. Validiere mit neuem Validator
4. Schreibe zurück (Backup vorher!)

**Was darf sich ändern:** Content-Dateien (difficulty-Werte)
**Was darf sich NICHT ändern:** Question-IDs, Prompts, Answers

**Abnahmekriterium:** Alle Units validieren gegen neues Schema, keine Frage hat Difficulty >3

---

#### 1C.3 – Re-Seed DEV Database

**Nach Content-Migration:**
```powershell
python scripts/quiz_seed.py
```

**Effekt:** DB enthält nur noch Difficulty 1-3

**Prüfung:**
```sql
SELECT difficulty, COUNT(*) FROM quiz_questions GROUP BY difficulty;
-- Expected: 1, 2, 3 (keine 4, 5)
```

**Was darf sich ändern:** DB-Inhalte (Questions)
**Was darf sich NICHT ändern:** Players, Runs, Scores (bleiben)

**Abnahmekriterium:** Quiz startet, selektiert Fragen nur aus 1-3

---

### Abhängigkeiten

**1A → 1B:** Backend braucht Mechanik-Spec  
**1B → 1C:** Content-Validation braucht neue Backend-Konstanten  
**1C.2 → 1C.3:** Re-Seed braucht migrierte Content-Dateien

**Blocker für:**
- Phase 2 (Timer): Kann parallel, aber Level-Detection aus 1B nötig für korrekte Timer-Resets
- Phase 3a (Markdown): Unabhängig, kann parallel
- Phase 3b (Server/Admin/Import): Braucht 3a + 1C.1 (Validator)

---

### Abnahmekriterien (Phase 1 gesamt)

✅ Feature-Flag `MECHANICS_VERSION=v2` aktiv  
✅ Backend selektiert 4/4/2 Fragen  
✅ Level-Complete bei idx 3, 7, 9  
✅ Scoring: Bonus korrekt (nur bei perfektem Level)  
✅ API-Responses: Bonus korrekt, kein Frontend-Crash  
✅ Validator akzeptiert nur Difficulty 1-3  
✅ Content-Dateien: Keine Difficulty >3 mehr  
✅ DEV-DB: Neue Runs laufen mit v2-Mechanik durch  

---

## Phase 2 – Timer & Modi

**Ziel:** Default 40s, Anonym 240s; HUD prominent.

**Risk:** 🟠 High – Timer-Logik betrifft Timeout-Enforcement.

### 2A – Backend: Timer-Logik

#### 2A.1 – Time-Limit-Berechnung anpassen

**Datei:** `game_modules/quiz/services.py`, Function `calculate_time_limit()` Z.785-795

**Aktuelle Logik:**
```python
base_time = TIMER_SECONDS  # 30
if media:
    return base_time + MEDIA_BONUS_SECONDS  # 30+10=40
return base_time  # 30
```

**Neue Logik:**
```python
# Check Player-Typ
player = run.player  # Annahme: run hat Zugriff auf player
if player.is_anonymous:
    base_time = 240
else:
    base_time = 40

if media:
    return base_time + MEDIA_BONUS_SECONDS
return base_time
```

**Problem:** `calculate_time_limit()` bekommt nur `question_data`, keinen `player`

**Lösung:** Function-Signatur erweitern:
```python
def calculate_time_limit(question_data: dict, is_anonymous: bool = False) -> int:
    base_time = 240 if is_anonymous else 40
    # ...
```

**Call-Site:** `start_question()` Z.823 muss `is_anonymous` übergeben

**Was darf sich ändern:** Time-Limit-Berechnung, Function-Signatur
**Was darf sich NICHT ändern:** Timer-Enforcement-Logik (bleibt server-seitig)

**Abnahmekriterium:** Named-Player: 40s, Anonym: 240s (getestet in DEV)

---

#### 2A.2 – Konstanten updaten

**Datei:** `game_modules/quiz/services.py` Z.74

```python
# ALT:
TIMER_SECONDS = 30

# NEU:
TIMER_SECONDS_NAMED = 40
TIMER_SECONDS_ANONYMOUS = 240
MEDIA_BONUS_SECONDS = 10  # Unverändert
```

**Verwendung:**
- `calculate_time_limit()` (neu angepasst)
- `start_question()` Z.823 (Default-Fallback)

**Was darf sich ändern:** Konstanten-Namen, Werte
**Was darf sich NICHT ändern:** Timer-Enforcement-Logik

**Abnahmekriterium:** Code kompiliert, alte `TIMER_SECONDS`-Referenzen ersetzt

---

### 2B – Frontend: HUD Timer/Joker

#### 2B.1 – Timer-Display prominent

**Datei:** `static/js/games/quiz-play.js` (Timer-Render-Function, nicht analysiert)

**Anforderung:**
- Timer immer sichtbar (nicht nur bei Hover)
- Größer, farblich hervorgehoben (z.B. orange bei <10s)
- Progress-Bar oder Kreis-Display

**CSS:** `static/css/games/quiz.css`

**Was darf sich ändern:** Layout, Styles
**Was darf sich NICHT ändern:** Timer-Logik (bleibt server-based)

**Abnahmekriterium:** Timer ist immer sichtbar, gut lesbar

---

#### 2B.2 – Joker-Button prominent

**Datei:** `templates/games/quiz/*.html` (nicht analysiert)

**Anforderung:**
- 50:50-Button immer sichtbar (nicht versteckt)
- Restanzeige klar ("2× verfügbar" → "1× verfügbar" → "Verbraucht")
- Disabled-State visuell klar

**Was darf sich ändern:** Layout, Button-Styles
**Was darf sich NICHT ändern:** Joker-Logik (bleibt 2× per Run, eliminiert 2 falsche)

**Abnahmekriterium:** Joker-Button ist prominent, Restanzeige klar

---

### Abhängigkeiten

**2A → 2B:** Frontend braucht neue Time-Limits vom Backend

**Blocker für:** Keine (Phase 2 kann parallel zu Phase 3a laufen)

---

### Abnahmekriterien (Phase 2 gesamt)

✅ Named-Player: Timer startet mit 40s  
✅ Anonym-Player: Timer startet mit 240s  
✅ Media-Bonus: +10s addiert  
✅ Frontend: Timer-Display prominent, gut lesbar  
✅ Frontend: Joker-Button prominent, Restanzeige klar  

---

## Phase 3a – Markdown finalisieren

**Ziel:** `**bold**` und `*italic*` in Prompts/Answers/Explanations.

**Risk:** 🟡 Medium – Wenn falsch: XSS-Risiko oder Rendering-Bugs.

### 3A – Festlegung

**Dokument:** `docs/quiz/CONTENT_MARKDOWN.md` (verlinkt aus CONTENT.md + README.md)

**Erlaubt:**
- `**bold**` → `<strong>`
- `*italic*` → `<em>`

**Nicht erlaubt:**
- HTML-Tags (werden escaped)
- Links `[text](url)`
- Nested Markdown (`***text***`, `**bold *italic***`)
- Underline `__text__`
- Listen, Headings, Code-Blocks

**Was darf sich ändern:** Dokumentation (neu)
**Was darf sich NICHT ändern:** Content (noch)

**Abnahmekriterium:** Markdown-Regeln dokumentiert, Review bestätigt

---

### 3B – Implementierung

#### 3B.1 – Markdown-Parsing (Frontend)

**Datei:** `static/js/games/quiz-play.js` (oder neues Modul `quiz-markdown.js`)

**Library:** Entweder:
- Eigene Regex (simpel, nur bold/italic)
- Library wie `marked.js` (overkill, aber robust)

**Empfehlung:** Eigene Regex (kleiner Footprint)

**Code (Beispiel):**
```javascript
function renderMarkdown(text) {
    const safe = escapeHtml(text || '');
    // Bold zuerst markieren, damit kein Nested-Rendering passiert
    const placeholders = [];
    const withBoldMarkers = safe.replace(/\*\*([^*]+)\*\*/g, (_, c) => {
        const marker = `__B${placeholders.length}__`;
        placeholders.push(c);
        return marker;
    });
    const withItalic = withBoldMarkers.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return withItalic.replace(/__B(\d+)__/g, (_, i) => `<strong>${placeholders[i] || ''}</strong>`);
}
```

**Wichtig:** HTML wird zuerst escaped; nur **bold**/**italic** werden ersetzt.

**Was darf sich ändern:** Rendering-Logic
**Was darf sich NICHT ändern:** Content-Format (bleibt Plaintext + Markdown)

**Abnahmekriterium:** `renderMarkdown("**bold** and *italic*")` ergibt `<strong>bold</strong> and <em>italic</em>`

---

#### 3B.2 – Integration in Question-Render

**Datei:** `static/js/games/quiz-play.js` (Question-Render-Function, nicht analysiert)

**Stellen wo Markdown gerendert werden muss:**
- `prompt_key` (Fragentext)
- `answer.text` (Antwort-Text)
- `explanation_key` (Erklärung)

**ALT:**
```javascript
promptEl.textContent = question.prompt_key;
```

**NEU:**
```javascript
promptEl.innerHTML = renderMarkdown(question.prompt_key);
```

**Wichtig:** Nur bei Feldern die aus DB kommen (kein User-Input)

**Was darf sich ändern:** Render-Logic (textContent → innerHTML)
**Was darf sich NICHT ändern:** DOM-Struktur

**Abnahmekriterium:** Frage mit `**bold**` zeigt "bold" fett

---

#### 3B.3 – Content-Lint (optional)

**Tool:** `scripts/quiz_content_lint_markdown.py` (optional)

**Prüfungen:**
- Unclosed markers (`**bold` ohne schließendes `**`)
- Nested markers (`***text***` → unklar)

**Oder:** Manuelle Review beim Content-Authoring

**Was darf sich ändern:** Lint-Tool (neu)
**Was darf sich NICHT ändern:** Content

**Abnahmekriterium:** Keine Lint-Errors (wenn Tool implementiert)

---

### Abhängigkeiten

**3A → 3B:** Implementation braucht Spec

**Blocker für:** Phase 3b startet erst nach 3a (Markdown finalisiert)

**Kritisch für:** Content-Authoring (muss vor Content-Freeze fertig sein)

---

### Abnahmekriterien (Phase 3a gesamt)

✅ Markdown-Regeln dokumentiert  
✅ `renderMarkdown()` implementiert (bold + italic)  
✅ Prompts/Answers/Explanations rendern Markdown korrekt  
✅ Keine XSS-Risiken (HTML-Tags escaped)  
✅ Kein Rendering-Fehler bei ungültiger Syntax  

---

## Phase 3b – Server / Admin / Import / Prod-Prep

**Ziel:** Prod-Prep verstehen + Admin/Import auf v2-Content absichern.

**Risk:** 🟠 High – Fehlende Baseline blockiert Prod-Prep.

### 3B.1 – Server Baseline (read-only)

**Dokument:** `docs/quiz/refactoring/quiz_refactoring_server.md`

**Quelle:** Server-Agent (read-only) mit Prompt aus `docs/quiz/refactoring/server_agent_prompt.md`

**Abnahmekriterium:** Baseline liegt vor (ENV-Keys, Release-Pfade, DB-Counts, Logs)

---

### 3B.2 – Import-Service anpassen

**Datei:** `game_modules/quiz/import_service.py`

**Änderungen:** Keine direkten Code-Änderungen nötig (verwendet Validator aus Phase 1C.1)

**Prüfung:**
1. Import-Service ruft `validate_quiz_unit()` (validation.py)
2. Validator akzeptiert Difficulty 1-3
3. Import läuft durch

**Test:** Import eine Release mit Difficulty 1-3 → Sollte funktionieren

**Was darf sich ändern:** Nichts (außer Bug-Fixes)
**Was darf sich NICHT ändern:** Import-Flow

**Abnahmekriterium:** Test-Import mit neuen Units erfolgreich

---

### 3B.3 – Admin-UI Templates/Forms

**Datei:** `templates/admin/quiz_content.html` (nicht analysiert)

**Änderungen (falls vorhanden):**
- Preview/Schema-Hinweise: "Difficulty 1-3" (kein Legacy-Bereich)
- Wenn Difficulty-Dropdown: Nur 1-3 anzeigen

**Oder:** Keine Änderung nötig (wenn Admin-UI nur Import-Button, kein Editor)

**Was darf sich ändern:** UI-Hints, Dropdowns
**Was darf sich NICHT ändern:** Import-Logic

**Abnahmekriterium:** Admin-UI zeigt korrekte Schema-Info (wenn vorhanden)

---

### 3B.4 – Release-Statistiken

**Datei:** `src/app/routes/quiz_admin.py` (nicht analysiert im Detail)

**Änderung:** Wenn Release-Stats "Questions per Difficulty" anzeigen:
- Erwarte nur Difficulty 1-3
- Zeige 3 Balken statt 5

**Oder:** Keine Änderung nötig (wenn Stats nur Total-Count)

**Was darf sich ändern:** Stats-Display
**Was darf sich NICHT ändern:** DB-Queries

**Abnahmekriterium:** Release-Statistiken zeigen korrekte Counts für Difficulty 1-3

---

### Abhängigkeiten

**Phase 3a → Phase 3b:** Markdown finalisiert
**Phase 1C.1 → Phase 3B.2:** Validator muss fertig sein

**Blocker für:** Phase 4 (Stabilität) startet nach 3b

---

### Abnahmekriterien (Phase 3b gesamt)

✅ Import-Service akzeptiert Units mit Difficulty 1-3  
✅ Import-Service lehnt Difficulty >3 ab (Validation-Error)  
✅ Admin-UI zeigt korrekte Schema-Info (falls vorhanden)  
✅ Release-Stats zeigen Difficulty 1-3 (falls implementiert)  

---

## Phase 4 – Stabilität & Bugfixes

**Ziel:** Bekannte UI-Bugs reproduzieren + fixen mit Instrumentation.

**Risk:** 🟠 High – Bugs können schwer reproduzierbar sein.

### 4A – Instrumentation einbauen

**Datei:** `static/js/games/quiz-play.js`

**Debug-Logging:**
```javascript
// State-Transitions loggen
function setState(newState) {
    console.log('[STATE]', state.uiState, '->', newState, {
        index: state.currentIndex,
        isAnswered: state.isAnswered,
        pendingTransition: state.pendingTransition
    });
    state.uiState = newState;
}

// Click-Events loggen
answerButton.addEventListener('click', (e) => {
    console.log('[CLICK]', {
        answerId: e.target.dataset.answerId,
        uiState: state.uiState,
        isAnswered: state.isAnswered
    });
    // ...
});
```

**Toggle:** Via Debug-Flag (Z.195 `DEBUG = true`)

**Was darf sich ändern:** Logging-Code (neu)
**Was darf sich NICHT ändern:** Mechanik

**Abnahmekriterium:** Debug-Log zeigt State-Transitions und Clicks klar

---

### 4B – Bugs gezielt reproduzieren

**Bug 1: Antworten nicht anklickbar**

**Hypothesen:**
1. `state.uiState = ANSWERED_LOCKED` nicht zurückgesetzt
2. CSS `.is-locked` bleibt aktiv
3. Overlay über Buttons (`pointer-events: none`)

**Reproduktion:**
1. Start Run
2. Answer Question → Check State (sollte `ANSWERED_LOCKED`)
3. Click "Weiter" → Check State (sollte `IDLE`)
4. Versuche Antwort zu klicken → Wenn nicht klickbar: Log State + DOM

**Fix-Strategie:**
- Wenn State-Problem: Fix Reset-Logic in `loadQuestion()` Z.1420-1480
- Wenn CSS-Problem: Fix `.is-locked`-Klasse-Remove
- Wenn Overlay-Problem: Fix Z-Index oder `pointer-events`

**Was darf sich ändern:** Bug-Fix-Code
**Was darf sich NICHT ändern:** Core-Mechanik (außer wenn Bug dort liegt)

**Abnahmekriterium:** Bug reproduziert + gefixed, Test-Case erstellt

---

**Bug 2: Erklärung überspringt**

**Hypothesen:**
1. Auto-Advance (Z.194 `POST_ANSWER_AUTO_ADVANCE_MS`) zu kurz oder falsch getriggert
2. Doppelter Continue-Click
3. Transition-Lock nicht gesetzt

**Reproduktion:**
1. Answer Question
2. Warte auf Erklärung
3. Log: Wie lange sichtbar? Wann `handleContinueClick()` aufgerufen?

**Fix-Strategie:**
- Wenn Auto-Advance zu früh: Adjust Timeout
- Wenn Doppel-Click: Verstärke `transitionInFlight`-Lock
- Wenn State-Fehler: Fix Transition-Logic Z.2655-2690

**Was darf sich ändern:** Bug-Fix-Code
**Was darf sich NICHT ändern:** Core-Mechanik

**Abnahmekriterium:** Erklärung bleibt sichtbar bis User "Weiter" klickt

---

### 4C – Race-Conditions härten

**Timer vs Manual-Submit (Baseline Z. Race-Conditions):**

**Aktuell:** `timeoutSubmittedForAttemptId` (Z.336) verhindert Doppel-Submit

**Härten:**
- Backend: Idempotenz-Check in `submit_answer()` (Z.860-975)
- Wenn `question_index != run.current_index` → Error

**Test:** Klicke Antwort exakt bei Timer-Ablauf → Sollte nur 1 Answer-Record

**Was darf sich ändern:** Idempotenz-Logic
**Was darf sich NICHT ändern:** Scoring

**Abnahmekriterium:** Kein Doppel-Submit bei Race-Condition

---

### Abhängigkeiten

**Phase 1+2 → Phase 4:** Bugs können sich durch Umbau ändern, daher erst nach Refactoring

**Blocker für:** Phase 5 (Cleanup & Merge)

---

### Abnahmekriterien (Phase 4 gesamt)

✅ Instrumentation läuft (Debug-Log)  
✅ Bug "Antworten nicht anklickbar" reproduziert + gefixed  
✅ Bug "Erklärung überspringt" reproduziert + gefixed  
✅ Race-Conditions getestet, keine Doppel-Submits  
✅ E2E-Tests laufen durch (3× Full-Run)  

---

## Phase 5 – Cleanup & Merge

**Ziel:** Aufräumen, Konsolidierung, Merge-Readiness.

**Risk:** 🟡 Medium – verteilte Änderungen müssen konsistent sein.

### 5A – Cleanup

- Entferne veraltete TODOs/Notizen aus Phase 1–4
- Prüfe Dokumentations-Links (CONTENT/README/OPERATIONS)
- Reduziere Debug-Logging (falls nicht mehr gebraucht)

### 5B – Merge-Check

- Abhängigkeitsmatrix erfüllt
- E2E-Run einmal final
- Refactoring-Dokumente vollständig

### Abhängigkeiten

**Phase 4 → Phase 5:** Stabilität abgeschlossen

### Abnahmekriterien (Phase 5 gesamt)

✅ Cleanup abgeschlossen  
✅ E2E final ok  
✅ Merge freigegeben  

---

## Explizit ausgeschlossene Arbeiten

Diese Dinge sind **bewusst nicht** Teil des Refactorings (können später separat angegangen werden):

❌ **Scoring-Formeln überarbeiten** (außer Level-Bonus-Regel)  
   - Time-Bonus bleibt unverändert
   - Base-Points bleiben 10/20/30

❌ **Joker-Logik erweitern**  
   - Bleibt 50:50, 2× per Run
   - Keine neuen Joker-Typen

❌ **Leaderboard-Sortierung ändern**  
   - Bleibt: score DESC, created_at ASC
   - Keine separaten Leaderboards nach Version

❌ **Question-Selection-Algorithmus refactorn**  
   - Weighted-Random bleibt
   - History-Based bleibt

❌ **Player-Auth-System modernisieren**  
   - Bleibt: Pseudonym + 4-Digit-PIN
   - Keine Integration mit Webapp-Auth

❌ **Database-Schema-Migration (außer Content)**  
   - Keine neuen Felder
   - Keine Indizes ändern

❌ **i18n / Mehrsprachigkeit**  
   - Content bleibt Plaintext (Deutsch)

❌ **Multiplayer-Features**  
   - Runs bleiben single-player

❌ **Progressive Web App (PWA)**  
   - Keine Offline-Fähigkeit

❌ **Performance-Optimierungen (außer nötig)**  
   - Keine Caching-Layer
   - Keine Query-Optimierungen (außer Bugs)

---

## Abhängigkeits-Matrix

| Phase | Braucht abgeschlossen | Blockiert |
|-------|----------------------|-----------|
| 0 | - | - |
| 1 | 0 (optional) | 2, 3b, 4 |
| 2 | 1B (Level-Detection) | - |
| 3a | - | 3b |
| 3b | 3a, 1C (Validator) | 4 |
| 4 | 1, 2, 3b | 5 |
| 5 | 4 | - |

**Kritischer Pfad:** 0 → 1 → 3a → 3b → 4 → 5

**Parallele Pfade:**
- 2 kann während 1C laufen (Timer unabhängig von Content)
- 3a kann parallel zu 1 laufen (nur Rendering + Doku)
- 3b wartet auf 3a + 1C.1 (Validator)

---

## Change-Freeze & Rollout

### Content-Freeze

**Wann:** Nach Phase 1C.2 (Content-Migration)

**Regel:** Keine neuen Questions mit Difficulty >3 authoren

**Duration:** Bis Phase 3b abgeschlossen (Import-Service validiert)

### Code-Freeze

**Wann:** Nach Phase 4 (vor Phase 5)

**Regel:** Nur Bug-Fixes, keine neuen Features

**Duration:** Bis E2E-Tests durch

### Rollout (Production)

**Pre-Rollout:**
1. Backup DB (Players, Runs, Scores)
2. Backup Content-Files (alte Units)
3. Test-Import einer Release (Draft)

**Rollout:**
1. Deploy Code (mit Feature-Flag `MECHANICS_VERSION=v2`)
2. Import neue Release (Draft)
3. Publish Release
4. Verify: Topics sichtbar, Runs starten

**Rollback-Plan:**
- Unpublish neue Release
- Republish alte Release (Legacy-Difficulties)
- Feature-Flag zurück auf `v1` (falls nötig)

---

**Dieser Plan ist komplett. Jede Phase hat klare Abnahmekriterien und Dependencies.**
