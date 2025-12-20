/**
 * Synchronize Audio Player position and width with #transcriptionContainer
 * This ensures the floating player aligns perfectly with the text content on desktop.
 */
export function initAudioPlayerLayout() {
  const player = document.querySelector('.custom-audio-player');
  const target = document.getElementById('transcriptionContainer');
  
  if (!player || !target) return;
  
  function alignPlayer() {
    // Only align on desktop (match the media query min-width: 992px)
    if (window.innerWidth >= 992) {
      const rect = target.getBoundingClientRect();
      
      // Apply target dimensions and position to the fixed player
      player.style.left = rect.left + 'px';
      player.style.width = rect.width + 'px';
      
      // Reset centering transforms and constraints
      player.style.transform = 'none';
      player.style.maxWidth = 'none'; 
    } else {
      // Reset to CSS defaults for mobile (centered, 90% width)
      player.style.left = '';
      player.style.width = '';
      player.style.transform = '';
      player.style.maxWidth = '';
    }
  }
  
  // Initial alignment
  alignPlayer();
  
  // Update on resize
  window.addEventListener('resize', alignPlayer);
  
  // Also update when content changes (e.g. transcription loads)
  // We can use ResizeObserver on the target
  const resizeObserver = new ResizeObserver(() => {
    alignPlayer();
  });
  resizeObserver.observe(target);
}

// Auto-init if loaded as a script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAudioPlayerLayout);
} else {
  initAudioPlayerLayout();
}
