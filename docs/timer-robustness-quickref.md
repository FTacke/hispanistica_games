# Timer-Robustness Quick Reference

## Problem (behoben)
Nach Answer wurde Timer erneut gestartet → 400 INVALID_INDEX Loop

## Lösung
**Phase State Machine + AttemptId Guards**

## Neue Konzepte

### 1. Phase Substates
```javascript
PHASE.ANSWERING      // Timer läuft, User kann antworten
PHASE.POST_ANSWER    // Antwort eingereicht, Erklärung sichtbar
```

**Regel:** Timer läuft NUR bei `phase=ANSWERING`

### 2. AttemptId
```javascript
attemptId = `${runId}:${questionIndex}:${questionId}`
```

Verhindert:
- Duplikat-Timer für gleiche Frage
- Stale timeout submits
- Race conditions

### 3. Position Sync
```javascript
// ❌ VORHER: Client berechnet selbst
state.currentIndex = state.currentIndex + 1;

// ✅ JETZT: Server gibt vor
state.currentIndex = answer.nextQuestionIndex;
```

## Critical Guards

```javascript
// startTimerCountdown()
if (state.phase !== PHASE.ANSWERING) return;
if (state.activeTimerAttemptId === attemptId) return;

// handleTimeout()
if (state.phase !== PHASE.ANSWERING) return;
if (state.timeoutSubmittedForAttemptId[attemptId]) return;

// handleAnswerClick()
state.phase = PHASE.POST_ANSWER;  // SOFORT nach Answer
stopTimer();                       // SOFORT
```

## Testing

```powershell
# Smoke Tests
.\scripts\test-timer-robustness.ps1

# Expected: 16/16 PASS
```

## Manual Verification

1. Frage beantworten → Timer stoppt sofort
2. Console logs: Nur EIN "[TIMER] Started" pro Frage
3. Kein "[TIMER GUARD] BLOCKED" nach Answer
4. Keine 400 INVALID_INDEX errors

## Debugging

```javascript
// Console Präfixe:
[TIMER]         Timer lifecycle (start/stop)
[TIMER GUARD]   Blocked operations
[PHASE]         Phase transitions
[INDEX]         Position updates
```

## Wichtigste Änderung

**Timer-Start ist NUR erlaubt bei:**
```javascript
state.currentView === VIEW.QUESTION 
&& 
state.phase === PHASE.ANSWERING
```

Alles andere wird geblockt.
