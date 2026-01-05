/*
 * Logout helper
 * - Intercepts clicks on elements with data-logout="fetch" and performs
 *   a fetch request to the logout endpoint, then refreshes the UI using
 *   window.location.reload()
 * - Keeps fallback via href for no-JS environments
 */

(function () {
  if (typeof window === 'undefined') return;
  // Avoid double-binding click handlers if script runs multiple times
  if (window.__logoutInit) return;
  window.__logoutInit = true;

  function performLogout(el) {
    const url = el.dataset.logoutUrl || el.getAttribute('href') || '/auth/logout';
    const method = (el.dataset.logoutMethod || 'POST').toUpperCase();

    // Try to obtain a CSRF token helper if available
    const token = (window.authSetup && window.authSetup.getCSRFToken) ? window.authSetup.getCSRFToken() : null;

    const opts = {
      method: method,
      credentials: 'same-origin',
      headers: {},
    };

    if (token && method !== 'GET') {
      opts.headers['X-CSRF-Token'] = token;
    }

    // Add a safety timeout so the UI doesn't hang when fetch hangs or server is slow.
    const fetchWithTimeout = (resource, options = {}, timeout = 3000) => {
      return Promise.race([
        fetch(resource, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
      ]);
    };

    return fetchWithTimeout(url, opts, 3000)
      .then((res) => {
        // If server uses HTMX-style redirect headers prefer that value
        const hxRedirect = res.headers && res.headers.get && res.headers.get('HX-Redirect');
        if (hxRedirect) {
          window.location.href = hxRedirect;
          return;
        }
        // Regardless of server response (JSON or redirect), navigate to the
        // site root. This avoids showing raw JSON errors to users after logout
        // when using fetch-based logout handling.
        // Prefer server-sent redirect URL when present.
        if (res.redirected && res.url) {
          window.location.href = res.url;
          return;
        }

        // Otherwise go to index/root to present the logged-out landing page.
        window.location.href = '/';
      })
      .catch((err) => {
        console.error('[Logout] Failed', err);
        // fallback to non-JS behaviour
        // Force navigation to the logout URL (GET) — ensures we leave protected pages
        window.location.href = url;
      });
  }

  function onClick(e) {
    const el = e.target.closest && e.target.closest('[data-logout="fetch"], .md3-user-menu__item--logout');
    if (!el) return;

    // If it's a GET-only logout anchor, prefer to POST via fetch for safety, but respect data attributes
    e.preventDefault();
    performLogout(el);
  }

  document.addEventListener('click', onClick, { passive: false });

  // Find initial elements and make them accessible for assistive tech
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-logout="fetch"]').forEach(function (el) {
      el.setAttribute('role', el.getAttribute('role') || 'button');
      el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
    });
  });

  // Expose helper for tests
  window.HISPANISTICA = window.HISPANISTICA || {};
  window.HISPANISTICA.logout = performLogout;

})();
