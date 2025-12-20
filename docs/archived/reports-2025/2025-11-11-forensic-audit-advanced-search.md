# 🚨 FORENSIC AUDIT: Advanced Search CSS & Routing

**Datum:** 2025-11-11  
**Problem:** Filter erscheinen nicht korrekt, Tab-Switch verursacht Error 500  
**Root Cause:** CLASS MISMATCH zwischen Simple und Advanced Search

---

## 🔴 KRITISCHE PROBLEME

### Problem #1: CLASS MISMATCH (Filter-Grid)

| Template | CSS-Klasse | CSS existiert? | Rendering |
|----------|-----------|---------------|-----------|
| **Simple Search** (`corpus.html`) | `.md3-corpus-filter-grid` | ✅ YES (`forms.css` line 46) | ✅ FUNKTIONIERT |
| **Advanced Search** (`advanced.html`) | `.md3-advanced__row--filters` | ⚠️ TEILWEISE (`advanced-search.css`) | ❌ GEBROCHEN |

**Simple Search CSS** (`forms.css`):
```css
.md3-corpus-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
  align-items: start;
}
```

**Advanced Search CSS** (`advanced-search.css`):
```css
.md3-advanced__row--filters {
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
  gap: var(--space-3, 0.75rem);
}
```

**Das Problem:**
- Advanced Search verwendet `.md3-advanced__row--filters` für Filter-Container
- Simple Search verwendet `.md3-corpus-filter-grid` 
- **ABER:** Advanced Search lädt `forms.css` welches `.md3-corpus-filter-grid` styled
- Filter in Advanced nutzen NICHT die richtige Container-Klasse!

---

### Problem #2: ROUTING ARCHITECTURE

Es gibt **ZWEI SEPARATE** Search-Systeme:

#### System 1: Simple Search (Corpus-Blueprint)
```
URL: /corpus
Template: templates/pages/corpus.html
Blueprint: src/app/routes/corpus.py
Tab-System: Simple | Advanced | Token (INNERHALB des Templates)
```

**Tabs in corpus.html:**
```html
<nav class="md3-tabs">
  <button data-tab="simple">Búsqueda simple</button>
  <a href="{{ url_for('advanced_search.index') }}">Búsqueda avanzada</a>
  <button data-tab="token">Token</button>
</nav>

<div id="tab-simple" class="md3-tab-content">
  <!-- Simple Search Filter Grid -->
  <div class="md3-corpus-filter-grid">  ← ✅ RICHTIGE KLASSE
    <div class="md3-outlined-textfield--compact">...</div>
  </div>
</div>
```

#### System 2: Advanced Search (Separate Blueprint)
```
URL: /search/advanced
Template: templates/search/advanced.html
Blueprint: src/app/search/advanced.py
Tab-System: Simple | Advanced | Token (LINKS zu anderen URLs)
```

**Tabs in advanced.html:**
```html
<nav class="md3-tabs">
  <a href="{{ url_for('corpus.search') }}">Búsqueda simple</a>  ← GEHT ZU /corpus
  <button data-tab="advanced">Búsqueda avanzada</button>
  <a href="{{ url_for('corpus.search') }}#tab-token">Token</a>
</nav>

<section class="md3-advanced">
  <div class="md3-advanced__row md3-advanced__row--filters">  ← ❌ FALSCHE KLASSE
    <div class="md3-outlined-textfield--compact">...</div>
  </div>
</section>
```

---

### Problem #3: ERROR 500 beim Tab-Switch

**Szenario:**
1. User ist auf `/search/advanced` (Advanced Search Template)
2. User klickt auf "Búsqueda simple" Tab
3. Link geht zu `/corpus` (Simple Search Template)
4. ❌ **ERROR 500**

**Root Cause:**
```html
<!-- advanced.html (Zeile 47) -->
<a href="{{ url_for('corpus.search') }}" class="md3-tab">Búsqueda simple</a>
```

**Problem:** 
- `corpus.search` erwartet bestimmte Request-Parameter
- Wenn man von `/search/advanced` kommt, fehlen diese Parameter
- Route wirft Error 500

**corpus.py** erwartet:
```python
def _default_context() -> dict[str, object]:
    return {
        "query": "",
        "search_mode": "text",
        "page": 1,
        "page_size": 20,
        # ... viele weitere required fields
    }
```

