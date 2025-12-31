# Level-Up & Score System - Technische Analyse

## 🎯 Übersicht

Dieses Dokument beschreibt präzise, wie das Level-Up System und Score-Management im Quiz funktioniert, aufgeteilt in Backend und Frontend.

---

## 📊 Architektur

```
Backend (Python/Flask)          Frontend (JavaScript)
─────────────────────          ──────────────────────
quiz_routes.py                 quiz-play.js
  └─ /answer Endpoint            └─ handleAnswerClick()
     ├─ Score berechnen             ├─ POST /answer
     ├─ Level prüfen                ├─ Response auswerten
     ├─ Bonus vergeben              ├─ state.pendingLevelUp setzen
     └─ Response zurück             └─ advanceCallback setzen

  └─ /status Endpoint            └─ restoreRunningScore()
     ├─ running_score laden         ├─ GET /status
     └─ current_index               └─ state.runningScore setzen
```

---

## 🔧 Backend: Score & Level-Up Logik

### Endpunkt: `POST /api/quiz/run/<run_id>/answer`

**Location:** `src/app/game_modules/quiz/quiz_routes.py`

**Wichtige Response-Felder:**
```python
{
    "result": "correct" | "wrong" | "timeout",
    "earned_points": int,          # Punkte für diese Antwort
    "running_score": int,          # WICHTIG: Kumulativer Score
    "level_completed": bool,       # Level fertig?
    "level_perfect": bool,         # Alle richtig?
    "level_bonus": int,            # Bonus-Punkte (nur wenn perfect)
    "difficulty": int,             # Aktuelles Level (1-5)
    "next_question_index": int,
    "finished": bool
}
```

**Kritische Logik:**
```python
# Nach Antwort-Auswertung
if level_completed and level_perfect:
    level_bonus = calculate_level_bonus(difficulty)
    running_score += level_bonus
    response["level_bonus"] = level_bonus
else:
    response["level_bonus"] = 0

response["running_score"] = running_score  # IMMER im Response!
```

### Endpunkt: `GET /api/quiz/run/<run_id>/status`

**Response:**
```python
{
    "run_id": str,
    "current_index": int,
    "running_score": int,      # WICHTIG für Refresh
    "is_finished": bool
}
```

---

## 🎨 Frontend: State Management

### State-Struktur (quiz-play.js)

```javascript
let state = {
    // Run-Daten
    runId: null,
    currentIndex: 0,
    runQuestions: [],
    
    // Score (SOURCE OF TRUTH vom Backend!)
    runningScore: 0,           // Backend-Wert
    displayedScore: 0,         // UI-Wert (für Animation)
    
    // Level-Up
    pendingLevelUp: false,     // Flag: Muss Level-Up gezeigt werden?
    pendingLevelUpData: null,  // { difficulty, level_bonus, next_level }
    
    // View Management
    currentView: VIEW.QUESTION,  // 'question' | 'level_up' | 'finish'
    
    // Navigation
    advanceCallback: null,     // Funktion für nächsten Schritt
};
```

---

## 🔄 Flow 1: Score nach Refresh

### Problem-Symptom
> Score zeigt nach Refresh 0 an, obwohl Server korrekten Wert hat

### Aktueller Code: `restoreRunningScore()`

**Location:** `static/js/games/quiz-play.js:150-176`

```javascript
async function restoreRunningScore() {
    try {
        const response = await fetch(`${API_BASE}/run/${state.runId}/status`);
        if (!response.ok) {
            console.warn('Failed to restore score, using 0');
            state.runningScore = 0;
            state.displayedScore = 0;
            updateScoreDisplay();
            return;
        }
        
        const data = await response.json();
        state.runningScore = data.running_score || 0;
        state.displayedScore = state.runningScore;
        updateScoreDisplay();
    } catch (error) {
        console.error('Failed to restore score:', error);
        state.runningScore = 0;
        state.displayedScore = 0;
        updateScoreDisplay();
    }
}
```

### Debug-Checklist für Score-Problem

