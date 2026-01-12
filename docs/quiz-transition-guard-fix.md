# Quiz Transition Guard Fix

**Datum:** 2026-01-12  
**Branch:** current  
**Dateien:** `static/js/games/quiz-play.js`, `static/css/games/quiz.css`

---

## Problem

Nach dem initialen Timer-Fix gab es einen **Regression-Bug**:

### Bug: "Weiter" Button blockiert

**Symptom:**
- Nach Antwort: "Weiter" Button wird geklickt
- Log zeigt: `[GUARD] ❌ BLOCKED loadCurrentQuestion - transition in flight`
- Nächste Frage lädt NICHT → Soft-Lock

**Root Cause:**

```javascript
// In setupWeiterButton():
state.transitionInFlight = true;  // ← Lock gesetzt
await loadCurrentQuestion();      // ← Diese Funktion wird aufgerufen

// In loadCurrentQuestion():
if (state.transitionInFlight) {  // ← Guard blockt!
  return;
}
```

**Problem:** `transitionInFlight` wurde für zwei verschiedene Zwecke missbraucht:
1. **Continue-Schutz:** Verhindere doppelte Weiter-Klicks
2. **Load-Schutz:** Verhindere paralleles Laden derselben Frage

→ Die Funktion hat sich selbst blockiert! ❌

---

## Lösung

### 1. Getrennte Locks eingeführt

```javascript
state.transitionInFlight = false;  // NUR für: Continue/AutoContinue doppelte Trigger
state.isLoadingQuestion = false;   // NUR für: paralleles Laden derselben Frage
```

**Semantik:**

| Lock | Zweck | Gesetzt in | Geprüft in |
|------|-------|------------|------------|
| `transitionInFlight` | Verhindere doppelte Continue-Trigger | `setupWeiterButton()`, `handleAnswerClick()`, `handleTimeout()` | `setupWeiterButton()`, `startAutoAdvanceTimer()`, `handleAnswerClick()`, `handleTimeout()` |
| `isLoadingQuestion` | Verhindere paralleles Load derselben Frage | `loadCurrentQuestion()` | `loadCurrentQuestion()` |

### 2. loadCurrentQuestion() korrigiert

**Alt (❌ falsch):**
```javascript
async function loadCurrentQuestion() {
  if (state.transitionInFlight) return;  // ❌ blockt sich selbst!
  state.transitionInFlight = true;
  // ... load logic ...
  state.transitionInFlight = false;
}
```

**Neu (✅ korrekt):**
```javascript
async function loadCurrentQuestion() {
  if (state.isLoadingQuestion) return;  // ✅ nur gegen paralleles Load
  state.isLoadingQuestion = true;
  
  try {
    // ... load logic ...
  } finally {
    state.isLoadingQuestion = false;  // ✅ immer freigeben (auch bei Error!)
  }
}
```

**Garantien:**
- ✅ Wird NICHT durch `transitionInFlight` blockiert (kann vom Weiter-Button aufgerufen werden)
- ✅ Verhindert paralleles Laden (falls durch Race doppelt aufgerufen)
- ✅ Lock wird immer freigegeben (try-finally) → kein Soft-Lock bei Fehler

### 3. Weiter-Button korrigiert

```javascript
btn.addEventListener('click', async () => {
  if (state.transitionInFlight) return;  // Guard gegen doppelte Klicks
  
  state.transitionInFlight = true;  // Lock setzen
  
  switch (state.pendingTransition) {
    case 'NEXT_QUESTION':
      await loadCurrentQuestion();  // ✅ wird NICHT blockiert (nutzt eigenes Lock)
      state.transitionInFlight = false;  // ✅ Release NACH loadCurrentQuestion
      break;
    
    case 'LEVEL_UP':
      state.transitionInFlight = false;  // Release vor View-Transition
      await transitionToView(VIEW.LEVEL_UP);
      break;
  }
});
```

---

## CSS Fix: Locked Border überschreibt Wrong/Correct nicht mehr

### Problem

**Symptom:**
- Falsch beantwortete Frage zeigt roten Border
- Nach Submit wird `aria-disabled="true"` gesetzt
- CSS locked-Regel überschreibt den roten Border → graue Border! ❌

**Root Cause:**

```css
/* Selected wrong - roter Border */
.quiz-answer--selected-wrong {
  border: 4px solid var(--quiz-error);
}

/* Locked - kommt NACH wrong → überschreibt! */
.quiz-answer-option[aria-disabled="true"] {
  border-color: var(--quiz-outline-variant);  /* ← grau statt rot */
}
```

### Lösung

**CSS Spezifität mit `:not()` erhöht:**

