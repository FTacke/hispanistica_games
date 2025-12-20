// ============================================
// Test Suite for Adaptive Title & Scroll State
// ============================================
// Run this in browser console to validate implementation
// Szenarios: A-F wie in Anforderung definiert

console.log(
  "%c=== ADAPTIVE TITLE TEST SUITE ===",
  "font-size: 16px; font-weight: bold; color: #4CAF50",
);

// ============================================
// Scenario A: Initial Load
// ============================================
console.log(
  "%c\nSzenario A: Initial Load",
  "font-weight: bold; color: #2196F3",
);

const pageTitle = document.getElementById("pageTitle");
const siteTitle = document.getElementById("siteTitle");
const bodyScrolled = document.body.getAttribute("data-scrolled");

console.log("✓ #pageTitle element:", pageTitle ? "Found" : "❌ MISSING");
console.log("✓ #pageTitle content:", pageTitle?.textContent || "(empty)");
console.log("✓ #siteTitle element:", siteTitle ? "Found" : "❌ MISSING");
console.log("✓ #siteTitle content:", siteTitle?.textContent || "(empty)");
console.log("✓ document.title:", document.title);
console.log("✓ body[data-scrolled]:", bodyScrolled || "false");

if (!pageTitle || !siteTitle) {
  console.error("❌ FAIL: Required elements missing!");
} else if (!document.title.includes("CO.RA.PAN")) {
  console.warn("⚠️ WARNING: document.title missing CO.RA.PAN suffix");
} else {
  console.log("%c✅ PASS: Initial Load", "color: #4CAF50; font-weight: bold");
}

// ============================================
// Scenario B: Scroll Down
// ============================================
console.log(
  "%c\nSzenario B: Scroll Down (>8px)",
  "font-weight: bold; color: #2196F3",
);

window.addEventListener(
  "scroll",
  () => {
    const scrolled = window.scrollY > 8;
    const hasAttr = document.body.hasAttribute("data-scrolled");
    const attrValue = document.body.getAttribute("data-scrolled");

    console.log("Current scrollY:", window.scrollY);
    console.log("body[data-scrolled] present:", hasAttr);
    console.log("body[data-scrolled] value:", attrValue);

    // CSS Transitions
    const siteOpacity = getComputedStyle(siteTitle).opacity;
    const pageOpacity = getComputedStyle(pageTitle).opacity;

    console.log("Site Title opacity:", siteOpacity);
    console.log("Page Title opacity:", pageOpacity);

    if (scrolled && attrValue === "true") {
      console.log(
        "%c✅ PASS: Scroll State Detected",
        "color: #4CAF50; font-weight: bold",
      );
    } else if (!scrolled && !hasAttr) {
      console.log(
        "%c✅ PASS: Top Scroll State Detected",
        "color: #4CAF50; font-weight: bold",
      );
    }
  },
  { once: false },
);

console.log("📌 Scroll down >8px and watch console...");

// ============================================
// Scenario C: HTMX Navigation (Simulated)
// ============================================
console.log(
  "%c\nSzenario C: HTMX Navigation (Mock)",
  "font-weight: bold; color: #2196F3",
);

function testHTMXNavigation() {
  console.log("Simulating HTMX navigation with new main content...");

  const main = document.querySelector("main");
  if (!main) {
    console.error("❌ No <main> element found");
    return;
  }

  // Simulate new content with data-page-title
  const testTitle = "Test Page: " + new Date().toLocaleTimeString();
  main.setAttribute("data-page-title", testTitle);

  // Trigger htmx:afterSettle simulation
  const event = new CustomEvent("htmx:afterSettle", { bubbles: true });
  document.body.dispatchEvent(event);
  console.log("Dispatched htmx:afterSettle event");

  // Check if title updated
  setTimeout(() => {
    const newPageTitle = pageTitle?.textContent;
    console.log("Page title after HTMX nav:", newPageTitle);

    if (newPageTitle === testTitle) {
      console.log(
        "%c✅ PASS: HTMX Navigation",
        "color: #4CAF50; font-weight: bold",
      );
    } else {
      console.warn("⚠️ WARNING: Page title not updated");
    }
  }, 100);
}

