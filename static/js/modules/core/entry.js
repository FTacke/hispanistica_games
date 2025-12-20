/**
 * Core Entry Point
 * Loaded on every page via base.html.
 */

import { initCsrfProtection } from "./csrf.js";
import { initAuthHandler, checkAutoLogin } from "./auth_handler.js";
import { initPageRouter } from "./router.js";
import { initPreloadGuard, initPageTitleAndScroll } from "./ui.js";
import { initConfig } from "./config.js";
import { initFlashSnackbar } from "./snackbar.js";

// Import legacy main.js to preserve existing functionality (Navigation, Token Refresh, etc.)
import "../../main.js";

// Initialize Config
initConfig();

// Initialize CSRF protection immediately (it attaches event listeners)
initCsrfProtection();

// Check for auto-login immediately (mimicking the IIFE at end of body)
checkAutoLogin();

// Initialize Preload Guard immediately
initPreloadGuard();

// Initialize Page Title and Scroll logic
initPageTitleAndScroll();

// Initialize Flash Snackbar (shows success messages from login etc.)
initFlashSnackbar();

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Auth Handler (401 listener and param check)
    initAuthHandler();
    
    // Initialize Page Router
    initPageRouter();
});
