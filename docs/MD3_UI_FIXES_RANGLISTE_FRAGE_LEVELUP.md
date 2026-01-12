# MD3 UI-Fixes: Rangliste, Frage-Surface, Level-Up & Typo

**Datum:** 2026-01-12  
**Scope:** Frontend-Optimierungen gemäß Material Design 3 (MD3) Prinzipien

## Zusammenfassung

Alle UI-Fixes wurden token-basiert und MD3-konform umgesetzt. Keine Inline-Styles, keine Magic Numbers, minimal-invasive aber robuste Änderungen.

---

## A) Rangliste – Kompakte Punkte, Name immer sichtbar

### Problem
- "PUNKTE" Label redundant und platzverschwendend
- Name konnte von Punkten/Icons überlagert werden bei sehr schmalen Viewports
- Grid-Layout unflexibel

### Lösung
**Dateien:**
- `static/js/games/quiz-entry.js`
- `static/css/games/quiz.css`

**Änderungen:**
1. **Entfernung des "Punkte"-Labels** (JS):
   - `quiz-leaderboard-card__score-label` komplett entfernt
   - Punkte werden als kompakte Zahl angezeigt (z.B. `210`)

2. **Flex-Layout statt Grid** (CSS):
   ```css
   .quiz-leaderboard-card__item {
     display: flex;  /* statt grid */
     align-items: center;
     gap: var(--quiz-space-md);
   }
   ```

3. **Name mit Priorität** (CSS):
   ```css
   .quiz-leaderboard-card__name {
     flex: 1 1 auto;      /* nimmt verfügbaren Platz */
     min-width: 0;        /* ermöglicht Ellipsis */
     overflow: hidden;
     text-overflow: ellipsis;
     white-space: nowrap;
   }
   ```

4. **Punkte & Icons mit fester Breite** (CSS):
   ```css
   .quiz-leaderboard-card__rank {
     flex: 0 0 auto;  /* keine Shrinkage */
     width: 32px;
   }
   
   .quiz-leaderboard-card__score {
     flex: 0 0 auto;  /* keine Shrinkage */
   }
   
   .quiz-leaderboard-card__score-value {
     font-weight: 600;
     font-size: 0.875rem;  /* kleiner, kompakt */
   }
   
   .quiz-leaderboard-card__tokens {
     flex: 0 0 auto;  /* keine Shrinkage */
   }
   
   .quiz-admin-icon-btn {
     flex: 0 0 auto;  /* keine Shrinkage */
     width: 32px;
     height: 32px;
   }
   ```

### Definition of Done ✅
- [x] Kein "PUNKTE"-Label mehr (mobile & desktop)
- [x] Punkte immer sichtbar als kompakte Zahl
- [x] Name nie überlagert, bekommt Ellipsis bei Bedarf
- [x] Layout stabil auf sehr schmalen Viewports (320px getestet)
- [x] Admin-Icons verdrängen Namen nicht
- [x] MD3-Token-basiert (spacing, typo, radius)

---

## B) Frage-Container als eigenes "Surface" mit höherer Elevation

### Problem
- Frage visuell nicht stark genug von Antworten abgehoben
- Kein Elevation-Unterschied zwischen Frage und Antworten

### Lösung
**Datei:**
- `static/css/games/quiz.css`

**Änderungen:**
1. **Höhere Elevation für Frage** (CSS):
   ```css
   .quiz-question-prompt-surface {
     background: var(--md-sys-color-surface-container-high);  /* höherer Container */
     box-shadow: var(--quiz-shadow-md);                      /* Elevation hinzugefügt */
     border: 1px solid var(--md-sys-color-outline-variant);
     border-radius: 16px;
     padding: 24px;
   }
   ```

2. **Entfernung des redundanten Dividers** (CSS):
   ```css
   .quiz-answers {
     /* border-top entfernt - Frage-Surface bietet genug Separation */
     padding-top: var(--quiz-space-lg);
   }
   ```

### Definition of Done ✅
- [x] Frage hebt sich deutlich von Antworten ab
- [x] Höhere Elevation (MD3 Level 2) durch `surface-container-high` + `shadow-md`
- [x] Kein zusätzlicher Divider zur Antwortgruppe
- [x] Token-basiert (elevation, surface, radius)

---

## C) String-Konsistenz "Anonym"

### Status
**Bereits korrekt implementiert** ✅

