// ============================================
// MD3 Navigation Module
// ============================================
// Main entry point for MD3 navigation system

import {
  applyWindowSizeClass,
  getWindowSize,
  WindowSize,
} from "./window-size.js";
import { initNavigationDrawer } from "./drawer.js";
import { initTopAppBar } from "./app-bar.js";
import { initMaterialSymbolsFallback } from "./material-symbols-loader.js";
import { initTurboIntegration } from "./turbo-integration.js";

// Import viewport detection
import "./viewport.js";

// Import and initialize scroll state and page title
import { initScrollState } from "./scroll-state.js";
import { initPageTitle } from "./page-title.js";

/**
 * Initialize MD3 Navigation System
 */
export function initMD3Navigation() {
  // Check Material Symbols font loading
  initMaterialSymbolsFallback();

  // Apply window size classes to body for CSS targeting
  const cleanup = applyWindowSizeClass(document.body, "app");

  // Initialize drawer (nur einmal, bleibt persistent)
  const drawer = initNavigationDrawer();

  // Initialize top app bar
  const appBar = initTopAppBar();

  // Initialize Turbo integration for persistent navigation
  initTurboIntegration();

  // Initialize adaptive title and scroll state (framework-agnostisch)
  initPageTitle();
  initScrollState();

  // Log current window size (dev only)
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    console.log(
      "[MD3 Navigation] Initialized with window size:",
      getWindowSize(),
    );
  }

  return {
    drawer,
    appBar,
    cleanup,
    getWindowSize,
  };
}

/**
 * Auto-initialize on DOM ready
 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMD3Navigation);
} else {
  initMD3Navigation();
}
