// ============================================
// Viewport Detection - MD3 Window Size Classes
// ============================================
// Setzt data-viewport Attribut am <html> für CSS-Conditional-Styling
// compact: 0-599px | medium: 600-839px | expanded: ≥840px

(() => {
  // Guard: Nur einmal initialisieren (Turbo Drive kompatibel)
  if (window.__viewportInit) {
    console.log("[Viewport] Already initialized, skipping");
    return;
  }

  const root = document.documentElement;
  const mMedium = window.matchMedia("(min-width: 600px)");
  const mExpanded = window.matchMedia("(min-width: 840px)");

  function applyViewportClass() {
    const cls = mExpanded.matches
      ? "expanded"
      : mMedium.matches
        ? "medium"
        : "compact";

    // Set data attribute for CSS targeting
    root.dataset.viewport = cls;

    // Optional: Log für Debugging
    // console.log('[Viewport] Current size:', cls);
  }

  // Listen to media query changes
  [mMedium, mExpanded].forEach((m) =>
    m.addEventListener("change", applyViewportClass),
  );

  // Apply initial state
  applyViewportClass();

  // Mark as initialized
  window.__viewportInit = true;

  console.log("[Viewport] Initialized");
})();
