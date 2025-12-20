/**
 * Audio Player Module
 * Handles audio playback, seeking, speed, volume, and keyboard shortcuts
 * @module player/modules/audio
 */

import { PLAYER_CONFIG } from "../config.js";

export class AudioPlayer {
  constructor() {
    this.audioElement = null;
    this.controls = {};
    this.ctrlSpaceActive = false;
    this.onPlay = null; // Callback for play event
    this.onPause = null; // Callback for pause event
    this.onEnded = null; // Callback for ended event
  }

  /**
   * Initialize audio player with controls
   * @param {string} audioFile - Path to audio file
   */
  init(audioFile) {
    this._createAudioElement(audioFile);
    this._getControlElements();
    this._setupEventListeners();
    this._setupKeyboardShortcuts();

    return this.audioElement;
  }

  /**
   * Create and configure audio element
   * @private
   */
  _createAudioElement(audioFile) {
    this.audioElement = document.createElement("audio");
    this.audioElement.id = "visualAudioPlayer";

    // Construct audio path with MEDIA_ENDPOINT
    const audioPath =
      audioFile.startsWith("/") || audioFile.startsWith("http")
        ? audioFile
        : `${PLAYER_CONFIG.MEDIA_ENDPOINT}/${audioFile}`;

    this.audioElement.src = audioPath;
    console.log("[Audio] Loading audio from:", audioPath);

    // Error handling
    this.audioElement.addEventListener("error", (e) => {
      console.error("[Audio] Failed to load:", audioPath);
      console.error("[Audio] Error details:", e);
      alert(
        `Audio konnte nicht geladen werden.\nPfad: ${audioPath}\n\nBitte prüfe, ob die Datei existiert.`,
      );
    });

    // Play/Pause/Ended events for word highlighting
    this.audioElement.addEventListener("play", () => {
      console.log("[Audio] Playing - triggering word highlighting");
      if (this.onPlay) this.onPlay();
    });

    this.audioElement.addEventListener("pause", () => {
      console.log("[Audio] Paused - stopping word highlighting");
      if (this.onPause) this.onPause();
    });

    this.audioElement.addEventListener("ended", () => {
      console.log("[Audio] Ended - stopping word highlighting");
      if (this.onEnded) this.onEnded();
    });

    document.querySelector(".custom-audio-player").prepend(this.audioElement);
  }

  /**
   * Get all control elements from DOM
   * @private
   */
  _getControlElements() {
    this.controls = {
      playPause: document.getElementById("playPauseBtn"),
      rewind: document.getElementById("rewindBtn"),
      forward: document.getElementById("forwardBtn"),
      progress: document.getElementById("progressBar"),
      volume: document.getElementById("volumeControl"),
      speed: document.getElementById("speedControlSlider"),
      mute: document.getElementById("muteBtn"),
      timeDisplay: document.getElementById("timeDisplay"),
      speedDisplay: document.getElementById("speedDisplay"),
    };
  }

  /**
   * Setup all event listeners for audio controls
   * @private
   */
  _setupEventListeners() {
    // Metadata loaded
    this.audioElement.addEventListener("loadedmetadata", () => {
      this._updateTimeDisplay();
      this.controls.progress.value = 0;
    });

    // Play/Pause button
    this.controls.playPause.addEventListener("click", () =>
      this.togglePlayPause(),
    );
    this.audioElement.addEventListener("play", () =>
      this._updatePlayPauseButton(),
    );
    this.audioElement.addEventListener("pause", () =>
      this._updatePlayPauseButton(),
    );

    // Skip buttons
    this.controls.rewind.addEventListener("click", () =>
      this.skip(-PLAYER_CONFIG.SKIP_DURATION / 1000),
    );
    this.controls.forward.addEventListener("click", () =>
      this.skip(PLAYER_CONFIG.SKIP_DURATION / 1000),
    );

    // Volume control
    this.controls.volume.addEventListener("input", (e) => {
      this.audioElement.volume = parseFloat(e.target.value);
      this._updateVolumeIcon(e.target.value);
    });

    this.controls.mute.addEventListener("click", () => {
      this.audioElement.muted = !this.audioElement.muted;
      this._updateVolumeIcon(this.controls.volume.value);
    });

    // Speed control
    this.controls.speed.addEventListener("input", (e) => {
      const speed = parseFloat(e.target.value);
      this.audioElement.playbackRate = speed;
      this.controls.speedDisplay.textContent = `${speed.toFixed(1)}x`;
    });

    // Progress bar
    this.audioElement.addEventListener("timeupdate", () => {
      this.controls.progress.value =
        (this.audioElement.currentTime / this.audioElement.duration) * 100;
      this._updateTimeDisplay();
    });

    this.controls.progress.addEventListener("input", (e) => {
      this.audioElement.currentTime =
        (e.target.value / 100) * this.audioElement.duration;
    });
  }

