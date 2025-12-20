# MD3 Toolbar & Filters – Goldstandard

> **Status:** v1.2 – Advanced Phase  
> **Letzte Aktualisierung:** 2025-01-27

---

## Audit-Ergebnis

| Fundort | Aktuelle Struktur | Status |
|---------|-------------------|--------|
| `auth/admin_users.html` | `.md3-toolbar` (nur Actions) | ⚠️ Unvollständig |
| `search/partials/filters_block.html` | `.md3-filters-grid` | ✅ Eigenständig |
| `search/advanced.html` | `.md3-search-card__footer` | ✅ Eigene Struktur |

### Befunde
1. **admin_users.html**: Toolbar nur für Actions, kein Filter-Bereich
2. **filters_block.html**: Komplexe Filter-Grid-Struktur, funktioniert
3. **Fehlend**: Einheitliche `.md3-toolbar` mit filters/actions-Trennung

---

## Goldstandard-Struktur

### Standard Toolbar

```html
<div class="md3-toolbar">
  <div class="md3-toolbar__filters">
    <!-- Search/Filter Inputs -->
    <div class="md3-searchfield">
      <span class="material-symbols-rounded md3-searchfield__icon">search</span>
      <input type="text" class="md3-searchfield__input" placeholder="Suchen...">
      <button class="md3-searchfield__clear" hidden>
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>
    
    <!-- Optional: Select/Dropdown -->
    <select class="md3-select">
      <option>Alle</option>
    </select>
  </div>
  
  <div class="md3-toolbar__actions">
    <button class="md3-button md3-button--text">Reset</button>
    <button class="md3-button md3-button--filled">Anwenden</button>
  </div>
</div>
```

### Compact Toolbar (nur Actions)

```html
<div class="md3-toolbar md3-toolbar--compact">
  <button class="md3-button md3-button--outlined">
    <span class="material-symbols-rounded md3-button__icon">refresh</span>
    Aktualisieren
  </button>
  <button class="md3-button md3-button--filled">
    <span class="material-symbols-rounded md3-button__icon">add</span>
    Neu
  </button>
</div>
```

---

## CSS-Regeln

### Toolbar Container
| Eigenschaft | Wert |
|------------|------|
| Display | `flex` |
| Justify | `space-between` |
| Align | `center` |
| Gap | `16px` (var(--space-4)) |
| Flex-Wrap | `wrap` |

### Filters Section
| Eigenschaft | Wert |
|------------|------|
| Display | `flex` |
| Gap | `12px` (var(--space-3)) |
| Align | `center` |
| Flex | `1 1 auto` |

### Actions Section
| Eigenschaft | Wert |
|------------|------|
| Display | `flex` |
| Gap | `8px` (var(--space-2)) |
| Flex-Shrink | `0` |

---

## Mobile Verhalten (< 600px)

```css
@media (max-width: 599px) {
  .md3-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .md3-toolbar__filters,
  .md3-toolbar__actions {
    width: 100%;
  }
  
  .md3-toolbar__actions {
    justify-content: flex-end;
    margin-top: var(--space-3);
  }
}
```

---

## Button-Semantik in Toolbars

| Aktion | Button-Typ |
|--------|-----------|
| Primäre Aktion (Suchen, Anwenden, Neu) | `.md3-button--filled` |
| Sekundäre Aktion (Aktualisieren) | `.md3-button--outlined` |
| Tertiary (Reset, Abbrechen) | `.md3-button--text` |

---

## Filter-Grid (Erweitert)

Für komplexe Filter-Bereiche (wie in Advanced Search):

```html
<div class="md3-filters-grid">
  <div class="md3-filter-field" data-facet="pais">
    <div class="md3-filter-field__trigger" role="button">
      <label class="md3-filter-field__label">País</label>
      <div class="md3-filter-field__value">Todos</div>
      <span class="material-symbols-rounded md3-filter-field__icon">expand_more</span>
    </div>
    <div class="md3-filter-field__menu" hidden>
      <!-- Options -->
    </div>
  </div>
</div>
```

### Grid Breakpoints
| Breakpoint | Columns |
|------------|---------|
| > 1200px | 5 |
| 769–1200px | 3 |
| < 768px | 2 |

---

## Varianten

| Variante | Klasse | Verwendung |
|----------|--------|------------|
| Standard | `.md3-toolbar` | Filters + Actions |
| Compact | `.md3-toolbar--compact` | Nur Actions |
| Stacked | `.md3-toolbar--stacked` | Vertikal auf Mobile |
