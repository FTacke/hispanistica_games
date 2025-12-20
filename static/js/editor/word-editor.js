/**
 * WordEditor - Handles inline word editing with change tracking
 *
 * Features:
 * - Click-to-edit words
 * - Enter to save, ESC to cancel
 * - Tracks changes in editHistory Map
 * - Visual feedback (yellow=editing, green=modified)
 * - Prevents editing timestamps/token_id
 */

export class WordEditor {
  constructor(transcriptData, config) {
    this.data = transcriptData;
    this.config = config;
    this.editHistory = new Map(); // token_id -> {original, modified, segmentIndex, wordIndex}
    this.undoStack = []; // Array of action objects for undo
    this.redoStack = []; // Array of action objects for redo
    this.maxUndoActions = 10; // Limit to last 10 actions
    this.currentlyEditingElement = null;
    this.originalValue = null;
    this.transcription = null;

    // Store original speaker codes for change detection
    this.originalSpeakers = {};
    this.data.segments?.forEach((seg, idx) => {
      this.originalSpeakers[idx] = seg.speaker_code || seg.speaker;
    });

    this.initializeUI();
  }

  /**
   * Attach to transcription manager
   */
  attachToTranscription(transcription) {
    this.transcription = transcription;
    console.log("[WordEditor] Attached to transcription manager");
  }

