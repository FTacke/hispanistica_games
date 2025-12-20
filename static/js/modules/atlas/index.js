/**
 * Atlas Module - Map-only Implementation
 *
 * Displays an interactive map with markers for each corpus location.
 * Markers show tooltips with aggregated statistics and deep-links
 * to corpus_metadata and corpus_estadisticas pages.
 *
 * Data sources:
 * - /api/v1/atlas/countries - Country statistics (word count, duration)
 * - /api/v1/atlas/files - File metadata for emisora names
 */

// DOM element reference
let MAP_CONTAINER = null;

// Leaflet map instance
let mapInstance = null;

// Marker storage
const cityMarkers = new Map();

// Data stores
let countryStats = [];
let fileMetadata = [];

// Location definitions with coordinates
const CITY_LIST = [
  {
    code: "ARG",
    label: "Argentina: Buenos Aires",
    lat: -34.6118,
    lng: -58.4173,
    tier: "primary",
    type: "national",
  },
  {
    code: "ARG-CHU",
    label: "Argentina: Trelew (Chubut)",
    lat: -43.2489,
    lng: -65.3051,
    tier: "secondary",
    type: "regional",
  },
  {
    code: "ARG-CBA",
    label: "Argentina: Córdoba",
    lat: -31.4201,
    lng: -64.1888,
    tier: "secondary",
    type: "regional",
  },
  {
    code: "ARG-SDE",
    label: "Argentina: Santiago del Estero",
    lat: -27.7951,
    lng: -64.2615,
    tier: "secondary",
    type: "regional",
  },
  {
    code: "BOL",
    label: "Bolivia: La Paz",
    lat: -16.5,
    lng: -68.15,
    tier: "primary",
    type: "national",
  },
  {
    code: "CHL",
    label: "Chile: Santiago",
    lat: -33.4489,
    lng: -70.6693,
    tier: "primary",
    type: "national",
  },
  {
    code: "COL",
    label: "Colombia: Bogotá",
    lat: 4.6097,
    lng: -74.0817,
    tier: "primary",
    type: "national",
  },
  {
    code: "CRI",
    label: "Costa Rica: San José",
    lat: 9.9281,
    lng: -84.0907,
    tier: "primary",
    type: "national",
  },
  {
    code: "CUB",
    label: "Cuba: La Habana",
    lat: 23.133,
    lng: -82.383,
    tier: "primary",
    type: "national",
  },
  {
    code: "ECU",
    label: "Ecuador: Quito",
    lat: -0.23,
    lng: -78.52,
    tier: "primary",
    type: "national",
  },
  {
    code: "SLV",
    label: "El Salvador: San Salvador",
    lat: 13.6929,
    lng: -89.2182,
    tier: "primary",
    type: "national",
  },
  {
    code: "USA",
    label: "Estados Unidos: Miami",
    lat: 25.7617,
    lng: -80.1918,
    tier: "primary",
    type: "national",
  },
  {
    code: "ESP",
    label: "España: Madrid",
    lat: 40.4168,
    lng: -3.7038,
    tier: "primary",
    type: "national",
  },
  {
    code: "ESP-CAN",
    label: "España: La Laguna (Canarias)",
    lat: 28.4874,
    lng: -16.3141,
    tier: "secondary",
    type: "regional",
  },
  {
    code: "ESP-SEV",
    label: "España: Sevilla (Andalucía)",
    lat: 37.3886,
    lng: -5.9823,
    tier: "secondary",
    type: "regional",
  },
  {
    code: "GTM",
    label: "Guatemala: Ciudad de Guatemala",
    lat: 14.6349,
    lng: -90.5069,
    tier: "primary",
    type: "national",
  },
  {
    code: "HND",
    label: "Honduras: Tegucigalpa",
    lat: 14.0723,
    lng: -87.1921,
    tier: "primary",
    type: "national",
  },
  {
    code: "MEX",
    label: "México: Ciudad de México",
    lat: 19.4326,
    lng: -99.1332,
    tier: "primary",
    type: "national",
  },
  {
    code: "NIC",
    label: "Nicaragua: Managua",
    lat: 12.1364,
    lng: -86.2514,
    tier: "primary",
    type: "national",
  },
  {
    code: "PAN",
    label: "Panamá: Ciudad de Panamá",
    lat: 8.9824,
    lng: -79.5199,
    tier: "primary",
    type: "national",
  },
  {
    code: "PRY",
    label: "Paraguay: Asunción",
    lat: -25.2637,
    lng: -57.5759,
    tier: "primary",
    type: "national",
  },
  {
    code: "PER",
    label: "Perú: Lima",
    lat: -12.0464,
    lng: -77.0428,
    tier: "primary",
    type: "national",
  },
  {
    code: "DOM",
    label: "República Dominicana: Santo Domingo",
    lat: 18.4663,
    lng: -69.9526,
    tier: "primary",
    type: "national",
  },
  {
    code: "URY",
    label: "Uruguay: Montevideo",
    lat: -34.9011,
    lng: -56.191,
    tier: "primary",
    type: "national",
  },
  {
    code: "VEN",
    label: "Venezuela: Caracas",
    lat: 10.5,
    lng: -66.9333,
    tier: "primary",
    type: "national",
  },
];

