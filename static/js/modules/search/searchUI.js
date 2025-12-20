/**
 * Main Search UI Module
 * Coordinates all search UI components
 *
 * Features:
 * - Advanced mode toggle
 * - Manual CQL editing
 * - Form submission
 * - Sub-tabs switching
 * - Integration with filters and pattern builder
 */

import { getPatternBuilder } from "./patternBuilder.js";
import { getCqlBuilder } from "./cqlBuilder.js";
import {
  initAdvancedTable,
  destroyAdvancedTable,
} from "../advanced/initTable.js";
import { destroyTokenTable } from "./initTokenTable.js";
import { cleanupStats } from "../stats/initStatsTabAdvanced.js";
import { trackSearch } from "../analytics.js";

export class SearchUI {
  constructor() {
    this.advancedMode = false;
    this.manualCQLEdit = false;
    this.currentView = "results";

    this.init();
  }

  init() {
    // Bind advanced mode toggle
    this.bindAdvancedToggle();

    // Bind manual CQL edit checkbox
    this.bindManualEditToggle();

    // Bind form submission
    this.bindFormSubmit();

    // Bind reset button
    this.bindResetButton();

    // Bind sub-tabs
    this.bindSubTabs();

    // Bind CQL Guide Dialog
    this.bindCqlGuide();

    // Bind Tab Change
    this.bindTabChange();

    // Restore state from URL or SessionStorage
    this.restoreState();

    console.log("✅ Search UI initialized");
  }

