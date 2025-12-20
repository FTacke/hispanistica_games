/**
 * Auth Refresh Module - Silent Token Refresh with MD3 Snackbar
 *
 * Handles automatic access token refresh when expired.
 * Shows MD3 Snackbar only when refresh token is also expired.
 */

import { showAuthExpiredSnackbar } from "./snackbar.js";

let isRefreshing = false;
let refreshPromise = null;

/**
 * Silent refresh of access token
 * @returns {Promise<boolean>} True if refresh successful, false otherwise
 */
async function silentRefresh() {
  if (isRefreshing) {
    // Wait for ongoing refresh
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch("/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          // CSRF token if needed (check your app config)
          // 'X-CSRF-TOKEN': getCsrfToken()
        },
      });

      if (response.ok) {
        console.log("[Auth] Access token refreshed successfully");
        return true;
      } else {
        const data = await response.json().catch(() => ({}));

        if (data.code === "refresh_expired") {
          console.log("[Auth] Refresh token expired - user must login");
          // Show MD3 Snackbar only when refresh is truly expired
          showAuthExpiredSnackbar();

          // Update auth state in DOM
          updateAuthState(false);
        } else {
          console.warn("[Auth] Refresh failed:", data.code || response.status);
        }

        return false;
      }
    } catch (error) {
      console.error("[Auth] Refresh error:", error);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
 * Fetch wrapper with automatic token refresh
 * @param {string} url - Request URL
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function fetchWithAuth(url, options = {}) {
  // Ensure credentials are included
  options.credentials = options.credentials || "same-origin";
  options.cache = options.cache || "no-store";

  // Make initial request
  let response = await fetch(url, options);

  // Check if access token expired
  if (response.status === 401) {
    try {
      const data = await response.json();

      if (data.code === "access_expired") {
        console.log("[Auth] Access token expired - attempting refresh");

        // Try to refresh token
        const refreshed = await silentRefresh();

        if (refreshed) {
          // Retry original request with new token
          console.log("[Auth] Retrying request with refreshed token");
          response = await fetch(url, options);
        } else {
          console.log("[Auth] Refresh failed - request will fail");
        }
      } else if (data.code === "refresh_expired") {
        // Refresh token expired - show snackbar
        showAuthExpiredSnackbar();
        updateAuthState(false);
      }
    } catch (error) {
      // Response was not JSON or other error
      console.warn("[Auth] Could not parse error response:", error);
    }
  }

  return response;
}

/**
 * Setup proactive token refresh based on expiration time
 * Checks session endpoint for token expiration and sets timer
 */
export async function setupProactiveRefresh() {
  try {
    const response = await fetch("/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (response.ok) {
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

          setTimeout(async () => {
            console.log("[Auth] Proactive token refresh triggered");
            const refreshed = await silentRefresh();

            if (refreshed) {
              // Setup next proactive refresh
              setupProactiveRefresh();
            }
          }, refreshIn);
        } else {
          console.log(
            "[Auth] Token already expired or expires soon - refreshing now",
          );
          await silentRefresh();
        }
      }
    }
  } catch (error) {
    console.warn("[Auth] Could not setup proactive refresh:", error);
  }
}

/**
 * Initialize auth refresh module
 */
export function initAuthRefresh() {
  console.log("[Auth] Initializing refresh module");

  // Setup proactive refresh on load
  setupProactiveRefresh();

  // Re-setup on Turbo navigation
  document.addEventListener("turbo:load", () => {
    setupProactiveRefresh();
  });
}
