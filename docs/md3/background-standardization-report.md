# MD3 Background-Standardisierung – Ist-Zustand Analyse

**Projekt:** games.hispanistica  
**Datum:** 2025-12-20  
**Status:** Analyse abgeschlossen, Fixes folgen

---

## Executive Summary

Das MD3-Token-System ist **inkonsistent implementiert**. Es existieren mehrere parallele Definitionen, widersprüchliche Dark-Mode-Selektoren und ein Default-Zustand, der von der System-Präferenz abhängt. Dies führt zu unvorhersehbarem Verhalten: Manche Seiten/Komponenten zeigen unerwartet dunkle Hintergründe.

**Hauptprobleme:**
1. **Light Mode ist NICHT Default** – `theme.js` startet mit `light`, aber Critical CSS nutzt `@media (prefers-color-scheme: dark)`, wodurch System-Theme greift
2. **Drei parallele Token-Systeme** ohne klare Hierarchie (`--md-sys-*`, `--brand-*`, `--app-*`)
3. **Doppelte Dark-Mode-Definitionen** (`@media` vs `data-theme`) konkurrieren miteinander
4. **Background-Token sind mehrdeutig** (tokens.css definiert, branding.css überschreibt, app-tokens.css überschreibt erneut)

---

## 1. Theme-Mechanik (Wahrheit ermittelt)

### 1.1 Wo wird `data-theme` gesetzt?

**Template:** `templates/base.html:2`
```html
<html lang="en" class="no-js" data-theme="light">
```
✅ Initial: `data-theme="light"` hardcodiert

**JavaScript:** `static/js/theme.js:26`
```javascript
const load = () => localStorage.getItem(KEY) || "light"; // Default: light
```
✅ localStorage-Fallback ist `"light"`

**Problem:** Obwohl beide Stellen `light` als Default angeben, greift das Critical CSS in `base.html:15-19` per `@media (prefers-color-scheme: dark)`:
```css
@media (prefers-color-scheme: dark) {
  :root {
    --app-background: #041317;
  }
}
```
**→ Resultat:** Bei System-Dark-Mode wird Initial-Background dunkel, bevor Theme-System übernimmt.

### 1.2 Welche Zustände gibt es?

- `data-theme="light"` – Helles Theme erzwungen
- `data-theme="dark"` – Dunkles Theme erzwungen
- `data-theme="auto"` – Folgt `prefers-color-scheme` (gesetzt via `data-system-dark="true|false"`)

**Aktueller Default:** `light` (laut Code), aber **@media überschreibt Initial-State**.

### 1.3 Gibt es `data-system-dark="true"`?

✅ **Ja**, gesetzt durch `theme.js:17-19`:
```javascript
const setSysFlag = () => {
  root.dataset.systemDark = sysDark() ? "true" : "false";
};
```
Wird initial aufgerufen (Zeile 51) und bei System-Präferenz-Änderung (Zeile 72).

---

## 2. CSS-Ladereihenfolge und Cascade

### 2.1 Reihenfolge in `base.html` (Zeilen 60-82)

| Reihenfolge | Datei | Zweck |
|-------------|-------|-------|
| 1 | `layout.css` | Body/Grid-Layout |
| 2 | `md3/tokens.css` | **MD3 Base Tokens** (Primary Source) |
| 3 | `app-tokens.css` | App-spezifische Erweiterungen |
| 4 | **`branding.css`** | **Brand-Overrides** (`--brand-*` → `--md-sys-*` Mapping) |
| 5 | `md3/tokens-legacy-shim.css` | Legacy `--md3-*` Alias |
| 6+ | Component CSS | Buttons, Footer, Text-Pages, etc. |

### 2.2 Critical CSS (`base.html:11-29`)

**Problem:** Definiert `--app-background` **vor** den Token-Dateien laden:
```css
:root {
  --app-background: #F3F6F7;  /* Light */
}
@media (prefers-color-scheme: dark) {
  :root {
    --app-background: #041317;  /* Dark */
  }
}
```

**Cascade-Effekt:**
1. Critical CSS setzt `--app-background` per `@media`
2. `tokens.css` definiert `--md-sys-color-background`
3. `branding.css` überschreibt `--md-sys-color-background` via `--brand-background`
4. `app-tokens.css:26` setzt `--app-background: var(--md-sys-color-background)`
5. **ABER:** `branding.css:147` überschreibt nochmal `--app-background: var(--brand-background)`

**→ Resultat:** `--app-background` kommt final von `branding.css`, NICHT von `app-tokens.css`.

