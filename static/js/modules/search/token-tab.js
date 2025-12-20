// Token Tab (copied from corpus token-tab.js)
// NOTE: This file is a copy meant for 'search' pages that need token-tab behavior.

import {
  initTokenTable,
  reloadTokenTable,
  destroyTokenTable,
} from "./initTokenTable.js";

// For now, reuse the exact logic from corpus token-tab
// (full copy) - renamed to search/token-tab to avoid corpus folder dependency.

// ===========================
// State Management
// ===========================

let tokIds = [];

function normalizeTokId(str) {
  return str.trim().toLowerCase();
}
function isValidTokId(str) {
  return /^[0-9a-z]+$/i.test(str);
}
function shortenId(id) {
  return id.length <= 8 ? id : id.slice(0, 8) + "…";
}

function updateTokidHidden() {
  const hiddenInput = document.getElementById("tokid-hidden");
  if (hiddenInput) hiddenInput.value = tokIds.join(",");
}

function renderTokidChips() {
  const container = document.getElementById("tokid-chip-container");
  if (!container) return;
  container.innerHTML = "";
  const countLabel = document.createElement("span");
  countLabel.id = "tokid-count";
  countLabel.className = "md3-active-filters__label tokid-count";
  container.appendChild(countLabel);
  const itemsWrap = document.createElement("div");
  itemsWrap.id = "tokid-chip-items";
  itemsWrap.className = "md3-active-filters__chips tokid-chips-wrap";
  container.appendChild(itemsWrap);
  if (tokIds.length === 0)
    container.classList.add("tokid-chip-container--empty");
  else container.classList.remove("tokid-chip-container--empty");
  tokIds.forEach((id) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tokid-chip";
    chip.dataset.id = id;
    chip.title = id;
    // Show full token id (no shortening) per UX request
    chip.innerHTML = `<span class="tokid-chip__label">${id}</span><span class="tokid-chip__trailing" role="button" aria-label="Entfernen" tabindex="0">×</span>`;
    itemsWrap.appendChild(chip);
  });
  updateTokenCount();
}
function updateTokenCount() {
  const el = document.getElementById("tokid-count");
  if (el) el.textContent = `IDs: ${tokIds.length}`;
}
function addTokidFromInput() {
  const input = document.getElementById("tokid-input");
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  const parts = raw
    .split(/[,;]|\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  let changed = false;
  for (let p of parts) {
    const norm = normalizeTokId(p);
    if (!isValidTokId(norm)) {
      console.warn(`Invalid Token: ${p}`);
      continue;
    }
    if (!tokIds.includes(norm)) {
      tokIds.push(norm);
      changed = true;
    }
  }
  if (changed) {
    updateTokidHidden();
    renderTokidChips();
    reloadTokenDataTable();
  }
  input.value = "";
}
function removeTokid(id) {
  const idx = tokIds.indexOf(id);
  if (idx > -1) {
    tokIds.splice(idx, 1);
    updateTokidHidden();
    renderTokidChips();
    reloadTokenDataTable();
  }
}
function clearAllTokens() {
  tokIds = [];
  updateTokidHidden();
  renderTokidChips();
  destroyTokenTable();
  const res = document.getElementById("token-results");
  if (res) res.style.display = "none";
}
function reloadTokenDataTable() {
  if (tokIds.length === 0) {
    console.warn("[Token] No token IDs to reload");
    return;
  }
  reloadTokenTable(tokIds);
}
function initializeTokenDataTable() {
  if (tokIds.length === 0) {
    alert("Por favor, introduzca al menos un Token-ID");
    return;
  }
  const tableElement = document.getElementById("token-results-table");
  if (!tableElement) {
    console.error("[Token] Table element #token-results-table not found");
    return;
  }
  initTokenTable(tokIds);
  const resultsSection = document.getElementById("token-results");
  if (resultsSection) {
    resultsSection.classList.remove("hidden");
    resultsSection.style.display = "block";
  }
}
function initializeEventHandlers() {
  const addBtn = document.getElementById("tokid-add-btn");
  if (addBtn) addBtn.addEventListener("click", addTokidFromInput);
  const input = document.getElementById("tokid-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTokidFromInput();
      }
    });
  }
  const chipContainer = document.getElementById("tokid-chip-container");
  if (chipContainer) {
    chipContainer.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest(".tokid-chip__trailing");
      if (!deleteBtn) return;
      const chip = deleteBtn.closest(".tokid-chip");
      if (!chip) return;
      const id = chip.dataset.id;
      if (id) removeTokid(id);
    });
    chipContainer.addEventListener("keydown", (e) => {
      const deleteBtn = e.target.closest(".tokid-chip__trailing");
      if (!deleteBtn) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const chip = deleteBtn.closest(".tokid-chip");
      if (!chip) return;
      const id = chip.dataset.id;
      if (id) removeTokid(id);
    });
  }
  const searchBtn = document.getElementById("token-search-btn");
  if (searchBtn)
    searchBtn.addEventListener("click", () => initializeTokenDataTable());
  const clearBtn = document.getElementById("clear-tokens-btn");
  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      if (tokIds.length > 0) {
        if (confirm("¿Borrar todos los Token-IDs?")) clearAllTokens();
      }
    });
}
function initializeTokenTab() {
  console.log("🔧 Initializing Token Tab (copied for search):");
  initializeEventHandlers();
  renderTokidChips();
  initializeTokenSubTabs();
  console.log("✅ Token Tab initialized (search)");
}
function initializeTokenSubTabs() {
  const sub = document.getElementById("token-sub-tabs");
  if (!sub) return;
  const btnResult = sub.querySelector('[data-view="results"]');
  const btnStats = sub.querySelector('[data-view="stats"]');
  const panelResults = document.getElementById("token-panel-resultados");
  const panelStats = document.getElementById("token-panel-estadisticas");
  if (btnStats) {
    btnStats.setAttribute("aria-disabled", "true");
    btnStats.classList.remove("md3-stats-tab--active");
  }
  if (btnResult && panelResults) {
    btnResult.addEventListener("click", () => {
      if (btnStats) btnStats.classList.remove("md3-stats-tab--active");
      btnResult.classList.add("md3-stats-tab--active");
      if (panelResults) {
        panelResults.classList.add("md3-view-content--active");
        panelResults.removeAttribute("hidden");
      }
      if (panelStats) {
        panelStats.classList.remove("md3-view-content--active");
        panelStats.setAttribute("hidden", "");
      }
    });
  }
  if (btnStats && panelStats) {
    btnStats.addEventListener("click", () => {
      if (btnStats.getAttribute("aria-disabled") === "true") {
        panelStats.innerHTML = `<div class="md3-body-medium" style="padding: 1rem;">Estadísticas no implementadas todavía.</div>`;
        panelStats.classList.add("md3-view-content--active");
        panelStats.removeAttribute("hidden");
        setTimeout(() => {
          panelStats.classList.remove("md3-view-content--active");
          panelStats.setAttribute("hidden", "");
        }, 2000);
        return;
      }
      btnResult.classList.remove("md3-stats-tab--active");
      btnStats.classList.add("md3-stats-tab--active");
      if (panelResults)
        panelResults.classList.remove("md3-view-content--active");
      if (panelStats) panelStats.classList.add("md3-view-content--active");
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTokenTab);
} else {
  initializeTokenTab();
}

window.TokenTab = {
  addTokenIds: (ids) => {
    ids.forEach((id) => {
      const norm = normalizeTokId(id);
      if (isValidTokId(norm) && !tokIds.includes(norm)) tokIds.push(norm);
    });
    updateTokidHidden();
    renderTokidChips();
  },
  clearTokens: clearAllTokens,
  getTokenIds: () => [...tokIds],
};
