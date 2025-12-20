/**
 * Statistics Tab Initialization for Advanced Search (BlackLab)
 *
 * Adapted from initStatsTab.js to work with:
 * - advanced-search-form instead of corpus-search-form
 * - /search/advanced/stats endpoint instead of /api/stats
 * - Tab-based view switching (Resultados/Estadísticas)
 */

import {
  renderBar,
  updateChartMode,
  disposeChart,
  updateChartTheme,
} from "./renderBar.js";
import { escapeHtml } from "../advanced/datatableFactory.js";

// State management
let isLoading = false;
let currentData = null;
let currentCountryFilter = "";
let originalCountries = [];

// Chart instances (one per dimension)
let charts = {
  country: null,
  speaker: null,
  sexo: null,
  modo: null,
  discourse: null,
  radio: null,
};

/**
 * Show loading state
 */
function showLoading() {
  isLoading = true;
  const container = document.getElementById("stats-grid");
  if (container) {
    container.style.opacity = "0.5";
    container.style.pointerEvents = "none";
  }
  const btn = document.getElementById("btn-download-stats-csv");
  if (btn) btn.disabled = true;
}

/**
 * Hide loading state
 */
function hideLoading() {
  isLoading = false;
  const container = document.getElementById("stats-grid");
  if (container) {
    container.style.opacity = "1";
    container.style.pointerEvents = "auto";
  }
  const btn = document.getElementById("btn-download-stats-csv");
  if (btn) btn.disabled = false;
}

/**
 * Show error message
 */
function showError() {
  const container = document.getElementById("stats-grid");
  if (container) {
    container.innerHTML = `
      <div class="md3-placeholder-panel" style="grid-column: 1 / -1;">
        <span class="material-symbols-rounded md3-placeholder-panel__icon">error</span>
        <h3 class="md3-placeholder-panel__title">Error al cargar estadísticas</h3>
        <p class="md3-placeholder-panel__text">
          No se pudieron cargar las estadísticas. Por favor, intenta de nuevo.
        </p>
      </div>
    `;
  }
}

/**
 * Update total count display
 */
