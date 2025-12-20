// ============================================
// Window Size Class Detection (MD3)
// ============================================

/**
 * Material Design 3 Window Size Classes
 * Based on viewport width breakpoints
 */
export const WindowSize = {
  COMPACT: "compact", // <600px (Mobile)
  MEDIUM: "medium", // 600-839px (Tablet)
  EXPANDED: "expanded", // ≥840px (Desktop)
};

/**
 * Get current window size class based on viewport width
 * @returns {string} WindowSize constant
 */
export function getWindowSize() {
  const width = window.innerWidth;

  if (width < 600) {
    return WindowSize.COMPACT;
  }

  if (width < 840) {
    return WindowSize.MEDIUM;
  }

  return WindowSize.EXPANDED;
}

/**
 * Check if current window size matches given size(s)
 * @param {string|string[]} size - WindowSize constant or array of constants
 * @returns {boolean}
 */
export function isWindowSize(size) {
  const current = getWindowSize();

  if (Array.isArray(size)) {
    return size.includes(current);
  }

  return current === size;
}

/**
 * Add window size class listener
 * @param {Function} callback - Called when window size class changes
 * @returns {Function} Cleanup function to remove listener
 */
export function onWindowSizeChange(callback) {
  let currentSize = getWindowSize();

  function handleResize() {
    const newSize = getWindowSize();

    if (newSize !== currentSize) {
      const previousSize = currentSize;
      currentSize = newSize;
      callback(newSize, previousSize);
    }
  }

  // Use debouncing to avoid excessive calls
  let resizeTimeout;
  function debouncedResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 150);
  }

  window.addEventListener("resize", debouncedResize);

  // Return cleanup function
  return () => {
    clearTimeout(resizeTimeout);
    window.removeEventListener("resize", debouncedResize);
  };
}

/**
 * Apply size-specific class to element
 * Updates automatically on resize
 * @param {HTMLElement} element - Target element
 * @param {string} baseClass - Base class name (e.g., 'app-shell')
 */
export function applyWindowSizeClass(element, baseClass = "window") {
  function updateClass(size) {
    // Remove all size classes
    element.classList.remove(
      `${baseClass}--compact`,
      `${baseClass}--medium`,
      `${baseClass}--expanded`,
    );

    // Add current size class
    element.classList.add(`${baseClass}--${size}`);

    // Set data attribute for CSS targeting
    element.dataset.windowSize = size;
  }

  // Initial application
  updateClass(getWindowSize());

  // Listen for changes
  return onWindowSizeChange(updateClass);
}