---

## 3. Token-Kette (konkret verfolgt)

### 3.1 Light Mode Token-Fluss

```
GROUND TRUTH (tokens.css:64):
  --md-sys-color-background: #F3F6F7

BRAND OVERRIDE (branding.css:59):
  --brand-background: #F3F6F7

BRAND MAPPING (branding.css:123):
  --md-sys-color-background: var(--brand-background)  ← Überschreibt tokens.css

APP MAPPING (app-tokens.css:26):
  --app-background: var(--md-sys-color-background)

BRAND RE-OVERRIDE (branding.css:147):
  --app-background: var(--brand-background)  ← Überschreibt app-tokens.css

FINAL VALUE:
  --app-background = #F3F6F7 (via --brand-background)
  --md-sys-color-background = #F3F6F7 (via --brand-background)
```

**Problem:** Zirkuläre Referenz zwischen `--md-sys-color-*` und `--brand-*`. `branding.css` mappt beides gleichzeitig.

### 3.2 Dark Mode Token-Fluss

**ZWEI konkurrierende Definitionen:**

#### A) Via `@media (prefers-color-scheme: dark)` in `branding.css:153-261`
```css
@media (prefers-color-scheme: dark) {
  :root {
    --brand-background: #041317;
    --md-sys-color-background: var(--brand-background);
    --app-background: var(--brand-background);
  }
}
```

#### B) Via `data-theme` Attribute in `branding.css:267-412`
```css
:root[data-theme="dark"],
:root[data-theme="auto"][data-system-dark="true"] {
  --brand-background: #041317;
  --md-sys-color-background: var(--brand-background);
  --app-background: var(--brand-background);
}
```

**ZUSÄTZLICH:** `tokens.css:336-396` definiert Dark Mode VIA `data-theme` (NICHT `@media`):
```css
:root[data-theme="dark"],
:root[data-theme="auto"][data-system-dark="true"] {
  --md-sys-color-background: #041317;
  /* ABER: --app-background NICHT hier definiert */
}
```

**→ Resultat:** Dark Mode wird sowohl per `@media` als auch per `data-theme` gesetzt. Bei `data-theme="light"` + System Dark Mode entsteht Konflikt:
- `@media` sagt: Dark
- `data-theme="light"` sagt: Light
- **`@media` gewinnt** (höhere Spezifität in Browser), außer explizite `data-theme` Selektoren überschreiben.

---

## 4. Identifizierte Probleme

### 4.1 Critical CSS vs Token-System

**Konflikt:** Critical CSS nutzt `@media (prefers-color-scheme: dark)` für FOUC-Prevention, aber Theme-System nutzt `data-theme` Attribute.

**Szenario:** User mit System Dark Mode + `data-theme="light"`:
1. Critical CSS setzt `--app-background: #041317` (dunkel)
2. Seite startet visuell dunkel
3. Nach CSS-Load überschreibt `branding.css` via `@media` (bleibt dunkel)
4. Theme-JS setzt `data-theme="light"`, aber `@media` hat höhere Priorität
5. **Seite bleibt dunkel trotz `data-theme="light"`**

**Fix benötigt:** Critical CSS muss `data-theme`-aware sein ODER Initial-State hart auf Light setzen.

### 4.2 Doppelte Dark-Mode-Definitionen

- `tokens.css:336-396` definiert Dark Mode via `data-theme`
- `branding.css:153-261` definiert Dark Mode via `@media`
- `branding.css:267-412` definiert Dark Mode via `data-theme`
- `app-tokens.css:43-47` definiert Dark Mode via `@media`
- `app-tokens.css:52-54` definiert Dark Mode via `data-theme`

**→ Problem:** Inkonsistent. Manche Tokens werden nur via `@media` überschrieben, andere nur via `data-theme`.

### 4.3 Token-Hierarchie unklar

**Ist `--brand-*` oder `--md-sys-*` Source of Truth?**

- `branding.css` definiert BEIDE: `--brand-*` UND überschreibt `--md-sys-*`
- `app-tokens.css` nutzt `--md-sys-*` als Referenz
- Components (footer.css, text-pages.css) nutzen `--app-background` oder `--md-sys-color-background` gemischt

**Empfehlung:** **Option A** (siehe Abschnitt 5) – `--md-sys-color-*` ist kanonisch.

### 4.4 Hardcodierte Hex-Werte

**Gefunden via Grep:**
- Critical CSS: `#F3F6F7`, `#041317` (akzeptabel für FOUC-Prevention)
- `docs/md3/md3_chips/chips.css`: `#14141A` (Legacy, nicht in Produktion)
- Diverse `background: transparent` in Layout-CSS (problematisch, wenn Parent keinen Background setzt)

