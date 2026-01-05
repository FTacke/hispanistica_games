# LevelUp Screen - Smoke Test Anleitung

## Ziel
Verifizieren, dass LevelUp korrekte Werte anzeigt (0/2, 1/2, 2/2) + Bonus + Score und der Weiter-Button sofort funktioniert.

---

## Voraussetzungen

1. Dev-Server läuft: `.\scripts\dev-start.ps1 -UsePostgres`
2. Browser DevTools Console offen (F12)
3. Eingeloggt als Testuser im Quiz

---

## Test-Szenarien

### ✅ Szenario A: Perfekt (2/2 richtig)

**Durchführung:**
1. Starte ein Quiz
2. Beantworte beide Fragen im ersten Level **richtig**
3. Beobachte Console Logs + LevelUp Screen

**Erwartete Console Logs:**

```
[ANSWER RAW] {
  result: "correct",
  running_score: 20,  // (oder höher mit Bonus)
  level_completed: true,
  level_perfect: true,
  level_bonus: 5,  // (z.B. 5 für Perfect)
  level_correct_count: 2,
  level_questions_in_level: 2,
  difficulty: 1
}

[LEVELRESULT BUILT] {
  level_correct_count: 2,
  level_questions_in_level: 2,
  level_bonus: 5,
  running_score: 20,
  level_perfect: true
}

[LEVELUP RENDER INPUT] {
  difficulty: 1,
  level_bonus: 5,
  running_score: 20,
  level_perfect: true,
  level_correct_count: 2,
  level_questions_in_level: 2,
  correctCountType: "number",
  totalCountType: "number"
}

[LEVELUP FINAL VALUES] {
  correctCount: 2,
  totalCount: 2,
  bonus: 5,
  after: 20,
  scenario: "A"
}

[LEVELUP BTN FOUND] { found: true, btn: <button...> }
```

**Erwartetes UI:**
- Headline: "Level 1 abgeschlossen"
- Subline: "Stark! Das war fehlerfrei."
- Richtig: **2/2**
- BONUS: **+5** (gelb/grün highlighted)
- Neuer Punktestand: **20**
- Button "Weiter" ist sichtbar und klickbar

**Button-Test:**
- Klick auf "Weiter" → Console Log: `[LEVELUP BTN CLICK] Button geklickt`
- Screen wechselt sofort zu nächster Frage (kein Warten auf Timer)

---

### ⚠️ Szenario B: Teilweise richtig (1/2)

**Durchführung:**
1. Starte ein Quiz
2. Erste Frage **richtig**, zweite Frage **falsch**
3. Beobachte Console Logs + LevelUp Screen

**Erwartete Console Logs:**

```
[ANSWER RAW] {
  result: "incorrect",  // (letzte Antwort)
  running_score: 10,  // (nur 1 richtige Antwort)
  level_completed: true,
  level_perfect: false,
  level_bonus: 0,  // kein Bonus
  level_correct_count: 1,
  level_questions_in_level: 2
}

[LEVELRESULT BUILT] {
  level_correct_count: 1,
  level_questions_in_level: 2,
  level_bonus: 0,
  running_score: 10,
  level_perfect: false
}

[LEVELUP RENDER INPUT] {
  level_correct_count: 1,
  level_questions_in_level: 2,
  correctCountType: "number",
  totalCountType: "number"
}

[LEVELUP FINAL VALUES] {
  correctCount: 1,
  totalCount: 2,
  bonus: 0,
  after: 10,
  scenario: "B"
}
```

**Erwartetes UI:**
- Headline: "Level 1 abgeschlossen"
- Subline: "Da geht noch mehr!"
- Richtig: **1/2**
- BONUS: **+0** (grau, nicht highlighted)
- Neuer Punktestand: **10**

---

### ❌ Szenario C: Komplett falsch (0/2)

**Durchführung:**
1. Starte ein Quiz
2. Beantworte beide Fragen **falsch**
3. Beobachte Console Logs + LevelUp Screen

**Erwartete Console Logs:**

```
[ANSWER RAW] {
  result: "incorrect",
  running_score: 0,
  level_completed: true,
  level_perfect: false,
  level_bonus: 0,
  level_correct_count: 0,
  level_questions_in_level: 2
}

[LEVELUP FINAL VALUES] {
  correctCount: 0,
  totalCount: 2,
  bonus: 0,
  after: 0,
  scenario: "C"
}
```

**Erwartetes UI:**
- Headline: "Level 1 abgeschlossen"
- Subline: "Leider war das nichts."
- Richtig: **0/2**
- BONUS: **+0**
- Neuer Punktestand: **0**
- **Extra Tipp-Box angezeigt:** "💡 Tipp: Lies die Erklärung nach jeder Frage genau."

---

## Fehlerdiagnose

### ❌ Problem: Immer noch "2/2, Bonus 0, Score 0"

