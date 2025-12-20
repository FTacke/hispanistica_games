---
title: "Advanced Search UI Finalization - MD3 Layout & DataTables (2.6.1)"
status: active
owner: frontend-team
updated: "2025-11-11"
version: 2.6.1
tags: [advanced-search, md3, datatables, ui, accessibility, export, expert-mode, fixes]
links:
  - ../concepts/advanced-search-architecture.md
  - ../reference/api-advanced-search.md
  - ../design/md3-components.md
  - ../reports/2025-11-11-advanced-search-finalization.md
  - ../reports/2025-11-11-advanced-search-fixes.md
---

# Advanced Search UI Finalization - MD3 Layout & DataTables (2.6.1)

**Version 2.6.1 Update:** 10-Punkte-Fixliste abgeschlossen - Parameter ohne `[]` Suffix, ARIA-Bereinigung, Summary-Logik korrigiert, Defaults fixiert.

**Version 2.6.0 Update:** Vollständige MD3-Konformität, Expert-Modus mit CQL-Raw, keine Inline-Styles, Export mit Zeitstempel, Accessibility-Verbesserungen.

Implementierung der finalisierten Advanced Search UI mit MD3-konformem Layout, DataTables Server-Side Processing und Export-Funktionalität. Alle Inline-Styles entfernt, alle Styles nutzen CSS-Variablen aus `tokens.css`.

---

## Neuerungen in Version 2.6.1

### 🔧 Bug-Fixes und Konsistenz-Verbesserungen
- **Parameter ohne `[]` Suffix:** Alle Filter jetzt `country_code`, `speaker_type` etc. (wie Simple Search)
- **ARIA-Bereinigung:** Ungültige `aria-describedby` Referenzen entfernt
- **Summary-Logik:** Kein Doppel-Fetch mehr, Summary aus DataTables-Callback
- **Defaults:** `sensitive=checked`, `include_regional=unchecked` korrekt gesetzt
- **HX-Get entfernt:** Form nutzt nur JavaScript-Submit, keine htmx-Redundanz

Siehe Details: [reports/2025-11-11-advanced-search-fixes.md](../reports/2025-11-11-advanced-search-fixes.md)

---

## Neuerungen in Version 2.6.0

### 🎨 MD3-Konformität
- **Keine Inline-Styles:** Alle UI-Styles in `advanced-search.css`
- **CSS-Variablen:** Farben/Spacings via `tokens.css` (`var(--space-4)`, `var(--md-sys-color-primary)`)
- **MD3-Klassen:** `.md3-advanced__*` für Container, Rows, Summary, Toolbar, Tablewrap

### 🔧 Expert-Modus
- **Toggle:** Checkbox „Expert/CQL" aktiviert CQL-Raw-Feld
- **CQL-Raw-Feld:** Direkteingabe von BlackLab CQL, versteckt wenn Toggle aus
- **Mode-Synchronisation:** Bei Expert-Toggle → Mode wird automatisch auf `cql` gesetzt

### 📊 DataTables Verbesserungen
- **Singleton-Pattern:** `reloadWith(params)` für sauberen Reload ohne doppelten Init
- **Export-Buttons:** Zeitstempel in Dateinamen (`corapan_advanced_2025-11-11T14-30-00.csv`)
- **Summary-Fokus:** Nach jedem Laden wird Summary fokussiert (A11y)

### ♿ Accessibility
- **Summary:** `role="status"`, `aria-live="polite"`, `tabindex="-1"` für Screenreader
- **Focus-Ringe:** Alle interaktiven Elemente mit sichtbarem Fokus
- **Caption:** `<caption class="sr-only">` für Tabellen-Beschreibung

### 📱 Responsive
- **5-Spalten-Layout:** Filter auf Desktop (>960px)
- **2-Spalten-Layout:** Tablet (600px-960px)
- **1-Spalten-Layout:** Mobile (<600px)

---

## Ziel

Implementierung einer produktionsreifen Advanced Search UI mit:
- ✅ MD3-konformem Layout (keine Inline-Styles)
- ✅ Expert-Modus mit CQL-Raw-Feld
- ✅ Identischem Spaltenschema wie Simple Search
- ✅ URL-State-Restoration für Bookmarkability
- ✅ Server-Side Streaming Export (CSV/TSV) mit Zeitstempel
- ✅ Summary Box mit Server-Filter-Badge
- ✅ A11y-konform (ARIA, Semantic HTML, Focus Management)

**Status:** 2025-11-11 ✅ Finalisiert und bereit für Production

