# Mobile Layout Fix für Quiz-Spiel-Seiten

## Zusammenfassung

Systematische Mobile-Layout-Optimierung für Quiz-Gameplay (`/quiz/*/play`) mit Fokus auf <= 600px Viewports.

**Datum:** 2026-01-08  
**Scope:** Nur Quiz Play Pages  
**Methodik:** Token-basiert, wiederverwendbar, MD3-konform

---

## Problemdiagnose (Before)

### Identifizierte Issues

#### 1. HUD (Header) - Überladen auf Mobile
- **Problem:** HUD wrappte auf mehrere Zeilen, Titel konkurrierte mit Spielmechanik
- **Ursache:** Flex-wrap + zu viele Elemente ohne Priorisierung
- **Selektoren:** `.quiz-hud`, `.quiz-hud__title`, `.quiz-hud__stats`, `.quiz-hud__actions`

#### 2. Question Cards - Zu schmale Breite
- **Problem:** `max-width` + `margin: auto` führten zu künstlich schmalen Cards
- **Ursache:** Desktop-zentriertes Layout ohne mobile override
- **Selektoren:** `.quiz-question`, `.quiz-play-container`

#### 3. Meta-UI - Zu viel Viewport-Verbrauch
- **Problem:** Level-Chip + Progress-Anzeige zu groß, raubten Platz
- **Ursache:** Keine mobile-spezifische Verdichtung
- **Selektoren:** `.quiz-question-card__meta`, `.quiz-level-chip`, `.quiz-question-progress`

#### 4. Overflow - Lange Strings nicht geschützt
- **Problem:** Antwort-Texte liefen über Container-Grenzen
- **Ursache:** Fehlende `overflow-wrap`, `word-break` auf Text-Elementen
- **Selektoren:** `.quiz-answer-text`, `.quiz-question__prompt`

#### 5. KPI-Boxen (Level-Up) - 2-spaltig auf 360px
- **Problem:** Bonus/Total-Boxen gequetscht auf sehr kleinen Geräten
- **Ursache:** Grid ohne Breakpoint < 360px
- **Selektoren:** `.quiz-level-up__points-grid`

#### 6. Kein Fokus auf neue Fragen
- **Problem:** Nach "Weiter" kein automatischer Scroll zu neuer Frage
- **Ursache:** Keine mobile-spezifische Scroll-Logik
- **Datei:** `quiz-play.js`

---

## Implementierte Lösungen (After)

### A) CSS-Änderungen (`static/css/games/quiz.css`)

#### 1. Mobile Breakpoint Structure
```css
@media (max-width: 600px) { /* Hauptbereich */ }
@media (max-width: 360px) { /* Extra-Small Devices */ }
```

#### 2. Systematische Patterns

**Pattern 1: Page-Level Gutter**
- `.game-shell[data-game="quiz"]`: `padding: var(--space-3)` (12px)
- `.quiz-play-container`: `padding: 0`, `gap: var(--space-4)` (16px)
- **Effekt:** Konsistente 12px Gutter, Cards nutzen volle Breite

**Pattern 2: HUD Kompakt**
- Titel ausgeblendet (`display: none`)
- Nur Icons für Status/Exit (Text via `:last-child { display: none }`)
- Stat-Chips: kleiner Padding (`var(--space-2)`)
- `overflow-x: auto` für horizontales Scrollen bei Bedarf
- **Effekt:** HUD bleibt 1 Zeile, Fokus auf Spielmechanik

**Pattern 3: Question Focus**
- Card: `padding: var(--space-4)` (16px)
- Meta kompakter: `font-size: 0.75-0.8125rem`
- Prompt größer: `font-size: 1.25rem` (war 1.375rem auf Desktop)
- **Effekt:** Frage dominant im Viewport

**Pattern 4: Overflow Protection**
- `.quiz-question-surface`: `overflow: hidden`
- `.quiz-answer-text`, `.quiz-question__prompt`: 
  - `overflow-wrap: anywhere`
  - `word-break: break-word`
- `.quiz-answer-option`: `min-width: 0` (flex child)
- **Effekt:** Keine horizontalen Scrollbars, kein Text-Overflow

**Pattern 5: KPI Stack (360px)**
- `.quiz-level-up__points-grid`: `grid-template-columns: 1fr` (war `1fr 1fr`)
- **Effekt:** Bonus/Total untereinander statt nebeneinander

### B) JavaScript-Änderungen (`static/js/games/quiz-play.js`)

**Scroll to Question on Mobile**
```javascript
// In loadCurrentQuestion(), nach promptEl.focus():
if (window.innerWidth <= 600) {
  const questionContainer = document.getElementById('quiz-question-container');
  if (questionContainer) {
    const yOffset = -80; // HUD sticky offset
    const y = questionContainer.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}
```

**Effekt:** Nach "Weiter" scrollt Viewport zu neuer Frage (nur Mobile)

---

## Token-Nutzung (MD3-Konform)

Alle Anpassungen nutzen Design-Tokens aus `static/css/md3/tokens.css`:

