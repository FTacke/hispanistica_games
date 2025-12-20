/**
 * AudioPlayer - Audio playback with transcript sync
 *
 * Features:
 * - Play/pause, seek, volume control
 * - Highlights currently playing word
 * - Click word to seek to timestamp
 * - Time display and progress bar
 */

export class AudioPlayer {
  constructor(audioElement, transcriptData) {
    this.audio = audioElement;
    this.data = transcriptData;
    this.renderer = null;
    this.isPlaying = false;
    this.currentWordPosition = null;

    this.initializeControls();
    this.attachEventListeners();
  }

  /**
   * Attach to renderer for word highlighting
   */
  attachToRenderer(renderer) {
    this.renderer = renderer;
    this.attachTranscriptListeners();
  }

  /**
   * Initialize UI controls
   */
  initializeControls() {
    this.playPauseBtn = document.getElementById("playPauseBtn");
    this.progressBar = document.getElementById("progressBar");
    this.volumeControl = document.getElementById("volumeControl");
    this.muteBtn = document.getElementById("muteBtn");
    this.rewindBtn = document.getElementById("rewindBtn");
    this.forwardBtn = document.getElementById("forwardBtn");
    this.speedControl = document.getElementById("speedControlSlider");
    this.speedDisplay = document.getElementById("speedDisplay");
    this.timeDisplay = document.getElementById("timeDisplay");
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Play/Pause button
    this.playPauseBtn.addEventListener("click", () => this.togglePlayPause());

    // Skip buttons (±3s)
    this.rewindBtn.addEventListener("click", () => this.skip(-3));
    this.forwardBtn.addEventListener("click", () => this.skip(3));

    // Audio events
    this.audio.addEventListener("loadedmetadata", () =>
      this.onMetadataLoaded(),
    );
    this.audio.addEventListener("timeupdate", () => this.onTimeUpdate());
    this.audio.addEventListener("ended", () => this.onEnded());
    this.audio.addEventListener("play", () => this.onPlay());
    this.audio.addEventListener("pause", () => this.onPause());

    // Progress bar
    this.progressBar.addEventListener("input", (e) => this.onSeek(e));

    // Volume control
    this.volumeControl.addEventListener("input", (e) => this.onVolumeChange(e));
    this.muteBtn.addEventListener("click", () => this.toggleMute());
    this.audio.volume = 1.0; // Initial volume

    // Speed control
    this.speedControl.addEventListener("input", (e) => this.onSpeedChange(e));

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Space = play/pause (if not editing)
      if (e.code === "Space" && !e.target.matches('[contenteditable="true"]')) {
        e.preventDefault();
        this.togglePlayPause();
      }
      // Arrow Left = -3s
      if (
        e.code === "ArrowLeft" &&
        !e.target.matches('[contenteditable="true"]')
      ) {
        e.preventDefault();
        this.skip(-3);
      }
      // Arrow Right = +3s
      if (
        e.code === "ArrowRight" &&
        !e.target.matches('[contenteditable="true"]')
      ) {
        e.preventDefault();
        this.skip(3);
      }
    });
  }

  /**
   * Attach click-to-seek listeners to transcript words
   */
  attachTranscriptListeners() {
    const transcriptContainer = document.getElementById("transcript-content");

    transcriptContainer.addEventListener("click", (e) => {
      const wordSpan = e.target.closest(".word");
      if (wordSpan && !wordSpan.classList.contains("editing")) {
        const start = parseFloat(wordSpan.dataset.start);
        if (!isNaN(start)) {
          this.seekTo(start);
        }
      }
    });
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause() {
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
  }

  /**
   * Skip forward/backward by seconds
   */
  skip(seconds) {
    this.audio.currentTime = Math.max(
      0,
      Math.min(this.audio.duration, this.audio.currentTime + seconds),
    );
  }

  /**
   * Seek to specific time
   */
  seekTo(time) {
    this.audio.currentTime = time;
    console.log(`[Player] Seeked to ${this.formatTime(time)}`);
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.updateMuteIcon();
  }

  /**
   * Update mute icon - MD3: Use Material Symbols via textContent
   */
  updateMuteIcon() {
    // The muteBtn is now a <span class="material-symbols-rounded">
    if (this.audio.muted || this.audio.volume === 0) {
      this.muteBtn.textContent = 'volume_off';
    } else if (this.audio.volume > 0.5) {
      this.muteBtn.textContent = 'volume_up';
    } else {
      this.muteBtn.textContent = 'volume_down';
    }
  }

  /**
   * Metadata loaded handler
   */
  onMetadataLoaded() {
    const duration = this.audio.duration;
    this.progressBar.max = duration;
    this.updateTimeDisplay();
    console.log(`[Player] Loaded, duration: ${this.formatTime(duration)}`);
  }

  /**
   * Time update handler (fires during playback)
   */
  onTimeUpdate() {
    const currentTime = this.audio.currentTime;
    const duration = this.audio.duration;

    // Update progress bar
    this.progressBar.value = currentTime;

    // Update time display
    this.updateTimeDisplay();

    // Highlight current word
    if (this.renderer) {
      const wordInfo = this.renderer.findWordAtTime(currentTime);

      if (
        wordInfo &&
        (this.currentWordPosition?.segmentIndex !== wordInfo.segmentIndex ||
          this.currentWordPosition?.wordIndex !== wordInfo.wordIndex)
      ) {
        this.renderer.highlightWord(wordInfo.segmentIndex, wordInfo.wordIndex);
        this.currentWordPosition = wordInfo;
      }
    }
  }

  /**
   * Update time display
   */
  updateTimeDisplay() {
    const current = this.formatTime(this.audio.currentTime);
    const total = this.formatTime(this.audio.duration || 0);
    this.timeDisplay.textContent = `${current} / ${total}`;
  }

  /**
   * Progress bar input handler
   */
  onSeek(event) {
    const time = parseFloat(event.target.value);
    this.audio.currentTime = time;
  }

  /**
   * Volume change handler
   */
  onVolumeChange(event) {
    const volume = parseFloat(event.target.value);
    this.audio.volume = volume;
    this.updateMuteIcon();
  }

  /**
   * Speed change handler
   */
  onSpeedChange(event) {
    const speed = parseFloat(event.target.value);
    this.audio.playbackRate = speed;
    this.speedDisplay.textContent = `${speed.toFixed(1)}x`;
  }

  /**
   * Play event handler
   */
  onPlay() {
    this.isPlaying = true;
    this.playPauseBtn.className = "bi bi-pause-circle-fill play-icon";
    console.log("[Player] Playing");
  }

  /**
   * Pause event handler
   */
  onPause() {
    this.isPlaying = false;
    this.playPauseBtn.className = "bi bi-play-circle-fill play-icon";
    console.log("[Player] Paused");
  }

  /**
   * Ended event handler
   */
  onEnded() {
    this.isPlaying = false;
    this.playPauseBtn.className = "bi bi-play-circle-fill play-icon";
    if (this.renderer) {
      this.renderer.clearHighlight();
    }
    console.log("[Player] Ended");
  }

  /**
   * Format seconds to MM:SS
   */
  formatTime(seconds) {
    if (!isFinite(seconds)) return "00:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
}