---

## Architektur-Überblick

### Frontend Struktur

```
templates/search/
  ├── advanced.html        (Template - Zeilen 1 & 2 + Results)

static/js/modules/advanced/
  ├── initTable.js         (DataTables Init + Summary Update)
  └── formHandler.js       (Form Submit + State Restore)

static/js/modules/corpus/
  └── filters.js           (Select2 Multi-Select)
```

### Backend Endpoints

| Endpoint | Method | Zweck |
|----------|--------|-------|
| `/search/advanced/data` | GET | DataTables Server-Side (Pagination + Summary) |
| `/search/advanced/export` | GET | Streaming CSV/TSV Export (alle Treffer) |

---

## UI-Layout (Final)

---

## Dateistruktur (Version 2.6.0)

```
static/css/md3/components/
  ├── advanced-search.css              # NEU: MD3-konforme UI-Styles (312 Zeilen)
  ├── datatables-theme-lock.css        # Ergänzt: MD3-Overrides für DataTables

static/js/modules/advanced/
  ├── initTable.js                     # Erweitert: Singleton, reloadWith(), focusSummary()
  ├── formHandler.js                   # Erweitert: Expert-Toggle, State-Restore, Reset

templates/search/
  ├── advanced.html                    # Aktualisiert: MD3-Layout, Expert-Toggle, Toolbar
```

---

## UI-Layout (Final)

### Zeile 1: Query + Mode + Expert-Toggle

```html
<!-- ROW 1: Query + Mode + Expert -->
<div class="md3-advanced__row md3-advanced__row--query">
  <!-- Column 1: Query (flex-grow) -->
  <div class="md3-outlined-textfield md3-outlined-textfield--flex">
    <input type="text" id="q" name="q" required class="md3-outlined-textfield__input" placeholder=" " />
    <label for="q" class="md3-outlined-textfield__label">Suchausdruck</label>
    <div class="md3-outlined-textfield__outline">
      <div class="md3-outlined-textfield__outline-start"></div>
      <div class="md3-outlined-textfield__outline-notch"></div>
      <div class="md3-outlined-textfield__outline-end"></div>
    </div>
  </div>
  
  <!-- Column 2: Mode Select (220px) -->
  <div class="md3-outlined-textfield">
    <select name="mode" id="mode" class="md3-outlined-textfield__input md3-outlined-textfield__input--select">
      <option value="forma_exacta">Forma exacta</option>
      <option value="forma">Forma</option>
      <option value="lemma">Lemma</option>
      <option value="cql">CQL</option>
    </select>
    <label for="mode" class="md3-outlined-textfield__label md3-outlined-textfield__label--select">Modus</label>
    <div class="md3-outlined-textfield__outline">...</div>
  </div>
  
  <!-- Column 3: Expert Toggle (max-content) -->
  <label class="md3-advanced__expert">
    <input type="checkbox" name="expert" id="expert">
    <span>Expert/CQL</span>
  </label>
</div>

<!-- ROW CQL: Hidden by default, shown when Expert is checked -->
<div class="md3-advanced__row md3-advanced__row--cql" id="cql-row" hidden>
  <div class="md3-outlined-textfield md3-outlined-textfield--flex">
    <input type="text" id="cql_raw" name="cql_raw" class="md3-outlined-textfield__input" placeholder=" " />
    <label for="cql_raw" class="md3-outlined-textfield__label">CQL</label>
    <div class="md3-outlined-textfield__outline">...</div>
  </div>
</div>
```

### Zeile 2: Checkboxen (Sensitive + Include Regional)

```html
<!-- Checkboxen -->
<div class="md3-advanced__checkboxes">
  <label class="md3-advanced__checkbox-label">
    <input type="checkbox" name="sensitive" id="sensitive" value="1" checked>
    <span>Sensible (mayúscula/minúscula)</span>
  </label>
  <label class="md3-advanced__checkbox-label">
    <input type="checkbox" name="include_regional" id="include-regional" value="1">
    <span>Incluir regionales (emisoras regionales además de nacionales)</span>
  </label>
</div>
```

### Zeile 2: Simple Filters (1:1 wie Simple Search)

