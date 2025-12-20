// ============================================
// Top App Bar Controller - User Menu Handler
// ============================================

/**
 * Initialize User Menu Toggle
 *
 * Handles opening/closing of avatar dropdown menu.
 * Uses delegated event listeners to work on every page load.
 * Binds on DOMContentLoaded to ensure DOM is ready.
 */
function initUserMenu() {
  // Guard: only initialize once to avoid duplicated listeners when module is loaded twice
  if (window.__initTopAppUserMenu) return;
  window.__initTopAppUserMenu = true;
  // Delegate: Find elements whenever they exist (after any page reload)
  // Accept either the new account trigger or the legacy user-menu toggle
  const btn = document.querySelector("[data-account-menu-trigger], [data-user-menu-toggle]");
  const menu = document.querySelector("[data-user-menu]");

  if (!btn || !menu) {
    console.log("[TopAppBar] User menu not found on this page");
    return;
  }

  // Open/Close on button click
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menu.hasAttribute("data-open");

    if (isOpen) {
      closeUserMenu(btn, menu);
    } else {
      openUserMenu(btn, menu);
    }
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      closeUserMenu(btn, menu);
    }
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.hasAttribute("data-open")) {
      closeUserMenu(btn, menu);
      btn.focus();
    }
  });

  console.log("[TopAppBar] User menu initialized");
}

function openUserMenu(btn, menu) {
  menu.setAttribute("data-open", "1");
  btn.setAttribute("aria-expanded", "true");

  // Focus first menu item
  const firstItem = menu.querySelector('[role="menuitem"]');
  if (firstItem) {
    setTimeout(() => firstItem.focus(), 50);
  }
}

function closeUserMenu(btn, menu) {
  menu.removeAttribute("data-open");
  btn.setAttribute("aria-expanded", "false");
}

/**
 * Top App Bar Manager (Legacy - kept for compatibility)
 * - Transparent, Elevation 0
 * - Burger links (nur Compact/Medium)
 * - Login/Avatar rechts
 * - User Menu mit Logout
 * - Login redirect (MD3 Goldstandard: full-page login)
 */
export class TopAppBar {
  constructor() {
    // Prevent double-instantiation across different initializers
    if (window.__topAppBarInit) return window.__topAppBarInstance;

    this.appBar = document.querySelector('[data-element="top-app-bar"]');

    if (!this.appBar) {
      console.warn("[TopAppBar] App Bar not found");
      return;
    }

    this.init();
  }

  init() {
    // User menu functionality
    this.initUserMenu();

    // Login handler (MD3 Goldstandard: full-page login)
    this.initLoginHandler();

    // Optional: Check for ?showlogin=1 query parameter
    this.checkAutoOpenLogin();
  }

  /**
   * User Menu (Avatar mit Logout-Menü)
   */
  initUserMenu() {
    const userMenuRoot = document.querySelector("[data-user-menu-root]");
    if (!userMenuRoot) return;

    const toggle = userMenuRoot.querySelector("[data-account-menu-trigger], [data-user-menu-toggle]");
    const dropdown = userMenuRoot.querySelector("[data-user-menu]");

    if (!toggle || !dropdown) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";

      if (isExpanded) {
        this.closeUserMenu(toggle, dropdown);
      } else {
        this.openUserMenu(toggle, dropdown);
      }
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!userMenuRoot.contains(e.target)) {
        this.closeUserMenu(toggle, dropdown);
      }
    });

    // Close on ESC
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        toggle.getAttribute("aria-expanded") === "true"
      ) {
        this.closeUserMenu(toggle, dropdown);
        toggle.focus();
      }
    });
  }

  openUserMenu(toggle, dropdown) {
    toggle.setAttribute("aria-expanded", "true");
    dropdown.hidden = false;

    // Focus first item (Logout button)
    const firstItem = dropdown.querySelector('[role="menuitem"]');
    if (firstItem) {
      setTimeout(() => firstItem.focus(), 50);
    }
  }

  closeUserMenu(toggle, dropdown) {
    toggle.setAttribute("aria-expanded", "false");
    dropdown.hidden = true;
  }

  /**
   * Login redirect handler
   * MD3 Goldstandard: Login is always full-page, no sheet overlay
   */
  initLoginHandler() {
    // "open-login" buttons now navigate to full-page login
    const openButtons = document.querySelectorAll('[data-action="open-login"]');
    openButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        // Get current URL as next parameter for redirect after login
        const currentUrl = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(currentUrl)}`;
      });
    });
  }

  /**
   * Auto-redirect to login if ?showlogin=1 in URL
   * MD3 Goldstandard: Redirect to /login with next parameter
   */
  checkAutoOpenLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("showlogin") === "1") {
      // Build clean next URL (without showlogin param)
      const url = new URL(window.location);
      url.searchParams.delete("showlogin");
      const nextUrl = url.pathname + url.search;
      
      // Redirect to full-page login
      window.location.href = `/login?next=${encodeURIComponent(nextUrl)}`;
    }
  }
}

/**
 * Initialize top app bar
 */
export function initTopAppBar() {
  const inst = new TopAppBar();
  if (!window.__topAppBarInit) {
    window.__topAppBarInit = true;
    window.__topAppBarInstance = inst;
  }
  return inst;
}

// Export delegated user menu initializer
export { initUserMenu };