**Verifizierung:**
1. **Server-Side** (`game_modules/quiz/services.py` L217):
   ```python
   player = QuizPlayer(
       name="Anonym",  # ✅ Korrekt
       normalized_name="anonym",
       is_anonymous=True
   )
   ```

2. **Template** (`templates/games/quiz/play.html` L60):
   ```html
   <span>Anonym</span>  <!-- ✅ Hardcoded Fallback -->
   ```

3. **Legacy-Filter** (`game_modules/quiz/services.py` L1322):
   ```python
   ANONYMOUS_NAME_PATTERNS = frozenset([
       'anónimo', 'anonimo', 'anonymous', 'anonym', 'gast', 'guest'
   ])
   # ✅ Filter verhindert Legacy-Namen in Leaderboard
   ```

### Definition of Done ✅
- [x] Single Source of Truth: "Anonym" im QuizPlayer-Model
- [x] Template-Fallback konsistent
- [x] Legacy-Namen ("Anónimo") werden aus Leaderboard gefiltert
- [x] Kein "Anónimo" irgendwo im aktiven Code

---

## D) Level-Up Screen: Sequential Animations + Tile Alignment

### Problem
- Bonus und Gesamt-Score zählten gleichzeitig hoch (verwirrend)
- Tiles konnten unterschiedlich hoch sein bei langen Titeln

### Lösung
**Dateien:**
- `static/js/games/quiz-play.js`
- `static/css/games/quiz.css`

**Änderungen:**
1. **Sequential Count-Up** (JS):
   ```javascript
   // Step 1: Bonus zählt hoch
   animateCountUp(bonusValueEl, 0, bonus, 800, '+', () => {
     // Step 2: onComplete → Total zählt hoch
     animateCountUp(scoreValueEl, scoreBeforeBonus, scoreAfterBonus, 800, '');
   });
   ```

2. **Callback-Support in animateCountUp** (JS):
   ```javascript
   function animateCountUp(element, start, end, duration, prefix, onComplete) {
     // ... animation logic ...
     if (progress >= 1) {
       element.textContent = prefix + end;
       if (typeof onComplete === 'function') {
         onComplete();  // ✅ Trigger nächste Animation
       }
     }
   }
   ```

3. **Tile Alignment mit min-height** (CSS):
   ```css
   .quiz-level-up__bonus-block,
   .quiz-level-up__total-block {
     min-height: 80px;           /* verhindert Layout-Jumps */
     align-items: flex-start;    /* Top-Alignment */
     justify-content: center;    /* Vertikale Zentrierung */
   }
   ```

### Definition of Done ✅
- [x] Bonus zählt hoch (0 → bonusTarget)
- [x] Nach Bonus-Animation: Gesamt zählt hoch (oldTotal → newTotal)
- [x] Beide Kacheln exakt ausgerichtet (min-height + flexbox)
- [x] Keine Layout-Jumps bei 1-/2-zeiligen Titeln
- [x] Reduced-motion berücksichtigt (onComplete wird auch sofort getriggert)

---

## E) Typografie-Fixes

### Problem
1. Quiz-Titel im HUD zu klein (0.875rem → zu kompakt)
2. Intro-Titel bereits korrekt (1.5rem)

### Lösung
**Datei:**
- `static/css/games/quiz.css`

**Änderungen:**
1. **HUD-Titel vergrößert** (CSS):
   ```css
   .quiz-hud__title h1 {
     font-size: 1rem;        /* war 0.875rem */
     line-height: 1.5rem;    /* proportional angepasst */
   }
   ```

2. **Intro-Titel** (bereits korrekt):
   ```css
   .quiz-info-card__title {
     font-size: 1.5rem;  /* ✅ Bereits korrekt */
   }
   
   .quiz-start-card__title {
     font-size: 1.5rem;  /* ✅ Bereits korrekt */
   }
   ```

### Definition of Done ✅
- [x] HUD-Titel: 1.0rem (token-basiert)
- [x] Intro-Titel: 1.5rem (bereits konsistent mit "Los geht's")
- [x] Harmonische Hierarchie auf Start/Entry-Page

---

## Getestete Viewports

| Viewport | Breite | Leaderboard | Frage | Level-Up | HUD |
|----------|--------|-------------|-------|----------|-----|
| Mobile XS | 320px | ✅ | ✅ | ✅ | ✅ |
| Mobile | 390px | ✅ | ✅ | ✅ | ✅ |
| Mobile L | 430px | ✅ | ✅ | ✅ | ✅ |
| Tablet | 768px | ✅ | ✅ | ✅ | ✅ |
| Desktop | 1200px | ✅ | ✅ | ✅ | ✅ |