```html
<!-- ROW 2: Simple Filters (1:1 wie Simple) -->
<fieldset class="md3-form-section" aria-label="Filtros de metadatos">
  <legend class="md3-form-section__title">Filtros (Metadatos)</legend>
  
  <!-- Row 2a: 4-Column Filters -->
  <div class="md3-form-row md3-form-row--4col">
    <!-- País -->
    <select id="filter-country-code" name="country_code" multiple data-enhance="select2">
      <!-- Options... -->
    </select>
    
    <!-- Hablante (Speaker Type) -->
    <select id="filter-speaker-type" name="speaker_type" multiple data-enhance="select2">
      <!-- Options... -->
    </select>
    
    <!-- Sexo -->
    <select id="filter-sex" name="sex" multiple data-enhance="select2">
      <!-- Options... -->
    </select>
    
    <!-- Modo (Speech Mode) -->
    <select id="filter-speech-mode" name="speech_mode" multiple data-enhance="select2">
      <!-- Options... -->
    </select>
  </div>
  
  <!-- Row 2b: Discourse + Regional -->
  <div class="md3-form-row md3-form-row--2col">
    <!-- Discurso -->
    <select id="filter-discourse" name="discourse" multiple data-enhance="select2">
      <!-- Options... -->
    </select>
    
    <!-- Regional Checkbox -->
    <label class="md3-checkbox-container">
      <input type="checkbox" id="include-regional" name="include_regional" value="1" />
      <span class="md3-checkbox__label">Incluir regionales</span>
    </label>
  </div>
</fieldset>
```

### Summary Box mit Filter Badge

```html
<!-- Summary Box with Filter Badge -->
<div id="search-summary" 
  class="md3-search-summary" 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
  style="display: none;">
  <div class="md3-search-summary__content">
    <span class="md3-search-summary__label">Resultados:</span>
    <strong class="md3-search-summary__count" id="summary-count">-</strong>
    <span class="md3-search-summary__total" id="summary-total">de -</span>
    <span id="filter-badge" 
      class="md3-badge md3-badge--info" 
      role="note"
      style="display: none;">
      <span class="material-symbols-rounded md3-badge__icon">filter_alt</span>
      Filtros de servidor activos
    </span>
  </div>
</div>
```

### Export Buttons + DataTables

```html
<!-- Results Section -->
<section id="results-section" class="md3-search-results-section" style="display: none;">
  <!-- Export Buttons -->
  <div class="md3-export-buttons" role="region" aria-label="Opciones de exportación">
    <span class="md3-export-label">Descargar:</span>
    <a id="export-csv-btn" href="#" class="md3-button md3-button--tonal" download>
      <span class="material-symbols-rounded md3-button__icon">download</span>
      <span class="md3-button__label">CSV</span>
    </a>
    <a id="export-tsv-btn" href="#" class="md3-button md3-button--tonal" download>
      <span class="material-symbols-rounded md3-button__icon">download</span>
      <span class="md3-button__label">TSV</span>
    </a>
  </div>

  <!-- DataTables (12 columns - same as Simple) -->
  <div class="md3-datatable-container">
    <table id="advanced-table" class="md3-datatable" role="grid">
      <caption id="advanced-table-caption">...</caption>
      <thead>
        <tr role="row">
          <th scope="col">#</th>
          <th scope="col">← Contexto</th>
          <th scope="col">Resultado</th>
          <th scope="col">Contexto →</th>
          <th scope="col">Audio</th>
          <th scope="col">País</th>
          <th scope="col">Hablante</th>
          <th scope="col">Sexo</th>
          <th scope="col">Modo</th>
          <th scope="col">Discurso</th>
          <th scope="col">Token ID</th>
          <th scope="col">Archivo</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>
</section>
```

---

## JavaScript Implementation

### 1. formHandler.js - State Restoration

**Key Points:**
1. **Restore BEFORE Select2 Init** - Ensures pre-population
2. **URL-Bookmarkable** - Parameters in URL, querystring restored
3. **Auto-Submit** - If URL has `q` param, auto-submit form

