# CSS-Audit Quick Reference

## 🔴 Problem gefunden & gelöst

| Problem | Typ | Gelöst |
|---------|-----|--------|
| `static/css/search/advanced.css` existiert | Legacy-Datei | ✅ GELÖSCHT |
| 1065 Zeilen mit Merge-Artefakten | Beschädigt | ✅ ENTFERNT |
| Doppelte Zeilen + Syntaxfehler | Merge-Bug | ✅ WEG |
| Alte Klassen (`.md3-form-row`) | Inkompatibel | ✅ KEINE mehr |

## ✅ Lösung implementiert

```
Alte Struktur                    Neue Struktur (MD3-compliant)
─────────────────────────────────────────────────────────────
static/css/search/               static/css/md3/
  └─ advanced.css                └─ components/
     (1065 lines)                   └─ advanced-search.css
     ❌ GELÖSCHT                        (336 lines)
                                       ✅ AKTIV
```

## 🎯 CSS-Einbindung (in advanced.html)

```html
{% block extra_head %}
  <!-- Reihenfolge MUSS sein: Core → Components → Page → External -->
  <link ... css/md3/tokens.css>                     ← 1. Basis
  <link ... css/md3/typography.css>                ← 2. Text
  <link ... css/md3/components/hero.css>           ← 3. Komponenten
  <link ... css/md3/components/buttons.css>           (9x gesamt)
  ...
  <link ... css/md3/components/advanced-search.css> ← 4. PAGE-SPEZIFISCH
  <link ... cdn.datatables.net/...>                ← 5. Externe Libs
{% endblock %}
```

## 📋 Klassen-Reference

### Query Row (3-col Grid)
```html
<div class="md3-advanced__row md3-advanced__row--query">
  <!-- Column 1: Suchfeld (1fr - flexible) -->
  <input class="md3-outlined-textfield__input" />
  
  <!-- Column 2: Mode-Select (220px - fixed) -->
  <select class="md3-outlined-textfield__input" />
  
  <!-- Column 3: Expert-Toggle (max-content) -->
  <label class="md3-advanced__expert">
    <input type="checkbox" name="expert" />
    <span>Expert/CQL</span>
  </label>
</div>
```

**CSS:**
```css
.md3-advanced__row--query {
  grid-template-columns: 1fr 220px max-content !important;
}

@media (max-width: 960px) {
  .md3-advanced__row--query {
    grid-template-columns: 1fr !important; /* Stacked on tablet */
  }
}
```

### Filter Row (5-col Grid)
```html
<div class="md3-advanced__row md3-advanced__row--filters">
  <!-- 5 Filter-Selects: pais, locutor, sexo, mode, discourse -->
</div>
```

**CSS:**
```css
.md3-advanced__row--filters {
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
}

@media (max-width: 960px) {
  .md3-advanced__row--filters {
    grid-template-columns: 1fr 1fr !important; /* 2-col tablet */
  }
}

@media (max-width: 600px) {
  .md3-advanced__row--filters {
    grid-template-columns: 1fr !important; /* 1-col mobile */
  }
}
```

### Expert Toggle (Custom Switch)
```html
<label class="md3-advanced__expert">
  <input type="checkbox" name="expert" id="expert" />
  <span>Expert/CQL</span>
</label>
```

**CSS (Switch-Styling):**
```css
.md3-advanced__expert {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.md3-advanced__expert::before {
  content: '';
  width: 52px;
  height: 32px;
  background: var(--md-sys-color-surface-variant);
  border-radius: 16px;
  border: 2px solid var(--md-sys-color-outline);
}

.md3-advanced__expert input:checked + span::before {
  background: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
}
```

### Summary Box
```html
<div class="md3-advanced__summary" id="summary">
  Gefunden: <span class="md3-advanced__summary-count">42</span>
  von <span class="md3-advanced__summary-total">1234</span>
  Ergebnissen
</div>
```

**CSS:**
```css
.md3-advanced__summary {
  padding: var(--space-3) var(--space-4);
  background: var(--md-sys-color-surface-container-low);
  border-left: 4px solid var(--md-sys-color-primary);
  border-radius: var(--radius-sm);
}

.md3-advanced__summary-count {
  font-weight: 700;
  color: var(--md-sys-color-primary);
  font-size: 1.125rem;
}
```

### Export Toolbar
```html
<div class="md3-advanced__toolbar">
  <div class="md3-advanced__toolbar-spacer"></div>
  <div class="md3-advanced__exports">
    <button id="export-csv" class="btn btn-tonal">CSV</button>
    <button id="export-tsv" class="btn btn-tonal">TSV</button>
  </div>
</div>
```

