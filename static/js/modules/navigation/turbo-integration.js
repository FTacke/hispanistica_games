// ============================================
// Turbo Drive Integration für persistente Navigation
// ============================================
// Drawer-State bleibt erhalten bei Page-Wechseln
// Accordion öffnet/schließt OHNE Animation bei Route-Changes
// Diff-basiert: Nur Änderungen anwenden, kein Global-Reset

// Configure Turbo Progress Bar delay (show only after 200ms for short navigations)
if (window.Turbo && window.Turbo.config) {
  window.Turbo.config.drive.progressBarDelay = 200;
  console.log("[Turbo] Progress bar delay set to 200ms");
}

// Aktuell geöffnete Section tracken (persistent über Page-Wechsel)
let currentSection = null;

/**
 * Section aus URL-Pfad extrahieren
 * @param {string} pathname - URL pathname (z.B. /proyecto/diseno)
 * @returns {string|null} - Section name (z.B. 'proyecto') oder null
 */
function getSectionFromURL(pathname) {
  // Mapping: URL-Pfad → Section-ID
  if (pathname.startsWith("/proyecto")) return "proyecto";
  if (pathname.startsWith("/atlas")) return "atlas";
  if (pathname.startsWith("/corpus")) return "corpus";
  // Weitere Sections nach Bedarf
  return null;
}

/**
 * Pfad normalisieren für präzisen Vergleich
 * @param {string} href - URL oder Pfad
 * @returns {string} - Normalisierter Pfad
 */
function normalizePath(href) {
  try {
    const url = new URL(href, location.origin);
    let path = url.pathname;
    // Trailing Slash und index.html normalisieren
    path = path.replace(/\/index\.html$/i, "/");
    if (path.length > 1) {
      path = path.replace(/\/+$/, "");
    }
    return path;
  } catch (e) {
    return href;
  }
}

/**
 * Prüft ob Link aktiv ist basierend auf Match-Strategie
 * @param {HTMLAnchorElement} link - Link-Element
 * @param {string} currentPath - Aktueller normalisierter Pfad
 * @returns {boolean} - True wenn Link aktiv
 */
function isActiveLink(link, currentPath) {
  const linkPath = normalizePath(link.href);
  const matchType = link.dataset.match || "exact";

  if (matchType === "section") {
    // Parent-Link: Prefix-Regel für Unterseiten
    return currentPath.startsWith(linkPath);
  }

  // Standard: Exakte Übereinstimmung
  return linkPath === currentPath;
}

/**
 * Transitions temporär deaktivieren für instant state change
 * @param {Function} fn - Callback der während no-anim ausgeführt wird
 */
function setNoAnim(fn) {
  const drawer = document.getElementById("navigation-drawer");
  const modalDrawer = document.querySelector(".md3-navigation-drawer--modal");

  if (drawer) drawer.classList.add("no-anim");
  if (modalDrawer) modalDrawer.classList.add("no-anim");

  fn();

  // Animation nach nächstem Frame wieder aktivieren
  requestAnimationFrame(() => {
    if (drawer) drawer.classList.remove("no-anim");
    if (modalDrawer) modalDrawer.classList.remove("no-anim");
  });
}

/**
 * Accordion diff-basiert für Section öffnen/schließen
 * NUR ändern wenn nötig, NIE global reset
 * @param {string} section - Section name (z.B. 'proyecto') oder null
 */
