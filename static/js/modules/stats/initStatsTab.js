/**
 * Statistics Tab Controller for CO.RA.PAN Corpus
 *
 * Handles fetching, rendering, and state management for the statistics view.
 */

import {
  renderBar,
  updateChartTheme,
  updateChartMode,
  disposeChart,
} from "./renderBar.js";

// State
let charts = {
  country: null,
  speaker: null,
  sexo: null,
  modo: null,
  discourse: null,
};

let currentData = null;
let currentCountryFilter = "";
let isLoading = false;
let originalCountries = []; // Store original country list from first load

/**
 * Build API URL from current form filters
 */
function buildStatsUrl() {
  const form = document.getElementById("corpus-search-form");
  if (!form) return "/api/stats";

  const formData = new FormData(form);
  const params = new URLSearchParams();

  // Query and mode
  const query = formData.get("query") || "";
  const searchMode = formData.get("search_mode") || "text";

  if (query.trim()) {
    params.append("q", query.trim());
  }
  params.append("mode", searchMode);

  // Filters
  const filterMappings = {
    country_code: "pais",
    speaker_type: "speaker",
    sex: "sexo",
    mode: "modo",
    discourse: "discourse",
  };

  for (const [formKey, apiKey] of Object.entries(filterMappings)) {
    const values = formData.getAll(formKey);
    values.forEach((value) => {
      if (value && value !== "" && value.toLowerCase() !== "all") {
        params.append(apiKey, value);
      }
    });
  }

  // Token IDs
  const tokenIds = formData.get("token_ids");
  if (tokenIds) {
    tokenIds.split(",").forEach((id) => {
      const trimmed = id.trim();
      if (trimmed) {
        params.append("token_ids", trimmed);
      }
    });
  }

  // Regional checkbox (WICHTIG: Gleiche Logik wie bei Corpus-Suche)
  const includeRegional = formData.get("include_regional");
  if (includeRegional === "1") {
    params.append("include_regional", "1");
  }

  // Country detail filter (adds additional country constraint)
  if (currentCountryFilter) {
    params.append("country_detail", currentCountryFilter);
  }

  return `/api/stats?${params.toString()}`;
}

/**
 * Show loading state
 */
function showLoading() {
  const container = document.getElementById("stats-grid");
  if (!container) return;

  isLoading = true;
  container.style.opacity = "0.5";
  container.style.pointerEvents = "none";

  // Show skeleton loaders in chart containers
  const chartHosts = container.querySelectorAll(".chart-host");
  chartHosts.forEach((host) => {
    host.innerHTML =
      '<div class="chart-skeleton" style="height: 360px; background: var(--md-sys-color-surface-container-low); border-radius: 8px; animation: pulse 1.5s ease-in-out infinite;"></div>';
  });
}

/**
 * Hide loading state
 */
function hideLoading() {
  const container = document.getElementById("stats-grid");
  if (!container) return;

  isLoading = false;
  container.style.opacity = "1";
  container.style.pointerEvents = "auto";
}

/**
 * Show error message
 */
function showError(message = "No se pudieron cargar las estadísticas.") {
  const container = document.getElementById("stats-grid");
  if (!container) return;

  // MD3: Use Material Symbols
  container.innerHTML = `
    <div class="md3-alert md3-alert--error" style="grid-column: 1 / -1;">
      <span class="material-symbols-rounded">error</span>
      <span>${message}</span>
    </div>
  `;
}

/**
 * Update total count display
 */
function updateTotal(total) {
  const totalEl = document.getElementById("stats-total");
  if (totalEl) {
    const formatted = new Intl.NumberFormat("es-ES").format(total);
    totalEl.innerHTML = `Tokens coincidentes: <strong style="color: var(--md-sys-color-primary);">${formatted}</strong>`;
  }
}

/**
 * Update category count in card subtitle
 */
function updateCategoryCount(dimension, count) {
  const subtitle = document.querySelector(`[data-meta="${dimension}"]`);
  if (subtitle) {
    subtitle.textContent = `${count} categoría${count !== 1 ? "s" : ""}`;
  }
}

