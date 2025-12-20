/**
 * Advanced Search Entry Point
 * Consolidates all initialization logic for the advanced search page.
 */

import { initTabs } from "./tabs.js";
import { initStatsTabAdvanced, cleanupStats } from "../stats/initStatsTabAdvanced.js";
import { initRegionalToggle } from "./regional-toggle.js";
import { initSearchMode } from "./searchMode.js";
import { SearchFilters } from "./filters.js";
import { CqlBuilder } from "./cqlBuilder.js";

// Import modules that have side-effects (auto-init) or are dependencies
import "./config.js";
import "./filters.js";
import "./searchUI.js";
import "../advanced/initTable.js";
import "../stats/renderBar.js";
import "./token-tab.js";
import "../advanced/index.js"; // This one auto-inits initAdvancedApp

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initStatsTabAdvanced();
    initRegionalToggle();
    initSearchMode();

    // Initialize filters for both forms
    const formSimple = document.getElementById('form-simple');
    const formAdvanced = document.getElementById('form-advanced');
    
    if (formSimple) new SearchFilters(formSimple);
    if (formAdvanced) new SearchFilters(formAdvanced);

    // Initialize CQL Builder
    new CqlBuilder();
});

window.addEventListener('beforeunload', cleanupStats);
