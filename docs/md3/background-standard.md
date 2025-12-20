# MD3 Background & Token Standard

**Projekt:** games.hispanistica  
**Letzte Aktualisierung:** 2025-12-20  
**Status:** Kanonisch (Standardisierung abgeschlossen)

---

## Überblick

Dieses Dokument definiert den **kanonischen Standard** für das MD3-Token-System und Background-Farben im Projekt. Nach der Standardisierung gibt es eine eindeutige Token-Hierarchie, konsistente Dark-Mode-Mechanik und keine hardcodierten Background-Werte außerhalb von Token-Definitionen.

**Prinzipien:**
1. **Light Mode ist Default** – App startet immer hell, unabhängig von System-Präferenz
2. **Eine Token-Hierarchie** – `--md-sys-color-*` ist Source of Truth
3. **`data-theme` steuert Dark Mode** – keine `@media (prefers-color-scheme)` außer in Critical CSS
4. **Keine Hardcodes** – alle Backgrounds nutzen Tokens

---

## Token-Hierarchie (Option A)

```
┌─────────────────────────────────────────────────────────┐
│ SOURCE OF TRUTH: tokens.css                            │
│ --md-sys-color-background: #F3F6F7 (Light)            │
│ --md-sys-color-surface: #EEF2F4                       │
│ --md-sys-color-primary: #0F4C5C                       │
│ ... (alle MD3 System Tokens)                          │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ BRAND LAYER: branding.css                             │
│ Definiert: --brand-background, --brand-primary, etc. │
│ Mappt:     --md-sys-color-* → var(--brand-*)         │
│ Zweck:     Projekt-spezifische Farbwerte             │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ APP SEMANTICS: app-tokens.css                         │
│ Definiert: --app-background, --app-color-success     │
│ Referenz:  var(--md-sys-color-background)            │
│ Zweck:     App-spezifische semantische Variablen     │
└─────────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ COMPONENTS: *.css                                      │
│ Nutzen:    var(--app-background)                      │
│            var(--md-sys-color-surface)                │
│            var(--md-sys-color-primary)                │
└─────────────────────────────────────────────────────────┘
```

### Regeln

1. **tokens.css** definiert ALLE `--md-sys-color-*` Tokens (Light + Dark via `data-theme`)
2. **branding.css** definiert `--brand-*` und mappt auf `--md-sys-color-*` (überschreibt Base-Werte)
3. **app-tokens.css** definiert `--app-*` und referenziert `--md-sys-color-*` (keine `--brand-*` Direktzugriffe)
4. **Components** nutzen `--app-*` oder `--md-sys-color-*` (keine `--brand-*` Direktzugriffe)

**Verboten:**
- ❌ `branding.css` überschreibt `--app-background` (nur in `app-tokens.css`)
- ❌ Components definieren eigene `--md-sys-color-*` Overrides
- ❌ Direkte Hex-Werte in Components (außer funktional wie Transcription Highlights)

---

## Dark Mode Mechanik

### Single Source of Truth: `data-theme` Attribute

**HTML Root Attribute:**
```html
<html data-theme="light">           <!-- Explizit Light -->
<html data-theme="dark">            <!-- Explizit Dark -->
<html data-theme="auto" data-system-dark="true">  <!-- Folgt System -->
```

**CSS Selektoren (kanonisch):**
```css
:root,
:root[data-theme="light"] {
  --md-sys-color-background: #F3F6F7;
  /* Light Mode Tokens */
}

:root[data-theme="dark"],
:root[data-theme="auto"][data-system-dark="true"] {
  --md-sys-color-background: #041317;
  /* Dark Mode Tokens */
}
```

**Keine `@media (prefers-color-scheme: dark)` außer:**
- ✅ Critical CSS in `base.html` (FOUC Prevention)
- ❌ Alle anderen CSS-Dateien (nutzen `data-theme`)

### JavaScript Theme Controller

