/**
 * BookmarkManager - Handles segment bookmarking and retrieval
 *
 * Features:
 * - Add/remove bookmarks for segments
 * - Display bookmark list with jump-to functionality
 * - Visual indicators for bookmarked segments
 * - Persistent storage (in JSON)
 * - Auto-tracks current playing segment
 */

export class BookmarkManager {
  constructor(transcriptData, config) {
    this.data = transcriptData;
    this.config = config;
    this.bookmarks = transcriptData.bookmarks || [];
    this.audioPlayer = null;
    this.currentSegmentIndex = null;
    this.segmentTrackingInterval = null;

    this.initializeUI();
  }

  /**
   * Initialize bookmark UI elements
   */
  initializeUI() {
    this.bookmarkBtn = document.getElementById("bookmark-btn");
    this.bookmarkList = document.getElementById("bookmark-list");

    if (this.bookmarkBtn) {
      this.bookmarkBtn.addEventListener("click", () => this.toggleBookmark());
    }

    // Add click listener to transcription container - bubbling from words
    const container = document.getElementById("transcriptionContainer");
    if (container) {
      container.addEventListener("click", (e) => {
        // Find the closest .word element (in case click was on a child)
        const wordEl = e.target.closest(".word");
        if (wordEl) {
          let segIdx = null;

          // First try: get from word's data-groupIndex
          const groupIndex = wordEl.getAttribute("data-groupIndex");
          if (groupIndex) {
            const [segmentIndex] = groupIndex.split("-");
            segIdx = parseInt(segmentIndex);
          }

          // Fallback: get from parent .md3-speaker-turn data-segment-index
          if (segIdx === null) {
            const speakerTurn = wordEl.closest(".md3-speaker-turn");
            if (speakerTurn) {
              const segmentIndexAttr =
                speakerTurn.getAttribute("data-segment-index");
              if (segmentIndexAttr) {
                segIdx = parseInt(segmentIndexAttr);
              }
            }
          }

          if (segIdx !== null) {
            if (this.currentSegmentIndex !== segIdx) {
              this.currentSegmentIndex = segIdx;
              console.log(
                "[BookmarkManager] Segment selected by word click:",
                segIdx,
                "Word:",
                wordEl.textContent.trim(),
              );
              this.updateBookmarkButton();
            }
          } else {
            console.warn(
              "[BookmarkManager] Could not find segment index for word:",
              wordEl.textContent.trim(),
            );
          }
        }
      });
      console.log(
        "[BookmarkManager] Click listener registered on transcriptionContainer",
      );
    } else {
      console.warn(
        "[BookmarkManager] transcriptionContainer not found - click tracking disabled",
      );
    }

    // Start tracking current segment
    this.startTrackingCurrentSegment();

    // Re-render bookmark list
    this.renderBookmarkList();
  }

  /**
   * Start tracking which segment is currently playing/highlighted
   */
  startTrackingCurrentSegment() {
    this.segmentTrackingInterval = setInterval(() => {
      // Find first word with .playing class (only if audio is actually playing)
      const playingWord = document.querySelector(".word.playing");

      if (playingWord) {
        const groupIndex = playingWord.getAttribute("data-groupIndex");
        if (groupIndex) {
          // groupIndex format: "segmentIndex-groupIndex"
          const [segmentIndex] = groupIndex.split("-");
          const segIdx = parseInt(segmentIndex);

          if (this.currentSegmentIndex !== segIdx) {
            this.currentSegmentIndex = segIdx;
            console.log(
              "[BookmarkManager] Current segment changed (via playing word):",
              segIdx,
            );
            this.updateBookmarkButton();
          }
        }
      }
      // NOTE: Disabled scroll-based tracking as it was interfering with user clicks
      // Segment is now updated on user word clicks via click listener
    }, 500); // Check every 500ms
  }

  /**
   * Stop tracking segment
   */
  stopTrackingCurrentSegment() {
    if (this.segmentTrackingInterval) {
      clearInterval(this.segmentTrackingInterval);
      this.segmentTrackingInterval = null;
    }
  }

  /**
   * Attach to audio player for seek functionality
   */
  attachToAudioPlayer(audioPlayer) {
    this.audioPlayer = audioPlayer;
  }

  /**
   * Set current segment manually (for direct control)
   */
  setCurrentSegment(segmentIndex) {
    this.currentSegmentIndex = segmentIndex;
    this.updateBookmarkButton();
  }

  /**
   * Toggle bookmark for current segment
   */
  toggleBookmark() {
    if (
      this.currentSegmentIndex === null ||
      this.currentSegmentIndex === undefined
    ) {
      console.warn("[BookmarkManager] No current segment selected", {
        currentSegmentIndex: this.currentSegmentIndex,
        totalSegments: this.data.segments?.length,
      });
      alert("Bitte wähle erst ein Segment aus (durch Abspielen oder Scrollen)");
      return;
    }

    const isBookmarked = this.isBookmarked(this.currentSegmentIndex);

    console.log(
      "[BookmarkManager] Toggling bookmark for segment",
      this.currentSegmentIndex,
      {
        isCurrentlyBookmarked: isBookmarked,
        allBookmarks: this.bookmarks,
      },
    );

    if (isBookmarked) {
      this.removeBookmark(this.currentSegmentIndex);
    } else {
      this.addBookmark(this.currentSegmentIndex);
    }
  }

