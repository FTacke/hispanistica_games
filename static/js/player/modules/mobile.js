/**
 * Mobile Optimization Module
 * Handles responsive behavior and mobile-specific UI adjustments
 * @module player/modules/mobile
 */

import { PLAYER_CONFIG } from "../config.js";

export class MobileHandler {
  constructor() {
    this.isMobile = false;
    this.isTablet = false;
    this.currentBreakpoint = null;
  }

  /**
   * Initialize mobile handler
   */
  init() {
    this._detectViewport();
    this._setupResizeListener();
    this._applyMobileOptimizations();
  }

  /**
   * Detect current viewport size and set flags
   * @private
   */
  _detectViewport() {
    const width = window.innerWidth;

    this.isMobile = width <= PLAYER_CONFIG.MOBILE_MAX;
    this.isTablet =
      width > PLAYER_CONFIG.MOBILE_MAX && width <= PLAYER_CONFIG.TABLET_MAX;

    if (width <= PLAYER_CONFIG.MOBILE_SMALL) {
      this.currentBreakpoint = "mobile-small";
    } else if (width <= PLAYER_CONFIG.MOBILE_MAX) {
      this.currentBreakpoint = "mobile";
    } else if (width <= PLAYER_CONFIG.TABLET_MAX) {
      this.currentBreakpoint = "tablet";
    } else {
      this.currentBreakpoint = "desktop";
    }

    console.log(
      "[Mobile] Viewport:",
      width,
      "Breakpoint:",
      this.currentBreakpoint,
    );
  }

  /**
   * Setup resize event listener with debounce
   * OPTIMIZED: Shorter debounce, only class toggles (no DOM manipulation)
   * @private
   */
  _setupResizeListener() {
    let resizeTimeout;

    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const oldBreakpoint = this.currentBreakpoint;
        this._detectViewport();

        // Only re-apply if breakpoint actually changed
        if (oldBreakpoint !== this.currentBreakpoint) {
          console.log(
            "[Mobile] Breakpoint changed:",
            oldBreakpoint,
            "→",
            this.currentBreakpoint,
          );
          this._applyMobileOptimizations();
        }
      }, 100); // FAST: 100ms statt SCROLL_DEBOUNCE (250ms)
    });
  }

  /**
   * Apply mobile-specific optimizations
   * @private
   */
  _applyMobileOptimizations() {
    if (this.isMobile) {
      this._enableMobileLayout();
      this._optimizeSpeakerNames();
      this._optimizeTranscription();
      this._simplifyPlayer();
    } else {
      this._enableDesktopLayout();
    }
  }

  /**
   * Enable mobile layout
   * @private
   */
  _enableMobileLayout() {
    document.body.classList.add("mobile-layout");
    document.body.classList.remove("desktop-layout");

    // Hide sidebars on mobile
    const sidebars = document.querySelectorAll(".sidebar");
    sidebars.forEach((sidebar) => {
      sidebar.classList.add("mobile-hidden");
    });

    console.log("[Mobile] Mobile layout enabled");
  }

  /**
   * Enable desktop layout
   * @private
   */
  _enableDesktopLayout() {
    document.body.classList.remove("mobile-layout");
    document.body.classList.add("desktop-layout");

    // Show sidebars on desktop
    const sidebars = document.querySelectorAll(".sidebar");
    sidebars.forEach((sidebar) => {
      sidebar.classList.remove("mobile-hidden");
    });

    console.log("[Mobile] Desktop layout enabled");
  }

  /**
   * Optimize speaker names for mobile
   * NOTE: All styling now handled by CSS (player-mobile.css)
   * No DOM manipulation needed - CSS does it all!
   * @private
   */
  _optimizeSpeakerNames() {
    // CSS handles all speaker name styling via .mobile-layout class
    // No JavaScript manipulation needed for performance
    console.log("[Mobile] Speaker names: CSS-only (no DOM manipulation)");
  }

  /**
   * Optimize transcription display for mobile
   * NOTE: All styling now handled by CSS (player-mobile.css)
   * @private
   */
  _optimizeTranscription() {
    // CSS handles all transcription styling via .mobile-layout class
    // No JavaScript manipulation needed for performance
    console.log("[Mobile] Transcription: CSS-only (no DOM manipulation)");
  }

  /**
   * Simplify player controls for mobile
   * NOTE: All styling now handled by CSS (player-mobile.css)
   * @private
   */
  _simplifyPlayer() {
    const player = document.querySelector(".custom-audio-player");

    if (player) {
      player.classList.add("mobile-player"); // Only class toggle, no styling
    }

    // CSS handles all player styling via .mobile-layout class
    console.log("[Mobile] Player: CSS-only (no DOM manipulation)");
  }

  /**
   * Check if currently in mobile view
   * @returns {boolean}
   */
  isMobileView() {
    return this.isMobile;
  }

  /**
   * Check if currently in tablet view
   * @returns {boolean}
   */
  isTabletView() {
    return this.isTablet;
  }

  /**
   * Get current breakpoint
   * @returns {string}
   */
  getCurrentBreakpoint() {
    return this.currentBreakpoint;
  }
}

export default MobileHandler;