  /**
   * Bind Tab Change to handle visibility of main results
   */
  bindTabChange() {
    document.addEventListener('tab:change', (e) => {
      const tab = e.detail.tab;
            // Show main results if they should be visible (e.g. if search was performed)
            // We check if search-sub-tabs was previously visible or if we have results
            // For now, we just remove 'hidden' if it was hidden by this logic.
            // But wait, 'hidden' class is used for initial state too.
            // We should only show if there are results.
            // Let's check if #datatable-container is visible or if we have a search.
            
            // Actually, simpler: just remove the 'hidden' class if it was added by us?
            // Or better: The main results visibility is managed by performSearch.
            // But if we switch to Token and back, we want to restore state.
            
            // If we have a search active (check URL or table), show sub-tabs.
            const hasResults = document.getElementById('datatable-container')?.classList.contains('hidden') === false 
                               || document.getElementById('adv-summary')?.hidden === false;
            
            // When returning from Token tab, try to restore previous search UI state
            const subTabs = document.getElementById('search-sub-tabs');
            const tableContainer = document.getElementById('datatable-container');
            const advSummary = document.getElementById('adv-summary');

            if (tab === 'token') {
              // Hide the main search sub-tabs and any search results when token tab is active.
              // We keep DataTables instances intact so data is persistent; we only hide the containers.
              if (subTabs) {
                subTabs.classList.add('hidden');
                subTabs.style.display = 'none';
              }

              // hide summary and results panels specifically
              const resultsPanel = document.getElementById('panel-resultados');
              const statsPanel = document.getElementById('panel-estadisticas');
              const tableContainer = document.getElementById('datatable-container');
              const advSummary = document.getElementById('adv-summary');

              if (resultsPanel) resultsPanel.setAttribute('hidden', '');
              if (statsPanel) statsPanel.setAttribute('hidden', '');
              if (tableContainer) {
                tableContainer.classList.add('hidden');
                tableContainer.style.display = 'none';
              }
              if (advSummary) advSummary.hidden = true;

              // When showing token tab, ensure token DataTable (if present) recalculates layout
              setTimeout(() => {
                try {
                  if (window.jQuery && $.fn.dataTable && $.fn.dataTable.isDataTable('#token-results-table')) {
                    const tdt = $('#token-results-table').DataTable();
                    if (tdt && tdt.columns) {
                      tdt.columns.adjust();
                      if (tdt.responsive) tdt.responsive.recalc();
                    }
                  }
                } catch (e) {
                  console.warn('[SearchUI] Could not adjust token results table on tab change:', e);
                }
              }, 120);
            } else {
              // Only unhide/search panels if there are previous results to show
              const lastSearch = sessionStorage.getItem('lastSearch');
              const advHasContent = advSummary && advSummary.innerHTML && advSummary.innerHTML.trim() !== '';

              // Determine whether sub-tabs should be visible. They should appear when
              // - we have lastSearch params (previous search performed), OR
              // - adv-summary has content, OR
              // - the table container / panels themselves are already visible.
              const resultsPanel = document.getElementById('panel-resultados');
              const statsPanel = document.getElementById('panel-estadisticas');
              const tableVisible = tableContainer && (tableContainer.classList.contains('hidden') === false && tableContainer.style.display !== 'none');
              const resultsPanelVisible = resultsPanel && !resultsPanel.hasAttribute('hidden');
              const statsPanelVisible = statsPanel && !statsPanel.hasAttribute('hidden');
              const shouldShowSubTabs = !!(lastSearch || advHasContent || tableVisible || resultsPanelVisible || statsPanelVisible);

              if (subTabs && shouldShowSubTabs) {
                subTabs.classList.remove('hidden');
                subTabs.style.display = '';
              }

              // restore visibility of main panels (do not destroy data) — only when we actually have a saved search

              if (resultsPanel) resultsPanel.removeAttribute('hidden');
              if (statsPanel) statsPanel.removeAttribute('hidden');
              if (tableContainer && (lastSearch || advHasContent || tableVisible)) {
                tableContainer.classList.remove('hidden');
                tableContainer.style.display = '';

                // Ensure DataTables reflows/adjusts after becoming visible
                setTimeout(() => {
                  try {
                    if (window.jQuery && $.fn.dataTable && $.fn.dataTable.isDataTable('#advanced-table')) {
                      const dt = $('#advanced-table').DataTable();
                      if (dt && dt.columns) {
                        dt.columns.adjust();
                        if (dt.responsive) dt.responsive.recalc();
                      }
                    }
                  } catch (e) {
                    console.warn('[SearchUI] Could not adjust advanced table on tab restore:', e);
                  }
                }, 120);
              }
              if (advSummary && advHasContent) advSummary.hidden = false;

              // Ensure there is an active sub-tab; if none found, default to 'Resultados'
              if (subTabs) {
                const active = subTabs.querySelector('.md3-stats-tab--active');
                if (!active) {
                  const defaultTab = subTabs.querySelector('[data-view="results"]');
                  if (defaultTab) {
                    defaultTab.classList.add('md3-stats-tab--active');
                    defaultTab.setAttribute('aria-selected', 'true');
                    // Hide/show corresponding panels
                    const targetId = defaultTab.getAttribute('aria-controls');
                    if (targetId) {
                      const target = document.getElementById(targetId);
                      if (target) target.removeAttribute('hidden');
                    }
                    const otherTab = subTabs.querySelector('[data-view="stats"]');
                    if (otherTab) otherTab.classList.remove('md3-stats-tab--active');
                  }
                }
              }
            }
            // NOTE: we intentionally DO NOT hide the main results when switching to the Token tab
            // This keeps the main DataTables/statistics persistent and independent from token results.

            // If the advanced table is present and was hidden, show it
            if (tableContainer) {
              if (tableContainer.classList.contains('hidden') || tableContainer.style.display === 'none') {
                // If we have a saved lastSearch params, restore previous view.
                // Prefer reusing an existing DataTable instance (preserve paging/sort state).
                const lastSearch = sessionStorage.getItem('lastSearch');
                if (lastSearch) {
                  try {
                    if (window.jQuery && $.fn.dataTable && $.fn.dataTable.isDataTable('#advanced-table')) {
                      // Table instance exists — keep it and just make it visible and reflow
                      tableContainer.classList.remove('hidden');
                      tableContainer.style.display = '';
                      setTimeout(() => {
                        try {
                          const dt = $('#advanced-table').DataTable();
                          if (dt && dt.columns) {
                            dt.columns.adjust();
                            if (dt.responsive) dt.responsive.recalc();
                          }
                        } catch (inner) {
                          console.warn('[SearchUI] Could not adjust advanced table on tab restore (existing instance):', inner);
                        }
                      }, 80);
                    } else {
                      // No instance found — initialize a new one from saved params
                      this.initResultsTable(lastSearch);
                    }
                  } catch (err) {
                    console.warn('[SearchUI] Could not re-init or show advanced table on tab restore:', err);
                  }
                } else {
                  tableContainer.classList.remove('hidden');
                  tableContainer.style.display = '';
                }
              }
            }

            // Ensure the adv-summary is visible if it contains content
            if (advSummary && advSummary.innerHTML && advSummary.innerHTML.trim() !== '') {
              advSummary.hidden = false;
            }

            // Restore the active subpanel (results|stats)
            if (subTabs) {
              const activeSubTab = subTabs.querySelector('.md3-stats-tab--active');
              if (activeSubTab) {
                const targetId = activeSubTab.getAttribute('aria-controls');
                if (targetId) {
                  const target = document.getElementById(targetId);
                  if (target) target.hidden = false;
                }
              }
            }
    });
  }

