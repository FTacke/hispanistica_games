/**
 * MD3 Snackbar Module
 * 
 * Provides a global snackbar notification system for success/error/info messages.
 * Integrates with Flask's flash() system via data attributes in base.html.
 */

const SNACKBAR_DURATION = 4000; // 4 seconds
const ANIMATION_DURATION = 300; // Match CSS transition

let currentSnackbar = null;
let hideTimeout = null;

/**
 * Show a snackbar notification
 * @param {string} message - The message to display
 * @param {string} type - The type: 'success', 'error', 'info' (default: 'success')
 * @param {number} duration - How long to show (ms), 0 for persistent (default: 4000)
 */
export function showSnackbar(message, type = 'success', duration = SNACKBAR_DURATION) {
  // Remove existing snackbar if any
  hideSnackbar();

  // Create snackbar element
  const snackbar = document.createElement('div');
  snackbar.className = `md3-snackbar md3-snackbar--${type}`;
  snackbar.setAttribute('role', 'status');
  snackbar.setAttribute('aria-live', 'polite');

  // Icon based on type
  const iconMap = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
    warning: 'warning'
  };

  snackbar.innerHTML = `
    <span class="material-symbols-rounded md3-snackbar__icon" aria-hidden="true">${iconMap[type] || 'info'}</span>
    <span class="md3-snackbar__message">${escapeHtml(message)}</span>
    <button class="md3-snackbar__action" type="button" aria-label="Schließen">OK</button>
  `;

  // Add dismiss handler
  const dismissBtn = snackbar.querySelector('.md3-snackbar__action');
  dismissBtn.addEventListener('click', () => hideSnackbar());

  // Add to DOM
  document.body.appendChild(snackbar);
  currentSnackbar = snackbar;

  // Trigger animation (need a frame delay for CSS transition)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      snackbar.classList.add('visible');
    });
  });

  // Auto-hide after duration (if not persistent)
  if (duration > 0) {
    hideTimeout = setTimeout(() => hideSnackbar(), duration);
  }
}

/**
 * Hide the current snackbar
 */
export function hideSnackbar() {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  if (currentSnackbar) {
    currentSnackbar.classList.remove('visible');
    const snackbarToRemove = currentSnackbar;
    currentSnackbar = null;

    // Remove from DOM after animation
    setTimeout(() => {
      if (snackbarToRemove.parentNode) {
        snackbarToRemove.remove();
      }
    }, ANIMATION_DURATION);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialize snackbar from flash messages
 * Reads flash messages from a data attribute on body and displays them
 */
export function initFlashSnackbar() {
  const flashData = document.body.dataset.flashMessages;
  if (!flashData) return;

  try {
    const messages = JSON.parse(flashData);
    if (messages && messages.length > 0) {
      // Show the first success message as snackbar
      const successMsg = messages.find(m => m.category === 'success');
      if (successMsg) {
        // Small delay to let page render first
        setTimeout(() => {
          showSnackbar(successMsg.message, 'success');
        }, 100);
      }
    }
  } catch (e) {
    console.warn('[Snackbar] Failed to parse flash messages:', e);
  }

  // Clear the data attribute to prevent re-display on navigation
  delete document.body.dataset.flashMessages;
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFlashSnackbar);
} else {
  initFlashSnackbar();
}

// Export for global access
window.MD3Snackbar = { showSnackbar, hideSnackbar };
