const MEDIA_ENDPOINT = "/media";

/**
 * @file player_script.js
 * @description Player-Logik mit Token-ID-Sammler, Download, Audio-Steuerung, Transkript-Laden, Wortmarkierung, Tooltip und Footer-Statistik.
 */

("use strict");

import { formatMorphLeipzig } from "./morph_formatter.js";

(function () {
  // ===========================================================================
  // Hilfsfunktionen
  // ===========================================================================

  /**
   * Fügt führende Null hinzu, falls Zahl < 10.
   * @param {number} num
   * @returns {string}
   */
  function pad(num) {
    return num < 10 ? "0" + num : num.toString();
  }

  /**
   * Formatiert Zeit in Sekunden zu hh:mm:ss.
   * @param {number} timeInSeconds
   * @returns {string}
   */
  function formatTime(timeInSeconds) {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.round(timeInSeconds % 60);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  /**
   * Formatiert Zahl mit Tausenderpunkten.
   * @param {number} number
   * @returns {string}
   */
  function formatNumber(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  /**
   * Prüft, ob ein Element im Viewport sichtbar ist.
   * @param {Element} element
   * @returns {boolean}
   */
  function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // ===========================================================================
  // Token-ID-Sammler
  // ===========================================================================

  /** Array für gesammelte token_ids */
  let collectedTokenIds = [];

  /**
   * Fügt eine Token-ID hinzu, falls noch nicht vorhanden.
   * @param {string} tokenId
   */
  function addTokenId(tokenId) {
    if (!collectedTokenIds.includes(tokenId)) {
      collectedTokenIds.push(tokenId);
      updateTokenCollectorDisplay();
      resetCopyIconToDefault();
    }
  }

  /**
   * Aktualisiert die Anzeige der gesammelten Token-IDs.
   */
  function updateTokenCollectorDisplay() {
    const input = document.getElementById("tokenCollectorInput");
    input.value = collectedTokenIds.join(", ");
    input.style.height = "auto"; // zurücksetzen
    input.style.height = input.scrollHeight + "px"; // neu anpassen
  }

  /**
   * Setzt die Liste der Token-IDs zurück.
   */
  function resetTokenCollector() {
    collectedTokenIds = [];
    updateTokenCollectorDisplay();
    resetCopyIconToDefault();
  }

  /**
   * Kopiert die Token-IDs in die Zwischenablage.
   */
  function copyTokenListToClipboard() {
    const input = document.getElementById("tokenCollectorInput");
    navigator.clipboard
      .writeText(input.value)
      .then(() => {
        showCopyTooltip("Copiado al portapapeles");
        setCopyIconToCheck();
      })
      .catch((err) => console.error("Fehler beim Kopieren:", err));
  }

  function setCopyIconToCheck() {
    const icon = document.getElementById("copyTokenList");
    if (icon) {
      icon.classList.remove("fa-copy");
      icon.classList.add("fa-check");
      icon.classList.remove("fa-regular");
      icon.classList.add("fa-solid");
    }
  }

  function resetCopyIconToDefault() {
    const icon = document.getElementById("copyTokenList");
    if (icon) {
      icon.classList.remove("fa-check");
      icon.classList.add("fa-copy");
      icon.classList.remove("fa-solid");
      icon.classList.add("fa-regular");
    }
  }

  /**
   * Zeigt einen Tooltip beim Kopieren an.
   * @param {string} text
   */
  function showCopyTooltip(text) {
    const icon = document.getElementById("copyTokenList");
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip-text-pop";
    tooltip.innerText = text;
    document.body.appendChild(tooltip);

    const rect = icon.getBoundingClientRect();
    tooltip.style.top = `${rect.top + window.scrollY - 30}px`;
    tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2}px`;

    // Einblenden per Klasse
    requestAnimationFrame(() => {
      tooltip.classList.add("visible");
    });

    // Nach 1.5s sanft ausblenden
    setTimeout(() => {
      tooltip.classList.remove("visible");
      setTimeout(() => tooltip.remove(), 500); // Nach Übergang löschen
    }, 1500);
  }

  // ===========================================================================
  // Download-Modul
  // ===========================================================================

  /**
   * Erstellt einen Download-Link für eine Datei.
   * @param {string} elementId
   * @param {string} fileUrl
   * @param {string} fileType
   */
  function createDownloadLink(elementId, fileUrl, fileType) {
    const element = document.getElementById(elementId);
    if (element && fileUrl) {
      element.href = fileUrl;
      element.download = `export.${fileType}`;
    }
  }

  /**
   * Erstellt und startet den Download einer Textdatei mit Metadaten und Transkript.
   */
  function downloadTxtFile() {
    const metaContainer = document.getElementById("sidebarContainer-meta");
    const transcriptionContainer = document.getElementById(
      "transcriptionContainer",
    );

    if (!metaContainer || !transcriptionContainer) {
      console.warn(
        "[Player] Cannot download TXT - required elements not found",
      );
      return;
    }

    const metaInfo = metaContainer.innerText;
    const transcriptionContent = transcriptionContainer.innerText;
    const fullText = metaInfo + "\n\n" + transcriptionContent;

    const audioPlayer = document.getElementById("visualAudioPlayer");
    let filename = "export";
    if (audioPlayer) {
      const audioUrl = audioPlayer.src;
      if (audioUrl) {
        filename = audioUrl.split("/").pop().split(".").slice(0, -1).join(".");
      }
    }

    const textBlob = new Blob([fullText], { type: "text/plain" });
    const downloadLink = document.createElement("a");
    downloadLink.download = `${filename}.txt`;
    downloadLink.href = window.URL.createObjectURL(textBlob);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  // ===========================================================================
  // Audio-Player Modul
  // ===========================================================================

  /**
   * Initialisiert den Audio-Player mit Steuerungselementen.
   * @param {string} audioFile
   * @returns {HTMLAudioElement}
   */
  function initAudioPlayer(audioFile) {
    const playPauseBtn = document.getElementById("playPauseBtn");
    const rewindBtn = document.getElementById("rewindBtn");
    const forwardBtn = document.getElementById("forwardBtn");
    const progressBar = document.getElementById("progressBar");
    const volumeControl = document.getElementById("volumeControl");
    const speedControlSlider = document.getElementById("speedControlSlider");
    const muteBtn = document.getElementById("muteBtn");
    const timeDisplay = document.getElementById("timeDisplay");
    const speedDisplay = document.getElementById("speedDisplay");

    const visualAudioPlayer = document.createElement("audio");
    visualAudioPlayer.id = "visualAudioPlayer";

    // Audio-Pfad korrekt konstruieren mit MEDIA_ENDPOINT
    const audioPath =
      audioFile.startsWith("/") || audioFile.startsWith("http")
        ? audioFile
        : `${MEDIA_ENDPOINT}/${audioFile}`;

    visualAudioPlayer.src = audioPath;
    console.log("[Audio] Loading audio from:", audioPath);

    // Error Handling für Audio-Ladefehler
    visualAudioPlayer.addEventListener("error", (e) => {
      console.error("[Audio] Failed to load:", audioPath);
      console.error("[Audio] Error details:", e);
      alert(
        `Audio konnte nicht geladen werden.\nPfad: ${audioPath}\n\nBitte prüfe, ob die Datei existiert.`,
      );
    });

    document.querySelector(".custom-audio-player").prepend(visualAudioPlayer);

    visualAudioPlayer.addEventListener("loadedmetadata", () => {
      const durationMinutes = Math.floor(visualAudioPlayer.duration / 60) || 0;
      const durationSeconds = Math.floor(visualAudioPlayer.duration % 60) || 0;
      if (timeDisplay) {
        timeDisplay.textContent = `00:00 / ${pad(durationMinutes)}:${pad(durationSeconds)}`;
      }
      progressBar.value = 0;
    });

    function updatePlayPauseButton() {
      if (visualAudioPlayer.paused || visualAudioPlayer.ended) {
        playPauseBtn.classList.remove("bi-pause-circle-fill");
        playPauseBtn.classList.add("bi-play-circle-fill");
      } else {
        playPauseBtn.classList.remove("bi-play-circle-fill");
        playPauseBtn.classList.add("bi-pause-circle-fill");
      }
    }

    playPauseBtn.addEventListener("click", () => {
      if (visualAudioPlayer.paused) {
        visualAudioPlayer.play();
      } else {
        visualAudioPlayer.pause();
      }
      updatePlayPauseButton();
    });

    visualAudioPlayer.addEventListener("play", updatePlayPauseButton);
    visualAudioPlayer.addEventListener("pause", updatePlayPauseButton);

    rewindBtn.addEventListener("click", () => {
      visualAudioPlayer.currentTime = Math.max(
        0,
        visualAudioPlayer.currentTime - 3,
      );
      animateButton(rewindBtn, "fa-rotate-left");
    });
    forwardBtn.addEventListener("click", () => {
      visualAudioPlayer.currentTime = Math.min(
        visualAudioPlayer.duration,
        visualAudioPlayer.currentTime + 3,
      );
      animateButton(forwardBtn, "fa-rotate-right");
    });
    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.key === ",") {
        visualAudioPlayer.currentTime = Math.max(
          0,
          visualAudioPlayer.currentTime - 3,
        );
      }
      if (event.ctrlKey && event.key === ".") {
        visualAudioPlayer.currentTime = Math.min(
          visualAudioPlayer.duration,
          visualAudioPlayer.currentTime + 3,
        );
      }
    });

    volumeControl.addEventListener("input", function () {
      visualAudioPlayer.volume = parseFloat(this.value);
      updateVolumeIcon(this.value);
    });
    muteBtn.addEventListener("click", () => {
      visualAudioPlayer.muted = !visualAudioPlayer.muted;
      updateVolumeIcon(volumeControl.value);
    });
    function updateVolumeIcon(volume) {
      // MD3: Use Material Symbols icon names via textContent
      if (parseFloat(volume) > 0 && !visualAudioPlayer.muted) {
        muteBtn.textContent = 'volume_up';
      } else {
        muteBtn.textContent = 'volume_off';
      }
    }

    speedControlSlider.addEventListener("input", function () {
      const speed = parseFloat(this.value);
      visualAudioPlayer.playbackRate = speed;
      speedDisplay.textContent = `${speed.toFixed(1)}x`;
    });

    visualAudioPlayer.addEventListener("timeupdate", () => {
      progressBar.value =
        (visualAudioPlayer.currentTime / visualAudioPlayer.duration) * 100;
      updateTimeDisplay();
    });
    progressBar.addEventListener("input", function () {
      visualAudioPlayer.currentTime =
        (this.value / 100) * visualAudioPlayer.duration;
    });

    function updateTimeDisplay() {
      const currentMinutes = Math.floor(visualAudioPlayer.currentTime / 60);
      const currentSeconds = Math.floor(visualAudioPlayer.currentTime % 60);
      const durationMinutes = Math.floor(visualAudioPlayer.duration / 60) || 0;
      const durationSeconds = Math.floor(visualAudioPlayer.duration % 60) || 0;
      timeDisplay.textContent = `${pad(currentMinutes)}:${pad(currentSeconds)} / ${pad(durationMinutes)}:${pad(durationSeconds)}`;
    }

    function animateButton(button, baseClass) {
      // MD3: Use CSS animation class instead of FA-specific fade
      button.classList.add("md3-animate-pulse");
      setTimeout(() => {
        button.classList.remove("md3-animate-pulse");
      }, 300);
    }

    let ctrlSpaceActive = false;
    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.code === "Space" && !ctrlSpaceActive) {
        ctrlSpaceActive = true;
        if (visualAudioPlayer.paused) {
          visualAudioPlayer.play();
        } else {
          visualAudioPlayer.pause();
        }
        event.preventDefault();
        updatePlayPauseButton();
      }
    });
    document.addEventListener("keyup", (event) => {
      if (event.code === "Space") {
        ctrlSpaceActive = false;
        event.preventDefault();
        updatePlayPauseButton();
      }
    });

    return visualAudioPlayer;
  }

  // ===========================================================================
  // Transkript-Lade Modul (angepasst: für jeden Sprecher einen Block inkl. Zeit)
  // ===========================================================================

  /**
   * Lädt die Transkription und zeigt sie mit Sprecherblöcken und Zeit an.
   * @param {string} transcriptionFile
   * @param {HTMLAudioElement} visualAudioPlayer
   */
  function loadTranscription(transcriptionFile, visualAudioPlayer) {
    const filenameElement = document.getElementById("filename");
    const countryElement = document.getElementById("country");
    const cityElement = document.getElementById("city");
    const radioElement = document.getElementById("radio");
    const dateElement = document.getElementById("date");
    const revisionElement = document.getElementById("revision");
    const transcriptionContainer = document.getElementById(
      "transcriptionContainer",
    );
    const urlParams = new URLSearchParams(window.location.search);
    const targetTokenId = urlParams.get("token_id");
    // Mapping für die Sprecher-Codes
    const speakerAltMapping = {
      "lib-pm": `<span class="tooltip-high">Modo: </span>libre<br>
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
    };

    fetch(transcriptionFile)
      .then((response) => response.json())
      .then((transcriptionData) => {
        // Metadaten aktualisieren
        document.getElementById("documentName").textContent =
          transcriptionData.filename;
        countryElement.innerHTML = `País: <span class="meta-value meta-value--primary">${transcriptionData.country || "Unbekanntes Land"}</span>`;
        radioElement.innerHTML = `Emisora: <span class="meta-value">${transcriptionData.radio || "Unbekannter Radiosender"}</span>`;
        cityElement.innerHTML = `Ciudad: <span class="meta-value">${transcriptionData.city || "Unbekannte Stadt"}</span>`;
        revisionElement.innerHTML = `Revisión: <span class="meta-value">${transcriptionData.revision || "Unbekannte Revision"}</span>`;
        dateElement.innerHTML = `Fecha: <span class="meta-value">${transcriptionData.date || "Unbekanntes Datum"}</span>`;

        // Vorherigen Inhalt löschen
        transcriptionContainer.innerHTML = "";

        transcriptionData.segments.forEach((segment, segmentIndex) => {
          const speakerId = segment.speaker;
          const words = segment.words;
          if (!speakerId || !words || words.length === 0) {
            console.warn(
              `Segment ${segmentIndex} wird übersprungen (fehlende Sprecher- oder Wortdaten).`,
            );
            return;
          }

          // Erstelle den Hauptcontainer für diesen Sprecherabschnitt (zwei Spalten)
          const segmentContainer = document.createElement("div");
          segmentContainer.classList.add("speaker-turn");

          // Linke Spalte: Sprechername
          const speakerBlock = document.createElement("div");
          speakerBlock.classList.add("speaker-name");
          speakerBlock.style.position = "relative"; // Wichtig für die absolute Positionierung des Tooltips
          const speakerInfo = transcriptionData.speakers.find(
            (s) => s.spkid === speakerId,
          );
          const speakerName = speakerInfo ? speakerInfo.name : "otro";
          speakerBlock.textContent = speakerName;
          speakerBlock.style.cursor = "pointer";
          speakerBlock.addEventListener("click", () => {
            playVisualAudioSegment(
              words[0].start_ms / 1000,
              words[words.length - 1].end_ms / 1000,
              true,
            );
            console.log(
              `Speaker: ${speakerName} Start: ${words[0].start_ms / 1000} End: ${words[words.length - 1].end_ms / 1000}`,
            );
          });

          // Erstelle das User-Icon und Tooltip
          const userIcon = document.createElement("i");
          userIcon.classList.add("fa-solid", "fa-circle-user");
          userIcon.style.color = "#053c96";
          userIcon.style.marginLeft = "5px";
          userIcon.style.cursor = "pointer";

          const tooltip = document.createElement("span");
          tooltip.classList.add("tooltip-text");
          // Nutze innerHTML, damit HTML-Tags im Mapping übernommen werden
          tooltip.innerHTML = speakerAltMapping[speakerName] || "";

          // Tooltip anzeigen/verstecken beim Mouseover auf dem Icon
          userIcon.addEventListener("mouseover", () => {
            tooltip.classList.add("visible");
          });
          userIcon.addEventListener("mouseout", () => {
            tooltip.classList.remove("visible");
          });

          // Füge Icon und Tooltip dem Sprecherblock hinzu
          speakerBlock.appendChild(userIcon);
          speakerBlock.appendChild(tooltip);

          // Rechte Spalte: Container für Zeit und Text
          const contentContainer = document.createElement("div");
          contentContainer.classList.add("speaker-content");

          // Oben: Sprecherzeit (als eigene Zeile über dem Textblock)
          const speakerTimeElement = document.createElement("div");
          speakerTimeElement.classList.add("speaker-time");
          const speakerStartTime = formatTime(words[0].start_ms / 1000);
          const speakerEndTime = formatTime(words[words.length - 1].end_ms / 1000);
          speakerTimeElement.textContent = `${speakerStartTime} - ${speakerEndTime}`;

          // Darunter: Transkript (Wörter)
          const transcriptBlock = document.createElement("div");
          transcriptBlock.classList.add("speaker-text");

          // Gruppiere Wörter basierend auf Pausen und max. Gruppengröße
          const PAUSE_THRESHOLD = 0.25; // Reduziert für kleinere Gruppen
          const MAX_GROUP_SIZE = 3; // Max. Wörter pro Gruppe
          const wordGroups = [];
          let currentGroup = [];

          words.forEach((word, idx) => {
            currentGroup.push({ word, idx });

            // Prüfe ob Pause zum nächsten Wort ODER max. Gruppengröße erreicht
            if (idx < words.length - 1) {
              const pauseToNext = (words[idx + 1].start_ms - word.end_ms) / 1000;
              const groupIsFull = currentGroup.length >= MAX_GROUP_SIZE;

              if (pauseToNext >= PAUSE_THRESHOLD || groupIsFull) {
                wordGroups.push([...currentGroup]);
                currentGroup = [];
              }
            } else {
              // Letztes Wort - Gruppe abschließen
              wordGroups.push([...currentGroup]);
            }
          });

          // Weise jedem Wort seine Gruppe zu mit eindeutigem Identifier pro Segment
          words.forEach((word, idx) => {
            const wordElement = document.createElement("span");
            wordElement.textContent = word.text + " ";
            wordElement.classList.add("word");
            wordElement.dataset.start = word.start_ms / 1000;
            wordElement.dataset.end = word.end_ms / 1000;
            wordElement.dataset.tokenId = word.token_id;
            wordElement.style.cursor = "pointer";

            // Finde Gruppe für dieses Wort und erstelle eindeutigen Identifier mit segmentIndex
            const groupIndex = wordGroups.findIndex((group) =>
              group.some((item) => item.idx === idx),
            );
            wordElement.dataset.groupIndex = `${segmentIndex}-${groupIndex}`;

            if (targetTokenId && word.token_id === targetTokenId) {
              wordElement.classList.add("word-token-id");

              setTimeout(() => {
                wordElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });

                const startTime = parseFloat(word.start) - 0.25;
                if (!isNaN(startTime)) {
                  visualAudioPlayer.currentTime = Math.max(0, startTime);
                }
              }, 300);
            }

            const morphInfo = formatMorphLeipzig(word.pos, word.morph);

            const tooltipText = `
              <span class="tooltip-high">lemma:</span> <span class="tooltip-bold">${word.lemma}</span><br>
              <span class="tooltip-high">pos:</span> ${word.pos}, ${morphInfo}<br>
              <span class="tooltip-high">dep:</span> ${(word.dep || "").toUpperCase()}<br>
              <span class="tooltip-high">head_text:</span> <span class="tooltip-italic">${word.head_text}</span><br>
              <span class="tooltip-high">token_id:</span> <span class="tooltip-token">${word.token_id}</span><br>

            `;
            wordElement.dataset.tooltip = tooltipText;

            // Tooltip anzeigen
            wordElement.addEventListener("mouseenter", (event) => {
              const tooltip = document.createElement("div");
              tooltip.className = "tooltip-text";
              tooltip.innerHTML = event.target.dataset.tooltip;
              document.body.appendChild(tooltip);

              setTimeout(() => {
                const rect = event.target.getBoundingClientRect();
                tooltip.style.position = "absolute";
                tooltip.style.top = `${rect.bottom + window.scrollY + 6}px`;
                tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - tooltip.offsetWidth / 2}px`;
                tooltip.classList.add("visible");
              }, 0);

              event.target._tooltipElement = tooltip;
            });

            wordElement.addEventListener("mouseleave", (event) => {
              const tooltip = event.target._tooltipElement;
              if (tooltip) {
                tooltip.remove();
                event.target._tooltipElement = null;
              }
            });

            wordElement.addEventListener("click", (event) => {
              if (event.ctrlKey) {
                const startPrev =
                  idx > 0
                    ? parseFloat(words[idx - 1].start_ms) / 1000
                    : parseFloat(word.start_ms) / 1000;
                const endNext = parseFloat(wordElement.dataset.end);
                playVisualAudioSegment(startPrev, endNext, false);
                console.log(
                  `Start-Play: ${wordElement.textContent} Start: ${startPrev} End: ${endNext}`,
                );
              } else {
                const startPrev =
                  idx >= 2
                    ? parseFloat(words[idx - 2].start_ms) / 1000
                    : parseFloat(words[0].start_ms) / 1000;
                const endNext =
                  idx < words.length - 2
                    ? parseFloat(words[idx + 2].end_ms) / 1000
                    : parseFloat(word.end_ms) / 1000;
                playVisualAudioSegment(startPrev, endNext, true);
                if (!event.ctrlKey) {
                  wordElement.dataset.start = startPrev;
                  wordElement.dataset.end = endNext;
                }
                console.log(
                  `Word: ${wordElement.textContent} Start: ${startPrev} End: ${endNext}`,
                );
              }
              addTokenId(word.token_id);
            });

            transcriptBlock.appendChild(wordElement);
          });

          // Füge in den contentContainer zuerst die Sprecherzeit und dann den Transkriptblock ein
          contentContainer.appendChild(speakerTimeElement);
          contentContainer.appendChild(transcriptBlock);

          // Füge den Sprechername (linke Spalte) und den contentContainer (rechte Spalte) in den segmentContainer ein
          segmentContainer.appendChild(speakerBlock);
          segmentContainer.appendChild(contentContainer);

          transcriptionContainer.appendChild(segmentContainer);

          function playVisualAudioSegment(startTime, endTime, shouldPause) {
            if (visualAudioPlayer) {
              visualAudioPlayer.currentTime = startTime;
              visualAudioPlayer.play();
              const onTimeUpdate = () => {
                if (visualAudioPlayer.currentTime >= endTime) {
                  if (shouldPause) {
                    visualAudioPlayer.pause();
                    visualAudioPlayer.removeEventListener(
                      "timeupdate",
                      onTimeUpdate,
                    );
                  }
                }
              };
              visualAudioPlayer.addEventListener("timeupdate", onTimeUpdate);
            }
          }
        });

        fetch(transcriptionData.audioFile || visualAudioPlayer.src, {
          headers: { Range: "bytes=0-99999" },
        })
          .then((response) => {
            if (!response.ok && response.status !== 206) {
              throw new Error("Fehler beim Laden des Audios.");
            }
            return response.arrayBuffer();
          })
          .then((buffer) => {
            // audioBuffer steht zur weiteren Verarbeitung bereit (falls benötigt)
          })
          .catch((error) =>
            console.error("Fehler beim Laden des Audios:", error),
          );
      })
      .catch((error) =>
        console.error("Fehler beim Laden der Transkription:", error),
      );
  }

  // ===========================================================================
  // Wortmarkierung Modul
  // ===========================================================================

  let matchCounts = {};

  function markLetters() {
    console.log("markLetters wird aufgerufen.");
    const markInput = document.getElementById("markInput");
    let searchInput = markInput.value.trim().toLowerCase();
    if (!searchInput) return;

    let markType = "exact";
    let searchQuery = searchInput;
    let separatorRegex = /[ ,.?;]/;

    if (searchInput.endsWith("_")) {
      markType = "separator";
      searchQuery = searchInput.slice(0, -1);
      separatorRegex = /\s/;
    } else if (searchInput.endsWith("#")) {
      markType = "punctuation";
      searchQuery = searchInput.slice(0, -1);
      separatorRegex = /[.,;!?]/;
    }

    const words = document.querySelectorAll(".word");
    matchCounts[searchInput] = 0;

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
              markWordLetters(word, searchInput, markType);
              matchCounts[searchInput]++;
              break;
            }
          }
        }
      }
    });

    if (!document.getElementById(`button-${searchInput}`)) {
      createResetButton(searchInput);
    }
    markInput.value = "";
    checkResetButtonVisibility();
  }

  function markWordLetters(word, searchLetters, markType) {
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

  function createResetButton(searchLetters) {
    const resetButton = document.createElement("button");
    resetButton.id = `button-${searchLetters}`;
    resetButton.classList.add("letra");
    resetButton.innerHTML = `${searchLetters} <span class="result-count">(${matchCounts[searchLetters] || 0})</span>`;
    resetButton.addEventListener("click", () => {
      resetMarkingByLetters(searchLetters);
      resetButton.remove();
      checkResetButtonVisibility();
    });
    const buttonsContainer = document.getElementById("buttonsContainer");
    buttonsContainer.appendChild(resetButton);
    checkResetButtonVisibility();
  }

  function resetMarkings() {
    console.log("Reset der Markierungen");
    const words = document.querySelectorAll(".word");
    words.forEach((word) => resetWordMarkings(word));
    resetAllButtons();
    checkResetButtonVisibility();
  }

  function resetAllButtons() {
    const buttonsContainer = document.getElementById("buttonsContainer");
    while (buttonsContainer.firstChild) {
      buttonsContainer.removeChild(buttonsContainer.firstChild);
    }
    matchCounts = {};
  }

  function resetWordMarkings(word) {
    word.innerHTML = word.textContent;
  }

  function resetMarkingByLetters(searchLetters) {
    const words = document.querySelectorAll(".word");
    words.forEach((word) => resetWordMarkingsByLetters(word, searchLetters));
    checkResetButtonVisibility();
  }

  function resetWordMarkingsByLetters(word, searchLetters) {
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
      const spanEnd =
        spanStart >= 0 ? wordHTML.indexOf("</span>", spanStart) : -1;
      if (spanStart === -1) {
        newContent += wordHTML.substring(currentIndex);
        break;
      } else {
        newContent += wordHTML.substring(currentIndex, spanStart);
      }
      const highlightedTextStart =
        spanStart + '<span class="highlight">'.length;
      const highlightedText = wordHTML.substring(highlightedTextStart, spanEnd);
      let shouldRemove = highlightedText.toLowerCase() === searchQuery;
      if (markType !== "exact") {
        const nextChar = wordHTML.substring(
          spanEnd + "</span>".length,
          spanEnd + "</span>".length + 1,
        );
        const valid =
          (markType === "separator" && /\s/.test(nextChar)) ||
          (markType === "punctuation" && /[.,;!?]/.test(nextChar));
        shouldRemove = shouldRemove && valid;
      }
      newContent += shouldRemove
        ? highlightedText
        : `<span class="highlight">${highlightedText}</span>`;
      currentIndex = spanEnd + "</span>".length;
    }
    word.innerHTML = newContent;
  }

  function checkResetButtonVisibility() {
    // Funktion wird nicht mehr benötigt, da "Borrar todo" Button entfernt wurde
    // Individuelle .letra Chips zeigen sich automatisch bei Markierungen
  }

  // ===========================================================================
  // Tooltip-Funktion
  // ===========================================================================

  /**
   * Zeigt Tooltip bei Hover (MD3-konform).
   * @param {Event} event
   */
  function showTooltip(event) {
    const tooltip = event.target.nextElementSibling;
    if (tooltip && tooltip.classList.contains("tooltip-text")) {
      tooltip.classList.add("visible");
    }
  }

  /**
   * Versteckt Tooltip wenn Maus das Icon verlässt (MD3-konform).
   * @param {Event} event
   */
  function hideTooltip(event) {
    const tooltip = event.target.nextElementSibling;
    if (tooltip && tooltip.classList.contains("tooltip-text")) {
      tooltip.classList.remove("visible");
    }
  }

  // ===========================================================================
  // Footer Statistik Modul
  // ===========================================================================

  /**
   * Lädt und zeigt die Gesamtstatistik im Footer an.
   * Wird nur ausgeführt, wenn Footer-Elemente vorhanden sind.
   */
  function loadFooterStats() {
    const totalWordCountElement = document.getElementById("totalWordCount");
    const totalDurationElement = document.getElementById("totalDuration");

    // Nur ausführen, wenn Footer-Elemente existieren (nicht auf Player-Seite)
    if (!totalWordCountElement || !totalDurationElement) {
      console.log("[Footer Stats] Skipped - No footer elements on this page");
      return;
    }

    fetch("/get_stats_all_from_db")
      .then((response) => response.json())
      .then((data) => {
        updateTotalStats(data.total_word_count, data.total_duration_all);
      })
      .catch((error) => console.error("Error fetching footer stats:", error));

    /**
     * Aktualisiert die Anzeige der Gesamtstatistik.
     * @param {number} totalWordCount
     * @param {string} totalDuration
     */
    function updateTotalStats(totalWordCount, totalDuration) {
      totalDurationElement.innerHTML = `<span class="meta-value meta-value--primary">${totalDuration}</span> horas de audio`;
      totalWordCountElement.innerHTML = `<span class="meta-value meta-value--primary">${formatNumber(totalWordCount)}</span> palabras transcritas`;
    }
  }

  // ===========================================================================
  // Initialisierung
  // ===========================================================================

  document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const transcriptionFile = urlParams.get("transcription");
    const audioFile = urlParams.get("audio");

    console.log("[Player] Initializing...");
    console.log("[Player] Transcription file:", transcriptionFile);
    console.log("[Player] Audio file (raw):", audioFile);

    if (!transcriptionFile || !audioFile) {
      console.error("[Player] Missing required URL parameters!");
      alert("Fehler: Transkriptions- oder Audio-Datei fehlt in der URL.");
      return;
    }

    createDownloadLink("downloadMp3", audioFile, "mp3");
    createDownloadLink("downloadJson", transcriptionFile, "json");

    // Only bind if elements exist
    const downloadTxtBtn = document.getElementById("downloadTxt");
    if (downloadTxtBtn) {
      downloadTxtBtn.addEventListener("click", downloadTxtFile);
    }

    const markInput = document.getElementById("markInput");
    if (markInput) {
      markInput.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
          markLetters();
        }
      });
    }

    const visualAudioPlayer = initAudioPlayer(audioFile);

    loadTranscription(transcriptionFile, visualAudioPlayer);

    // Event Listener für Token-Buttons hinzufügen
    const copyTokenBtn = document.getElementById("copyTokenList");
    if (copyTokenBtn) {
      copyTokenBtn.addEventListener("click", copyTokenListToClipboard);
    }
    const resetTokenBtn = document.getElementById("resetTokenList");
    if (resetTokenBtn) {
      resetTokenBtn.addEventListener("click", resetTokenCollector);
    }

    loadFooterStats();

    const scrollToTopBtn = document.getElementById("scrollToTopBtn");
    if (scrollToTopBtn) {
      window.addEventListener("scroll", function () {
        if (
          document.body.scrollTop > 100 ||
          document.documentElement.scrollTop > 100
        ) {
          scrollToTopBtn.style.display = "block";
        } else {
          scrollToTopBtn.style.display = "none";
        }
      });
      scrollToTopBtn.addEventListener("click", function () {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      });
    }

    let isPlaying = false;
    let animationFrameId = null;

    visualAudioPlayer.addEventListener("play", function () {
      isPlaying = true;
      startWordHighlighting();
    });
    visualAudioPlayer.addEventListener("pause", function () {
      isPlaying = false;
      stopWordHighlighting();
    });
    visualAudioPlayer.addEventListener("ended", function () {
      isPlaying = false;
      stopWordHighlighting();
    });

    /**
     * Startet die kontinuierliche Wort-Markierung mit requestAnimationFrame
     */
    function startWordHighlighting() {
      if (animationFrameId) return; // Bereits aktiv

      function animate() {
        if (!isPlaying) return;
        updateWordsHighlight();
        animationFrameId = requestAnimationFrame(animate);
      }

      animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Stoppt die kontinuierliche Wort-Markierung
     */
    function stopWordHighlighting() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }

    /**
     * Hebt das aktuell gesprochene Wort und seine Gruppe hervor.
     * Nutzt verzögerte Entmarkierung und Preview-Effekt für flüssige Darstellung.
     */
    const DEACTIVATE_DELAY = 0.35; // Sekunden Verzögerung beim Entmarkieren (erhöht für flüssigeren Übergang)
    let lastActiveGroup = null;
    let deactivateTimeout = null;

    function updateWordsHighlight() {
      const currentTime = visualAudioPlayer.currentTime;
      const allWords = document.querySelectorAll(".word");
      let currentActiveGroup = null;
      let currentActiveWord = null;

      // Finde aktuell aktives Wort
      allWords.forEach((word) => {
        const start = parseFloat(word.dataset.start);
        const end = parseFloat(word.dataset.end);
        if (currentTime >= start && currentTime <= end) {
          currentActiveWord = word;
          currentActiveGroup = word.dataset.groupIndex;
        }
      });

      // Markiere alle Wörter der aktiven Gruppe
      if (currentActiveGroup !== null) {
        // Clear any pending deactivation
        if (deactivateTimeout) {
          clearTimeout(deactivateTimeout);
          deactivateTimeout = null;
        }

        allWords.forEach((word) => {
          if (word.dataset.groupIndex === currentActiveGroup) {
            word.classList.add("playing");
            // Scroll zum aktuell gesprochenen Wort (nicht zur ganzen Gruppe)
            if (word === currentActiveWord) {
              const rect = word.getBoundingClientRect();
              if (window.innerHeight - rect.bottom < 300) {
                word.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }
          } else {
            // Entferne playing Klasse von anderen Gruppen
            word.classList.remove("playing", "playing-preview");
          }
        });

        // Preview für nächste Gruppe (berücksichtige das Format "segmentIndex-groupIndex")
        const [segIdx, grpIdx] = currentActiveGroup.split("-").map(Number);
        const nextGroupIndex = `${segIdx}-${grpIdx + 1}`;
        allWords.forEach((word) => {
          if (word.dataset.groupIndex === nextGroupIndex) {
            word.classList.add("playing-preview");
          }
        });

        lastActiveGroup = currentActiveGroup;
      } else if (lastActiveGroup !== null) {
        // Kein aktives Wort - verzögerte Entmarkierung
        if (!deactivateTimeout) {
          deactivateTimeout = setTimeout(() => {
            allWords.forEach((word) => {
              word.classList.remove("playing", "playing-preview");
            });
            lastActiveGroup = null;
            deactivateTimeout = null;
          }, DEACTIVATE_DELAY * 1000);
        }
      }
    }
  });

  // ===========================================================================
  // Funktionen für globale Nutzung
  // ===========================================================================

  window.markLetters = markLetters;
  window.resetMarkings = resetMarkings;
  window.showTooltip = showTooltip;
  window.hideTooltip = hideTooltip;
})();