1. **Backend prüfen:**
   ```powershell
   # Im Browser Console während Quiz läuft:
   fetch('/api/quiz/run/<RUN_ID>/status')
     .then(r => r.json())
     .then(d => console.log('Backend Score:', d.running_score));
   ```

2. **Frontend State prüfen:**
   ```javascript
   // In Browser Console:
   console.log('Frontend state.runningScore:', state.runningScore);
   console.log('DOM Score:', document.getElementById('quiz-score-display').textContent);
   ```

3. **Timing prüfen:**
   - Wird `restoreRunningScore()` VOR `loadCurrentQuestion()` aufgerufen? ✅
   - Wird `updateScoreDisplay()` nach dem Restore aufgerufen? ✅

4. **HTML-Element prüfen:**
   ```html
   <!-- In templates/games/quiz/play.html -->
   <span class="quiz-score-chip__value" id="quiz-score-display">0</span>
   ```

### Mögliche Ursachen

| Ursache | Symptom | Fix |
|---------|---------|-----|
| **Backend gibt falschen Score** | `/status` Response zeigt 0 | Backend-Bug in `quiz_routes.py` |
| **Fetch schlägt fehl** | Console Error sichtbar | Network-Tab prüfen |
| **DOM-Update verloren** | State korrekt, DOM zeigt 0 | `updateScoreDisplay()` wird überschrieben |
| **Timing-Problem** | Score kurz korrekt, dann 0 | Anderer Code setzt DOM zurück |

---

## 🎉 Flow 2: Level-Up Screen

### Problem-Symptom
> Level-Up Screen wird nicht angezeigt, obwohl Level perfekt gelöst

### Kritischer Ablauf

```
1. User beantwortet letzte Frage eines Levels korrekt
   ↓
2. handleAnswerClick() → POST /api/quiz/run/<id>/answer
   ↓
3. Backend prüft: level_completed=true, level_perfect=true
   ↓
4. Backend Response:
   {
     "level_completed": true,
     "level_perfect": true,
     "level_bonus": 50,
     "difficulty": 2,
     ...
   }
   ↓
5. Frontend: handleAnswerClick() wertet Response aus
   ↓
6. Wenn level_perfect && level_bonus > 0:
   state.pendingLevelUp = true
   state.pendingLevelUpData = { difficulty, level_bonus, next_level }
   state.advanceCallback = () => showLevelUpScreen()
   ↓
7. User klickt "Weiter"
   ↓
8. advanceToNextQuestion() ruft state.advanceCallback() auf
   ↓
9. showLevelUpScreen() wird ausgeführt
   ↓
10. state.currentView = VIEW.LEVEL_UP
    renderCurrentView() → renderLevelUpInContainer()
```

### Code-Snippets: Level-Up Logik

#### 1. handleAnswerClick() - Response-Verarbeitung

**Location:** `static/js/games/quiz-play.js:750-850` (ca.)

```javascript
async function handleAnswerClick(answerId) {
    // ... [Answer submission code] ...
    
    const data = await response.json();
    state.lastAnswerResult = data;
    
    // ... [Score update] ...
    
    // Determine what to do next - prepare but don't navigate yet
    if (data.finished) {
        state.advanceCallback = () => finishRun();
        state.pendingLevelUp = false;
    } else {
        state.currentIndex = data.next_question_index;
        state.questionStartedAtMs = null;
        state.deadlineAtMs = null;
        
        // KRITISCH: Check if we should show Level-Up screen
        if (data.level_completed && data.level_perfect && data.level_bonus > 0) {
            state.pendingLevelUp = true;
            state.pendingLevelUpData = {
                difficulty: data.difficulty,
                level_bonus: data.level_bonus,
                next_level: data.difficulty + 1
            };
            state.advanceCallback = () => showLevelUpScreen();  // ← WICHTIG!
        } else {
            state.pendingLevelUp = false;
            state.advanceCallback = () => loadCurrentQuestion();
        }
    }
}
```

#### 2. advanceToNextQuestion() - Navigation

**Location:** `static/js/games/quiz-play.js:1016-1047`

