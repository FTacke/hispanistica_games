/**
 * Advanced Audio Manager (copy from corpus audio)
 * This copy is used by the advanced search page to decouple from the legacy `corpus` module.
 */
import { MEDIA_ENDPOINT } from "../search/config.js";

export class AdvancedAudioManager {
  constructor() {
    this.currentAudio = null;
    this.currentPlayButton = null;
    console.log("[Advanced Audio] Constructor initialized");
  }

  bindEvents() {
    this.bindAudioButtons();
    this.bindPlayerLinks();
  }

  bindAudioButtons() {
    $(document)
      .off("click", ".audio-button")
      .on("click", ".audio-button", async (e) => {
        e.preventDefault();
        const $btn = $(e.currentTarget);
        const isPlaying =
          this.currentPlayButton && this.currentPlayButton[0] === $btn[0];
        const filename = $btn.data("filename");
        const start = parseFloat($btn.data("start"));
        const end = parseFloat($btn.data("end"));
        const tokenId = $btn.data("token-id");
        const snippetType = $btn.data("type");
        console.debug(
          "[Advanced Audio] Play button clicked - attempting playback",
        );
        if (isPlaying) {
          this.stopCurrentAudio();
          return;
        }
        this.playAudioSegment(filename, start, end, $btn, tokenId, snippetType);
      });

    $(document)
      .off("click", ".download-button")
      .on("click", ".download-button", async (e) => {
        e.preventDefault();
        const $btn = $(e.currentTarget);
        const filename = $btn.data("filename");
        const start = parseFloat($btn.data("start"));
        const end = parseFloat($btn.data("end"));
        const tokenId = $btn.data("token-id");
        const snippetType = $btn.data("type");
        const timestamp = Date.now();
        let downloadUrl = `${MEDIA_ENDPOINT}/play_audio/${filename}?start=${start}&end=${end}&t=${timestamp}&download=true`;
        if (tokenId) downloadUrl += `&token_id=${encodeURIComponent(tokenId)}`;
        if (snippetType)
          downloadUrl += `&type=${encodeURIComponent(snippetType)}`;
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  }

  bindPlayerLinks() {
    $(document)
      .off("click", ".player-link")
      .on("click", ".player-link", async (e) => {
        e.preventDefault();
        const $link = $(e.currentTarget);
        const playerUrl = $link.attr("href");
        const url = new URL(playerUrl, window.location.origin);
        const transcriptionPath = url.searchParams.get("transcription");
        if (!transcriptionPath) {
          console.error("[Advanced Audio] No transcription path found");
          return;
        }
        if (
          window.IS_AUTHENTICATED !== "true" &&
          window.IS_AUTHENTICATED !== true
        ) {
          alert(
            "Um die vollständige Transkription zu sehen und den Player zu öffnen, müssen Sie sich anmelden.",
          );
          return;
        }
        try {
          const response = await fetch(transcriptionPath, {
            method: "HEAD",
            credentials: "same-origin",
          });
          if (response.status === 401) {
            const playerUrlFull = playerUrl;
            this.openLoginForTarget(playerUrlFull);
            return;
          }
          if (!response.ok) {
            console.error(
              "[Advanced Audio] Failed to access transcription:",
              response.status,
            );
            return;
          }
          window.location.href = playerUrl;
        } catch (error) {
          console.error("[Advanced Audio] Error checking auth:", error);
        }
      });
    console.log("[Advanced Audio] Player links bound with auth check");
  }

  showAuthRequiredMessage() {
    const msg =
      "Um erweiterte Funktionen (z. B. den kompletten Player) zu nutzen, müssen Sie sich anmelden.";
    if (window.toast) {
      window.toast(msg);
    } else {
      alert(msg);
    }
  }

  async openLoginForTarget(targetUrl, postAction = null) {
    // Save redirect URL in session for after login (optional server-side persistence)
    try {
      await fetch("/auth/save-redirect", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
    } catch (e) {
      console.warn("[Auth] Could not save redirect to server", e);
    }
    // Navigate to full-page login with next parameter (MD3 Goldstandard)
    window.location.href = `/login?next=${encodeURIComponent(targetUrl)}`;
    return;
  }

  async playAudioSegment(filename, start, end, $button, tokenId, snippetType) {
    this.stopCurrentAudio();
    const timestamp = Date.now();
    let audioUrl = `${MEDIA_ENDPOINT}/play_audio/${filename}?start=${start}&end=${end}&t=${timestamp}`;
    if (tokenId) audioUrl += `&token_id=${encodeURIComponent(tokenId)}`;
    if (snippetType) audioUrl += `&type=${encodeURIComponent(snippetType)}`;
    this.currentAudio = new Audio(audioUrl);
    try {
      this.currentAudio.volume = 1.0;
      console.log("[Advanced Audio] Audio URL:", audioUrl);
    } catch (e) {
      console.warn("[Advanced Audio] Could not set audio properties", e);
    }
    this.currentPlayButton = $button;
    // MD3: Use Material Symbols
    $button.html('<span class="material-symbols-rounded">stop</span>');
    this.currentAudio.addEventListener("playing", () => {
      console.log("[Advanced Audio] Playing started");
    });
    this.currentAudio
      .play()
      .then(() => {
        console.log("[Advanced Audio] play() resolved");
      })
      .catch((error) => {
        console.error("Audio playback error:", error);
        alert("Audio konnte nicht abgespielt werden");
        $button.html('<span class="material-symbols-rounded">play_arrow</span>');
      });
    this.currentAudio.addEventListener("ended", () => {
      $button.html('<span class="material-symbols-rounded">play_arrow</span>');
      this.currentAudio = null;
      this.currentPlayButton = null;
    });
    this.currentAudio.addEventListener("error", (e) => {
      console.error("Audio error:", e);
      alert("Audio konnte nicht geladen werden");
      $button.html('<span class="material-symbols-rounded">play_arrow</span>');
      this.currentAudio = null;
      this.currentPlayButton = null;
    });
  }

  stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentPlayButton) {
      this.currentPlayButton.html('<span class="material-symbols-rounded">play_arrow</span>');
      this.currentPlayButton = null;
    }
  }

  destroy() {
    this.stopCurrentAudio();
    $(document).off("click", ".audio-button");
    $(document).off("click", 'a.player-link, a[href^="/player/"]');
  }
}
