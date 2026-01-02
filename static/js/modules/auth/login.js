/**
 * Games.Hispanistica Login Handler
 *
 * Provides JavaScript-based login handling for cases where AJAX login
 * is preferred over traditional form submission. Uses the api.js module
 * for CSRF-protected requests.
 *
 * Usage:
 *   import { initLoginForm } from '/static/js/modules/auth/login.js';
 *   initLoginForm('#login-form');
 *
 * Or for manual control:
 *   import { submitLogin } from '/static/js/modules/auth/login.js';
 *   const result = await submitLogin('admin', 'password', '/dashboard');
 */

import { api, getCsrfToken } from "/static/js/api.js";

/**
 * Submit login credentials via AJAX.
 *
 * @param {string} username - Username or email
 * @param {string} password - Password
 * @param {string} [nextUrl] - URL to redirect after successful login
 * @returns {Promise<{success: boolean, redirect?: string, error?: string}>}
 */
export async function submitLogin(username, password, nextUrl = null) {
  try {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    if (nextUrl) {
      formData.append("next", nextUrl);
    }

    const response = await api.request("/auth/login", {
      method: "POST",
      body: formData,
    });

    // Check for HTMX-style redirect header
    const hxRedirect = response.headers.get("HX-Redirect");
    if (hxRedirect) {
      return { success: true, redirect: hxRedirect };
    }

    // Check for standard redirect
    if (response.redirected) {
      return { success: true, redirect: response.url };
    }

    // If we get a 200/204, login was successful
    if (response.ok) {
      return { success: true, redirect: nextUrl || "/" };
    }

    // Parse error from response
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return { success: false, error: data.error || "Login failed" };
    }

    // For HTML responses (re-rendered login form with error)
    return { success: false, error: "Nombre de usuario o contraseña incorrectos." };
  } catch (err) {
    console.error("[Login] Error:", err);
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Initialize JavaScript login handling for a form element.
 * Intercepts form submission and handles it via AJAX with proper error display.
 *
 * @param {string|HTMLFormElement} formSelector - CSS selector or form element
 * @param {object} options - Configuration options
 * @param {Function} [options.onSuccess] - Callback on successful login
 * @param {Function} [options.onError] - Callback on login error
 * @param {boolean} [options.showSnackbar=true] - Show snackbar on error
 */
export function initLoginForm(formSelector, options = {}) {
  const form =
    typeof formSelector === "string"
      ? document.querySelector(formSelector)
      : formSelector;

  if (!form) {
    console.warn("[Login] Form not found:", formSelector);
    return;
  }

  // Prevent double initialization
  if (form.dataset.loginInitialized) {
    return;
  }
  form.dataset.loginInitialized = "true";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const usernameInput = form.querySelector(
      'input[name="username"], input[name="email"]'
    );
    const passwordInput = form.querySelector('input[name="password"]');
    const nextInput = form.querySelector('input[name="next"]');

    if (!usernameInput || !passwordInput) {
      console.error("[Login] Missing form inputs");
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const nextUrl = nextInput?.value || null;

    // Basic validation
    if (!username || !password) {
      showFormError(form, "Bitte alle Felder ausfüllen.");
      return;
    }

    // Disable form during submission
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("md3-button--loading");
    }

    try {
      const result = await submitLogin(username, password, nextUrl);

      if (result.success) {
        // Call success callback if provided
        if (options.onSuccess) {
          options.onSuccess(result);
        }

        // Redirect to target page
        if (result.redirect) {
          window.location.href = result.redirect;
        } else {
          window.location.reload();
        }
      } else {
        // Show error
        showFormError(form, result.error || "Login fehlgeschlagen.");

        if (options.onError) {
          options.onError(result);
        }

        // Re-enable form
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("md3-button--loading");
        }
      }
    } catch (err) {
      console.error("[Login] Unexpected error:", err);
      showFormError(form, "Ein Fehler ist aufgetreten. Bitte versuche es erneut.");

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("md3-button--loading");
      }
    }
  });

  console.log("[Login] Form handler initialized");
}

/**
 * Show an error message in the login form.
 * @param {HTMLFormElement} form
 * @param {string} message
 */
function showFormError(form, message) {
  // Look for existing error container or create one
  let errorEl = form.querySelector(".md3-form-error");
  if (!errorEl) {
    errorEl = document.createElement("div");
    errorEl.className = "md3-form-error md3-snackbar md3-snackbar--error";
    errorEl.setAttribute("role", "alert");
    form.insertBefore(errorEl, form.firstChild);
  }

  errorEl.textContent = message;
  errorEl.style.display = "block";

  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorEl.style.display = "none";
  }, 5000);
}

/**
 * Clear any displayed form errors.
 * @param {HTMLFormElement} form
 */
export function clearFormErrors(form) {
  const errorEl = form.querySelector(".md3-form-error");
  if (errorEl) {
    errorEl.style.display = "none";
  }
}

// Auto-initialize on DOMContentLoaded if login form exists
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm && loginForm.dataset.ajaxLogin === "true") {
    // Only auto-init if explicitly enabled via data attribute
    initLoginForm(loginForm);
  }
});

export default {
  submitLogin,
  initLoginForm,
  clearFormErrors,
};
