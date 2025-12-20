---
title: "Advanced Search Frontend - Quick Reference"
tags: [reference, frontend, advanced-search]
status: complete
date: 2025-11-10
version: 2.5.0
---

# Advanced Search Frontend - Quick Reference

## URL & Entry Point

```
http://localhost:5000/search/advanced
```

**Template**: `templates/search/advanced.html`

---

## Form Parameters

### Query
| Name | Type | Required | Values |
|---|---|---|---|
| `q` | text | ✅ | Any word(s) or lemmas |
| `mode` | select | ✅ | forma \| forma_exacta \| lemma \| cql |
| `sensitive` | select | ✅ | 1 (sensible) \| 0 (insensible) |
| `pos` | text | ❌ | VERB,ADP,NOUN (comma-separated) |

### Filters
| Name | Type | Mode | Backend-Param |
|---|---|---|---|
| `country_code[]` | multi-select | ❌ | country_code |
| `speaker_type[]` | multi-select | ❌ | speaker_type |
| `sex[]` | multi-select | ❌ | sex |
| `speech_mode[]` | multi-select | ❌ | speech_mode |
| `discourse[]` | multi-select | ❌ | discourse |
| `include_regional` | checkbox | ❌ | include_regional |

---

## API Endpoints

### DataTables (Server-Side)
```
GET /search/advanced/data
  ?q=palabra
  &mode=forma
  &sensitive=1
  &country_code=ARG
  &country_code=CHL
  &speaker_type=pro
  &sex=f
  &speech_mode=lectura
  &discourse=general
  &include_regional=0
  &draw=1
  &start=0
  &length=50
```

**Response**:
```json
{
  "draw": 1,
  "recordsTotal": 1024,
  "recordsFiltered": 256,
  "data": [
    {
      "left": "context",
      "match": "palabra",
      "right": "context",
      "country": "ARG",
      "speaker_type": "pro",
      "sex": "m",
      "mode": "lectura",
      "discourse": "general",
      "tokid": "TOK1234",
      "filename": "ARG-LRA1-20200101.mp3",
      "start_ms": 12000,
      "end_ms": 12500
    }
  ]
}
```

### Export (Streaming)
```
GET /search/advanced/export
  ?q=palabra
  &mode=forma
  &sensitive=1
  &format=csv|tsv
  [&other_filters...]
```

**Response**:
- Content-Type: `text/csv` or `text/tab-separated-values`
- Transfer-Encoding: `chunked` (streaming)
- Content-Disposition: `attachment; filename=export_TIMESTAMP.csv`

---

## JavaScript Modules

### 1. initTable.js

```javascript
import { 
  initAdvancedTable, 
  updateExportButtons, 
  updateSummary 
} from './initTable.js';

// Initialize DataTables
initAdvancedTable('q=palabra&mode=forma&...');

// Update export URLs
updateExportButtons('q=palabra&...');

// Populate summary box
updateSummary({
  draw: 1,
  recordsTotal: 1024,
  recordsFiltered: 256,
  data: [...]
});
```

### 2. formHandler.js

```javascript
import { 
  buildQueryParams, 
  loadSearchResults 
} from './formHandler.js';

// Build query string from form
const params = buildQueryParams();  // URLSearchParams

// Load and render results
loadSearchResults(params);
```

---

## CSS Classes

### Layout
```css
.md3-advanced-search-form     /* Main form container */
.md3-form-row                 /* Single-row layout */
.md3-form-row--2col           /* 2-column grid */
.md3-form-row--4col           /* 4-column grid (filters) */
.md3-form-section             /* Fieldset wrapper */
.md3-form-section__title      /* Legend text */
```

### Components
```css
.md3-search-summary           /* Info box (Resultados: X de Y) */
.md3-search-summary__count    /* Bold count */
.md3-badge                    /* "Filtro activo" badge */
.md3-export-buttons           /* Button group */
.md3-datatable-container      /* Scrollable table wrapper */
.md3-datatable                /* Table */
.md3-datatable mark           /* KWIC highlight */
.md3-checkbox-container       /* Regional checkbox */
.md3-checkbox                 /* Custom checkbox */
.md3-regional-filter          /* Filter wrapper */
```

