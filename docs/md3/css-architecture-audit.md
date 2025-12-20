# CSS Architecture Audit Report

**Projekt:** games.hispanistica  
**Datum:** 2025-12-20  
**Analysetiefe:** Vollständig (base.html CSS-Reihenfolge + branding.css Selektoren + Konflikte)

---

## Executive Summary

Die CSS-Architektur ist **inkonsistent**: `branding.css` enthält komponentenspezifische Klassenregeln, die in dedizierte Component-Dateien gehören. Dies führt zu:
- **Cascading-Konflikten** (branding.css lädt vor components → manchmal überschrieben, manchmal nicht)
- **Wartungsproblemen** (Logo-Styles im falschen File)
- **Unvorhersehbarem Verhalten** (z.B. Nav Drawer Logo border-radius greift nicht)

**Symptom-Beispiel:**  
`.md3-navigation-drawer__logo { border-radius: var(--radius-md); }` in `branding.css` (Zeile 267) wird durch spätere Regeln in `navigation-drawer.css` überschrieben oder greift gar nicht, weil die Component-Datei keine Basisregel hat.

---

## 1. CSS Entry Points & Ladereihenfolge (base.html)

### 1.1 Aktuelle Reihenfolge

| Reihenfolge | Datei | Layer | Zweck | Status |
|-------------|-------|-------|-------|--------|
| 1 | `css/layout.css` | Layout | App Shell Grid | ✅ Korrekt |
| 2 | `css/md3/tokens.css` | System Tokens | MD3 Base Variables | ✅ Korrekt |
| 3 | `css/app-tokens.css` | App Tokens | App-spezifische Semantik | ✅ Korrekt |
| 4 | `css/branding.css` | **Brand Tokens + COMPONENTS** | Brand Colors **+ Komponenten-Klassen** | ❌ **PROBLEM** |
| 5 | `css/md3/tokens-legacy-shim.css` | Legacy | Alias-Mapping | ⚠️ Temporär OK |
| 6 | `css/md3/typography.css` | Typography | Font Styles | ✅ Korrekt |
| 7 | `css/md3/layout.css` | Layout | MD3 Structural | ✅ Korrekt |
| 8-20 | `css/md3/components/*.css` | Components | Buttons, Nav, Footer, Cards, etc. | ✅ Korrekt |
| 21+ | Page-specific CSS (via extra_head) | Page | Impressum, Index, etc. | ✅ Korrekt |

### 1.2 Cascade-Problem

**branding.css (Position 4)** lädt **VOR** den Component-Dateien (Position 8-20).

**Resultat:**
- Komponenten-Styles in `branding.css` haben **niedrige Spezifität** (werden später überschrieben)
- ODER sie überschreiben versehentlich Component-Defaults (wenn Component keine eigene Regel hat)
- **Unvorhersehbar**: Manchmal greift die Regel, manchmal nicht (abhängig davon, ob Component später eine Regel definiert)

**Konkret:**
- `.md3-navigation-drawer__logo` in branding.css (Zeile 267) wird von `navigation-drawer.css` (Zeile ?) ignoriert/überschrieben
- `.md3-index-brand` in branding.css (Zeile 271) überschreibt möglicherweise `index.css` Defaults

### 1.3 Redundante/Tote Dateien

✅ Keine identifizierten toten CSS-Dateien. Alle geladenen Files werden verwendet.

---

## 2. branding.css Fehlbelegung (Class Selectors Analysis)

### 2.1 Alle Nicht-Variablen-Selektoren in branding.css

**Erlaubt (nach Layer 2 Definition):**
- `:root { --brand-* }`
- `:root[data-theme="dark"] { --brand-* }`
- Variablen-Mapping: `--md-sys-* : var(--brand-*)`

**Gefunden (VERBOTEN):**

| Zeile | Selector | Beschreibung | Ziel-Datei |
|-------|----------|--------------|------------|
| 267 | `.md3-navigation-drawer__logo` | Nav Drawer Logo Styling | `md3/components/navigation-drawer.css` |
| 271 | `.md3-index-brand` | Index Page Brand Container | `md3/components/index.css` |
| 278 | `.md3-index-brand__icon` | Index Page Icon | `md3/components/index.css` |
| 283 | `.md3-index-brand__text` | Index Page Text | `md3/components/index.css` (oder entfernen, nicht genutzt) |
| 287 | `.md3-index-tagline` | Index Page Tagline | `md3/components/index.css` (oder entfernen, nicht genutzt) |

