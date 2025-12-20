# MD3 Search Field – Goldstandard

> **Status:** v1.2 – Advanced Phase  
> **Letzte Aktualisierung:** 2025-01-27

---

## Audit-Ergebnis

| Fundort | Aktuelle Implementierung | Status |
|---------|--------------------------|--------|
| `auth/admin_users.html` | `.md3-outlined-textfield` | ⚠️ Standard-Textfield |
| `search/advanced.html` | `.md3-outlined-textfield` in Query-Row | ⚠️ Kein Such-Icon |

### Befunde
1. **Kein dediziertes Search-Field**: Aktuell werden normale Textfields verwendet
2. **Fehlend**: Such-Icon links, Clear-Button rechts
3. **Fehlend**: Spezifische Search-Styling

---

## Goldstandard-Struktur

```html
<div class="md3-searchfield">
  <span class="material-symbols-rounded md3-searchfield__icon" aria-hidden="true">search</span>
  <input 
    type="search" 
    class="md3-searchfield__input" 
    placeholder="Suchen..."
    aria-label="Suchen">
  <button 
    type="button" 
    class="md3-searchfield__clear" 
    aria-label="Suche löschen"
    hidden>
    <span class="material-symbols-rounded">close</span>
  </button>
</div>
```

### Inline in Toolbar

```html
<div class="md3-toolbar">
  <div class="md3-toolbar__filters">
    <div class="md3-searchfield md3-searchfield--inline">
      <span class="material-symbols-rounded md3-searchfield__icon">search</span>
      <input type="search" class="md3-searchfield__input" placeholder="Benutzer suchen...">
      <button class="md3-searchfield__clear" hidden>
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>
  </div>
</div>
```

---

## CSS-Regeln

### Container
| Eigenschaft | Wert |
|------------|------|
| Display | `flex` |
| Align-Items | `center` |
| Height | `48px` |
| Background | `var(--md-sys-color-surface-container-low)` |
| Border-Radius | `24px` (full-rounded) |
| Padding | `0 16px` |
| Gap | `12px` |

### Input
| Eigenschaft | Wert |
|------------|------|
| Border | `none` |
| Background | `transparent` |
| Font | `body-large` (16px) |
| Color | `var(--md-sys-color-on-surface)` |
| Flex | `1` |
| Outline | `none` |

### Icons
| Eigenschaft | Wert |
|------------|------|
| Size | `24px` |
| Color (search) | `var(--md-sys-color-on-surface-variant)` |
| Color (clear) | `var(--md-sys-color-on-surface)` |

---

## States

### Focus
```css
.md3-searchfield:focus-within {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}
```

### Clear Button
```css
/* Show when input has value */
.md3-searchfield__input:not(:placeholder-shown) ~ .md3-searchfield__clear {
  display: flex;
}

.md3-searchfield__clear {
  display: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.md3-searchfield__clear:hover {
  background: var(--md-sys-color-surface-container-high);
}
```

---

## Varianten

| Variante | Klasse | Beschreibung |
|----------|--------|--------------|
| Standard | `.md3-searchfield` | Volle Breite, gerundete Ecken |
| Inline | `.md3-searchfield--inline` | Für Toolbar-Einbettung, max-width |
| Outlined | `.md3-searchfield--outlined` | Mit Border statt Hintergrund |

### Outlined Variante
```css
.md3-searchfield--outlined {
  background: transparent;
  border: 1px solid var(--md-sys-color-outline);
}

.md3-searchfield--outlined:focus-within {
  border-color: var(--md-sys-color-primary);
  border-width: 2px;
}
```

---

## Mobile (< 600px)

```css
@media (max-width: 599px) {
  .md3-searchfield {
    width: 100%;
    height: 40px;
  }
  
  .md3-searchfield__input {
    font-size: 14px;
  }
}
```

---

## JavaScript Hook

```javascript
// Clear button functionality
document.querySelectorAll('.md3-searchfield').forEach(field => {
  const input = field.querySelector('.md3-searchfield__input');
  const clear = field.querySelector('.md3-searchfield__clear');
  
  if (input && clear) {
    input.addEventListener('input', () => {
      clear.hidden = !input.value;
    });
    
    clear.addEventListener('click', () => {
      input.value = '';
      clear.hidden = true;
      input.focus();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
});
```

---

## ARIA

- Input: `type="search"`, `aria-label`
- Clear-Button: `aria-label="Suche löschen"`
- Optional: `role="search"` auf Container oder Formular