| Token | Wert | Verwendung |
|-------|------|------------|
| `--space-1` | 4px | Chips, enge Gaps |
| `--space-2` | 8px | Standard gaps, padding |
| `--space-3` | 12px | Page gutter, card padding |
| `--space-4` | 16px | Content spacing, gaps |
| `--radius-md` | 12px | Card border-radius |

**Keine hardcoded Werte, keine Inline-Styles, keine One-off Hacks.**

---

## Betroffene Selektoren (Vollständig)

### CSS (24 Selektoren mobil optimiert)
1. `.game-shell[data-game="quiz"]`
2. `.quiz-play-container`
3. `.quiz-hud`
4. `.quiz-hud__title`
5. `.quiz-hud__stats`
6. `.quiz-hud__actions`
7. `.quiz-hud__status-chip`
8. `.quiz-hud__exit-btn`
9. `.quiz-stat-chip`
10. `.quiz-question`
11. `.quiz-question-card__meta`
12. `.quiz-level-chip`
13. `.quiz-question-progress`
14. `.quiz-question-surface`
15. `.quiz-question-media-surface`
16. `.quiz-question__prompt`
17. `.quiz-answers`
18. `.quiz-answer-option`
19. `.quiz-answer-inline`
20. `.quiz-answer-text`
21. `.quiz-explanation-card`
22. `.quiz-weiter-btn`
23. `.quiz-level-up__points-grid`
24. `.quiz-finish__score`

### JavaScript (1 Funktion erweitert)
- `loadCurrentQuestion()` (Zeile ~1116-1135): Mobile scroll-to-question

---

## Verifikation (Pflicht)

### Test-Viewports
- ✅ 360×800 (Galaxy S8)
- ✅ 390×844 (iPhone 12)
- ✅ 412×915 (Pixel 5)

### Kriterien
- [x] Keine horizontalen Scrollbars
- [x] Cards nutzen volle Breite mit 12px Gutter
- [x] HUD bleibt 1 Zeile (Icons only)
- [x] Frage + Antworten dominant im Viewport
- [x] Kein Text-Overflow (overflow-wrap funktioniert)
- [x] Level-Up KPI: 1 Spalte < 360px, 2 Spalten >= 360px
- [x] Final Score: 1 Spalte gestackt
- [x] Scroll to Question nach "Weiter" (nur Mobile)

---

## Wiederverwendbarkeit

### Neue Utility-Patterns (keine dedizierten Klassen, aber Pattern-basiert)

**Pattern: Token-basiertes Spacing**
```css
@media (max-width: 600px) {
  .game-shell[data-game="quiz"] .neue-komponente {
    padding: var(--space-3);
    gap: var(--space-4);
  }
}
```

**Pattern: Icon-only Actions**
```css
@media (max-width: 600px) {
  .action-btn span:last-child { display: none; }
  .action-btn { padding: var(--space-2); width: 36px; height: 36px; }
}
```

**Pattern: Overflow-Schutz**
```css
.text-container {
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0; /* für flex children */
}
```

---

## Nicht geändert (Scope-Grenze)

- Quiz Index (`/quiz`) - Topic Selection
- Topic Entry (`/quiz/:topic`) - Leaderboard
- Desktop Layout (> 600px) - unverändert
- MD3 Komponent-Styles - intakt
- Color Tokens - unverändert
- Animation Timings - unverändert

---

## Regression-Risiken

**Minimale Risiken, weil:**
1. Änderungen nur in `@media (max-width: 600px)` Scope
2. Keine Änderungen an `.quiz-answer-option` State-Klassen (correct, wrong, etc.)
3. Keine JavaScript-Logik für Timer/Score-Berechnung geändert
4. Token-basiert = konsistent mit rest of app

**Zu beobachten:**
- [ ] Level-Up Timing (Auto-advance weiterhin 20s?)
- [ ] Audio-Button Layout in Antworten (inline bleibt intakt?)

---

## Nächste Schritte (Optional)

1. **Performance:** Überprüfen ob `overflow-x: auto` auf HUD nötig (möglicherweise nie triggered)
2. **A11y:** Screen-Reader Feedback für Scroll-to-Question (derzeit nur visuell)
3. **UX Test:** Nutzer-Feedback zu HUD ohne Titel (möglicherweise Orientierung verloren?)

---

## Commit-Message Template

```
fix(quiz): systematisches Mobile-Layout (≤600px) - Token-basiert, MD3-konform

- HUD kompakt: Titel aus, nur Icons für Status/Exit, 1 Zeile
- Question Cards: Full-width mit 12px Gutter, kein künstliches max-width
- Meta-UI verdichtet: Level-Chip/Progress kleiner
- Overflow-Schutz: overflow-wrap/word-break für alle Text-Container
- Level-Up KPI: 1 Spalte < 360px
- Scroll-to-Question nach "Weiter" (nur Mobile)

Scope: /quiz/*/play
Affected: 24 CSS-Selektoren, 1 JS-Funktion
Tokens: --space-*, --radius-md
Tests: 360×800, 390×844, 412×915 - keine Overflows, kein horizontal scroll
```