**Total:** 5 Klassenregeln, die **NICHT** in branding.css gehören.

### 2.2 Detaillierte Regel-Analyse

#### Rule 1: `.md3-navigation-drawer__logo`
```css
/* branding.css:267 */
.md3-navigation-drawer__logo {
  width: 180px;
  height: auto;
  padding: var(--space-3) var(--space-4);
  display: block;
  border-radius: var(--radius-md);
}
```

**Problem:**
- Diese Regel definiert **Component-Struktur** (width, padding, display), nicht Brand-Farben
- Gehört eindeutig in `navigation-drawer.css`
- Aktuell: `navigation-drawer.css` hat **keine** Regel für `.md3-navigation-drawer__logo`
- **Resultat:** Logo wird nicht korrekt gestylt (border-radius greift nicht konsistent)

**Fix:** Verschiebe nach `static/css/md3/components/navigation-drawer.css` unter `.md3-navigation-drawer__header` Sektion.

#### Rule 2-5: Index Page Styling
```css
/* branding.css:271-291 */
.md3-index-brand { ... }
.md3-index-brand__icon { ... }
.md3-index-brand__text { ... }  /* UNUSED - kann gelöscht werden */
.md3-index-tagline { ... }      /* UNUSED - kann gelöscht werden */
```

**Problem:**
- Index-spezifische Layout-Regeln (flex, gap, margin, font-size)
- Gehören in `md3/components/index.css`
- `.md3-index-brand__text` und `.md3-index-tagline` sind **nicht im Template** (nach Logo-Refactor entfernt)

**Fix:**
- Verschiebe `.md3-index-brand` und `.md3-index-brand__icon` nach `index.css`
- **Lösche** `.md3-index-brand__text` und `.md3-index-tagline` (unused)

---

## 3. Spezifitäts-/Override-Probleme (Konkrete Konflikte)

### 3.1 Konflikt: Nav Drawer Logo Border-Radius

**Symptom:** Logo im Nav Drawer hat keine abgerundeten Ecken.

**Root Cause:**
```
branding.css:267 (lädt an Position 4)
  .md3-navigation-drawer__logo { border-radius: var(--radius-md); }

navigation-drawer.css (lädt an Position 9)
  .md3-navigation-drawer__header { ... }
  (KEINE Regel für .md3-navigation-drawer__logo)
```

**Cascade-Analyse:**
1. `branding.css` setzt border-radius (frühes Laden)
2. `navigation-drawer.css` lädt SPÄTER, definiert aber nichts für Logo
3. **ABER:** Andere Regeln in `navigation-drawer.css` könnten versehentlich das Logo beeinflussen (z.B. via `.md3-navigation-drawer__header > *`)

**Spezifität:**
- `.md3-navigation-drawer__logo` = 0,0,1,0 (1 Klasse)
- Potentieller Override: `.md3-navigation-drawer__header a` = 0,0,1,1 (1 Klasse + 1 Element)

**Effekt:** border-radius wird überschrieben oder greift nicht, weil das `<img>` Element weitere Styles erbt.

**Fix:** Regel muss IN `navigation-drawer.css` (nach `.md3-navigation-drawer__header`), nicht in branding.

---

### 3.2 Konflikt: Index Brand Margin

**Symptom:** Spacing um Logo herum inkonsistent.

**Root Cause:**
```
branding.css:271
  .md3-index-brand { margin-bottom: var(--space-4); }

index.css (potenziell)
  .md3-index-logo { padding: var(--space-4); }
```

**Problem:**
- `branding.css` setzt margin auf `.md3-index-brand` (inner container)
- `index.css` setzt padding auf `.md3-index-logo` (outer container)
- **Doppeltes Spacing** (4 + 4 = 8 spacing units)

**Spezifität:** Gleich (je 1 Klasse), aber Reihenfolge entscheidet.

**Effekt:** Unvorhersehbares Spacing (je nachdem, welche Regel zuletzt geladen wurde).

**Fix:** ALLE index-spezifischen Regeln in `index.css`, keine in branding.

---

### 3.3 Konflikt: Token-Override-Reihenfolge

**Symptom:** `--app-background` war inkonsistent (bereits gefixt im Background-Standardisierung).

**Root Cause (historisch):**
```
app-tokens.css (Position 3)
  --app-background: var(--md-sys-color-background);

branding.css (Position 4, FRÜHER)
  --app-background: var(--brand-background);  /* Override */
```