```javascript
function advanceToNextQuestion() {
    if (state.uiState !== STATE.ANSWERED_LOCKED) return;
    
    cancelAutoAdvanceTimer();
    setUIState(STATE.TRANSITIONING);
    
    const wrapper = document.getElementById('quiz-question-wrapper');
    
    if (wrapper) {
        // Start leaving animation
        wrapper.setAttribute('data-transition-state', 'leaving');
        
        // After leaving animation completes, load next and enter
        setTimeout(() => {
            wrapper.setAttribute('data-transition-state', 'entering');
            
            if (state.advanceCallback) {
                const callback = state.advanceCallback;
                state.advanceCallback = null;
                callback();  // ← Ruft showLevelUpScreen() oder loadCurrentQuestion()
            }
        }, TRANSITION_DURATION_MS);  // 600ms
    }
}
```

#### 3. showLevelUpScreen() - View-Switch

**Location:** `static/js/games/quiz-play.js:1199-1215`

```javascript
async function showLevelUpScreen() {
    if (!state.pendingLevelUpData) {
        // No level-up data, go directly to next question
        await loadCurrentQuestion();
        return;
    }
    
    // Switch to LEVEL_UP view (this renders the level-up screen)
    state.currentView = VIEW.LEVEL_UP;
    renderCurrentView();  // ← Zeigt Level-Up an
    
    // Auto-advance after delay
    state.levelUpTimer = setTimeout(() => {
        advanceFromLevelUp();
    }, LEVEL_UP_AUTO_ADVANCE_MS);  // 1500ms
}
```

#### 4. renderCurrentView() - View-Management

**Location:** `static/js/games/quiz-play.js:189-226`

```javascript
function renderCurrentView() {
    const questionContainer = document.getElementById('quiz-question-container');
    const headerEl = document.getElementById('quiz-header');
    
    if (!questionContainer) return;
    
    // Show/hide header based on view
    if (headerEl) {
        headerEl.hidden = (state.currentView !== VIEW.QUESTION);
    }
    
    // Show current view by replacing container content
    switch (state.currentView) {
        case VIEW.QUESTION:
            // Question view is always rendered via renderQuestion()
            questionContainer.hidden = false;
            break;
            
        case VIEW.LEVEL_UP:
            // Replace container with level-up screen
            questionContainer.hidden = false;
            renderLevelUpInContainer();  // ← KRITISCH!
            break;
            
        case VIEW.FINISH:
            // Replace container with finish screen
            questionContainer.hidden = false;
            renderFinishInContainer();
            break;
    }
    
    // Update page title
    setPageTitle(state.currentView);
}
```

#### 5. renderLevelUpInContainer() - HTML-Rendering

**Location:** `static/js/games/quiz-play.js:1147-1197`

```javascript
function renderLevelUpInContainer() {
    const container = document.getElementById('quiz-question-container');
    if (!container || !state.pendingLevelUpData) return;
    
    const { difficulty, level_bonus, next_level } = state.pendingLevelUpData;
    
    // Replace container content with level-up screen
    container.innerHTML = `
      <div class="quiz-level-up" id="quiz-level-up-stage">
        <div class="quiz-level-up__card">
          <span class="quiz-level-up__overline">Stufe ${difficulty} abgeschlossen</span>
          <h2 class="quiz-level-up__title">
            <span class="quiz-level-up__emoji">🎉</span>
            <span>Level geschafft!</span>
          </h2>
          <p class="quiz-level-up__achievement">
            <span class="material-symbols-rounded">check_circle</span>
            <span>Perfekt gelöst!</span>
          </p>
          <div class="quiz-level-up__bonus">
            <span class="quiz-level-up__bonus-label">Bonuspunkte</span>
            <span class="quiz-level-up__bonus-value" id="quiz-level-up-bonus-dynamic">+0</span>
          </div>
          <p class="quiz-level-up__next">Nächste Stufe: ${next_level}</p>
        </div>
      </div>
    `;
    
    // Animate bonus count-up
    const bonusValueEl = document.getElementById('quiz-level-up-bonus-dynamic');
    if (bonusValueEl && level_bonus > 0) {
        setTimeout(() => {
            animateCountUp(bonusValueEl, level_bonus, 600, '+');
        }, 300);
    }
    
    // Click to skip
    const levelUpStage = document.getElementById('quiz-level-up-stage');
    if (levelUpStage) {
        levelUpStage.addEventListener('click', handleLevelUpClick, { once: true });
    }
}
```

