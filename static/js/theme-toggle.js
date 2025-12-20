/**
 * Top App Bar Theme Toggle Controller
 *
 * Synchronisiert den Theme-Toggle-Button in der Top-App-Bar mit dem globalen Theme.
 * Toggle schaltet zwischen 'light' und 'dark' (kein 'auto' im Button).
 */

(() => {
  const btn = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");

  if (!btn || !icon) {
    console.warn("[ThemeToggle] Button oder Icon nicht gefunden");
    return;
  }

  /**
   * Aktualisiert UI basierend auf aktuellem Theme
   * @param {string} mode - 'light' | 'dark' | 'auto'
   */
  function updateUI(mode) {
    // Wenn auto, dann effektiven Modus ermitteln
    const effective =
      mode === "auto"
        ? window.SiteTheme?.systemDark()
          ? "dark"
          : "light"
        : mode;

    const isDark = effective === "dark";

    // ARIA und Tooltip
    btn.setAttribute("aria-pressed", String(isDark));
    btn.title = isDark ? "Darstellung: Dunkel" : "Darstellung: Hell";

    // Icon wechseln
    icon.textContent = isDark ? "dark_mode" : "light_mode";
  }

  /**
   * Toggle zwischen light und dark
   */
  function toggle() {
    if (!window.SiteTheme) {
      console.error("[ThemeToggle] SiteTheme API nicht verfügbar");
      return;
    }

    const current = window.SiteTheme.get();

    // Wenn aktuell 'auto', ermittle effektiven Modus und wechsle daraus
    let effective = current;
    if (current === "auto") {
      effective = window.SiteTheme.systemDark() ? "dark" : "light";
    }

    // Toggle zwischen light <-> dark (niemals zu auto wechseln)
    const next = effective === "dark" ? "light" : "dark";
    window.SiteTheme.set(next);
    updateUI(next);
  }

  // Initial UI update
  if (window.SiteTheme) {
    updateUI(window.SiteTheme.get());
  } else {
    // Fallback: warte auf DOMContentLoaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        if (window.SiteTheme) updateUI(window.SiteTheme.get());
      });
    }
  }

  // Button Click Handler
  btn.addEventListener("click", toggle);

  // Lausche auf System-Theme-Änderungen (nur wenn 'auto' aktiv)
  const mm = window.matchMedia("(prefers-color-scheme: dark)");
  mm.addEventListener("change", () => {
    if (window.SiteTheme?.get() === "auto") {
      updateUI("auto");
    }
  });

  // Optional: Externe Updates (wenn Theme anderweitig geändert wird)
  // z.B. durch Footer-Toggle oder andere Controls
  window.addEventListener("theme-changed", (e) => {
    if (e.detail?.mode) {
      updateUI(e.detail.mode);
    }
  });

  // Dev-Logging
  if (window.location.search.includes("debug-theme")) {
    console.log("[ThemeToggle] Initialized:", {
      currentMode: window.SiteTheme?.get(),
      effectiveMode: window.SiteTheme?.getEffective(),
    });
  }
})();
