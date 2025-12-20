/**
 * TranscriptRenderer - Renders JSON transcript to interactive HTML
 *
 * Features:
 * - Renders segments with speaker labels
 * - Creates clickable word spans with data-token-id
 * - Highlights currently playing word
 * - Scrolls to active segment
 */

export class TranscriptRenderer {
  constructor(transcriptData) {
    this.data = transcriptData;
    this.segments = transcriptData.segments || [];
    this.currentWordElement = null;
    this.activeSegmentIndex = null;
  }

  /**
   * Render full transcript to container
   */
  render(container) {
    container.innerHTML = "";

    if (this.segments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-file-earmark-x"></i>
          <p>Keine Segmente im Transcript gefunden.</p>
        </div>
      `;
      return;
    }

    const transcriptWrapper = document.createElement("div");
    transcriptWrapper.className = "transcript-wrapper";

    this.segments.forEach((segment, segmentIndex) => {
      const segmentEl = this.renderSegment(segment, segmentIndex);
      transcriptWrapper.appendChild(segmentEl);
    });

    container.appendChild(transcriptWrapper);
    console.log(`[Renderer] Rendered ${this.segments.length} segments`);
  }

  /**
   * Render single segment with speaker label and words
   */
  renderSegment(segment, segmentIndex) {
    const segmentEl = document.createElement("div");
    segmentEl.className = "transcript-segment";
    segmentEl.dataset.segmentIndex = segmentIndex;

    // Speaker label (use speaker_code directly)
    const speakerCode = segment.speaker_code || segment.speaker || "Unknown";
    const speakerEl = document.createElement("div");
    speakerEl.className = "speaker-label";
    speakerEl.innerHTML = `
      <span class="speaker-name">${speakerCode}</span>
      <span class="segment-index">#${segmentIndex + 1}</span>
    `;
    segmentEl.appendChild(speakerEl);

    // Words container
    const wordsEl = document.createElement("div");
    wordsEl.className = "segment-words";

    if (!segment.words || segment.words.length === 0) {
      wordsEl.innerHTML = '<span class="empty-segment">[Leeres Segment]</span>';
    } else {
      segment.words.forEach((wordData, wordIndex) => {
        const wordSpan = this.createWordSpan(wordData, segmentIndex, wordIndex);
        wordsEl.appendChild(wordSpan);

        // Add space after word (except last word)
        if (wordIndex < segment.words.length - 1) {
          wordsEl.appendChild(document.createTextNode(" "));
        }
      });
    }

    segmentEl.appendChild(wordsEl);
    return segmentEl;
  }

  /**
   * Create interactive word span element
   */
  createWordSpan(wordData, segmentIndex, wordIndex) {
    const span = document.createElement("span");
    span.className = "word";
    // JSON uses "text" not "word"
    span.textContent = wordData.text || wordData.word || "[?]";

    // Data attributes for identification and interaction
    span.dataset.tokenId = wordData.token_id;
    span.dataset.tokenIdLower = wordData.token_id
      ? String(wordData.token_id).trim().toLowerCase()
      : "";
    span.dataset.segmentIndex = segmentIndex;
    span.dataset.wordIndex = wordIndex;
    span.dataset.start = wordData.start_ms / 1000;
    span.dataset.end = wordData.end_ms / 1000;

    // Make clickable for seek-to-timestamp
    const wordText = wordData.text || wordData.word || "[?]";
    span.title = `${wordText} (${this.formatTime(wordData.start_ms / 1000)} - ${this.formatTime(wordData.end_ms / 1000)})`;

    return span;
  }

  /**
   * Highlight word during playback
   */
  highlightWord(segmentIndex, wordIndex) {
    // Remove previous highlight
    if (this.currentWordElement) {
      this.currentWordElement.classList.remove("playing");
    }

    // Find and highlight new word
    const wordSpan = document.querySelector(
      `[data-segment-index="${segmentIndex}"][data-word-index="${wordIndex}"]`,
    );

    if (wordSpan) {
      wordSpan.classList.add("playing");
      this.currentWordElement = wordSpan;

      // Scroll into view if needed
      this.scrollToWord(wordSpan);
    }
  }

  /**
   * Remove all highlights
   */
  clearHighlight() {
    if (this.currentWordElement) {
      this.currentWordElement.classList.remove("playing");
      this.currentWordElement = null;
    }
  }

  /**
   * Scroll word into view smoothly
   */
  scrollToWord(wordElement) {
    const container = document.querySelector(".transcript-content");
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const wordRect = wordElement.getBoundingClientRect();

    // Check if word is outside visible area
    const isAbove = wordRect.top < containerRect.top + 100;
    const isBelow = wordRect.bottom > containerRect.bottom - 100;

    if (isAbove || isBelow) {
      wordElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  /**
   * Get word element by token ID
   */
  getWordElement(tokenId) {
    const tokenLower = (tokenId || "").toString().trim().toLowerCase();
    // Prefer exact match (original case) but fallback to lowercased data attribute
    let el = null;
    if (tokenId) {
      el = document.querySelector(`[data-token-id="${tokenId}"]`);
    }
    if (!el && tokenLower) {
      el = document.querySelector(`[data-token-id-lower="${tokenLower}"]`);
    }
    return el;
  }

  /**
   * Get word data by segment and word index
   */
  getWordData(segmentIndex, wordIndex) {
    if (segmentIndex < 0 || segmentIndex >= this.segments.length) {
      return null;
    }

    const segment = this.segments[segmentIndex];
    if (!segment.words || wordIndex < 0 || wordIndex >= segment.words.length) {
      return null;
    }

    return segment.words[wordIndex];
  }

  /**
   * Format seconds to MM:SS.ms
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  }

  /**
   * Find word at timestamp (for playback sync)
   */
  findWordAtTime(currentTime) {
    for (let segIdx = 0; segIdx < this.segments.length; segIdx++) {
      const segment = this.segments[segIdx];
      if (!segment.words) continue;

      for (let wordIdx = 0; wordIdx < segment.words.length; wordIdx++) {
        const word = segment.words[wordIdx];
        if (currentTime >= word.start && currentTime <= word.end) {
          return { segmentIndex: segIdx, wordIndex: wordIdx, word };
        }
      }
    }
    return null;
  }
}
