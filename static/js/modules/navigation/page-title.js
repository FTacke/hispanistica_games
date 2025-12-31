// ============================================
// Page Title Module (Framework-agnostisch)
// ============================================
// Bestimmt Seitentitel aus mehreren Quellen
// und synchronisiert sie mit <span id="pageTitle">
// Events: DOMContentLoaded, htmx:*, turbo:*, popstate

let __pageTitleInit = false;

/**
 * Titel aus verschiedenen Quellen ermitteln (Priorität):
 * 1. main[data-page-title] Attribut
 * 2. <h1> in main
 * 3. meta[name="page-title"] content
 * 4. document.title (ohne Suffix)
 */
function pickTitle() {
  // 1. data-page-title Attribut
  const main = document.querySelector("main");
  if (main) {
    const fromAttr = main.getAttribute("data-page-title");
    if (fromAttr && fromAttr.trim()) {
      return fromAttr.trim();
    }
    // 2. H1 im Main
    const h1 = main.querySelector("h1");
    if (h1 && h1.textContent.trim()) {
      return h1.textContent.trim();
    }
  }

  // 3. meta[name="page-title"]
  const meta = document.querySelector('meta[name="page-title"]');
  if (meta && meta.content && meta.content.trim()) {
    return meta.content.trim();
  }

  // 4. document.title (ohne "| Games.Hispanistica" Suffix)
  const base = (document.title || "")
    .replace(/\s*\|\s*Games\.Hispanistica\s*$/i, "")
    .trim();
  if (base) return base;

  return "Games.Hispanistica";
}

/**
 * Titel in DOM anwenden und document.title aktualisieren
 */
function applyTitle() {
  const title = pickTitle();

  // Ziel-Element mit ID "pageTitle"
  const pageTitleEl = document.getElementById("pageTitle");
  if (pageTitleEl) {
    pageTitleEl.textContent = title;
    console.log("[Page Title] Applied:", title);
  } else {
    console.warn("[Page Title] Element #pageTitle not found!");
  }

  // document.title mit Suffix aktualisieren
  const suffix = "Games.Hispanistica";
  if (title && title !== suffix) {
    document.title = `${title} | ${suffix}`;
  } else {
    document.title = suffix;
  }
}

/**
 * MutationObserver für Live-Änderungen im <main>
 */
let observer = null;

function setupObserver() {
  const main = document.querySelector("main");
  if (!main) return;

  // Alten Observer deaktivieren
  if (observer) {
    observer.disconnect();
  }

  // Neuer Observer mit Debounce
  let timeoutId = null;
  observer = new MutationObserver(() => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      console.log("[Page Title] Mutation detected in main");
      applyTitle();
    }, 50);
  });

  observer.observe(main, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: false,
  });

  console.log("[Page Title] Observer mounted");
}

/**
 * Exports
 */
export function initPageTitle() {
  if (__pageTitleInit) {
    console.log("[Page Title] Already initialized, skipping");
    return;
  }
  __pageTitleInit = true;

  console.log("[Page Title] Initializing...");

  // Initial anwenden
  applyTitle();
  setupObserver();

  // Event Handler - nur einmal registrieren
  const handleNav = () => {
    console.log("[Page Title] Navigation event");
    applyTitle();
    setupObserver(); // Observer nach Swap neu aufbauen
  };

  // Standard: DOMContentLoaded (bei erster Ladung)
  document.addEventListener("DOMContentLoaded", handleNav, { once: true });

  // HTMX Events
  if (window.htmx) {
    document.body.addEventListener("htmx:afterSwap", handleNav);
    document.body.addEventListener("htmx:afterSettle", handleNav);
    document.body.addEventListener("htmx:historyRestore", handleNav);
  }

  // Turbo Events
  if ("Turbo" in window) {
    document.addEventListener("turbo:render", handleNav);
  }

  // Browser Back/Forward
  window.addEventListener("popstate", handleNav);

  // Fallback: pageshow (bfcache)
  window.addEventListener("pageshow", handleNav);

  console.log("[Page Title] ✅ Initialized");
}

// Auto-Init wenn direkt als Script geladen
try {
  initPageTitle();
} catch (e) {
  console.warn("[Page Title] Auto-init failed:", e);
}
