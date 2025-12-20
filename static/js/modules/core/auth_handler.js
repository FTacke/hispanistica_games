/**
 * Authentication Handler
 * Handles 401 errors and auto-login triggers.
 */

export function initAuthHandler() {
  // 401 Handler: Open Login Sheet on Authentication Errors
  document.body.addEventListener("htmx:responseError", function(evt){
    if (evt.detail.xhr && evt.detail.xhr.status === 401) {
      // Fetch login sheet and inject into modal-root
      if (window.htmx) {
        // Redirect to canonical full-page login instead of showing a sheet.
        // Prefer the original request path if available, fall back to current location.
        const nextTarget = (evt.detail && evt.detail.requestConfig && evt.detail.requestConfig.path) || document.location.href;
        window.location.href = "/login?next=" + encodeURIComponent(nextTarget);
      }
    }
  });

  // Open login sheet on page load if ?login=1 is present (from 401 redirect)
  const params = new URLSearchParams(location.search);
  if (params.get("login") === "1") {
    // Prefer opening the canonical login page for end-user flows.
    // Support older flows that set ?login=1 on landing pages by navigating
    // to /login (preserving next param when present).
    const next = params.get("next") || "";
    const url = "/login" + (next ? "?next=" + encodeURIComponent(next) : "");
    window.location.replace(url);
  }
}

export function checkAutoLogin() {
  const p = new URLSearchParams(location.search);
  if (p.get("login") === "1") {
    const next = p.get("next") || "";
    const url = "/login" + (next ? "?next=" + encodeURIComponent(next) : "");
    // Use replace to avoid keeping the transient ?login=1 in history
    window.location.replace(url);
  }
}