**Datei:** `static/js/theme.js`

**API:**
```javascript
window.SiteTheme.set('light');    // Erzwingt Light Mode
window.SiteTheme.set('dark');     // Erzwingt Dark Mode
window.SiteTheme.set('auto');     // Folgt System (aber Start ist light)
window.SiteTheme.get();           // Gibt persistierten Modus zurück
window.SiteTheme.getEffective();  // Gibt aktuellen resolved Modus zurück
window.SiteTheme.toggle();        // Wechselt zwischen light/dark
```

**Default-Mechanik:**
```javascript
const load = () => {
  const stored = localStorage.getItem(KEY);
  // HARDENED: auto oder fehlend → light
  if (!stored || stored === "auto") {
    return "light";
  }
  return stored;
};
```

**Resultat:** Selbst bei System Dark Mode startet App immer Light (bis User explizit Dark wählt).

---

## Background-Tokens Mapping

### Primäre Background-Variablen

| Token | Zweck | Light | Dark | Definiert in |
|-------|-------|-------|------|--------------|
| `--md-sys-color-background` | Haupthintergrund (Seiten) | `#F3F6F7` | `#041317` | tokens.css → branding.css |
| `--md-sys-color-surface` | Cards/Dialogs Basis | `#EEF2F4` | `#041317` | tokens.css → branding.css |
| `--md-sys-color-surface-container-low` | Drawer, niedrige Elevation | `#F7FAFB` | `#061A1F` | tokens.css → branding.css |
| `--app-background` | App-spezifischer Alias | = `--md-sys-color-background` | = `--md-sys-color-background` | app-tokens.css |

### Surface Container Hierarchy (MD3)

```
surface-container-lowest   →  Hellste Fläche (Light) / Dunkelste (Dark)
surface-container-low      →  ↑ Elevation
surface-container          →  ↑
surface-container-high     →  ↑
surface-container-highest  →  Dunkelste Fläche (Light) / Hellste (Dark)
```

**In Light Mode:** Höhere Container sind dunkler (mehr Tiefe)  
**In Dark Mode:** Höhere Container sind heller (Elevation nach oben)

---

## Zentrale Background-Klassen

### HTML/Body
```css
/* templates/base.html Critical CSS */
html, body {
  background: var(--app-background);
  color: var(--md-sys-color-on-background);
}
```

### Main Content
```css
/* static/css/layout.css */
#main-content,
main.site-main,
.site-main {
  background: var(--md-sys-color-background);
  color: var(--md-sys-color-on-background);
}
```

### Footer
```css
/* static/css/md3/components/footer.css */
.md3-footer {
  background: var(--app-background);
  color: var(--md-sys-color-on-surface-variant);
}
```

### Text Pages
```css
/* static/css/md3/components/text-pages.css */
.md3-text-page {
  background: var(--app-background);
  color: var(--md-sys-color-on-surface);
}
```

### Navigation Drawer
```css
/* static/css/md3/components/navigation-drawer.css */
.md3-navigation-drawer--standard {
  background: var(--md-sys-color-surface-container-low);
}
```

---

## Anti-Patterns (Verboten)

### ❌ 1. Hardcodierte Hex-Werte in Components
```css
/* FALSCH */
.my-component {
  background: #F3F6F7;
}

/* RICHTIG */
.my-component {
  background: var(--app-background);
}
```

### ❌ 2. @media Dark Mode in Components
```css
/* FALSCH */
@media (prefers-color-scheme: dark) {
  .my-component {
    background: #041317;
  }
}

/* RICHTIG */
:root[data-theme="dark"],
:root[data-theme="auto"][data-system-dark="true"] {
  .my-component {
    background: var(--app-background);
  }
}
```

### ❌ 3. Transparent ohne Parent-Context
```css
/* RISKANT */
.wrapper {
  background: transparent; /* Welcher Background kommt durch? */
}

/* BESSER */
.wrapper {
  background: var(--md-sys-color-surface); /* Explizit */
}
```

