# MD3 Pagination – Goldstandard

> **Status:** v1.2 – Advanced Phase  
> **Letzte Aktualisierung:** 2025-01-27

---

## Audit-Ergebnis

| Fundort | Aktuelle Implementierung | Status |
|---------|--------------------------|--------|
| `search/_results.html` | `.md3-pagination` mit Buttons | ✅ Korrekt |
| `partials/page_navigation.html` | Prev/Next Macro | ⚠️ Eigene Struktur |

### Befunde
1. **_results.html**: Bereits MD3-konform mit `.md3-pagination`
2. **page_navigation.html**: Verwendet eigenes Macro, prüfen
3. **Fehlend**: Pagination CSS-Datei (Styles inline/verteilt)

---

## Goldstandard-Struktur

### Standard Pagination

```html
<nav class="md3-pagination" aria-label="Seitennavigation">
  <button 
    class="md3-pagination__prev md3-button md3-button--outlined"
    aria-label="Vorherige Seite"
    disabled>
    <span class="material-symbols-rounded md3-button__icon">chevron_left</span>
    <span class="md3-button__label">Zurück</span>
  </button>
  
  <span class="md3-pagination__info">
    Seite 1 von 10
  </span>
  
  <button 
    class="md3-pagination__next md3-button md3-button--outlined"
    aria-label="Nächste Seite">
    <span class="md3-button__label">Weiter</span>
    <span class="material-symbols-rounded md3-button__icon">chevron_right</span>
  </button>
</nav>
```

### Mit Ergebnis-Info (wie in Search)

```html
<nav class="md3-pagination" aria-label="Navegación de resultados">
  <a href="..." class="md3-button md3-button--outlined">
    <span class="material-symbols-rounded md3-button__icon">chevron_left</span>
    <span class="md3-button__label">Anterior</span>
  </a>
  
  <span class="md3-pagination__info">
    Resultados 1 – 20 de 150
  </span>
  
  <a href="..." class="md3-button md3-button--outlined">
    <span class="md3-button__label">Siguiente</span>
    <span class="material-symbols-rounded md3-button__icon">chevron_right</span>
  </a>
</nav>
```

### Disabled State

```html
<span class="md3-button md3-button--outlined md3-button--disabled" aria-disabled="true">
  <span class="material-symbols-rounded md3-button__icon">chevron_left</span>
  <span class="md3-button__label">Anterior</span>
</span>
```

---

## CSS-Regeln

### Container
| Eigenschaft | Wert |
|------------|------|
| Display | `flex` |
| Justify-Content | `center` |
| Align-Items | `center` |
| Gap | `16px` (var(--space-4)) |
| Padding | `24px 0` (var(--space-6)) |

### Info Text
| Eigenschaft | Wert |
|------------|------|
| Font | `label-medium` (12px, 500) |
| Color | `var(--md-sys-color-on-surface-variant)` |
| Text-Align | `center` |
| Min-Width | `120px` |

### Buttons
- Verwenden Standard `.md3-button--outlined`
- Icons: `chevron_left` / `chevron_right`
- Disabled: `.md3-button--disabled` + `aria-disabled="true"`

---

## Mobile (< 600px)

```css
@media (max-width: 599px) {
  .md3-pagination {
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  
  .md3-pagination__info {
    order: -1;
    width: 100%;
    text-align: center;
    margin-bottom: var(--space-2);
  }
  
  .md3-pagination .md3-button__label {
    /* Optional: Hide labels on mobile, show only icons */
    display: none;
  }
}
```

---

## Varianten

| Variante | Klasse | Verwendung |
|----------|--------|------------|
| Standard | `.md3-pagination` | Seite X von Y |
| Results | `.md3-pagination` | Ergebnisse X–Y von Z |
| Compact | `.md3-pagination--compact` | Nur Icons |
| Numbered | `.md3-pagination--numbered` | Mit Seitenzahlen |

### Compact (Icons Only)
```html
<nav class="md3-pagination md3-pagination--compact">
  <button class="md3-icon-button" aria-label="Vorherige">
    <span class="material-symbols-rounded">chevron_left</span>
  </button>
  <span class="md3-pagination__info">1 / 10</span>
  <button class="md3-icon-button" aria-label="Nächste">
    <span class="material-symbols-rounded">chevron_right</span>
  </button>
</nav>
```

---

## HTMX Integration

```html
<a 
  href="{{ prev_url }}"
  class="md3-button md3-button--outlined"
  hx-get="{{ prev_url }}"
  hx-target="#results"
  hx-indicator="#loading"
  hx-push-url="true">
  <span class="material-symbols-rounded md3-button__icon">chevron_left</span>
  <span class="md3-button__label">Anterior</span>
</a>
```

---

## ARIA

- Container: `role="navigation"`, `aria-label="Seitennavigation"`
- Buttons: `aria-label` für Screen Reader
- Disabled: `aria-disabled="true"` (nicht `disabled` bei Links)
- Current: Optional `aria-current="page"` wenn relevant