  /**
   * Restore state from URL or SessionStorage
   */
  restoreState() {
    const params = new URLSearchParams(window.location.search);

    // If URL has params, use them (and save to session)
    if (params.toString()) {
      sessionStorage.setItem("lastSearch", params.toString());
      this.restoreFormFromParams(params);
      // Trigger search
      this.performSearch(params);
    }
    // If URL is empty but session has params, restore them
    else {
      const lastSearch = sessionStorage.getItem("lastSearch");
      if (lastSearch) {
        const savedParams = new URLSearchParams(lastSearch);
        // Update URL without reloading
        const newUrl = `${window.location.pathname}?${savedParams.toString()}`;
        window.history.replaceState({ path: newUrl }, "", newUrl);

        this.restoreFormFromParams(savedParams);
        this.performSearch(savedParams);
      }
    }
  }

  /**
   * Restore form values from params
   */
  restoreFormFromParams(params) {
    const mode = params.get('mode');
    const sensitive = params.get("sensitive");
    const ignore = sensitive === "0";

    // Restore common checkboxes
    const ignoreSimple = document.getElementById('ignore-accents-simple');
    if (ignoreSimple) ignoreSimple.checked = ignore;
    
    const ignoreAdvanced = document.getElementById('ignore-accents-advanced');
    if (ignoreAdvanced) ignoreAdvanced.checked = ignore;

    const regional = params.get("include_regional") === "1" || params.get("include_regional") === "true";
    const regSimple = document.getElementById('include-regional-simple');
    if (regSimple) {
        regSimple.checked = regional;
        if (regional) regSimple.dispatchEvent(new Event("change"));
    }
    const regAdvanced = document.getElementById('include-regional-advanced');
    if (regAdvanced) {
        regAdvanced.checked = regional;
        if (regional) regAdvanced.dispatchEvent(new Event("change"));
    }

    if (mode === 'cql' || mode === 'advanced') {
      // Restore Advanced Form
      const cql = params.get('q'); // In advanced mode, q is CQL
      const cqlInput = document.getElementById('cql_query') || document.getElementById('cql-preview');
      if (cqlInput && cql) cqlInput.value = cql;

      // Restore manual edit checkbox
      const manualChecked = params.get('allow_manual_edit') || params.get('cql_manual_edit');
      const manualCheckbox = document.getElementById('cql_manual_edit') || document.getElementById('allow-manual-edit');
      if (manualCheckbox) {
        manualCheckbox.checked = !!manualChecked;
        // Delegate to builder if present
        const cqlBuilder = getCqlBuilder();
        if (cqlBuilder) cqlBuilder.toggleManualEdit(manualCheckbox.checked);
      }
        
        // Restore filters for Advanced
        const form = document.getElementById('form-advanced');
        if (form && form.searchFilters) {
            form.searchFilters.restoreFiltersFromParams(params);
        }
    } else {
        // Restore Simple Form
        const q = params.get('q');
        const qInput = document.getElementById('q');
        if (qInput && q) qInput.value = q;
        
        const type = params.get('search_type');
        const typeSelect = document.getElementById('search_type_simple');
        if (typeSelect && type) typeSelect.value = type;
        
        // Restore filters for Simple
        const form = document.getElementById('form-simple');
        if (form && form.searchFilters) {
            form.searchFilters.restoreFiltersFromParams(params);
        }
    }
  }

