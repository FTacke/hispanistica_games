/**
 * Player Entry Point
 * Initializes the player page.
 */

import * as PlayerInit from "../../player/player-init.js";

export function initPlayerPage() {
    const root = document.getElementById('player-page-root');
    if (!root) {
        console.warn('[Player] Root element not found');
        return;
    }

    const config = {
        transcription: root.dataset.transcription || '',
        audio: root.dataset.audio || '',
        token_id: root.dataset.tokenId || ''
    };
    
    window.PLAYER_CONFIG = config;
    console.log('[Player] Config from DOM:', window.PLAYER_CONFIG);

    // Global error handler for module loading
    window.addEventListener('error', function(event) {
        console.error('[Player] Global error:', event.error);
    });
    
    window.addEventListener('unhandledrejection', function(event) {
        console.error('[Player] Unhandled rejection:', event.reason);
    });

    if (PlayerInit.initializePlayer) {
        PlayerInit.initializePlayer();
    }
}

// Auto-init
initPlayerPage();