  /**
   * Add bookmark to segment
   */
  async addBookmark(segmentIndex, note = "") {
    console.log("[BookmarkManager] Adding bookmark for segment", segmentIndex, {
      note,
    });

    try {
      const payload = {
        file: this.config.transcriptFile,
        segment_index: segmentIndex,
        note: note,
      };

      console.log(
        "[BookmarkManager] Sending request to",
        this.config.apiEndpoints.addBookmark,
        payload,
      );

      const response = await fetch(this.config.apiEndpoints.addBookmark, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("[BookmarkManager] Response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error("[BookmarkManager] Error response:", error);
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("[BookmarkManager] Success response:", result);

      // Add to local bookmarks array
      this.bookmarks.push(result.bookmark);

      // Update data
      if (!this.data.bookmarks) {
        this.data.bookmarks = [];
      }
      this.data.bookmarks.push(result.bookmark);

      // Update UI
      this.updateBookmarkButton();
      this.renderBookmarkList();

      console.log("[BookmarkManager] Bookmark added successfully", {
        segment: segmentIndex,
        totalBookmarks: this.bookmarks.length,
      });
    } catch (error) {
      console.error("[BookmarkManager] Failed to add bookmark:", error);
      alert(`Bookmark hinzufügen fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Remove bookmark from segment
   */
  async removeBookmark(segmentIndex) {
    console.log(
      "[BookmarkManager] Removing bookmark for segment",
      segmentIndex,
    );

    try {
      const payload = {
        file: this.config.transcriptFile,
        segment_index: segmentIndex,
      };

      const response = await fetch(this.config.apiEndpoints.removeBookmark, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("[BookmarkManager] Response status:", response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error("[BookmarkManager] Error response:", error);
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      // Remove from local bookmarks array
      this.bookmarks = this.bookmarks.filter(
        (b) => b.segment_index !== segmentIndex,
      );

      // Update data
      if (this.data.bookmarks) {
        this.data.bookmarks = this.data.bookmarks.filter(
          (b) => b.segment_index !== segmentIndex,
        );
      }

      // Update UI
      this.updateBookmarkButton();
      this.renderBookmarkList();

      console.log("[BookmarkManager] Bookmark removed successfully", {
        segment: segmentIndex,
        remainingBookmarks: this.bookmarks.length,
      });
    } catch (error) {
      console.error("[BookmarkManager] Failed to remove bookmark:", error);
      alert(`Bookmark entfernen fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Check if segment is bookmarked
   */
  isBookmarked(segmentIndex) {
    return this.bookmarks.some((b) => b.segment_index === segmentIndex);
  }

  /**
   * Update bookmark button state
   */
  updateBookmarkButton() {
    if (!this.bookmarkBtn) {
      console.warn("[BookmarkManager] Bookmark button not found in DOM");
      return;
    }

    if (this.currentSegmentIndex === null) {
      console.log("[BookmarkManager] No segment selected for button update");
      this.bookmarkBtn.classList.remove("bookmarked");
      this.bookmarkBtn.innerHTML = '<i class="bi bi-bookmark"></i> Bookmark';
      return;
    }

    const isBookmarked = this.isBookmarked(this.currentSegmentIndex);
    console.log(
      "[BookmarkManager] Updating button - Segment:",
      this.currentSegmentIndex,
      "Is bookmarked:",
      isBookmarked,
      "Total bookmarks:",
      this.bookmarks.length,
    );

    if (isBookmarked) {
      this.bookmarkBtn.classList.add("bookmarked");
      this.bookmarkBtn.innerHTML =
        '<i class="bi bi-bookmark-fill"></i> Bookmark';
    } else {
      this.bookmarkBtn.classList.remove("bookmarked");
      this.bookmarkBtn.innerHTML = '<i class="bi bi-bookmark"></i> Bookmark';
    }
  }

  /**
   * Render bookmark list
   */
  renderBookmarkList() {
    if (!this.bookmarkList) return;

    // Sort bookmarks by segment index
    const sorted = [...this.bookmarks].sort(
      (a, b) => a.segment_index - b.segment_index,
    );

    if (sorted.length === 0) {
      this.bookmarkList.innerHTML =
        '<p class="md3-editor-history-empty">Keine Bookmarks</p>';
      this._removeAllBookmarkIndicators();
      return;
    }

    // Render using real DOM nodes (avoid inline event attributes for CSP)
    const ul = document.createElement('ul');

    sorted.forEach((bookmark) => {
      const segmentIndex = bookmark.segment_index;
      const segment = this.data.segments?.[segmentIndex];

      if (!segment) return;

      // Get speaker code (use speaker_code directly)
      const speakerCode = segment.speaker_code || segment.speaker || "Unknown";

      // Get first few words as preview
      const words = segment.words?.slice(0, 8) || [];
      const preview = words.map((w) => w.text || w.word).join(" ");

      // Get time
      const time = (segment.words?.[0]?.start_ms || 0) / 1000;
      const timeStr = this._formatTime(time);

      const li = document.createElement('li');
      li.className = 'md3-editor-bookmark-item';

      // click on list item jumps to segment
      li.addEventListener('click', () => this.jumpToSegment(segmentIndex));

      const header = document.createElement('div');
      header.className = 'md3-editor-bookmark-header';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'md3-editor-bookmark-time';
      timeSpan.textContent = `${speakerCode} ${timeStr}`;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'md3-editor-bookmark-remove-btn';
      removeBtn.title = 'Bookmark entfernen';
      removeBtn.innerHTML = '<i class="bi bi-x"></i>';
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.removeBookmark(segmentIndex);
      });

      header.appendChild(timeSpan);
      header.appendChild(removeBtn);

      const textDiv = document.createElement('div');
      textDiv.className = 'md3-editor-bookmark-text';
      textDiv.textContent = preview;

      li.appendChild(header);
      li.appendChild(textDiv);

      if (bookmark.note) {
        const noteEl = document.createElement('div');
        noteEl.className = 'md3-editor-bookmark-note';
        noteEl.textContent = `Note: ${bookmark.note}`;
        li.appendChild(noteEl);
      }

      ul.appendChild(li);
    });

    // replace contents
    this.bookmarkList.innerHTML = '';
    this.bookmarkList.appendChild(ul);

    // Update visual indicators in transcript
    this._updateBookmarkIndicators();
  }

  /**
   * Update bookmark indicators in transcript (visual highlighting)
   * @private
   */
  _updateBookmarkIndicators() {
    // Remove all existing indicators
    this._removeAllBookmarkIndicators();

    // Add indicator to bookmarked segments
    this.bookmarks.forEach((bookmark) => {
      const segmentEl = document.querySelector(
        `.md3-speaker-turn[data-segment-index="${bookmark.segment_index}"]`,
      );
      if (segmentEl) {
        segmentEl.classList.add("has-bookmark");

        // Add bookmark icon to speaker text (not speaker name)
        const speakerText = segmentEl.querySelector(
          ".md3-speaker-text, .speaker-text",
        );
        if (speakerText && !speakerText.querySelector(".bookmark-indicator")) {
          const indicator = document.createElement("span");
          indicator.className = "bookmark-indicator";
          indicator.innerHTML = '<i class="bi bi-bookmark-star-fill"></i>';
          indicator.title = "Bookmark";
          speakerText.insertBefore(indicator, speakerText.firstChild);
        }
      }
    });
  }

  /**
   * Remove all bookmark indicators from transcript
   * @private
   */
  _removeAllBookmarkIndicators() {
    document
      .querySelectorAll(".md3-speaker-turn.has-bookmark")
      .forEach((el) => {
        el.classList.remove("has-bookmark");
      });
    document.querySelectorAll(".bookmark-indicator").forEach((el) => {
      el.remove();
    });
  }

  /**
   * Jump to segment with bookmark
   */
  jumpToSegment(segmentIndex) {
    const segment = this.data.segments?.[segmentIndex];
    if (!segment || !segment.words || segment.words.length === 0) return;

    // Scroll to segment (center in viewport with padding)
    const segmentEl = document.querySelector(
      `.md3-speaker-turn[data-segment-index="${segmentIndex}"]`,
    );
    if (segmentEl) {
      // Scroll to center of viewport with some top padding for context
      const container = document.getElementById("transcriptionContainer");
      if (container) {
        const rect = segmentEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollPosition =
          container.scrollTop + (rect.top - containerRect.top) - 100; // 100px from top
        container.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: "smooth",
        });
      } else {
        segmentEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Highlight segment briefly
      this._highlightSegment(segmentIndex);
    }

    // Seek to start of segment and play
    const startTime = segment.words[0].start_ms / 1000;
    const endTime = segment.words[segment.words.length - 1].end_ms / 1000;
    if (this.audioPlayer) {
      // Use playSegment to set time and play
      this.audioPlayer.playSegment(startTime, endTime);
    }

    console.log("[BookmarkManager] Jumped to segment", segmentIndex);
  }

  /**
   * Highlight segment temporarily
   * @private
   */
  _highlightSegment(segmentIndex) {
    const segmentEl = document.querySelector(
      `.md3-speaker-turn[data-segment-index="${segmentIndex}"]`,
    );
    if (!segmentEl) return;

    // Add highlight class
    segmentEl.classList.add("bookmark-highlight");

    // Remove after 1.5 seconds
    setTimeout(() => {
      segmentEl.classList.remove("bookmark-highlight");
    }, 1500);
  }

  /**
   * Format time in MM:SS
   */
  _formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}

export default BookmarkManager;