/**
 * Render all charts from stats data
 */
function renderCharts(data) {
  if (!data) {
    console.error("renderCharts: no data provided");
    return;
  }

  // Dispose existing charts
  Object.values(charts).forEach((chart) => {
    if (chart) disposeChart(chart);
  });

  // Update total
  updateTotal(data.total || 0);

  // Render country chart (default: absolute mode)
  const countryContainer = document.getElementById("chart-country");
  if (countryContainer) {
    charts.country = renderBar(
      countryContainer,
      data.by_country,
      "País",
      "absolute",
    );
    updateCategoryCount("by_country", data.by_country?.length || 0);
  }

  // Render speaker type chart
  const speakerContainer = document.getElementById("chart-speaker");
  if (speakerContainer) {
    charts.speaker = renderBar(
      speakerContainer,
      data.by_speaker_type,
      "Tipo de hablante",
      "absolute",
    );
    updateCategoryCount("by_speaker_type", data.by_speaker_type?.length || 0);
  }

  // Render sexo chart
  const sexoContainer = document.getElementById("chart-sexo");
  if (sexoContainer) {
    charts.sexo = renderBar(sexoContainer, data.by_sexo, "Sexo", "absolute");
    updateCategoryCount("by_sexo", data.by_sexo?.length || 0);
  }

  // Render modo chart
  const modoContainer = document.getElementById("chart-modo");
  if (modoContainer) {
    charts.modo = renderBar(
      modoContainer,
      data.by_modo,
      "Registro",
      "absolute",
    );
    updateCategoryCount("by_modo", data.by_modo?.length || 0);
  }

  // Render discourse chart
  const discourseContainer = document.getElementById("chart-discourse");
  if (discourseContainer) {
    charts.discourse = renderBar(
      discourseContainer,
      data.by_discourse,
      "Discurso",
      "absolute",
    );
    updateCategoryCount("by_discourse", data.by_discourse?.length || 0);
  }

  // Store original countries on first load (when no filter is active)
  if (!currentCountryFilter && data.by_country && data.by_country.length > 0) {
    originalCountries = data.by_country;
  }

  // Populate country filter dropdown with original countries
  populateCountryFilter(
    originalCountries.length > 0 ? originalCountries : data.by_country || [],
  );

  // Reset all segmented buttons to 'count' mode
  document.querySelectorAll(".md3-segmented-btn").forEach((btn) => {
    const isCount = btn.dataset.mode === "count";
    btn.classList.toggle("is-selected", isCount);
    btn.setAttribute("aria-pressed", isCount ? "true" : "false");
  });
}

/**
 * Fetch and render statistics
 */
export async function loadStats() {
  if (isLoading) return;

  showLoading();

  try {
    const url = buildStatsUrl();
    // console.debug("Fetching stats from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    currentData = data;

    hideLoading();
    renderCharts(data);
  } catch (error) {
    console.error("Failed to load stats:", error);
    hideLoading();
    showError();
  }
}

/**
 * Initialize stats tab
 */
export function initStatsTab() {
  // Check if stats view is active on page load
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const tab = params.get("tab") || params.get("active_tab");

  if ((tab === "simple" || tab === "tab-simple" || !tab) && view === "stats") {
    // Stats view is active - load immediately
    setTimeout(() => loadStats(), 100);
  }

  // Setup view toggle listeners (will be added by corpus page JS)
  document.addEventListener("statsTabActivated", () => {
    if (!currentData) {
      loadStats();
    }
  });

  // Setup form change listeners to invalidate stats
  const form = document.getElementById("corpus-search-form");
  if (form) {
    form.addEventListener("submit", () => {
      // Invalidate stats data when form is submitted
      currentData = null;

      // If stats view is active, reload
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "stats") {
        setTimeout(() => loadStats(), 100);
      }
    });
  }

  // Setup theme change listener
  const themeToggle = document.querySelector("[data-theme-toggle]");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      setTimeout(() => {
        Object.values(charts).forEach((chart) => {
          if (chart) updateChartTheme(chart);
        });
      }, 50);
    });
  }

  // Setup country filter dropdown
  setupCountryFilter();

  // Setup segmented buttons for each chart
  setupSegmentedButtons();

  // console.debug("Stats tab initialized");
}

