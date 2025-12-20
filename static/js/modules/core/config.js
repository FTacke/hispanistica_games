/**
 * Global Configuration
 * Reads configuration from data-config attribute on body.
 */

export function initConfig() {
  const body = document.body;
  const configData = body.getAttribute('data-config');
  
  if (configData) {
    try {
      const config = JSON.parse(configData);
      window.__CORAPAN__ = config;
    } catch (e) {
      console.error('[Config] Failed to parse global config:', e);
      window.__CORAPAN__ = {};
    }
  } else {
    window.__CORAPAN__ = {};
  }
}
