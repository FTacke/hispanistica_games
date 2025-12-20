<!-- Navigation Module - Adaptive Title & Scroll State -->

## Module Documentation

This directory contains the MD3 Navigation System with framework-agnostic modules for managing:
- Adaptive Page Titles (Site Title ↔ Page Title on scroll)
- Scroll State Detection for top app bar elevation

### Key Modules

#### `page-title.js` - Adaptive Page Title

**Purpose:** Automatically detect and display the current page title, synchronized with browser tab title.

**Export:** `initPageTitle()`

**Title Resolution (Priority):**
1. `main[data-page-title]` attribute
2. First `<h1>` element inside `<main>`
3. `<meta name="page-title" content="...">` tag
4. `document.title` (with "| CO.RA.PAN" suffix removed)
5. Fallback: "CO.RA.PAN"

**HTML Requirements:**
```html
<header class="md3-top-app-bar">
  <span class="md3-top-app-bar__title-site" id="siteTitle">CO.RA.PAN</span>
  <span class="md3-top-app-bar__title-page" id="pageTitle"></span>
</header>

<main data-page-title="Optional: Explicit Title">
  <h1>Or use H1 as title source</h1>
</main>
```

**CSS Requirements:**
```css
/* On scroll (data-scrolled="true" on body): */
body[data-scrolled="true"] .md3-top-app-bar__title-site {
  opacity: 0;
}
body[data-scrolled="true"] .md3-top-app-bar__title-page {
  opacity: 1;
}
```

**Event Handling:**
- `DOMContentLoaded` - Initial load
- `htmx:afterSwap` - After HTMX content swap
- `htmx:afterSettle` - After HTMX settling
- `htmx:historyRestore` - HTMX history navigation
- `turbo:render` - Turbo Drive navigation
- `popstate` - Browser back/forward
- `pageshow` - Page show (bfcache)
- `MutationObserver` on `<main>` - Live content changes

**Features:**
- ✅ No duplicate listeners (Guard: `__pageTitleInit`)
- ✅ Framework-agnostic (works with HTMX, Turbo, vanilla)
- ✅ MutationObserver for Partial Updates / Streaming
- ✅ Automatic document.title sync with "| CO.RA.PAN" suffix

#### `scroll-state.js` - Scroll Detection

**Purpose:** Detect scroll position and set `data-scrolled` attribute for CSS-driven title transitions.

**Export:** `initScrollState()`

**Scroll Threshold:** `8px` (configurable as `SCROLL_THRESHOLD`)

**HTML Requirements:**
```html
<body data-scrolled="false">
  <!-- data-scrolled toggles between "true" and "false" -->
</body>
```

**Event Handling:**
- `scroll` (passive listener) - Continuous scroll detection
- `DOMContentLoaded` - Initial state
- `htmx:afterSwap` - Reset on content swap
- `htmx:afterSettle` - Recalculate after settle
- `htmx:historyRestore` - Reset on history navigation
- `turbo:render` - Reset on Turbo navigation
- `popstate` - Reset on back/forward
- `pageshow` - Reset on page restore (bfcache)

**Features:**
- ✅ Passive scroll listener (Performance)
- ✅ Debounced attribute updates (only when state changes)
- ✅ Optional scroll-to-top on navigation
- ✅ No duplicate listeners (Guard: `__scrollInit`)

### Integration

Both modules are initialized from `index.js`:

```javascript
import { initPageTitle } from './page-title.js';
import { initScrollState } from './scroll-state.js';

// In initMD3Navigation():
initPageTitle();
initScrollState();
```

**Important:** Both modules use **auto-init** IIFE fallback, so they work even if imported as side-effects.

### Testing Scenarios

**Scenario A: Initial Load**
- Expect: `#pageTitle` contains page title, `document.title` has suffix
- Expect: `body[data-scrolled="false"]` initially

**Scenario B: Scroll Down**
- Do: Scroll window > 8px
- Expect: `body[data-scrolled="true"]` set, CSS transitions title visibility

**Scenario C: HTMX Full-Page Navigation**
- Do: Click HTMX link that loads new page with `<main data-page-title="...">`
- Events: `htmx:afterSwap` → `htmx:afterSettle`
- Expect: `#pageTitle` updated, `document.title` updated, `data-scrolled` reset to "false"

**Scenario D: HTMX Partial Update**
- Do: HTMX request updates only `<main>` content
- Trigger: MutationObserver detects `childList` changes
- Expect: `#pageTitle` re-evaluated from new `<h1>` or `data-page-title`

**Scenario E: Browser Back (popstate)**
- Do: Press browser back button
- Event: `popstate` → both modules re-sync
- Expect: Correct title and scroll state for previous page

**Scenario F: Turbo Navigation (if enabled)**
- Do: Turbo Drive navigates to new page
- Event: `turbo:render`
- Expect: Same behavior as HTMX

### Compatibility

- **No HTMX:** Works with vanilla navigation + popstate + MutationObserver
- **No Turbo:** Works with HTMX + vanilla
- **Both HTMX + Turbo:** No conflicts, both event types handled
- **No Navigation:** Works with initial load + scroll
- **prefers-reduced-motion:** CSS should handle per spec

### Customization

**Change scroll threshold:**
```javascript
// In scroll-state.js, line ~10:
const SCROLL_THRESHOLD = 16; // Instead of 8
```

**Disable scroll-to-top on navigation:**
```javascript
// In scroll-state.js, remove or comment out:
window.scrollTo({ top: 0, behavior: 'instant' });
```

**Force page title from attribute:**
```html
<main data-page-title="Force This Title">
  <h1>This H1 will be ignored</h1>
</main>
```

### Debugging

Enable console logs in browser DevTools to see event flow:
```
[Page Title] Initializing...
[Page Title] Applied: Korpus Übersicht
[Page Title] Observer mounted
[Scroll State] Initializing...
[Scroll State] Scroll listener registered
[Scroll State] ✅ Initialized
```

When navigating via HTMX:
```
[Page Title] Navigation event
[Page Title] Applied: New Page Title
[Scroll State] Navigation event, scrolling to top
[Scroll State] Changed to scrolled: false (scrollY: 0)
```
