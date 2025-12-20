/**
 * Editor Player Controller
 * Combines Player functionality with inline word editing
 * @module editor/editor-player
 */

import AudioPlayer from "../player/modules/audio.js";
import TranscriptionManager from "../player/modules/transcription.js";
import { WordEditor } from "./word-editor.js";
import BookmarkManager from "./bookmark-manager.js";
import { HistoryPanel } from "./history-panel.js";

export class EditorPlayer {
  constructor(config) {
    this.config = config;
    this.audio = null;
    this.transcription = null;
    this.editor = null;
    this.bookmarks = null;
    this.history = null;
    this.transcriptData = null;
  }

  /**
   * Initialize the editor player
   */
  async init() {
    console.log("[EditorPlayer] Initializing...");

    try {
      // Initialize audio player with file from config
      this.audio = new AudioPlayer();

      // Use /media/full endpoint for MP3 (same as player.html uses)
      const audioPath = `/media/full/${this.config.audioFile}`;
      this.audio.init(audioPath);

      // Initialize transcription manager
      this.transcription = new TranscriptionManager(this.audio, null); // No token collector

      // In editor mode: disable only normal clicks, but keep Ctrl+Click and Shift+Click
      this.transcription.disableNormalClick = true;

      // Connect audio playback events to word highlighting
      this.audio.onPlay = () => {
        console.log("[EditorPlayer] Starting word highlighting");
        this.transcription.startWordHighlighting();
      };
      this.audio.onPause = () => {
        console.log("[EditorPlayer] Stopping word highlighting");
        this.transcription.stopWordHighlighting();
      };
      this.audio.onEnded = () => {
        console.log("[EditorPlayer] Audio ended, stopping highlighting");
        this.transcription.stopWordHighlighting();
      };

      // Load and render transcription using TranscriptionManager's load method
      const transcriptPath = `/media/transcripts/${this.config.transcriptFile}`;
      await this.transcription.load(transcriptPath);

      // Store transcript data for editor
      this.transcriptData = this.transcription.transcriptionData;

      // Initialize word editor
      this.editor = new WordEditor(this.transcriptData, this.config);
      this.editor.attachToTranscription(this.transcription);

      // Initialize speaker selection (no longer requires speakers array)
      this.editor.initializeSpeakerSelection();

      // Initialize bookmark manager
      this.bookmarks = new BookmarkManager(this.transcriptData, this.config);
      this.bookmarks.attachToAudioPlayer(this.audio);
      window.bookmarkManager = this.bookmarks; // Global reference for bookmark list clicks

      // Initialize history panel
      this.history = new HistoryPanel({
        country: this.config.country,
        filename: this.config.filename,
        apiBaseUrl: this.config.apiBaseUrl,
      });

      // Modify word click behavior for editing
      this._setupEditingBehavior();

      // Setup speaker editing behavior (in editor mode)
      this._setupSpeakerEditingBehavior();

      // Setup unsaved changes warning
      this._setupUnsavedChangesWarning();

      console.log("[EditorPlayer] Initialization complete");
    } catch (error) {
      console.error("[EditorPlayer] Initialization failed:", error);
      alert("Fehler beim Laden des Editors. Bitte Seite neu laden.");
    }
  }

  /**
   * Setup editing behavior on word clicks
   * @private
   */
  _setupEditingBehavior() {
    const container = document.getElementById("transcriptionContainer");

    container.addEventListener("click", (e) => {
      const wordSpan = e.target.closest(".word");
      if (!wordSpan) return;

      // Ctrl+Click and Shift+Click are handled by transcription.js for audio playback
      // Only handle normal clicks for editing here
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        return; // Let transcription.js handle these
      }

      // Normal click: start editing
      if (!wordSpan.classList.contains("editing")) {
        this.editor.startEditing(wordSpan);
      }
    });

    console.log("[EditorPlayer] Editing behavior setup complete");
  }

  /**
   * Setup speaker editing behavior
   * @private
   */
  _setupSpeakerEditingBehavior() {
    const container = document.getElementById("transcriptionContainer");

    // Handle speaker icon clicks to open speaker selection
    container.addEventListener("click", (e) => {
      // Check if an icon was clicked - MD3 uses material-symbols-rounded or md3-speaker-edit-icon
      const isIcon =
        e.target.classList.contains("md3-speaker-edit-icon") ||
        (e.target.classList.contains("material-symbols-rounded") &&
          e.target.closest(".md3-speaker-header"));

      if (!isIcon) return;

      // Get segment index from icon's data attribute or closest speaker-turn
      let segmentIndex = e.target.getAttribute("data-segment-index");

      if (!segmentIndex) {
        // Fallback: get from parent .speaker-name (legacy) or .md3-speaker-turn
        const speakerName = e.target.closest(".speaker-name");
        const speakerTurn = e.target.closest(".md3-speaker-turn");

        if (speakerName) {
          segmentIndex = speakerName.getAttribute("data-segment-index");
        } else if (speakerTurn) {
          segmentIndex = speakerTurn.getAttribute("data-segment-index");
        }
      }

      const currentSpeaker =
        this.transcriptData.segments[segmentIndex]?.speaker_code ||
        this.transcriptData.segments[segmentIndex]?.speaker;

      if (segmentIndex !== null && currentSpeaker) {
        this.editor.openSpeakerSelection(
          parseInt(segmentIndex),
          currentSpeaker,
        );
      }
    });

    console.log("[EditorPlayer] Speaker editing behavior setup complete");
  }

  /**
   * Setup warning for unsaved changes when leaving page
   */
  _setupUnsavedChangesWarning() {
    // Monitor editor state for unsaved changes
    const backLink = document.querySelector(".back-link");
    const saveBtn = document.getElementById("save-btn");
    const discardBtn = document.getElementById("discard-btn");

    // Flag to suppress beforeunload during intentional navigation
    let allowNavigation = false;

    // beforeunload event for navigation, reload, close
    window.addEventListener("beforeunload", (e) => {
      if (!allowNavigation && this.editor && this.editor.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    });

    // Back link handler
    if (backLink) {
      backLink.addEventListener("click", (e) => {
        if (this.editor && this.editor.hasUnsavedChanges()) {
          e.preventDefault();
          const confirmed = confirm(
            "Es gibt ungespeicherte Änderungen. Möchten Sie diese speichern, bevor Sie gehen?",
          );
          if (confirmed) {
            // Enable navigation after save
            allowNavigation = true;
            saveBtn.click();
            // After save, navigate back
            setTimeout(() => {
              window.location.href = backLink.href;
            }, 500);
          } else {
            // User chose not to save, go back anyway
            allowNavigation = true;
            window.location.href = backLink.href;
          }
        }
      });
    }

    // Also allow navigation when save completes (via save success handler)
    // Listen for save completion and disable beforeunload warning
    const originalSaveBtn = saveBtn;
    if (originalSaveBtn) {
      originalSaveBtn.addEventListener("click", () => {
        // After successful save, disable the warning temporarily
        const checkSaveComplete = setInterval(() => {
          const saveIndicator = document.getElementById("save-indicator");
          if (
            saveIndicator &&
            saveIndicator.classList.contains("md3-editor-status-saved")
          ) {
            allowNavigation = true;
            clearInterval(checkSaveComplete);
          }
        }, 100);

        // Timeout after 2 seconds
        setTimeout(() => clearInterval(checkSaveComplete), 2000);
      });
    }

    // Discard button: Allow navigation without save
    if (discardBtn) {
      discardBtn.addEventListener("click", () => {
        allowNavigation = true;
      });
    }

    console.log("[EditorPlayer] Unsaved changes warning setup complete");
  }
}
