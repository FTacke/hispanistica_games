/**
 * Admin Dashboard Module
 * Fetches data from /api/analytics/stats endpoint
 * 
 * VARIANTE 3a: Keine Top-Queries Anzeige (keine Suchinhalte gespeichert)
 * 
 * Zeigt:
 * - 30-Tage Metriken (totals_window)
 * - Gesamt seit Projektstart (totals_overall)
 * - Letzte 7 Tage Tabelle (daily)
 */

// DOM Element References
const elements = {
  metricsGrid: null,
  totalsOverallGrid: null,
  tableSkeleton: null,
  tableContainer: null,
  tableBody: null,
  errorBanner: null,
  retryButton: null,
};

export function initAdminDashboard() {
  // Check if we are on the dashboard page
  elements.metricsGrid = document.querySelector('[data-element="metrics-grid"]');
  if (!elements.metricsGrid) return;

  // Cache DOM references
  elements.totalsOverallGrid = document.querySelector('[data-element="totals-overall-grid"]');
  elements.tableSkeleton = document.getElementById('table-skeleton');
  elements.tableContainer = document.getElementById('table-container');
  elements.tableBody = document.getElementById('analytics-last-7-days');
  elements.errorBanner = document.getElementById('error-banner');
  elements.retryButton = document.getElementById('retry-button');

  // Setup retry button
  if (elements.retryButton) {
    elements.retryButton.addEventListener('click', () => {
      hideError();
      showSkeletons();
      fetchAnalytics();
    });
  }

  fetchAnalytics();
}

async function fetchAnalytics() {
  try {
    const response = await fetch('/api/analytics/stats?days=30');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderDashboard(data);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    showErrorState();
  }
}

function renderDashboard(data) {
  // 1. Render 30-Tage Metriken (totals_window)
  renderWindowTotals(data.totals_window);
  
  // 2. Render Gesamt seit Projektstart (totals_overall)
  renderOverallTotals(data.totals_overall);
  
  // 3. Render Tabelle mit letzten 7 Tagen
  renderDailyTable(data.daily);
  
  // Hide error banner if visible
  hideError();
}

/**
 * Render 30-Tage Totals in den Metric Cards
 */
function renderWindowTotals(totals) {
  // Visitors + Device Breakdown
  setMetricValue('visitors-total', totals.visitors);
  const mobilePercent = totals.visitors > 0 
    ? Math.round((totals.mobile / totals.visitors) * 100) 
    : 0;
  const desktopPercent = 100 - mobilePercent;
  const deviceEl = document.getElementById('device-breakdown');
  if (deviceEl) {
    deviceEl.textContent = `Mobile ${mobilePercent}% · Desktop ${desktopPercent}%`;
  }
  
  // Other metrics
  setMetricValue('searches-total', totals.searches);
  setMetricValue('audio-total', totals.audio_plays);
  setMetricValue('errors-total', totals.errors);
  
  // Show data, hide skeletons for all metric cards
  showMetricData(elements.metricsGrid);
}

/**
 * Render Gesamt-Totals (seit Projektstart)
 */
function renderOverallTotals(totals) {
  setMetricValue('visitors-overall', totals.visitors);
  setMetricValue('searches-overall', totals.searches);
  setMetricValue('audio-overall', totals.audio_plays);
  
  // Show data, hide skeletons
  showMetricData(elements.totalsOverallGrid);
}

/**
 * Set a metric value by element ID
 */
function setMetricValue(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = (value || 0).toLocaleString('de-DE');
  }
}

/**
 * Show data and hide skeletons within a container
 */
function showMetricData(container) {
  if (!container) return;
  
  container.querySelectorAll('.md3-metric-card__skeleton').forEach(skeleton => {
    skeleton.hidden = true;
    skeleton.setAttribute('aria-hidden', 'true');
  });
  
  container.querySelectorAll('.md3-metric-card__data').forEach(data => {
    data.hidden = false;
  });
}

/**
 * Render die Tabelle "Letzte 7 Tage"
 * dailyData kommt DESC sortiert vom Server, wir zeigen chronologisch (ältester Tag oben)
 */
function renderDailyTable(dailyData) {
  if (!elements.tableBody) return;
  
  // Hide skeleton, show table
  if (elements.tableSkeleton) {
    elements.tableSkeleton.hidden = true;
  }
  if (elements.tableContainer) {
    elements.tableContainer.hidden = false;
  }
  
  if (!dailyData || !dailyData.length) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="3" class="md3-admin-table__empty md3-body-medium">
          Noch keine Daten verfügbar.
        </td>
      </tr>
    `;
    return;
  }
  
  // dailyData ist DESC (neuester zuerst), nehme die ersten 7 und kehre um
  const last7 = dailyData.slice(0, 7).reverse();
  
  const rows = last7.map(day => `
    <tr>
      <td>${formatDateLabel(day.date)}</td>
      <td>${(day.visitors || 0).toLocaleString('de-DE')}</td>
      <td>${(day.searches || 0).toLocaleString('de-DE')}</td>
    </tr>
  `).join('');
  
  elements.tableBody.innerHTML = rows;
}

/**
 * Format ISO date to German locale (z.B. "Fr., 29. Nov.")
 */
function formatDateLabel(isoDate) {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('de-DE', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  } catch {
    return isoDate;
  }
}

/**
 * Show all skeletons (for retry)
 */
function showSkeletons() {
  // Metric cards
  [elements.metricsGrid, elements.totalsOverallGrid].forEach(container => {
    if (!container) return;
    container.querySelectorAll('.md3-metric-card__skeleton').forEach(skeleton => {
      skeleton.hidden = false;
    });
    container.querySelectorAll('.md3-metric-card__data').forEach(data => {
      data.hidden = true;
    });
  });
  
  // Table
  if (elements.tableSkeleton) {
    elements.tableSkeleton.hidden = false;
  }
  if (elements.tableContainer) {
    elements.tableContainer.hidden = true;
  }
}

/**
 * Show error state
 */
function showErrorState() {
  // Hide all skeletons
  [elements.metricsGrid, elements.totalsOverallGrid].forEach(container => {
    if (!container) return;
    container.querySelectorAll('.md3-metric-card__skeleton').forEach(skeleton => {
      skeleton.hidden = true;
    });
  });
  
  if (elements.tableSkeleton) {
    elements.tableSkeleton.hidden = true;
  }
  
  // Show error banner
  if (elements.errorBanner) {
    elements.errorBanner.hidden = false;
  }
}

/**
 * Hide error banner
 */
function hideError() {
  if (elements.errorBanner) {
    elements.errorBanner.hidden = true;
  }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initAdminDashboard);
