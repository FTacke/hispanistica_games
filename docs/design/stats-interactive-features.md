# Statistics Interactive Features

## Overview
This document describes the interactive features added to the statistics tab: country filtering and display mode toggle (absolute/percentage).

## Features

### 1. Country Filter Dropdown
**Location**: `templates/pages/corpus.html` (stats header section)

**Functionality**:
- Displays all countries with their token counts
- Default option: "Todos los países" (shows all data)
- When a country is selected, re-fetches statistics filtered to that country only
- Filter is applied to all 5 dimension charts simultaneously

**Implementation**:
- Frontend: `static/js/modules/stats/initStatsTab.js`
  - `populateCountryFilter()`: Populates dropdown from API response
  - `filterStatsByCountry()`: Updates `currentCountryFilter` state and reloads stats
  - `setupCountryFilter()`: Attaches event listener to dropdown
- Backend: `src/app/services/stats_aggregator.py`
  - Accepts `country_detail` parameter in `StatsParams`
  - Adds `WHERE t.country_code = ?` filter when parameter is present
  - Returns statistics for specified country across all dimensions

**API Usage**:
```
GET /api/stats?q=casa&country_detail=ARG
```

### 2. Display Mode Toggle (Absolute / Percentage)
**Location**: `templates/pages/corpus.html` (stats header section)

**Functionality**:
- Two toggle buttons: "Absoluto" (default active) and "Porcentaje"
- Switches chart display between absolute token counts and percentage values
- Updates all 5 dimension charts simultaneously
- Tooltip always shows both values (n and %)

**Implementation**:
- Frontend: `static/js/modules/stats/initStatsTab.js`
  - `displayMode` state variable: `'absolute'` (default) or `'percent'`
  - `setupDisplayModeToggle()`: Attaches click listeners to both buttons
  - Button click handlers: Update state, toggle CSS classes, re-render charts
- Chart Renderer: `static/js/modules/stats/renderBar.js`
  - Accepts `displayMode` parameter (default: `'absolute'`)
  - When `displayMode === 'percent'`:
    - Uses `item.p * 100` for bar values (0-100 scale)
    - Sets x-axis max to 100
    - Formats x-axis labels as percentages (e.g., "15.3%")
  - When `displayMode === 'absolute'`:
    - Uses `item.n` for bar values
    - Dynamic x-axis scale
    - Formats x-axis labels with Spanish number format

**UI Styling**:
- CSS classes: `.md3-chip` and `.md3-chip--active`
- Active state: Higher elevation, primary color background
- Inactive state: Outlined style with surface variant background

## State Management

### Global State Variables
Located in `initStatsTab.js`:

```javascript
let displayMode = 'absolute';  // 'absolute' | 'percent'
let currentCountryFilter = ''; // Empty string = all countries
```

### State Flow
1. **Initial Load**: `displayMode = 'absolute'`, `currentCountryFilter = ''`
2. **Country Selection**: Updates `currentCountryFilter`, calls `loadStats()` with `country_detail` parameter
3. **Display Mode Toggle**: Updates `displayMode`, calls `renderCharts()` with cached data
4. **Form Submit**: Resets `currentCountryFilter = ''`, reloads stats

## URL Parameters

### Backend API (`/api/stats`)
- `country_detail`: ISO 3166-1 alpha-3 country code (e.g., "ARG", "ESP", "MEX")
  - Filters all aggregations to specified country
  - Overrides `pais[]` filter from form
  - Empty/missing = show all countries

### Response Format
Unchanged - still returns both `n` (absolute) and `p` (proportion) for all categories:

```json
{
  "total": 893,
  "by_country": [
    {"key": "ARG", "n": 450, "p": 0.504},
    {"key": "ESP", "n": 443, "p": 0.496}
  ],
  "by_speaker_type": [...],
  "by_sexo": [...],
  "by_modo": [...],
  "by_discourse": [...]
}
```

## User Workflows

### Workflow 1: Filter by Country
1. User performs search (e.g., "casa")
2. Switches to "Estadísticas" tab
3. Clicks country dropdown in stats header
4. Selects a country (e.g., "ARG (450)")
5. Charts reload showing only ARG tokens across all dimensions
6. To reset: Select "Todos los países"