  /**
   * Setup keyboard shortcuts
   * @private
   */
  _setupKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      // Ctrl+Space: Play/Pause
      if (event.ctrlKey && event.code === "Space" && !this.ctrlSpaceActive) {
        this.ctrlSpaceActive = true;
        this.togglePlayPause();
        event.preventDefault();
      }

      // Ctrl+Comma: Rewind 3s
      if (event.ctrlKey && event.key === ",") {
        this.skip(-PLAYER_CONFIG.SKIP_DURATION / 1000);
        event.preventDefault();
      }

      // Ctrl+Period: Forward 3s
      if (event.ctrlKey && event.key === ".") {
        this.skip(PLAYER_CONFIG.SKIP_DURATION / 1000);
        event.preventDefault();
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.key === "Control") {
        this.ctrlSpaceActive = false;
      }
    });
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause() {
    if (this.audioElement.paused) {
      this.audioElement.play();
    } else {
      this.audioElement.pause();
    }
  }

  /**
   * Skip forward or backward
   * @param {number} seconds - Positive for forward, negative for backward
   */
  skip(seconds) {
    this.audioElement.currentTime = Math.max(
      0,
      Math.min(
        this.audioElement.duration,
        this.audioElement.currentTime + seconds,
      ),
    );

    // Animate button
    const button = seconds < 0 ? this.controls.rewind : this.controls.forward;
    this._animateButton(button);
  }

  /**
   * Play audio from specific time
   * @param {number} startTime - Start time in seconds
   * @param {number} endTime - End time in seconds (optional)
   */
  playSegment(startTime, endTime = null) {
    this.audioElement.currentTime = startTime;

    if (endTime !== null) {
      const playUntil = () => {
        if (this.audioElement.currentTime >= endTime) {
          this.audioElement.pause();
          this.audioElement.removeEventListener("timeupdate", playUntil);
        }
      };
      this.audioElement.addEventListener("timeupdate", playUntil);
    }

    this.audioElement.play();
  }

  /**
   * Update play/pause button icon
   * @private
   */
  _updatePlayPauseButton() {
    if (this.audioElement.paused || this.audioElement.ended) {
      this.controls.playPause.textContent = "play_circle";
    } else {
      this.controls.playPause.textContent = "pause_circle";
    }
  }

  /**
   * Update volume icon based on volume level
   * @private
   */
  _updateVolumeIcon(volume) {
    if (this.audioElement.muted || parseFloat(volume) === 0) {
      this.controls.mute.textContent = "volume_off";
    } else {
      this.controls.mute.textContent = "volume_up";
    }
  }

  /**
   * Update time display
   * @private
   */
  _updateTimeDisplay() {
    const currentMinutes = Math.floor(this.audioElement.currentTime / 60);
    const currentSeconds = Math.floor(this.audioElement.currentTime % 60);
    const durationMinutes = Math.floor(this.audioElement.duration / 60) || 0;
    const durationSeconds = Math.floor(this.audioElement.duration % 60) || 0;

    const pad = (num) => (num < 10 ? "0" + num : num.toString());
    this.controls.timeDisplay.textContent = `${pad(currentMinutes)}:${pad(currentSeconds)} / ${pad(durationMinutes)}:${pad(durationSeconds)}`;
  }

  /**
   * Animate button with fade effect
   * @private
   */
  _animateButton(button) {
    button.style.opacity = "0.5";
    setTimeout(() => {
      button.style.opacity = "1";
    }, 200);
  }

  /**
   * Get current audio time
   * @returns {number}
   */
  getCurrentTime() {
    return this.audioElement.currentTime;
  }

  /**
   * Get audio duration
   * @returns {number}
   */
  getDuration() {
    return this.audioElement.duration;
  }

  /**
   * Check if audio is playing
   * @returns {boolean}
   */
  isPlaying() {
    return !this.audioElement.paused && !this.audioElement.ended;
  }
}

export default AudioPlayer;
