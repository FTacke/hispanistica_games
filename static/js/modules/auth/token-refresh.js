/**
 * JWT Token Auto-Refresh Module
 *
 * Automatically refreshes access tokens when they expire (401 responses).
 * Shows MD3 Snackbar only when refresh token expires.
 * Supports proactive refresh based on token expiration time.
 *
 * Usage:
 *   import { setupTokenRefresh } from './modules/auth/token-refresh.js';
 *   setupTokenRefresh();
 */

import { showAuthExpiredSnackbar } from "./snackbar.js";

// Store original fetch FIRST before we override it
const originalFetch = window.fetch;

let isRefreshing = false;
let failedQueue = [];
let proactiveRefreshTimer = null;

/**
 * Process queued requests after token refresh
 */
function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

/**
 * Update auth state in DOM
 * @param {boolean} isAuthenticated
 */
function updateAuthState(isAuthenticated) {
  const topAppBar = document.querySelector('[data-element="top-app-bar"]');
  if (topAppBar) {
    topAppBar.dataset.auth = isAuthenticated ? "true" : "false";
  }
}

/**
 * Refresh the access token using the refresh token
 * @returns {Promise<boolean>} True if refresh successful
 */
async function refreshAccessToken() {
  try {
    // Use ORIGINAL fetch to avoid recursion
    const response = await originalFetch("/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      // Check if refresh token expired
      if (data.code === "refresh_expired") {
        console.log("❌ Refresh token expired - user must login");
        showAuthExpiredSnackbar();
        updateAuthState(false);
      } else {
        console.error("❌ Token refresh failed:", data.code || response.status);
      }

      return false;
    }

    console.log("✅ Access token refreshed successfully");

    // Setup next proactive refresh
    setupProactiveRefresh();

    return true;
  } catch (error) {
    console.error("❌ Token refresh error:", error);
    return false;
  }
}

/**
 * Enhanced fetch wrapper with automatic token refresh
 * @param {string} url - Request URL
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithTokenRefresh(url, options = {}) {
  // First attempt - use ORIGINAL fetch to avoid recursion
  const response = await originalFetch(url, {
    ...options,
    credentials: options.credentials || "same-origin",
  });

  // If not 401, return response as-is
  if (response.status !== 401) {
    return response;
  }

  // Check error code to determine if refresh is needed
  let shouldRefresh = false;
  try {
    const data = await response.clone().json();
    if (data.code === "access_expired") {
      shouldRefresh = true;
      console.log("🔄 Access token expired, attempting refresh...");
    } else if (data.code === "refresh_expired") {
      console.log("❌ Refresh token expired - showing snackbar");
      showAuthExpiredSnackbar();
      updateAuthState(false);
      return response;
    } else {
      console.log("❌ Unauthorized:", data.code);
      return response;
    }
  } catch (e) {
    // Response not JSON or already consumed - try refresh anyway
    shouldRefresh = true;
  }

  if (!shouldRefresh) {
    return response;
  }

  // If already refreshing, queue this request
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({
        resolve: () => {
          // Retry original request after refresh - use ORIGINAL fetch
          originalFetch(url, {
            ...options,
            credentials: options.credentials || "same-origin",
          })
            .then(resolve)
            .catch(reject);
        },
        reject,
      });
    });
  }

  isRefreshing = true;

  try {
    const refreshSuccess = await refreshAccessToken();

    if (!refreshSuccess) {
      processQueue(new Error("Token refresh failed"), null);
      isRefreshing = false;
      return response; // Return original 401 response
    }

    // Refresh successful, process queued requests
    processQueue(null, true);
    isRefreshing = false;

    // Retry original request with new token - use ORIGINAL fetch
    return originalFetch(url, {
      ...options,
      credentials: options.credentials || "same-origin",
    });
  } catch (error) {
    processQueue(error, null);
    isRefreshing = false;
    throw error;
  }
}

/**
 * Setup proactive token refresh based on expiration time
 * Checks session endpoint for token expiration and sets timer
 */
async function setupProactiveRefresh() {
  // Clear existing timer
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }

  try {
    const response = await originalFetch("/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    });

    // Defensive: Only proceed if response is OK
    if (!response.ok) {
      console.warn(
        "[Auth] Session check returned non-OK status:",
        response.status,
      );
      return;
    }

    // Defensive: Check content-type before parsing JSON
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.warn("[Auth] Session check returned non-JSON response");
      return;
    }

    const data = await response.json();

    if (data.authenticated && data.exp) {
      const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
      const expiresIn = data.exp - now;

      // Refresh 60 seconds before expiration
      const refreshIn = Math.max(0, (expiresIn - 60) * 1000); // Convert to milliseconds

      if (refreshIn > 0) {
        console.log(
          `[Auth] Will refresh token in ${Math.floor(refreshIn / 1000)}s`,
        );

        proactiveRefreshTimer = setTimeout(async () => {
          console.log("[Auth] Proactive token refresh triggered");
          await refreshAccessToken();
        }, refreshIn);
      } else {
        console.log("[Auth] Token already expired or expires soon");
      }
    }
  } catch (error) {
    // Silently handle errors - proactive refresh is a nice-to-have
    console.warn("[Auth] Could not setup proactive refresh:", error);
  }
}

/**
 * Setup global fetch interceptor for automatic token refresh
 * Call this once when your app initializes
 */
export function setupTokenRefresh() {
  // Override global fetch with our wrapper
  window.fetch = function (...args) {
    const [url, options] = args;

    // Skip refresh logic for:
    // - The refresh endpoint itself (avoid infinite loop)
    // - Static assets
    // - External URLs
    if (
      typeof url === "string" &&
      (url === "/auth/refresh" ||
        url.startsWith("/static/") ||
        url.startsWith("http://") ||
        url.startsWith("https://"))
    ) {
      return originalFetch.apply(this, args);
    }

    // Use our enhanced fetch for API calls
    return fetchWithTokenRefresh(url, options);
  };

  console.log("✅ JWT Token auto-refresh enabled");

  // Setup proactive refresh
  setupProactiveRefresh();

  // Re-setup on Turbo navigation
  document.addEventListener("turbo:load", () => {
    setupProactiveRefresh();
  });
}

/**
 * Get CSRF token from cookie (needed for protected endpoints)
 * @param {string} name - Cookie name
 * @returns {string|null}
 */
export function getCsrfToken(name = "csrf_access_token") {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(";").shift();
  }
  return null;
}

/**
 * Add CSRF token to fetch headers if available
 * @param {HeadersInit} headers - Existing headers
 * @returns {HeadersInit}
 */
export function addCsrfHeader(headers = {}) {
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    return {
      ...headers,
      "X-CSRF-TOKEN": csrfToken,
    };
  }
  return headers;
}