/**
 * Setup country filter dropdown and its change handler
 */
function setupCountryFilter() {
  const dropdown = document.getElementById("stats-country-filter");
  if (!dropdown) return;

  dropdown.addEventListener("change", (e) => {
    const selectedCountry = e.target.value;
    filterStatsByCountry(selectedCountry);
  });
}

/**
 * Setup segmented buttons for individual chart display mode switching
 */
function setupSegmentedButtons() {
  const segmentedGroups = document.querySelectorAll(".md3-segmented");

  segmentedGroups.forEach((group) => {
    const chartId = group.dataset.chartId;
    const buttons = group.querySelectorAll(".md3-segmented-btn");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Toggle selection
        buttons.forEach((b) => {
          b.classList.toggle("is-selected", b === btn);
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });

        // Get selected mode
        const mode = btn.dataset.mode; // 'count' or 'percent'
        const usePercent = mode === "percent";

        // Update this specific chart with smooth transition
        if (currentData && charts[chartId]) {
          const dataKey = getDataKeyForChart(chartId);
          if (dataKey && currentData[dataKey]) {
            updateChartMode(
              charts[chartId],
              currentData[dataKey],
              usePercent ? "percent" : "absolute",
            );
          }
        }
      });

      // Keyboard navigation: Left/Right arrows
      btn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const currentIndex = Array.from(buttons).indexOf(btn);
          const nextIndex =
            e.key === "ArrowRight"
              ? (currentIndex + 1) % buttons.length
              : (currentIndex - 1 + buttons.length) % buttons.length;
          buttons[nextIndex].click();
          buttons[nextIndex].focus();
        }
      });
    });
  });
}

/**
 * Get data key for chart ID
 */
function getDataKeyForChart(chartId) {
  const mapping = {
    country: "by_country",
    speaker: "by_speaker_type",
    sexo: "by_sexo",
    modo: "by_modo",
    discourse: "by_discourse",
  };
  return mapping[chartId];
}

/**
 * Get title for chart ID
 */
function getTitleForChart(chartId) {
  const mapping = {
    country: "País",
    speaker: "Tipo de hablante",
    sexo: "Sexo",
    modo: "Registro",
    discourse: "Discurso",
  };
  return mapping[chartId];
}

/**
 * Populate country filter dropdown from stats data
 */
function populateCountryFilter(countries) {
  const dropdown = document.getElementById("stats-country-filter");
  if (!dropdown) return;

  // Remember current selection
  const currentSelection = dropdown.value;

  // Clear existing options
  dropdown.innerHTML = '<option value="">Todos los países</option>';

  // Add country options
  countries.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.key;
    option.textContent = `${item.key} (${new Intl.NumberFormat("es-ES").format(item.n)})`;
    dropdown.appendChild(option);
  });

  // Restore selection if still valid
  if (
    currentSelection &&
    [...dropdown.options].some((opt) => opt.value === currentSelection)
  ) {
    dropdown.value = currentSelection;
  }
}

/**
 * Filter stats charts by selected country
 * When a country is selected, re-fetch stats filtered to that country
 */
function filterStatsByCountry(countryCode) {
  currentCountryFilter = countryCode || "";

  // Re-fetch stats with country filter applied
  loadStats();
}

/**
 * Cleanup charts on page unload
 */
export function cleanupStats() {
  Object.values(charts).forEach((chart) => {
    if (chart) disposeChart(chart);
  });
  charts = {
    country: null,
    speaker: null,
    sexo: null,
    modo: null,
    discourse: null,
  };
  currentData = null;
  currentCountryFilter = "";
  originalCountries = [];
}
