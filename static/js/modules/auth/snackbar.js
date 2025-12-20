/**
 * MD3 Snackbar Module - Auth Expiration Notification
 *
 * Shows Material Design 3 Snackbar when refresh token expires.
 */

/**
 * Show MD3 Snackbar for expired session
 * Persists until user interacts (no auto-dismiss)
 */
export function showAuthExpiredSnackbar() {
  // Check if snackbar already exists
  if (document.querySelector(".md3-snackbar--auth-expired")) {
    return; // Don't show multiple snackbars
  }

  // Create snackbar container
  const snackbar = document.createElement("div");
  snackbar.className = "md3-snackbar md3-snackbar--auth-expired";
  snackbar.setAttribute("role", "status");
  snackbar.setAttribute("aria-live", "polite");

  // Create content
  snackbar.innerHTML = `
    <div class="md3-snackbar__surface">
      <div class="md3-snackbar__label">
        Sitzung abgelaufen. Erneut anmelden.
      </div>
      <div class="md3-snackbar__actions">
        <button type="button" class="md3-snackbar__action" data-action="open-login">
          Anmelden
        </button>
        <button type="button" class="md3-snackbar__dismiss" aria-label="Schließen">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  `;

  // Add to DOM
  document.body.appendChild(snackbar);

  // Animate in
  requestAnimationFrame(() => {
    snackbar.classList.add("md3-snackbar--visible");
  });

  // Handle action button (open login)
  const actionButton = snackbar.querySelector('[data-action="open-login"]');
  if (actionButton) {
    actionButton.addEventListener("click", () => {
      // Open login dialog/sheet
      const loginTrigger = document.querySelector('[data-action="open-login"]');
      if (loginTrigger && loginTrigger !== actionButton) {
        loginTrigger.click();
      }

      // Close snackbar
      dismissSnackbar(snackbar);
    });
  }

  // Handle dismiss button
  const dismissButton = snackbar.querySelector(".md3-snackbar__dismiss");
  if (dismissButton) {
    dismissButton.addEventListener("click", () => {
      dismissSnackbar(snackbar);
    });
  }
}

/**
 * Dismiss snackbar with animation
 * @param {HTMLElement} snackbar
 */
function dismissSnackbar(snackbar) {
  snackbar.classList.remove("md3-snackbar--visible");

  // Remove from DOM after animation
  setTimeout(() => {
    snackbar.remove();
  }, 300); // Match CSS transition duration
}

/**
 * CSS for MD3 Snackbar (inject if not already present)
 * This should ideally be in your CSS files, but included here for completeness
 */
export function injectSnackbarStyles() {
  if (document.getElementById("md3-snackbar-styles")) {
    return; // Styles already injected
  }

  const style = document.createElement("style");
  style.id = "md3-snackbar-styles";
  style.textContent = `
    .md3-snackbar {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%) translateY(100%);
      z-index: 1000;
      margin: 0 auto 16px;
      max-width: calc(100vw - 32px);
      opacity: 0;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .md3-snackbar--visible {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    
    .md3-snackbar__surface {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px;
      background-color: var(--md-sys-color-inverse-surface, #313033);
      color: var(--md-sys-color-inverse-on-surface, #f4eff4);
      border-radius: 4px;
      box-shadow: 0 3px 5px -1px rgba(0,0,0,0.2),
                  0 6px 10px 0 rgba(0,0,0,0.14),
                  0 1px 18px 0 rgba(0,0,0,0.12);
      min-width: 344px;
      max-width: 672px;
    }
    
    @media (max-width: 600px) {
      .md3-snackbar {
        left: 8px;
        right: 8px;
        transform: translateY(100%);
        max-width: none;
      }
      
      .md3-snackbar--visible {
        transform: translateY(0);
      }
      
      .md3-snackbar__surface {
        min-width: auto;
        width: 100%;
      }
    }
    
    .md3-snackbar__label {
      flex: 1;
      font-size: 14px;
      line-height: 20px;
      font-weight: 400;
      letter-spacing: 0.25px;
    }
    
    .md3-snackbar__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
    
    .md3-snackbar__action {
      background: none;
      border: none;
      padding: 8px 12px;
      color: var(--md-sys-color-inverse-primary, #d0bcff);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.1px;
      text-transform: uppercase;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    .md3-snackbar__action:hover {
      background-color: rgba(208, 188, 255, 0.08);
    }
    
    .md3-snackbar__action:active {
      background-color: rgba(208, 188, 255, 0.12);
    }
    
    .md3-snackbar__dismiss {
      background: none;
      border: none;
      padding: 8px;
      color: var(--md-sys-color-inverse-on-surface, #f4eff4);
      cursor: pointer;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
    }
    
    .md3-snackbar__dismiss:hover {
      background-color: rgba(244, 239, 244, 0.08);
    }
    
    .md3-snackbar__dismiss:active {
      background-color: rgba(244, 239, 244, 0.12);
    }
    
    .md3-snackbar__dismiss .material-symbols-outlined {
      font-size: 24px;
    }
  `;

  document.head.appendChild(style);
}

// Auto-inject styles when module loads
injectSnackbarStyles();
