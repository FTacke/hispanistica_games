// ============================================
// JWT Token Auto-Refresh Initialization
// ============================================
import { setupTokenRefresh } from "./modules/auth/token-refresh.js";

// ============================================
// Analytics (anonymous, GDPR-compliant)
// ============================================
import { initAnalytics } from "./modules/analytics.js";

// ============================================
// Navigation Drawer Handler
// ============================================
import { NavigationDrawer } from "./modules/navigation/drawer.js";

// ============================================
// Navigation Accordion Handler
// ============================================
import { initAccordion } from "./modules/navigation/accordion.js";

// ============================================
// Top App Bar User Menu Handler
// ============================================
import { initUserMenu } from "./modules/navigation/app-bar.js";

// Setup automatic token refresh on app initialization
setupTokenRefresh();

// Initialize analytics (tracks visit once per session)
initAnalytics();

// CSS.escape polyfill (MDN) - define globally for older browsers if missing
if (typeof CSS === "undefined" || typeof CSS.escape !== "function") {
  (function (global) {
    function cssEscape(value) {
      if (arguments.length === 0) {
        throw new TypeError("`CSS.escape` requires an argument.");
      }
      var string = String(value);
      var length = string.length;
      var index = -1;
      var codeUnit;
      var result = "";
      var firstCodeUnit = string.charCodeAt(0);
      while (++index < length) {
        codeUnit = string.charCodeAt(index);
        // Note: there’s no need to special-case astral symbols, surrogate
        // pairs, or lone surrogates.
        if (codeUnit === 0x0000) {
          result += "\uFFFD";
          continue;
        }
        if (
          (codeUnit >= 0x0001 && codeUnit <= 0x001f) ||
          codeUnit === 0x007f ||
          (index === 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
          (index === 1 &&
            index === 0 &&
            codeUnit >= 0x0030 &&
            codeUnit <= 0x0039 &&
            firstCodeUnit === 0x002d)
        ) {
          result += "\\" + codeUnit.toString(16) + " ";
          continue;
        }
        if (index === 0 && codeUnit === 0x002d && length === 1) {
          result += "\\-";
          continue;
        }
        if (
          codeUnit >= 0x0080 ||
          codeUnit === 0x002d ||
          codeUnit === 0x005f ||
          (codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
          (codeUnit >= 0x0041 && codeUnit <= 0x005a) ||
          (codeUnit >= 0x0061 && codeUnit <= 0x007a)
        ) {
          result += string.charAt(index);
          continue;
        }
        result += "\\" + string.charAt(index);
      }
      return result;
    }
    if (global.CSS === undefined) global.CSS = {};
    global.CSS.escape = cssEscape;
  })(window);
}

// Initialize navigation drawer (modal + standard)
new NavigationDrawer();

// Initialize drawer accordion handler (delegated, runs once)
initAccordion();

// Initialize user menu handler (delegated, runs once)
document.addEventListener("DOMContentLoaded", () => {
  initUserMenu();
});

// ============================================
// Atlas Module - Lazy Loading
// ============================================
let atlasMap = null;
let atlasModule = null;

async function initAtlas() {
  const mapEl = document.getElementById("atlas-map");
  if (!mapEl) return;

  console.log("[Atlas] Initializing...");

  try {
    // 1) Load external dependencies
    ensureStyles("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    ensureStyles("/static/css/md3/components/atlas.css");
    await ensureScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");

    // 2) Prevent double initialization
    if (atlasMap) {
      console.log("[Atlas] Map already exists, removing...");
      try {
        atlasMap.remove();
      } catch (e) {
        console.warn("[Atlas] Error removing map:", e);
      }
      atlasMap = null;
    }

    // 3) Wait for Leaflet to be available
    if (!window.L) {
      console.error("[Atlas] Leaflet not loaded");
      return;
    }

    // 4) Dynamically import Atlas module
    if (!atlasModule) {
      atlasModule = await import("/static/js/modules/atlas/index.js");
      console.log("[Atlas] Module loaded");
    }

    // 5) Initialize Atlas
    if (atlasModule.init) {
      atlasMap = atlasModule.init();
      console.log("[Atlas] Initialized successfully");
    }
  } catch (error) {
    console.error("[Atlas] Initialization failed:", error);
  }
}

function teardownAtlas() {
  if (atlasMap) {
    console.log("[Atlas] Tearing down...");
    try {
      atlasMap.remove();
    } catch (e) {
      console.warn("[Atlas] Error during teardown:", e);
    }
    atlasMap = null;
  }
}

function ensureStyles(href) {
  if (!document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-turbo-track", "dynamic");
    document.head.appendChild(link);
  }
}

async function ensureScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Atlas Turbo Hooks
document.addEventListener("turbo:load", initAtlas);
document.addEventListener("turbo:before-cache", teardownAtlas);

// ============================================
// Mobile Navigation
// ============================================
const navbarRoot = document.querySelector(".site-header");
const mobileToggle = navbarRoot?.querySelector("[data-mobile-toggle]");
const mobileMenu = navbarRoot?.querySelector("[data-mobile-menu]");
const mobileClose = mobileMenu?.querySelector("[data-mobile-close]");
const mobileBackdrop = mobileMenu?.querySelector("[data-mobile-backdrop]");
let lastFocusedElement = null;

const focusableSelectors =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
let releaseFocusTrap = () => {};
const MOBILE_MENU_TRANSITION_FALLBACK = 380;
let mobileMenuTransitionHandler = null;
let mobileMenuCloseTimeout = null;
let mobileMenuAnimationFrame = null;

function getMobileMenuTransitionDuration() {
  if (!mobileMenu) return MOBILE_MENU_TRANSITION_FALLBACK;
  // Try canonical app token first, fall back to legacy token for compatibility
  let raw = getComputedStyle(mobileMenu)
    .getPropertyValue("--app-mobile-menu-duration")
    .trim();
  if (!raw) {
    raw = getComputedStyle(mobileMenu)
      .getPropertyValue("--md3-mobile-menu-duration")
      .trim();
  }
  if (!raw) return MOBILE_MENU_TRANSITION_FALLBACK;
  if (raw.endsWith("ms")) {
    const value = Number.parseFloat(raw);
    return Number.isNaN(value) ? MOBILE_MENU_TRANSITION_FALLBACK : value;
  }
  if (raw.endsWith("s")) {
    const value = Number.parseFloat(raw);
    return Number.isNaN(value) ? MOBILE_MENU_TRANSITION_FALLBACK : value * 1000;
  }
  const value = Number.parseFloat(raw);
  return Number.isNaN(value) ? MOBILE_MENU_TRANSITION_FALLBACK : value;
}

function trapFocus(container) {
  const focusable = Array.from(
    container.querySelectorAll(focusableSelectors),
  ).filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1,
  );
  if (!focusable.length) return () => {};
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  function handleKeydown(event) {
    if (event.key !== "Tab") return;
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  container.addEventListener("keydown", handleKeydown);
  return () => container.removeEventListener("keydown", handleKeydown);
}

function openMobileMenu() {
  if (!mobileMenu) return;
  if (mobileMenuTransitionHandler) {
    mobileMenu.removeEventListener(
      "transitionend",
      mobileMenuTransitionHandler,
    );
    mobileMenuTransitionHandler = null;
  }
  if (mobileMenuCloseTimeout) {
    window.clearTimeout(mobileMenuCloseTimeout);
    mobileMenuCloseTimeout = null;
  }
  mobileMenu.hidden = false;
  // Force reflow so transitions fire correctly.
  void mobileMenu.getBoundingClientRect();
  document.body.classList.add("overflow-hidden");
  mobileToggle?.setAttribute("aria-expanded", "true");
  lastFocusedElement = document.activeElement;
  const dialog = mobileMenu.querySelector('[role="dialog"]');
  if (dialog) {
    releaseFocusTrap = trapFocus(dialog);
  }
  if (mobileMenuAnimationFrame) {
    window.cancelAnimationFrame(mobileMenuAnimationFrame);
  }
  mobileMenuAnimationFrame = window.requestAnimationFrame(() => {
    mobileMenuAnimationFrame = null;
    mobileMenu.classList.add("is-open");
    if (dialog) {
      const firstFocusable = dialog.querySelector(focusableSelectors);
      firstFocusable?.focus();
    }
  });
}

function closeMobileMenu() {
  if (!mobileMenu || mobileMenu.hidden) return;

  // Close all expanded collapsibles before closing menu
  const collapsibleTriggers = document.querySelectorAll(
    ".md3-mobile-collapsible__trigger",
  );
  collapsibleTriggers.forEach((trigger) => {
    trigger.setAttribute("aria-expanded", "false");
    const contentId = trigger.getAttribute("aria-controls");
    const content = document.getElementById(contentId);
    if (content) {
      content.classList.remove("is-expanded");
      content.hidden = true;
    }
  });

  if (mobileMenuTransitionHandler) {
    mobileMenu.removeEventListener(
      "transitionend",
      mobileMenuTransitionHandler,
    );
    mobileMenuTransitionHandler = null;
  }
  if (mobileMenuCloseTimeout) {
    window.clearTimeout(mobileMenuCloseTimeout);
    mobileMenuCloseTimeout = null;
  }
  mobileMenu.classList.remove("is-open");
  if (mobileMenuAnimationFrame) {
    window.cancelAnimationFrame(mobileMenuAnimationFrame);
    mobileMenuAnimationFrame = null;
  }
  document.body.classList.remove("overflow-hidden");
  mobileToggle?.setAttribute("aria-expanded", "false");
  releaseFocusTrap();
  if (lastFocusedElement) {
    lastFocusedElement.focus();
  }
  mobileMenuTransitionHandler = (event) => {
    if (event.target !== mobileMenu || event.propertyName !== "opacity") {
      return;
    }
    mobileMenu.hidden = true;
    mobileMenu.removeEventListener(
      "transitionend",
      mobileMenuTransitionHandler,
    );
    mobileMenuTransitionHandler = null;
    if (mobileMenuCloseTimeout) {
      window.clearTimeout(mobileMenuCloseTimeout);
      mobileMenuCloseTimeout = null;
    }
  };
  mobileMenu.addEventListener("transitionend", mobileMenuTransitionHandler);
  const menuTransitionDuration = getMobileMenuTransitionDuration();
  mobileMenuCloseTimeout = window.setTimeout(() => {
    if (!mobileMenu.hidden) {
      mobileMenu.hidden = true;
    }
    if (mobileMenuTransitionHandler) {
      mobileMenu.removeEventListener(
        "transitionend",
        mobileMenuTransitionHandler,
      );
      mobileMenuTransitionHandler = null;
    }
    mobileMenuCloseTimeout = null;
  }, menuTransitionDuration);
}

mobileToggle?.addEventListener("click", () => {
  if (!mobileMenu) return;
  if (mobileMenu.classList.contains("is-open")) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
});

mobileClose?.addEventListener("click", closeMobileMenu);
mobileBackdrop?.addEventListener("click", closeMobileMenu);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (mobileMenu && mobileMenu.classList.contains("is-open")) {
      closeMobileMenu();
    }
    if (userMenuOpen) {
      closeUserMenu();
      userMenuToggle?.focus();
    }
    if (loginSheet && !loginSheet.hidden) {
      closeLogin();
    }
  }
});

