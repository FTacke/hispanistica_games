/**
 * Search Filters Manager (copy of corpus filters adapted for advanced search)
 */
import { REGIONAL_OPTIONS, SELECT2_CONFIG } from "./config.js";

export class SearchFiltersManager {
  constructor() {
    this.regionalCheckbox = document.getElementById("include-regional");
    this.countrySelect = document.getElementById("filter-country-national");
    this.filters = {
      speaker: document.getElementById("filter-speaker"),
      sex: document.getElementById("filter-sex"),
      mode: document.getElementById("filter-mode"),
      discourse: document.getElementById("filter-discourse"),
    };
    this.isInitialized = false;
  }
  depsReady() {
    return !!(window.jQuery && window.jQuery.fn && window.jQuery.fn.select2);
  }
  initialize() {
    if (!this.countrySelect) return;
    this.setupTurboHandlers();
    this.enhanceFilters();
    console.log("✅ Search filters initialized");
  }
  setupTurboHandlers() {
    document.addEventListener("turbo:before-render", (e) => {
      const newBody = e.detail.newBody;
      const grid = newBody.querySelector(".md3-corpus-filter-grid");
      if (!grid) return;
      newBody.classList.add("corpus-hydrating");
      grid.querySelectorAll("select[data-enhance]").forEach((select) => {
        select.removeAttribute("data-enhanced");
        select.setAttribute("data-enhance-pending", "");
      });
    });
    document.addEventListener("turbo:load", () => {
      this.isInitialized = false;
      this.updateReferences();
      this.enhanceFilters();
    });
    document.addEventListener("turbo:before-cache", () => {
      this.cleanupForCache();
    });
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) {
        this.updateReferences();
        this.enhanceFilters();
      }
    });
  }
  updateReferences() {
    this.regionalCheckbox = document.getElementById("include-regional");
    this.countrySelect = document.getElementById("filter-country-national");
    this.filters = {
      speaker: document.getElementById("filter-speaker"),
      sex: document.getElementById("filter-sex"),
      mode: document.getElementById("filter-mode"),
      discourse: document.getElementById("filter-discourse"),
    };
  }
  enhanceFilters() {
    const grid = document.querySelector(".md3-corpus-filter-grid");
    if (!grid) return;
    if (!document.documentElement.hasAttribute("data-filters-ready")) {
      document.addEventListener(
        "corpus:filters-ready",
        () => this.enhanceFilters(),
        { once: true },
      );
      const allSelects = [
        this.countrySelect,
        ...Object.values(this.filters),
      ].filter(Boolean);
      const allReady = allSelects.every((s) => s && s.options.length > 1);
      if (allReady)
        document.documentElement.setAttribute("data-filters-ready", "");
      return;
    }
    if (
      typeof window.$ === "undefined" ||
      typeof window.jQuery === "undefined"
    ) {
      console.error("[Filters] jQuery not loaded");
      return;
    }
    if (typeof $.fn.select2 === "undefined") {
      console.error("[Filters] Select2 not loaded");
      return;
    }
    if (this.isInitialized) return;
    const allSelects = [
      this.countrySelect,
      ...Object.values(this.filters),
    ].filter(Boolean);
    allSelects.forEach((select) => {
      if (!select || select.hasAttribute("data-enhanced")) return;
      if ($(select).data("select2")) return;
      const placeholder = select.dataset.placeholder || "Seleccionar";
      try {
        $(select).select2({
          ...SELECT2_CONFIG,
          width: "100%",
          placeholder,
          allowClear: true,
          dropdownAutoWidth: true,
        });
        select.setAttribute("data-enhanced", "");
        select.removeAttribute("data-enhance-pending");
      } catch (e) {
        console.error("Error enhancing select", e);
      }
    });
    this.isInitialized = true;
    document.body.classList.remove("corpus-hydrating");
    this.setupRegionalToggle();
  }
  cleanupForCache() {
    document.body.classList.remove("corpus-hydrating");
    if (
      typeof window.$ === "undefined" ||
      typeof $.fn.select2 === "undefined"
    ) {
      this.isInitialized = false;
      return;
    }
    const allSelects = document.querySelectorAll(
      ".md3-corpus-filter-grid select[data-enhance][data-enhanced]",
    );
    allSelects.forEach((select) => {
      try {
        if ($(select).data("select2")) {
          $(select).select2("destroy");
        }
        select.removeAttribute("data-enhanced");
        select.removeAttribute("data-enhance-pending");
      } catch (error) {
        console.warn("Error destroying Select2:", error);
      }
    });
    this.isInitialized = false;
  }
  setupRegionalToggle() {
    if (!this.regionalCheckbox || !this.countrySelect) return;
    $(this.regionalCheckbox).on("change", () => {
      const isChecked = $(this.regionalCheckbox).is(":checked");
      const currentValues = $(this.countrySelect).val() || [];
      if (isChecked) {
        REGIONAL_OPTIONS.forEach((opt) => {
          if (
            $(this.countrySelect).find(`option[value="${opt.value}"]`)
              .length === 0
          ) {
            const newOption = new Option(opt.text, opt.value, false, false);
            $(this.countrySelect).append(newOption);
          }
        });
      } else {
        REGIONAL_OPTIONS.forEach((opt) => {
          $(this.countrySelect).find(`option[value="${opt.value}"]`).remove();
        });
        const filteredValues = currentValues.filter(
          (val) => !REGIONAL_OPTIONS.some((r) => r.value === val),
        );
        $(this.countrySelect).val(filteredValues);
      }
      $(this.countrySelect).trigger("change");
    });
    if ($(this.regionalCheckbox).is(":checked")) {
      $(this.regionalCheckbox).trigger("change");
    }
  }
  getFilterValues() {
    const values = {};
    if (this.countrySelect) {
      values.countries = $(this.countrySelect).val() || [];
      values.includeRegional = $(this.regionalCheckbox).is(":checked");
    }
    Object.entries(this.filters).forEach(([key, element]) => {
      if (element) values[key] = $(element).val() || [];
    });
    return values;
  }
  reset() {
    Object.values(this.filters).forEach((filter) => {
      if (filter) {
        $(filter).val(null).trigger("change");
      }
    });
    if (this.countrySelect) {
      $(this.countrySelect).val(null).trigger("change");
    }
    if (this.regionalCheckbox) {
      $(this.regionalCheckbox).prop("checked", false).trigger("change");
    }
    console.log("✅ Filters reset");
  }
  destroy() {
    if (
      typeof window.$ === "undefined" ||
      typeof $.fn.select2 === "undefined"
    ) {
      return;
    }
    Object.values(this.filters).forEach((filter) => {
      if (filter && $(filter).data("select2")) {
        $(filter).select2("destroy");
      }
    });
    if (this.countrySelect && $(this.countrySelect).data("select2")) {
      $(this.countrySelect).select2("destroy");
    }
  }
  cleanup() {
    this.destroy();
  }
}
/**
 * Search UI Filters Module
 * Handles MD3 filter fields and active filter chips
 *
 * Features:
 * - Custom filter field UI with dropdown menus
 * - Multi-select with checkboxes
 * - Synchronization with hidden <select multiple> for backend
 * - Active filter chip bar with color coding
 * - Click-to-remove functionality
 */

