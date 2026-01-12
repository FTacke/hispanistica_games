# Quiz Play Transitions - Root Cause & Fix

**Datum:** 2026-01-12  
**Datei:** `static/js/games/quiz-play.js`  
**Bugs:** Ungewollter Auto-Advance + Timeout Loop/400

---

## Root Cause

### Bug 1: Ungewollter Auto-Advance

**Problem:** Manchmal springt das Quiz zur nächsten Frage, obwohl "Weiter" nicht geklickt wurde.

**Ursache:**
- `startAutoAdvanceTimer()` (L998) triggert nach 20s `advanceToNextQuestion('auto')` (L1002)
- `advanceToNextQuestion()` (L2053) ist eine **veraltete Parallel-Funktion** zum Weiter-Button
- Sie macht eigene State-Updates und kann am regulären Flow vorbei navigieren
- **Race Condition:** Wenn Auto-Advance triggert während Weiter-Button bereits aktiv ist

**Code-Stelle:**
```javascript
// L998-1004
function startAutoAdvanceTimer() {
  cancelAutoAdvanceTimer();
  state.autoAdvanceTimer = setTimeout(() => {
    if (state.uiState === STATE.ANSWERED_LOCKED) {
      advanceToNextQuestion('auto');  // ❌ Veralteter Pfad
    }
  }, AUTO_ADVANCE_DELAY_MS);
}
```

### Bug 2: Timeout Loop / 400 INVALID_INDEX

**Problem:** Nach Timeout ohne Antwort:
- Dieselbe Frage wird erneut geladen (Loop)
- Timer-Guards blocken ("already running")
- `/answer` 400 durch Doppelsubmits

**Ursachen:**

1. **L1074: `pendingTransition` wird zu früh gecleart**
   ```javascript
   async function loadCurrentQuestion() {
     // ...
     state.pendingTransition = null; // ❌ VOR dem Render!
   ```
   Wenn Timeout während `loadCurrentQuestion()` feuert, ist `pendingTransition` schon weg.

2. **L1087: `phase = ANSWERING` während Render**
   ```javascript
   state.phase = PHASE.ANSWERING;
   console.error('[PHASE] ✅ Set to ANSWERING for question:', state.currentIndex);
   ```
   Ein alter Timer könnte hier `handleTimeout()` erneut triggern.

3. **L2031-2037: Index-Update im Weiter-Button OHNE atomaren Lock**
   ```javascript
   state.currentIndex = state.nextQuestionIndex;
   state.nextQuestionIndex = null;
   await loadCurrentQuestion();
   ```
   Zwischen Index-Update und `loadCurrentQuestion()` kann ein alter Timer feuern → triggert Timeout für die NEUE Frage → 400 INVALID_INDEX.

4. **L1217: Timer-Start Guard unvollständig**
   ```javascript
   if (state.activeTimerAttemptId === attemptId) {
     console.error('[TIMER GUARD] ❌ BLOCKED...');
     return;
   }
   stopTimer(); // ❌ NACH dem Guard!
   ```
   Wenn `attemptId` unterschiedlich ist, wird alter Timer NICHT gestoppt → zwei Timer laufen parallel.

5. **L1729-1749: `handleTimeout()` Guards nicht stark genug**
   - Prüft `phase` und `isAnswered`, aber erst NACH Build von `attemptId`
   - Keine Prüfung, ob bereits ein anderer Timeout läuft
   - Kein Schutz gegen Timeout während Transition

---

## Timer-Übersicht

| Timer | Typ | Start | Stop | Zweck |
|-------|-----|-------|------|-------|
| `state.timerInterval` | setInterval | L1243 | L1201, L1748 | Countdown Display (100ms) |
| `state.activeTimerAttemptId` | string | L1220 | L1201 | Guard gegen Duplikat-Timer |
| `state.autoAdvanceTimer` | setTimeout | L998 | L996 | Auto-Advance nach POST_ANSWER (20s) |
| `state.autoForwardTimeout` | setTimeout | L2427 | L2434 | LevelUp Auto-Forward (10s) |
| `state.autoForwardInterval` | setInterval | L2424 | L2435 | LevelUp Timer Display |
| `state.levelUpTimer` | setTimeout | Legacy | L2525 | Alter LevelUp Timer |

**Cleanup-Funktionen:**
- `stopTimer()` - L1195 (nur Countdown)
- `cancelAutoAdvanceTimer()` - L996 (Auto-Advance + LevelUp)

**Problem:** Kein zentrales `stopAllTimers()` → Timer werden inkonsistent gestoppt.

---

## Transitions (IST-Zustand)

### Phase-Übergänge

