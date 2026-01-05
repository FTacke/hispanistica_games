# Quiz Fix - Quick Start für Testing

## ✅ Was wurde gefixt

1. **LevelUp zeigt echte Werte** statt Hardcodes (2/2, Bonus 0, Score 0)
2. **Scenario A/B/C** wird korrekt aus correctCount/totalCount berechnet
3. **Weiter-Button** funktioniert sofort (Event Delegation)
4. **Final Score** zeigt korrekten Wert (nicht mehr 0)
5. **Score-Management** differenziert scoreAfterQuestions vs scoreAfterBonus
6. **Zentrale Mapper** für alle API-Responses (snake_case → camelCase)
7. **🔥 DOM-Sync-Bug behoben**: Legacy Template-HTML mit "Bonus +0" entfernt
8. **🔥 ID-Mismatch behoben**: `quiz-levelup-container` → `quiz-level-up-container`
9. **🔥 Render-Guards**: `loadCurrentQuestion`/`renderQuestion` während LevelUp blockiert
10. **🔥 DOM-Assertions**: In-Code-Verifikation von Bonus/Score-Werten im DOM
11. **⏱️ Timer Lifecycle**: Robuster Timer-Controller mit View/Question-Index Guards
12. **⏱️ Timeout Error Handling**: 400/500 Fehler frieren UI nicht mehr ein
13. **🎨 Button Layout**: MD3-konforme Weiter-Buttons (240px min-width, prominent)
14. **🎨 Button Tokens**: Grüne Primary Buttons via `--md-sys-color-primary` (nicht hardcoded)
15. **🔄 POST_ANSWER State**: Erklärung lesbar BEVOR LevelUp (UX-Flow korrigiert)
16. **🔢 Index Fix**: Nach LevelUp nächste Frage (nicht letzte wiederholt)

---

## 🚀 Server starten

```powershell
.\scripts\dev-start.ps1 -UsePostgres
```

Server läuft unter: http://localhost:8000

---

## 🧪 Smoke-Test (5 Minuten)

### Test 1: Perfekt (2/2 richtig)

1. **Öffne:** http://localhost:8000/quiz
2. **Wähle** ein Topic
3. **Login** als Guest oder registriere dich
4. **Öffne DevTools Console** (F12 → Console Tab)
5. **Beantworte beide Fragen richtig**

**Erwartete Console Logs:**
```
[POST_ANSWER] Pending transition: LEVEL_UP
[INDEX] after answer { current: 1, next: 2 }
[ANSWER RAW] { level_correct_count: 2, level_questions_in_level: 2, level_bonus: 20, running_score: 40 }
[ANSWER MODEL] { levelCorrectCount: 2, levelQuestionsInLevel: 2, ... }
[LEVELRESULT BUILT] { correctCount: 2, totalCount: 2, bonus: 20, scoreAfterBonus: 40, scenario: "A" }
```

**Erwartetes UI (POST_ANSWER):**
- ✅ **Erklärung bleibt sichtbar** (User kann lesen!)
- ✅ Grüner **"Weiter"** Button erscheint (MD3 Primary Token)
- ✅ **Keine automatische Transition** zu LevelUp

**Weiter-Button Test:**
- Klicke "Weiter"
- Console zeigt:
  ```
  [TRANSITION] -> VIEW.LEVEL_UP after Weiter click
  [RENDER CURRENT VIEW] { view: "LEVEL_UP", levelUpContainerExists: true }
  [LEVELUP RENDER INPUT] { correctCount: 2, totalCount: 2, bonus: 20, scoreAfterBonus: 40 }
  [LEVELUP DOM VERIFICATION] { bonusTextInDOM: "+20", expectedBonus: "+20", match: true }
  ✅ [LEVELUP DOM ASSERTIONS PASSED]
  ```
- ✅ LevelUp Modal zeigt: **"2/2, BONUS +20, Score 40"** (nicht hardcoded!)
- ✅ Subline: "Stark! Das war fehlerfrei."

**Nach LevelUp:**
- Klicke "Weiter" im LevelUp Modal
- Console zeigt:
  ```
  [INDEX] on continue { next: 2 }
  [INDEX] loading next question: 2
  ```
- ✅ **Frage 3 lädt** (nicht Frage 2 nochmal!)
- ✅ HUD zeigt 40 Punkte
- ✅ Keine 400 BAD REQUEST Fehler

---

### Test 2: Teilweise (1/2 richtig)

1. **Erste Frage richtig** ✅
2. **Zweite Frage falsch** ❌
3. **Console checken:**
   ```
   [LEVELRESULT BUILT] { correctCount: 1, totalCount: 2, scenario: "B" }
   ```

**Erwartetes UI:**
- ✅ "Richtig: **1/2**"
- ✅ "BONUS **+0**"
- ✅ "Neuer Punktestand **10**"
- ✅ Subline: "Da geht noch mehr!"

---

### Test 3: Komplett falsch (0/2)

1. **Beide Fragen falsch** ❌❌
2. **Console checken:**
   ```
   [LEVELRESULT BUILT] { correctCount: 0, totalCount: 2, scenario: "C" }
   ```

**Erwartetes UI:**
- ✅ "Richtig: **0/2**"
- ✅ "BONUS **+0**"
- ✅ "Neuer Punktestand **0**"
- ✅ Subline: "Leider war das nichts."
- ✅ **Extra:** Tipp-Box "💡 Tipp: Lies die Erklärung nach jeder Frage genau."

---

### Test 4: Final Screen

1. **Spiele Quiz zu Ende**
2. **Final Screen wird angezeigt**

**Erwartetes UI:**
- ✅ "Dein Ergebnis: **45**" (NICHT 0!)
- ✅ Score stimmt mit letztem HUD-Score überein