  /**
   * Bind advanced mode toggle
   */
  bindAdvancedToggle() {
    const toggleBtn = document.getElementById("advanced-mode-toggle");
    const expertArea = document.getElementById("expert-area");
    const icon = document.getElementById("advanced-mode-icon");

    if (!toggleBtn || !expertArea) return;

    toggleBtn.addEventListener("click", () => {
      this.advancedMode = !this.advancedMode;

      // Update UI
      toggleBtn.setAttribute("aria-expanded", this.advancedMode);
      if (this.advancedMode) {
        expertArea.removeAttribute("hidden");
        toggleBtn.classList.add("md3-button--filled-tonal");
        toggleBtn.classList.remove("md3-button--outlined");
        if (icon) icon.textContent = "expand_less";

        // Initialize pattern builder if not already done
        const patternBuilder = getPatternBuilder();
        if (patternBuilder) {
          patternBuilder.updateCQLPreview();
        }
      } else {
        expertArea.setAttribute("hidden", "");
        toggleBtn.classList.remove("md3-button--filled-tonal");
        toggleBtn.classList.add("md3-button--outlined");
        if (icon) icon.textContent = "expand_more";
      }
    });
  }

  /**
   * Bind manual CQL edit checkbox
   */
  bindManualEditToggle() {
    // support both old ids (allow-manual-edit / cql-preview) and new cql ids
    const checkbox = document.getElementById("cql_manual_edit") || document.getElementById("allow-manual-edit");
    const cqlField = document.getElementById("cql_query") || document.getElementById("cql-preview");
    const cqlWarning = document.getElementById("cql-warning");
    const cqlHint = document.getElementById("cql-hint");

    if (!checkbox || !cqlField || !cqlWarning) return;

    // If a CqlBuilder exists it already binds change events for the same checkbox.
    // Avoid double-binding the 'change' event when a builder is present.
    const potentialBuilder = typeof getCqlBuilder === 'function' ? getCqlBuilder() : null;
    if (!potentialBuilder) {
      checkbox.addEventListener("change", (e) => {
      this.manualCQLEdit = e.target.checked;

      // Prefer CqlBuilder instance when available
      let builder = null;
      try {
        builder = typeof getCqlBuilder === 'function' ? getCqlBuilder() : null;
      } catch (_) {
        // ignore
      }

      if (builder && typeof builder.toggleManualEdit === "function") {
        builder.toggleManualEdit(this.manualCQLEdit);
      } else {
        if (this.manualCQLEdit) {
          cqlField.removeAttribute("readonly");
          cqlWarning.removeAttribute("hidden");
          if (cqlHint) cqlHint.hidden = true;
        } else {
          cqlField.setAttribute("readonly", "");
          cqlWarning.setAttribute("hidden", "");
          if (cqlHint) cqlHint.hidden = false;

          // Try to regenerate from any existing pattern builder
          const patternBuilder = getPatternBuilder();
          if (patternBuilder && typeof patternBuilder.updateCQLPreview === "function") {
            patternBuilder.updateCQLPreview();
          }
        }
      }

      // If the user enables manual edit we should also reset the manual-modified flag
      if (!this.manualCQLEdit) {
        // reset manual-edited UI state
        if (builder && typeof builder.resetManualEdit === "function") {
          builder.resetManualEdit();
        }
      }
      });
    }

    // Track user edits to the textarea to set manualCqlModified
    // If a CQL builder instance is present it already registers its own input listener
    // so we avoid attaching a second handler which could cause duplicate behaviour.
    const existingBuilder = typeof getCqlBuilder === 'function' ? getCqlBuilder() : null;
    if (!existingBuilder) {
      cqlField.addEventListener("input", () => {
        // Mark manual edit from legacy path
        if (cqlField && cqlField.getAttribute('readonly') === null) {
          if (cqlWarning) cqlWarning.removeAttribute("hidden");
          if (cqlHint) cqlHint.hidden = true;
        }
      });
    }
  }

  /**
   * Bind form submission
   */
  bindFormSubmit() {
    const formSimple = document.getElementById("form-simple");
    const formAdvanced = document.getElementById("form-advanced");

    if (formSimple) {
      formSimple.addEventListener("submit", (e) => {
        e.preventDefault();
        const queryParams = this.buildQueryParams(formSimple, "simple");
        this.performSearch(queryParams);
      });
    }

    if (formAdvanced) {
      formAdvanced.addEventListener("submit", (e) => {
        e.preventDefault();
        const queryParams = this.buildQueryParams(formAdvanced, "advanced");
        this.performSearch(queryParams);
      });
    }
  }

