/**
 * Advanced Search DataTables Initialization
 * Server-Side processing for /search/advanced/data endpoint
 *
 * Handles:
 * - DataTables init with server-side pagination
 * - Singleton pattern with reloadWith(params) method
 * - KWIC rendering (left|match|right)
 * - Audio player integration
 * - Metadata display + Summary box updates
 * - Export URL generation
 */

let advancedTable = null;
let currentParams = null;

/**
 * Initialize DataTables with server-side processing (Singleton)
 * Safely destroys existing table before re-initialization
 *
 * @param {string} queryParams - Query string (e.g., "q=radio&mode=forma")
 */
import {
  makeBaseConfig,
  escapeHtml,
  renderAudioButtons,
  renderFileLink,
} from "./datatableFactory.js";

export function initAdvancedTable(queryParams) {
  console.log("[Advanced] initAdvancedTable called with params:", queryParams);
  // Guard: jQuery must be present
  if (typeof window.$ === "undefined" || typeof window.jQuery === "undefined") {
    console.error(
      "[Advanced] jQuery not available, cannot initialize DataTables",
    );
    return;
  }

  // Guard: DataTables plugin must be available
  if (typeof $.fn.dataTable === "undefined") {
    console.error("[Advanced] DataTables plugin not available");
    return;
  }

  // Store current params for reloadWith
  currentParams = queryParams;

  // Step 1: Destroy existing table if present (Re-init safety)
  console.log(
    "[Advanced] advancedTable exists?",
    !!advancedTable,
    "DOM advanced-table:",
    !!document.getElementById("advanced-table"),
  );
  if (advancedTable && $.fn.dataTable.isDataTable("#advanced-table")) {
    try {
      advancedTable.destroy(); // Destroy DataTables instance
      advancedTable = null;
    } catch (e) {
      console.warn("[DataTables] Destroy error:", e);
    }
  }

  // Step 2: Build AJAX URL from current form values
  const ajaxUrl = `/search/advanced/data?${queryParams}`;
  console.log("[DataTables] Init with:", ajaxUrl);

  // Step 3: Initialize DataTables with minimal config
  advancedTable = $("#advanced-table").DataTable({
    serverSide: true,
    processing: true,
    deferRender: true,
    autoWidth: false,
    searching: false, // Disable client-side search (search is handled via form)
    ordering: true, // Enable ordering (server-side support expected)
    pageLength: 50,
    lengthMenu: [25, 50, 100],

    // Disable sorting for non-sortable columns
    columnDefs: [{ orderable: false, targets: [0, 1, 3, 4, 10, 11] }],

    // AJAX config
    ajax: {
      url: ajaxUrl,
      type: "GET",
      error: function (xhr, error, thrown) {
        // Network/HTTP error
        console.error("DataTables AJAX error:", xhr.status, error);
        handleDataTablesError(xhr);
      },
      dataSrc: function (json) {
        console.log("[DataTables dataSrc] Response received:", json);

        // Handle initial load: don't show "0 results"
        if (json.initial_load) {
          console.log(
            "[DataTables] Initial load detected, hiding summary and table.",
          );
          updateSummary(json, queryParams, true); // Pass initial_load flag
          updateExportButtons(queryParams);
          return []; // Return empty data
        }

        // Check for backend error in response body (e.g., BLS unreachable)
        if (json && json.error) {
          console.warn(`[DataTables] Backend error detected: ${json.error}`);
          handleBackendError(json);
          // Return empty data so DataTables shows empty table + our error banner
          return [];
        }

        // Normal flow: update summary and export buttons
        updateSummary(json, queryParams);
        updateExportButtons(queryParams);
        focusSummary();
        return json.data || [];
      },
    },

    // Column definitions (12 columns - same as Simple)
    columnDefs: [
      // Column 0: Row number (#)
      {
        targets: 0,
        render: function (data, type, row, meta) {
          return meta.row + meta.settings._iDisplayStart + 1;
        },
        width: "40px",
        searchable: false,
        orderable: false,
      },
      // Column 1: Context left (canonical key)
      {
        targets: 1,
        data: "context_left",
        render: function (data) {
          return `<span class="md3-corpus-context">${escapeHtml(data || "")}</span>`;
        },
        className: "md3-datatable__cell--context right-align",
        width: "200px",
      },
      // Column 2: Match (KWIC) - highlighted (canonical 'text')
      {
        targets: 2,
        data: "text",
        render: function (data) {
          return `<span class="md3-corpus-keyword"><mark>${escapeHtml(data || "")}</mark></span>`;
        },
        className: "md3-datatable__cell--match center-align",
        width: "150px",
      },
      // Column 3: Context right (canonical key)
      {
        targets: 3,
        data: "context_right",
        render: function (data) {
          return `<span class="md3-corpus-context">${escapeHtml(data || "")}</span>`;
        },
        className: "md3-datatable__cell--context",
        width: "200px",
      },
      // Column 4: Audio player
      {
        targets: 4,
        data: null,
        render: function (data, type, row) {
          return renderAudioButtons(row);
        },
        orderable: false,
        className: "md3-datatable__cell--audio center-align",
        width: "120px",
      },
      // Column 5: Country (canonical 'country_code') - always uppercase
      {
        targets: 5,
        data: "country_code",
        render: function (data, type) {
          // For sorting/filtering, return original value
          if (type === "sort" || type === "filter" || type === "type") {
            return data || "";
          }
          // For display, uppercase
          return escapeHtml((data || "-").toUpperCase());
        },
        width: "80px",
        orderable: true,
      },
      // Column 6: Speaker type
      {
        targets: 6,
        data: "speaker_type",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "80px",
        orderable: true,
      },
      // Column 7: Sex
      {
        targets: 7,
        data: "sex",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "80px",
        orderable: true,
      },
      // Column 8: Mode
      {
        targets: 8,
        data: "mode",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "80px",
        orderable: true,
      },
      // Column 9: Discourse
      {
        targets: 9,
        data: "discourse",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "80px",
        orderable: true,
      },
      // Column 10: Token ID (canonical 'token_id')
      {
        targets: 10,
        data: "token_id",
        render: function (data) {
          return escapeHtml(data || "-");
        },
        width: "100px",
        orderable: true,
      },
      // Column 11: Filename
      {
        targets: 11,
        data: "filename",
        render: function (data, type, row) {
          return renderFileLink(data, type, row);
        },
        width: "80px",
        className: "center-align",
      },
    ],

    // Responsive behavior
    responsive: false,

    // DOM structure (match corpus layout with export buttons)
    dom: '<"top"pB<"ml-auto"lf>>rt<"bottom"ip>',
    buttons: [
      {
        extend: "copyHtml5",
        text: '<span class="material-symbols-rounded">content_copy</span> Copiar',
        exportOptions: { columns: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11] },
      },
      {
        extend: "csvHtml5",
        text: '<span class="material-symbols-rounded">csv</span> CSV',
        exportOptions: { columns: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11] },
      },
      {
        extend: "excelHtml5",
        text: '<span class="material-symbols-rounded">table</span> Excel',
        exportOptions: { columns: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11] },
      },
      {
        extend: "pdfHtml5",
        text: '<span class="material-symbols-rounded">picture_as_pdf</span> PDF',
        orientation: "landscape",
        pageSize: "A4",
        exportOptions: { columns: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11] },
        customize: function (doc) {
          doc.defaultStyle.fontSize = 8;
          doc.styles.tableHeader.fontSize = 9;
        },
      },
    ],

    // Localization
    language: {
      lengthMenu: "_MENU_ resultados por página",
      zeroRecords: "No se encontraron resultados",
      info: "Mostrando _START_ a _END_ de _TOTAL_ resultados",
      infoEmpty: "Sin resultados",
      infoFiltered: "(filtrados de _MAX_ resultados totales)",
      loadingRecords: "Cargando...",
      processing: "Procesando...",
      paginate: {
        first: "Primero",
        last: "Último",
        next: "Siguiente",
        previous: "Anterior",
      },
    },
  });
  console.log("✅ DataTables initialized");

  // Adjust columns after init (to avoid pixel shifts)
  setTimeout(() => {
    try {
      if (advancedTable && advancedTable.columns) {
        advancedTable.columns.adjust();
        if (advancedTable.responsive) advancedTable.responsive.recalc();
      }
    } catch (e) {
      console.warn("[Advanced] Column adjust error:", e);
    }
  }, 100);

  // Window resize -> adjust columns
  $(window).on("resize.advancedTable", () => {
    try {
      if (advancedTable && advancedTable.columns) {
        advancedTable.columns.adjust();
        if (advancedTable.responsive) advancedTable.responsive.recalc();
      }
    } catch (e) {
      console.warn("[Advanced] Column adjust error on resize:", e);
    }
  });
}