**Ursache:**
- `[ANSWER RAW]` Log fehlt → Frontend empfängt keine Daten oder API-Aufruf schlägt fehl
- `level_correct_count` ist `undefined` → Backend sendet das Feld nicht
- `correctCountType: "undefined"` → Feld fehlt im Response

**Lösung:**
1. Prüfe Network Tab: `/api/quiz/run/<run_id>/answer` Response
2. Verifiziere Backend-Code in `game_modules/quiz/routes.py` Zeile 620-630
3. Stelle sicher, dass `calculate_running_score()` `level_correct_count` zurückgibt

---

### ❌ Problem: Button funktioniert nicht

**Symptome:**
- `[LEVELUP BTN FOUND] { found: false }` → Button wird nicht gerendert
- `[LEVELUP BTN CLICK]` Log fehlt beim Klick → Event nicht gebunden oder blockiert

**Diagnose:**
```js
// In Browser Console ausführen:
const btn = document.getElementById('quiz-level-up-next-btn');
console.log('Button:', btn);
console.log('Computed style:', window.getComputedStyle(btn));
console.log('pointer-events:', window.getComputedStyle(btn).pointerEvents);
console.log('z-index:', window.getComputedStyle(btn).zIndex);
```

**Mögliche Ursachen:**
- `pointer-events: none` auf Button oder Parent
- Button ist `disabled`
- Overlay mit höherem z-index blockiert Klicks

---

### ❌ Problem: Score springt auf 0 nach LevelUp

**Diagnose:**
- Suche nach `runningScore = 0` oder `displayedScore = 0` im Code
- Prüfe, ob nach `renderLevelUpInContainer()` ein Reset passiert

**Mögliche Stellen:**
- `advanceFromLevelUp()` → darf Score nicht ändern
- `loadCurrentQuestion()` → darf Score nicht überschreiben
- `/status` API Response mit `running_score: 0` → Backend Bug

---

## Erfolgs-Kriterien

✅ **PASS** wenn:
1. Alle 3 Szenarien (A, B, C) zeigen korrekte Werte
2. Console Logs erscheinen bei jedem Test
3. Button-Klick funktioniert sofort (kein Delay, kein Freeze)
4. Score bleibt konsistent (kein Sprung auf 0)
5. Keine Alerts "Fehler: Level-Daten unvollständig"

❌ **FAIL** wenn:
- Irgendein Szenario zeigt Hardcode-Werte (2/2, 0, etc.)
- Button reagiert nicht oder nur nach Timer-Ablauf
- Console Logs fehlen oder zeigen `undefined` Werte

---

## Quick-Check (30 Sekunden)

**Minimal-Test für schnelle Verifikation:**

1. Quiz starten
2. 2 Fragen richtig beantworten
3. Console: `[LEVELUP FINAL VALUES]` mit `correctCount: 2, bonus: 5, after: >0`
4. UI: "2/2", "Bonus +5", Score > 0
5. Button click → sofortiger Wechsel

✅ Wenn das funktioniert, ist der Fix erfolgreich.

---

## Automatisierter Test (Optional)

Falls Playwright/Jest vorhanden:

```js
test('LevelUp shows correct 2/2 and bonus', async ({ page }) => {
  await page.goto('/quiz/topic-1/play');
  
  // Beantworte 2 Fragen richtig
  await page.click('[data-answer-id="correct-1"]');
  await page.click('#quiz-answer-next-btn');
  await page.click('[data-answer-id="correct-2"]');
  await page.click('#quiz-answer-next-btn');
  
  // Warte auf LevelUp
  await page.waitForSelector('#quiz-level-up-stage');
  
  // Console Logs prüfen
  const logs = await page.evaluate(() => window.__consoleLogs);
  expect(logs).toContainEqual(expect.objectContaining({
    type: '[LEVELUP FINAL VALUES]',
    correctCount: 2,
    totalCount: 2,
    bonus: expect.any(Number),
    after: expect.any(Number)
  }));
  
  // UI Texte prüfen
  const resultText = await page.textContent('.quiz-level-up__result-row');
  expect(resultText).toContain('2/2');
  
  const bonusText = await page.textContent('.quiz-level-up__bonus-block');
  expect(bonusText).toMatch(/\+\d+/);  // +5, +10, etc.
  
  // Button funktioniert
  await page.click('#quiz-level-up-next-btn');
  await page.waitForSelector('.game-view--active[data-view="question"]');
});
```

---

## Support

Bei Problemen:
1. **Console Logs fehlen?** → Prüfe `const DEBUG = true;` in `quiz-play.js`
2. **API Response leer?** → Backend läuft? PostgreSQL Container up?
3. **Button findet sich nicht?** → DOM Inspektor: Existiert `#quiz-level-up-next-btn`?

**Kontakt:** Developer via GitHub Issue oder Slack #hispanistica-dev
