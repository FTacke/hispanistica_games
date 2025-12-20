/**
 * Corpus Metadata Page Module
 *
 * Provides:
 * - Primary view tabs (Resumen vs. Por País)
 * - Country filter chips and file tables
 * - Download menus (global + country-specific)
 * - Deep-linking via URL query parameters (?view=paises&country=XXX)
 *
 * Data source: /api/v1/atlas/files
 */

// ==============================================================================
// DOM ELEMENTS
// ==============================================================================

let primaryTabs = null;
let viewPanels = null;
let countryTabsContainer = null;
let countryPanelsContainer = null;
let loadingElement = null;
let errorElement = null;

// Zoom modal elements
let zoomModal = null;
let zoomImage = null;

// ==============================================================================
// DATA STORE
// ==============================================================================

let fileMetadata = [];

// ==============================================================================
// COUNTRY LABELS
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
 * Get URL parameters for view and country
 */
function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    view: params.get("view") || "resumen",
    country: params.get("country") || null,
  };
}

/**
 * Update URL with current state (without page reload)
 */
function updateURL(view, countryCode = null) {
  const url = new URL(window.location);

  if (view === "resumen") {
    url.searchParams.delete("view");
    url.searchParams.delete("country");
  } else {
    url.searchParams.set("view", view);
    if (countryCode) {
      url.searchParams.set("country", countryCode);
    } else {
      url.searchParams.delete("country");
    }
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
// PRIMARY VIEW TABS
// ==============================================================================

/**
 * Initialize primary view tabs (Resumen vs. Por País)
 */
function initPrimaryTabs() {
  primaryTabs = document.querySelectorAll(".md3-tabs--primary .md3-tab");
  viewPanels = document.querySelectorAll(".md3-tab-content[data-view-panel]");

  primaryTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      activateView(view);
    });
  });
}

/**
 * Activate a specific view
 */
function activateView(view, updateHistory = true) {
  // Update tab states
  primaryTabs.forEach((tab) => {
    const isActive = tab.dataset.view === view;
    tab.classList.toggle("md3-tab--active", isActive);
    tab.setAttribute("aria-selected", isActive.toString());
  });

  // Update panel visibility
  viewPanels.forEach((panel) => {
    const isActive = panel.dataset.viewPanel === view;
    panel.classList.toggle("md3-tab-content--active", isActive);
  });

  // Update URL
  if (updateHistory) {
    const currentCountry = getActiveCountry();
    updateURL(view, view === "paises" ? currentCountry : null);
  }
}

/**
 * Get currently active country code
 */
function getActiveCountry() {
  const activeTab = countryTabsContainer?.querySelector(
    '.md3-country-chip[aria-selected="true"]'
  );
  return activeTab?.dataset.country || null;
}

// ==============================================================================
// DOWNLOAD MENUS
// ==============================================================================

// Flag to prevent duplicate global click listeners
let globalClickListenerAdded = false;

/**
 * Initialize download menu for a specific container
 */
function initDownloadMenu(container) {
  const button = container.querySelector("[aria-haspopup]");
  const menu = container.querySelector(".md3-menu");

  if (!button || !menu) return;

  // Skip if already initialized
  if (container.dataset.menuInitialized) return;
  container.dataset.menuInitialized = "true";

  // Toggle menu on button click
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu(button, menu);
  });

  // Handle menu item clicks
  menu.querySelectorAll(".md3-menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      const href = item.dataset.downloadHref;
      if (href) {
        window.location.href = href;
      }
      closeMenu(button, menu);
    });
  });

  // Keyboard navigation
  button.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu(button, menu);
      menu.querySelector(".md3-menu-item")?.focus();
    }
  });

  menu.addEventListener("keydown", (e) => {
    const items = Array.from(menu.querySelectorAll(".md3-menu-item"));
    const currentIndex = items.indexOf(document.activeElement);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        items[(currentIndex + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
        break;
      case "Escape":
        e.preventDefault();
        closeMenu(button, menu);
        button.focus();
        break;
      case "Tab":
        closeMenu(button, menu);
        break;
    }
  });
}

/**
 * Initialize all download menus on the page
 */
function initDownloadMenus() {
  document.querySelectorAll(".md3-download-menu").forEach(initDownloadMenu);

  // Add global click listener only once
  if (!globalClickListenerAdded) {
    globalClickListenerAdded = true;
    document.addEventListener("click", () => {
      document.querySelectorAll(".md3-menu:not(.md3-menu--hidden)").forEach((menu) => {
        const button = document.querySelector(`[aria-controls="${menu.id}"]`);
        if (button) closeMenu(button, menu);
      });
    });
  }
}