const MARKER_ICONS = {
  primary: {
    path: "/static/img/citymarkers/primary/",
    file: "communications-tower.svg",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  },
  secondary: {
    path: "/static/img/citymarkers/secondary/",
    file: "communications-tower.svg",
    iconSize: [25, 25],
    iconAnchor: [17, 17],
  },
};

/**
 * Get map container width for responsive calculations
 */
function getMapWidth() {
  return MAP_CONTAINER ? MAP_CONTAINER.offsetWidth : window.innerWidth;
}

/**
 * Calculate initial zoom level based on viewport
 */
function getInitialZoom() {
  const width = getMapWidth();
  if (width <= 480) return 2.6;
  if (width <= 900) return 2.8;
  return 3;
}

/**
 * Calculate initial map center based on viewport
 */
function getInitialCenter() {
  const width = getMapWidth();
  if (width <= 480) return [-6, -60];
  if (width <= 900) return [-2, -55];
  return [1, -50];
}

/**
 * Format duration - handles both seconds (number) and HH:MM:SS string format
 */
function formatDuration(value) {
  if (!value) return "0 h 0 min";

  // If it's already a string like "09:36:58", parse and format
  if (typeof value === "string") {
    const parts = value.split(":");
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      return `${hours} h ${minutes} min`;
    }
    return value; // Return as-is if not parseable
  }

  // If it's a number (seconds), calculate hours and minutes
  if (typeof value === "number") {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return `${hours} h ${minutes} min`;
  }

  return "0 h 0 min";
}

/**
 * Format number with locale-specific thousand separators
 */
function formatNumber(value) {
  if (typeof value !== "number") return value || "0";
  return value.toLocaleString("es-ES");
}

/**
 * Extract country code from filename
 * Format: prefix_CODE_suffix.json -> CODE
 */
function extractCode(filename) {
  const match = filename.match(/_(.+?)_/);
  if (!match) return "";
  return match[1];
}

/**
 * Get emisoras (radio stations) for a specific location code
 */
function getEmisorasForCode(code) {
  // Use country_code from API if available, fallback to filename extraction
  const filesForCode = fileMetadata.filter(
    (item) => item.country_code === code || extractCode(item.filename) === code
  );
  const uniqueEmisoras = [...new Set(filesForCode.map((item) => item.radio))];
  return uniqueEmisoras.filter(Boolean);
}

/**
 * Get stats for a specific location code
 */
function getStatsForCode(code) {
  // Try exact match first
  let stats = countryStats.find((s) => s.country_code === code);
  if (stats) {
    return stats;
  }
  // For regional codes (e.g., ARG-CBA), return null (no aggregated regional stats)
  return null;
}

/**
 * Build tooltip HTML content for a marker
 */
function buildTooltipContent(city) {
  const code = city.code;
  const emisoras = getEmisorasForCode(code);
  const stats = getStatsForCode(code);

  // Build emisoras list
  const emisorasHtml =
    emisoras.length > 0
      ? emisoras.join(", ")
      : '<span class="atlas-tooltip-empty">Sin datos</span>';

  // Build stats lines
  const durationHtml = stats
    ? formatDuration(stats.total_duration || 0)
    : '<span class="atlas-tooltip-empty">—</span>';
  const wordsHtml = stats
    ? formatNumber(stats.total_word_count || 0)
    : '<span class="atlas-tooltip-empty">—</span>';

  // Check if user is authenticated for showing player link
  const isAuthenticated = window.IS_AUTHENTICATED === "true" || window.IS_AUTHENTICATED === true;

  // Build links section
  let linksHtml = `
    <a href="/corpus/metadata?view=paises&country=${code}" class="atlas-tooltip-link">
      <span class="material-symbols-rounded" aria-hidden="true">dataset</span>
      Metadatos
    </a>
  `;

  // Add player link only for authenticated users
  if (isAuthenticated) {
    linksHtml += `
      <a href="/corpus/player?country=${code}" class="atlas-tooltip-link">
        <span class="material-symbols-rounded" aria-hidden="true">play_circle</span>
        Player
      </a>
    `;
  }

  return `
    <div class="atlas-tooltip">
      <div class="atlas-tooltip-title">${city.label}</div>
      <div class="atlas-tooltip-row">
        <span class="atlas-tooltip-label">Emisoras:</span>
        <span class="atlas-tooltip-value">${emisorasHtml}</span>
      </div>
      <div class="atlas-tooltip-row">
        <span class="atlas-tooltip-label">Duración total:</span>
        <span class="atlas-tooltip-value">${durationHtml}</span>
      </div>
      <div class="atlas-tooltip-row">
        <span class="atlas-tooltip-label">Palabras transcritas:</span>
        <span class="atlas-tooltip-value">${wordsHtml}</span>
      </div>
      <div class="atlas-tooltip-links">
        ${linksHtml}
      </div>
    </div>
  `;
}

/**
 * Add city markers to the map
 */