  /**
   * Initialize UI elements
   */
  initializeUI() {
    this.saveBtn = document.getElementById("save-btn");
    this.discardBtn = document.getElementById("discard-btn");
    this.cancelEditBtn = document.getElementById("cancel-edit-btn");
    this.undoBtn = document.getElementById("undo-btn");
    this.redoBtn = document.getElementById("redo-btn");
    this.modifiedCountEl = document.getElementById("modified-count");
    this.saveIndicator = document.getElementById("save-indicator");
    this.wordEditInfo = document.getElementById("word-edit-info");
    this.currentWordDisplay = document.getElementById("current-word");

    // Button handlers
    this.saveBtn?.addEventListener("click", () => this.saveAllChanges());
    this.discardBtn?.addEventListener("click", () => this.discardAllChanges());
    this.cancelEditBtn?.addEventListener("click", () =>
      this.cancelCurrentEdit(),
    );
    this.undoBtn?.addEventListener("click", () => this.undo());
    this.redoBtn?.addEventListener("click", () => this.redo());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Enter to finish editing
      if (e.key === "Enter" && this.currentlyEditingElement) {
        e.preventDefault();
        this.finishEditing();
      }
      // ESC to cancel editing
      if (e.key === "Escape" && this.currentlyEditingElement) {
        e.preventDefault();
        this.cancelCurrentEdit();
      }
      // CTRL+Z for undo (when not editing)
      if (e.ctrlKey && e.key === "z" && !this.currentlyEditingElement) {
        e.preventDefault();
        this.undo();
      }
      // CTRL+Y or CTRL+Shift+Z for redo (when not editing)
      if (
        (e.ctrlKey && e.key === "y") ||
        (e.ctrlKey && e.shiftKey && e.key === "Z")
      ) {
        if (!this.currentlyEditingElement) {
          e.preventDefault();
          this.redo();
        }
      }
    });

    this.updateUndoRedoButtons();
  }

  /**
   * Attach event listeners to word elements
   */
  attachEventListeners() {
    const transcriptContainer = document.getElementById("transcript-content");

    // Delegate click events to word spans
    transcriptContainer.addEventListener("click", (e) => {
      const wordSpan = e.target.closest(".word");
      if (wordSpan && !wordSpan.classList.contains("editing")) {
        this.startEditing(wordSpan);
      }
    });

    // Global keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (this.currentlyEditingElement) {
        if (e.key === "Enter") {
          e.preventDefault();
          this.finishEditing();
        } else if (e.key === "Escape") {
          e.preventDefault();
          this.cancelCurrentEdit();
        }
      }
    });
  }

  /**
   * Start editing a word
   */
  startEditing(wordSpan) {
    // Cancel any ongoing edit
    if (this.currentlyEditingElement) {
      this.cancelCurrentEdit();
    }

    this.currentlyEditingElement = wordSpan;
    this.originalValue = wordSpan.textContent;

    // Visual state
    wordSpan.classList.add("editing");
    wordSpan.contentEditable = "true";
    wordSpan.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(wordSpan);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Update UI
    this.wordEditInfo.classList.remove("hidden");
    this.currentWordDisplay.textContent = this.originalValue;

    console.log(`[Editor] Started editing: "${this.originalValue}"`);
  }

  /**
   * Finish editing and save change
   */
  finishEditing() {
    if (!this.currentlyEditingElement) return;

    const wordSpan = this.currentlyEditingElement;
    const newValue = wordSpan.textContent.trim();
    const tokenId = wordSpan.dataset.tokenId;

    // Extract segment and word indices from groupIndex (format: "segmentIndex-groupIndex")
    const groupIndex = wordSpan.dataset.groupIndex;
    if (!groupIndex) {
      console.error("[Editor] No groupIndex found in word element");
      this.cancelCurrentEdit();
      return;
    }

    const [segmentIndexStr, _] = groupIndex.split("-");
    const segmentIndex = parseInt(segmentIndexStr);

    // Find word index within segment by matching token_id
    let wordIndex = -1;
    const segment = this.data.segments[segmentIndex];
    if (segment && segment.words) {
      wordIndex = segment.words.findIndex((w) => w.token_id === tokenId);
    }

    console.log(
      `[Editor] finishEditing - segmentIndex: ${segmentIndex}, wordIndex: ${wordIndex}, tokenId: ${tokenId}`,
    );

    // Validate
    if (segmentIndex < 0 || wordIndex < 0) {
      console.error("[Editor] Could not determine segment/word indices");
      this.cancelCurrentEdit();
      return;
    }

    // Validate: not empty
    if (!newValue) {
      alert("Word darf nicht leer sein!");
      wordSpan.textContent = this.originalValue;
      this.cancelCurrentEdit();
      return;
    }

    // Check if actually changed
    if (newValue !== this.originalValue) {
      // Get the original value from history (if exists) or use current original
      const existingChange = this.editHistory.get(tokenId);
      const veryOriginalValue = existingChange
        ? existingChange.original
        : this.originalValue;

      // Record action for undo (6 parameters: tokenId, segIdx, wordIdx, oldVal, newVal, origVal)
      this._recordAction(
        tokenId,
        segmentIndex,
        wordIndex,
        this.originalValue, // old value (before this edit)
        newValue, // new value (after this edit)
        veryOriginalValue, // original value (before any edits)
      );

      // Track change in history
      this.editHistory.set(tokenId, {
        original: veryOriginalValue,
        modified: newValue,
        segmentIndex,
        wordIndex,
        tokenId,
      });

      // Update underlying data (JSON uses "text" not "word")
      const wordObj = this.data.segments[segmentIndex].words[wordIndex];
      if ("text" in wordObj) {
        wordObj.text = newValue;
      } else {
        wordObj.word = newValue;
      }

      // Visual feedback - grüne Markierung
      wordSpan.classList.add("modified-word");

      console.log(`[Editor] Changed "${this.originalValue}" -> "${newValue}"`);

      this.updateUI();
    }

    // Cleanup
    wordSpan.classList.remove("editing");
    wordSpan.contentEditable = "false";
    this.currentlyEditingElement = null;
    this.originalValue = null;
    this.wordEditInfo.classList.add("hidden");
  }

  /**
   * Cancel current edit
   */
  cancelCurrentEdit() {
    if (!this.currentlyEditingElement) return;

    const wordSpan = this.currentlyEditingElement;

    // Restore original value
    wordSpan.textContent = this.originalValue;
    wordSpan.classList.remove("editing");
    wordSpan.contentEditable = "false";

    this.currentlyEditingElement = null;
    this.originalValue = null;
    this.wordEditInfo.classList.add("hidden");

    console.log("[Editor] Edit cancelled");
  }

  /**
   * Discard all changes
   */
  discardAllChanges() {
    const totalChanges = this.getTotalChanges();
    if (totalChanges === 0) return;

    if (!confirm(`${totalChanges} Änderungen verwerfen?`)) {
      return;
    }

    // Restore original word values
    this.editHistory.forEach((change, tokenId) => {
      // Find word element by token_id: prefer original case (data-token-id) then fallback to lowercased attribute
      const escaped = CSS.escape(String(tokenId || "").trim());
      const escapedLower = CSS.escape(
        String(tokenId || "")
          .trim()
          .toLowerCase(),
      );
      let wordSpan = document.querySelector(`[data-token-id="${escaped}"]`);
      if (!wordSpan)
        wordSpan = document.querySelector(
          `[data-token-id-lower="${escapedLower}"]`,
        );
      if (wordSpan) {
        wordSpan.textContent = change.original;
        wordSpan.classList.remove("modified-word");
      }

      // Restore in data (JSON uses "text" not "word")
      const wordObj =
        this.data.segments[change.segmentIndex].words[change.wordIndex];
      if ("text" in wordObj) {
        wordObj.text = change.original;
      } else {
        wordObj.word = change.original;
      }
    });

    // Restore original speaker codes
    this.undoStack.forEach((action) => {
      if (action.type === "speaker_change") {
        const { segmentIndex, oldValue } = action;
        this.data.segments[segmentIndex].speaker_code = oldValue;
        // Remove old speaker field if it exists
        if ("speaker" in this.data.segments[segmentIndex]) {
          delete this.data.segments[segmentIndex].speaker;
        }

        // Restore original speakers map
        this.originalSpeakers[segmentIndex] = oldValue;

        // Update UI
        this._updateSpeakerDisplay(segmentIndex, oldValue);
      }
    });

    // Clear all change tracking
    this.editHistory.clear();
    this.undoStack = [];
    this.redoStack = [];

    // Remove all modified classes
    document.querySelectorAll(".word.modified").forEach((el) => {
      el.classList.remove("modified-word");
    });
    document
      .querySelectorAll(".speaker-name.modified-speaker")
      .forEach((el) => {
        el.classList.remove("modified-speaker");
      });

    this.updateUI();

    console.log("[Editor] All changes discarded");
  }

  /**
   * Save all changes to backend
   */
  async saveAllChanges() {
    const totalChanges = this.getTotalChanges();
    if (totalChanges === 0) return;

    this.saveBtn.disabled = true;
    this.saveIndicator.innerHTML =
      '<i class="bi bi-hourglass-split"></i> Speichert...';
    this.saveIndicator.className = "status-badge status-saving";

    try {
      // Prepare changes payload (word changes only for changes array)
      const changes = Array.from(this.editHistory.values()).map((change) => ({
        token_id: change.tokenId,
        segment_index: change.segmentIndex,
        word_index: change.wordIndex,
        old_value: change.original,
        new_value: change.modified,
      }));

      // Add speaker changes from undoStack (speaker_code is used directly)
      const speakerChanges = this.undoStack.filter(
        (action) => action.type === "speaker_change",
      );
      speakerChanges.forEach((action) => {
        changes.push({
          type: "speaker_change",
          segment_index: action.segmentIndex,
          old_value: action.oldValue,
          new_value: action.newValue,
        });
      });

      const response = await fetch(this.config.apiEndpoints.saveEdits, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: this.config.transcriptFile,
          changes: changes,
          transcript_data: this.data, // Full updated transcript (includes speaker changes)
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Save failed");
      }

      const result = await response.json();

      // Clear edit history and remove visual markers
      this.editHistory.forEach((change, tokenId) => {
        const escaped = CSS.escape(String(tokenId || "").trim());
        const escapedLower = CSS.escape(
          String(tokenId || "")
            .trim()
            .toLowerCase(),
        );
        let wordSpan = document.querySelector(`[data-token-id="${escaped}"]`);
        if (!wordSpan)
          wordSpan = document.querySelector(
            `[data-token-id-lower="${escapedLower}"]`,
          );
        if (wordSpan) {
          wordSpan.classList.remove("modified-word");
        }
      });

      this.editHistory.clear();

      // Clear undo/redo stacks (changes have been saved)
      this.undoStack = [];
      this.redoStack = [];

      // Reset original speakers to current state
      this.data.segments?.forEach((seg, idx) => {
        this.originalSpeakers[idx] = seg.speaker_code || seg.speaker;
      });

      // Remove modified-speaker classes
      document.querySelectorAll(".speaker-name").forEach((el) => {
        el.classList.remove("modified-speaker");
      });

      this.saveIndicator.innerHTML =
        '<i class="bi bi-check-circle"></i> Gespeichert';
      this.saveIndicator.className =
        "md3-editor-status-badge md3-editor-status-saved";

      console.log("[Editor] Changes saved:", result);

      this.updateUI();
    } catch (error) {
      console.error("[Editor] Save failed:", error);

      this.saveIndicator.innerHTML =
        '<i class="bi bi-exclamation-triangle"></i> Fehler';
      this.saveIndicator.className =
        "md3-editor-status-badge md3-editor-status-error";

      alert(`Speichern fehlgeschlagen: ${error.message}`);
    } finally {
      this.saveBtn.disabled = false;
    }
  }

  /**
   * Update UI elements based on current state
   */
  /**
   * Count total number of changes (word + speaker)
   */
  getTotalChanges() {
    // Count word changes from editHistory
    let totalChanges = this.editHistory.size;

    // Count speaker changes from undoStack
    const speakerChanges = this.undoStack.filter(
      (a) => a.type === "speaker_change",
    ).length;
    totalChanges += speakerChanges;

    return totalChanges;
  }

  updateUI() {
    const totalChanges = this.getTotalChanges();
    const hasChanges = totalChanges > 0;

    this.saveBtn.disabled = !hasChanges;
    this.discardBtn.disabled = !hasChanges;
    this.modifiedCountEl.textContent = totalChanges;

    if (hasChanges) {
      this.saveIndicator.innerHTML =
        '<i class="bi bi-exclamation-circle"></i> Ungespeichert';
      this.saveIndicator.className =
        "md3-editor-status-badge md3-editor-status-unsaved";
    } else {
      this.saveIndicator.innerHTML =
        '<i class="bi bi-check-circle"></i> Gespeichert';
      this.saveIndicator.className =
        "md3-editor-status-badge md3-editor-status-saved";
    }

    this.updateUndoRedoButtons();
  }

  /**
   * Update undo/redo button states
   */
  updateUndoRedoButtons() {
    if (this.undoBtn) {
      this.undoBtn.disabled = this.undoStack.length === 0;
    }
    if (this.redoBtn) {
      this.redoBtn.disabled = this.redoStack.length === 0;
    }
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.undoStack.length === 0) {
      console.log("[Editor] Nothing to undo");
      return;
    }

    const action = this.undoStack.pop();
    console.log("[Editor] Undoing action:", action);

    // Apply undo
    this._applyAction(action, true);

    // Move to redo stack
    this.redoStack.push(action);

    // Limit redo stack size
    if (this.redoStack.length > this.maxUndoActions) {
      this.redoStack.shift();
    }

    this.updateUI();
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.redoStack.length === 0) {
      console.log("[Editor] Nothing to redo");
      return;
    }

    const action = this.redoStack.pop();
    console.log("[Editor] Redoing action:", action);

    // Apply redo (inverse of undo)
    this._applyAction(action, false);

    // Move back to undo stack
    this.undoStack.push(action);

    this.updateUI();
  }

  /**
   * Apply an action (for undo/redo)
   * @param {Object} action - The action to apply
   * @param {boolean} isUndo - True if undoing, false if redoing
   * @private
   */
  _applyAction(action, isUndo) {
    // Handle speaker changes
    if (action.type === "speaker_change") {
      const { segmentIndex, oldValue, newValue } = action;
      const valueToApply = isUndo ? oldValue : newValue;

      // Update data (use speaker_code)
      this.data.segments[segmentIndex].speaker_code = valueToApply;
      // Remove old speaker field if it exists
      if ("speaker" in this.data.segments[segmentIndex]) {
        delete this.data.segments[segmentIndex].speaker;
      }

      // Update UI
      this._updateSpeakerDisplay(segmentIndex, valueToApply);

      console.log(
        `[Editor] Applied speaker change via undo/redo for segment ${segmentIndex}`,
      );
      return;
    }

    // Handle word changes
    const { tokenId, segmentIndex, wordIndex, oldValue, newValue } = action;
    const valueToApply = isUndo ? oldValue : newValue;

    // Find word element
    const escaped = CSS.escape(String(tokenId || "").trim());
    const escapedLower = CSS.escape(
      String(tokenId || "")
        .trim()
        .toLowerCase(),
    );
    let wordSpan = document.querySelector(`[data-token-id="${escaped}"]`);
    if (!wordSpan)
      wordSpan = document.querySelector(
        `[data-token-id-lower="${escapedLower}"]`,
      );
    if (!wordSpan) {
      console.warn("[Editor] Word element not found for undo/redo:", tokenId);
      return;
    }

    // Update DOM
    wordSpan.textContent = valueToApply;

    // Update data
    const wordObj = this.data.segments[segmentIndex].words[wordIndex];
    if ("text" in wordObj) {
      wordObj.text = valueToApply;
    } else {
      wordObj.word = valueToApply;
    }

    // Update edit history
    if (isUndo) {
      // If undoing and value matches original, remove from history
      if (valueToApply === action.originalValue) {
        this.editHistory.delete(tokenId);
        wordSpan.classList.remove("modified-word");
      } else {
        // Update history entry
        const historyEntry = this.editHistory.get(tokenId);
        if (historyEntry) {
          historyEntry.modified = valueToApply;
        }
        wordSpan.classList.add("modified");
      }
    } else {
      // Redoing - add/update history
      if (valueToApply !== action.originalValue) {
        this.editHistory.set(tokenId, {
          original: action.originalValue,
          modified: valueToApply,
          segmentIndex,
          wordIndex,
          tokenId,
        });
        wordSpan.classList.add("modified");
      } else {
        this.editHistory.delete(tokenId);
        wordSpan.classList.remove("modified-word");
      }
    }
  }

  /**
   * Record an action for undo
   * @param {string} tokenId
   * @param {number} segmentIndex
   * @param {number} wordIndex
   * @param {string} oldValue
   * @param {string} newValue
   * @param {string} originalValue - The very first value before any edits
   * @private
   */
  _recordAction(
    tokenId,
    segmentIndex,
    wordIndex,
    oldValue,
    newValue,
    originalValue,
  ) {
    const action = {
      tokenId,
      segmentIndex,
      wordIndex,
      oldValue,
      newValue,
      originalValue,
      timestamp: Date.now(),
    };

    this.undoStack.push(action);

    // Limit undo stack size
    if (this.undoStack.length > this.maxUndoActions) {
      this.undoStack.shift();
    }

    // Clear redo stack when new action is performed
    this.redoStack = [];

    console.log("[Editor] Action recorded:", action);
  }

  /**
   * Get current edit statistics
   */
  getStats() {
    return {
      totalChanges: this.editHistory.size,
      isEditing: !!this.currentlyEditingElement,
      undoAvailable: this.undoStack.length,
      redoAvailable: this.redoStack.length,
    };
  }

  /**
   * Initialize speaker selection UI
   * Uses standardized speaker codes directly (no speakers array needed)
   */
  initializeSpeakerSelection() {
    const speakerSelect = document.getElementById("speaker-select");
    if (!speakerSelect) return;

    // Valid speaker codes (standardized)
    const VALID_SPEAKER_CODES = [
      "lib-pm",
      "lib-pf",
      "lib-om",
      "lib-of",
      "lec-pm",
      "lec-pf",
      "lec-om",
      "lec-of",
      "pre-pm",
      "pre-pf",
      "tie-pm",
      "tie-pf",
      "traf-pm",
      "traf-pf",
      "rev",
    ];

    // Populate speaker options
    VALID_SPEAKER_CODES.forEach((code) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = code;
      speakerSelect.appendChild(option);
    });

    // Event listeners
    document
      .getElementById("confirm-speaker-btn")
      ?.addEventListener("click", () => {
        this.confirmSpeakerChange();
      });

    document
      .getElementById("cancel-speaker-btn")
      ?.addEventListener("click", () => {
        this.cancelSpeakerChange();
      });

    console.log(
      "[Editor] Speaker selection initialized with",
      VALID_SPEAKER_CODES.length,
      "codes",
    );
  }

  /**
   * Open speaker selection for a segment
   * @param {number} segmentIndex - The segment to change speaker for
   * @param {string} currentSpeakerCode - Current speaker code
   */
  openSpeakerSelection(segmentIndex, currentSpeakerCode) {
    this.currentSpeakerSegment = segmentIndex;
    this.currentSpeakerValue = currentSpeakerCode;

    const speakerSelect = document.getElementById("speaker-select");
    const speakerSelection = document.getElementById("speaker-selection");

    if (speakerSelect && speakerSelection) {
      speakerSelect.value = currentSpeakerCode;
      speakerSelection.classList.remove("hidden");
      speakerSelect.focus();
    }

    console.log(
      `[Editor] Speaker selection opened for segment ${segmentIndex}, current: ${currentSpeakerCode}`,
    );
  }

  /**
   * Map speaker code to attributes
   * @param {string} code - Speaker code (e.g. 'lib-pm')
   * @returns {Object} Speaker attributes
   * @private
   */
  _mapSpeakerAttributes(code) {
    const mapping = {
      "lib-pm": { type: "pro", sex: "m", mode: "libre", discourse: "general" },
      "lib-pf": { type: "pro", sex: "f", mode: "libre", discourse: "general" },
      "lib-om": { type: "otro", sex: "m", mode: "libre", discourse: "general" },
      "lib-of": { type: "otro", sex: "f", mode: "libre", discourse: "general" },
      "lec-pm": {
        type: "pro",
        sex: "m",
        mode: "lectura",
        discourse: "general",
      },
      "lec-pf": {
        type: "pro",
        sex: "f",
        mode: "lectura",
        discourse: "general",
      },
      "lec-om": {
        type: "otro",
        sex: "m",
        mode: "lectura",
        discourse: "general",
      },
      "lec-of": {
        type: "otro",
        sex: "f",
        mode: "lectura",
        discourse: "general",
      },
      "pre-pm": { type: "pro", sex: "m", mode: "pre", discourse: "general" },
      "pre-pf": { type: "pro", sex: "f", mode: "pre", discourse: "general" },
      "tie-pm": { type: "pro", sex: "m", mode: "n/a", discourse: "tiempo" },
      "tie-pf": { type: "pro", sex: "f", mode: "n/a", discourse: "tiempo" },
      "traf-pm": { type: "pro", sex: "m", mode: "n/a", discourse: "tránsito" },
      "traf-pf": { type: "pro", sex: "f", mode: "n/a", discourse: "tránsito" },
      foreign: { type: "n/a", sex: "n/a", mode: "n/a", discourse: "foreign" },
      none: { type: "", sex: "", mode: "", discourse: "" },
    };

    return mapping[code] || { type: "", sex: "", mode: "", discourse: "" };
  }

  /**
   * Confirm speaker change
   */
  confirmSpeakerChange() {
    const speakerSelect = document.getElementById("speaker-select");
    const newSpeakerCode = speakerSelect?.value;

    if (!newSpeakerCode || this.currentSpeakerSegment === undefined) {
      return;
    }

    const segment = this.data.segments[this.currentSpeakerSegment];
    if (!segment) return;

    // Use speaker_code (new) or fallback to speaker (legacy)
    const oldSpeakerCode = segment.speaker_code || segment.speaker;
    if (newSpeakerCode === oldSpeakerCode) {
      this.cancelSpeakerChange();
      return;
    }

    // Record the change
    this._recordSpeakerChange(
      this.currentSpeakerSegment,
      oldSpeakerCode,
      newSpeakerCode,
    );

    // Update data (set speaker_code AND speaker object)
    segment.speaker_code = newSpeakerCode;

    // Map attributes and update speaker object
    const attrs = this._mapSpeakerAttributes(newSpeakerCode);
    segment.speaker = {
      code: newSpeakerCode,
      speaker_type: attrs.type,
      speaker_sex: attrs.sex,
      speaker_mode: attrs.mode,
      speaker_discourse: attrs.discourse,
    };

    // Update UI
    this._updateSpeakerDisplay(this.currentSpeakerSegment, newSpeakerCode);

    // Close selection
    this.cancelSpeakerChange();
    this.updateUI();

    console.log(
      `[Editor] Speaker changed from ${oldSpeakerCode} to ${newSpeakerCode} for segment ${this.currentSpeakerSegment}`,
    );
  }

  /**
   * Cancel speaker selection
   */
  cancelSpeakerChange() {
    const speakerSelection = document.getElementById("speaker-selection");
    speakerSelection?.classList.add("hidden");

    this.currentSpeakerSegment = undefined;
    this.currentSpeakerValue = null;
  }

  /**
   * Record a speaker change action
   * @private
   */
  _recordSpeakerChange(segmentIndex, oldSpeaker, newSpeaker) {
    const action = {
      type: "speaker_change",
      segmentIndex,
      oldValue: oldSpeaker,
      newValue: newSpeaker,
      timestamp: Date.now(),
    };

    this.undoStack.push(action);

    if (this.undoStack.length > this.maxUndoActions) {
      this.undoStack.shift();
    }

    this.redoStack = [];
    this.updateUndoRedoButtons();
  }

  /**
   * Update speaker display in UI - completely re-render the speaker block
   * @private
   */
  _updateSpeakerDisplay(segmentIndex, newSpeakerCode) {
    // Find the speaker-name element (try both MD3 and legacy class names)
    let speakerNameEl = document.querySelector(
      `.md3-speaker-name[data-segment-index="${segmentIndex}"]`,
    );
    if (!speakerNameEl) {
      speakerNameEl = document.querySelector(
        `.speaker-name[data-segment-index="${segmentIndex}"]`,
      );
    }

    if (!speakerNameEl) {
      console.warn(
        `[Editor] Could not find speaker-name element for segment ${segmentIndex}`,
      );
      return;
    }

    // Use TranscriptionManager to generate the new content with chips
    if (
      this.transcription &&
      typeof this.transcription._createSpeakerName === "function"
    ) {
      const segment = this.data.segments[segmentIndex];
      const words = segment ? segment.words : [];

      // Generate new element structure
      const newNameEl = this.transcription._createSpeakerName(
        newSpeakerCode,
        words,
        segmentIndex,
      );

      // Clear existing content
      speakerNameEl.innerHTML = "";

      // Move children from new element to existing one
      while (newNameEl.firstChild) {
        speakerNameEl.appendChild(newNameEl.firstChild);
      }
    } else {
      // Fallback: Update text content
      speakerNameEl.textContent = newSpeakerCode;
    }

    // Add modified-speaker class to show it was changed
    speakerNameEl.classList.add("modified-speaker");

    console.log(
      `[Editor] Updated speaker display for segment ${segmentIndex} to ${newSpeakerCode}`,
    );
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean} true if there are any modifications
   */
  hasUnsavedChanges() {
    // Check if there are any word edits
    if (this.editHistory.size > 0) {
      return true;
    }

    // Check if any speakers have been modified (use speaker_code)
    for (let segIdx in this.originalSpeakers) {
      const currentSpeaker =
        this.data.segments[segIdx].speaker_code ||
        this.data.segments[segIdx].speaker;
      if (currentSpeaker !== this.originalSpeakers[segIdx]) {
        return true;
      }
    }

    return false;
  }
}
