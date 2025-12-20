/**
 * Player Token Marker
 * Handles highlighting and scrolling to token_id in transcriptions
 * This is a minimal script that works with the new player.html structure
 */

console.log("[Player Token Marker] Script loaded");

// When DOM is ready, enhance the player with token_id functionality
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Player Token Marker] DOM ready, checking for token_id");

  const urlParams = new URLSearchParams(window.location.search);
  const targetTokenIdRaw = urlParams.get("token_id");
  const targetTokenId = (targetTokenIdRaw || "")
    .toString()
    .trim()
    .toLowerCase();

  if (!targetTokenId) {
    console.log("[Player Token Marker] No token_id in URL");
    return;
  }

  console.log("[Player Token Marker] Looking for token_id:", targetTokenId);

  // Wait a bit for transcription to render
  setTimeout(() => {
    // Try direct querySelector first (CSS.escape to handle special characters)
    const escaped = CSS.escape(targetTokenId);
    const container =
      document.getElementById("transcriptionContainer") || document.body;
    let node = container.querySelector(`[data-token-id-lower="${escaped}"]`);
    if (!node) {
      // Fallback: iterate all and compare normalized dataset values
      const words = document.querySelectorAll("[data-token-id-lower]");
      console.log(
        "[Player Token Marker] Found",
        words.length,
        "words with token_id data",
      );
      for (const word of words) {
        const wTok = (word.dataset.tokenIdLower || "")
          .toString()
          .trim()
          .toLowerCase();
        if (wTok === targetTokenId) {
          node = word;
          break;
        }
      }
    }
    console.log(
      "[Player Token Marker] Found",
      words.length,
      "words with token_id data",
    );

    if (node) {
      console.log(
        "[Player Token Marker] MATCH! Found target token_id in word:",
        node.textContent,
      );
      node.classList.add("word-token-id");
      setTimeout(() => {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        console.log("[Player Token Marker] Scrolled to token");
      }, 100);
    } else {
      console.warn(
        "[Player Token Marker] Token_id not found in transcription:",
        targetTokenId,
      );
    }
  }, 500);
});
