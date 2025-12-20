/**
 * CSRF Protection for HTMX Requests
 * 
 * Flask-JWT-Extended sets two CSRF tokens:
 * - csrf_access_token: Used when access_token is present
 * - csrf_refresh_token: Used when refresh_token is present
 * 
 * This hook injects the appropriate CSRF token into all HTMX POST/PUT/DELETE requests.
 * GET requests are exempt from CSRF protection (by design).
 */

function getCookie(name) {
  const cookies = document.cookie.split("; ");
  const cookie = cookies.find(c => c.startsWith(name + "="));
  return cookie ? cookie.split("=")[1] : null;
}

export function initCsrfProtection() {
  document.body.addEventListener("htmx:configRequest", function(evt){
    // Only add CSRF token for mutating requests (POST/PUT/DELETE/PATCH)
    const method = evt.detail.verb?.toUpperCase();
    if (!method || method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return; // Skip GET requests
    }
    
    // Try csrf_access_token first, then csrf_refresh_token as fallback
    let csrf = getCookie("csrf_access_token") || getCookie("csrf_refresh_token");

    // If no cookie token present, check for hidden csrf_token form field
    if (!csrf) {
      try {
        // evt.detail.elt may be the element being submitted / triggered
        const elt = evt.detail.elt || document.querySelector('form[action*="/auth/login"]') || document.querySelector('form');
        if (elt) {
          // find hidden input named csrf_token inside the element or its form
          const input = elt.querySelector ? elt.querySelector('input[name="csrf_token"]') : null;
          if (input && input.value) csrf = input.value;
        }
      } catch (e) {
        // ignore DOM read errors
      }
    }

    if (csrf) {
      evt.detail.headers["X-CSRF-TOKEN"] = csrf;
      console.debug('[CSRF] Injected token for', method, evt.detail.path);
    } else {
      console.warn('[CSRF] No CSRF token found for', method, evt.detail.path);
    }
  });
}
