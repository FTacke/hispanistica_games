/**
 * Page Router
 * Dynamically initialize page-specific modules based on data-page attribute.
 */

const pageInits = {
  atlas: async () => {
    try {
      // Note: We need to use the full path or a resolvable path. 
      // Since we are in static/js/modules/core/router.js, we need to go up.
      // But dynamic imports in browser need correct URLs.
      // The original code used Flask's url_for. We can't use that in a JS file.
      // We have to assume a standard path structure: /static/js/pages/...
      const mod = await import('../../pages/atlas.js');
      if (mod?.init) {
        await mod.init();
        console.log('[page-router] Atlas initialized');
      }
    } catch (err) {
      console.error('[page-router] Failed to initialize atlas:', err);
    }
  }
  // Register additional page initializers here
};

export function initPageRouter() {
  const page = document.body.dataset.page;
  if (!page) return;
  
  const init = pageInits[page];
  if (init) {
    console.log('[page-router] Initializing page:', page);
    init();
  }
}