function ensureAccordionFor(section) {
  console.log("[Turbo Accordion] ensureAccordionFor called:", {
    section,
    currentSection,
  });

  const drawer = document.getElementById("navigation-drawer");
  if (!drawer) {
    console.log("[Turbo Accordion] No drawer, skipping");
    return;
  }

  // Finde aktuell geöffnetes Panel
  const openBtn = drawer.querySelector(
    '.md3-navigation-drawer__trigger[aria-expanded="true"]',
  );
  const openSection = openBtn ? openBtn.getAttribute("data-section") : null;

  console.log(
    "[Turbo Accordion] Current open section:",
    openSection,
    "→ Target section:",
    section,
  );

  // Diff: Nur ändern wenn State unterschiedlich
  if (openSection === section) {
    console.log("[Turbo Accordion] Already in correct state, skipping");
    currentSection = section;
    return;
  }

  // State-Change nötig

  // 1) Altes Panel schließen (falls vorhanden)
  if (openBtn && openSection !== section) {
    console.log("[Turbo Accordion] Closing section:", openSection);
    const panelId = openBtn.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;

    if (panel) {
      openBtn.setAttribute("aria-expanded", "false");
      panel.removeAttribute("data-open");
      panel.setAttribute("aria-hidden", "true");
      if (panel.inert !== undefined) {
        panel.inert = true;
      }
    }
  }

  // 2) Neues Panel öffnen (falls section angegeben)
  if (section) {
    const btn = drawer.querySelector(
      `.md3-navigation-drawer__trigger[data-section="${section}"]`,
    );
    if (!btn) {
      // No accordion for this section - it's a direct link (e.g., corpus, atlas)
      // This is expected behavior, not an error
      currentSection = section;
      return;
    }

    const panelId = btn.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) {
      console.warn(
        "[Turbo Accordion] Panel element not found for button:",
        btn,
      );
      currentSection = section;
      return;
    }

    // Öffnen (data-hydrating ist aktiv, keine Animation)
    console.log("[Turbo Accordion] Opening section:", section);
    btn.setAttribute("aria-expanded", "true");
    panel.setAttribute("data-open", "");
    panel.setAttribute("aria-hidden", "false");
    if (panel.inert !== undefined) {
      panel.inert = false;
    }

    // Dispatch event for DataTable adjustment (if corpus section)
    if (section === "corpus") {
      requestAnimationFrame(() => {
        document.dispatchEvent(new Event("corpus:accordion-open"));
      });
    }
  }

  currentSection = section;
  console.log("[Turbo Accordion] Updated currentSection to:", currentSection);
}

/**
 * Highlight aktive Navigation basierend auf aktueller URL
 * Saubere ARIA-Implementierung: aria-current nur bei aktiven Links
 */
function highlightNavigationFromURL(pathname) {
  console.log("[Turbo Highlight] Highlighting navigation for:", pathname);

  const drawer = document.getElementById("navigation-drawer");
  if (!drawer) return;

  const currentPath = normalizePath(pathname);
  console.log("[Turbo Highlight] Normalized path:", currentPath);

  // 1) Reset: Attribute ENTFERNEN statt auf "false" setzen
  // Sowohl Links als auch Trigger-Buttons
  drawer
    .querySelectorAll("a[aria-current], .md3-navigation-drawer__trigger")
    .forEach((el) => {
      el.removeAttribute("aria-current");
      el.classList.remove(
        "md3-navigation-drawer__item--active",
        "md3-navigation-drawer__subitem--active",
      );
    });

  // 2) Aktive Links finden und markieren
  let activeCount = 0;
  let hasActiveSubitem = false;
  let activeSubmenu = null;

  drawer.querySelectorAll("a[href]").forEach((link) => {
    if (isActiveLink(link, currentPath)) {
      activeCount++;
      link.setAttribute("aria-current", "page");

      // CSS-Klassen für Styling
      if (link.classList.contains("md3-navigation-drawer__subitem")) {
        link.classList.add("md3-navigation-drawer__subitem--active");
        hasActiveSubitem = true;

        // Merke das aktive Submenu
        activeSubmenu = link.closest(".md3-navigation-drawer__submenu");
      } else if (link.classList.contains("md3-navigation-drawer__item")) {
        link.classList.add("md3-navigation-drawer__item--active");
      }
    }
  });

  // 3) Parent-Trigger als aktiv markieren, wenn Subitem aktiv ist
  if (hasActiveSubitem && activeSubmenu) {
    const triggerId = activeSubmenu.getAttribute("aria-labelledby");
    const trigger = document.getElementById(triggerId);
    if (trigger) {
      trigger.classList.add("md3-navigation-drawer__item--active");
      console.log("[Turbo Highlight] Marked parent trigger as active");
    }
  }

  console.log("[Turbo Highlight] Marked", activeCount, "links as active");
}

/**
 * Mobilen Modal Drawer schließen vor Navigation
 */
function closeMobileDrawer() {
  const modalDrawer = document.getElementById("navigation-drawer-modal");
  if (modalDrawer && modalDrawer.open) {
    modalDrawer.close();
  }
}

/**
 * Drawer-State in localStorage speichern
 */