**Console:**
```
[FINISH MODEL] { totalScore: 45, tokensCount: 0, breakdown: [...] }
```

**Button-Tests:**
- Klicke "Nochmal spielen" → Console: `[QUIZ ACTION] final-retry` → Reload
- Klicke "Zur Übersicht" → Console: `[QUIZ ACTION] final-topics` → Redirect /quiz

---

## ❌ Fehlerdiagnose

### Problem: Console Logs fehlen

**Ursache:** Browser cached alte JS-Datei

**Lösung:**
```powershell
# Hard Refresh
Ctrl + Shift + R   (Windows/Linux)
Cmd + Shift + R    (Mac)

# Oder: DevTools → Network Tab → "Disable cache" aktivieren
```

### Problem: Immer noch "2/2, Bonus 0"

**Diagnose:**
1. Console öffnen
2. Schaue nach `[ANSWER RAW]` Log
3. Wenn fehlt → Backend Problem
4. Wenn vorhanden, aber `level_correct_count: undefined` → Backend sendet Feld nicht

**Prüfe Backend:**
```powershell
# Network Tab → Filter "answer" → Click auf Request → Response Tab
# Muss enthalten:
{
  "level_correct_count": 2,
  "level_questions_in_level": 2,
  "level_bonus": 5,
  "running_score": 20
}
```

### Problem: Button funktioniert nicht

**Diagnose:**
1. Console: `[LEVELUP BTN] Rendered, delegation active` vorhanden?
2. Wenn ja: Button da, aber Click wird nicht gefangen
3. Wenn nein: Render fehlgeschlagen

**Debug:**
```javascript
// In Console eingeben:
document.querySelector('[data-quiz-action="levelup-continue"]')
// Sollte Button Element zurückgeben, nicht null
```

### Problem: Final Score = 0

**Diagnose:**
1. Console: `[FINISH MODEL]` zeigt `totalScore: 0`?
2. Wenn ja: Backend `/finish` liefert `total_score: 0` → Backend Bug
3. Wenn nein: Frontend liest `totalScore` nicht korrekt

**Prüfe Backend:**
```powershell
# Network Tab → Filter "finish" → Response muss enthalten:
{
  "total_score": 45  # nicht 0!
}
```

---

## 📋 Erfolgs-Kriterien

✅ **PASS** wenn:
1. Alle 4 Tests zeigen korrekte Werte (nicht mehr 2/2, 0, 0)
2. Console Logs erscheinen bei jedem Test
3. Buttons funktionieren sofort (kein Freeze/Delay)
4. Final Score > 0 und korrekt

❌ **FAIL** wenn:
- Irgendein Test zeigt Hardcode-Werte
- Console Logs fehlen oder `undefined`
- Button reagiert nicht
- Final Score = 0

---

## � Troubleshooting: LevelUp nicht sichtbar

### Symptom: Logs zeigen "[LEVELRESULT BUILT]" aber UI zeigt keine LevelUp-Page

**Diagnose-Schritte:**

1. **Check Console für [VIEW VISIBILITY CHECK]:**
   ```javascript
   [VIEW VISIBILITY CHECK - LEVEL_UP] {
     containerDisplay: "none",  // ❌ Sollte "block" sein!
     containerRect: { height: 0 }  // ❌ Sollte >200 sein!
   }
   ```
   → **Problem:** Container hidden durch CSS/Parent

2. **Check Container Count:**
   ```javascript
   [CONTAINER COUNT] {
     levelUpContainers: 2,  // ❌ Sollte 1 sein!
     legacyLevelUpContainers: 1  // ❌ Sollte 0 sein!
   }
   ```
   → **Problem:** Legacy Template-HTML nicht entfernt → [Siehe Fix-Dokumentation](./quiz-bonus-dom-sync-fix.md)

3. **Check Render Guard:**
   ```javascript
   [RENDER GUARD] ❌ BLOCKED renderQuestion() - currentView: LEVEL_UP
   ```
   → **Gut!** Guard funktioniert. Wenn das fehlt → Race Condition!

4. **Check Topmost Element:**
   ```javascript
   [TOPMOST ELEMENT] { isLevelUpDescendant: false }
   ```
   → **Problem:** Overlay blockiert LevelUp → Z-Index prüfen

**Fixes:**
- Container Count > 1: Hard-Refresh (Ctrl+Shift+R) oder Cache leeren
- display:none: Inspect Element → Prüfe CSS-Regeln auf `[hidden]` Selector
- Topmost Element falsch: Prüfe z-index in DevTools

---

## �🛠️ Nächste Schritte (nach erfolgreichem Smoke-Test)

1. ✅ **Smoke-Test bestanden** → Report an QA
2. 📝 Backend Tests schreiben (`tests/quiz/test_answer_contract.py`)
3. 🎭 Playwright E2E-Tests schreiben
4. 🔍 Code Review anfordern
5. 🚢 Staging-Deploy
6. 🚀 Production-Deploy

---

## 📚 Dokumentation

- **Technischer Report:** [docs/Quiz_Finishing.md](./Quiz_Finishing.md)
- **Smoke-Test Details:** [docs/quiz-levelup-smoke-test.md](./quiz-levelup-smoke-test.md)
- **Root Cause:** [docs/quiz-levelup-rootcause.md](./quiz-levelup-rootcause.md)

---

## 🆘 Support

**Problem nicht gelöst?**
1. Screenshot von Console Logs machen
2. Screenshot von UI (LevelUp Screen)
3. Network Tab → "answer" Request → Response kopieren
4. Issue erstellen mit allen 3 Infos

**Kontakt:**
- GitHub Issues: [hispanistica_games/issues](https://github.com/.../issues)
- Slack: #hispanistica-dev
