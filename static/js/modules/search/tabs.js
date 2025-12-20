/**
 * Tab Navigation Logic
 */
export function initTabs() {
  const tabs = document.querySelectorAll(".md3-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      const tabName = this.getAttribute("data-tab");

      // Deactivate all tabs
      document.querySelectorAll(".md3-tab").forEach((t) => {
        t.classList.remove("md3-tab--active");
        t.setAttribute("aria-selected", "false");
      });

      // Hide all content
      document.querySelectorAll(".md3-tab-content").forEach((c) => {
        c.classList.remove("md3-tab-content--active");
      });

      // Add active class to clicked button and corresponding content
      this.classList.add("md3-tab--active");
      this.setAttribute("aria-selected", "true");
      const targetContent = document.getElementById("tab-" + tabName);
      if (targetContent) {
        targetContent.classList.add("md3-tab-content--active");
      }

      // Dispatch event for other modules to react
      document.dispatchEvent(new CustomEvent('tab:change', { detail: { tab: tabName } }));

      // Add explicit marker on body to indicate token-tab active for stronger CSS overrides
      if (tabName === 'token') {
        document.body.classList.add('token-active');
      } else {
        document.body.classList.remove('token-active');
      }
    });
  });
}
