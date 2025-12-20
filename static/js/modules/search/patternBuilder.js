/**
 * Pattern Builder Module
 * Handles the visual CQL pattern builder interface
 *
 * Features:
 * - Token row management (add/remove)
 * - Distance rule configuration
 * - CQL generation from builder state
 * - Template application
 */

export class PatternBuilder {
  constructor() {
    this.tokenCounter = 1; // Start with token 1 (0-indexed in data, 1-indexed in display)
    this.tokens = [];
    this.distanceType = "consecutive";
    this.distanceMax = 1;
    this.templates = this.defineTemplates();

    this.init();
  }

  init() {
    // Bind add token button
    const addTokenBtn = document.getElementById("add-token-btn");
    if (addTokenBtn) {
      addTokenBtn.addEventListener("click", () => this.addToken());
    }

    // Bind distance type radio buttons
    document
      .querySelectorAll('input[name="distance_type"]')
      .forEach((radio) => {
        radio.addEventListener("change", (e) => {
          this.distanceType = e.target.value;
          this.updateDistanceField();
          this.updateCQLPreview();
        });
      });

    // Bind distance max input
    const distanceMaxInput = document.getElementById("distance-max");
    if (distanceMaxInput) {
      distanceMaxInput.addEventListener("input", () => {
        this.distanceMax = Math.max(
          0,
          Math.min(10, parseInt(distanceMaxInput.value) || 1),
        );
        distanceMaxInput.value = this.distanceMax;
        this.updateCQLPreview();
      });
    }

    // Bind template buttons
    document.querySelectorAll(".template-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const template = btn.dataset.template;
        this.applyTemplate(template);
      });
    });

    // Initialize first token from DOM
    this.initializeExistingTokens();

    // Bind query sync - REMOVED in favor of explicit sync on tab switch
    // this.bindQuerySync();
  }

  /**
   * Bind query input to first token value
   */
  bindQuerySync() {
    // Deprecated: Logic moved to searchMode.js
    return; 
    /*
    const queryInput = document.getElementById("q");
    const advancedToggle = document.getElementById("advanced-mode-toggle");
    
    if (queryInput) {
      // Sync on input
      queryInput.addEventListener("input", () => {
        this.syncQueryToFirstToken(queryInput.value);
      });
    }

    if (advancedToggle) {
      // Sync when opening advanced mode
      advancedToggle.addEventListener("click", () => {
        if (queryInput) {
           setTimeout(() => this.syncQueryToFirstToken(queryInput.value), 0);
        }
      });
    }
    */
  }

  /**
   * Sync query value to first token
   */
  syncQueryToFirstToken(value) {
    // Find the first token row (usually index 0)
    // We look for the first row in the container to be safe
    const tokensContainer = document.getElementById("pattern-tokens");
    if (!tokensContainer) return;
    
    const firstRow = tokensContainer.querySelector('.md3-token-row');
    if (!firstRow) return;

    const valueInput = firstRow.querySelector('.token-value-input');
    if (valueInput) {
      valueInput.value = value;
      this.updateCQLPreview();
    }
  }

  /**
   * Initialize tokens that already exist in DOM
   */
  initializeExistingTokens() {
    const tokenRows = document.querySelectorAll(".md3-token-row");
    tokenRows.forEach((row) => {
      const index = parseInt(row.dataset.tokenIndex);
      this.bindTokenRow(row, index);

      // Add to tokens array
      const tokenData = this.getTokenData(row, index);
      this.tokens.push(tokenData);
    });

    this.tokenCounter = this.tokens.length;
    this.updateRemoveButtons();
  }

  /**
   * Add a new token row
   */
  addToken() {
    const tokensContainer = document.getElementById("pattern-tokens");
    if (!tokensContainer) return;

    const tokenIndex = this.tokenCounter;
    const tokenNumber = tokenIndex + 1;

    const tokenRow = document.createElement("div");
    tokenRow.className = "md3-token-row";
    tokenRow.dataset.tokenIndex = tokenIndex;
    tokenRow.innerHTML = `
      <div class="md3-token-row__number">Token ${tokenNumber}</div>
      
      <div class="md3-outlined-textfield md3-outlined-textfield--compact">
        <select class="md3-outlined-textfield__input md3-outlined-textfield__input--select token-field-select">
          <option value="forma">Forma</option>
          <option value="lema">Lema</option>
          <option value="pos">Categoría gramatical (POS)</option>
        </select>
        <label class="md3-outlined-textfield__label md3-outlined-textfield__label--select">Campo</label>
        <div class="md3-outlined-textfield__outline">
          <div class="md3-outlined-textfield__outline-start"></div>
          <div class="md3-outlined-textfield__outline-notch"></div>
          <div class="md3-outlined-textfield__outline-end"></div>
        </div>
      </div>

      <div class="md3-outlined-textfield md3-outlined-textfield--compact">
        <select class="md3-outlined-textfield__input md3-outlined-textfield__input--select token-match-select">
          <option value="exact">es exactamente</option>
          <option value="contains">contiene</option>
          <option value="starts">empieza por</option>
          <option value="ends">termina en</option>
        </select>
        <label class="md3-outlined-textfield__label md3-outlined-textfield__label--select">Tipo</label>
        <div class="md3-outlined-textfield__outline">
          <div class="md3-outlined-textfield__outline-start"></div>
          <div class="md3-outlined-textfield__outline-notch"></div>
          <div class="md3-outlined-textfield__outline-end"></div>
        </div>
      </div>

      <div class="md3-outlined-textfield md3-outlined-textfield--flex">
        <input 
          type="text" 
          class="md3-outlined-textfield__input token-value-input" 
          placeholder=" ">
        <label class="md3-outlined-textfield__label">Valor</label>
        <div class="md3-outlined-textfield__outline">
          <div class="md3-outlined-textfield__outline-start"></div>
          <div class="md3-outlined-textfield__outline-notch"></div>
          <div class="md3-outlined-textfield__outline-end"></div>
        </div>
      </div>

      <button type="button" class="md3-icon-button token-remove-btn" title="Eliminar">
        <span class="material-symbols-rounded">close</span>
      </button>
    `;

    tokensContainer.appendChild(tokenRow);

    // Bind events for new row
    this.bindTokenRow(tokenRow, tokenIndex);

    // Add to tokens array
    const tokenData = this.getTokenData(tokenRow, tokenIndex);
    this.tokens.push(tokenData);

    this.tokenCounter++;
    this.updateRemoveButtons();
    this.updateCQLPreview();
  }

  /**
   * Bind events to a token row
   */
  bindTokenRow(row, index) {
    const removeBtn = row.querySelector(".token-remove-btn");
    const fieldSelect = row.querySelector(".token-field-select");
    const matchSelect = row.querySelector(".token-match-select");
    const valueInput = row.querySelector(".token-value-input");

    // Remove button
    if (removeBtn) {
      removeBtn.addEventListener("click", () => this.removeToken(index));
    }

    // Update CQL on changes
    [fieldSelect, matchSelect, valueInput].forEach((el) => {
      if (el) {
        el.addEventListener("change", () => this.updateCQLPreview());
        el.addEventListener("input", () => this.updateCQLPreview());
      }
    });
  }

  /**
   * Remove a token row
   */
  removeToken(index) {
    const tokenRow = document.querySelector(
      `.md3-token-row[data-token-index="${index}"]`,
    );
    if (tokenRow) {
      tokenRow.remove();
    }

    // Remove from tokens array
    this.tokens = this.tokens.filter((t) => t.index !== index);

    this.updateRemoveButtons();
    this.updateCQLPreview();
  }

  /**
   * Update remove button states (disable if only one token)
   */
  updateRemoveButtons() {
    const tokenRows = document.querySelectorAll(".md3-token-row");
    const removeButtons = document.querySelectorAll(".token-remove-btn");

    if (tokenRows.length === 1) {
      removeButtons.forEach((btn) => (btn.disabled = true));
    } else {
      removeButtons.forEach((btn) => (btn.disabled = false));
    }
  }

  /**
   * Update distance field visibility
   */
  updateDistanceField() {
    const distanceField = document.getElementById("distance-number-field");
    if (!distanceField) return;

    if (this.distanceType === "gap") {
      distanceField.removeAttribute("hidden");
    } else {
      distanceField.setAttribute("hidden", "");
    }
  }

  /**
   * Get token data from a row
   */
  getTokenData(row, index) {
    const fieldSelect = row.querySelector(".token-field-select");
    const matchSelect = row.querySelector(".token-match-select");
    const valueInput = row.querySelector(".token-value-input");

    return {
      index,
      field: fieldSelect ? fieldSelect.value : "forma",
      matchType: matchSelect ? matchSelect.value : "exact",
      value: valueInput ? valueInput.value.trim() : "",
    };
  }

  /**
   * Generate CQL from current builder state
   */
  generateCQL() {
    const tokenRows = document.querySelectorAll(".md3-token-row");
    if (tokenRows.length === 0) return "";

    const tokenBlocks = [];

    tokenRows.forEach((row) => {
      const index = parseInt(row.dataset.tokenIndex);
      const tokenData = this.getTokenData(row, index);

      if (!tokenData.value) {
        tokenBlocks.push("[]"); // Empty token
        return;
      }

      const cqlBlock = this.tokenToCQL(tokenData);
      tokenBlocks.push(cqlBlock);
    });

    // Apply distance rule
    if (this.distanceType === "consecutive") {
      return tokenBlocks.join(" ");
    } else {
      // Insert gap between tokens
      const gapPattern = `[]{0,${this.distanceMax}}`;
      return tokenBlocks.join(` ${gapPattern} `);
    }
  }

  /**
   * Convert token data to CQL
   */
  tokenToCQL(tokenData) {
    const { field, matchType, value } = tokenData;

    // Map field names
    const fieldMap = {
      forma: "word",
      lema: "lemma",
      pos: "pos",
      tense: "tense",
      mood: "mood",
      person: "person",
      number: "number",
      PastType: "PastType",
      FutureType: "FutureType",
    };

    const cqlField = fieldMap[field] || "word";
    let pattern = "";

    // Build pattern based on match type
    switch (matchType) {
      case "exact":
        pattern = `"${this.escapeCQL(value)}"`;
        break;
      case "contains":
        pattern = `".*${this.escapeCQL(value)}.*"`;
        break;
      case "starts":
        pattern = `"${this.escapeCQL(value)}.*"`;
        break;
      case "ends":
        pattern = `".*${this.escapeCQL(value)}"`;
        break;
      default:
        pattern = `"${this.escapeCQL(value)}"`;
    }

    return `[${cqlField}=${pattern}]`;
  }

  /**
   * Escape special characters for CQL
   */
  escapeCQL(str) {
    return str.replace(/["\\\[\]]/g, "\\$&");
  }

  /**
   * Update CQL preview textarea
   */
  updateCQLPreview() {
    const cqlPreview = document.getElementById("cql_query") || document.getElementById("cql-preview");
    if (!cqlPreview) return;

    // Only update if not manually edited
    const allowManualEdit = document.getElementById("cql_manual_edit") || document.getElementById("allow-manual-edit");
    if (
      allowManualEdit &&
      allowManualEdit.checked &&
      !cqlPreview.hasAttribute("readonly")
    ) {
      return; // Don't overwrite manual edits
    }

    const cql = this.generateCQL();
    cqlPreview.value = cql;
  }

  /**
   * Define template configurations
   */
  defineTemplates() {
    return {
      "verb-noun": {
        name: "Verbo + sustantivo",
        tokens: [
          { field: "pos", matchType: "starts", value: "V" },
          { field: "pos", matchType: "starts", value: "N" },
        ],
        distance: "consecutive",
      },
      "adj-noun": {
        name: "Adjetivo + sustantivo",
        tokens: [
          { field: "pos", matchType: "starts", value: "ADJ" },
          { field: "pos", matchType: "starts", value: "N" },
        ],
        distance: "consecutive",
      },
      "same-lemma": {
        name: "Dos palabras con el mismo lema",
        tokens: [
          { field: "lema", matchType: "exact", value: "ejemplo" },
          { field: "lema", matchType: "exact", value: "ejemplo" },
        ],
        distance: "gap",
        distanceMax: 3,
      },
    };
  }

  /**
   * Apply a template to the builder
   */
  applyTemplate(templateKey) {
    const template = this.templates[templateKey];
    if (!template) return;

    // Clear existing tokens
    const tokensContainer = document.getElementById("pattern-tokens");
    if (!tokensContainer) return;

    tokensContainer.innerHTML = "";
    this.tokens = [];
    this.tokenCounter = 0;

    // Add tokens from template
    template.tokens.forEach((tokenData, index) => {
      this.addToken();
      const row = document.querySelector(
        `.md3-token-row[data-token-index="${index}"]`,
      );
      if (row) {
        const fieldSelect = row.querySelector(".token-field-select");
        const matchSelect = row.querySelector(".token-match-select");
        const valueInput = row.querySelector(".token-value-input");

        if (fieldSelect) fieldSelect.value = tokenData.field;
        if (matchSelect) matchSelect.value = tokenData.matchType;
        if (valueInput) valueInput.value = tokenData.value;
      }
    });

    // Apply distance settings
    const distanceRadio = document.querySelector(
      `input[name="distance_type"][value="${template.distance}"]`,
    );
    if (distanceRadio) {
      distanceRadio.checked = true;
      this.distanceType = template.distance;
    }

    if (template.distanceMax !== undefined) {
      this.distanceMax = template.distanceMax;
      const distanceMaxInput = document.getElementById("distance-max");
      if (distanceMaxInput) {
        distanceMaxInput.value = template.distanceMax;
      }
    }

    this.updateDistanceField();
    this.updateCQLPreview();
  }

  /**
   * Reset the builder to initial state
   */
  reset() {
    const tokensContainer = document.getElementById("pattern-tokens");
    if (!tokensContainer) return;

    // Clear all tokens except the first one
    const tokenRows = document.querySelectorAll(".md3-token-row");
    tokenRows.forEach((row, index) => {
      if (index > 0) {
        row.remove();
      } else {
        // Reset first token
        const fieldSelect = row.querySelector(".token-field-select");
        const matchSelect = row.querySelector(".token-match-select");
        const valueInput = row.querySelector(".token-value-input");

        if (fieldSelect) fieldSelect.value = "forma";
        if (matchSelect) matchSelect.value = "exact";
        if (valueInput) valueInput.value = "";
      }
    });

    this.tokens = [];
    this.tokenCounter = 1;

    // Reset distance settings
    const consecutiveRadio = document.querySelector(
      'input[name="distance_type"][value="consecutive"]',
    );
    if (consecutiveRadio) {
      consecutiveRadio.checked = true;
      this.distanceType = "consecutive";
    }

    this.distanceMax = 1;
    const distanceMaxInput = document.getElementById("distance-max");
    if (distanceMaxInput) {
      distanceMaxInput.value = 1;
    }

    this.updateDistanceField();
    this.updateRemoveButtons();
    this.updateCQLPreview();
  }
}

// Auto-initialize
let patternBuilderInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  // Only initialize if expert area exists
  const expertArea = document.getElementById("expert-area");
  if (expertArea) {
    patternBuilderInstance = new PatternBuilder();
  }
});

export function getPatternBuilder() {
  return patternBuilderInstance;
}