### Workflow 2: View Percentages
1. User is viewing statistics in absolute mode (default)
2. Clicks "Porcentaje" toggle button
3. Charts instantly update to show percentages (0-100%)
4. X-axis relabels with percentage format
5. Tooltips still show both absolute and percentage values
6. To reset: Click "Absoluto" button

### Workflow 3: Combined Filters
1. User searches for word + applies form filters (e.g., country, speaker type)
2. Views statistics → sees filtered results
3. Applies country dropdown filter → further restricts to single country
4. Toggles to percentage view → sees distribution within that country
5. Returns to "Resultados" tab → form filters remain
6. Returns to "Estadísticas" tab → country dropdown filter persists until reset

## Technical Notes

### Performance
- **Country Filter**: Requires API call (server-side filtering)
  - Cache TTL: 120 seconds
  - Cache key includes `country_detail` parameter
- **Display Mode Toggle**: Client-side only (uses cached data)
  - Instant rendering without API call
  - No additional backend load

### Cache Behavior
- Each `country_detail` value creates separate cache entry
- Example cache keys:
  - `q=casa&mode=text` (all countries)
  - `q=casa&mode=text&country_detail=ARG` (Argentina only)
- Cache invalidation: Automatic after 120s or on form parameter changes

### Darkmode Compatibility
- Both features fully support darkmode
- Chart colors read from CSS variables:
  - Text: `--md-sys-color-on-surface`
  - Grid: `--md-sys-color-outline-variant`
  - Bars: `--md-sys-color-primary`
- Toggle buttons use MD3 chip styles (theme-aware)

## Future Enhancements

### Potential Improvements
1. **Persistent State**: Remember display mode preference across sessions (localStorage)
2. **URL Sync**: Add `display_mode` and `country_filter` to URL query params
3. **Export**: Allow downloading charts as images (ECharts built-in feature)
4. **Comparison**: Side-by-side country comparison view
5. **Animation**: Smooth transitions when toggling display mode

### Backend Optimizations
1. **Compound Indexes**: Add indexes for common filter combinations
2. **Materialized Views**: Pre-aggregate frequently accessed statistics
3. **Streaming**: Use server-sent events for large result sets

## Testing Checklist

- [ ] Country dropdown populates correctly from API response
- [ ] "Todos los países" option shows all countries
- [ ] Selecting a country filters all 5 charts simultaneously
- [ ] Country filter persists across display mode toggles
- [ ] "Absoluto" button is active by default
- [ ] Clicking "Porcentaje" switches charts to percentage view
- [ ] X-axis shows 0-100% scale in percentage mode
- [ ] X-axis shows dynamic scale in absolute mode
- [ ] Tooltips show both n and % in all modes
- [ ] Darkmode compatibility for all UI elements
- [ ] Charts resize correctly on window resize
- [ ] State resets when returning to results tab and back
- [ ] API returns correct data for `country_detail` parameter
- [ ] Cache works correctly for different country filters

## Files Modified

### Backend
- `src/app/services/stats_aggregator.py`: Added `country_detail` filter logic
- `src/app/routes/stats.py`: Added `country_detail` to normalized params (cache key)

### Frontend
- `static/js/modules/stats/initStatsTab.js`:
  - Added state variables: `displayMode`, `currentCountryFilter`
  - Implemented `setupDisplayModeToggle()`, `setupCountryFilter()`
  - Updated `buildStatsUrl()` to include `country_detail` parameter
  - Updated `renderCharts()` to pass `displayMode` to chart renderer
  - Implemented `filterStatsByCountry()` to trigger API reload
- `static/js/modules/stats/renderBar.js`:
  - Added `displayMode` parameter to `renderBar()` function
  - Conditional logic for percentage vs. absolute rendering
  - X-axis formatter based on display mode
  - Max value set to 100 for percentage mode

### Templates
- `templates/pages/corpus.html`:
  - Added display mode toggle buttons with CSS classes
  - Added country filter dropdown with empty options
  - Added inline `.md3-chip` styles for toggle buttons

## Related Documentation
- [Statistics Feature Architecture](./stats-architecture.md) *(if exists)*
- [Database Schema](./database_maintenance.md)
- [API Documentation](../README.md#api-endpoints)
