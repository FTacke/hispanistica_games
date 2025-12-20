/**
 * MD3 Alert Utilities
 * 
 * Provides helper functions to create MD3-compliant alert banners
 * for use in forms and other interactive components.
 * 
 * Usage:
 *   import { showAlert, clearAlert } from '/static/js/md3/alert-utils.js';
 *   showAlert(container, 'error', 'Fehler', 'Nachricht hier');
 *   clearAlert(container);
 */

/**
 * @typedef {'error' | 'warning' | 'info' | 'success'} AlertType
 */

/**
 * Icon mapping for alert types
 * @type {Record<AlertType, string>}
 */
const ALERT_ICONS = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  success: 'check_circle'
};

/**
 * Default titles for alert types (German)
 * @type {Record<AlertType, string>}
 */
const ALERT_TITLES = {
  error: 'Fehler',
  warning: 'Warnung',
  info: 'Hinweis',
  success: 'Erfolg'
};

/**
 * Creates an MD3-compliant alert HTML string
 * 
 * @param {AlertType} type - The alert type (error, warning, info, success)
 * @param {string|null} title - Optional title, uses default if null
 * @param {string} message - The alert message
 * @param {boolean} inline - Whether to use inline variant (default: true)
 * @returns {string} HTML string for the alert
 */
export function createAlertHTML(type, title, message, inline = true) {
  const icon = ALERT_ICONS[type] || 'info';
  const displayTitle = title || ALERT_TITLES[type] || '';
  const inlineClass = inline ? 'md3-alert--inline' : 'md3-alert--banner';
  
  return `
    <div class="md3-alert md3-alert--${type} ${inlineClass}" role="alert" aria-live="assertive">
      <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">${icon}</span>
      <div class="md3-alert__content">
        <p class="md3-alert__title">${displayTitle}</p>
        <p class="md3-alert__text">${escapeHTML(message)}</p>
      </div>
    </div>
  `.trim();
}

/**
 * Shows an MD3 alert in the specified container element
 * 
 * @param {HTMLElement} container - The container element (e.g., #status)
 * @param {AlertType} type - The alert type
 * @param {string|null} title - Optional title
 * @param {string} message - The alert message
 * @param {boolean} inline - Whether to use inline variant (default: true)
 */
export function showAlert(container, type, title, message, inline = true) {
  if (!container) {
    console.warn('showAlert: container element not found');
    return;
  }
  container.innerHTML = createAlertHTML(type, title, message, inline);
}

/**
 * Shows an error alert (convenience function)
 * 
 * @param {HTMLElement} container - The container element
 * @param {string} message - The error message
 * @param {string|null} title - Optional title (default: 'Fehler')
 */
export function showError(container, message, title = null) {
  showAlert(container, 'error', title, message);
}

/**
 * Shows a success alert (convenience function)
 * 
 * @param {HTMLElement} container - The container element
 * @param {string} message - The success message
 * @param {string|null} title - Optional title (default: 'Erfolg')
 */
export function showSuccess(container, message, title = null) {
  showAlert(container, 'success', title, message);
}

/**
 * Shows an info alert (convenience function)
 * 
 * @param {HTMLElement} container - The container element
 * @param {string} message - The info message
 * @param {string|null} title - Optional title (default: 'Hinweis')
 */
export function showInfo(container, message, title = null) {
  showAlert(container, 'info', title, message);
}

/**
 * Shows a warning alert (convenience function)
 * 
 * @param {HTMLElement} container - The container element
 * @param {string} message - The warning message
 * @param {string|null} title - Optional title (default: 'Warnung')
 */
export function showWarning(container, message, title = null) {
  showAlert(container, 'warning', title, message);
}

/**
 * Clears the alert from the container
 * 
 * @param {HTMLElement} container - The container element
 */
export function clearAlert(container) {
  if (!container) return;
  container.innerHTML = '';
}

/**
 * Escapes HTML special characters to prevent XSS
 * 
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Also expose as window global for non-module scripts
if (typeof window !== 'undefined') {
  window.md3AlertUtils = {
    createAlertHTML,
    showAlert,
    showError,
    showSuccess,
    showInfo,
    showWarning,
    clearAlert
  };
}
