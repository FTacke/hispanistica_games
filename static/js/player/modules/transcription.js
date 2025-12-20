/**
 * Transcription Module
 * Handles transcription loading, rendering, and word interactions
 * @module player/modules/transcription
 */

import { formatMorphLeipzig } from "../../morph_formatter.js";

export class TranscriptionManager {
  constructor(audioPlayer, tokenCollector) {
    this.audioPlayer = audioPlayer;
    this.tokenCollector = tokenCollector;
    this.transcriptionData = null;
    this.targetTokenId = null;

    // Word highlighting state
    this.isPlaying = false;
    this.animationFrameId = null;
    this.lastActiveGroup = null;
    this.lastActiveSegmentIndex = null; // Track active segment for coloring
    this.deactivateTimeout = null;
    this.DEACTIVATE_DELAY = 0.35; // Seconds delay for smoother transitions

    // Feature flag: disable click-to-play (for editor mode)
    this.disableClickPlay = false;
  }

  /**
   * Load and render transcription
   * @param {string} transcriptionFile - Path to JSON transcription file
   * @param {string} targetTokenId - Optional token ID to highlight and scroll to
   */
  async load(transcriptionFile, targetTokenId = null) {
    // Normalize target token id for robust comparison (trim whitespace, ensure string)
    this.targetTokenId = targetTokenId
      ? String(targetTokenId).trim().toLowerCase()
      : null;

    console.log("[Transcription] Loading with:", {
      transcriptionFile,
      targetTokenId,
      origin: location.origin,
    });

    try {
      // Ensure relative URL for same-origin requests (avoids CORS issues)
      const url = new URL(transcriptionFile, location.origin);
      console.log("[Transcription] Resolved URL:", url.toString());

      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
      });

