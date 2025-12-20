/**
 * Navigation Drawer Accordion Handler
 *
 * Enhances <details> elements with:
 * 1. User-toggle tracking (marks clicks vs automatic state changes)
 * 2. Smooth opening/closing with transitions
 * 3. Prevents animation on page load, enables on user interaction
 */

export function initAccordion() {
  // Find all details elements in the drawer
  const allDetails = document.querySelectorAll("#navigation-drawer details");

  // Setup transition control for each details element
  allDetails.forEach((details) => {
    const summary = details.querySelector("summary");
    if (!summary) return;

    // Mark clicks from user
    summary.addEventListener("click", (e) => {
      // Wait for details.open to update before marking
      requestAnimationFrame(() => {
        details.setAttribute("data-user-toggle", "1");
      });
    });

    // Also enable animations after first user interaction anywhere
    document.addEventListener(
      "pointerdown",
      () => {
        details.setAttribute("data-user-toggle", "1");
      },
      { once: true },
    );
  });

  console.log("[accordion] Initialized", allDetails.length, "details elements");
}