---

## 🐛 Debug-Anleitung: Level-Up Screen fehlt

### Schritt 1: Backend prüfen

Öffnen Sie Browser DevTools Console **während** des Quiz:

```javascript
// Nach letzter Frage eines Levels:
// Netzwerk-Tab prüfen → POST /api/quiz/run/.../answer
// Response sollte enthalten:
{
  "level_completed": true,
  "level_perfect": true,
  "level_bonus": 50  // MUSS > 0 sein!
}
```

### Schritt 2: Frontend State prüfen

```javascript
// SOFORT nach Antwort (vor "Weiter" klick):
console.log('pendingLevelUp:', state.pendingLevelUp);  // sollte true sein
console.log('pendingLevelUpData:', state.pendingLevelUpData);
console.log('advanceCallback:', state.advanceCallback);  // sollte showLevelUpScreen sein
```

### Schritt 3: Callback-Ausführung prüfen

```javascript
// Nach "Weiter" klick:
console.log('advanceToNextQuestion called');
console.log('Will call:', state.advanceCallback);
// Dann im showLevelUpScreen():
console.log('showLevelUpScreen called');
console.log('currentView:', state.currentView);  // sollte 'level_up' sein
```

### Schritt 4: DOM-Rendering prüfen

```javascript
// Nach renderCurrentView():
const container = document.getElementById('quiz-question-container');
console.log('Container innerHTML:', container.innerHTML.substring(0, 200));
// Sollte '<div class="quiz-level-up"' enthalten!

const levelUpEl = document.getElementById('quiz-level-up-stage');
console.log('Level-Up Element:', levelUpEl);  // sollte nicht null sein
```

---

## 🔍 Häufige Probleme & Lösungen

### Problem 1: Backend gibt `level_bonus: 0`

**Symptom:** Response enthält `level_completed: true, level_perfect: true` aber `level_bonus: 0`

**Ursache:** Backend-Logik berechnet keinen Bonus

**Check:**
```python
# In quiz_routes.py
if level_completed and level_perfect:
    level_bonus = calculate_level_bonus(difficulty)  # ← Prüfen!
```

### Problem 2: `state.pendingLevelUp` bleibt `false`

**Symptom:** Trotz korrekter Backend-Response wird `pendingLevelUp` nicht gesetzt

**Ursache:** Bedingung in `handleAnswerClick()` nicht erfüllt

**Check:**
```javascript
// Zeile ~820 in quiz-play.js
if (data.level_completed && data.level_perfect && data.level_bonus > 0) {
    // Wird dieser Block erreicht?
    console.log('✅ Setting pendingLevelUp');
    state.pendingLevelUp = true;
}
```

### Problem 3: `advanceCallback` wird nicht aufgerufen

**Symptom:** `showLevelUpScreen()` wird nie ausgeführt

**Ursache:** `advanceToNextQuestion()` ruft Callback nicht auf

**Check:**
```javascript
// Zeile ~1038 in quiz-play.js
if (state.advanceCallback) {
    console.log('✅ Calling advanceCallback');
    const callback = state.advanceCallback;
    state.advanceCallback = null;
    callback();  // ← Wird das ausgeführt?
}
```

### Problem 4: `renderLevelUpInContainer()` ändert DOM nicht

**Symptom:** Funktion wird aufgerufen, aber kein Level-Up sichtbar

**Ursache 1:** Container nicht gefunden
```javascript
const container = document.getElementById('quiz-question-container');
console.log('Container found:', container !== null);
```

**Ursache 2:** `state.pendingLevelUpData` ist null
```javascript
console.log('Level-Up Data:', state.pendingLevelUpData);
// Muss { difficulty, level_bonus, next_level } enthalten!
```

---

## 📝 Vollständiger Test-Flow

### Manueller Test für Level-Up

1. **Vorbereitung:**
   - Browser DevTools öffnen (F12)
   - Console-Tab aktiv
   - Quiz starten

