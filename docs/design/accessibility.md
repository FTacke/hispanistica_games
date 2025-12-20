---
title: "Accessibility Guidelines"
status: active
owner: frontend-team
updated: "2025-11-07"
tags: [accessibility, a11y, wcag, contrast]
links:
  - design-system-overview.md
  - design-tokens.md
---

# Accessibility Guidelines

Barrierefreiheitsstandards und Best Practices für CO.RA.PAN.

---

## WCAG Compliance

**Target Level:** WCAG 2.1 Level AA

### Kontrast-Verhältnisse

Alle Farbkombinationen erfüllen **WCAG AA** (4.5:1 für Normal-Text, 3:1 für Large-Text):

| Vordergrund | Hintergrund | Verhältnis | Status |
|-------------|-------------|------------|--------|
| `--color-text` (#244652) | `--color-bg` (#c7d5d8) | **6.2:1** | ✅ AAA |
| `--color-text` (#244652) | `--color-surface` (#eaf3f5) | **7.8:1** | ✅ AAA |
| `--color-text-muted` (#3a6070) | `--color-bg` (#c7d5d8) | **4.7:1** | ✅ AA |
| `white` (#ffffff) | `--color-accent` (#2f5f73) | **5.9:1** | ✅ AAA |
| `--color-error` (#913535) | `--color-surface` (#eaf3f5) | **5.2:1** | ✅ AA |

**Tool für Contrast-Checks:**
```bash
# LOKAL/00 - Md3-design/contrast_check.py
python contrast_check.py
```

**Output:** `contrast-report.txt`

---

## Semantic HTML

### Proper Heading Hierarchy

```html
<!-- ✅ RICHTIG -->
<h1>CO.RA.PAN</h1>
<h2>Corpus</h2>
<h3>Resultados</h3>

<!-- ❌ FALSCH -->
<h1>CO.RA.PAN</h1>
<h3>Corpus</h3>  <!-- h2 übersprungen -->
```

### ARIA Landmarks

```html
<header role="banner">
  <nav role="navigation" aria-label="Main navigation">
    <!-- ... -->
  </nav>
</header>

<main role="main">
  <!-- Main content -->
</main>

<footer role="contentinfo">
  <!-- ... -->
</footer>
```

---

## Keyboard Navigation

### Focus Styles

```css
*:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Remove outline for mouse users */
*:focus:not(:focus-visible) {
  outline: none;
}
```

### Tab Order

```html
<!-- Links/Buttons erhalten automatisch tabindex="0" -->
<button>Buscar</button>
<a href="/corpus">Corpus</a>

<!-- Dekorative Elemente aus Tab-Order entfernen -->
<div role="presentation" tabindex="-1">...</div>
```

---

## Screen Reader Support

### alt-Text für Bilder

```html
<!-- ✅ RICHTIG -->
<img src="logo.png" alt="CO.RA.PAN Logo">

<!-- Dekorative Bilder -->
<img src="divider.png" alt="" role="presentation">
```

### ARIA Labels

```html
<!-- Icon-only Buttons -->
<button aria-label="Abrir menú">
  <i class="material-symbols-rounded">menu</i>
</button>

<!-- Form Inputs -->
<input type="search" aria-label="Buscar en el corpus" placeholder="Palabra...">
```

### sr-only Helper

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

```html
<button>
  <span class="sr-only">Buscar</span>
  <i class="material-symbols-rounded" aria-hidden="true">search</i>
</button>
```

---

## HTML Entities

**Problem:** Non-ASCII-Zeichen in Templates können Encoding-Probleme verursachen.

**Lösung:** HTML-Entities verwenden:

```html
<!-- ✅ RICHTIG -->
&iacute;  <!-- í -->
&ntilde;  <!-- ñ -->
&aacute;  <!-- á -->
&eacute;  <!-- é -->
&uacute;  <!-- ú -->

<!-- ❌ VERMEIDEN (direktes UTF-8) -->
País   <!-- Kann zu Mojibake führen -->
```

---

## Motion & Animation

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Respektiert User-Präferenz** für reduzierte Animationen.

---

## Interactive Element Sizing

### Minimum Touch Target

**WCAG 2.5.5:** Mindestens 44×44px für Touch-Targets

```css
.btn,
.icon-button {
  min-width: 44px;
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
}
```

---

## Form Accessibility

### Labels & Placeholders

```html
<!-- ✅ RICHTIG -->
<label for="search-input">Buscar:</label>
<input id="search-input" type="text" placeholder="Palabra...">

<!-- ❌ FALSCH (nur Placeholder) -->
<input type="text" placeholder="Buscar">
```

### Error Messages

```html
<input 
  id="username" 
  type="text" 
  aria-invalid="true" 
  aria-describedby="username-error"
>
<span id="username-error" role="alert">
  El nombre de usuario es requerido
</span>
```

---

## Audio Player Accessibility

### Player Controls

```html
<button 
  class="audio-button" 
  aria-label="Reproducir audio: 2023-08-10_ARG_Mitre.mp3 desde 1.5s hasta 3.2s"
  data-audio-file="2023-08-10_ARG_Mitre.mp3"
  data-start="1.5"
  data-end="3.2"
>
  <i class="material-symbols-rounded" aria-hidden="true">play_arrow</i>
</button>
```

---

## Testing Tools

### Automated Testing

```bash
# pa11y CI für automatische A11y-Tests
npm install -g pa11y-ci
pa11y-ci --config LOKAL/00 - Md3-design/pa11yci.json
```

**Config:** `pa11yci.json`
```json
{
  "urls": [
    "http://127.0.0.1:8000/",
    "http://127.0.0.1:8000/corpus",
    "http://127.0.0.1:8000/atlas"
  ],
  "standard": "WCAG2AA"
}
```

### Manual Testing

- **Keyboard-Only Navigation**: Tab durch gesamte Seite
- **Screen Reader**: NVDA (Windows), VoiceOver (macOS)
- **Color Blindness**: Chrome DevTools → Rendering → Emulate Vision Deficiencies

---

## Siehe auch

- [Design System Overview](design-system-overview.md)
- [Design Tokens](design-tokens.md) - Kontrast-konforme Farben
- [Mobile Speaker Layout](mobile-speaker-layout.md) - Mobile A11y