// Accept new account trigger selector or legacy user menu toggle
const userMenuToggle = navbarRoot?.querySelector("[data-account-menu-trigger], [data-user-menu-toggle]");
const userMenu = navbarRoot?.querySelector("[data-user-menu]");
let userMenuOpen = false;

function openUserMenu() {
  if (!userMenu) return;
  userMenu.hidden = false;
  userMenuToggle?.setAttribute("aria-expanded", "true");
  userMenuOpen = true;
  const firstFocusable = userMenu.querySelector(focusableSelectors);
  firstFocusable?.focus();
}

function closeUserMenu() {
  if (!userMenu) return;
  userMenu.hidden = true;
  userMenuToggle?.setAttribute("aria-expanded", "false");
  userMenuOpen = false;
}

userMenuToggle?.addEventListener("click", (event) => {
  event.preventDefault();
  if (!userMenu) return;
  if (userMenuOpen) {
    closeUserMenu();
  } else {
    openUserMenu();
  }
});

document.addEventListener("click", (event) => {
  if (!userMenuOpen) return;
  if (
    !userMenu?.contains(event.target) &&
    !userMenuToggle?.contains(event.target)
  ) {
    closeUserMenu();
  }
});

userMenu?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("a, button")) {
    closeUserMenu();
  }
});

