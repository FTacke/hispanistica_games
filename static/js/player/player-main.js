/**
 * Player Main Controller
 * Orchestrates all player modules and initializes the application
 * @module player/player-main
 */

import AudioPlayer from "./modules/audio.js";
import TokenCollector from "./modules/tokens.js";
import TranscriptionManager from "./modules/transcription.js";
import HighlightingManager from "./modules/highlighting.js";
import ExportManager from "./modules/export.js";
import UIManager from "./modules/ui.js";
import MobileHandler from "./modules/mobile.js";
import { trackAudioPlay } from "../modules/analytics.js";

class PlayerController {
  constructor() {
    // Initialize modules
    this.audio = new AudioPlayer();
    this.tokens = new TokenCollector();
    this.mobile = new MobileHandler();
    this.highlighting = new HighlightingManager();
    this.ui = new UIManager();

    // Modules that depend on others
    this.transcription = null;
    this.export = null;

    // URL parameters
    this.audioFile = null;
    this.transcriptionFile = null;
    this.targetTokenId = null;
  }

  /**
   * Initialize the player application
   */
  async init() {
    console.log("[Player] Initializing...");

    try {
      // Parse URL parameters
      console.log("[Player] Step 1: Parsing URL parameters");
      this._parseURLParameters();

      // Initialize mobile handler first (affects layout)
      console.log("[Player] Step 2: Initializing mobile handler");
      this.mobile.init();

      // Initialize UI components
      console.log("[Player] Step 3: Initializing UI components");
      this.ui.init();
      this.tokens.init();
      this.highlighting.init();

      // Initialize audio player
      console.log("[Player] Step 4: Initializing audio player");
      if (this.audioFile) {
        console.log("[Player] Audio file (raw):", this.audioFile);
        this.audio.init(this.audioFile);
      } else {
        console.warn("[Player] No audio file specified");
      }

      // Initialize transcription (depends on audio & tokens)
      console.log("[Player] Step 5: Initializing transcription manager");
      this.transcription = new TranscriptionManager(this.audio, this.tokens);

      // Track first audio play for analytics (once per session)
      let audioPlayTracked = false;

      // Connect audio playback events to word highlighting
      this.audio.onPlay = () => {
        this.transcription.startWordHighlighting();
        // Track audio play event (anonymous, only once per player instance)
        if (!audioPlayTracked) {
          trackAudioPlay();
          audioPlayTracked = true;
        }
      };
      this.audio.onPause = () => this.transcription.stopWordHighlighting();
      this.audio.onEnded = () => this.transcription.stopWordHighlighting();

      console.log("[Player] Step 6: Loading transcription");
      if (this.transcriptionFile) {
        console.log(
          "[Player] Transcription file:",
          this.transcriptionFile,
          "token_id:",
          this.targetTokenId,
        );
        await this.transcription.load(
          this.transcriptionFile,
          this.targetTokenId,
        );
      } else {
        console.warn("[Player] No transcription file specified");
      }

      // Initialize export (depends on transcription)
      this.export = new ExportManager(this.transcription);
      this.export.init();

      // Load footer stats (if applicable)
      this.ui.loadFooterStats();

      console.log("[Player] Initialization complete");
    } catch (error) {
      console.error("[Player] Initialization failed:", error);
      alert("Fehler beim Laden des Players. Bitte Seite neu laden.");
    }
  }

  /**
   * Parse URL parameters
   * @private
   */
  _parseURLParameters() {
    // First, try to get from template variables (most reliable)
    if (window.PLAYER_CONFIG) {
      this.transcriptionFile = window.PLAYER_CONFIG.transcription;
      this.audioFile = window.PLAYER_CONFIG.audio;
      this.targetTokenId = window.PLAYER_CONFIG.token_id;

      console.log("[Player] Config from template:", {
        audio: this.audioFile,
        transcription: this.transcriptionFile,
        token_id: this.targetTokenId,
      });
      return;
    }

    // Fallback: Parse from URL parameters
    const params = new URLSearchParams(window.location.search);

    this.audioFile = params.get("audio");
    this.transcriptionFile = params.get("transcription");
    this.targetTokenId = params.get("token_id");

    console.log("[Player] URL Parameters (fallback):", {
      audio: this.audioFile,
      transcription: this.transcriptionFile,
      token_id: this.targetTokenId,
    });
  }

  /**
   * Get audio player instance
   * @returns {AudioPlayer}
   */
  getAudio() {
    return this.audio;
  }

  /**
   * Get token collector instance
   * @returns {TokenCollector}
   */
  getTokens() {
    return this.tokens;
  }

  /**
   * Get transcription manager instance
   * @returns {TranscriptionManager}
   */
  getTranscription() {
    return this.transcription;
  }

  /**
   * Get highlighting manager instance
   * @returns {HighlightingManager}
   */
  getHighlighting() {
    return this.highlighting;
  }

  /**
   * Get export manager instance
   * @returns {ExportManager}
   */
  getExport() {
    return this.export;
  }

  /**
   * Get UI manager instance
   * @returns {UIManager}
   */
  getUI() {
    return this.ui;
  }

  /**
   * Get mobile handler instance
   * @returns {MobileHandler}
   */
  getMobile() {
    return this.mobile;
  }
}

// Auto-initialize on DOMContentLoaded
// Note: Authentication is now handled by /auth/ready intermediate page
// which polls /auth/session until cookies are confirmed.
// By the time this page loads, the user is guaranteed to be authenticated.
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Player] DOM Content Loaded - initializing player");

  try {
    // Create global player instance
    window.corapanPlayer = new PlayerController();
    console.log("[Player] PlayerController created successfully");
    window.corapanPlayer.init();
  } catch (error) {
    console.error("[Player] Initialization error:", error);
    alert("Fehler beim Laden des Players: " + error.message);
  }
});

// Also try to initialize immediately if DOM is already loaded
if (document.readyState === "loading") {
  console.log("[Player] Module loading, waiting for DOMContentLoaded");
} else {
  console.log(
    "[Player] Module loaded after DOMContentLoaded, initializing now",
  );
  try {
    window.corapanPlayer = new PlayerController();
    window.corapanPlayer.init();
  } catch (error) {
    console.error("[Player] Immediate initialization error:", error);
  }
}

// Export for potential manual initialization
export default PlayerController;