export class SearchFilters {
  constructor(rootElement = document) {
    this.root = rootElement;
    this.root.searchFilters = this;
    this.filterFields = new Map();
    this.activeFilters = new Map();
    this.init();
  }

  init() {
    // Initialize all filter fields within root
    this.root.querySelectorAll(".md3-filter-field").forEach((field) => {
      this.initFilterField(field);
    });

    // Bind active filter chip removal
    this.bindChipRemoval();

    // Setup Regional Toggle (Scoped)
    this.setupRegionalToggle();
  }

  /**
   * Setup Regional Toggle Logic
   */
  setupRegionalToggle() {
    // Find scoped elements
    // We look for inputs ending with 'include_regional' or 'include_regional-simple/advanced'
    // But since we are scoped to 'root', we can just look for the checkbox with name="include_regional"
    const regionalCheckbox = this.root.querySelector('input[name="include_regional"]');
    // The country select is likely the one with data-facet="pais" -> hidden select or the UI select?
    // The UI logic uses the custom dropdown, so we need to manipulate the custom dropdown options.
    // The custom dropdown is initialized in initFilterField.
    
    if (!regionalCheckbox) return;

    regionalCheckbox.addEventListener('change', () => {
        const isChecked = regionalCheckbox.checked;
        this.toggleRegionalOptions(isChecked);
    });

    // Initial state
    if (regionalCheckbox.checked) {
        this.toggleRegionalOptions(true);
    }
  }

  /**
   * Toggle visibility of regional options in the country dropdown
   */
  toggleRegionalOptions(show) {
    const countryField = this.filterFields.get('pais');
    if (!countryField) return;

    const menuContent = countryField.menu.querySelector('.md3-filter-field__menu-content');
    if (!menuContent) return;

    const regionalOptions = menuContent.querySelectorAll('.md3-filter-option--regional');
    regionalOptions.forEach(opt => {
        if (show) {
            opt.classList.remove('hidden');
        } else {
            opt.classList.add('hidden');
            // Also uncheck if hidden
            const checkbox = opt.querySelector('input[type="checkbox"]');
            if (checkbox && checkbox.checked) {
                checkbox.checked = false;
            }
        }
    });

    // If hiding, we might need to update the field display if a regional option was selected
    if (!show) {
        this.updateFilterField('pais');
    }
  }