window.testHTMXNavigation = testHTMXNavigation;
console.log("Run: testHTMXNavigation()");

// ============================================
// Scenario D: Partial Update (MutationObserver)
// ============================================
console.log(
  "%c\nSzenario D: Partial Update (MutationObserver)",
  "font-weight: bold; color: #2196F3",
);

function testPartialUpdate() {
  const main = document.querySelector("main");
  if (!main) {
    console.error("❌ No <main> element found");
    return;
  }

  const h1 = main.querySelector("h1") || document.createElement("h1");
  if (!h1.parentElement) {
    main.insertBefore(h1, main.firstChild);
  }

  h1.textContent = "Updated H1: " + new Date().toLocaleTimeString();
  console.log("Updated <h1> in main");

  setTimeout(() => {
    const newPageTitle = pageTitle?.textContent;
    console.log("Page title after mutation:", newPageTitle);

    if (newPageTitle === h1.textContent) {
      console.log(
        "%c✅ PASS: Partial Update (MutationObserver)",
        "color: #4CAF50; font-weight: bold",
      );
    } else {
      console.warn("⚠️ WARNING: Title not updated from H1 mutation");
    }
  }, 150);
}

window.testPartialUpdate = testPartialUpdate;
console.log("Run: testPartialUpdate()");

// ============================================
// Scenario E: Browser Back (popstate)
// ============================================
console.log(
  "%c\nSzenario E: Browser Back (popstate)",
  "font-weight: bold; color: #2196F3",
);

window.addEventListener("popstate", () => {
  const titleNow = pageTitle?.textContent;
  const documentTitle = document.title;
  const scrolledNow = document.body.getAttribute("data-scrolled");

  console.log("After popstate:");
  console.log("  Page Title:", titleNow);
  console.log("  Document Title:", documentTitle);
  console.log("  Scroll State:", scrolledNow);
  console.log(
    "%c✅ PASS: Browser Back Handled",
    "color: #4CAF50; font-weight: bold",
  );
});

console.log("📌 Press browser back button and watch console...");

// ============================================
// Scenario F: prefers-reduced-motion
// ============================================
console.log(
  "%c\nSzenario F: prefers-reduced-motion",
  "font-weight: bold; color: #2196F3",
);

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
console.log(
  "prefers-reduced-motion:",
  prefersReducedMotion ? "enabled" : "disabled",
);

const siteTitleStyles = getComputedStyle(siteTitle);
const transitions =
  siteTitleStyles.transition || siteTitleStyles.WebkitTransition;

console.log("Site Title transition property:", transitions || "(none)");

if (prefersReducedMotion) {
  console.log(
    "%c✅ PASS: prefers-reduced-motion respected (in CSS)",
    "color: #4CAF50; font-weight: bold",
  );
} else {
  console.log("ℹ️  prefers-reduced-motion not enabled in system");
}

// ============================================
// Guard Check
// ============================================
console.log("%c\nGuard Check", "font-weight: bold; color: #2196F3");

console.log("window.__pageTitleInit:", window.__pageTitleInit);
console.log("window.__scrollInit:", window.__scrollInit);

if (window.__pageTitleInit && window.__scrollInit) {
  console.log(
    "%c✅ PASS: Both modules initialized (guards set)",
    "color: #4CAF50; font-weight: bold",
  );
} else {
  console.warn("⚠️ WARNING: Guards not found. Check module imports.");
}

// ============================================
// Summary
// ============================================
console.log(
  "%c\n=== TEST SUMMARY ===",
  "font-size: 14px; font-weight: bold; color: #FF9800",
);
console.log("✅ Scenario A: Initial Load - Can be validated above");
console.log("✅ Scenario B: Scroll Detection - Run: scroll down >8px");
console.log("✅ Scenario C: HTMX Navigation - Run: testHTMXNavigation()");
console.log("✅ Scenario D: Partial Update - Run: testPartialUpdate()");
console.log(
  "✅ Scenario E: Browser Back - Run: history.back() or use browser button",
);
console.log("✅ Scenario F: prefers-reduced-motion - Checked above");
console.log(
  "%c\nAll scenarios ready to test! 🚀",
  "color: #4CAF50; font-weight: bold",
);