**CSS:**
```css
.md3-advanced__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.md3-advanced__toolbar-spacer {
  flex: 1; /* Pushes exports to right */
}

.md3-advanced__exports {
  display: flex;
  gap: var(--space-2);
}

@media (max-width: 600px) {
  .md3-advanced__toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .md3-advanced__exports {
    flex-direction: column;
  }
  .md3-advanced__exports .btn {
    width: 100%;
  }
}
```

## 🎨 Token-Mapping

### Farben
```css
--md-sys-color-primary              ← Haupt-Blau (#0a5981)
--md-sys-color-surface              ← Weiß (#ffffff)
--md-sys-color-surface-container    ← Hell-Grau (#f5f5f7)
--md-sys-color-surface-variant      ← Input-Grau (#f3edf7)
--md-sys-color-outline              ← Border-Grau (#79747E)
--md-sys-color-on-surface           ← Text-Schwarz (#1c1b1f)
```

### Spacing
```css
--space-1  = 4px    (Winzig)
--space-2  = 8px    (Klein)
--space-3  = 12px   (Normal)
--space-4  = 16px   (Standard)
--space-6  = 24px   (Groß)
--space-8  = 32px   (Extra groß)
```

### Typography
```css
.md3-body-large     = Fließtext (16px)
.md3-body-medium    = Klein-Text (14px)
.md3-label-large    = Button-Label (14px)
.md3-title-medium   = Unter-Überschrift (16px)
.md3-title-large    = Abschnitt-Titel (22px)
```

### Shape
```css
--radius-sm  = 8px   (Buttons, kleinere Elemente)
--radius-md  = 12px  (Cards, Container)
--radius-lg  = 16px  (Hero, große Container)
```

## 🧪 Test-Checkliste

### Browser-Test (DevTools)

#### Elements Tab
- [ ] Nur `advanced-search.css` im CSS → keine alte `advanced.css`
- [ ] Klassen alle mit `.md3-advanced__` prefix
- [ ] Keine inline `style="..."` Attribute auf Elementen
- [ ] Hero hat `role="main"` und `aria-label`

#### Network Tab
- [ ] `advanced-search.css`: 336 Zeilen, korrekte Größe
- [ ] Keine alte `search/advanced.css` geladen
- [ ] HTTP 200 für alle CSS-Dateien

#### Console Tab
- [ ] Keine CSS-Errors
- [ ] Keine JavaScript-Errors
- [ ] Keine Warnungen

### Responsive Test

| Breakpoint | Query Layout | Filter Layout | Expected |
|-----------|-------------|---------------|----------|
| 320px (Mobile) | 1 col | 1 col | ✅ Stacked |
| 600px (Tablet) | 1 col | 2 col | ✅ Query stacked, Filter 2-col |
| 900px (Desktop) | 3 col | 5 col | ✅ Full layout |

### Visual Test

- [ ] Expert-Toggle Switch funktioniert (visuell)
- [ ] Export-Buttons sichtbar und korrekt positioniert
- [ ] Summary-Box zeigt sich nach Suche
- [ ] Grid-Spalten korrekt ausgerichtet
- [ ] Keine vertikalen Scrollbars auf Desktop

## 🔗 Referenzen

**Dokumentation:**
- `docs/reports/2025-11-11-css-audit-advanced-search.md` — Vollständiger Audit
- `LOKAL/00 - Md3-design/MD3-MIGRATION-GUIDE.md` — Migration-Guide (Referenz)

**Code:**
- `templates/search/advanced.html` — Template
- `static/css/md3/components/advanced-search.css` — CSS-Datei
- `static/js/modules/advanced/formHandler.js` — JavaScript

**Live:**
- `http://localhost:8000/search/advanced` — Entwicklung
- `http://example.com/search/advanced` — Produktion

## 📞 Support

**Problem:** Old `advanced.css` wird noch geladen  
**Lösung:** Browser-Cache leeren (Ctrl+Shift+Del) oder Hard-Refresh (Ctrl+Shift+R)

**Problem:** Grid-Layout sieht nicht aus wie erwartet  
**Diagnose:** Browser DevTools → Elements → `.md3-advanced__row--query` → Computed Styles prüfen

**Problem:** Expert-Toggle funktioniert nicht  
**Prüfung:** JavaScript an? Checkbox `name="expert"` vorhanden? Mode-Select auch vorhanden?

---

**Version:** 1.0  
**Datum:** 2025-11-11  
**Status:** ✅ READY FOR TESTING
