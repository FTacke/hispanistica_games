/**
 * Editor Entry Point
 * Initializes the editor player and utilities.
 */

import { EditorPlayer } from '../../editor/editor-player.js';
import { DialogUtils } from '../../editor/dialog-utils.js';

// Make dialog utilities globally available
window.DialogUtils = DialogUtils;

// Initialize editor when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const configEl = document.getElementById('editor-config');
  if (configEl) {
      try {
        const config = JSON.parse(configEl.textContent);
        const editor = new EditorPlayer(config);
        await editor.init();
        console.log('[Editor] Initialized successfully');
      } catch (e) {
        console.error('[Editor] Initialization failed:', e);
      }
  }
});