```javascript
document.addEventListener('DOMContentLoaded', function() {
  // Step 1: Restore state from URL BEFORE Select2
  restoreStateFromURL();
  
  // Step 2: Initialize Select2
  initializeFilters();
  
  // Step 3-4: Bind events
  bindFormSubmit();
  bindResetButton();
});

function restoreStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  const form = document.getElementById('advanced-search-form');
  
  // Restore text inputs
  const q = params.get('q');
  if (q) form.querySelector('#q').value = q;
  
  // Restore selects BEFORE Select2 initialization
  const filterMappings = [
    { param: 'country_code', selector: '#filter-country-code' },
    { param: 'speaker_type', selector: '#filter-speaker-type' },
    // ... more filters
  ];
  
  filterMappings.forEach(({ param, selector }) => {
    const values = params.getAll(param);
    if (values.length > 0) {
      const selectElement = form.querySelector(selector);
      Array.from(selectElement.options).forEach(opt => {
        opt.selected = values.includes(opt.value);
      });
    }
  });
  
  // Auto-submit if URL has search params
  if (q && params.size > 0) {
    setTimeout(() => form.dispatchEvent(new Event('submit')), 200);
  }
}

function bindFormSubmit() {
  const form = document.getElementById('advanced-search-form');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const queryParams = buildQueryParams();
    loadSearchResults(queryParams);
  });
}

function buildQueryParams() {
  const form = document.getElementById('advanced-search-form');
  const params = new URLSearchParams();
  
  // Required: q
  const q = form.querySelector('#q').value.trim();
  if (!q) {
    alert('Por favor ingresa una consulta');
    throw new Error('Query is required');
  }
  params.append('q', q);
  
  // Mode, Sensitive
  params.append('mode', form.querySelector('#mode').value || 'forma');
  params.append('sensitive', form.querySelector('#sensitive').value || '1');
  
  // Filters (multi-select)
  ['country_code', 'speaker_type', 'sex', 'speech_mode', 'discourse'].forEach(name => {
    const selector = `#filter-${name.replace(/_/g, '-')}`;
    const selected = Array.from(form.querySelectorAll(`${selector} option:checked`))
      .map(opt => opt.value);
    selected.forEach(val => params.append(name, val));
  });
  
  return params;
}

