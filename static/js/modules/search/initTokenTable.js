/**
 * Token-Tab DataTables: copy of `corpus/initTokenTable.js` for search pages
 */
import {
  makeBaseConfig,
  escapeHtml,
  renderAudioButtons,
  renderFileLink,
} from "../advanced/datatableFactory.js";
let tokenTable = null;
let currentTokenIds = [];

export function initTokenTable(tokenIds) {
  if (typeof window.$ === "undefined" || typeof window.jQuery === "undefined") {
    console.error("[Token] jQuery not available, cannot initialize DataTables");
    return;
  }
  if (typeof $.fn.dataTable === "undefined") {
    console.error("[Token] DataTables plugin not available");
    return;
  }
  currentTokenIds = tokenIds;
  if (tokenTable && $.fn.dataTable.isDataTable("#token-results-table")) {
    try {
      tokenTable.destroy();
      tokenTable = null;
    } catch (e) {
      console.warn("[Token DataTables] Destroy error:", e);
    }
  }
  const requestBody = { token_ids_raw: tokenIds.join(","), context_size: 40 };
  const baseConfig = makeBaseConfig();
  const config = Object.assign({}, baseConfig, {
    ajax: {
      url: "/search/advanced/token/search",
      type: "POST",
      contentType: "application/json",
      data: function (d) {
        return JSON.stringify({
          draw: d.draw,
          start: d.start,
          length: d.length,
          order: d.order,
          ...requestBody,
        });
      },
      error: function (xhr, error, thrown) {
        console.error("[Token] AJAX error:", xhr.status, error);
        handleTokenDataTablesError(xhr);
      },
      dataSrc: function (json) {
        if (json && json.error) {
          handleTokenBackendError(json);
          return [];
        }
        updateTokenSummary(json, tokenIds);
        updateTokenExportButtons(tokenIds);
        focusTokenResults();
        return json.data || [];
      },
    },
    scrollX: false,
    scrollCollapse: false,
  });
  tokenTable = $("#token-results-table").DataTable(config);
  setTimeout(() => {
    try {
      if (tokenTable && tokenTable.columns) {
        tokenTable.columns.adjust();
        if (tokenTable.responsive) tokenTable.responsive.recalc();
      }
    } catch (e) {
      console.warn("[Token] Column adjust error:", e);
    }
  }, 100);
  $(window).on("resize.tokenTable", () => {
    try {
      if (tokenTable && tokenTable.columns) {
        tokenTable.columns.adjust();
        if (tokenTable.responsive) tokenTable.responsive.recalc();
      }
    } catch (e) {
      console.warn("[Token] Column adjust error on resize:", e);
    }
  });
}
export function reloadTokenTable(tokenIds) {
  initTokenTable(tokenIds);
}
export function destroyTokenTable() {
  if (tokenTable && $.fn.dataTable.isDataTable("#token-results-table")) {
    tokenTable.destroy();
    tokenTable = null;
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
function handleTokenDataTablesError(xhr) {
  const errorMsg = `DataTables Error: HTTP ${xhr.status}`;
  console.error("[Token]", errorMsg);
  alert(`Error loading results: ${errorMsg}`);
}
function handleTokenBackendError(json) {
  const errorCode = json.error || "unknown_error";
  const errorMessage =
    json.message || "An error occurred in the search backend";
  console.error(`[Token Backend Error] ${errorCode}: ${errorMessage}`);
  alert(`Backend Error: ${errorMessage}`);
}
function updateTokenSummary(json, tokenIds) {
  console.log("[Token Summary] Updated with:", json.recordsFiltered, "results");
}
function updateTokenExportButtons(tokenIds) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const tokIdStr = tokenIds.join("_").substring(0, 16);
  console.log("[Token Export] Buttons updated");
}