function addCityMarkers() {
  if (!window.L || !MAP_CONTAINER) return;

  CITY_LIST.forEach((city) => {
    const config = MARKER_ICONS[city.tier] || MARKER_ICONS.primary;
    const icon = window.L.icon({
      iconUrl: `${config.path}${config.file}`,
      iconSize: config.iconSize,
      iconAnchor: config.iconAnchor,
      popupAnchor: [0, -config.iconAnchor[1]],
    });

    const marker = window.L.marker([city.lat, city.lng], { icon }).addTo(
      mapInstance
    );

    // Build and bind popup with tooltip content
    const tooltipContent = buildTooltipContent(city);
    
    // Responsive autoPan padding: mehr Platz auf Mobile für Top App Bar
    const isMobile = window.innerWidth < 600;
    const autoPanPaddingTop = isMobile ? [20, 80] : [50, 100]; // [left, top]
    const autoPanPaddingBottom = isMobile ? [20, 20] : [50, 50]; // [right, bottom]
    
    marker.bindPopup(tooltipContent, {
      className: "atlas-popup",
      maxWidth: isMobile ? 280 : 320,
      minWidth: isMobile ? 180 : 200,
      autoPan: true,
      autoPanPaddingTopLeft: autoPanPaddingTop,
      autoPanPaddingBottomRight: autoPanPaddingBottom,
      keepInView: true, // Popup bleibt im sichtbaren Bereich
    });

    // Click handler: center map on marker (popup opens automatically via bindPopup)
    marker.on("click", function (e) {
      // Gentle pan to center marker (don't zoom too much)
      const currentZoom = mapInstance.getZoom();
      const targetZoom = Math.min(Math.max(currentZoom, 4), 6); // Between 4 and 6

      // Use panTo for smooth centering without aggressive zoom
      mapInstance.panTo(e.latlng, {
        animate: true,
        duration: 0.3,
      });
    });

    cityMarkers.set(city.code, marker);
  });
}

/**
 * Update all marker popups with fresh data
 * Called after data is loaded
 */
function updateMarkerPopups() {
  CITY_LIST.forEach((city) => {
    const marker = cityMarkers.get(city.code);
    if (marker) {
      const tooltipContent = buildTooltipContent(city);
      marker.setPopupContent(tooltipContent);
    }
  });
}

/**
 * Initialize the Leaflet map
 */
function initMap() {
  if (!window.L || !MAP_CONTAINER) return;

  const center = getInitialCenter();
  mapInstance = window.L.map(MAP_CONTAINER, {
    center,
    zoom: getInitialZoom(),
    attributionControl: false,
  });

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(mapInstance);

  // Add markers (initially with empty data)
  addCityMarkers();

  // Invalidate size after render
  setTimeout(() => mapInstance.invalidateSize(), 200);

  // Handle window resize
  window.addEventListener("resize", () => {
    setTimeout(() => {
      mapInstance.invalidateSize();
      // Re-center map on resize if no popup is open
      if (!document.querySelector(".leaflet-popup")) {
        mapInstance.flyTo(getInitialCenter(), getInitialZoom());
      }
    }, 200);
  });
}

/**
 * Load country statistics from API
 */
async function loadCountryStats() {
  try {
    const response = await fetch("/api/v1/atlas/countries", {
      credentials: "same-origin",
    });
    if (!response.ok) {
      console.warn("[Atlas] Failed to load country stats:", response.status);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data.countries) ? data.countries : [];
  } catch (error) {
    console.error("[Atlas] Error loading country stats:", error);
    return [];
  }
}

/**
 * Load file metadata from API
 */
async function loadFileMetadata() {
  try {
    const response = await fetch("/api/v1/atlas/files", {
      credentials: "same-origin",
    });
    if (!response.ok) {
      // 401 is expected for unauthenticated users - don't show error
      if (response.status !== 401) {
        console.warn("[Atlas] Failed to load file metadata:", response.status);
      }
      return [];
    }
    const data = await response.json();
    return Array.isArray(data.files) ? data.files : [];
  } catch (error) {
    console.error("[Atlas] Error loading file metadata:", error);
    return [];
  }
}

/**
 * Bootstrap the atlas module
 * Loads all data and initializes the map
 */
async function bootstrap() {
  // Initialize map immediately (shows markers with empty data)
  initMap();

  // Load data in parallel
  const [countriesRes, filesRes] = await Promise.all([
    loadCountryStats(),
    loadFileMetadata(),
  ]);

  countryStats = countriesRes;
  fileMetadata = filesRes;

  // Update marker popups with loaded data
  updateMarkerPopups();

  console.log("[Atlas] Data loaded:", {
    countries: countryStats.length,
    files: fileMetadata.length,
  });
}

/**
 * Initialize Atlas module
 * Called by router.js after Leaflet is loaded
 * @returns {object} mapInstance for cleanup
 */
export function init() {
  console.log("[Atlas Module] Initializing map-only version...");

  // Get DOM element
  MAP_CONTAINER = document.getElementById("atlas-map");

  if (!MAP_CONTAINER) {
    console.warn("[Atlas Module] Map container not found (#atlas-map)");
    return null;
  }

  // Bootstrap the atlas
  bootstrap();

  // Return map instance for cleanup
  return mapInstance;
}