**Keine kritischen Hardcodes in Production Components gefunden** (footer.css, text-pages.css nutzen korrekt `var(--app-background)` bzw. `var(--md-sys-color-*)`)

---

## 5. Empfohlene Standardisierung

### 5.1 Token-Hierarchie (Option A)

```
SOURCE OF TRUTH: tokens.css (--md-sys-color-*)
                 ↓
BRAND OVERRIDE:  branding.css (--brand-* → --md-sys-color-*)
                 ↓
APP SEMANTICS:   app-tokens.css (--app-* → --md-sys-color-*)
                 ↓
COMPONENTS:      Nutzen --md-sys-color-* oder --app-*
```

**Änderungen:**
1. `branding.css` behält `--brand-*` Definitionen
2. `branding.css` mappt `--brand-*` → `--md-sys-color-*` (wie aktuell)
3. `app-tokens.css` baut NUR auf `--md-sys-color-*` auf (NICHT direkt auf `--brand-*`)
4. **Entferne:** `--app-background: var(--brand-background)` aus `branding.css:147,262,411`

### 5.2 Dark Mode Standardisierung

**Entscheide:** **`data-theme` Attribute als Single Source of Truth**

**Änderungen:**
1. **Entferne ALLE** `@media (prefers-color-scheme: dark)` aus `branding.css`, `app-tokens.css`, `tokens.css` (außer Critical CSS)
2. **Behalte NUR** `:root[data-theme="dark"]` und `:root[data-theme="auto"][data-system-dark="true"]` Selektoren
3. **Critical CSS:** Nutze `data-theme`-aware Inline-Variablen statt `@media`:
   ```css
   :root, :root[data-theme="light"] {
     --app-background: #F3F6F7;
   }
   :root[data-theme="dark"],
   :root[data-theme="auto"][data-system-dark="true"] {
     --app-background: #041317;
   }
   ```

### 5.3 Light Default erzwingen

**Änderungen:**
1. Critical CSS: Kein `@media`, nur `data-theme` Selektoren
2. `theme.js`: Default bleibt `"light"` (bereits korrekt)
3. `base.html`: Bleibt `data-theme="light"` (bereits korrekt)

**Resultat:** Auch bei System Dark Mode startet App immer Light (bis User explizit Dark wählt).

---

## 6. Betroffene Dateien

| Datei | Änderung | Grund |
|-------|----------|-------|
| `templates/base.html` | Critical CSS umbauen (data-theme statt @media) | FOUC-Prevention Light-aware |
| `static/css/md3/tokens.css` | Keine Änderung nötig | Bereits data-theme-aware |
| `static/css/branding.css` | @media entfernen, --app-background Override entfernen | Doppelungen eliminieren |
| `static/css/app-tokens.css` | @media entfernen | Doppelungen eliminieren |
| `static/js/theme.js` | Keine Änderung nötig | Default ist bereits "light" |

**Components:** Keine Änderungen nötig (nutzen bereits Tokens korrekt).

---

## 7. Nächste Schritte

1. ✅ Analyse abgeschlossen
2. ⏳ Critical CSS in `base.html` fixen (data-theme-aware)
3. ⏳ `@media (prefers-color-scheme: dark)` aus branding.css + app-tokens.css entfernen
4. ⏳ `--app-background` Override aus branding.css entfernen (nur in app-tokens.css)
5. ⏳ Validierung: Browser-Test mit System Dark + data-theme="light"
6. ⏳ Dokumentation: `background-standard.md` erstellen

---

## Anhang: Debug-Snippet (temporär)

Um Token-Werte zur Laufzeit zu inspizieren:

```javascript
// In Browser Console
const root = getComputedStyle(document.documentElement);
console.log({
  'data-theme': document.documentElement.dataset.theme,
  'data-system-dark': document.documentElement.dataset.systemDark,
  '--app-background': root.getPropertyValue('--app-background').trim(),
  '--md-sys-color-background': root.getPropertyValue('--md-sys-color-background').trim(),
  '--brand-background': root.getPropertyValue('--brand-background').trim()
});
```

**Erwartete Werte (Light Mode):**
- `data-theme`: `"light"`
- `--app-background`: `#F3F6F7` oder `rgb(243, 246, 247)`
- `--md-sys-color-background`: `#F3F6F7`
- `--brand-background`: `#F3F6F7`

---

**Ende des Berichts**