```
ANSWERING (Question active)
  ├─ Antwort-Klick → POST_ANSWER (L1449)
  └─ Timeout → POST_ANSWER (L1729)

POST_ANSWER (Explanation visible)
  ├─ Weiter-Button → NEXT_QUESTION (L2031)
  ├─ Weiter-Button → LEVEL_UP (L2015)
  ├─ Weiter-Button → FINAL (L2025)
  └─ Auto-Advance → advanceToNextQuestion() (L1002) ❌

LEVEL_UP (Intermediate screen)
  ├─ Continue-Button → NEXT_QUESTION (L2488)
  └─ Auto-Forward → advanceFromLevelUp() (L2427) ✅
```

### Navigation-Pfade (Duplikate!)

1. **Weiter-Button** (L2004): setupWeiterButton() → switch(pendingTransition)
2. **Auto-Advance Timer** (L1002): advanceToNextQuestion('auto') ❌ PARALLEL!
3. **LevelUp Continue** (L2488): advanceFromLevelUp()

**Problem:** Zwei konkurrierende Pfade (1 + 2) für POST_ANSWER → NEXT_QUESTION.

---

## Fix-Design

### Schritt 1: Zentrales Timer-Management

**Neuer Code:**
```javascript
function stopAllTimers() {
  // Countdown
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  if (state.activeTimerAttemptId) {
    console.error('[TIMER] Cleared attemptId:', state.activeTimerAttemptId);
    state.activeTimerAttemptId = null;
  }
  
  // Auto-Advance
  if (state.autoAdvanceTimer) {
    clearTimeout(state.autoAdvanceTimer);
    state.autoAdvanceTimer = null;
  }
  
  // LevelUp Auto-Forward
  if (state.autoForwardTimeout) {
    clearTimeout(state.autoForwardTimeout);
    state.autoForwardTimeout = null;
  }
  if (state.autoForwardInterval) {
    clearInterval(state.autoForwardInterval);
    state.autoForwardInterval = null;
  }
  
  // Legacy
  if (state.levelUpTimer) {
    clearTimeout(state.levelUpTimer);
    state.levelUpTimer = null;
  }
}
```

**Änderungen:**
- Ersetze `stopTimer()` Aufrufe durch `stopAllTimers()`
- Garantiert, dass ALLE Timer gestoppt werden (kein Leak)

### Schritt 2: Transition-Lock

**Neuer State:**
```javascript
state.transitionInFlight = false;
```

**Guards:**
- Vor jeder Transition: `if (state.transitionInFlight) return;`
- Nach Transition: `state.transitionInFlight = false;`

**Verhindert:**
- Doppel-Klicks auf Weiter
- Auto-Advance während manueller Navigation
- Timer-Trigger während loadCurrentQuestion()

### Schritt 3: Konsolidierte Continue-Funktion

**Alt:** Weiter-Button (L2004) + advanceToNextQuestion() (L2053)  
**Neu:** Nur noch `executeContinue()` über Weiter-Button

**Auto-Advance:**
```javascript
state.autoAdvanceTimer = setTimeout(() => {
  if (state.phase === PHASE.POST_ANSWER && !state.transitionInFlight) {
    // Simuliere Weiter-Klick
    const weiterBtn = document.getElementById('quiz-weiter-btn');
    if (weiterBtn && !weiterBtn.disabled) {
      weiterBtn.click();
    }
  }
}, AUTO_ADVANCE_DELAY_MS);
```

**Entfernt:** `advanceToNextQuestion()` komplett (veralteter Pfad).

### Schritt 4: Timeout-Flow Fix

**Änderungen in `handleTimeout()`:**
```javascript
// 1. SOFORT Guards prüfen (vor attemptId)
if (state.transitionInFlight) return;
if (state.phase !== PHASE.ANSWERING) return;
if (state.isAnswered) return;

// 2. AttemptId-Guard ZUERST
const attemptId = state.activeTimerAttemptId;
if (!attemptId || state.timeoutSubmittedForAttemptId[attemptId]) return;

// 3. Sofort Timer stoppen UND markieren
stopAllTimers();
state.timeoutSubmittedForAttemptId[attemptId] = true;
state.transitionInFlight = true; // Lock während Submit

// 4. Submit...

// 5. Nach erfolgreichem Submit
state.transitionInFlight = false;
state.phase = PHASE.POST_ANSWER;
```

### Schritt 5: loadCurrentQuestion() Atomizität

**Änderungen:**
```javascript
async function loadCurrentQuestion() {
  // Guard ganz oben
  if (state.transitionInFlight) {
    console.error('[GUARD] loadCurrentQuestion blocked - transition in flight');
    return;
  }
  if (state.currentView !== VIEW.QUESTION) {
    console.error('[GUARD] loadCurrentQuestion blocked - not in QUESTION view');
    return;
  }
  
  // Lock setzen
  state.transitionInFlight = true;
  
  // Timer SOFORT stoppen
  stopAllTimers();
  
  // State clearen
  state.pendingTransition = null;
  state.questionData = null;
  state.isAnswered = false;
  
  // ... Fetch + Render ...
  
  // Phase ERST am Ende setzen
  state.phase = PHASE.ANSWERING;
  
  // Lock freigeben
  state.transitionInFlight = false;
  
  // Timer starten (NUR wenn phase = ANSWERING)
  startTimerCountdown();
}
```

