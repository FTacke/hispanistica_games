/**
 * CO.RA.PAN API Client
 *
 * Centralized fetch wrapper with automatic CSRF token handling.
 * Use this for all API requests that modify data (POST/PUT/PATCH/DELETE).
 *
 * Usage:
 *   import { api, getCsrfToken } from '/static/js/api.js';
 *
 *   // Simple POST
 *   const response = await api.post('/auth/login', { username: 'admin', password: 'secret' });
 *
 *   // GET request (no CSRF needed)
 *   const data = await api.get('/api/data');
 *
 *   // With custom options
 *   const response = await api.request('/api/endpoint', {
 *     method: 'PUT',
 *     body: JSON.stringify({ key: 'value' })
 *   });
 */

// =============================================================================
// CSRF Token Utilities
// =============================================================================

/**
 * Get CSRF token from cookies.
 * Flask-JWT-Extended sets csrf_access_token in cookies when JWT is issued.
 *
 * @param {string} tokenName - Cookie name (default: csrf_access_token)
 * @returns {string|null} - CSRF token or null if not found
 */
export function getCsrfToken(tokenName = "csrf_access_token") {
  const name = tokenName + "=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(";");

  for (let cookie of cookieArray) {
    cookie = cookie.trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length);
    }
  }

  return null;
}

/**
 * Check if the request method requires CSRF protection.
 * @param {string} method - HTTP method
 * @returns {boolean}
 */
function requiresCsrf(method) {
  const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];
  return mutatingMethods.includes(method.toUpperCase());
}

// =============================================================================
// API Client
// =============================================================================

/**
 * Make an API request with automatic CSRF token handling.
 *
 * @param {string} url - Request URL
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>} - Fetch response
 */
async function request(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  // Default options
  const fetchOptions = {
    credentials: "same-origin", // Always include cookies
    ...options,
    headers: {
      ...options.headers,
    },
  };

  // Add CSRF token for mutating requests
  if (requiresCsrf(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      fetchOptions.headers["X-CSRF-TOKEN"] = csrfToken;
    }
  }

  // If body is an object (not FormData), JSON-stringify it
  if (
    fetchOptions.body &&
    typeof fetchOptions.body === "object" &&
    !(fetchOptions.body instanceof FormData) &&
    !(fetchOptions.body instanceof URLSearchParams)
  ) {
    fetchOptions.body = JSON.stringify(fetchOptions.body);
    if (!fetchOptions.headers["Content-Type"]) {
      fetchOptions.headers["Content-Type"] = "application/json";
    }
  }

  return fetch(url, fetchOptions);
}

/**
 * Make a GET request.
 * @param {string} url - Request URL
 * @param {object} options - Additional fetch options
 * @returns {Promise<any>} - Parsed JSON response
 */
async function get(url, options = {}) {
  const response = await request(url, { ...options, method: "GET" });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text(), url);
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

/**
 * Make a POST request with JSON body.
 * @param {string} url - Request URL
 * @param {object} data - Request body (will be JSON-stringified)
 * @param {object} options - Additional fetch options
 * @returns {Promise<Response>} - Fetch response
 */
async function post(url, data = null, options = {}) {
  return request(url, {
    ...options,
    method: "POST",
    body: data,
  });
}

/**
 * Make a PUT request with JSON body.
 * @param {string} url - Request URL
 * @param {object} data - Request body
 * @param {object} options - Additional fetch options
 * @returns {Promise<Response>}
 */
async function put(url, data = null, options = {}) {
  return request(url, {
    ...options,
    method: "PUT",
    body: data,
  });
}

/**
 * Make a PATCH request with JSON body.
 * @param {string} url - Request URL
 * @param {object} data - Request body
 * @param {object} options - Additional fetch options
 * @returns {Promise<Response>}
 */
async function patch(url, data = null, options = {}) {
  return request(url, {
    ...options,
    method: "PATCH",
    body: data,
  });
}

/**
 * Make a DELETE request.
 * @param {string} url - Request URL
 * @param {object} options - Additional fetch options
 * @returns {Promise<Response>}
 */
async function del(url, options = {}) {
  return request(url, {
    ...options,
    method: "DELETE",
  });
}

/**
 * Submit a form via fetch with CSRF protection.
 * Useful for forms that need AJAX submission instead of traditional form post.
 *
 * @param {HTMLFormElement} form - The form element
 * @param {object} options - Additional fetch options
 * @returns {Promise<Response>}
 */
async function submitForm(form, options = {}) {
  const formData = new FormData(form);
  const method = (form.method || "POST").toUpperCase();

  return request(form.action, {
    ...options,
    method: method,
    body: formData,
  });
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * API Error class for better error handling.
 */
class ApiError extends Error {
  constructor(status, message, url) {
    super(`API Error ${status}: ${message}`);
    this.status = status;
    this.url = url;
    this.name = "ApiError";
  }
}

// =============================================================================
// Export API object
// =============================================================================

export const api = {
  request,
  get,
  post,
  put,
  patch,
  delete: del,
  submitForm,
};

// Also expose on window for non-module scripts
if (typeof window !== "undefined") {
  window.hispanisticaApi = api;
  window.getCsrfToken = getCsrfToken;
}

export default api;