2. **Während Quiz:**
   ```javascript
   // Im Console:
   // Log jeden Schritt:
   window.DEBUG_LEVEL_UP = true;
   ```

3. **Level perfekt lösen:**
   - Erste 2 Fragen (Difficulty 1) beide korrekt beantworten
   
4. **Nach zweiter Antwort:**
   ```javascript
   // Prüfen:
   console.log('State:', {
       pendingLevelUp: state.pendingLevelUp,
       levelUpData: state.pendingLevelUpData,
       callback: state.advanceCallback?.name
   });
   ```

5. **"Weiter" klicken:**
   - Level-Up Screen sollte erscheinen!
   - Falls nicht: Console nach Errors durchsuchen

---

## 🔧 Quick-Fix Debugging

Fügen Sie temporär folgende Logs ein:

```javascript
// In handleAnswerClick() nach Response:
console.log('🎯 Answer Response:', {
    level_completed: data.level_completed,
    level_perfect: data.level_perfect,
    level_bonus: data.level_bonus,
    will_show_levelup: data.level_completed && data.level_perfect && data.level_bonus > 0
});

// In advanceToNextQuestion():
console.log('🚀 Advance called, callback:', state.advanceCallback?.name || 'none');

// In showLevelUpScreen():
console.log('🎉 Level-Up Screen!', state.pendingLevelUpData);

// In renderCurrentView():
console.log('🖼️ Render View:', state.currentView);
```

---

## 📊 Erwartete Werte (Normal-Flow)

### Szenario: Level 1 perfekt gelöst (2 Fragen richtig)

**Backend Response (Frage 2):**
```json
{
    "result": "correct",
    "earned_points": 10,
    "running_score": 70,
    "level_completed": true,
    "level_perfect": true,
    "level_bonus": 50,
    "difficulty": 1,
    "next_question_index": 2
}
```

**Frontend State nach Response:**
```javascript
{
    runningScore: 70,
    pendingLevelUp: true,
    pendingLevelUpData: {
        difficulty: 1,
        level_bonus: 50,
        next_level: 2
    },
    advanceCallback: [Function: showLevelUpScreen]
}
```

**DOM nach "Weiter" + 600ms Transition:**
```html
<main class="quiz-question-container">
  <div class="quiz-level-up" id="quiz-level-up-stage">
    <div class="quiz-level-up__card">
      <span class="quiz-level-up__overline">Stufe 1 abgeschlossen</span>
      <!-- ... Rest of Level-Up UI ... -->
      <span id="quiz-level-up-bonus-dynamic">+50</span>
    </div>
  </div>
</main>
```

---

## 🎯 Nächste Schritte

1. **Backend-Response validieren**
   - Prüfen Sie `/answer` Response im Network-Tab
   - Stellen Sie sicher, dass `level_bonus > 0` bei perfektem Level

2. **Frontend State tracken**
   - Fügen Sie die Debug-Logs oben ein
   - Folgen Sie dem Flow Schritt für Schritt

3. **DOM-Update verifizieren**
   - Prüfen Sie, ob `renderLevelUpInContainer()` aufgerufen wird
   - Inspizieren Sie `#quiz-question-container` im Elements-Tab

4. **Falls Level-Up funktioniert:**
   - Prüfen Sie Score-Update in `showLevelUpScreen()`
   - Bonus sollte zu `running_score` addiert werden (Backend-Seite!)

---

## 📞 Debugging-Cheat-Sheet

```javascript
// === Browser Console während Quiz ===

// 1. Aktuellen State anzeigen
console.log('State:', window.state || 'State nicht verfügbar');

// 2. Score-Element prüfen
document.getElementById('quiz-score-display').textContent

// 3. Nächsten API-Call abfangen
fetch = new Proxy(fetch, {
  apply: (target, thisArg, args) => {
    console.log('📡 Fetch:', args[0]);
    return Reflect.apply(target, thisArg, args)
      .then(r => { console.log('✅ Response:', r.status); return r; });
  }
});

// 4. Level-Up Container finden
document.getElementById('quiz-level-up-stage')

// 5. Aktuelles View
// (State muss global sein für diesen Check)
```

