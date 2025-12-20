/**
 * Atlas Page Initializer
 *
 * Lazy-loads dependencies and initializes the Atlas map.
 * Called by the global page router when data-page="atlas" is detected.
 */

/**
 * Ensure a stylesheet is loaded
 */
function ensureStyles(url) {
  if (document.querySelector(`link[href="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Ensure a script is loaded
 */
function ensureScript(url) {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Initialize Atlas on the current page
 */
export async function init() {
  const mapEl = document.getElementById("atlas-map");
  if (!mapEl) {
    console.warn("[atlas] Map container not found (#atlas-map)");
    return;
  }

  console.log("[atlas] Initializing...");

  try {
    // 1) Load external Leaflet dependencies
    ensureStyles("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    ensureStyles("/static/css/md3/components/atlas.css");
    await ensureScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");

    // 2) Wait for Leaflet to be available
    if (!window.L) {
      console.error("[atlas] Leaflet not loaded");
      return;
    }

    // 3) Dynamically import Atlas module
    const atlasModule = await import("/static/js/modules/atlas/index.js");

    // 4) Initialize Atlas (calls internal bootstrap with Leaflet ready)
    if (atlasModule?.init) {
      const mapInstance = atlasModule.init();
      console.log("[atlas] Initialized successfully");
    } else {
      console.error("[atlas] No init function exported from atlas module");
    }
  } catch (error) {
    console.error("[atlas] Initialization failed:", error);
  }
}