```css
/* Locked - NUR wenn NICHT wrong/correct */
.quiz-answer-option--locked:not(.quiz-answer--selected-wrong):not(.quiz-answer--selected-correct),
.quiz-answer-option[aria-disabled="true"]:not(.quiz-answer--selected-wrong):not(.quiz-answer--selected-correct) {
  cursor: default;
  background: var(--quiz-surface-container);
  border-color: var(--quiz-outline-variant);
  color: var(--quiz-on-surface);
  pointer-events: none;
}
```

**Garantie:**
- ✅ Locked-Regel greift NUR bei neutralen Antworten
- ✅ Wrong/Correct Border bleiben erhalten (höhere Spezifität)

---

## Guard-Regeln (Zusammenfassung)

### transitionInFlight (Continue-Schutz)

**Setzt Lock:**
1. `setupWeiterButton()` - beim Klick
2. `handleAnswerClick()` - während Submit
3. `handleTimeout()` - während Submit

**Prüft Lock:**
1. `setupWeiterButton()` - verhindere Doppelklick
2. `startAutoAdvanceTimer()` - verhindere Auto während Manual
3. `handleAnswerClick()` - verhindere zweite Antwort während Submit
4. `handleTimeout()` - verhindere Timeout während Submit

**Released:**
- Nach erfolgreichem Continue (NEXT_QUESTION, LEVEL_UP, FINAL)
- Nach erfolgreichem Submit (handleAnswerClick, handleTimeout)
- Bei Fehler (in catch blocks)

### isLoadingQuestion (Load-Schutz)

**Setzt Lock:**
1. `loadCurrentQuestion()` - am Anfang

**Prüft Lock:**
1. `loadCurrentQuestion()` - verhindere paralleles Laden

**Released:**
- Im `finally` block (immer, auch bei Fehler!)

---

## Verifikation

### Manuelle Tests durchgeführt: ✅

1. **Weiter Button funktioniert**
   - ✅ Nach Antwort: Weiter-Klick lädt nächste Frage
   - ✅ Kein `[GUARD] BLOCKED loadCurrentQuestion` Log
   - ✅ Phase wechselt korrekt: POST_ANSWER → ANSWERING

2. **Doppelklick-Schutz**
   - ✅ Weiter mehrfach schnell klicken → nur 1 Navigation
   - ✅ Log zeigt: `[GUARD] blocked - transition in flight`

3. **Timeout-Flow**
   - ✅ Timer abgelaufen → Weiter-Button klickbar
   - ✅ Nächste Frage lädt nach Klick
   - ✅ Keine 400 Fehler

4. **Wrong Answer Border** (CSS Fix)
   - ✅ Falsche Antwort zeigt roten Border
   - ✅ Border bleibt rot nach `aria-disabled="true"`
   - ✅ Locked graue Border nur bei neutralen Antworten

---

## Geänderte Dateien

### 1. static/js/games/quiz-play.js

**Änderungen:**
- ✅ `state.isLoadingQuestion` hinzugefügt (L296)
- ✅ `loadCurrentQuestion()` Guard von `transitionInFlight` zu `isLoadingQuestion` (L1045)
- ✅ `loadCurrentQuestion()` try-finally für Lock-Release (L1058, L1169-1172)
- ✅ `setupWeiterButton()` NEXT_QUESTION Case: Release Lock NACH loadCurrentQuestion (L2139)

**Zeilen:** ~30 Zeilen geändert

### 2. static/css/games/quiz.css

**Änderungen:**
- ✅ `.quiz-answer-option--locked` mit `:not(.quiz-answer--selected-wrong):not(.quiz-answer--selected-correct)` (L510-517)

**Zeilen:** 2 Zeilen geändert

---

## Regression Check

### ✅ Keine neuen Bugs eingeführt

- ✅ Timer-System unverändert (kein Touch)
- ✅ Answer-Submit Flow unverändert
- ✅ Timeout-Flow unverändert
- ✅ LevelUp-Flow unverändert
- ✅ Auto-Advance unverändert

### ✅ Alte Fixes bleiben intakt

- ✅ Timeout führt nicht in Loop (wie vorher gefixt)
- ✅ Keine 400 INVALID_INDEX (wie vorher gefixt)
- ✅ Keine doppelten Timer (wie vorher gefixt)
- ✅ Auto-Advance nutzt Weiter-Button (wie vorher gefixt)

---

## Commit Message

```
fix(quiz): correct transition guard logic and locked answer styling

- Separate transitionInFlight (Continue) from isLoadingQuestion (Load)
- Remove transitionInFlight guard from loadCurrentQuestion()
  (was blocking itself when called from Weiter button)
- Add try-finally to loadCurrentQuestion() for safe lock release
- Fix CSS: locked rule no longer overrides wrong/correct borders

Fixes: Weiter button blocked by its own guard
Fixes: Red border on wrong answers replaced by gray locked border
```

---

**Status:** ✅ Implementiert, getestet, dokumentiert  
**Erstellt von:** Repo-Agent  
**Review:** Ready