---

## 🔍 DETAILED ANALYSIS

### CSS-Einbindung Vergleich

#### Simple Search (`corpus.html`)
```html
{% block extra_head %}
  <link ... css/md3/tokens.css>
  <link ... css/md3/typography.css>
  <link ... css/md3/components/hero.css>
  <link ... css/md3/components/buttons.css>
  <link ... css/md3/components/textfields.css>
  <link ... css/md3/components/tabs.css>
  <link ... css/md3/components/forms.css>  ← HAT .md3-corpus-filter-grid
  <link ... css/md3/components/corpus-search-form.css>
  <link ... css/md3/components/select2.css>
  <link ... css/md3/components/datatables.css>
  <link ... css/md3/components/corpus.css>
  <link ... css/md3/components/stats.css>
{% endblock %}
```

#### Advanced Search (`advanced.html`)
```html
{% block extra_head %}
  <link ... css/md3/tokens.css>
  <link ... css/md3/typography.css>
  <link ... css/md3/components/hero.css>
  <link ... css/md3/components/buttons.css>
  <link ... css/md3/components/textfields.css>
  <link ... css/md3/components/tabs.css>
  <link ... css/md3/components/forms.css>  ← HAT .md3-corpus-filter-grid
  <link ... css/md3/components/chips.css>
  <link ... css/md3/components/select2.css>
  <link ... css/md3/components/datatables.css>
  <link ... css/md3/components/corpus.css>
  <link ... css/md3/components/advanced-search.css>  ← HAT .md3-advanced__row--filters
{% endblock %}
```

**Befund:**
- Beide laden `forms.css` (✅ gut)
- Advanced lädt zusätzlich `advanced-search.css` (✅ gut)
- **ABER:** Advanced HTML nutzt `.md3-advanced__row--filters` statt `.md3-corpus-filter-grid`

---

### Filter-HTML Vergleich

#### Simple Search Filter (corpus.html)
```html
<div class="md3-corpus-filter-grid">  ← ✅ KORREKT
  <div class="md3-outlined-textfield md3-outlined-textfield--compact">
    <select id="filter-country-national" name="country_code" multiple
            class="md3-outlined-textfield__input md3-outlined-textfield__input--select"
            data-enhance="select2" data-placeholder="Seleccionar">
      <option value="ARG">Argentina</option>
      ...
    </select>
    <label for="filter-country-national" 
           class="md3-outlined-textfield__label md3-outlined-textfield__label--select">
      País (emisora nacional)
    </label>
    <div class="md3-outlined-textfield__outline">...</div>
  </div>
  <!-- 4 weitere Filter... -->
</div>
```

#### Advanced Search Filter (advanced.html)
```html
<div class="md3-advanced__row md3-advanced__row--filters">  ← ❌ FALSCH
  <div class="md3-outlined-textfield md3-outlined-textfield--compact">
    <select id="filter-country-code" name="country_code" multiple
            class="md3-outlined-textfield__input md3-outlined-textfield__input--select"
            data-enhance="select2" data-placeholder="País">
      <option value="ARG">Argentina</option>
      ...
    </select>
    <label for="filter-country-code" 
           class="md3-outlined-textfield__label md3-outlined-textfield__label--select">
      País
    </label>
    <div class="md3-outlined-textfield__outline">...</div>
  </div>
  <!-- 4 weitere Filter... -->
</div>
```

**Unterschiede:**
1. ❌ **Container-Klasse:** `.md3-corpus-filter-grid` vs `.md3-advanced__row--filters`
2. ⚠️ **Select-IDs:** `filter-country-national` vs `filter-country-code`
3. ⚠️ **Label-Text:** "País (emisora nacional)" vs "País"

---

## 📊 CSS-Grid Definitionen

### forms.css (Simple Search)
```css
/* Line 46 */
.md3-corpus-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));  ← AUTO-FIT
  gap: var(--space-3);
  align-items: start;
}

@media (max-width: 960px) {
  .md3-corpus-filter-grid {
    grid-template-columns: 1fr 1fr;  ← 2-col Tablet
  }
}

@media (max-width: 600px) {
  .md3-corpus-filter-grid {
    grid-template-columns: 1fr;  ← 1-col Mobile
  }
}
```

