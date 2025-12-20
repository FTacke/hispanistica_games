/**
 * Player Overview Page Module
 *
 * Provides:
 * - Country filter chips for selecting a country
 * - File tables with player links for each country
 * - Deep-linking via URL query parameters (?country=XXX)
 *
 * Data source: /api/v1/atlas/files (same as corpus-metadata.js)
 */

// ==============================================================================
// DOM ELEMENTS
// ==============================================================================

let countryTabsContainer = null;
let countryPanelsContainer = null;
let loadingElement = null;
let errorElement = null;

// ==============================================================================
// DATA STORE
// ==============================================================================

let fileMetadata = [];

// ==============================================================================
// COUNTRY LABELS (shared with corpus-metadata.js)
// ==============================================================================

const COUNTRY_LABELS = {
  ARG: "Argentina",
  "ARG-CBA": "Argentina: Córdoba",
  "ARG-CHU": "Argentina: Chubut",
  "ARG-SDE": "Argentina: Santiago del Estero",
  BOL: "Bolivia",
  CHL: "Chile",
  COL: "Colombia",
  CRI: "Costa Rica",
  CUB: "Cuba",
  DOM: "República Dominicana",
  ECU: "Ecuador",
  ESP: "España",
  "ESP-CAN": "España: Canarias",
  "ESP-SEV": "España: Sevilla",
  GTM: "Guatemala",
  HND: "Honduras",
  MEX: "México",
  NIC: "Nicaragua",
  PAN: "Panamá",
  PER: "Perú",
  PRY: "Paraguay",
  SLV: "El Salvador",
  URY: "Uruguay",
  USA: "Estados Unidos",
  VEN: "Venezuela",
};

// ==============================================================================
// URL PARAMETER HANDLING
// ==============================================================================

/**
 * Get country from URL parameter
 */
function getCountryFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("country") || null;
}

/**
 * Update URL with current country (without page reload)
 */
function updateURL(countryCode) {
  const url = new URL(window.location);
  if (countryCode) {
    url.searchParams.set("country", countryCode);
  } else {
    url.searchParams.delete("country");
  }
  window.history.replaceState({}, "", url);
}

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

/**
 * Extract country code from filename
 */
function extractCode(filename) {
  const match = filename.match(/_(.+?)_/);
  return match ? match[1] : "";
}

/**
 * Format duration from seconds to HH:MM:SS
 */