let previouslyFocusedForLogin = null;
let scrollPositionBeforeLogin = 0;

/**
 * Open login - MD3 Goldstandard: Navigate to full-page login
 * No more sheet/overlay pattern.
 */
function openLogin() {
  // Get current URL as next parameter for redirect after login
  const currentUrl = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(currentUrl)}`;
}

// Legacy closeLogin removed - not needed with full-page login

// Use event delegation to handle login buttons (works after page reload)
document.addEventListener("click", (event) => {
  const target = event.target;

  // Check if clicked element or its parent is an open-login button
  const openButton = target.closest('[data-action="open-login"]');
  if (openButton) {
    event.preventDefault();
    console.log("[Auth] Redirecting to login page (MD3 Goldstandard)");
    openLogin();
    return;
  }

  // close-login buttons no longer needed with full-page login
});

// Login form submission handler (event delegation for page reload resilience)
document.addEventListener("submit", (event) => {
  // Standard form submission - let the browser handle it
  // The login page form submits directly to /auth/login
  const form = event.target;
  if (form && form.id === "login-form") {
    console.log("[Auth] Login form submitted");
    // Form submits naturally - browser handles redirect with cookies
  }
});

// No sessionStorage-based redirect mechanism used anymore; rely on server-side `save-redirect` and next/session fallback

function getCookie(name) {
  return (
    document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${name}=`))
      ?.split("=")[1] || ""
  );
}

