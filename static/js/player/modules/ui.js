/**
 * UI Module
 * Handles tooltips, scroll-to-top, and other UI interactions
 * @module player/modules/ui
 */

import { PLAYER_CONFIG } from "../config.js";

export class UIManager {
  constructor() {
    this.scrollToTopBtn = null;
  }

  /**
   * Initialize UI manager
   */
  init() {
    this._setupScrollToTop();
    this._setupWindowTooltips();
  }

  /**
   * Setup scroll-to-top button
   * @private
   */
  _setupScrollToTop() {
    this.scrollToTopBtn = document.getElementById("scrollToTopBtn");

    if (!this.scrollToTopBtn) return;

    // Show/hide on scroll
    let scrollTimeout;
    window.addEventListener("scroll", () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (window.scrollY > 200) {
          this.scrollToTopBtn.classList.add("visible");
        } else {
          this.scrollToTopBtn.classList.remove("visible");
        }
      }, PLAYER_CONFIG.SCROLL_DEBOUNCE);
    });

    // Click handler
    this.scrollToTopBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }

  /**
   * Setup window-level tooltip functions
   * @private
   */
  _setupWindowTooltips() {
    // Expose tooltip functions to window for HTML onmouseover/onmouseout
    window.showTooltip = (event) => {
      // Neue MD3-Struktur: .sidebar-help-wrapper
      const tooltipContainer = event.target.closest(".sidebar-help-wrapper");
      if (!tooltipContainer) return;

      const tooltip = tooltipContainer.querySelector(".tooltip-text");
      if (tooltip) {
        tooltip.classList.add("visible");
      }
    };

    window.hideTooltip = (event) => {
      // Neue MD3-Struktur: .sidebar-help-wrapper
      const tooltipContainer = event.target.closest(".sidebar-help-wrapper");
      if (!tooltipContainer) return;

      const tooltip = tooltipContainer.querySelector(".tooltip-text");
      if (tooltip) {
        tooltip.classList.remove("visible");
      }
    };
  }

  /**
   * Show copy feedback
   * @param {string} message - Message to display
   */
  showCopyFeedback(message = "Copied!") {
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip-text-pop visible";
    tooltip.textContent = message;
    tooltip.style.position = "fixed";
    tooltip.style.top = "50%";
    tooltip.style.left = "50%";
    tooltip.style.transform = "translate(-50%, -50%)";
    tooltip.style.zIndex = "10000";

    document.body.appendChild(tooltip);

    setTimeout(() => {
      tooltip.remove();
    }, PLAYER_CONFIG.COPY_FEEDBACK_DURATION);
  }

  /**
   * Load and display footer statistics
   */
  async loadFooterStats() {
    // Check if footer elements exist (not on player page)
    const totalDurationElement = document.getElementById("totalDuration");
    const totalWordCountElement = document.getElementById("totalWordCount");
    const totalCountriesElement = document.getElementById("totalCountries");

    if (
      !totalDurationElement ||
      !totalWordCountElement ||
      !totalCountriesElement
    ) {
      console.log("[Footer Stats] Skipped - No footer elements on this page");
      return;
    }

    try {
      const response = await fetch("/api/corpus_stats");
      const stats = await response.json();

      this._updateTotalStats(stats);
    } catch (error) {
      console.error("[Footer Stats] Error fetching:", error);
    }
  }

  /**
   * Update total statistics display
   * @private
   */
  _updateTotalStats(stats) {
    const totalDurationElement = document.getElementById("totalDuration");
    const totalWordCountElement = document.getElementById("totalWordCount");
    const totalCountriesElement = document.getElementById("totalCountries");

    if (totalDurationElement) {
      totalDurationElement.innerHTML = this._formatDuration(
        stats.total_duration,
      );
    }

    if (totalWordCountElement) {
      totalWordCountElement.innerHTML = this._formatNumber(
        stats.total_word_count,
      );
    }

    if (totalCountriesElement) {
      totalCountriesElement.innerHTML = stats.total_countries;
    }
  }

  /**
   * Format duration to hours and minutes
   * @private
   */
  _formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  }

  /**
   * Format number with thousand separators
   * @private
   */
  _formatNumber(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
}

export default UIManager;