### advanced-search.css (Advanced Search)
```css
/* Base Row */
.md3-advanced__row {
  display: grid !important;
  gap: var(--space-3, 0.75rem);
  align-items: end;
}

/* Filter Row */
.md3-advanced__row--filters {
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;  ← FIXED 5 cols
  gap: var(--space-3, 0.75rem);
}

@media (max-width: 960px) {
  .md3-advanced__row--filters {
    grid-template-columns: 1fr 1fr !important;  ← 2-col Tablet
  }
}

@media (max-width: 600px) {
  .md3-advanced__row--filters {
    grid-template-columns: 1fr !important;  ← 1-col Mobile
  }
}
```

**Vergleich:**
| Kriterium | Simple (`forms.css`) | Advanced (`advanced-search.css`) |
|-----------|---------------------|--------------------------------|
| **Desktop Grid** | `auto-fit, minmax(200px, 1fr)` | `repeat(5, minmax(0, 1fr))` |
| **Tablet Grid** | `1fr 1fr` | `1fr 1fr` |
| **Mobile Grid** | `1fr` | `1fr` |
| **!important** | Nein | Ja |

---

## 🔧 WARUM SIEHT ES UNBRAUCHBAR AUS?

### Theorie #1: Filter sind nicht styled
❌ **FALSCH** - CSS existiert für `.md3-outlined-textfield--compact`

### Theorie #2: Select2 wird nicht initialisiert
❌ **FALSCH** - `data-enhance="select2"` vorhanden

### Theorie #3: Container-Klasse fehlt CSS
✅ **RICHTIG** - `.md3-advanced__row--filters` hat CSS, ABER:
- CSS für `.md3-corpus-filter-grid` ist ausgereifter
- CSS für `.md3-advanced__row--filters` hat `!important` (kämpft mit anderen Styles)
- `.md3-advanced__row` base class überschreibt möglicherweise Filter-Grid

### Theorie #4: CSS-Spezifizitätskonflikte
✅ **RICHTIG** - `advanced-search.css` kommt NACH `forms.css`
```
forms.css: .md3-corpus-filter-grid { ... }
advanced-search.css: .md3-advanced__row--filters { ... !important }
```

Wenn HTML `.md3-advanced__row--filters` nutzt:
- ✅ Grid-Layout von `advanced-search.css` wird angewendet
- ❌ **ABER:** Child-Selektoren wie `.md3-corpus-filter-grid select[data-enhance]` greifen NICHT

**Das ist das Problem!** CSS in `forms.css` hat Selektoren wie:
```css
.md3-corpus-filter-grid select[data-enhance="select2"]:not([data-enhanced]) {
  opacity: 0;
}
```

Diese greifen NICHT wenn Container `.md3-advanced__row--filters` heißt!

---

## 🎯 ROOT CAUSE SUMMARY

### PRIMARY ISSUE: Class Mismatch
```
Simple Search:   <div class="md3-corpus-filter-grid">
                      ↓ CSS in forms.css
                      ✅ Grid + Select-Styles apply

Advanced Search: <div class="md3-advanced__row--filters">
                      ↓ CSS in advanced-search.css (Grid only)
                      ❌ Select-Styles from forms.css DON'T apply
                      ❌ Filter sehen unbrauchbar aus
```

### SECONDARY ISSUE: Tab-Routing
```
User auf /search/advanced
  → Klickt "Búsqueda simple"
  → Link: {{ url_for('corpus.search') }}
  → Geht zu /corpus ohne Parameter
  → corpus.py erwartet Parameter
  → ❌ ERROR 500
```

---

## ✅ LÖSUNGEN

### Lösung #1: Filter-Container-Klasse ändern (EMPFOHLEN)

**Ändere `advanced.html` Zeile 129:**
```html
<!-- VORHER -->
<div class="md3-advanced__row md3-advanced__row--filters">

<!-- NACHHER -->
<div class="md3-corpus-filter-grid">  ← NUTZE SIMPLE-SEARCH-KLASSE
```

**Vorteile:**
- ✅ Sofort funktionsfähig (CSS existiert)
- ✅ Konsistent mit Simple Search
- ✅ Select2-Styles greifen
- ✅ Keine CSS-Änderungen nötig