function syncLogoutCsrf() {
  const logoutForms = document.querySelectorAll(
    '[data-element^="logout-form"]',
  );
  if (!logoutForms.length) return;
  const csrfToken = decodeURIComponent(getCookie("csrf_access_token"));
  logoutForms.forEach((form) => {
    const field = form.querySelector('[data-element="csrf-token"]');
    if (field && csrfToken) {
      field.value = csrfToken;
    }
  });
}

function ensureLoginHiddenForAuthenticated() {
  // No longer needed with full-page login (removed login sheet handling)
  return;
}

syncLogoutCsrf();

// Auto-redirect to login if ?showlogin=1 in URL (MD3 Goldstandard)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("showlogin")) {
  // Build clean next URL (without showlogin param)
  urlParams.delete("showlogin");
  const newSearch = urlParams.toString();
  const nextUrl = window.location.pathname + (newSearch ? "?" + newSearch : "");
  
  // Redirect to full-page login
  window.location.href = `/login?next=${encodeURIComponent(nextUrl)}`;
}

// Mark active navigation link
function markActiveNavLink() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(".nav-link");
  const mobileLinks = document.querySelectorAll(".mobile-link");

  navLinks.forEach((link) => {
    const linkPath = new URL(link.href).pathname;
    if (
      linkPath === currentPath ||
      (linkPath !== "/" && currentPath.startsWith(linkPath))
    ) {
      link.classList.add("nav-link--active");
    }
  });

  mobileLinks.forEach((link) => {
    const linkPath = new URL(link.href).pathname;
    if (
      linkPath === currentPath ||
      (linkPath !== "/" && currentPath.startsWith(linkPath))
    ) {
      link.classList.add("mobile-link--active");
    }
  });
}

