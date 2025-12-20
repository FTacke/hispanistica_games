// ============================================
// Material Symbols Font Loader
// ============================================
// Detects if Material Symbols font loads successfully
// Falls back to hiding icons if font fails to load

/**
 * Check if Material Symbols font is loaded
 * @returns {Promise<boolean>}
 */
async function checkMaterialSymbolsLoaded() {
  if (!document.fonts) {
    // Font Loading API not supported
    console.warn("[Material Symbols] Font Loading API not supported");
    return false;
  }

  try {
    // Check if font is loaded from local file
    const font = new FontFace(
      "Material Symbols Rounded",
      "url(/static/fonts/MaterialSymbolsRounded.woff2) format(woff2) tech(variations)",
    );

    await font.load();
    document.fonts.add(font);

    console.log("[Material Symbols] Font loaded successfully");
    return true;
  } catch (error) {
    console.warn("[Material Symbols] Font failed to load:", error);
    return false;
  }
}

/**
 * Check if Material Symbols are rendering correctly
 * Tests if icon ligatures work by checking computed width
 */
function testMaterialSymbolsRendering() {
  // Create temporary test element
  const test = document.createElement("span");
  test.className = "material-symbols-rounded";
  test.textContent = "home";
  test.style.cssText =
    "position: absolute; visibility: hidden; pointer-events: none;";
  document.body.appendChild(test);

  // Wait for layout
  setTimeout(() => {
    const computedStyle = window.getComputedStyle(test);
    const fontFamily = computedStyle.fontFamily;
    const width = test.offsetWidth;

    document.body.removeChild(test);

    // If font is loaded, it should have a specific width (not default text width)
    // and font-family should include 'Material Symbols Rounded'
    const isLoaded =
      fontFamily.includes("Material Symbols Rounded") &&
      width > 0 &&
      width < 30;

    console.log("[Material Symbols] Rendering test:", {
      fontFamily,
      width,
      isLoaded,
    });

    return isLoaded;
  }, 100);
}

/**
 * Initialize Material Symbols fallback handler
 */
export function initMaterialSymbolsFallback() {
  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndApplyFallback);
  } else {
    checkAndApplyFallback();
  }
}

/**
 * Check font loading and apply fallback if needed
 */
async function checkAndApplyFallback() {
  // Give font 2 seconds to load
  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve(false), 2000),
  );
  const fontCheck = checkMaterialSymbolsLoaded();

  const isLoaded = await Promise.race([fontCheck, timeout]);

  if (!isLoaded) {
    console.warn(
      "[Material Symbols] Font did not load, applying fallback (hiding icons)",
    );
    document.body.classList.add("material-symbols-not-loaded");

    // Remove icon containers from navigation
    hideFailedIcons();
  } else {
    console.log("[Material Symbols] Font loaded successfully");
  }
}

/**
 * Hide icon elements that failed to load
 */
function hideFailedIcons() {
  const icons = document.querySelectorAll(".material-symbols-rounded");

  icons.forEach((icon) => {
    const parent = icon.closest(
      ".md3-navigation-drawer__item, .md3-icon-button",
    );

    // Check if icon is actually rendering (has specific width)
    if (icon.offsetWidth === 0 || icon.offsetWidth > 30) {
      // Icon not rendering properly, hide it
      icon.style.display = "none";

      // Adjust parent spacing
      if (parent) {
        parent.classList.add("no-icon");
      }
    }
  });
}

// Auto-initialize
if (typeof window !== "undefined") {
  initMaterialSymbolsFallback();
}
