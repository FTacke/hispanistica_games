/**
 * Export Module
 * Handles download functionality for MP3, JSON, and TXT files
 * @module player/modules/export
 */

export class ExportManager {
  constructor(transcriptionManager) {
    this.transcriptionManager = transcriptionManager;
  }

  /**
   * Initialize export manager
   */
  init() {
    this._setupEventListeners();
  }

  /**
   * Setup event listeners for download buttons
   * @private
   */
  _setupEventListeners() {
    const downloadMP3Button = document.getElementById("downloadMP3");
    const downloadJSONButton = document.getElementById("downloadJSON");
    const downloadTXTButton = document.getElementById("downloadTXT");

    if (downloadMP3Button) {
      downloadMP3Button.addEventListener("click", () => this.downloadMP3());
    }

    if (downloadJSONButton) {
      downloadJSONButton.addEventListener("click", () => this.downloadJSON());
    }

    if (downloadTXTButton) {
      downloadTXTButton.addEventListener("click", () => this.downloadTXT());
    }
  }

  /**
   * Download MP3 file
   */
  async downloadMP3() {
    const urlParams = new URLSearchParams(window.location.search);
    const audioPath = urlParams.get("audio");

    if (!audioPath) {
      alert("Kein Audio-Pfad gefunden.");
      return;
    }

    try {
      // Add download parameter for proper Content-Disposition
      const downloadUrl = `${audioPath}${audioPath.includes("?") ? "&" : "?"}download=true`;

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = this._getFilenameFromPath(audioPath);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log("[Export] MP3 download initiated:", downloadUrl);
    } catch (error) {
      console.error("[Export] Failed to download MP3:", error);
      alert("Fehler beim Download der MP3-Datei.");
    }
  }

  /**
   * Download JSON transcription
   */
  async downloadJSON() {
    if (!this.transcriptionManager.transcriptionData) {
      alert("Keine Transkriptionsdaten verfügbar.");
      return;
    }

    try {
      const jsonString = JSON.stringify(
        this.transcriptionManager.transcriptionData,
        null,
        2,
      );
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${this.transcriptionManager.transcriptionData.filename || "transcription"}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      console.log("[Export] JSON download initiated");
    } catch (error) {
      console.error("[Export] Failed to download JSON:", error);
      alert("Fehler beim Download der JSON-Datei.");
    }
  }

  /**
   * Download plain text transcription
   */
  async downloadTXT() {
    if (!this.transcriptionManager.transcriptionData) {
      alert("Keine Transkriptionsdaten verfügbar.");
      return;
    }

    try {
      const txtContent = this._generateTextContent();
      const blob = new Blob([txtContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${this.transcriptionManager.transcriptionData.filename || "transcription"}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      console.log("[Export] TXT download initiated");
    } catch (error) {
      console.error("[Export] Failed to download TXT:", error);
      alert("Fehler beim Download der TXT-Datei.");
    }
  }

  /**
   * Generate plain text content from transcription
   * @private
   * @returns {string}
   */
  _generateTextContent() {
    const data = this.transcriptionManager.transcriptionData;
    let content = "";

    // Header
    content += `CO.RA.PAN Transcription\n`;
    content += `========================\n\n`;
    content += `File: ${data.filename || "Unknown"}\n`;
    content += `Country: ${data.country || "Unknown"}\n`;
    content += `City: ${data.city || "Unknown"}\n`;
    content += `Radio: ${data.radio || "Unknown"}\n`;
    content += `Date: ${data.date || "Unknown"}\n`;
    content += `Revision: ${data.revision || "Unknown"}\n\n`;
    content += `========================\n\n`;

    // Segments
    data.segments.forEach((segment, index) => {
      const speakerCode = segment.speaker_code || segment.speaker || "otro";
      const words = segment.words;

      if (!speakerCode || !words || words.length === 0) return;

      const startTime = this._formatTime(words[0].start);
      const endTime = this._formatTime(words[words.length - 1].end);

      content += `[${speakerCode}] ${startTime} - ${endTime}\n`;
      content += words.map((w) => w.text).join(" ") + "\n\n";
    });

    return content;
  }

  /**
   * Get filename from path
   * @private
   */
  _getFilenameFromPath(path) {
    return path.split("/").pop().split("?")[0];
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
}

export default ExportManager;