      console.log(
        "[Transcription] Fetch response status:",
        response.status,
        response.statusText,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.transcriptionData = await response.json();
      console.log(
        "[Transcription] JSON parsed successfully, segments:",
        this.transcriptionData.segments?.length || "unknown",
      );

      // Prefer server-provided display name (field `country_display`). Do not
      // attempt client-side lookup — rely on server augmentation.
      this._updateMetadata();
      this._renderSegments();
      // If we have a target token but no direct match in the rendered markup,
      // perform a DOM query to ensure the element exists and scroll to it.
      if (this.targetTokenId) {
        try {
          const container = document.getElementById("transcriptionContainer");
          if (container) {
            const escaped = CSS.escape(this.targetTokenId);
            const node = container.querySelector(
              `[data-token-id-lower="${escaped}"]`,
            );
            if (node) {
              console.log(
                "[Transcription] Post-render: found matched node by data-token-id",
              );
              node.classList.add("word-token-id");
              setTimeout(
                () =>
                  node.scrollIntoView({ behavior: "smooth", block: "center" }),
                20,
              );
              const startTime = parseFloat(node.dataset.start) - 0.25;
              if (
                !isNaN(startTime) &&
                this.audioPlayer &&
                this.audioPlayer.audioElement
              ) {
                this.audioPlayer.audioElement.currentTime = Math.max(
                  0,
                  startTime,
                );
                console.log(
                  "[Transcription] Post-render: audio time set to",
                  startTime,
                );
              }
            } else {
              console.debug(
                "[Transcription] Post-render: no node found for targetTokenId",
                this.targetTokenId,
              );
            }
          }
        } catch (err) {
          console.warn("[Transcription] Post-render token lookup failed:", err);
        }
      }

      console.log(
        "[Transcription] Loaded successfully with targetTokenId:",
        this.targetTokenId,
      );
    } catch (error) {
      console.error("[Transcription] Failed to load:", error);
      alert("Fehler beim Laden der Transkription: " + error.message);
    }
  }

  /**
   * Update metadata display
   * @private
   */
  _updateMetadata() {
    const data = this.transcriptionData;

    this._setElementContent("documentName", data.filename);
    // Only use server-provided human-readable label. If missing, show fallback.
    const countryLabel = data.country_display || "Unbekanntes Land";

    // Update metadata items with MD3 structure
    this._setMetadataItem("countryInfo", "País:", countryLabel, true);
    this._setMetadataItem(
      "radioInfo",
      "Emisora:",
      data.radio || "Unbekannter Radiosender",
    );
    this._setMetadataItem(
      "cityInfo",
      "Ciudad:",
      data.city || "Unbekannte Stadt",
    );
    this._setMetadataItem(
      "revisionInfo",
      "Revisión:",
      data.revision || "Unbekannte Revision",
    );
    this._setMetadataItem(
      "dateInfo",
      "Fecha:",
      data.date || "Unbekanntes Datum",
    );
  }

  /**
   * Set metadata item with label and value (MD3 structure)
   * @private
   */
  _setMetadataItem(id, label, value, isPrimary = false) {
    const element = document.getElementById(id);
    if (!element) return;

    const valueClass = isPrimary
      ? "md3-player-metadata-value md3-player-metadata-value--primary"
      : "md3-player-metadata-value";
    element.innerHTML = `
      <span class="md3-player-metadata-label">${label}</span>
      <span class="${valueClass}">${value}</span>
    `;
  }

  /**
   * Ensure locations lookup map is available on this instance.
   * Fetches /api/v1/atlas/locations and builds a code->name map.
   * @private
   */
  async _ensureLocationsLookup() {
    // Client-side lookup removed: rely on server augmentation `country_display`.
    // Kept for compatibility if re-enabled in future.
    return;
  }

  /**
   * Convert a raw country field from the transcription JSON to a display label.
   * Accepts full names, codes (ARG, ARG-CBA), or legacy codes.
   * @private
   */
  _formatCountryLabel(raw) {
    if (!raw) return "Unbekanntes Land";

    const asUpper = raw.toString().toUpperCase();

    // If we have a direct mapping, prefer it
    if (this._locationsLookup && this._locationsLookup[asUpper]) {
      return this._locationsLookup[asUpper];
    }

    // Try splitting if input looks like a composite name (e.g., 'Argentina: Buenos Aires')
    if (raw.includes(":")) return raw;

    // If raw already looks like a human-readable name (contains letters and spaces), return as-is
    if (/^[A-Za-zÀ-ÖØ-öø-ÿ\s\/\-]+$/.test(raw) && raw.length > 2) return raw;

    // Fallback to raw value
    return raw;
  }

  /**
   * Helper to set element content safely
   * @private
   */
  _setElementContent(id, content) {
    const element = document.getElementById(id);
    if (element) element.textContent = content;
  }

  /**
   * Helper to set element HTML safely
   * @private
   */
  _setElementHTML(id, html) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = html;
  }

  /**
   * Render all transcription segments
   * @private
   */
  _renderSegments() {
    const container = document.getElementById("transcriptionContainer");
    if (!container) return;

    container.innerHTML = "";

    this.transcriptionData.segments.forEach((segment, segmentIndex) => {
      const speakerCode = segment.speaker_code;
      const words = segment.words;

      if (!speakerCode || !words || words.length === 0) {
        console.warn(
          `Segment ${segmentIndex} wird übersprungen (fehlende Sprecher- oder Wortdaten).`,
        );
        return;
      }

      const segmentElement = this._createSegmentElement(segment, segmentIndex);
      container.appendChild(segmentElement);
    });
  }

  /**
   * Create segment element
   * @private
   */
  _createSegmentElement(segment, segmentIndex) {
    const speakerCode = segment.speaker_code || segment.speaker || "otro";
    const words = segment.words;

    // Main container
    const segmentContainer = document.createElement("div");
    segmentContainer.classList.add("md3-speaker-turn");
    segmentContainer.setAttribute("data-segment-index", segmentIndex);

    // Speaker header (Zeile 1: Edit-Icon | Name | Time)
    const headerContainer = this._createSpeakerHeader(
      speakerCode,
      words,
      segmentIndex,
    );

    // Transcript text (Zeile 2: Monospace Text mit Words)
    const transcriptBlock = this._createTranscriptBlock(words, segmentIndex);

    segmentContainer.appendChild(headerContainer);
    segmentContainer.appendChild(transcriptBlock);

    return segmentContainer;
  }

  /**
   * Create speaker header with edit icon, name, and time
   * @private
   */
  _createSpeakerHeader(speakerCode, words, segmentIndex) {
    const headerContainer = document.createElement("div");
    headerContainer.classList.add("md3-speaker-header");

    // 1. Edit Icon (links) - MD3: Use Material Symbols
    const editIcon = document.createElement("span");
    editIcon.classList.add("material-symbols-rounded", "md3-speaker-edit-icon");
    
    // Check both flags for editor mode (new: disableNormalClick, legacy: disableClickPlay)
    const isEditorMode = this.disableNormalClick || this.disableClickPlay;

    if (isEditorMode) {
      // Editor mode: edit icon
      editIcon.textContent = "edit";
      editIcon.title = "Speaker ändern";
      editIcon.setAttribute("data-segment-index", segmentIndex);
      headerContainer.appendChild(editIcon);
    } else {
      // Player mode: person icon with native tooltip
      editIcon.textContent = "person";

      // Use native title attribute for tooltip (MD3-compliant)
      const tooltipText = this._getTooltipContentPlainText(speakerCode);
      editIcon.title = tooltipText;

      headerContainer.appendChild(editIcon);
    }

    // 2. Speaker Name (Mitte)
    const speakerNameSpan = this._createSpeakerName(
      speakerCode,
      words,
      segmentIndex,
    );
    headerContainer.appendChild(speakerNameSpan);

    // 3. Speaker Time (rechts)
    const timeElement = this._createTimeElement(words);
    headerContainer.appendChild(timeElement);

    return headerContainer;
  }

  /**
   * Map speaker code to attributes
   * @private
   */
  _getSpeakerAttributes(code) {
    const mapping = {
      "lib-pm": { type: "pro", sex: "m", mode: "libre", discourse: "general" },
      "lib-pf": { type: "pro", sex: "f", mode: "libre", discourse: "general" },
      "lib-om": { type: "otro", sex: "m", mode: "libre", discourse: "general" },
      "lib-of": { type: "otro", sex: "f", mode: "libre", discourse: "general" },
      "lec-pm": {
        type: "pro",
        sex: "m",
        mode: "lectura",
        discourse: "general",
      },
      "lec-pf": {
        type: "pro",
        sex: "f",
        mode: "lectura",
        discourse: "general",
      },
      "lec-om": {
        type: "otro",
        sex: "m",
        mode: "lectura",
        discourse: "general",
      },
      "lec-of": {
        type: "otro",
        sex: "f",
        mode: "lectura",
        discourse: "general",
      },
      "pre-pm": { type: "pro", sex: "m", mode: "pre", discourse: "general" },
      "pre-pf": { type: "pro", sex: "f", mode: "pre", discourse: "general" },
      "tie-pm": { type: "pro", sex: "m", mode: "n/a", discourse: "tie" },
      "tie-pf": { type: "pro", sex: "f", mode: "n/a", discourse: "tie" },
      "traf-pm": { type: "pro", sex: "m", mode: "n/a", discourse: "traf" },
      "traf-pf": { type: "pro", sex: "f", mode: "n/a", discourse: "traf" },
      foreign: { type: "n/a", sex: "n/a", mode: "n/a", discourse: "foreign" },
      none: { type: "", sex: "", mode: "", discourse: "" },
    };
    return (
      mapping[code] || { type: "otro", sex: "?", mode: "?", discourse: "?" }
    );
  }

  /**
   * Create speaker name element with chips
   * @private
   */
  _createSpeakerName(speakerCode, words, segmentIndex) {
    const nameContainer = document.createElement("div");
    nameContainer.classList.add("md3-speaker-name");
    nameContainer.setAttribute("data-segment-index", segmentIndex);

    // Speaker name is always clickable to play segment audio
    nameContainer.style.cursor = "pointer";
    nameContainer.addEventListener("click", () => {
      this._playSegment(words[0].start_ms / 1000, words[words.length - 1].end_ms / 1000, true);
      console.log(
        `Speaker: ${speakerCode} Start: ${words[0].start_ms / 1000} End: ${words[words.length - 1].end_ms / 1000}`,
      );
    });

    const attrs = this._getSpeakerAttributes(speakerCode);

    // Chip 1: Type + Sex
    if (attrs.type && attrs.sex && attrs.type !== "n/a") {
      const chip1 = document.createElement("span");
      chip1.classList.add("md3-speaker-chip");

      let typeLabel =
        attrs.type === "pro"
          ? "Hablante profesional"
          : "Hablante no profesional";
      let sexLabel =
        attrs.sex === "m"
          ? "masculino"
          : attrs.sex === "f"
            ? "femenino"
            : attrs.sex;

      chip1.textContent = `${typeLabel}, ${sexLabel}`;

      // Color variant based on type
      if (attrs.type === "pro") {
        chip1.classList.add("md3-speaker-chip--type-pro");
      } else {
        chip1.classList.add("md3-speaker-chip--type-otro");
      }

      // Add sex class for differentiation
      if (attrs.sex) {
        chip1.classList.add(`md3-speaker-chip--sex-${attrs.sex}`);
      }
      nameContainer.appendChild(chip1);
    } else if (speakerCode === "foreign") {
      const chip1 = document.createElement("span");
      chip1.classList.add("md3-speaker-chip", "md3-speaker-chip--type-otro");
      chip1.textContent = "Foreign / Unknown";
      nameContainer.appendChild(chip1);
    }

    // Chip 2: Mode
    if (attrs.mode && attrs.mode !== "n/a") {
      const chip2 = document.createElement("span");
      chip2.classList.add("md3-speaker-chip", "md3-speaker-chip--mode");

      // Add specific class for mode value to handle tonal variations
      chip2.classList.add(`md3-speaker-chip--mode-${attrs.mode}`);

      let modeLabel = attrs.mode;
      if (attrs.mode === "libre") modeLabel = "Habla libre";
      if (attrs.mode === "pre") modeLabel = "Habla pregrabada";
      if (attrs.mode === "lectura") modeLabel = "Lectura";

      chip2.textContent = modeLabel;
      nameContainer.appendChild(chip2);
    }

    // Chip 3: Discourse
    if (attrs.discourse && attrs.discourse !== "n/a") {
      const chip3 = document.createElement("span");
      chip3.classList.add("md3-speaker-chip", "md3-speaker-chip--discourse");

      // Add specific class for discourse value
      chip3.classList.add(`md3-speaker-chip--discourse-${attrs.discourse}`);

      let discLabel = `Discurso: ${attrs.discourse}`;
      if (attrs.discourse === "general") discLabel = "Discurso: general";
      if (attrs.discourse === "traf") discLabel = "Discurso: tránsito";
      if (attrs.discourse === "tie") discLabel = "Discurso: tiempo";

      chip3.textContent = discLabel;
      nameContainer.appendChild(chip3);
    }

    // Fallback if no chips (e.g. unknown code)
    if (nameContainer.children.length === 0) {
      const chipFallback = document.createElement("span");
      chipFallback.classList.add(
        "md3-speaker-chip",
        "md3-speaker-chip--type-otro",
      );
      chipFallback.textContent = speakerCode;
      nameContainer.appendChild(chipFallback);
    }

    return nameContainer;
  }

  /**
   * Get tooltip content for speaker type
   * @private
   */
  _getTooltipContent(speakerName) {
    const speakerTypeMapping = {
      "lib-pm": `<span class="tooltip-high">Modo: </span>habla libre<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>masculino<br>`,
      "lib-pf": `<span class="tooltip-high">Modo: </span>habla libre<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>femenino<br>`,
      "lib-om": `<span class="tooltip-high">Modo: </span>habla libre<br>
                 <span class="tooltip-high">Hablante: </span>no profesional<br>
                 <span class="tooltip-high">Sexo: </span>masculino<br>`,
      "lib-of": `<span class="tooltip-high">Modo: </span>habla libre<br>
                 <span class="tooltip-high">Hablante: </span>no profesional<br>
                 <span class="tooltip-high">Sexo: </span>femenino<br>`,
      "lec-pm": `<span class="tooltip-high">Modo: </span>lectura<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>masculino<br>`,
      "lec-pf": `<span class="tooltip-high">Modo: </span>lectura<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>femenino<br>`,
      "lec-om": `<span class="tooltip-high">Modo: </span>lectura<br>
                 <span class="tooltip-high">Hablante: </span>no profesional<br>
                 <span class="tooltip-high">Sexo: </span>masculino<br>`,
      "lec-of": `<span class="tooltip-high">Modo: </span>lectura<br>
                 <span class="tooltip-high">Hablante: </span>no profesional<br>
                 <span class="tooltip-high">Sexo: </span>femenino<br>`,
      "pre-pm": `<span class="tooltip-high">Modo: </span>lectura pregrabada<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>masculino<br>`,
      "pre-pf": `<span class="tooltip-high">Modo: </span>lectura pregrabada<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>femenino<br>`,
      "tie-pm": `<span class="tooltip-high">Discurso: </span>pronóstico del tiempo<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>masculino<br>`,
      "tie-pf": `<span class="tooltip-high">Discurso: </span>pronóstico del tiempo<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>femenino<br>`,
      "traf-pm": `<span class="tooltip-high">Discurso: </span>informaciones de tránsito<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>masculino<br>`,
      "traf-pf": `<span class="tooltip-high">Discurso: </span>informaciones de tránsito<br>
                 <span class="tooltip-high">Hablante: </span>profesional<br>
                 <span class="tooltip-high">Sexo: </span>femenino<br>`,
      rev: `<span class="tooltip-high">Rol: </span>revisor/revisora<br>`,
    };

    return (
      speakerTypeMapping[speakerName] ||
      `<span class="tooltip-high">Speaker: </span>${speakerName}<br>`
    );
  }

  /**
   * Get plain text tooltip content for speaker type (for native title attribute)
   * @private
   */
  _getTooltipContentPlainText(speakerName) {
    const speakerTypeMapping = {
      "lib-pm": "Modo: habla libre | Hablante: profesional | Sexo: masculino",
      "lib-pf": "Modo: habla libre | Hablante: profesional | Sexo: femenino",
      "lib-om":
        "Modo: habla libre | Hablante: no profesional | Sexo: masculino",
      "lib-of": "Modo: habla libre | Hablante: no profesional | Sexo: femenino",
      "lec-pm": "Modo: lectura | Hablante: profesional | Sexo: masculino",
      "lec-pf": "Modo: lectura | Hablante: profesional | Sexo: femenino",
      "lec-om": "Modo: lectura | Hablante: no profesional | Sexo: masculino",
      "lec-of": "Modo: lectura | Hablante: no profesional | Sexo: femenino",
      "pre-pm":
        "Modo: lectura pregrabada | Hablante: profesional | Sexo: masculino",
      "pre-pf":
        "Modo: lectura pregrabada | Hablante: profesional | Sexo: femenino",
      "tie-pm":
        "Discurso: pronóstico del tiempo | Hablante: profesional | Sexo: masculino",
      "tie-pf":
        "Discurso: pronóstico del tiempo | Hablante: profesional | Sexo: femenino",
      "traf-pm":
        "Discurso: informaciones de tránsito | Hablante: profesional | Sexo: masculino",
      "traf-pf":
        "Discurso: informaciones de tránsito | Hablante: profesional | Sexo: femenino",
      rev: "Revisor / Revisora",
    };

    return speakerTypeMapping[speakerName] || `Speaker: ${speakerName}`;
  }

  /**
   * Create time element
   * @private
   */
  _createTimeElement(words) {
    const timeElement = document.createElement("div");
    timeElement.classList.add("md3-speaker-time");

    const startTime = this._formatTime(words[0].start_ms / 1000);
    const endTime = this._formatTime(words[words.length - 1].end_ms / 1000);
    timeElement.textContent = `${startTime} - ${endTime}`;

    return timeElement;
  }

  /**
   * Create transcript block with word elements
   * @private
   */
  _createTranscriptBlock(words, segmentIndex) {
    const transcriptBlock = document.createElement("div");
    transcriptBlock.classList.add("md3-speaker-text");
    transcriptBlock.classList.add("speaker-text");

    // Group words based on pauses
    const wordGroups = this._groupWords(words);

    words.forEach((word, idx) => {
      const wordElement = this._createWordElement(
        word,
        idx,
        words,
        segmentIndex,
        wordGroups,
      );
      transcriptBlock.appendChild(wordElement);
    });

    return transcriptBlock;
  }

  /**
   * Group words based on pauses
   * @private
   */
  _groupWords(words) {
    const PAUSE_THRESHOLD = 0.25;
    const MAX_GROUP_SIZE = 3;
    const wordGroups = [];
    let currentGroup = [];

    words.forEach((word, idx) => {
      currentGroup.push({ word, idx });

      if (idx < words.length - 1) {
        const pauseToNext = (words[idx + 1].start_ms - word.end_ms) / 1000;
        const groupIsFull = currentGroup.length >= MAX_GROUP_SIZE;

        if (pauseToNext >= PAUSE_THRESHOLD || groupIsFull) {
          wordGroups.push([...currentGroup]);
          currentGroup = [];
        }
      } else {
        wordGroups.push([...currentGroup]);
      }
    });

    return wordGroups;
  }

  /**
   * Create word element with tooltip and click handlers
   * @private
   */
  _createWordElement(word, idx, words, segmentIndex, wordGroups) {
    const wordElement = document.createElement("span");
    wordElement.textContent = word.text + " ";
    wordElement.classList.add("word");
    wordElement.dataset.start = word.start_ms / 1000;
    wordElement.dataset.end = word.end_ms / 1000;
    const tokenIdOriginal = word.token_id ? String(word.token_id).trim() : "";
    const tokenIdLower = tokenIdOriginal ? tokenIdOriginal.toLowerCase() : "";
    wordElement.dataset.tokenId = tokenIdOriginal;
    wordElement.dataset.tokenIdLower = tokenIdLower;
    wordElement.style.cursor = "pointer";

    // Assign group index
    const groupIndex = wordGroups.findIndex((group) =>
      group.some((item) => item.idx === idx),
    );
    wordElement.dataset.groupIndex = `${segmentIndex}-${groupIndex}`;

    // Highlight target token
    // Compare normalized token ids
    if (this.targetTokenId && tokenIdLower === this.targetTokenId) {
      console.log(
        "[Transcription] MATCH! Found target token_id:",
        this.targetTokenId,
        "in word:",
        word,
      );
      wordElement.classList.add("word-token-id");

      setTimeout(() => {
        console.log(
          "[Transcription] Scrolling to token and setting audio time",
        );
        wordElement.scrollIntoView({ behavior: "smooth", block: "center" });
        const startTime = parseFloat(word.start) - 0.25;
        if (!isNaN(startTime)) {
          this.audioPlayer.audioElement.currentTime = Math.max(0, startTime);
          console.log("[Transcription] Audio time set to:", startTime);
        }
      }, 300);
    }

    // Tooltip data
    const morphInfo = formatMorphLeipzig(word.pos, word.morph);
    const tooltipText = `
      <span class="tooltip-high">lemma:</span> <span class="tooltip-bold">${word.lemma}</span><br>
      <span class="tooltip-high">pos:</span> ${word.pos}, ${morphInfo}<br>
      <span class="tooltip-high">dep:</span> ${(word.dep || "").toUpperCase()}<br>
      <span class="tooltip-high">head_text:</span> <span class="tooltip-italic">${word.head_text}</span><br>
      <span class="tooltip-high">token_id:</span> <span class="tooltip-token">${word.token_id}</span><br>
    `;
    wordElement.dataset.tooltip = tooltipText;

    // Tooltip events
    this._attachTooltipEvents(wordElement);

    // Click handler
    wordElement.addEventListener("click", (event) => {
      // In editor mode: allow Ctrl+Click and Shift+Click, but block normal clicks
      if (this.disableNormalClick && !event.ctrlKey && !event.shiftKey) {
        return; // Block normal click in editor mode
      }

      // Legacy: also check old disableClickPlay flag
      if (this.disableClickPlay) {
        return;
      }

      const startPrev =
        idx >= 2
          ? parseFloat(words[idx - 2].start_ms) / 1000
          : parseFloat(words[0].start_ms) / 1000;
      const endNext =
        idx < words.length - 2
          ? parseFloat(words[idx + 2].end_ms) / 1000
          : parseFloat(word.end_ms) / 1000;

      if (event.ctrlKey) {
        // Ctrl+Click: Play only this word
        this._playSegment(parseFloat(word.start_ms) / 1000, parseFloat(word.end_ms) / 1000, false);
        console.log(
          `Ctrl+Click: ${word.text} Start: ${word.start_ms / 1000} End: ${word.end_ms / 1000}`,
        );
      } else if (event.shiftKey) {
        // Shift+Click: Play from this word to end of segment
        const segmentEnd = parseFloat(words[words.length - 1].end_ms) / 1000;
        this._playSegment(parseFloat(word.start_ms) / 1000, segmentEnd, false);
        console.log(
          `Shift+Click: ${word.text} Start: ${word.start_ms / 1000} End: ${segmentEnd}`,
        );
      } else {
        // Normal click: Play with context (word before and after)
        this._playSegment(startPrev, endNext, true);
        console.log(`Click: ${word.text} Start: ${startPrev} End: ${endNext}`);
      }

      // Add to token collector
      if (this.tokenCollector) {
        this.tokenCollector.addTokenId(word.token_id);
      }
    });

    return wordElement;
  }

  /**
   * Attach tooltip events to word element
   * @private
   */
  _attachTooltipEvents(wordElement) {
    wordElement.addEventListener("mouseenter", (event) => {
      const tooltip = document.createElement("div");
      tooltip.className = "tooltip-text word-tooltip";
      tooltip.innerHTML = event.target.dataset.tooltip;
      document.body.appendChild(tooltip);

      // Position tooltip near word
      setTimeout(() => {
        const rect = event.target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        // Position below word, centered horizontally
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        let top = rect.bottom + 8;

        // Keep tooltip in viewport (horizontal)
        if (left < 10) {
          left = 10;
        } else if (left + tooltipRect.width > window.innerWidth - 10) {
          left = window.innerWidth - tooltipRect.width - 10;
        }

        // Check if tooltip goes below viewport, if so position above
        if (top + tooltipRect.height > window.innerHeight - 10) {
          top = rect.top - tooltipRect.height - 8;
        }

        tooltip.style.position = "fixed";
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        tooltip.classList.add("visible");
      }, 10);

      event.target._tooltipElement = tooltip;
    });

    wordElement.addEventListener("mouseleave", (event) => {
      const tooltip = event.target._tooltipElement;
      if (tooltip) {
        tooltip.classList.remove("visible");
        setTimeout(() => {
          tooltip.remove();
        }, 150);
        event.target._tooltipElement = null;
      }
    });
  }

  /**
   * Play audio segment
   * @private
   */
  _playSegment(startTime, endTime, shouldPause) {
    this.audioPlayer.playSegment(startTime, shouldPause ? endTime : null);
  }

  /**
   * Format time in seconds to hh:mm:ss
   * @private
   */
  _formatTime(timeInSeconds) {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.round(timeInSeconds % 60);
    const pad = (num) => (num < 10 ? "0" + num : num.toString());
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  /**
   * Start continuous word highlighting using requestAnimationFrame
   * Called when audio starts playing
   */
  startWordHighlighting() {
    if (this.animationFrameId) return; // Already active

    this.isPlaying = true;
    console.log("[Transcription] Starting word highlighting");

    const animate = () => {
      if (!this.isPlaying) return;
      this.updateWordsHighlight();
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Stop continuous word highlighting
   * Called when audio pauses or ends
   */
  stopWordHighlighting() {
    this.isPlaying = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      console.log("[Transcription] Stopped word highlighting");
    }
  }

  /**
   * Update word highlighting based on current audio time
   * Highlights current word group and provides preview for next group
   */
  updateWordsHighlight() {
    const currentTime = this.audioPlayer.getCurrentTime();
    const allWords = document.querySelectorAll(".word");
    let currentActiveWord = null;
    let activeSegmentIndex = null;

    // 1. Find currently active word and segment
    // Optimization: We could cache words, but for now we iterate.
    // We iterate to find the word that matches the current time.
    for (const word of allWords) {
      const start = parseFloat(word.dataset.start);
      const end = parseFloat(word.dataset.end);

      if (currentTime >= start && currentTime <= end) {
        currentActiveWord = word;
        // Extract segment index from groupIndex "seg-grp"
        // Note: groupIndex is set as `${segmentIndex}-${groupIndex}`
        const parts = word.dataset.groupIndex.split("-");
        activeSegmentIndex = parts[0];
        break;
      }
    }

    // 2. Handle Segment Coloring (Past/Current/Future)
    if (activeSegmentIndex !== null) {
      // If segment changed, clear the previous one
      if (
        this.lastActiveSegmentIndex !== null &&
        this.lastActiveSegmentIndex !== activeSegmentIndex
      ) {
        const prevSegment = document.querySelector(
          `.md3-speaker-turn[data-segment-index="${this.lastActiveSegmentIndex}"]`,
        );
        if (prevSegment) {
          const prevWords = prevSegment.querySelectorAll(".word");
          prevWords.forEach((w) =>
            w.classList.remove(
              "is-past",
              "is-current",
              "is-future",
              "playing",
              "is-active-group-context",
              "is-preview-group",
            ),
          );
        }
      }
      this.lastActiveSegmentIndex = activeSegmentIndex;

      // Determine current group and next group indices
      const currentGroupIndex = currentActiveWord
        ? currentActiveWord.dataset.groupIndex
        : null;
      let nextGroupIndex = null;
      if (currentGroupIndex) {
        const [segIdx, grpIdx] = currentGroupIndex.split("-").map(Number);
        nextGroupIndex = `${segIdx}-${grpIdx + 1}`;
      }

      // Update words in current segment
      const activeSegment = document.querySelector(
        `.md3-speaker-turn[data-segment-index="${activeSegmentIndex}"]`,
      );
      if (activeSegment) {
        const wordsInSegment = activeSegment.querySelectorAll(".word");
        let foundCurrent = false;

        wordsInSegment.forEach((word) => {
          // Reset classes first
          word.classList.remove(
            "is-past",
            "is-current",
            "is-future",
            "playing",
            "playing-preview",
            "is-active-group-context",
            "is-preview-group",
          );

          // Apply Group Highlighting Logic
          if (
            word.dataset.groupIndex === currentGroupIndex &&
            word !== currentActiveWord
          ) {
            word.classList.add("is-active-group-context");
          } else if (word.dataset.groupIndex === nextGroupIndex) {
            word.classList.add("is-preview-group");
          }

          // Apply Past/Current/Future Logic
          if (word === currentActiveWord) {
            word.classList.add("is-current", "playing");
            foundCurrent = true;

            // Scroll logic
            const rect = word.getBoundingClientRect();
            if (window.innerHeight - rect.bottom < 300) {
              word.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } else if (foundCurrent) {
            // After current word -> Future
            word.classList.add("is-future");
          } else {
            // Before current word -> Past
            word.classList.add("is-past");
          }
        });
      }
    } else {
      // No active word (silence or between segments)
      // Optionally: maintain state of last active segment or clear?
      // For now, we keep the last state until a new segment becomes active,
      // or we could clear if the silence is long.
      // But to avoid flickering during short pauses, we do nothing here.
      // If we wanted to clear:
      /*
        if (this.lastActiveSegmentIndex !== null) {
             const prevSegment = document.querySelector(`.md3-speaker-turn[data-segment-index="${this.lastActiveSegmentIndex}"]`);
             if (prevSegment) {
                 const prevWords = prevSegment.querySelectorAll('.word');
                 prevWords.forEach(w => w.classList.remove('is-past', 'is-current', 'is-future', 'playing'));
             }
             this.lastActiveSegmentIndex = null;
        }
        */
    }
  }
}

export default TranscriptionManager;
