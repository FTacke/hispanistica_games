/**
 * UI Utilities
 * Handles preload guard, page title updates, and scroll state.
 */

export function initPreloadGuard() {
  document.body.classList.add('preload');
  requestAnimationFrame(() => {
    document.body.classList.remove('preload');
    document.documentElement.setAttribute('data-anim-ready', '1');
  });
  // Also enable on first user interaction (fallback for slow browsers)
  window.addEventListener('pointerdown', () => {
    document.documentElement.setAttribute('data-anim-ready', '1');
  }, { once: true });
}



export function initPageTitleAndScroll() {
  if (window.__pageTitleInit) return;
  window.__pageTitleInit = true;

  // Title wird ausschließlich serverseitig über page_section in base.html gesetzt
  // Diese Funktion kümmert sich nur noch um Scroll-State

  function applyScroll() {
    const thr = 8;
    if (window.scrollY > thr) {
      document.body.setAttribute('data-scrolled', 'true');
    } else {
      document.body.removeAttribute('data-scrolled');
    }
  }

  applyScroll();
  window.addEventListener('scroll', applyScroll, { passive: true });

  if (window.htmx) {
    document.body.addEventListener('htmx:afterSwap', applyScroll);
    document.body.addEventListener('htmx:afterSettle', applyScroll);
    document.body.addEventListener('htmx:historyRestore', applyScroll);
  }

  if (window.Turbo) {
    document.addEventListener('turbo:render', applyScroll);
  }

  window.addEventListener('popstate', applyScroll);
}