  /**
   * Build query parameters from form
   */
  buildQueryParams(form, mode) {
    const formData = new FormData(form);
    const params = new URLSearchParams();

    // Handle Sensitivity (ignore_accents -> sensitive)
    const ignoreAccents = formData.get("ignore_accents");
    const sensitive = ignoreAccents ? "0" : "1";
    params.set("sensitive", sensitive);

    // Copy other filters directly
    for (const [key, value] of formData.entries()) {
        // Exclude fields we handle manually or don't want to send raw
        if (["ignore_accents", "q", "cql_query", "mode", "allow_manual_edit", "cql_manual_edit"].includes(key)) {
            continue;
        }
        // Exclude UI-only checkboxes
        if (key.endsWith('_ui')) continue;
        
        if (value) params.append(key, value);
    }

    if (mode === "simple") {
        params.set("q", formData.get("q") || "");
        const uiSearchType = formData.get("search_type") || "forma";
        params.set("search_type", uiSearchType);
        
        // Map Spanish to canonical backend modes
        if (uiSearchType === "lema") {
          params.set("mode", "lemma");
        } else if (uiSearchType === "forma") {
          params.set("mode", "forma");
        } else if (uiSearchType === "forma_exacta") {
          params.set("mode", "forma_exacta");
        } else {
          params.set("mode", "simple"); // Default fallback
        }
    } else if (mode === "advanced") {
        let cqlStr = formData.get("cql_query") || "";
        const manualEdit = formData.get("allow_manual_edit") || formData.get("cql_manual_edit"); 
        
        // Apply CQL transformation if insensitive and not manual edit
        if (sensitive === "0" && !manualEdit) {
             cqlStr = cqlStr.replace(/\bword=/g, "norm=");
        }
        
        params.set("q", cqlStr);
        params.set("mode", "cql");
    }

    console.log("[SearchUI] Built params:", Object.fromEntries(params));
    return params;
  }

