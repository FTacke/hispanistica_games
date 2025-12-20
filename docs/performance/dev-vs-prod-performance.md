# Performance — Dev vs Prod / Quick Troubleshooting

Kurz & pragmatisch: Dieses Blatt erklärt, warum die lokale Dev-Umgebung häufig "langsamer" wirkt und welche Checks/Optimierungen sofort helfen (ohne Build-Schritt).

## Warum die Dev-Umgebung oft langsamer ist ⚠️
- DEBUG / unminified assets: Files werden nicht gebündelt oder minifiziert → mehr HTTP requests and bigger payloads.
- Source maps are enabled / unminified JS → slower parse/execution in Dev Tools. 
- No long-term caching: `Cache-Control` / ETag / service worker / CDN not present locally. 
- Live reloading / hot reloading and extra logging (console statements) can slow down perceived responsiveness.

## Common debugging features that affect perf
- python/env: FLASK_ENV=development (DEBUG True) → more overhead (template reloading, debug tracebacks)
- Browser Source Maps (dev tools): helpful for dev but cost more CPU during parse
- htmx / Turbo / other client-side libraries: swaps and reinitializers (HTMX swaps may trigger module re-initialization) — keep modules idempotent.

## What we changed (quick summary) ✅
- Frontend: added idempotency guards to avoid double-registration of global listeners for TopAppBar, Login sheet and Logout handler. This prevents duplicate event handlers and extra DOM scans when code runs more than once.
  - `static/js/modules/navigation/app-bar.js` — guard for init and TopAppBar instance
  - `static/js/modules/auth/login-sheet.js` — guard for global HTMX hooks
  - `static/js/logout.js` — guard to avoid duplicate document click listeners
- Template: `templates/auth/login.html` — page header `h1` is now intentionally empty so page-title logic won't pick up a redundant title (requested change).
- Backend: `src/app/routes/auth.py` — cleaned up logout handler unreachable code and ensured headers/logging run consistently.

## Dev vs Prod — what changes in production build 🔧
- Minification & bundling: JS/CSS are concatenated and minified which reduces parse & evaluation time.
- Asset fingerprinting + Cache headers: assets served with long cache lifetimes, JSON API calls remain dynamic.
- HTTP/2 or HTTP/3, CDN: fewer parallel requests perceived latency.
- Runtime optimizations (Uvicorn/gunicorn workers, using compiled files) improve throughput relative to simple dev server.

## Quick checks to identify real performance issues (browser) 🧭
1. Network tab: confirm asset sizes and # of requests — long-loading assets often visible here.
2. Performance tab: record load → look for scripting/paint bottlenecks.
3. Check for repeated listeners: in the console run

   window.__initTopAppUserMenu, window.__topAppBarInit, window.__loginSheetGlobalInit, window.__logoutInit

   If these are true in Dev then initializers are present and should not be re-registered repeatedly.
4. Inspect slow paths: check event handlers (Elements tab -> Event Listeners) to confirm multiple bindings.
5. HTMX/Turbo: Use `htmx.logAll()` (in console) or debug hooks to see repeated swaps causing re-inits.

## Practical short-term advice (low-hanging fruits) 🍋
- Keep `FLASK_ENV=development` for dev workflow but disable heavy logging when profiling.
- Use `--no-source-maps` or disable source maps in the browser when profiling render/parse time.
- Prefer event delegation for many similar elements (we audited and added guards in some modules).
- Avoid broad querySelectorAll usage inside hot handlers (input/keyup) — prefer scoping to a container or caching selectors.

## Useful commands / how to measure locally
- Run local dev server (dev flow) and open Chrome DevTools → Performance → record page load / interaction.
- Test production-like performance by serving static assets minified/bundled (or run a production run in docker) before concluding about code-level perf.

## Notes / Next steps
- If you still notice slowdowns in forms/dialogs, list specific views or reproduction steps and I can perform a focused audit (DOM traces / slow handler identification).

---
If you'd like, I can now run the unit tests and a quick smoke E2E (Playwright) to confirm no regressions from these small hygiene changes. 🔍
