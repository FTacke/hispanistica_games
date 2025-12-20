/**
 * Corpus Guía page scripts
 * Handles copy functionality for CQL prompt code block
 */
(function() {
  'use strict';

  function initCopyButton() {
    const copyBtn = document.getElementById('copy-cql-prompt');
    const promptText = document.getElementById('cql-prompt-text');
    
    if (!copyBtn || !promptText) {
      return;
    }
    
    copyBtn.addEventListener('click', function() {
      const textToCopy = (promptText.innerText || promptText.textContent || '').trim();
      if (!textToCopy) return;
      
      navigator.clipboard.writeText(textToCopy).then(function() {
        // Show success feedback
        copyBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">check</span>';
        copyBtn.classList.add('md3-code-block__copy--success');
        setTimeout(function() {
          copyBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">content_copy</span>';
          copyBtn.classList.remove('md3-code-block__copy--success');
        }, 2000);
      }).catch(function(err) {
        console.error('Copy failed:', err);
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCopyButton);
  } else {
    initCopyButton();
  }
})();
