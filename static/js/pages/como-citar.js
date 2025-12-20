/**
 * Citation Format Selector
 * Handles format switching via Choice Chips and copy functionality for the "Cómo citar" page.
 * @module pages/como-citar
 */

(function () {
  'use strict';

  // Citation formats data
  const CITATION_FORMATS = {
    apa: `Tacke, F. (2025). CO.RA.PAN — Corpus Radiofónico Panhispánico.
Philipps-Universität Marburg, Marburg. https://corapan.online.uni-marburg.de
DOI: https://doi.org/10.5281/zenodo.15360942`,

    chicago: `Tacke, Felix. 2025. CO.RA.PAN — Corpus Radiofónico Panhispánico.
Marburg: Philipps-Universität Marburg. https://corapan.online.uni-marburg.de
DOI: https://doi.org/10.5281/zenodo.15360942`,

    mla: `Tacke, Felix. CO.RA.PAN — Corpus Radiofónico Panhispánico.
Philipps-Universität Marburg, Marburg, 2025. https://corapan.online.uni-marburg.de
DOI: https://doi.org/10.5281/zenodo.15360942`,

    bibtex: `@dataset{corapan2025,
  author    = {Tacke, Felix},
  title     = {CO.RA.PAN — Corpus Radiofónico Panhispánico},
  year      = {2025},
  publisher = {Philipps-Universität Marburg},
  address   = {Marburg},
  doi       = {10.5281/zenodo.15360942},
  url       = {https://corapan.online.uni-marburg.de}
}`,

    ris: `TY  - DATA
TI  - CO.RA.PAN — Corpus Radiofónico Panhispánico
AU  - Tacke, Felix
PY  - 2025
PB  - Philipps-Universität Marburg
CY  - Marburg
UR  - https://corapan.online.uni-marburg.de
DO  - 10.5281/zenodo.15360942
ER  -`
  };

  // DOM elements
  let chipsContainer = null;
  let chips = null;
  let citationText = null;
  let copyButton = null;
  let statusElement = null;

  /**
   * Update the citation textarea based on selected format
   * @param {string} format - The citation format key
   */
  function updateCitation(format) {
    if (!citationText || !CITATION_FORMATS[format]) return;
    citationText.value = CITATION_FORMATS[format];
  }

  /**
   * Update chip selection state and ARIA attributes
   * @param {HTMLElement} selectedChip - The chip that was selected
   */
  function selectChip(selectedChip) {
    chips.forEach(chip => {
      chip.classList.remove('is-selected');
      chip.setAttribute('aria-checked', 'false');
      chip.setAttribute('tabindex', '-1');
    });
    
    selectedChip.classList.add('is-selected');
    selectedChip.setAttribute('aria-checked', 'true');
    selectedChip.setAttribute('tabindex', '0');
    selectedChip.focus();
    
    updateCitation(selectedChip.dataset.format);
  }

  /**
   * Handle keyboard navigation within the chip group (arrow keys)
   * @param {KeyboardEvent} e - The keyboard event
   */
  function handleChipKeydown(e) {
    const currentIndex = Array.from(chips).indexOf(e.target);
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        newIndex = (currentIndex + 1) % chips.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        newIndex = (currentIndex - 1 + chips.length) % chips.length;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = chips.length - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        selectChip(e.target);
        return;
      default:
        return;
    }

    selectChip(chips[newIndex]);
  }

  /**
   * Copy citation text to clipboard with visual feedback
   */
  async function copyCitation() {
    if (!citationText) return;

    const text = citationText.value;
    
    try {
      await navigator.clipboard.writeText(text);
      showCopyFeedback(true);
    } catch (err) {
      // Fallback for older browsers
      const tempTextArea = document.createElement('textarea');
      tempTextArea.value = text;
      tempTextArea.style.position = 'fixed';
      tempTextArea.style.left = '-9999px';
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      
      try {
        document.execCommand('copy');
        showCopyFeedback(true);
      } catch (e) {
        console.error('Copy failed:', e);
        showCopyFeedback(false);
      }
      
      document.body.removeChild(tempTextArea);
    }
  }

  /**
   * Show visual and accessible feedback for copy action
   * @param {boolean} success - Whether the copy was successful
   */
  function showCopyFeedback(success) {
    if (!copyButton || !statusElement) return;

    const icon = copyButton.querySelector('.material-symbols-rounded');
    const originalIcon = icon ? icon.textContent : 'content_copy';

    // Visual feedback - change icon temporarily
    if (icon) {
      icon.textContent = success ? 'check' : 'error';
      copyButton.classList.add(success ? 'icon-button--success' : 'icon-button--error');
    }

    // Screen reader feedback
    statusElement.textContent = success 
      ? 'Cita copiada al portapapeles' 
      : 'Error al copiar la cita';

    // Reset after delay
    setTimeout(() => {
      if (icon) {
        icon.textContent = originalIcon;
        copyButton.classList.remove('icon-button--success', 'icon-button--error');
      }
      // Clear status for next action
      setTimeout(() => {
        statusElement.textContent = '';
      }, 1000);
    }, 1500);
  }

  /**
   * Initialize the citation selector functionality
   */
  function init() {
    chipsContainer = document.getElementById('citationFormatChips');
    citationText = document.getElementById('citationText');
    copyButton = document.getElementById('copyCitationBtn');
    statusElement = document.getElementById('citation-copy-status');

    if (!chipsContainer || !citationText) {
      // Not on the citation page, exit silently
      return;
    }

    chips = chipsContainer.querySelectorAll('.chip-choice');

    // Set initial tabindex state for roving tabindex pattern
    chips.forEach((chip, index) => {
      chip.setAttribute('tabindex', chip.classList.contains('is-selected') ? '0' : '-1');
      
      // Click handler
      chip.addEventListener('click', () => selectChip(chip));
      
      // Keyboard navigation
      chip.addEventListener('keydown', handleChipKeydown);
    });

    // Copy button handler
    if (copyButton) {
      copyButton.addEventListener('click', copyCitation);
    }

    // Initialize with default format (APA)
    updateCitation('apa');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