function updateTotal(total) {
  const summaryBox = document.getElementById("stats-summary");
  if (!summaryBox) return;

  const params = new URLSearchParams(window.location.search);
  const query = params.get("q") || params.get("cql_raw") || "—";
  const mode = params.get("mode");
  
  let modeLabel = "Consulta simple";
  let queryLabel = "Consulta";
  
  if (mode === "cql" || mode === "advanced") {
      modeLabel = "Modo avanzado";
      queryLabel = "Consulta CQL";
  }

  let html = `
    <span class="md3-advanced__summary-mode" style="font-weight: bold; color: var(--md-sys-color-primary);">${modeLabel}</span> 
    <span class="md3-advanced__summary-separator">|</span>
    <span class="md3-advanced__summary-label">${queryLabel}:</span> 
    <span class="md3-advanced__summary-query">"${escapeHtml(query)}"</span> 
    <span class="md3-advanced__summary-separator">|</span>
    <span class="md3-advanced__summary-label">Resultados:</span>
    <span class="md3-advanced__summary-count">${new Intl.NumberFormat("es-ES").format(total)}</span>`;

  // Check for filters
  const filtered = total; // We don't have total vs filtered here easily, assuming total is filtered count
  // Actually initTable has filtered vs total. Here we just get one number.
  // Let's assume it's the filtered count.
  
  const hasFilters =
    params.has("country_code") ||
    params.has("speaker_type") ||
    params.has("sex") ||
    params.has("speech_mode") ||
    params.has("discourse") ||
    params.get("include_regional") === "1";

  if (hasFilters) {
    const activeFilters = [];
    if (params.get("include_regional") === "1") activeFilters.push("Regional");
    if (params.get("country_code")) activeFilters.push(`País: ${params.get("country_code")}`);
    if (params.get("speaker_type")) activeFilters.push(`Tipo de hablante: ${params.get("speaker_type")}`);
    if (params.get("sex")) activeFilters.push(`Sexo: ${params.get("sex")}`);
    if (params.get("speech_mode")) activeFilters.push(`Modo de habla: ${params.get("speech_mode")}`);
    if (params.get("discourse")) activeFilters.push(`Discurso: ${params.get("discourse")}`);

    html += ` <span class="md3-advanced__summary-separator">|</span> <span class="md3-advanced__summary-filters">${activeFilters.join(", ")}</span>`;
  }

  summaryBox.innerHTML = html;
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
 * Build stats URL from advanced search form
 * Reads parameters from URL (since search updates URL)
 */
function buildStatsUrl() {
  const params = new URLSearchParams(window.location.search);

  // Country filters
  // If we have a specific country filter from the dropdown (interactive filter in stats tab),
  // we override the country_code param.
  if (currentCountryFilter) {
    // Remove existing country codes from search
    params.delete("country_code");
    // Add the selected one
    params.append("country_code", currentCountryFilter);
  }

  return `/search/advanced/stats?${params.toString()}`;
}

/**
 * Process and enrich stats data
 * - Calculates percentages
 * - Maps labels (e.g. 'otro' -> 'no-pro')
 */
function processStatsData(data) {
  const total = data.total_hits || data.total || 0;

  const processList = (list, mapping = {}) => {
    if (!list) return [];
    return list.map((item) => {
      // Calculate percentage
      const p = total > 0 ? item.n / total : 0;

      // Map key if needed
      let key = item.key;
      if (mapping[key]) {
        key = mapping[key];
      } else if (key === "otro") {
        key = "no-pro"; // Default mapping for 'otro'
      }

      return {
        ...item,
        key: key,
        p: p,
      };
    });
  };

  // Mappings
  const speakerMapping = {
    pro: "Profesional",
    otro: "No-Profesional",
  };

  const sexMapping = {
    m: "Masculino",
    f: "Femenino",
    u: "Desconocido",
  };

  const modeMapping = {
    e: "Espontáneo",
    p: "Preparado",
    l: "Lectura", // Assuming 'l' for lectura based on common codes
  };

  // Process country list with uppercase keys
  const byCountry = processList(data.by_country).map((item) => ({
    ...item,
    key: item.key.toUpperCase(),
  }));

  return {
    ...data,
    by_country: byCountry,
    by_speaker_type: processList(data.by_speaker_type, speakerMapping),
    by_sex: processList(data.by_sex, sexMapping),
    by_modo: processList(data.by_modo, modeMapping),
    by_discourse: processList(data.by_discourse),
    by_radio: processList(data.by_radio),
  };
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

  // Update total (backend returns total_hits)
  updateTotal(data.total_hits || data.total || 0);

  // Render country chart (Horizontal)
  const countryContainer = document.getElementById("chart-country");
  if (countryContainer) {
    charts.country = renderBar(
      countryContainer,
      data.by_country,
      "País",
      "absolute",
      "horizontal",
    );
    updateCategoryCount("by_country", data.by_country?.length || 0);
  }

  // Render speaker type chart (Vertical)
  const speakerContainer = document.getElementById("chart-speaker");
  if (speakerContainer) {
    charts.speaker = renderBar(
      speakerContainer,
      data.by_speaker_type,
      "Tipo de hablante",
      "absolute",
      "vertical",
    );
    updateCategoryCount("by_speaker_type", data.by_speaker_type?.length || 0);
  }

  // Render sexo chart (Vertical)
  const sexoContainer = document.getElementById("chart-sexo");
  if (sexoContainer) {
    charts.sexo = renderBar(
      sexoContainer,
      data.by_sex,
      "Sexo",
      "absolute",
      "vertical",
    );
    updateCategoryCount("by_sex", data.by_sex?.length || 0);
  }

  // Render modo chart (Vertical)
  const modoContainer = document.getElementById("chart-modo");
  if (modoContainer) {
    charts.modo = renderBar(
      modoContainer,
      data.by_modo,
      "Modo de habla",
      "absolute",
      "vertical",
    );
    updateCategoryCount("by_modo", data.by_modo?.length || 0);
  }

  // Render discourse chart (Vertical)
  const discourseContainer = document.getElementById("chart-discourse");
  if (discourseContainer) {
    charts.discourse = renderBar(
      discourseContainer,
      data.by_discourse,
      "Discurso",
      "absolute",
      "vertical",
    );
    updateCategoryCount("by_discourse", data.by_discourse?.length || 0);
  }

  // Render radio chart (Horizontal - many radios)
  const radioContainer = document.getElementById("chart-radio");
  if (radioContainer) {
    charts.radio = renderBar(
      radioContainer,
      data.by_radio,
      "Radio",
      "absolute",
      "horizontal",
    );
    updateCategoryCount("by_radio", data.by_radio?.length || 0);
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
 * Populate country filter dropdown from stats data
 * IMPORTANT: Preserve original countries list to show all options after filtering
 */
function populateCountryFilter(countries) {
  const dropdown = document.getElementById("stats-country-filter");
  if (!dropdown) return;

  // Remember current selection
  const currentSelection = dropdown.value;

  // Use originalCountries if available (all countries from initial load)
  // This ensures dropdown always shows all countries, not just filtered ones
  const countriesToShow =
    originalCountries.length > 0 ? originalCountries : countries;

  // Clear existing options
  dropdown.innerHTML = '<option value="">Todos los países</option>';

  // Add country options from original list
  countriesToShow.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.key;
    option.textContent = `${item.key.toUpperCase()} (${new Intl.NumberFormat("es-ES").format(item.n)})`;
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
 * Format number helper
 */
function formatNumber(n) {
  return new Intl.NumberFormat("es-ES").format(n);
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

    // Process data (calculate percentages, map labels)
    const processedData = processStatsData(data);
    currentData = processedData;

    hideLoading();
    renderCharts(processedData);
  } catch (error) {
    console.error("Failed to load stats:", error);
    hideLoading();
    showError();
  }
}

/**
 * Reset stats (clear charts and data)
 */
export function resetStats() {
  cleanupStats();
  const container = document.getElementById("stats-grid");
  if (container) {
    // Clear charts but keep structure if needed, or just hide
    // Actually, the charts are inside articles. We should clear the chart hosts.
    ["country", "speaker", "sexo", "modo", "discourse", "radio"].forEach(
      (id) => {
        const el = document.getElementById(`chart-${id}`);
        if (el) {
          const instance = window.echarts?.getInstanceByDom(el);
          if (instance) instance.dispose();
          el.innerHTML = "";
        }
        // Reset subtitles
        let metaKey = `by_${id}`;
        if (id === "speaker") metaKey = "by_speaker_type";
        if (id === "sexo") metaKey = "by_sex";

        const meta = document.querySelector(`[data-meta="${metaKey}"]`);
        if (meta) meta.textContent = "—";
      },
    );
  }
  updateTotal(0);

  // Reset filter dropdown
  const dropdown = document.getElementById("stats-country-filter");
  if (dropdown) {
    dropdown.innerHTML = '<option value="">Todos los países</option>';
    dropdown.value = "";
  }
  
  // Reset summary
  const countEl = document.getElementById("stats-summary-count");
  if (countEl) countEl.textContent = "—";
  const queryEl = document.getElementById("stats-summary-query");
  if (queryEl) queryEl.textContent = "";
}

/**
 * Initialize stats tab for advanced search
 */
export function initStatsTabAdvanced() {
  // console.debug("Initializing advanced stats tab");

  // Setup tab click listeners
  const statsTab = document.getElementById("tab-estadisticas");
  const resultsTab = document.getElementById("tab-resultados");
  const statsPanel = document.getElementById("panel-estadisticas");
  const resultsPanel = document.getElementById("panel-resultados");

  if (statsTab && resultsTab && statsPanel && resultsPanel) {
    // Stats tab click
    statsTab.addEventListener("click", () => {
      // Switch tabs
      statsTab.setAttribute("aria-selected", "true");
      resultsTab.setAttribute("aria-selected", "false");
      statsTab.classList.add("md3-stats-tab--active");
      resultsTab.classList.remove("md3-stats-tab--active");

      // Switch panels
      statsPanel.hidden = false;
      statsPanel.classList.add("md3-view-content--active");
      resultsPanel.hidden = true;
      resultsPanel.classList.remove("md3-view-content--active");

      // Always load fresh stats when tab is clicked
      loadStats();
    });

    // Results tab click
    resultsTab.addEventListener("click", () => {
      // Switch tabs
      resultsTab.setAttribute("aria-selected", "true");
      statsTab.setAttribute("aria-selected", "false");
      resultsTab.classList.add("md3-stats-tab--active");
      statsTab.classList.remove("md3-stats-tab--active");

      // Switch panels
      resultsPanel.hidden = false;
      resultsPanel.classList.add("md3-view-content--active");
      statsPanel.hidden = true;
      statsPanel.classList.remove("md3-view-content--active");
    });
  }

  // Listen for reset event from searchUI
  document.addEventListener("search:reset", () => {
    resetStats();
  });

  // Listen for search start event to cleanup old stats state
  document.addEventListener("search:start", () => {
    cleanupStats();
  });

  // Listen for search complete event to update stats if tab is active
  document.addEventListener("search:complete", () => {
    const statsTab = document.getElementById("tab-estadisticas");
    // Only load stats if the tab is currently active (visible)
    // Since searchUI now forces switch to Results tab, this will typically be false,
    // effectively deferring load until user clicks the tab.
    if (statsTab && statsTab.getAttribute("aria-selected") === "true") {
      loadStats();
    }
  });

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

  // Setup CSV download button
  const csvBtn = document.getElementById("btn-download-stats-csv");
  if (csvBtn) {
    csvBtn.addEventListener("click", () => {
      const url = buildStatsUrl();
      if (url) {
        const csvUrl = url.replace("/stats", "/stats/csv");
        // Use a temporary link to trigger download without navigating
        const link = document.createElement("a");
        link.href = csvUrl;
        link.download = "estadisticas_busqueda.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }

  // console.debug("Advanced stats tab initialized");
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
    sexo: "by_sex",
    modo: "by_modo",
    discourse: "by_discourse",
  };
  return mapping[chartId];
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