  /**
   * Perform search with given parameters
   */
  async performSearch(queryParams) {
    // Track search event (anonymous counter only, no query content - Variante 3a)
    trackSearch();

    // Dispatch search start event
    document.dispatchEvent(new Event("search:start"));

    const resultsSection = document.getElementById("results-section");
    const summaryBox = document.getElementById("adv-summary");

    try {
      if (summaryBox) {
        summaryBox.hidden = false;
        // Reuse the full-width summary style so loading looks like Results summary
        // IMPORTANT: adv-summary already has class md3-advanced__summary, avoid nesting the same class inside it.
        summaryBox.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.75rem; min-height:60px; width:100%;">
            <span class="md3-advanced__summary-mode" style="font-weight:700; color:var(--md-sys-color-primary);">Cargando</span>
            <span class="md3-advanced__summary-separator">|</span>
            <span class="md3-advanced__summary-label">Consultando…</span>
            <div style="flex:1"></div>
            <div style="width:160px;">
              <div role="progressbar" class="md3-linear-progress md3-linear-progress--indeterminate" aria-label="Cargando resultados">
                <div class="md3-linear-progress__buffer"></div>
                <div class="md3-linear-progress__bar md3-linear-progress__primary-bar"><span class="md3-linear-progress__bar-inner"></span></div>
                <div class="md3-linear-progress__bar md3-linear-progress__secondary-bar"><span class="md3-linear-progress__bar-inner"></span></div>
              </div>
            </div>
          </div>
        `;
      }

      // Update URL with search params to allow persistence/bookmarks
      const newUrl = `${window.location.pathname}?${queryParams.toString()}`;
      window.history.pushState({ path: newUrl }, "", newUrl);

      // Save to session storage
      sessionStorage.setItem("lastSearch", queryParams.toString());

      // Call existing advanced search handler
      // This should integrate with initTable.js
      const response = await fetch(
        `/search/advanced/data?${queryParams.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Debug: if the server returned the generated CQL, log it
      if (data && data.cql_debug) {
        console.debug(
          "[SearchUI] Server CQL Debug:",
          data.cql_debug,
          "filter:",
          data.filter_debug || "",
        );
      }

      // Update summary
      if (summaryBox) {
        summaryBox.innerHTML = `
          <span>Resultados encontrados: ${data.recordsFiltered || 0}</span>
        `;
      }

      // Ensure UI container is visible (in case DataTables is initialized while hidden)
      const tableContainer = document.getElementById("datatable-container");
      if (tableContainer) {
        tableContainer.style.display = "";
        tableContainer.classList.remove("hidden");
      }
      const subTabs = document.getElementById("search-sub-tabs");
      if (subTabs) {
        subTabs.style.display = "";
        subTabs.classList.remove("hidden");
      }

      // Force switch to "Resultados" tab
      const resultsTab = document.getElementById("tab-resultados");
      if (resultsTab) {
        resultsTab.click();
      }

      // Initialize DataTable (this would call existing initTable logic)
      this.initResultsTable(queryParams.toString());

      // Dispatch search complete event
      document.dispatchEvent(new Event("search:complete"));

      console.log("✅ Search completed:", data.recordsFiltered, "results");
    } catch (error) {
      console.error("❌ Search error:", error);
      if (summaryBox) {
        summaryBox.innerHTML = `
          <span style="color: var(--md-sys-color-error);">
            Error: ${this.escapeHtml(error.message)}
          </span>
        `;
      }
    }
  }

  /**
   * Initialize results table (placeholder for integration with initTable.js)
   */
  initResultsTable(queryString) {
    // This should integrate with the existing advanced/initTable.js
    // For now, we'll just log
    console.log("[SearchUI] Would initialize table with query:", queryString);

    // Initialize DataTable with current query string
    try {
      initAdvancedTable(queryString);
    } catch (e) {
      console.error("[SearchUI] Could not init advanced table:", e);
    }
  }

  /**
   * Bind reset button
   */
  bindResetButton() {
    // Bind all reset buttons inside search forms (simple and advanced)
    const resetBtns = document.querySelectorAll('.reset-btn');
    if (!resetBtns || resetBtns.length === 0) return;

    resetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (confirm('¿Restablecer el formulario? Se borrarán todos los campos, filtros y resultados.')) {
          this.resetForm();
        }
      });
    });
  }

  /**
   * Reset entire form
   */
  resetForm() {
    // Reset basic query
    const queryInput = document.getElementById("q");
    const searchTypeSelect = document.getElementById("search_type");

    if (queryInput) queryInput.value = "";
    if (searchTypeSelect) searchTypeSelect.value = "forma";

    // Reset advanced filters
    const advancedInputs = document.querySelectorAll(
      "#advanced-search-options input, #advanced-search-options select",
    );
    advancedInputs.forEach((input) => {
      if (input.type === "checkbox" || input.type === "radio") {
        input.checked = false;
      } else if (input.tagName === "SELECT") {
        input.selectedIndex = -1;
      } else {
        input.value = "";
      }
    });

    // Reset expert mode
    const expertToggle = document.getElementById("expert-mode-toggle");
    if (expertToggle && expertToggle.checked) {
      expertToggle.click(); // Toggle off
    }

    // Clear results
    const resultsContainer = document.getElementById("results-container");
    if (resultsContainer) resultsContainer.innerHTML = "";

    const summaryBox = document.getElementById("search-summary");
    if (summaryBox) summaryBox.innerHTML = "";

    const advSummaryBox = document.getElementById("adv-summary");
    if (advSummaryBox) {
      advSummaryBox.innerHTML = "";
      advSummaryBox.hidden = true;
    }

    // Hide containers
    const tableContainer = document.getElementById("datatable-container");
    if (tableContainer) {
      tableContainer.style.display = "none";
      tableContainer.classList.add("hidden");
    }
    const subTabs = document.getElementById("search-sub-tabs");
    if (subTabs) {
      subTabs.style.display = "none";
      subTabs.classList.add("hidden");
    }

    // Hide stats panel explicitly
    const statsPanel = document.getElementById("panel-estadisticas");
    if (statsPanel) {
      statsPanel.hidden = true;
      statsPanel.classList.remove("md3-view-content--active");
    }

    // Destroy DataTable
    destroyAdvancedTable();

      // Destroy token DataTable if present and clear token UI
      try {
        destroyTokenTable();
      } catch (e) {
        // If token module not present, ignore
      }

      // Clear token chips and hidden values if TokenTab API exists
      if (window.TokenTab && typeof window.TokenTab.clearTokens === 'function') {
        window.TokenTab.clearTokens();
      }

      // Cleanup stats charts
      try {
        if (typeof cleanupStats === 'function') cleanupStats();
      } catch (e) {
        // ignore
      }

    this.manualCQLEdit = false;

    // Clear session storage lastSearch
    try { sessionStorage.removeItem('lastSearch'); } catch(e){}

    // Dispatch reset event for other modules (like stats)
    document.dispatchEvent(new Event("search:reset"));

    console.log("[SearchUI] Form reset");
  }

  /**
   * Bind sub-tabs (Resultados / Estadísticas)
   */
  bindSubTabs() {
    // Do not bind to token-sub-tabs in token-tab module; exclude them explicitly
    const tabs = document.querySelectorAll(
      ".md3-stats-tab:not(#token-sub-tabs .md3-stats-tab)",
    );

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const view = tab.dataset.view;
        this.switchView(view);
      });
    });
  }

  /**
   * Switch between sub-tab views
   */
  switchView(view) {
    this.currentView = view;

    // Update tab active states
    document.querySelectorAll(".md3-stats-tab").forEach((tab) => {
      if (tab.dataset.view === view) {
        tab.classList.add("md3-stats-tab--active");
        tab.setAttribute("aria-selected", "true");
      } else {
        tab.classList.remove("md3-stats-tab--active");
        tab.setAttribute("aria-selected", "false");
      }
    });

    // Update panel visibility
    const panelResultados = document.getElementById("panel-resultados");
    const panelEstadisticas = document.getElementById("panel-estadisticas");

    if (view === "results") {
      if (panelResultados) {
        panelResultados.classList.add("md3-view-content--active");
        panelResultados.removeAttribute("hidden");
      }
      if (panelEstadisticas) {
        panelEstadisticas.classList.remove("md3-view-content--active");
        panelEstadisticas.setAttribute("hidden", "");
      }
    } else if (view === "stats") {
      if (panelResultados) {
        panelResultados.classList.remove("md3-view-content--active");
        panelResultados.setAttribute("hidden", "");
      }
      if (panelEstadisticas) {
        panelEstadisticas.classList.add("md3-view-content--active");
        panelEstadisticas.removeAttribute("hidden");
      }
    }
  }

  /**
   * Show copy feedback on button
   */
  showCopyFeedback(button) {
    const originalText = button.innerHTML;
    button.innerHTML =
      '<span class="material-symbols-rounded">check</span> Copiado';
    setTimeout(() => {
      button.innerHTML = originalText;
    }, 2000);
  }

  /**
   * Fallback copy method using textarea and execCommand
   */
  copyViaFallback(text, button) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);

    try {
      textarea.select();
      const successful = document.execCommand("copy");
      if (successful) {
        this.showCopyFeedback(button);
      } else {
        console.warn(
          "[SearchUI] Fallback copy failed: execCommand returned false",
        );
      }
    } catch (err) {
      console.error("[SearchUI] Fallback copy error:", err);
    } finally {
      document.body.removeChild(textarea);
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
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
   * Bind CQL Guide Dialog
   */
  bindCqlGuide() {
    const link = document.getElementById("cql-guide-link");
    const overlay = document.getElementById("cql-guide-overlay");
    const dialog = document.getElementById("cql-guide-dialog");
    const closeBtn = document.getElementById("cql-guide-close");
    const copyBtn = document.getElementById("cql-guide-copy");
    const promptText = document.getElementById("cql-guide-prompt");

    if (!link || !overlay || !dialog) return;

    link.addEventListener("click", (e) => {
      e.preventDefault();
      overlay.classList.add("active");
      overlay.removeAttribute("aria-hidden");
      document.body.style.overflow = "hidden";
      dialog.focus();
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      });
    }

    if (copyBtn && promptText) {
      copyBtn.addEventListener("click", () => {
        // Get plain text from code block - trim whitespace
        const textToCopy = (
          promptText.innerText ||
          promptText.textContent ||
          ""
        ).trim();

        if (!textToCopy) {
          console.warn("[SearchUI] No text to copy");
          return;
        }

        // Always use fallback since it's more reliable in all contexts
        this.copyViaFallback(textToCopy, copyBtn);
      });
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("active")) {
        overlay.classList.remove("active");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      }
    });
  }
}

// Auto-initialize
let searchUIInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  const formSimple = document.getElementById("form-simple");
  const formAdvanced = document.getElementById("form-advanced");
  
  if (formSimple || formAdvanced) {
    searchUIInstance = new SearchUI();
  }
});

export function getSearchUI() {
  return searchUIInstance;
}