  /**
   * Initialize a single filter field
   */
  initFilterField(field) {
    const facet = field.dataset.facet;
    const trigger = field.querySelector(".md3-filter-field__trigger");
    const menu = field.querySelector(".md3-filter-field__menu");
    const valueDisplay = field.querySelector(".md3-filter-field__value");
    const checkboxes = field.querySelectorAll('input[type="checkbox"]');
    const hiddenSelect = field.querySelector("select[multiple][hidden]");

    if (!trigger || !menu || !valueDisplay || !hiddenSelect) {
      console.warn(
        "[SearchFilters] Missing required elements for filter field:",
        facet,
      );
      return;
    }

    // Store references
    this.filterFields.set(facet, {
      field,
      trigger,
      menu,
      valueDisplay,
      checkboxes,
      hiddenSelect,
      placeholder: valueDisplay.dataset.placeholder || "Todos",
    });

    // Toggle menu on trigger click
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleMenu(facet);
    });

    // Handle keyboard navigation
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.toggleMenu(facet);
      }
    });

    // Handle checkbox changes
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.updateFilterField(facet);
      });
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!field.contains(e.target)) {
        this.closeMenu(facet);
      }
    });

    // Initialize from URL parameters
    this.initializeFromURL(facet);
  }

  /**
   * Initialize filter values from URL parameters
   */
  initializeFromURL(facet) {
    const params = new URLSearchParams(window.location.search);
    const filterConfig = this.filterFields.get(facet);
    if (!filterConfig) return;

    const backendParamName = filterConfig.hiddenSelect.name;
    const values = params.getAll(backendParamName);

    if (values.length > 0) {
      filterConfig.checkboxes.forEach((checkbox) => {
        if (values.includes(checkbox.value)) {
          checkbox.checked = true;
        }
      });
      this.updateFilterField(facet);
    }
  }

  /**
   * Toggle menu open/closed
   */
  toggleMenu(facet) {
    const filterConfig = this.filterFields.get(facet);
    if (!filterConfig) return;

    const isExpanded =
      filterConfig.trigger.getAttribute("aria-expanded") === "true";

    // Close all other menus first
    this.filterFields.forEach((config, otherFacet) => {
      if (otherFacet !== facet) {
        this.closeMenu(otherFacet);
      }
    });

    if (isExpanded) {
      this.closeMenu(facet);
    } else {
      this.openMenu(facet);
    }
  }

  /**
   * Open menu
   */
  openMenu(facet) {
    const filterConfig = this.filterFields.get(facet);
    if (!filterConfig) return;

    filterConfig.trigger.setAttribute("aria-expanded", "true");
    filterConfig.menu.removeAttribute("hidden");
  }

  /**
   * Close menu
   */
  closeMenu(facet) {
    const filterConfig = this.filterFields.get(facet);
    if (!filterConfig) return;

    filterConfig.trigger.setAttribute("aria-expanded", "false");
    filterConfig.menu.setAttribute("hidden", "");
  }

  /**
   * Update filter field display and sync with hidden select
   */
  updateFilterField(facet) {
    const filterConfig = this.filterFields.get(facet);
    if (!filterConfig) return;

    const selectedValues = [];
    const selectedLabels = [];

    // Collect selected values and labels
    filterConfig.checkboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        selectedValues.push(checkbox.value);
        selectedLabels.push(checkbox.dataset.label || checkbox.value);
      }
    });

    // Update display
    if (selectedValues.length === 0) {
      filterConfig.valueDisplay.textContent = "";
      filterConfig.valueDisplay.dataset.placeholder = filterConfig.placeholder;
    } else {
      filterConfig.valueDisplay.textContent = selectedLabels.join(", ");
    }

    // Sync with hidden select
    this.syncHiddenSelect(facet, selectedValues);

    // Update active filters
    this.updateActiveFilters(facet, selectedValues, selectedLabels);

    // Update chip bar visibility and content
    this.renderChips();
  }

  /**
   * Sync hidden select element with selected values
   */
  syncHiddenSelect(facet, selectedValues) {
    const filterConfig = this.filterFields.get(facet);
    if (!filterConfig) return;

    const select = filterConfig.hiddenSelect;

    // Clear all selections
    Array.from(select.options).forEach((option) => {
      option.selected = false;
    });

    // Set selected values
    selectedValues.forEach((value) => {
      const option = select.querySelector(`option[value="${value}"]`);
      if (option) {
        option.selected = true;
      }
    });
  }

  /**
   * Update active filters map
   */
  updateActiveFilters(facet, values, labels) {
    if (values.length === 0) {
      this.activeFilters.delete(facet);
    } else {
      this.activeFilters.set(facet, {
        values,
        labels,
        facet,
      });
    }
  }

  /**
   * Render active filter chips
   */
  renderChips() {
    // Find containers within root or fallback to document (for backward compatibility if root is document)
    const chipsContainer = this.root.querySelector(".md3-active-filters__chips") || document.getElementById("active-filters-chips");
    const filterBar = this.root.querySelector(".md3-active-filters") || document.getElementById("active-filters-bar");

    if (!chipsContainer || !filterBar) return;

    // Clear existing chips
    chipsContainer.innerHTML = "";

    // Check if there are any active filters
    if (this.activeFilters.size === 0) {
      filterBar.setAttribute("hidden", "");
      return;
    }

    // Show filter bar
    filterBar.removeAttribute("hidden");

    // Create chips for each filter
    this.activeFilters.forEach((filter, facet) => {
      filter.values.forEach((value, index) => {
        const chip = this.createChip(facet, value, filter.labels[index]);
        chipsContainer.appendChild(chip);
      });
    });
  }

  /**
   * Create a filter chip element
   */
  createChip(facet, value, label) {
    const chip = document.createElement("div");
    chip.className = `md3-filter-chip md3-filter-chip--${facet}`;
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.dataset.facet = facet;
    chip.dataset.value = value;

    // Chip text - for countries, show only code (value); for others, show facet + label
    let chipText = "";
    if (facet === "pais") {
      chipText = value; // Use code directly (ARG, MEX, etc.)
    } else {
      const facetLabels = {
        hablante: "Hablante",
        sexo: "Sexo",
        modo: "Modo",
        discurso: "Discurso",
      };
      chipText = `${facetLabels[facet] || facet}: ${label}`;
    }

    chip.innerHTML = `
      <span>${chipText}</span>
      <span class="material-symbols-rounded md3-filter-chip__close">close</span>
    `;

    // Click to remove
    chip.addEventListener("click", () => {
      this.removeFilter(facet, value);
    });

    // Keyboard support
    chip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.removeFilter(facet, value);
      }
    });

    return chip;
  }

  /**
   * Remove a specific filter value
   */
  removeFilter(facet, value) {
    const filterConfig = this.filterFields.get(facet);
    if (!filterConfig) return;

    // Uncheck the corresponding checkbox
    filterConfig.checkboxes.forEach((checkbox) => {
      if (checkbox.value === value) {
        checkbox.checked = false;
      }
    });

    // Update the filter field
    this.updateFilterField(facet);
  }

  /**
   * Bind chip removal events
   */
  bindChipRemoval() {
    // Event delegation is handled in createChip
    // This method is kept for future enhancements
  }

  /**
   * Clear all filters
   */
  clearAllFilters() {
    this.filterFields.forEach((config, facet) => {
      config.checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
      this.updateFilterField(facet);
    });
  }

  /**
   * Get all active filter values for form submission
   */
  getActiveFilterParams() {
    const params = new URLSearchParams();

    this.filterFields.forEach((config, facet) => {
      const selectedValues = Array.from(config.checkboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);

      const paramName = config.hiddenSelect.name;
      selectedValues.forEach((value) => {
        params.append(paramName, value);
      });
    });

    return params;
  }

  /**
   * Restore filters from URL parameters
   * @param {URLSearchParams} params
   */
  restoreFiltersFromParams(params) {
    this.filterFields.forEach((config, facet) => {
      const paramName = config.hiddenSelect.name;
      const values = params.getAll(paramName);

      if (values.length > 0) {
        // Uncheck all first
        config.checkboxes.forEach((cb) => (cb.checked = false));

        // Check matching values
        values.forEach((val) => {
          const checkbox = Array.from(config.checkboxes).find(
            (cb) => cb.value === val,
          );
          if (checkbox) {
            checkbox.checked = true;
          }
        });

        // Update UI
        this.updateFilterField(facet);
      }
    });
  }
}

// Auto-initialize on page load
// let searchFiltersInstance = null;

// document.addEventListener("DOMContentLoaded", () => {
//   searchFiltersInstance = new SearchFilters();
// });

// Export singleton instance
// export function getSearchFilters() {
//   return searchFiltersInstance;
// }
