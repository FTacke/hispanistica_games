/**
 * MD3 Dialog Utilities
 * Simple dialog system for user notifications and confirmations
 */

export class DialogUtils {
  /**
   * Show a simple alert dialog
   * @param {string} message - Message to display
   * @param {string} title - Dialog title (optional)
   */
  static alert(message, title = "Hinweis") {
    this._showDialog({
      title,
      message,
      buttons: [
        { text: "OK", primary: true, action: () => this._closeDialog() },
      ],
    });
  }

  /**
   * Show a confirmation dialog
   * @param {string} message - Message to display
   * @param {Function} onConfirm - Callback when confirmed
   * @param {string} title - Dialog title (optional)
   */
  static confirm(message, onConfirm, title = "Bestätigen") {
    this._showDialog({
      title,
      message,
      buttons: [
        {
          text: "Abbrechen",
          primary: false,
          action: () => this._closeDialog(),
        },
        {
          text: "OK",
          primary: true,
          action: () => {
            this._closeDialog();
            onConfirm();
          },
        },
      ],
    });
  }

  /**
   * Show an error dialog
   * @param {string} message - Error message
   * @param {string} title - Dialog title (optional)
   */
  static error(message, title = "Fehler") {
    this._showDialog({
      title,
      message,
      isError: true,
      buttons: [
        { text: "OK", primary: true, action: () => this._closeDialog() },
      ],
    });
  }

  /**
   * Internal: Show dialog with given configuration
   * @private
   */
  static _showDialog(config) {
    // Remove existing dialog if any
    this._closeDialog();

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "md3-dialog-overlay";
    overlay.id = "md3-dialog-overlay";

    // Create dialog container
    const container = document.createElement("div");
    container.className = "md3-dialog__container";

    // Create dialog
    const dialog = document.createElement("div");
    dialog.className = "md3-dialog";
    if (config.isError) {
      dialog.classList.add("md3-dialog--error");
    }

    // Title
    const title = document.createElement("div");
    title.className = "md3-dialog__title";
    title.textContent = config.title;
    dialog.appendChild(title);

    // Content
    const content = document.createElement("div");
    content.className = "md3-dialog__content";
    content.textContent = config.message;
    dialog.appendChild(content);

    // Actions
    const actions = document.createElement("div");
    actions.className = "md3-dialog__actions";

    config.buttons.forEach((btn) => {
      const button = document.createElement("button");
      button.className = btn.primary
        ? "md3-editor-btn md3-editor-btn-primary"
        : "md3-editor-btn md3-editor-btn-tonal";
      button.textContent = btn.text;
      button.addEventListener("click", btn.action);
      actions.appendChild(button);
    });

    dialog.appendChild(actions);
    container.appendChild(dialog);
    overlay.appendChild(container);

    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this._closeDialog();
      }
    });

    // Add to DOM
    document.body.appendChild(overlay);

    // Trigger animation
    setTimeout(() => overlay.classList.add("active"), 10);
  }

  /**
   * Close the dialog
   * @private
   */
  static _closeDialog() {
    const overlay = document.getElementById("md3-dialog-overlay");
    if (overlay) {
      overlay.classList.remove("active");
      setTimeout(() => overlay.remove(), 200);
    }
  }
}

// Shorthand functions for global use
window.showDialog = DialogUtils.alert.bind(DialogUtils);
window.showError = DialogUtils.error.bind(DialogUtils);
window.showConfirm = DialogUtils.confirm.bind(DialogUtils);