**Problem:**
- branding.css überschrieb app-tokens.css wegen späterer Ladereihenfolge
- Verletzt Layer-Hierarchie (Brand sollte NUR System-Tokens überschreiben, nicht App-Tokens)

**Status:** Bereits gefixt (--app-background Override aus branding.css entfernt).

---

## 4. Layer-Violations Zusammenfassung

| Layer | Soll (Definition) | Ist (Aktuell) | Status |
|-------|-------------------|---------------|--------|
| Layer 1: System Tokens | Nur `--md-sys-*` Variablen | ✅ `tokens.css` korrekt | ✅ OK |
| Layer 2: Brand Tokens | Nur `--brand-*` + Mapping | ❌ branding.css hat Klassen-Regeln | ❌ **VIOLATION** |
| Layer 3: App Tokens | Nur `--app-*` Variablen | ✅ `app-tokens.css` korrekt | ✅ OK |
| Layer 4: Layout | Struktur, keine Komponenten | ✅ `layout.css` + `md3/layout.css` korrekt | ✅ OK |
| Layer 5: Components | Komponenten-Klassen | ❌ 5 Regeln liegen in branding.css | ❌ **VIOLATION** |

**Kritisch:**
- **Layer 2 Violation:** branding.css mischt Brand-Tokens mit Component-Regeln
- **Cascade-Risk:** Component-Regeln laden FRÜHER als ihre natürliche Datei → Konflikte

---

## 5. Empfohlene Fixes (Priorisierung)

### 5.1 KRITISCH (Must-Fix)
1. **Verschiebe `.md3-navigation-drawer__logo` nach `navigation-drawer.css`**
   - Grund: Logo funktioniert nicht korrekt (border-radius fehlt)
   - Impakt: Hoch (User-visible Bug)

2. **Verschiebe Index-Regeln nach `index.css`**
   - Grund: Spacing-Konflikte, unklare Verantwortlichkeit
   - Impakt: Mittel (visuelle Inkonsistenz)

3. **Lösche unused Regeln** (`.md3-index-brand__text`, `.md3-index-tagline`)
   - Grund: Tote Code-Reduzierung
   - Impakt: Niedrig (nur Cleanup)

### 5.2 WICHTIG (Should-Fix)
4. **CSS-Ladereihenfolge dokumentieren** (in Kommentar in base.html)
   - Grund: Verhindert künftige Fehler
   - Impakt: Niedrig (präventiv)

5. **Lint-Script erstellen** (`check-css-architecture.ps1`)
   - Grund: Automatische Prüfung bei CI
   - Impakt: Hoch (langfristige Sicherheit)

---

## 6. Migration Plan

### Phase 1: Refactor (branding.css Cleanup)
- [x] Analysiere branding.css (dieser Report)
- [ ] Verschiebe `.md3-navigation-drawer__logo` → `navigation-drawer.css`
- [ ] Verschiebe Index-Regeln → `index.css`
- [ ] Lösche unused Regeln
- [ ] Test: Nav Drawer Logo hat border-radius
- [ ] Test: Index Spacing korrekt

### Phase 2: Guardrails (Prävention)
- [ ] Erstelle `scripts/check-css-architecture.ps1`
- [ ] Integriere in CI (oder pre-commit)
- [ ] Dokumentiere in `docs/md3/css-architecture.md`

### Phase 3: Langfristig
- [ ] Prüfe weitere CSS-Dateien auf Layer-Violations
- [ ] Erweitere Lint-Regeln (z.B. "keine Hex-Werte in Components")

---

## 7. Risiko-Assessment

| Risk | Wahrscheinlichkeit | Impakt | Mitigation |
|------|-------------------|--------|------------|
| Regression durch Refactor | Niedrig | Mittel | Visual Regression Test (manuell) |
| Cascading-Konflikte bleiben | Mittel | Hoch | Lint-Script + CI |
| Unentdeckte Layer-Violations | Mittel | Mittel | Vollständiger CSS-Audit (später) |

**Empfehlung:** Refactor durchführen + Guardrails sofort implementieren.

---

## 8. Referenzen

- [background-standardization-report.md](./background-standardization-report.md) – Verwandter Token-System-Refactor
- [MD3 CSS Guidelines](https://m3.material.io) – Google Material Design 3 Best Practices
- [CSS Cascade Spec](https://www.w3.org/TR/css-cascade-4/) – W3C Cascade Order

---

**Kontakt:** Siehe [CONTRIBUTING.md](../../CONTRIBUTING.md)