function saveDrawerState() {
  const openSubmenu = document.querySelector(
    ".md3-navigation-drawer__submenu[data-open]",
  );
  if (openSubmenu) {
    localStorage.setItem("drawerOpenGroup", openSubmenu.id);
  } else {
    localStorage.removeItem("drawerOpenGroup");
  }

  // Scroll-Position des Drawers speichern (optional)
  const drawer = document.querySelector(".md3-navigation-drawer__content");
  if (drawer) {
    localStorage.setItem("drawerScrollTop", drawer.scrollTop);
  }
}

/**
 * Drawer-State aus localStorage wiederherstellen
 */
function restoreDrawerState() {
  // Geöffnetes Submenü wiederherstellen
  const openGroupId = localStorage.getItem("drawerOpenGroup");
  if (openGroupId) {
    const submenu = document.getElementById(openGroupId);
    if (submenu && !submenu.hasAttribute("data-open")) {
      const triggerId = submenu.getAttribute("aria-labelledby");
      const trigger = document.getElementById(triggerId);
      if (trigger) {
        // Submenü öffnen ohne Animation (da Restore)
        trigger.setAttribute("aria-expanded", "true");
        submenu.setAttribute("data-open", "");
        submenu.setAttribute("aria-hidden", "false");
        if (submenu.inert !== undefined) {
          submenu.inert = false;
        }
      }
    }
  }

  // Scroll-Position wiederherstellen
  const scrollTop = localStorage.getItem("drawerScrollTop");
  if (scrollTop) {
    const drawer = document.querySelector(".md3-navigation-drawer__content");
    if (drawer) {
      drawer.scrollTop = parseInt(scrollTop, 10);
    }
  }
}

/**
 * Turbo Drive Events für Navigation-Updates
 */
export function initTurboIntegration() {
  console.log("[Turbo Integration] Initializing...");

  const drawer = document.getElementById("navigation-drawer");

  // Hydration Guard: Transitions deaktivieren während Turbo-Render
  document.addEventListener("turbo:before-render", () => {
    console.log("[Turbo] Before render - activating hydration guard");
    drawer?.setAttribute("data-hydrating", "");
    document.body.setAttribute("data-hydrating", ""); // For focus suppression
  });

  document.addEventListener("turbo:render", () => {
    console.log("[Turbo] Render complete - deactivating hydration guard");
    // Nach Render genau einen Frame warten, dann wieder animierbar
    requestAnimationFrame(() => {
      drawer?.removeAttribute("data-hydrating");
      document.body.removeAttribute("data-hydrating");
    });
  });

  // Bei Page-Load: Section prüfen und Accordion diff-basiert anpassen
  document.addEventListener("turbo:load", () => {
    console.log(
      "[Turbo] turbo:load event fired, pathname:",
      window.location.pathname,
    );
    const section = getSectionFromURL(window.location.pathname);
    console.log("[Turbo] Detected section:", section);
    highlightNavigationFromURL(window.location.pathname); // Nur Link-Highlights
    ensureAccordionFor(section); // Diff-basiert: nur ändern wenn nötig

    // Focus management removed to prevent blue flash during navigation
    // Focus is only set on keyboard interaction in main.js
  });

  // Vor Navigation: Mobilen Drawer schließen
  document.addEventListener("turbo:before-visit", () => {
    closeMobileDrawer();
  });

  // Vor Turbo Cache: Cleanup flags
  document.addEventListener("turbo:before-cache", () => {
    console.log("[Turbo] Before cache - cleaning up hydration flags");
    drawer?.removeAttribute("data-hydrating");
    document.body.removeAttribute("data-hydrating");
  });

  // Optional: Progress-Indicator während Navigation
  document.addEventListener("turbo:before-visit", () => {
    document.body.classList.add("turbo-loading");
  });

  document.addEventListener("turbo:load", () => {
    document.body.classList.remove("turbo-loading");
  });

  document.addEventListener("turbo:visit", () => {
    document.body.classList.remove("turbo-loading");
  });

  // Initiales Setup
  const initialSection = getSectionFromURL(window.location.pathname);
  highlightNavigationFromURL(window.location.pathname);
  ensureAccordionFor(initialSection);

  console.log(
    "[Turbo Integration] Initialized with diff-based accordion and hydration guard",
  );
}