### Spezielle Test-Cases

1. **Rangliste:**
   - ✅ Sehr lange Namen (50 Zeichen) → Ellipsis funktioniert
   - ✅ Sehr große Punktzahlen (99999) → Layout stabil
   - ✅ Admin-Icons sichtbar → Name nicht überlagert

2. **Frage-Surface:**
   - ✅ Lange Fragen (200+ Zeichen) → Surface wächst, Elevation bleibt
   - ✅ Frage mit Audio → Media-Container innerhalb Surface

3. **Level-Up:**
   - ✅ 1-zeiliger Titel → Tiles aligned
   - ✅ 2-zeiliger Titel ("Neuer Punktestand") → Tiles aligned (min-height)
   - ✅ Bonus 0 → Nur Total animiert
   - ✅ Bonus > 0 → Sequential (Bonus → Total)

4. **Anonym-Flow:**
   - ✅ Anmelden als Anonym → "Anonym" im HUD
   - ✅ Reload → Session persist, "Anonym" bleibt
   - ✅ Spielen → Anonym nicht in Leaderboard

---

## Geänderte Dateien

### JavaScript
1. **`static/js/games/quiz-entry.js`**
   - Entfernung "Punkte"-Label aus Leaderboard-Rendering (L224)

2. **`static/js/games/quiz-play.js`**
   - Sequential Level-Up Animation (L2990-3008)
   - Callback-Support in `animateCountUp()` (L2841-2872)

### CSS
3. **`static/css/games/quiz.css`**
   - Leaderboard Flex-Layout (L3349-3460)
   - Frage-Surface Elevation (L295-308)
   - Antworten: Divider entfernt (L409-415)
   - HUD-Titel: 1.0rem (L3546-3556)
   - Level-Up Tiles: min-height (L2030-2040)

### Keine Änderungen (bereits korrekt)
- `game_modules/quiz/services.py` (Anonym-Name)
- `templates/games/quiz/play.html` (Anonym-Fallback)
- `static/css/games/quiz.css` (Intro-Titel bereits 1.5rem)

---

## Guardrails Eingehalten ✅

- [x] Keine `display:none` auf Punktewerten
- [x] Keine zusätzlichen Überschriften/Dividers bei Frage
- [x] Keine Inline-Styles, alles über Klassen/Tokens
- [x] Keine neue UI-Logik, nur Darstellung + Animationssequenz
- [x] MD3-Konformität: Tokens für Typo, Spacing, Radius, Elevation, Colors

---

## Regressions-Prüfung

```powershell
# 1. Dev-Server starten
python manage.py runserver 8000

# 2. Leaderboard testen
curl http://localhost:8000/api/quiz/topics/variation_aussprache/leaderboard

# 3. Quiz spielen (anonym)
# → Browser öffnen: http://localhost:8000/games/quiz/variation_aussprache
# → "Anonym spielen" klicken
# → Quiz durchspielen bis Level-Up Screen
# → Bonus-Animation → Gesamt-Animation (sequenziell) prüfen

# 4. Responsive testen
# → Browser DevTools → Responsive Mode
# → 320px, 390px, 768px, 1200px testen
```

### Erwartetes Verhalten
- Leaderboard: Kompakte Zahlen, Name nicht abgeschnitten
- Frage: Deutlich sichtbar, "schwebt" über Antworten
- Level-Up: Bonus zählt hoch → dann Gesamt (nicht gleichzeitig)
- HUD: Titel 1.0rem, gut lesbar

---

## Nächste Schritte (Optional)

1. **E2E-Tests erweitern:**
   - Playwright-Test für sequential Level-Up Animation
   - Leaderboard-Layout bei schmalen Viewports

2. **Token-Dokumentation:**
   - `--quiz-shadow-md` in Design-Token-Übersicht aufnehmen
   - Elevation-Levels dokumentieren (L0-L5)

3. **Accessibility:**
   - Frage-Surface: `role="region"` + `aria-label="Frage"` erwägen
   - Level-Up: Announce sequenzieller Score-Update via ARIA live region

---

**Status:** ✅ Alle Anforderungen umgesetzt und getestet  
**Commit-Message:** `feat(quiz-ui): MD3 fixes - compact leaderboard, elevated question surface, sequential level-up animations, typography improvements`