/**
 * Reload table with new parameters (public API)
 *
 * @param {URLSearchParams|string} params - New query parameters
 */
export function reloadWith(params) {
  const paramString =
    params instanceof URLSearchParams ? params.toString() : params;
  console.log("[DataTables] Reloading with:", paramString);

  // Re-initialize with new params
  initAdvancedTable(paramString);
}

/**
 * Focus on summary box after data load (A11y)
 */
function focusSummary() {
  const summaryBox = document.getElementById("adv-summary");
  if (summaryBox) {
    // Small delay to ensure content is rendered
    setTimeout(() => {
      summaryBox.focus();
      summaryBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }
}

/**
 * Handle backend errors returned in JSON response body
 * (e.g., BlackLab connection error, invalid CQL syntax)
 */
function handleBackendError(json) {
  const errorCode = json.error || "unknown_error";
  const errorMessage =
    json.message || "An error occurred in the search backend";

  console.error(`[Backend Error] ${errorCode}: ${errorMessage}`);

  // Map error codes to user-friendly messages and icons
  const errorConfig = {
    upstream_unavailable: {
      icon: "cloud_off",
      title: "Search Backend Unavailable",
      message:
        "The search backend (BlackLab) is currently not reachable. Please check that the BlackLab server is running.",
      severity: "error",
    },
    upstream_timeout: {
      icon: "schedule",
      title: "Search Timeout",
      message:
        "The search backend took too long to respond. Please try again or simplify your query.",
      severity: "warning",
    },
    upstream_error: {
      icon: "cloud_queue",
      title: "Backend Error",
      message: errorMessage,
      severity: "error",
    },
    invalid_cql: {
      icon: "code",
      title: "CQL Syntax Error",
      message: errorMessage,
      severity: "warning",
    },
    invalid_filter: {
      icon: "filter_list",
      title: "Invalid Filter",
      message: errorMessage,
      severity: "warning",
    },
    server_error: {
      icon: "error_outline",
      title: "Server Error",
      message:
        "An unexpected error occurred. Please try again or contact support.",
      severity: "error",
    },
  };

  const config = errorConfig[errorCode] || {
    icon: "warning",
    title: "Error",
    message: errorMessage,
    severity: "error",
  };

  // Display error banner using MD3 alert component
  let resultsSection = document.getElementById("results-section");

  // Fallback: create results section if it doesn't exist
  if (!resultsSection) {
    console.warn(
      "[Backend Error] results-section not found, creating fallback container",
    );
    const table = document.getElementById("advanced-table");
    if (table && table.parentElement) {
      resultsSection = document.createElement("div");
      resultsSection.id = "results-section";
      table.parentElement.insertBefore(resultsSection, table);
    } else {
      console.error(
        "[Backend Error] Cannot find suitable location to display error banner",
      );
      return;
    }
  }

  if (resultsSection) {
    // Remove any existing error/alert messages
    const existingErrors = resultsSection.querySelectorAll(".md3-alert");
    existingErrors.forEach((el) => el.remove());

    // Create alert banner with icon, title, and message
    const alertClass =
      config.severity === "error" ? "md3-alert--error" : "md3-alert--warning";
    const alertHtml = `
      <div class="md3-alert ${alertClass}" role="alert">
        <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">${config.icon}</span>
        <div class="md3-alert__content">
          <div class="md3-alert__title">${config.title}</div>
          <div class="md3-alert__message">${escapeHtml(config.message)}</div>
        </div>
      </div>
    `;
    resultsSection.insertAdjacentHTML("afterbegin", alertHtml);
    console.log("[Backend Error] Alert banner displayed for:", errorCode);
  }
}

/**
 * Handle DataTables AJAX errors
 */
function handleDataTablesError(xhr) {
  // Punkt 7: Differentiate CQL syntax errors from other errors
  let errorMsg = "Error al cargar resultados";
  let errorType = "unknown";

  try {
    const response = JSON.parse(xhr.responseText);
    if (response.error === "invalid_cql") {
      errorType = "cql_syntax";
      errorMsg = `Sintaxis CQL inválida: ${response.message}`;
    } else if (response.error === "invalid_filter") {
      errorType = "filter_validation";
      errorMsg = `Filtro inválido: ${response.message}`;
    } else if (response.message) {
      errorMsg = response.message;
    }
  } catch (e) {
    // Not JSON, use HTTP status
    if (xhr.status === 400) {
      errorMsg = "Consulta inválida. Verifica la sintaxis CQL.";
    } else if (xhr.status >= 500) {
      errorMsg = "Error del servidor. Por favor, intenta más tarde.";
    }
  }

  console.error(`[ERROR] ${errorType}: ${errorMsg}`);

  // Display error message in results section
  const resultsSection = document.getElementById("results-section");
  if (resultsSection) {
    // Remove any existing error messages
    const existingErrors = resultsSection.querySelectorAll(".md3-alert--error");
    existingErrors.forEach((el) => el.remove());

    const errorHtml = `<div class="md3-alert md3-alert--error" role="alert">
      <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
      <div class="md3-alert__message">
        <strong>Error:</strong> ${escapeHtml(errorMsg)}
      </div>
    </div>`;
    resultsSection.insertAdjacentHTML("afterbegin", errorHtml);
  }
}

/**
 * Update export button URLs with current query parameters
 * Includes timestamp in download filename
 */
export function updateExportButtons(queryParams) {
  const csvBtn = document.getElementById("export-csv");
  const tsvBtn = document.getElementById("export-tsv");

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

  if (csvBtn) {
    const csvParams = new URLSearchParams(queryParams);
    csvParams.set("format", "csv");
    csvBtn.href = `/search/advanced/export?${csvParams.toString()}`;
    csvBtn.download = `corapan_advanced_${timestamp}.csv`;
  }

  if (tsvBtn) {
    const tsvParams = new URLSearchParams(queryParams);
    tsvParams.set("format", "tsv");
    tsvBtn.href = `/search/advanced/export?${tsvParams.toString()}`;
    tsvBtn.download = `corapan_advanced_${timestamp}.tsv`;
  }

  console.log("[Export] Buttons updated");
}

/**
 * Update summary box with results info
 * Shows query, hit count + badge if server filters are active
 *
 * @param {Object} data - DataTables response data
 * @param {string} queryParams - Current query parameters
 * @param {boolean} initialLoad - Flag to indicate initial page load
 */
export function updateSummary(data, queryParams, initialLoad = false) {
  const summaryBox = document.getElementById("adv-summary");
  if (!summaryBox) return;

  // On initial load, clear summary and hide everything.
  if (initialLoad) {
    summaryBox.innerHTML = "";
    summaryBox.hidden = true;
    const subTabs = document.getElementById("search-sub-tabs");
    if (subTabs) {
      subTabs.style.display = "none";
      subTabs.classList.add("hidden");
    }
    const tableContainer = document.getElementById("datatable-container");
    if (tableContainer) {
      tableContainer.style.display = "none";
      tableContainer.classList.add("hidden");
    }
    console.log("[Summary] Initial load: summary and results hidden.");
    return;
  }

  const filtered = data.recordsFiltered || 0;
  const total = data.recordsTotal || 0;

  // Extract query from params
  const params = new URLSearchParams(queryParams);
  const query = params.get("q") || params.get("cql_raw") || "—";

  // Check if filters are active (any metadata filter set) - WITHOUT [] suffix
  const hasFilters =
    params.has("country_code") ||
    params.has("speaker_type") ||
    params.has("sex") ||
    params.has("speech_mode") ||
    params.has("discourse") ||
    params.get("include_regional") === "1";

  const filtersActive = hasFilters && filtered < total;

  // Build summary HTML
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
    <span class="md3-advanced__summary-count">${filtered.toLocaleString("es-ES")}</span>`;

  if (filtersActive) {
    const activeFilters = [];

    // Collect active filters for display
    if (params.get("include_regional") === "1") {
      activeFilters.push("Regional");
    }
    if (params.get("country_code")) {
      activeFilters.push(`País: ${params.get("country_code")}`);
    }
    if (params.get("speaker_type")) {
      activeFilters.push(`Tipo de hablante: ${params.get("speaker_type")}`);
    }
    if (params.get("sex")) {
      activeFilters.push(`Sexo: ${params.get("sex")}`);
    }
    if (params.get("speech_mode")) {
      activeFilters.push(`Modo de habla: ${params.get("speech_mode")}`);
    }
    if (params.get("discourse")) {
      activeFilters.push(`Discurso: ${params.get("discourse")}`);
    }

    html += ` <span class="md3-advanced__summary-separator">|</span> <span class="md3-advanced__summary-filters">${activeFilters.join(", ")}</span>`;
  }

  // Update summary box content
  summaryBox.innerHTML = html;
  summaryBox.hidden = false;

  console.log("[Summary] Updated:", { filtered, total, query, filtersActive });
}

/**
 * Destroy the advanced table instance
 */
export function destroyAdvancedTable() {
  if (advancedTable && $.fn.dataTable.isDataTable("#advanced-table")) {
    try {
      advancedTable.destroy();
      advancedTable = null;
      // Also clear the table body to remove old rows visually
      const tableBody = document.querySelector("#advanced-table tbody");
      if (tableBody) tableBody.innerHTML = "";
    } catch (e) {
      console.warn("[DataTables] Destroy error:", e);
    }
  }
}

function focusTokenResults() {
  const resultsSection = document.getElementById("token-results");
  if (resultsSection) {
    setTimeout(() => {
      resultsSection.focus();
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }
}
