# MD3 Tabs – Goldstandard

> **Status:** v1.2 – Advanced Phase  
> **Letzte Aktualisierung:** 2025-01-27

---

## Audit-Ergebnis

| Fundort | Aktuelle Klassen | Status |
|---------|------------------|--------|
| `search/advanced.html` | `.md3-tabs`, `.md3-tab`, `.md3-tab--active` | ✅ Korrekt |
| `pages/editor_overview.html` | `.md3-country-tabs`, `.md3-country-tab` | ⚠️ Eigene Variante |
| Sub-Tabs (Resultados/Estadísticas) | `.md3-sub-tabs`, `.md3-sub-tab` | ✅ Korrekt |

### Befunde
1. **advanced.html**: Bereits MD3-konform mit korrektem Active-Indikator
2. **editor_overview.html**: Verwendet eigene Klassen, sollte auf Standard umgestellt werden
3. **State-Layer**: Vorhanden via `::before` pseudo-element
4. **Mobile**: Scrollable Tabs implementiert

---

## Goldstandard-Struktur

```html
<!-- Primary Tabs -->
<nav class="md3-tabs" role="tablist">
  <button class="md3-tab md3-tab--active" role="tab" aria-selected="true" data-tab="tab1">
    Tab 1
  </button>
  <button class="md3-tab" role="tab" aria-selected="false" data-tab="tab2">
    Tab 2
  </button>
</nav>

<!-- Tab Content -->
<section id="tab-1" class="md3-tab-content md3-tab-content--active">
  ...
</section>
<section id="tab-2" class="md3-tab-content">
  ...
</section>
```

### Secondary/Sub-Tabs

```html
<div class="md3-sub-tabs">
  <button class="md3-sub-tab md3-sub-tab--active">Resultados</button>
  <button class="md3-sub-tab">Estadísticas</button>
</div>
```

---

## CSS-Regeln

### Primary Tabs
| Eigenschaft | Wert |
|------------|------|
| Padding | `16px 24px` (var(--space-4) var(--space-6)) |
| Typografie | `label-large` (14px, 500) |
| Active Indikator | 3px, `--md-sys-color-primary`, rounded top |
| Hover State | 8% on-surface overlay |
| Gap zwischen Tabs | `8px` (var(--space-2)) |

### Mobile (< 600px)
| Eigenschaft | Wert |
|------------|------|
| Container | `overflow-x: auto` |
| Tab | `white-space: nowrap`, `flex-shrink: 0` |
| Padding | `8px 12px` |
| Font-Size | `11px` |

---

## State-Layer

```css
.md3-tab::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--md-sys-color-on-surface);
  opacity: 0;
  transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1);
}

.md3-tab:hover::before { opacity: 0.08; }
.md3-tab:focus-visible::before { opacity: 0.12; }
.md3-tab:active::before { opacity: 0.12; }
```

---

## ARIA-Anforderungen

- Container: `role="tablist"`
- Tabs: `role="tab"`, `aria-selected="true|false"`
- Content: `role="tabpanel"`, `id` matching `aria-controls`
- Keyboard: Arrow keys for navigation, Enter/Space to activate

---

## Varianten

| Variante | Klasse | Verwendung |
|----------|--------|------------|
| Primary | `.md3-tabs` | Haupt-Navigation innerhalb einer Seite |
| Secondary | `.md3-sub-tabs` | Unter-Navigation (z.B. Resultados/Estadísticas) |
| Scrollable | automatisch via `overflow-x: auto` | Mobile |

---

## Migration

### Von Legacy `.md3-country-tabs`:
```html
<!-- Alt -->
<div class="md3-country-tabs" role="tablist">
  <button class="md3-country-tab active">ARG</button>
</div>

<!-- Neu -->
<nav class="md3-tabs md3-tabs--compact" role="tablist">
  <button class="md3-tab md3-tab--active" role="tab">ARG</button>
</nav>
```
