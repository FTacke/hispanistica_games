/**
 * Advanced Search Form Handler (Stabilized)
 *
 * Null-safe implementation with robust HTMX/Turbo support
 * - Handles missing form gracefully
 * - Fallback for Select2
 * - Prevents double-binding
 * - Supports dynamic content swap via HTMX
 */

import {
  initAdvancedTable,
  updateExportButtons,
  updateSummary,
} from "./initTable.js";
import { SearchFiltersManager } from "../search/filters.js";
import { AdvancedAudioManager } from "./audio.js";
import { loadStats } from "../stats/initStatsTabAdvanced.js";

let filtersManager = null;
let resultsLoaded = false;
let audioManager = null;

// --- Null-sichere Helpers ---
function q(form, sel) {
  return form ? form.querySelector(sel) : null;
}
function qv(form, sel, fallback = "") {
  const el = q(form, sel);
  return el?.value ?? fallback;
}
function qb(form, sel, fallback = false) {
  const el = q(form, sel);
  if (!el) return fallback;
  if (el.type === "checkbox" || el.type === "radio") return !!el.checked;
  const val = (el.value || "").toLowerCase();
  return val === "true" || val === "on" || val === "1";
}

/**
 * Build query parameters from form controls
 * Returns URLSearchParams object
 */
function buildQueryParams(form) {
  if (!form) {
    console.error("[Advanced] Form not found in buildQueryParams");
    return new URLSearchParams();
  }

  const params = new URLSearchParams();

  // Required: Query
  const qElement = q(form, "#q");
  if (!qElement) {
    console.error("[Advanced] Query element #q not found");
    return params;
  }

  const query = qv(form, "#q", "").trim();
  if (!query) {
    alert("Por favor, introduzca una consulta");
    return params;
  }
  params.append("q", query);

  // Case sensitivity via ignore_accents: unchecked = sensitive=1, checked = insensitive=0
  const ignoreAccentsCheckbox = form.querySelector('[name="ignore_accents"]');
  const sensitive =
    ignoreAccentsCheckbox && ignoreAccentsCheckbox.checked ? "0" : "1";
  params.set("sensitive", sensitive);

  const expertCql = qb(form, '[name="expert_cql"]', false);

  const modeEl =
    q(form, 'input[name="mode"]:checked') || q(form, 'select[name="mode"]');
  const mode = modeEl?.value || "forma";

  if (expertCql) {
    params.set("mode", "cql");
  } else {
    params.set("mode", mode);
  }

  // Query-type specific parameters
  // Metadata filters (country, speaker type, sex, speech mode, discourse)
  const filterMappings = [
    { param: "country_code", selector: "#filter-country-code" },
    { param: "speaker_type", selector: "#filter-speaker-type" },
    { param: "sex", selector: "#filter-sex" },
    { param: "speech_mode", selector: "#filter-speech-mode" },
    { param: "discourse", selector: "#filter-discourse" },
  ];

  filterMappings.forEach(({ param, selector }) => {
    const selectEl = q(form, selector);
    if (selectEl) {
      Array.from(selectEl.options)
        .filter((opt) => opt.selected && opt.value)
        .forEach((opt) => params.append(param, opt.value));
    }
  });

  // Include regional checkbox
  const includeRegional = qb(form, "#include-regional", false);
  if (includeRegional) params.set("include_regional", "1");

  return params;
}

/**
 * Bind form submit handler (null-safe, idempotent)
 */
function bindFormSubmit(form) {
  if (!form) return;
  if (form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const queryParams = buildQueryParams(form);
    console.log(
      "[Advanced] Submitting with params:",
      Object.fromEntries(queryParams),
    );

    loadSearchResults(queryParams);
  });
}

/**
 * Load search results via AJAX
 */
async function loadSearchResults(queryParams) {
  const summaryBox = document.getElementById("adv-summary");

  try {
    if (summaryBox) {
      summaryBox.hidden = false;
      summaryBox.innerHTML = "<span>Cargando resultados...</span>";
    }

    initAdvancedTable(queryParams.toString());
    updateExportButtons(queryParams.toString());

    const response = await fetch(
      `/search/advanced/data?${queryParams.toString()}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    updateSummary(data, queryParams);

    if (summaryBox) {
      summaryBox.focus();
      summaryBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    resultsLoaded = true;
    console.log("✅ Results loaded:", data.recordsFiltered);

    // Trigger stats refresh if stats tab exists
    // Stats will only actually load if the tab is active
    const statsTab = document.getElementById("tab-estadisticas");
    if (statsTab && statsTab.getAttribute("aria-selected") === "true") {
      console.log("[Advanced] Stats tab active, refreshing stats");
      setTimeout(() => loadStats(), 300);
    }
  } catch (error) {
    console.error("❌ Error loading results:", error);
    if (summaryBox) {
      summaryBox.innerHTML = `<span style="color: var(--md-sys-color-error);">Error: ${escapeHtml(error.message)}</span>`;
    }
  }
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Main initialization function (robust, idempotent)
 */
function initFormHandler(root = document) {
  // Find the form (multiple fallbacks for flexibility)
  const form =
    (root || document).querySelector("#advanced-search-form") ||
    document.getElementById("advanced-search-form");

  if (!form) {
    console.log(
      "[Advanced] Form #advanced-search-form not found, skipping initialization",
    );
    return;
  }

  console.log("[Advanced] Initializing form handler");

  // Initialize filters with Select2 (if available)
  if (!filtersManager) {
    filtersManager = new CorpusFiltersManager();
    filtersManager.initialize();
  }

  // Initialize audio manager to bind play/download button events
  if (!audioManager) {
    audioManager = new CorpusAudioManager();
    audioManager.bindEvents();
  }

  // Select2-Fallback (robust, optional)
  (function initFilters(f) {
    if (!f) return;
    const selects = f.querySelectorAll?.('[data-enhance="select2"]');
    if (!selects || !selects.length) return;
    const hasJQ = !!(
      window.jQuery &&
      window.jQuery.fn &&
      window.jQuery.fn.select2
    );
    if (!hasJQ) {
      console.warn("Select2 nicht geladen – nutze native <select>.");
      return;
    }
    window.jQuery(selects).select2({ width: "100%" });
  })(form);

  // Bind form submit
  bindFormSubmit(form);

  console.log("✅ Advanced form handler ready");
}

// --- Event Listeners ---

// Standard page load
document.addEventListener("DOMContentLoaded", () => initFormHandler());

// HTMX afterSwap for dynamic content swaps
document.addEventListener("htmx:afterSwap", (e) => {
  if (!e?.target) return;
  if (e.target.closest && e.target.closest("#advanced-search-form")) {
    console.log("[Advanced] HTMX swap detected, re-initializing");
    initFormHandler(document);
  }
});

// Export for testing
export { buildQueryParams, loadSearchResults };