function formatDuration(value) {
  if (!value) return "00:00:00";

  if (typeof value === "number") {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const seconds = Math.floor(value % 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const parts = value.split(":");
  if (parts.length < 3) return value;
  const seconds = parts[2].split(".")[0];
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${seconds.padStart(2, "0")}`;
}

/**
 * Format number with locale-specific thousand separators
 */
function formatNumber(value) {
  if (typeof value !== "number") return value || "0";
  return value.toLocaleString("es-ES");
}

/**
 * Parse duration string to seconds
 */
function parseDuration(dur) {
  if (typeof dur === "number") return dur;
  if (typeof dur !== "string") return 0;
  const parts = dur.split(":");
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseFloat(parts[2]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get unique sorted country codes from file metadata
 */
function getCountryCodes() {
  const codes = [
    ...new Set(
      fileMetadata.map((item) => item.country_code || extractCode(item.filename))
    ),
  ].filter(Boolean);
  return codes.sort();
}

// ==============================================================================
// COUNTRY TABS (FILTER CHIPS)
// ==============================================================================

/**
 * Render country filter chips
 */
function renderCountryTabs(countryCodes, activeCode) {
  if (!countryTabsContainer) return;

  const chips = countryCodes
    .map((code) => {
      const isActive = code === activeCode;
      const label = COUNTRY_LABELS[code] || code;
      return `
        <button
          class="md3-country-chip${isActive ? " md3-country-chip--selected" : ""}"
          role="tab"
          aria-selected="${isActive}"
          aria-controls="player-panel-${code}"
          data-country="${code}"
          id="player-tab-${code}"
          tabindex="${isActive ? "0" : "-1"}"
          title="${label}"
        >
          ${code}
        </button>
      `;
    })
    .join("");

  countryTabsContainer.innerHTML = chips;

  // Attach event handlers
  countryTabsContainer.querySelectorAll(".md3-country-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activateCountry(chip.dataset.country);
    });

    // Keyboard navigation
    chip.addEventListener("keydown", (e) => {
      const allChips = Array.from(
        countryTabsContainer.querySelectorAll(".md3-country-chip")
      );
      const currentIndex = allChips.indexOf(e.target);
      let newIndex = currentIndex;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          newIndex = (currentIndex + 1) % allChips.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          newIndex = (currentIndex - 1 + allChips.length) % allChips.length;
          break;
        case "Home":
          e.preventDefault();
          newIndex = 0;
          break;
        case "End":
          e.preventDefault();
          newIndex = allChips.length - 1;
          break;
        default:
          return;
      }

      if (newIndex !== currentIndex) {
        const newChip = allChips[newIndex];
        newChip.focus();
        activateCountry(newChip.dataset.country);
      }
    });
  });
}

/**
 * Activate a specific country
 */
function activateCountry(countryCode) {
  // Update chip states
  countryTabsContainer.querySelectorAll(".md3-country-chip").forEach((chip) => {
    const isActive = chip.dataset.country === countryCode;
    chip.classList.toggle("md3-country-chip--selected", isActive);
    chip.setAttribute("aria-selected", isActive.toString());
    chip.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  // Update panel visibility
  countryPanelsContainer.querySelectorAll(".md3-country-panel").forEach((panel) => {
    const isActive = panel.dataset.country === countryCode;
    panel.dataset.active = isActive.toString();
  });

  // Update URL
  updateURL(countryCode);
}

// ==============================================================================
// COUNTRY PANELS
// ==============================================================================

/**
 * Calculate stats for a specific country
 */
function calculateCountryStats(countryCode) {
  const files = fileMetadata.filter(
    (item) =>
      item.country_code === countryCode ||
      extractCode(item.filename) === countryCode
  );

  const totalDuration = files.reduce(
    (sum, f) => sum + parseDuration(f.duration),
    0
  );
  const totalWords = files.reduce((sum, f) => sum + (f.word_count || 0), 0);
  const emisoras = [...new Set(files.map((f) => f.radio))].filter(Boolean);

  return {
    fileCount: files.length,
    totalDuration,
    totalWords,
    emisoras,
  };
}

/**
 * Render panel for a specific country
 */
function renderCountryPanel(countryCode, isActive) {
  const files = fileMetadata.filter(
    (item) =>
      item.country_code === countryCode ||
      extractCode(item.filename) === countryCode
  );
  const stats = calculateCountryStats(countryCode);
  const label = COUNTRY_LABELS[countryCode] || countryCode;

  // Sort files by date descending
  files.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Build table rows with player links
  const rows = files
    .map((item) => {
      const fileBase =
        item.filename?.replace(".json", "").replace(".mp3", "") || "";
      const transcriptionPath = `/media/transcripts/${encodeURIComponent(fileBase)}.json`;
      const audioPath = `/media/full/${encodeURIComponent(fileBase)}.mp3`;
      const playerUrl = `/player?transcription=${encodeURIComponent(transcriptionPath)}&audio=${encodeURIComponent(audioPath)}`;

      return `
        <tr>
          <td>${item.date || "—"}</td>
          <td>${item.radio || "—"}</td>
          <td>
            <a href="${playerUrl}" class="md3-metadata-player-link" title="Reproducir grabación">
              <span class="material-symbols-rounded" aria-hidden="true">play_circle</span>
              ${fileBase}
            </a>
          </td>
          <td class="right-align">${formatDuration(item.duration)}</td>
          <td class="right-align">${formatNumber(item.word_count)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div
      class="md3-country-panel md3-stack--section"
      role="tabpanel"
      id="player-panel-${countryCode}"
      aria-labelledby="player-tab-${countryCode}"
      data-country="${countryCode}"
      data-active="${isActive}"
    >
      <header class="md3-country-panel-header">
        <div class="md3-country-panel-header__row">
          <h2 class="md3-title-large md3-country-panel-title">${label}</h2>
          <div class="md3-country-panel-stats">
            <div class="md3-country-stat">
              <span class="md3-country-stat-label">Grabaciones</span>
              <span class="md3-country-stat-value">${stats.fileCount}</span>
            </div>
            <div class="md3-country-stat">
              <span class="md3-country-stat-label">Duración total</span>
              <span class="md3-country-stat-value">${formatDuration(stats.totalDuration)}</span>
            </div>
            <div class="md3-country-stat">
              <span class="md3-country-stat-label">Palabras</span>
              <span class="md3-country-stat-value">${formatNumber(stats.totalWords)}</span>
            </div>
            <div class="md3-country-stat">
              <span class="md3-country-stat-label">Emisoras</span>
              <span class="md3-country-stat-value">${stats.emisoras.length}</span>
            </div>
          </div>
        </div>
      </header>

      ${
        files.length > 0
          ? `
        <article class="md3-card md3-card--outlined">
          <div class="md3-card__content">
            <h3 class="md3-title-medium">Grabaciones disponibles</h3>
            <p class="md3-body-medium md3-text-secondary">
              Haga clic en una grabación para abrirla en el reproductor integrado.
            </p>
            <div class="md3-metadata-table-wrapper">
              <table class="md3-metadata-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Emisora</th>
                    <th>Grabación</th>
                    <th class="right-align">Duración</th>
                    <th class="right-align">Palabras</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </article>
      `
          : `
        <div class="md3-metadata-empty">
          <p class="md3-body-medium">No hay grabaciones disponibles para este país.</p>
        </div>
      `
      }
    </div>
  `;
}

/**
 * Render all country panels
 */
function renderCountryPanels(countryCodes, activeCode) {
  if (!countryPanelsContainer) return;

  const panels = countryCodes
    .map((code) => renderCountryPanel(code, code === activeCode))
    .join("");

  countryPanelsContainer.innerHTML = panels;
}

// ==============================================================================
// DATA LOADING
// ==============================================================================

/**
 * Load file metadata from API
 */
async function loadFileMetadata() {
  try {
    const response = await fetch("/api/v1/atlas/files", {
      credentials: "same-origin",
    });
    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login if not authenticated
        window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.files) ? data.files : [];
  } catch (error) {
    console.error("[Player Overview] Error loading files:", error);
    throw error;
  }
}

// ==============================================================================
// UI STATE HELPERS
// ==============================================================================

function showLoading() {
  if (loadingElement) loadingElement.hidden = false;
  if (errorElement) errorElement.hidden = true;
  if (countryTabsContainer) countryTabsContainer.innerHTML = "";
  if (countryPanelsContainer) countryPanelsContainer.innerHTML = "";
}

function hideLoading() {
  if (loadingElement) loadingElement.hidden = true;
}

function showError() {
  if (loadingElement) loadingElement.hidden = true;
  if (errorElement) errorElement.hidden = false;
}

// ==============================================================================
// INITIALIZATION
// ==============================================================================

/**
 * Initialize the player overview page
 */
async function init() {
  console.log("[Player Overview] Initializing...");

  // Get DOM elements
  countryTabsContainer = document.querySelector('[data-element="player-tabs"]');
  countryPanelsContainer = document.querySelector('[data-element="player-panels"]');
  loadingElement = document.querySelector('[data-element="player-loading"]');
  errorElement = document.querySelector('[data-element="player-error"]');

  // Get initial country from URL or server-rendered value
  const urlCountry = getCountryFromURL();
  const initialCountry = urlCountry || window.PLAYER_OVERVIEW_INITIAL_COUNTRY;

  showLoading();

  try {
    fileMetadata = await loadFileMetadata();
    hideLoading();

    const countryCodes = getCountryCodes();

    if (countryCodes.length === 0) {
      if (countryPanelsContainer) {
        countryPanelsContainer.innerHTML = `
          <div class="md3-metadata-empty">
            <p class="md3-body-medium">No hay grabaciones disponibles.</p>
          </div>
        `;
      }
    } else {
      // Determine active country
      const activeCode = countryCodes.includes(initialCountry)
        ? initialCountry
        : countryCodes[0];

      // Render country UI
      renderCountryTabs(countryCodes, activeCode);
      renderCountryPanels(countryCodes, activeCode);

      // Update URL if no country was specified
      if (!urlCountry) {
        updateURL(activeCode);
      }

      console.log(
        "[Player Overview] Initialized with",
        countryCodes.length,
        "countries"
      );
    }
  } catch (error) {
    console.error("[Player Overview] Initialization failed:", error);
    showError();
  }
}

// Auto-init when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { init };
