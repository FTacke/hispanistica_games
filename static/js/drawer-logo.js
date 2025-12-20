/**
 * Navigation Drawer Logo Theme Switcher + Index Logo
 *
 * Wechselt Logos basierend auf dem globalen Theme
 *
 * Drawer-Logos:
 * - Light-Mode: corapan_lightmode.png
 * - Dark-Mode: corapan_darkmode.png
 *
 * Index-Logo:
 * - Light-Mode: logo.png
 * - Dark-Mode: logo_darkmode.png
 */

(() => {
  const drawerLogoIds = ["drawerLogoModal", "drawerLogoStandard"];
  const indexLogoId = "indexLogo";

  /**
   * Aktualisiert alle Logos basierend auf Theme
   */
  function updateLogos(mode) {
    // Effektiven Modus ermitteln (für auto)
    let effective = mode;
    if (mode === "auto" && window.SiteTheme) {
      effective = window.SiteTheme.systemDark() ? "dark" : "light";
    }

    const isDark = effective === "dark";

    // Drawer-Logos
    drawerLogoIds.forEach((id) => {
      const logo = document.getElementById(id);
      if (!logo) return;

      const lightSrc = logo.dataset.logoLight;
      const darkSrc = logo.dataset.logoDark;

      if (isDark && darkSrc) {
        logo.src = darkSrc;
      } else if (lightSrc) {
        logo.src = lightSrc;
      }
    });

    // Index-Logo
    const indexLogo = document.getElementById(indexLogoId);
    if (indexLogo) {
      const lightSrc = indexLogo.dataset.logoLight;
      const darkSrc = indexLogo.dataset.logoDark;

      if (isDark && darkSrc) {
        indexLogo.src = darkSrc;
      } else if (lightSrc) {
        indexLogo.src = lightSrc;
      }
    }
  }

  // Initial update
  if (window.SiteTheme) {
    updateLogos(window.SiteTheme.get());
  } else {
    // Fallback: warte auf DOMContentLoaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        if (window.SiteTheme) updateLogos(window.SiteTheme.get());
      });
    }
  }

  // Lausche auf Theme-Änderungen
  if (window.SiteTheme && window.SiteTheme.set) {
    const originalSet = window.SiteTheme.set;
    window.SiteTheme.set = function (mode) {
      originalSet.call(window.SiteTheme, mode);
      updateLogos(mode);
    };
  }

  // Lausche auf externe Theme-Änderungen
  window.addEventListener("theme-changed", (e) => {
    if (e.detail?.mode) {
      updateLogos(e.detail.mode);
    }
  });

  // Lausche auf System-Präferenz-Änderungen
  const mm = window.matchMedia("(prefers-color-scheme: dark)");
  mm.addEventListener("change", () => {
    if (window.SiteTheme?.get() === "auto") {
      updateLogos("auto");
    }
  });

  // Dev-Logging
  if (window.location.search.includes("debug-theme")) {
    console.log("[DrawerLogo] Initialized:", {
      drawerLogosFound: drawerLogoIds.filter((id) =>
        document.getElementById(id),
      ).length,
      indexLogoFound: !!document.getElementById(indexLogoId),
    });
  }
})();