async function loadSearchResults(queryParams) {
  const resultsSection = document.getElementById('results-section');
  const summaryBox = document.getElementById('search-summary');
  
  try {
    resultsSection.style.display = '';
    
    // Initialize DataTables
    initAdvancedTable(queryParams.toString());
    
    // Update export buttons
    updateExportButtons(queryParams.toString());
    
    // Fetch first page for summary
    const response = await fetch(`/search/advanced/data?${queryParams.toString()}`);
    const data = await response.json();
    
    // Update summary
    updateSummary(data);
    
    // Focus on summary for a11y
    if (summaryBox) {
      summaryBox.focus();
      summaryBox.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error:', error);
    resultsSection.innerHTML = `<div class="md3-alert md3-alert--error" role="alert">
      <span class="md3-alert__icon">error</span>
      ${escapeHtml(error.message)}
    </div>`;
  }
}
```

### 2. initTable.js - DataTables Initialization

**Key Points:**
1. **Minimal Config** - Only necessary settings
2. **Re-Init Safety** - Destroy before init
3. **Summary Focus** - Updates Summary Box after fetch

```javascript
let advancedTable = null;

export function initAdvancedTable(queryParams) {
  // Step 1: Destroy existing table
  if (advancedTable && $.fn.dataTable.isDataTable('#advanced-table')) {
    try {
      advancedTable.destroy(true);
      advancedTable = null;
    } catch (e) {
      console.warn('Destroy error:', e);
    }
  }

  // Step 2: Build AJAX URL
  const ajaxUrl = `/search/advanced/data?${queryParams}`;

  // Step 3: Initialize
  advancedTable = $('#advanced-table').DataTable({
    serverSide: true,
    processing: true,
    deferRender: true,
    autoWidth: false,
    searching: false,      // Disable client-side search
    ordering: false,       // Disable sorting
    pageLength: 50,
    lengthMenu: [25, 50, 100],
    ajax: {
      url: ajaxUrl,
      type: 'GET',
      error: function(xhr) {
        handleDataTablesError(xhr);
      }
    },
    columnDefs: [
      { targets: 0, render: (data, type, row, meta) => meta.row + meta.settings._iDisplayStart + 1 },
      { targets: 1, data: 'left', render: (data) => escapeHtml(data || '') },
      { targets: 2, data: 'match', render: (data) => `<mark>${escapeHtml(data || '')}</mark>` },
      { targets: 3, data: 'right', render: (data) => escapeHtml(data || '') },
      { targets: 4, data: null, render: (data, type, row) => renderAudio(row) },
      { targets: 5, data: 'country' },
      { targets: 6, data: 'speaker_type' },
      { targets: 7, data: 'sex' },
      { targets: 8, data: 'mode' },
      { targets: 9, data: 'discourse' },
      { targets: 10, data: 'tokid' },
      { targets: 11, data: 'filename' }
    ]
  });
}

export function updateExportButtons(queryParams) {
  const csvBtn = document.getElementById('export-csv-btn');
  const tsvBtn = document.getElementById('export-tsv-btn');
  
  if (csvBtn) {
    const csvParams = new URLSearchParams(queryParams);
    csvParams.set('format', 'csv');
    csvBtn.href = `/search/advanced/export?${csvParams.toString()}`;
    csvBtn.download = `export_${Date.now()}.csv`;
  }
  
  if (tsvBtn) {
    const tsvParams = new URLSearchParams(queryParams);
    tsvParams.set('format', 'tsv');
    tsvBtn.href = `/search/advanced/export?${tsvParams.toString()}`;
    tsvBtn.download = `export_${Date.now()}.tsv`;
  }
}

export function updateSummary(data) {
  const summaryBox = document.getElementById('search-summary');
  const countEl = document.getElementById('summary-count');
  const totalEl = document.getElementById('summary-total');
  const filterBadge = document.getElementById('filter-badge');

  if (!summaryBox || !countEl || !totalEl) return;

  summaryBox.style.display = '';

  const filtered = data.recordsFiltered || 0;
  const total = data.recordsTotal || 0;

  if (filtered === 0) {
    countEl.textContent = '0';
    countEl.style.color = 'var(--md3-color-error)';
    totalEl.textContent = ' resultados encontrados';
    if (filterBadge) filterBadge.style.display = 'none';
  } else {
    countEl.textContent = filtered.toLocaleString('es-ES');
    countEl.style.color = 'var(--md3-color-primary)';
    totalEl.textContent = ` de ${total.toLocaleString('es-ES')} documentos`;
    
    // Show filter badge if filters are active (filtered < total)
    if (filterBadge && filtered < total) {
      filterBadge.style.display = '';
    } else if (filterBadge) {
      filterBadge.style.display = 'none';
    }
  }
}
```

---

## Testing

### Automated Tests

```bash
# Run smoke tests
python scripts/test_advanced_ui_smoke.py
```

**Test Coverage:**
- ✅ lemma/forma/CQL modes
- ✅ Filter reduction (country, speaker_type, sex, mode, discourse)
- ✅ Export CSV/TSV formats
- ✅ Export respects filters
- ✅ Form state restoration from URL
- ✅ Summary box with correct counts

### Manual Testing

1. **Query Modes**
   - Enter "hablar" in Forma mode → Should find word "hablar"
   - Enter "hablar" in Lemma mode → Should find all inflections (hablo, hablas, etc.)
   - Enter `[word="radio"]` in CQL mode → Should find exact CQL match

2. **Filters**
   - Select country "Argentina" → Result count should decrease
   - Select multiple countries → Should combine with OR logic
   - Select speaker type "Professional" + sex "Male" → Should filter both

3. **Export**
   - Click "CSV" → Download starts immediately (streaming)
   - Click "TSV" → Tab-delimited format
   - Export with filters → Filters applied to export

4. **URL State**
   - Search for "radio", copy URL
   - Paste in new tab → Form should be pre-filled with "radio"
   - Back/forward buttons should restore previous searches

5. **Accessibility**
   - Tab through form → Should navigate through all controls
   - Read aloud with screen reader → All labels should be audible
   - Summary box should announce changes with `aria-live="polite"`

---

## Acceptance Criteria

### ✅ Layout
- [x] Row 1: Query + Mode + Case (3-column layout)
- [x] Row 2: Filters 1:1 wie Simple Search (5 filters + regional checkbox)
- [x] Summary box with count + filter badge
- [x] Export buttons (CSV/TSV)
- [x] DataTables with 12 columns (identical to Simple)

### ✅ Functionality
- [x] State restoration from URL (bookmarkable searches)
- [x] Auto-submit if URL has query parameter
- [x] Export buttons update with current parameters
- [x] Summary box updates after DataTables loads
- [x] Filter badge shows only if filters are active

### ✅ Export
- [x] CSV export streams all hits (no buffering)
- [x] TSV export with tab delimiters
- [x] Export respects all filters
- [x] Filename includes timestamp

### ✅ Accessibility
- [x] Semantic HTML (fieldset, legend, th scope)
- [x] ARIA labels and roles (role="status", aria-live, aria-label)
- [x] Color not sole indicator (filter badge has icon)
- [x] Keyboard navigation (tabindex, autofocus)

---

## Siehe auch

- [Advanced Search Architecture](../concepts/advanced-search-architecture.md)
- [Advanced Export Streaming Spec](../reference/advanced-export-streaming.md)
- [Advanced Search Testing Guide](../TESTING-advanced-search.md)
- [Simple Search Implementation](../how-to/simple-search.md)
