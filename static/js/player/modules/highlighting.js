/**
 * Highlighting Module
 * Handles letter/word marking and visual highlighting
 * @module player/modules/highlighting
 */

import { PLAYER_CONFIG } from "../config.js";

export class HighlightingManager {
  constructor() {
    this.matchCounts = {};
    this.markInput = null;
    this.buttonsContainer = null;
  }

  /**
   * Initialize highlighting manager
   */
  init() {
    this.markInput = document.getElementById("markInput");
    this.buttonsContainer = document.getElementById("buttonsContainer");

    if (!this.markInput || !this.buttonsContainer) {
      console.warn("[Highlighting] Required elements not found");
      return;
    }

    this._setupEventListeners();
  }

  /**
   * Setup event listeners
   * @private
   */
  _setupEventListeners() {
    const markButton = document.getElementById("markButton");
    if (markButton) {
      markButton.addEventListener("click", () => this.markLetters());
    }

    // Enter key in input
    if (this.markInput) {
      this.markInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.markLetters();
        }
      });
    }
  }

  /**
   * Mark letters in transcription based on input
   */
  markLetters() {
    console.log("[Highlighting] markLetters called");

    let searchInput = this.markInput.value.trim().toLowerCase();
    if (!searchInput) return;

    let markType = "exact";
    let searchQuery = searchInput;
    let separatorRegex = /[ ,.?;]/;

    // Check for special suffixes
    if (searchInput.endsWith("_")) {
      markType = "separator";
      searchQuery = searchInput.slice(0, -1);
      separatorRegex = /\s/; // Only whitespace
    } else if (searchInput.endsWith("#")) {
      markType = "punctuation";
      searchQuery = searchInput.slice(0, -1);
      separatorRegex = /[.,;!?]/; // Only punctuation
    }

    const words = document.querySelectorAll(".word");
    this.matchCounts[searchInput] = 0;

    words.forEach((word) => {
      const wordText = word.textContent.toLowerCase();

      if (wordText.includes(searchQuery)) {
        for (let i = 0; i < wordText.length; i++) {
          const isExactMatch =
            wordText.substring(i, i + searchQuery.length) === searchQuery;

          if (isExactMatch) {
            const nextChar = wordText[i + searchQuery.length] || " ";
            const isValid =
              markType === "separator" || markType === "punctuation"
                ? separatorRegex.test(nextChar)
                : true;

            if (isValid) {
              this._markWordLetters(word, searchInput, markType);
              this.matchCounts[searchInput]++;
              break; // Only mark once per word
            }
          }
        }
      }
    });

    // Create reset button if not exists
    if (!document.getElementById(`button-${searchInput}`)) {
      this._createResetButton(searchInput);
    }

    this.markInput.value = "";
  }

  /**
   * Mark letters within a word element
   * @private
   */
  _markWordLetters(word, searchLetters, markType) {
    let innerHTML = word.innerHTML;
    let searchQuery =
      searchLetters.endsWith("_") || searchLetters.endsWith("#")
        ? searchLetters.slice(0, -1)
        : searchLetters;

    const separatorRegex = searchLetters.endsWith("_") ? /\s/ : /[.,;!?]/;
    const isSpecial =
      searchLetters.endsWith("_") || searchLetters.endsWith("#");
    let i = 0;

    while (i < innerHTML.length) {
      const regex = new RegExp(`${searchQuery}(?![^<]*>|[^<>]*</)`, "ig");
      const match = regex.exec(innerHTML.slice(i));

      if (match) {
        const matchStart = i + match.index;
        const matchEnd = matchStart + match[0].length;
        const nextChar = innerHTML[matchEnd] || " ";
        const isValid = isSpecial ? separatorRegex.test(nextChar) : true;

        if (isValid) {
          const highlightSpan = `<span class="highlight">${match[0]}</span>`;
          innerHTML =
            innerHTML.slice(0, matchStart) +
            highlightSpan +
            innerHTML.slice(matchEnd);
          i = matchStart + highlightSpan.length;
        } else {
          i = matchEnd;
        }
      } else {
        break;
      }
    }

    word.innerHTML = innerHTML;
  }

  /**
   * Create reset button for specific search
   * @private
   */
  _createResetButton(searchLetters) {
    const resetButton = document.createElement("button");
    resetButton.id = `button-${searchLetters}`;
    resetButton.classList.add("letra");

    const count = this.matchCounts[searchLetters] || 0;
    resetButton.innerHTML = `${searchLetters} <span class="result-count">(${count})</span>`;

    resetButton.addEventListener("click", () => {
      this.resetMarkingByLetters(searchLetters);
      resetButton.remove();
    });

    this.buttonsContainer.appendChild(resetButton);
  }

  /**
   * Reset all markings
   */
  resetAllMarkings() {
    console.log("[Highlighting] Reset all markings");

    const words = document.querySelectorAll(".word");
    words.forEach((word) => this._resetWordMarkings(word));

    this._resetAllButtons();
  }

  /**
   * Reset markings for specific letters
   * @param {string} searchLetters - Letters to reset
   */
  resetMarkingByLetters(searchLetters) {
    const words = document.querySelectorAll(".word");
    words.forEach((word) =>
      this._resetWordMarkingsByLetters(word, searchLetters),
    );
  }

  /**
   * Reset markings in a word element
   * @private
   */
  _resetWordMarkings(word) {
    word.innerHTML = word.textContent;
  }

  /**
   * Reset markings for specific letters in a word
   * @private
   */
  _resetWordMarkingsByLetters(word, searchLetters) {
    let searchQuery = searchLetters.toLowerCase();
    let markType = "exact";

    if (searchQuery.endsWith("_")) {
      searchQuery = searchQuery.slice(0, -1);
      markType = "separator";
    } else if (searchQuery.endsWith("#")) {
      searchQuery = searchQuery.slice(0, -1);
      markType = "punctuation";
    }

    let wordHTML = word.innerHTML;
    let newContent = "";
    let currentIndex = 0;

    while (currentIndex < wordHTML.length) {
      const spanStart = wordHTML.indexOf(
        '<span class="highlight">',
        currentIndex,
      );

      if (spanStart === -1) {
        newContent += wordHTML.slice(currentIndex);
        break;
      }

      newContent += wordHTML.slice(currentIndex, spanStart);
      const spanEnd = wordHTML.indexOf("</span>", spanStart);

      if (spanEnd === -1) break;

      const highlightedText = wordHTML.slice(
        spanStart + '<span class="highlight">'.length,
        spanEnd,
      );
      const separatorRegex = markType === "separator" ? /\s/ : /[.,;!?]/;
      const nextCharIndex = spanEnd + "</span>".length;
      const nextChar = wordHTML[nextCharIndex] || " ";

      const matchesQuery = highlightedText.toLowerCase() === searchQuery;
      const hasValidSeparator =
        markType === "separator" || markType === "punctuation"
          ? separatorRegex.test(nextChar)
          : true;

      if (matchesQuery && hasValidSeparator) {
        newContent += highlightedText; // Remove highlighting
      } else {
        newContent += wordHTML.slice(spanStart, spanEnd + "</span>".length);
      }

      currentIndex = spanEnd + "</span>".length;
    }

    word.innerHTML = newContent;
  }

  /**
   * Reset all buttons
   * @private
   */
  _resetAllButtons() {
    while (this.buttonsContainer.firstChild) {
      this.buttonsContainer.removeChild(this.buttonsContainer.firstChild);
    }
    this.matchCounts = {};
  }

  /**
   * Get current match counts
   * @returns {Object}
   */
  getMatchCounts() {
    return { ...this.matchCounts };
  }
}

export default HighlightingManager;
