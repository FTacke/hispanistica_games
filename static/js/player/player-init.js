/**
 * Player Initialization Module
 * Handles transcription loading and token_id highlighting
 * Full-featured player with all modules
 */

import AudioPlayer from "./modules/audio.js";
import TranscriptionManager from "./modules/transcription.js";
import TokenCollector from "./modules/tokens.js";
import HighlightingManager from "./modules/highlighting.js";
import ExportManager from "./modules/export.js";
import UIManager from "./modules/ui.js";
import MobileHandler from "./modules/mobile.js";

console.log("[Player Init] Module loaded");

// Store instances globally
let audioPlayer = null;
let transcriptionManager = null;
let tokenCollector = null;
let highlightingManager = null;
let exportManager = null;
let uiManager = null;
let mobileHandler = null;

/**
 * Load and render transcription
 */
async function initializePlayer() {
  // Get configuration from backend (read at runtime)
  const config = window.PLAYER_CONFIG || {};
  
  // Store original and normalized (lowercased) token_id for robust matching
  const rawTokenId = (config.token_id || "").toString();
  const tokenIdOriginal = rawTokenId.trim();
  const tokenIdLower = tokenIdOriginal.toLowerCase();
  config.token_id_original = tokenIdOriginal;
  config.token_id = tokenIdLower; // normalized, lower-case token id
  console.log("[Player Init] Config:", config);

  if (!config.transcription) {
    console.error("[Player Init] No transcription URL provided");
    return;
  }

  try {
    console.log("[Player Init] Loading transcription:", config.transcription);

    // Initialize mobile handler first (affects layout)
    console.log("[Player Init] Step 1: Initializing mobile handler");
    mobileHandler = new MobileHandler();
    mobileHandler.init();

    // Initialize UI components
    console.log("[Player Init] Step 2: Initializing UI components");
    uiManager = new UIManager();
    uiManager.init();

    // Initialize token collector
    console.log("[Player Init] Step 3: Initializing token collector");
    tokenCollector = new TokenCollector();
    tokenCollector.init();

    // Initialize highlighting manager
    console.log("[Player Init] Step 4: Initializing highlighting manager");
    highlightingManager = new HighlightingManager();
    highlightingManager.init();

    // Initialize audio player if audio URL is provided
    if (config.audio) {
      console.log(
        "[Player Init] Step 5: Initializing audio player:",
        config.audio,
      );
      audioPlayer = new AudioPlayer();
      audioPlayer.init(config.audio);
    }

    // Initialize transcription manager with token collector
    console.log("[Player Init] Step 6: Initializing transcription manager");
    transcriptionManager = new TranscriptionManager(
      audioPlayer,
      tokenCollector,
    );

    // Connect audio playback events to word highlighting
    if (audioPlayer) {
      audioPlayer.onPlay = () => {
        console.log("[Player Init] Starting word highlighting");
        transcriptionManager.startWordHighlighting();
      };
      audioPlayer.onPause = () => {
        console.log("[Player Init] Stopping word highlighting");
        transcriptionManager.stopWordHighlighting();
      };
      audioPlayer.onEnded = () => {
        console.log("[Player Init] Audio ended, stopping highlighting");
        transcriptionManager.stopWordHighlighting();
      };
    }

    // Load and render transcription
    console.log("[Player Init] Step 7: Loading transcription");
    await transcriptionManager.load(config.transcription, config.token_id);

    // Initialize export manager (depends on transcription)
    console.log("[Player Init] Step 8: Initializing export manager");
    exportManager = new ExportManager(transcriptionManager);
    exportManager.init();

    // Load footer stats (if applicable)
    if (uiManager) {
      uiManager.loadFooterStats();
    }

    console.log("[Player Init] Player initialized successfully");

    // Scroll to target token if provided (backup, transcription.load should handle this)
    if (config.token_id) {
      setTimeout(() => {
        const container = document.getElementById("transcriptionContainer");
        const escaped = CSS.escape(config.token_id);
        const targetWord = container?.querySelector(
          `[data-token-id-lower="${escaped}"]`,
        );
        if (targetWord) {
          console.log("[Player Init] Scrolling to target token (backup)");
          targetWord.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }

    // Initialize back button (CSP-safe: uses event listener instead of javascript: URL)
    const backButton = document.querySelector('[data-action="go-back"]');
    if (backButton) {
      backButton.addEventListener("click", () => {
        window.history.back();
      });
    }
  } catch (error) {
    console.error("[Player Init] Error loading transcription:", error);
    showError("Fehler beim Laden der Transkription: " + error.message);
  }
}

/**
 * Show error message
 */
function showError(message) {
  const container = document.getElementById("transcriptionContainer");
  if (container) {
    container.innerHTML = `<div class="error-message">${message}</div>`;
  }
}

// Export function for use in HTML script tag with dynamic import
export { initializePlayer };
