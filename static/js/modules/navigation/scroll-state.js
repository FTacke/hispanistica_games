// ============================================
// Scroll State Detection (Framework-agnostisch)
// ============================================
// Setzt data-scrolled="true" auf <body> wenn scrollY > 8px
// Events: scroll (passive), DOMContentLoaded, htmx:*, turbo:*, popstate

let __scrollInit = false;

/**
 * Scroll-Schwelle für Titel-Transition
 */
const SCROLL_THRESHOLD = 8;

/**
 * data-scrolled Flag auf body aktualisieren
 */
function setScrolledFlag() {
  const threshold = SCROLL_THRESHOLD;
  const body = document.body;

  if (!body) return;

  const scrolled = window.scrollY > threshold;
  const current = body.getAttribute("data-scrolled") === "true";

  // Nur DOM schreiben wenn Zustand sich ändert
  if (scrolled !== current) {
    if (scrolled) {
      body.setAttribute("data-scrolled", "true");
    } else {
      body.removeAttribute("data-scrolled");
    }
    console.log(
      "[Scroll State] Changed to scrolled:",
      scrolled,
      "(scrollY:",
      window.scrollY,
      ")",
    );
  }
}

/**
 * Exports
 */
export function initScrollState() {
  if (__scrollInit) {
    console.log("[Scroll State] Already initialized, skipping");
    return;
  }
  __scrollInit = true;

  console.log("[Scroll State] Initializing...");

  // Initial anwenden
  setScrolledFlag();

  // Scroll-Listener (passive für Performance)
  window.addEventListener("scroll", setScrolledFlag, { passive: true });
  console.log("[Scroll State] Scroll listener registered");

  // Handler für Navigationsereignisse
  const handleNav = () => {
    console.log("[Scroll State] Navigation event, scrolling to top");
    // Optional: zu Top scrollen bei Navigation
    window.scrollTo({ top: 0, behavior: "instant" });
    setScrolledFlag();
  };

  // Standard Events
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
  window.addEventListener("pageshow", () => {
    console.log("[Scroll State] pageshow event");
    setScrolledFlag();
  });

  console.log("[Scroll State] ✅ Initialized");
}

// Auto-Init wenn direkt als Script geladen
try {
  initScrollState();
} catch (e) {
  console.warn("[Scroll State] Auto-init failed:", e);
}
