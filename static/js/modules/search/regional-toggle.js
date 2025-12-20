/**
 * Regional Checkbox Toggle Logic
 */
export function initRegionalToggle() {
  const includeRegionalCheckbox = document.getElementById("include-regional");
  const regionalOptions = document.querySelectorAll(
    ".md3-filter-option--regional",
  );

  function toggleRegionalOptions() {
    const isChecked = includeRegionalCheckbox?.checked || false;
    regionalOptions.forEach((option) => {
      if (isChecked) {
        option.classList.remove("hidden");
      } else {
        option.classList.add("hidden");
      }
      // Uncheck regional options when hiding them
      if (!isChecked) {
        const checkbox = option.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = false;
        }
      }
    });
  }

  // Initial state
  if (includeRegionalCheckbox) {
    toggleRegionalOptions();
    includeRegionalCheckbox.addEventListener("change", toggleRegionalOptions);
  }

  // Re-bind after HTMX swaps
  // Note: We add this listener only once to avoid duplicates if init is called multiple times
  if (!window._regionalToggleListenerAdded) {
    document.addEventListener("htmx:afterSwap", function () {
      const checkbox = document.getElementById("include-regional");
      const regionals = document.querySelectorAll(
        ".md3-filter-option--regional",
      );
      if (checkbox && regionals.length > 0) {
        toggleRegionalOptions();
        checkbox.removeEventListener("change", toggleRegionalOptions);
        checkbox.addEventListener("change", toggleRegionalOptions);
      }
    });
    window._regionalToggleListenerAdded = true;
  }
}