function toggleMenu(button, menu) {
  const isHidden = menu.classList.contains("md3-menu--hidden");
  if (isHidden) {
    openMenu(button, menu);
  } else {
    closeMenu(button, menu);
  }
}

function openMenu(button, menu) {
  menu.classList.remove("md3-menu--hidden");
  button.setAttribute("aria-expanded", "true");
}

function closeMenu(button, menu) {
  menu.classList.add("md3-menu--hidden");
  button.setAttribute("aria-expanded", "false");
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
          aria-controls="country-panel-${code}"
          data-country="${code}"
          id="country-tab-${code}"
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
  updateURL("paises", countryCode);
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

  // Build table rows - column order: Emisora, Fecha, Archivo, Duración, Palabras
  // Archivo column shows filename WITHOUT player link
  const rows = files
    .map((item) => {
      const fileBase =
        item.filename?.replace(".json", "").replace(".mp3", "") || "";

      return `
        <tr>
          <td>${item.radio || "—"}</td>
          <td>${item.date || "—"}</td>
          <td>${fileBase || "—"}</td>
          <td class="right-align">${formatDuration(item.duration)}</td>
          <td class="right-align">${formatNumber(item.word_count)}</td>
        </tr>
      `;
    })
    .join("");

  // Stats image path
  const statsImagePath = `/static/img/statistics/viz_${countryCode}_resumen.png`;

  // Download menu HTML
  const downloadMenuId = `menu-download-${countryCode}`;
  const downloadButtonId = `btn-download-${countryCode}`;

  return `
    <div
      class="md3-country-panel md3-stack--section"
      role="tabpanel"
      id="country-panel-${countryCode}"
      aria-labelledby="country-tab-${countryCode}"
      data-country="${countryCode}"
      data-active="${isActive}"
    >
      <header class="md3-country-panel-header">
        <div class="md3-country-panel-header__row">
          <h3 class="md3-title-large md3-country-panel-title">${label}</h3>
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
            <h4 class="md3-title-medium">Grabaciones del corpus</h4>
            <div class="md3-metadata-table-wrapper">
              <table class="md3-metadata-table">
                <thead>
                  <tr>
                    <th>Emisora</th>
                    <th>Fecha</th>
                    <th>Archivo</th>
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
          <p>No hay grabaciones disponibles para este país.</p>
        </div>
      `
      }

      <!-- Download Card -->
      <article class="md3-card md3-card--outlined">
        <div class="md3-card__content">
          <h4 class="md3-title-medium">Descargar metadatos de ${label}</h4>
          <p class="md3-body-medium md3-text-secondary">
            Descargue los metadatos de las grabaciones de ${label} en formato tabular o estructurado.
          </p>
        </div>
        <div class="md3-card__actions md3-card__actions--borderless">
          <div class="md3-download-menu">
            <button
              type="button"
              class="md3-button md3-button--tonal"
              id="${downloadButtonId}"
              aria-haspopup="menu"
              aria-expanded="false"
              aria-controls="${downloadMenuId}"
            >
              <span class="material-symbols-rounded" aria-hidden="true">download</span>
              <span>Descargar</span>
              <span class="material-symbols-rounded md3-button__trailing-icon" aria-hidden="true">arrow_drop_down</span>
            </button>
            <div
              id="${downloadMenuId}"
              class="md3-menu md3-menu--hidden"
              role="menu"
              aria-labelledby="${downloadButtonId}"
            >
              <button type="button" class="md3-menu-item" role="menuitem" data-download-href="/corpus/metadata/download/tsv/${countryCode}">
                <span class="material-symbols-rounded" aria-hidden="true">table_view</span>
                Formato TSV
              </button>
              <button type="button" class="md3-menu-item" role="menuitem" data-download-href="/corpus/metadata/download/json/${countryCode}">
                <span class="material-symbols-rounded" aria-hidden="true">data_object</span>
                Formato JSON
              </button>
            </div>
          </div>
        </div>
      </article>

      <!-- Statistics Section -->
      <article class="md3-card md3-card--outlined">
        <div class="md3-card__content">
          <h4 class="md3-title-medium">Estadísticas de ${label}</h4>
          <figure class="md3-country-stats-figure" data-country-stats="${countryCode}">
            <div class="md3-country-stats-image-container">
              <img 
                src="${statsImagePath}" 
                alt="Estadísticas de ${label}" 
                class="md3-country-stats-image"
                loading="lazy"
              >
            </div>
            <figcaption class="md3-body-medium md3-country-stats-caption">
              Distribución de hablantes profesionales por sexo y modo de producción.
            </figcaption>
          </figure>
        </div>
      </article>
    </div>
  `;
}

/**
 * Initialize error handlers for statistics images
 * Hides the card if the image fails to load (CSP-compliant alternative to inline onerror)
 */
function initStatsImageErrorHandlers() {
  const statsImages = document.querySelectorAll('.md3-country-stats-image');
  statsImages.forEach((img) => {
    img.addEventListener('error', function() {
      const card = this.closest('.md3-card');
      if (card) {
        card.style.display = 'none';
      }
    });
  });
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

  // Re-initialize download menus for dynamically added content
  initDownloadMenus();
  
  // Initialize error handlers for statistics images (CSP-compliant)
  initStatsImageErrorHandlers();
  
  // Attach zoom handlers to dynamically added country stats images
  attachZoomHandlers();
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
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.files) ? data.files : [];
  } catch (error) {
    console.error("[Corpus Metadata] Error loading files:", error);
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
// IMAGE ZOOM FUNCTIONALITY (migrated from stats/zoom.js)
// ==============================================================================

/**
 * Initialize the zoom modal functionality for statistics images
 * Supports both global stats images (.md3-stats-image) and country stats (.md3-country-stats-image)
 */
function initZoomModal() {
  zoomModal = document.getElementById('statsZoomModal');
  zoomImage = document.getElementById('statsZoomImage');

  if (!zoomModal || !zoomImage) {
    console.warn('[Corpus Metadata] Zoom modal elements not found');
    return;
  }

  // Attach click handlers to all existing statistics images
  attachZoomHandlers();

  // Close modal on click outside content or on close button
  zoomModal.addEventListener('click', function(e) {
    if (e.target === zoomModal || e.target.closest('.md3-stats-zoom-modal-close')) {
      closeZoomModal();
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && zoomModal.classList.contains('active')) {
      closeZoomModal();
    }
  });
}

/**
 * Attach zoom click handlers to all statistics images
 * Call this after dynamically adding content
 */
function attachZoomHandlers() {
  if (!zoomModal || !zoomImage) return;

  // Select all country stats images (used for both global and per-country stats)
  const allImages = document.querySelectorAll('.md3-country-stats-image');

  allImages.forEach(img => {
    const container = img.closest('.md3-country-stats-image-container');
    if (container && !container.dataset.zoomInitialized) {
      container.dataset.zoomInitialized = 'true';
      container.addEventListener('click', function(e) {
        e.preventDefault();
        openZoomModal(img.src, img.alt);
      });
    }
  });
}

/**
 * Open the zoom modal with a specific image
 */
function openZoomModal(src, alt) {
  if (!zoomModal || !zoomImage) return;
  zoomImage.src = src;
  zoomImage.alt = alt || '';
  zoomModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Close the zoom modal
 */
function closeZoomModal() {
  if (!zoomModal) return;
  zoomModal.classList.remove('active');
  document.body.style.overflow = '';
}

// ==============================================================================
// INITIALIZATION
// ==============================================================================

/**
 * Initialize the corpus metadata page
 */
async function init() {
  console.log("[Corpus Metadata] Initializing...");

  // Get DOM elements
  countryTabsContainer = document.querySelector('[data-element="metadata-tabs"]');
  countryPanelsContainer = document.querySelector('[data-element="metadata-panels"]');
  loadingElement = document.querySelector('[data-element="metadata-loading"]');
  errorElement = document.querySelector('[data-element="metadata-error"]');

  // Initialize primary tabs
  initPrimaryTabs();

  // Initialize global download menu
  initDownloadMenus();

  // Initialize zoom modal for statistics images
  initZoomModal();

  // Parse URL parameters
  const { view, country } = getURLParams();

  // If view is 'paises', we need to load country data
  if (view === "paises" || countryTabsContainer) {
    showLoading();

    try {
      fileMetadata = await loadFileMetadata();
      hideLoading();

      const countryCodes = getCountryCodes();

      if (countryCodes.length === 0) {
        if (countryPanelsContainer) {
          countryPanelsContainer.innerHTML = `
            <div class="md3-metadata-empty">
              <p>No hay metadatos disponibles. Inicie sesión para ver las grabaciones del corpus.</p>
            </div>
          `;
        }
      } else {
        // Determine active country
        const activeCode = countryCodes.includes(country)
          ? country
          : countryCodes[0];

        // Render country UI
        renderCountryTabs(countryCodes, activeCode);
        renderCountryPanels(countryCodes, activeCode);

        console.log(
          "[Corpus Metadata] Initialized with",
          countryCodes.length,
          "countries"
        );
      }
    } catch (error) {
      console.error("[Corpus Metadata] Initialization failed:", error);
      showError();
    }
  }

  // Apply initial view from URL
  if (view === "paises") {
    activateView("paises", false);
  }
}

// Auto-init when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { init };
