/**
 * Advanced Search Module - Entry Point
 * Initializes the advanced search UI (SearchUI), DataTable, Token-Tab and Audio Manager
 */
import { SearchUI } from "../search/searchUI.js";
import { initAdvancedTable } from "./initTable.js";
import { AdvancedAudioManager } from "./audio.js";
import "../search/token-tab.js";

function initAdvancedApp() {
  console.log("[Advanced] Initializing Advanced Search UI");

  // Initialize SearchUI controller
  try {
    const searchUi = new SearchUI();
    // Bindings performed by constructor
  } catch (e) {
    console.error("[Advanced] SearchUI init error:", e);
  }

  // Initialize audio manager (shared from corpus module)
  try {
    const audio = new AdvancedAudioManager();
    audio.bindEvents();
  } catch (e) {
    console.warn("[Advanced] Could not initialize audio manager:", e);
  }

  // Initialize DataTable if present
  const advTable = document.getElementById("advanced-table");
  if (advTable) {
    // Build query string from URL and call init
    const params = new URLSearchParams(window.location.search);
    initAdvancedTable(params.toString());
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdvancedApp);
} else {
  initAdvancedApp();
}

export { initAdvancedApp };
