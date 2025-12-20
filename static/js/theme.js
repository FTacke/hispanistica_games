/**
 * CO.RA.PAN Global Theme Controller (MD3-konform)
 *
 * Unterstützt drei Modi:
 * - 'auto': Folgt System-Präferenz (prefers-color-scheme)
 * - 'light': Erzwingt helles Theme
 * - 'dark': Erzwingt dunkles Theme
 *
 * State wird in localStorage unter 'site-theme' persistiert.
 * HTML root erhält data-theme="auto|light|dark" und data-system-dark="true|false"
 */

(() => {
  // Remove the `no-js` class immediately when JS executes (moved from base.html)
  try {
    document.documentElement.classList.remove('no-js');
  } catch (e) {
    /* ignore */
  }
  const KEY = "site-theme"; // localStorage-Schlüssel
  const root = document.documentElement;
  const mm = window.matchMedia("(prefers-color-scheme: dark)");

  // Hilfsfunktionen
  const sysDark = () => mm.matches;
  const setSysFlag = () => {
    root.dataset.systemDark = sysDark() ? "true" : "false";
  };
  const load = () => localStorage.getItem(KEY) || "light"; // Default: light
  const save = (v) => localStorage.setItem(KEY, v);
  const apply = (v) => {
    root.dataset.theme = v;
    // Für backwards compatibility mit drawer-spezifischem Code
    if (v === "dark" || (v === "auto" && sysDark())) {
      root.classList.add("theme-dark");
    } else {
      root.classList.remove("theme-dark");
    }
  };

  // Initial setup
  setSysFlag();
  apply(load());

  // Attach load handlers to stylesheets that were deferred via data-async-onload
  // The pattern uses media="print" to prevent render-blocking, then switches to "all" on load
  try {
    document.querySelectorAll('link[data-async-onload]').forEach((lnk) => {
      // Check if already loaded (sheet is accessible when loaded)
      if (lnk.sheet) {
        lnk.media = 'all';
        lnk.removeAttribute('data-async-onload');
      } else {
        lnk.addEventListener('load', function () {
          try {
            this.media = 'all';
          } catch (e) {
            /* ignore */
          }
          this.removeAttribute('data-async-onload');
        });
        // Fallback: also handle error case
        lnk.addEventListener('error', function () {
          // Still switch media so the element doesn't stay in print mode
          try {
            this.media = 'all';
          } catch (e) {
            /* ignore */
          }
        });
      }
    });
  } catch (e) {
    // defensive
  }

  // System-Präferenz-Änderungen live verfolgen
  mm.addEventListener("change", () => {
    setSysFlag();
    const current = load();
    if (current === "auto") {
      apply("auto"); // Re-apply um classList zu aktualisieren
    }
  });

  // Public API für UI-Controls und Drawer-Interop
  window.SiteTheme = {
    /**
     * Setzt Theme-Modus und persistiert in localStorage
     * @param {string} mode - 'auto' | 'light' | 'dark'
     */
    set(mode) {
      if (!["auto", "light", "dark"].includes(mode)) {
        console.warn(
          `[SiteTheme] Ungültiger Modus: ${mode}. Erlaubt: auto, light, dark`,
        );
        return;
      }
      save(mode);
      apply(mode);
    },

    /**
     * Gibt aktuellen persistierten Modus zurück
     * @returns {string} 'auto' | 'light' | 'dark'
     */
    get() {
      return load();
    },

    /**
     * Gibt aktuelle System-Präferenz zurück
     * @returns {boolean} true wenn System dark mode aktiv
     */
    systemDark() {
      return sysDark();
    },

    /**
     * Gibt effektiven aktuellen Modus zurück (resolved)
     * @returns {string} 'light' | 'dark'
     */
    getEffective() {
      const mode = load();
      if (mode === "auto") {
        return sysDark() ? "dark" : "light";
      }
      return mode;
    },

    /**
     * Toggle zwischen light und dark (setzt auf expliziten Modus, nicht auto)
     */
    toggle() {
      const effective = this.getEffective();
      this.set(effective === "dark" ? "light" : "dark");
    },
  };

  // Dev-Logging
  if (window.location.search.includes("debug-theme")) {
    console.log("[SiteTheme] Initialized:", {
      mode: load(),
      effective: window.SiteTheme.getEffective(),
      systemDark: sysDark(),
    });
  }
})();