---

## Debugging

### Check DataTables State
```javascript
// In console
let dt = $('#advanced-table').DataTable();
dt.settings()[0].sAjaxSource  // Current AJAX URL
dt.page()                      // Current page
dt.page.len()                  // Rows per page
```

### Check Form Values
```javascript
// In console
document.querySelector('#q').value
document.querySelector('#mode').value
Array.from(document.querySelectorAll('#filter-country-code option:checked')).map(o => o.value)
```

### Check Select2
```javascript
// In console
$('#filter-country-code').select2('data')  // Selected values
$('#filter-country-code').val()            // Array of codes
```

### Network Monitoring
```
Browser DevTools → Network
Filter: /search/advanced/
Watch: Headers, Preview, Response
```

---

## Common Tasks

### Add New Filter
1. **Template**: Add `<select name="new_filter" multiple>`
2. **formHandler.js**: Add to `buildQueryParams()`
3. **Backend**: Add parameter handling in `/search/advanced/data`
4. **CSS**: Style if needed (`.md3-outlined-textfield`)

### Change Column Order
1. **Template**: Reorder `<th>` in table head
2. **initTable.js**: Reorder `columnDefs` targets (0-indexed)
3. **CSS**: Adjust widths if needed

### Customize KWIC Display
Edit `initTable.js` → `columnDefs[2]` (Resultado column):
```javascript
{
  targets: 2,
  data: 'match',
  render: function(data) {
    // Custom rendering here
    return `<mark>${escapeHtml(data || '')}</mark>`;
  }
}
```

### Change Page Length Default
Edit `initTable.js`:
```javascript
pageLength: 50,        // Change this
lengthMenu: [25, 50, 100]
```

---

## Performance Tips

### DataTables Optimization
- `deferRender: true` (render only visible rows)
- `autoWidth: false` (manual column widths)
- `searching: false` (server-side only)
- `ordering: false` (server-side only)

### Select2 Optimization
- `closeOnSelect: false` (multi-select comfort)
- Reuse `SELECT2_CONFIG` constant (corpus/config.js)

### AJAX Optimization
- Use `length` parameter to limit rows (50 default)
- Add `.dataTables_processing` indicator (waiting feedback)
- Consider caching for repeated searches

---

## Troubleshooting Matrix

| Symptom | Cause | Fix |
|---|---|---|
| DataTables shows "No data" | Query matched 0 results | Check query in Network tab |
| Select2 dropdown empty | Library not loaded | Verify `select2.min.js` in HTML |
| Export button disabled | `/search/advanced/export` endpoint missing | Check Flask routes |
| Audio player 404 | `/media/segment/` endpoint missing | Implement media service |
| Pagination doesn't work | `serverSide: false` | Set `serverSide: true` in config |
| Summary-Box empty | Response missing `recordsTotal` | Verify `/search/advanced/data` response |
| Focus doesn't move | `aria-live` not on parent | Add `role="status" aria-live="polite"` |

---

## Browser Compatibility

| Browser | ES Version | Status |
|---|---|---|
| Chrome 90+ | ES2019 | ✅ Full Support |
| Firefox 88+ | ES2019 | ✅ Full Support |
| Safari 14+ | ES2019 | ✅ Full Support |
| Edge 90+ | ES2019 | ✅ Full Support |
| IE 11 | ES5 | ❌ Not supported (uses ES6) |

---

## Related Documentation

- **Implementation**: `docs/archived/IMPLEMENTATION-REPORT-*.md`
- **Testing**: `docs/TESTING-advanced-search-ui.md`
- **Backend**: `docs/how-to/advanced-search.md`
- **API**: `docs/reference/corpus-search-architecture.md`
- **Operations**: `docs/operations/runbook-advanced-search.md`

---

**Quick Ref Version**: 2.5.0  
**Last Updated**: 2025-11-10