// Desktop submenu functionality
let openDesktopSubmenu = null;

function closeAllDesktopSubmenus() {
  document.querySelectorAll(".md3-nav__submenu").forEach((menu) => {
    menu.hidden = true;
    const trigger = menu.previousElementSibling;
    if (trigger && trigger.classList.contains("md3-nav__trigger")) {
      trigger.setAttribute("aria-expanded", "false");
    }
  });
  openDesktopSubmenu = null;
}

function initDesktopSubmenus() {
  // Use event delegation: attach a single click listener to the nav links container.
  // This is more robust (works even if triggers are dynamically replaced or listeners
  // would otherwise be missed on some pages).
  const navLinksContainer = document.querySelector(".md3-nav__links");
  if (!navLinksContainer) return;

  navLinksContainer.addEventListener("click", (event) => {
    const clicked =
      event.target instanceof Element
        ? event.target.closest(".md3-nav__trigger")
        : null;
    if (!clicked) return;
    event.preventDefault();
    event.stopPropagation();

    const submenuId = clicked.getAttribute("aria-controls");
    const submenu = submenuId ? document.getElementById(submenuId) : null;
    if (!submenu) return;

    const isCurrentlyOpen = !submenu.hidden;
    // Close all submenus first
    closeAllDesktopSubmenus();

    // If it wasn't open, open it
    if (!isCurrentlyOpen) {
      submenu.hidden = false;
      clicked.setAttribute("aria-expanded", "true");
      openDesktopSubmenu = submenu;
    }
  });

  // Close desktop submenu when clicking outside
  document.addEventListener("click", (event) => {
    if (!openDesktopSubmenu) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Don't close if clicking inside the submenu or on the trigger wrapper
    if (!target.closest(".md3-nav__link-with-menu")) {
      closeAllDesktopSubmenus();
    }
  });
}

// Initialize desktop submenus - wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", initDesktopSubmenus);

// Mobile collapsible functionality (replaces subpanel logic)
function initMobileCollapsibles() {
  const collapsibleTriggers = document.querySelectorAll(
    ".md3-mobile-collapsible__trigger",
  );

  collapsibleTriggers.forEach((trigger) => {
    const contentId = trigger.getAttribute("aria-controls");
    const content = document.getElementById(contentId);
    if (!content) return;

    // Auto-expand if any child link is active (Best Practice: show current location)
    const hasActiveChild = content.querySelector(".md3-mobile-link--active");
    if (hasActiveChild) {
      trigger.setAttribute("aria-expanded", "true");
      content.removeAttribute("hidden");
      content.classList.add("is-expanded");
    }

    // Toggle on click
    trigger.addEventListener("click", (event) => {
      event.preventDefault();

      const isExpanded = trigger.getAttribute("aria-expanded") === "true";

      if (isExpanded) {
        // Collapse with smooth animation
        trigger.setAttribute("aria-expanded", "false");
        content.classList.remove("is-expanded");
        // Set hidden after animation completes
        setTimeout(() => {
          if (!content.classList.contains("is-expanded")) {
            content.hidden = true;
          }
        }, 400);
      } else {
        // Expand with smooth animation
        trigger.setAttribute("aria-expanded", "true");
        content.removeAttribute("hidden");
        // Trigger reflow for smooth animation
        void content.offsetHeight;
        content.classList.add("is-expanded");
      }
    });
  });
}

// Initialize mobile collapsibles - wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", initMobileCollapsibles);

// Run on page load - wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", markActiveNavLink);

// ============================================
// Drawer Animation Handler (from Index Page)
// ============================================