### ❌ 4. Token-Overrides in branding.css
```css
/* FALSCH in branding.css */
--app-background: var(--brand-background);

/* RICHTIG: Nur in app-tokens.css */
```

---

## CSS-Ladereihenfolge (base.html)

Reihenfolge ist kritisch für Cascade:

```html
1. layout.css              (Grid/Layout Struktur)
2. md3/tokens.css          (MD3 Base Tokens)
3. app-tokens.css          (App-spezifische Tokens)
4. branding.css            (Brand Overrides)
5. md3/tokens-legacy-shim  (Legacy Aliases)
6. Component CSS           (Buttons, Footer, etc.)
```

**Cascade-Effekt:**
- `tokens.css` definiert `--md-sys-color-background: #F3F6F7`
- `branding.css` überschreibt `--md-sys-color-background: var(--brand-background)` wo `--brand-background: #F3F6F7`
- `app-tokens.css` definiert `--app-background: var(--md-sys-color-background)`
- Components nutzen `var(--app-background)`

**Resultat:** Brand-Farben greifen, aber Token-Namen bleiben kanonisch.

---

## Validierung

### Automatisches Skript
```powershell
.\scripts\validate-md3-background.ps1
```

**Prüft:**
1. Keine hardcodierten Hex-Backgrounds (außer Tokens/Branding/Transcription)
2. Keine `@media (prefers-color-scheme: dark)` außer Critical CSS
3. `data-theme="light"` in `base.html`
4. Default `"light"` in `theme.js`
5. Keine `--app-background` Overrides in `branding.css`
6. Critical CSS nutzt `data-theme` Selektoren

### Manueller Test
1. **Öffne App in frischem Browser** (Inkognito/privat)
2. **System Dark Mode aktivieren**
3. **Navigiere zu:** Index, Textpage (Impressum), Footer
4. **Erwartung:** Alles ist hell (#F3F6F7 Background)
5. **Toggle Dark Mode** via UI
6. **Erwartung:** Alles wird dunkel (#041317 Background)

---

## Troubleshooting

### Problem: Seite startet dunkel trotz Light Default
**Ursache:** Critical CSS nutzt `@media` statt `data-theme`  
**Fix:** Siehe `base.html` Critical CSS (muss `data-theme` Selektoren nutzen)

### Problem: Component ist transparent/falsche Farbe
**Ursache:** Component definiert keinen Background oder nutzt veraltetes Token  
**Fix:** Setze `background: var(--app-background)` oder `var(--md-sys-color-surface)`

### Problem: Dark Mode greift nicht
**Ursache:** Component nutzt `@media` statt `data-theme`  
**Fix:** Ersetze `@media (prefers-color-scheme: dark)` mit `:root[data-theme="dark"]`

### Problem: Token-Wert ist unerwartet
**Debug-Snippet:** (Browser Console)
```javascript
const root = getComputedStyle(document.documentElement);
console.log({
  'data-theme': document.documentElement.dataset.theme,
  '--app-background': root.getPropertyValue('--app-background').trim(),
  '--md-sys-color-background': root.getPropertyValue('--md-sys-color-background').trim(),
  '--brand-background': root.getPropertyValue('--brand-background').trim()
});
```

---

## Änderungshistorie

| Datum | Änderung | Autor |
|-------|----------|-------|
| 2025-12-20 | Initial-Standardisierung: Light Default erzwungen, @media entfernt, Token-Hierarchie vereinheitlicht | MD3-Token-Integration |

---

## Referenzen

- [MD3 Color System](https://m3.material.io/styles/color/system/overview)
- [MD3 Dark Theme](https://m3.material.io/styles/color/dark-theme/overview)
- [background-standardization-report.md](./background-standardization-report.md) – Analyse-Bericht

---

**Kontakt bei Fragen:** Siehe [CONTRIBUTING.md](../../CONTRIBUTING.md)