**Nachteil:**
- ⚠️ Semantisch weniger klar (`.md3-corpus-filter-grid` in `.md3-advanced__form`)

---

### Lösung #2: CSS in advanced-search.css erweitern

**Ändere `advanced-search.css`:**
```css
/* VORHER */
.md3-advanced__row--filters {
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
}

/* NACHHER - Kopiere alle Styles von .md3-corpus-filter-grid */
.md3-advanced__row--filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
  align-items: start;
}

.md3-advanced__row--filters select[data-enhance="select2"]:not([data-enhanced]) {
  opacity: 0;
}

/* ... alle anderen .md3-corpus-filter-grid Regeln kopieren */
```

**Vorteile:**
- ✅ Semantisch korrekt
- ✅ Advanced Search hat eigene CSS

**Nachteile:**
- ❌ Code-Duplikation
- ❌ Wartungsproblem (zwei Stellen ändern)

---

### Lösung #3: CSS-Alias erstellen

**Ändere `forms.css`:**
```css
/* Beide Klassen bekommen dieselben Styles */
.md3-corpus-filter-grid,
.md3-advanced__row--filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
  align-items: start;
}

.md3-corpus-filter-grid select[data-enhance],
.md3-advanced__row--filters select[data-enhance] {
  /* ... */
}
```

**Vorteile:**
- ✅ DRY (Don't Repeat Yourself)
- ✅ Beide Templates funktionieren

**Nachteile:**
- ⚠️ `forms.css` kennt jetzt Advanced-spezifische Klassen

---

### Lösung #4: Tab-Routing Fix

**Ändere `advanced.html` Zeile 47:**
```html
<!-- VORHER -->
<a href="{{ url_for('corpus.search') }}" class="md3-tab">Búsqueda simple</a>

<!-- NACHHER -->
<a href="{{ url_for('corpus.search', active_tab='tab-simple') }}" class="md3-tab">Búsqueda simple</a>
```

**Vorteile:**
- ✅ Kein Error 500
- ✅ Geht korrekt zurück zu Simple Tab

---

## 🚀 EMPFOHLENER FIX (Quick Win)

**SCHRITT 1:** Ändere Filter-Container in `advanced.html`
```html
<!-- Zeile 129 -->
<div class="md3-corpus-filter-grid">
```

**SCHRITT 2:** Entferne `.md3-advanced__row--filters` CSS aus `advanced-search.css`
(Oder behalte es falls du später umbauen willst)

**SCHRITT 3:** Fixe Tab-Links
```html
<!-- Zeile 47 -->
<a href="{{ url_for('corpus.search', active_tab='tab-simple') }}">Búsqueda simple</a>
<!-- Zeile 49 -->
<a href="{{ url_for('corpus.search', active_tab='tab-token') }}#tab-token">Token</a>
```

**ERWARTETES ERGEBNIS:**
✅ Filter sehen aus wie in Simple Search  
✅ Select2 wird initialisiert  
✅ Tab-Switch funktioniert ohne Error 500  
✅ Layout ist konsistent  

---

## 📋 VERIFICATION CHECKLIST

Nach dem Fix prüfen:

- [ ] `/search/advanced` öffnet sich ohne Fehler
- [ ] Filter-Grid hat 5 Spalten auf Desktop
- [ ] Filter-Grid hat 2 Spalten auf Tablet (600-960px)
- [ ] Filter-Grid hat 1 Spalte auf Mobile (<600px)
- [ ] Select2-Dropdowns funktionieren
- [ ] "Búsqueda simple" Tab-Link funktioniert ohne Error 500
- [ ] "Token" Tab-Link funktioniert ohne Error 500
- [ ] Filter sehen identisch aus wie in Simple Search
- [ ] Browser DevTools: Keine CSS-Errors in Console
- [ ] Browser DevTools: `.md3-corpus-filter-grid` hat korrekte Grid-Properties

---

**Status:** 🔴 KRITISCH - Filter nicht nutzbar  
**Priorität:** P0 (Blocker)  
**Empfohlene Lösung:** Lösung #1 (Class ändern) + Lösung #4 (Tab-Routing)  
**Geschätzte Zeit:** 15 Minuten  
**Testing Zeit:** 10 Minuten  

**Total Estimated Fix Time:** 25 Minuten