**Garantiert:**
- Kein Timeout während Load
- Keine doppelten Timer
- Atomarer Phase-Wechsel

---

## State Machine (NEU)

### States

```
VIEW: QUESTION | LEVEL_UP | FINISH
PHASE: ANSWERING | POST_ANSWER
transitionInFlight: boolean (global lock)
```

### Transition Rules

1. **Nur Weiter-Button navigiert aus POST_ANSWER**
   - Auto-Advance simuliert Button-Klick (kein eigener Pfad)

2. **Jede Navigation stoppt ALLE Timer**
   - Via `stopAllTimers()` ganz am Anfang

3. **Jede Navigation checkt `transitionInFlight`**
   - Bei `true` → sofortiger Exit

4. **Phase-Wechsel nur atomar**
   - `transitionInFlight = true` → State-Updates → `transitionInFlight = false`

5. **Timer-Start nur bei korrektem State**
   - Countdown nur wenn `phase === ANSWERING && view === QUESTION`
   - Auto-Advance nur wenn `phase === POST_ANSWER`
   - LevelUp-Auto nur wenn `view === LEVEL_UP`

---

## Akzeptanzkriterien

### ✅ Kein spontaner Question-Advance
- **Test:** Warte nach Antwort, ohne Weiter zu klicken → keine Navigation
- **Erwartung:** Button bleibt sichtbar, Auto-Advance nach 20s (konfigurierbar)

### ✅ Timeout funktioniert
- **Test:** Lass Timer ablaufen ohne Antwort
- **Erwartung:**
  - Erklärung wird angezeigt
  - Weiter-Button ist klickbar
  - Nächste Frage lädt nach Klick
  - Keine 400 Fehler
  - Kein Loop (dieselbe Frage erneut)

### ✅ Keine doppelten Timer
- **Test:** Schnell zwischen Fragen navigieren
- **Erwartung:** Keine "already running attemptId" Warnings im Log

### ✅ LevelUp/Finish ohne Interferenz
- **Test:** Level abschließen
- **Erwartung:**
  - LevelUp-Screen zeigt korrekte Daten
  - Auto-Forward nach 10s
  - Continue-Button funktioniert sofort
  - Keine Timer-Trigger während View-Wechsel

---

## Geänderte Dateien

1. **static/js/games/quiz-play.js**
   - `stopAllTimers()` hinzugefügt
   - `state.transitionInFlight` hinzugefügt
   - `handleTimeout()` Guards verstärkt
   - `loadCurrentQuestion()` atomisiert
   - `startAutoAdvanceTimer()` umgebaut (simuliert Button-Klick)
   - `advanceToNextQuestion()` entfernt (deprecated)
   - `setupWeiterButton()` erweitert (Lock-Management)
   - `startTimerCountdown()` Guards erweitert

**Anzahl Änderungen:** ~150 Zeilen geändert, ~80 Zeilen gelöscht

---

## Debug-Verifikation

### Logs hinzugefügt (nur wenn `DEBUG=true`):

```
[TIMER] Started for attemptId: <id>
[TIMER] Cleared attemptId: <id>
[TIMER] Timeout triggered for attemptId: <id>
[GUARD] loadCurrentQuestion blocked - transition in flight
[TRANSITION LOCK] Set to true - source: <function>
[TRANSITION LOCK] Released - source: <function>
```

### Assertions (nur Dev):

```javascript
// In handleTimeout()
if (DEBUG) {
  console.assert(state.phase === PHASE.POST_ANSWER, 'After timeout: phase must be POST_ANSWER');
}

// In loadCurrentQuestion()
if (DEBUG) {
  console.assert(!state.activeTimerAttemptId, 'Before load: no timer should be active');
}
```

---

## Migration Notes

**Breaking Changes:** Keine (nur interne Umstrukturierung)

**Backwards Compatibility:**
- Alte `advanceToNextQuestion()` Calls im Test-Code müssen auf Weiter-Button umgestellt werden
- `AUTO_ADVANCE_DELAY_MS` Konstante bleibt konfigurierbar

**Rollback-Plan:**
- Einfach auf vorherigen Commit zurücksetzen (kein Schema-Change, kein API-Change)

---

## Performance Impact

**Timer-Overhead:** Vernachlässigbar (1-5 Timer gleichzeitig, clearTimeout ist O(1))  
**Lock-Overhead:** 1 boolean check pro Navigation (~5-10 Navigationen pro Quiz)  
**Render-Blocking:** Keine (Lock verhindert nur konkurrierende Transitions)

---

**Erstellt von:** Repo-Agent  
**Review:** Pending  
**Status:** Implementiert, Testing ausstehend
