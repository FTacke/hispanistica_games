/**
 * HistoryPanel - Shows change history with selective undo capability
 *
 * Features:
 * - Display all changes chronologically
 * - Show which words changed (old → new)
 * - Selective undo per change
 * - Undo tracking (shows reversed changes)
 */

export class HistoryPanel {
  constructor(config) {
    this.config = config;
    this.country = config.country;
    this.filename = config.filename;
    this.history = [];

    this.panel = document.getElementById("history-panel");

    // Load history on init
    this.loadHistory();
  }

  /**
   * Load change history from backend
   */
  async loadHistory() {
    try {
      const url = `${this.config.apiBaseUrl}/history/${this.country}/${this.filename}`;
      console.log("[HistoryPanel] Loading history from:", url);

      const response = await fetch(url, {
        credentials: "include",
      });

      console.log("[HistoryPanel] Response status:", response.status);

      if (!response.ok) {
        console.error(
          "[HistoryPanel] Failed to load history:",
          response.status,
          response.statusText,
        );
        const errorText = await response.text();
        console.error("[HistoryPanel] Response body:", errorText);
        return;
      }

      const data = await response.json();
      if (data.success) {
        this.history = data.history || [];
        console.log(
          "[HistoryPanel] Loaded history:",
          this.history.length,
          "entries",
        );
        this.renderTimeline();
      }
    } catch (error) {
      console.error("[HistoryPanel] Error loading history:", error);
    }
  }

  /**
   * Render the history timeline UI
   */
  renderTimeline() {
    if (!this.panel) return;

    if (this.history.length === 0) {
      this.panel.innerHTML = `
        <div class="md3-editor-history-empty">
          <p>Keine Änderungshistorie</p>
        </div>
      `;
      return;
    }

    let html = '<div class="md3-editor-history-timeline">';

    this.history.forEach((entry) => {
      const timestamp = new Date(entry.timestamp);
      const timeStr = timestamp.toLocaleString("de-DE");
      const user = entry.user || "Unknown";

      // Different rendering for undo entries vs regular changes
      if (entry.type === "undo") {
        html += this._renderUndoEntry(entry, timeStr, user);
      } else {
        html += this._renderChangeEntry(entry, timeStr, user);
      }
    });

    html += "</div>";
    this.panel.innerHTML = html;

    // Add event listeners to undo buttons for individual changes
    this.panel
      .querySelectorAll(".md3-editor-history-change-undo-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const undoIndex = parseInt(btn.dataset.undoIndex);
          const changeIndex = parseInt(btn.dataset.changeIndex);
          // For now, undo the entire entry (backend doesn't support individual change undo yet)
          this.undoChange(undoIndex);
        });
      });
  }

  /**
   * Render a regular change entry
   */
  _renderChangeEntry(entry, timeStr, user) {
    const changes = entry.changes || [];

    let changesHtml = "";
    changes.forEach((change, changeIndex) => {
      // Check if this is a speaker change or word change
      if (change.type === "speaker_change") {
        const segIdx = change.segment_index || "?";
        const oldVal = this._escapeHtml(change.old_value || "").substring(
          0,
          15,
        );
        const newVal = this._escapeHtml(change.new_value || "").substring(
          0,
          15,
        );

        changesHtml += `
          <div class="md3-editor-history-change-item">
            <span class="md3-editor-history-change-badge">S${segIdx}</span>
            <span class="md3-editor-history-old-value">${oldVal}</span>
            <span class="md3-editor-history-arrow">→</span>
            <span class="md3-editor-history-new-value">${newVal}</span>
            <button class="md3-editor-history-change-undo-btn" 
                    data-undo-index="${entry.index}" 
                    data-change-index="${changeIndex}"
                    title="Diese Änderung rückgängig machen">
              <i class="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
        `;
      } else {
        // Regular word change
        const segIdx = change.segment_index || "?";
        const wordIdx = change.word_index || "?";
        const oldVal = this._escapeHtml(change.old_value || "").substring(
          0,
          15,
        );
        const newVal = this._escapeHtml(change.new_value || "").substring(
          0,
          15,
        );

        changesHtml += `
          <div class="md3-editor-history-change-item">
            <span class="md3-editor-history-change-badge">S${segIdx}W${wordIdx}</span>
            <span class="md3-editor-history-old-value">${oldVal}</span>
            <span class="md3-editor-history-arrow">→</span>
            <span class="md3-editor-history-new-value">${newVal}</span>
            <button class="md3-editor-history-change-undo-btn" 
                    data-undo-index="${entry.index}" 
                    data-change-index="${changeIndex}"
                    title="Diese Änderung rückgängig machen">
              <i class="bi bi-arrow-counterclockwise"></i>
            </button>
          </div>
        `;
      }
    });

    return `
      <div class="md3-editor-history-entry">
        <div class="md3-editor-history-header">
          <span class="md3-editor-history-timestamp">${timeStr}</span>
          <span class="md3-editor-history-user">${user}</span>
          <span class="md3-editor-history-badge">${changes.length}</span>
        </div>
        <div class="md3-editor-history-changes">
          ${changesHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render an undo entry (when a change was reverted)
   */
  _renderUndoEntry(entry, timeStr, user) {
    const reversedIdx = entry.reversed_index || "?";

    return `
      <div class="md3-editor-history-entry">
        <div class="md3-editor-history-header">
          <span class="md3-editor-history-timestamp">${timeStr}</span>
          <span class="md3-editor-history-user">${user}</span>
          <span class="md3-editor-history-badge md3-editor-history-badge-undo">↶</span>
        </div>
        <div class="md3-editor-history-changes">
          <p style="font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant);">Undo #${reversedIdx}</p>
        </div>
      </div>
    `;
  }

  /**
   * Undo a specific change
   */
  async undoChange(undoIndex) {
    if (!confirm(`Änderung #${undoIndex} wirklich rückgängig machen?`)) {
      return;
    }

    try {
      const url = `${this.config.apiBaseUrl}/undo`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: `${this.country}/${this.filename}`,
          undo_index: undoIndex,
        }),
      });

      if (!response.ok) {
        console.error("[HistoryPanel] Undo failed:", response.status);
        alert("Fehler beim Rückgängigmachen der Änderung");
        return;
      }

      const data = await response.json();
      if (data.success) {
        console.log("[HistoryPanel] Change undone successfully");
        alert("Änderung rückgängig gemacht. Seite wird neu geladen...");

        // Reload page to reflect changes
        location.reload();
      }
    } catch (error) {
      console.error("[HistoryPanel] Error undoing change:", error);
      alert("Fehler beim Rückgängigmachen");
    }
  }

  /**
   * Escape HTML special characters
   */
  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
