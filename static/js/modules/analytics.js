/**
 * Analytics Module - Anonymous usage tracking
 * 
 * PRIVACY: No personal data is collected or transmitted.
 * - sessionStorage token is NEVER sent to server
 * - Only aggregated counters are stored
 * - No cookies, no fingerprints, no user IDs
 * 
 * VARIANTE 3a: Keine Suchinhalte/Query-Texte werden übertragen!
 */

const ANALYTICS_ENDPOINT = '/api/analytics/event';

/**
 * Check if device is mobile (viewport-based)
 */
function isMobile() {
  return window.innerWidth <= 768;
}

/**
 * Send analytics event (fire-and-forget)
 * @param {string} type - Event type: 'visit', 'search', 'audio_play', 'error'
 * @param {Object} payload - Event-specific data
 */
function sendAnalyticsEvent(type, payload = {}) {
  // Use sendBeacon for reliability, fallback to fetch
  const data = JSON.stringify({ type, payload });
  
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ANALYTICS_ENDPOINT, new Blob([data], { type: 'application/json' }));
  } else {
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data,
      keepalive: true,
    }).catch(() => {});  // Ignore errors - must not affect UX
  }
}

/**
 * Track unique visit (once per browser session/tab)
 * Uses sessionStorage to ensure one visit per tab.
 * The token stays local and is NEVER transmitted.
 */
function trackVisit() {
  const VISIT_KEY = 'corapan_visit_tracked';
  
  if (sessionStorage.getItem(VISIT_KEY)) {
    return;  // Already tracked this session
  }
  
  sessionStorage.setItem(VISIT_KEY, '1');
  sendAnalyticsEvent('visit', {
    device: isMobile() ? 'mobile' : 'desktop'
  });
}

/**
 * Track search event (nur Zähler, keine Inhalte!)
 * 
 * VARIANTE 3a: Der query-Parameter wird NICHT an den Server gesendet.
 * Es wird nur der Zähler erhöht.
 */
function trackSearch() {
  sendAnalyticsEvent('search', {});  // Leeres payload - keine Query-Inhalte!
}

/**
 * Track audio play event
 */
function trackAudioPlay() {
  sendAnalyticsEvent('audio_play');
}

/**
 * Track error event
 * @param {number} status - HTTP status code
 * @param {string} url - URL that caused the error (optional, for logging)
 */
function trackError(status, url) {
  // Note: url is only used for client-side debugging, NOT sent to server
  sendAnalyticsEvent('error', { status });
}

/**
 * Initialize analytics tracking
 * Call this once on page load.
 */
export function initAnalytics() {
  // Track visit on first page load of session
  trackVisit();
}

// Export tracking functions for use in other modules
export { trackSearch, trackAudioPlay, trackError };
