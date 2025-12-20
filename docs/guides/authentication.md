---
title: "Authentication Guide — CO.RA.PAN"
status: active
owner: backend-team
updated: "2025-11-21"
tags: [authentication, jwt, guide, security]
links:
  - ../reference/api-auth-endpoints.md
  - ../reference/auth-access-matrix.md
  - ../troubleshooting/auth-issues.md
---

# Authentication Guide

This guide provides a comprehensive overview of the authentication system in the CO.RA.PAN web application. It covers the user experience, technical architecture, implementation details, and configuration.

## 1. Overview

CO.RA.PAN uses a **JWT (JSON Web Token)** based authentication system stored in **HttpOnly Cookies**. This ensures security (protection against XSS) and statelessness on the server side.

The system supports two modes of operation for most pages:
1.  **Public / Anonymous**: Users can search the corpus and listen to short audio snippets (if configured).
2.  **Authenticated**: Users have access to full transcripts, the full audio player, and advanced features like the editor or admin panel.

## 2. User Experience

### Login Flow
1.  Users click "Iniciar sesión" in the top bar or are prompted when trying to access a protected feature.
2.  A login sheet (modal) or full page appears.
3.  Upon successful login, the user is redirected back to their previous page or the intended target.
4.  The UI updates to show the user's avatar and enables advanced features.

### Protected vs. Optional Content
-   **Public Pages**: Landing page, About, Help.
-   **Optional Auth Pages**: Corpus Search, Atlas. These pages work for everyone but show more data/features to logged-in users.
-   **Protected Pages**: Player (full), Editor, Admin. These require login and will redirect to the login page if accessed anonymously.

## 3. Technical Architecture

### Backend (Flask)
The backend uses `Flask-JWT-Extended` to manage tokens.

-   **Access Token**: Short-lived JWT (e.g., 1 hour) stored in `access_token_cookie`.
-   **Refresh Token**: Long-lived JWT (e.g., 30 days) stored in `refresh_token_cookie`.
-   **CSRF Protection**: Double Submit Cookie pattern for mutating requests.

#### Route Protection
Routes are protected using decorators:

1.  **`@jwt_required()`**: Mandatory authentication. Redirects to login if no valid token is found.
    *   Used for: `/player`, `/editor`, `/admin`.
2.  **`@jwt_required(optional=True)`**: Optional authentication.
    *   If a valid token is present, `g.user` is set.
    *   If no token or invalid token, `g.user` is `None`, but the route **still executes**.
    *   Used for: `/corpus`, `/search`, `/media`.

#### Session Check Endpoint
The `/auth/session` endpoint is the source of truth for the client.
-   **Method**: `GET`
-   **Response**: JSON `{ "authenticated": true|false, "user": "...", "exp": ... }`
-   **Status**: Always `200 OK` (never 401, to avoid triggering error handlers).

### Frontend (JavaScript)
The frontend relies on the server's state but maintains a local flag for UI logic.

#### `auth-setup.js`
This critical script is loaded early in `base.html`. It performs the following:
1.  **Fetch Interceptor**: Ensures `credentials: 'same-origin'` is added to all `fetch` requests so cookies are sent.
2.  **Initial State**: Reads `data-auth` attribute from the Top App Bar to set `window.IS_AUTHENTICATED` immediately (synchronous).
3.  **Verification**: Asynchronously calls `/auth/session` to verify the session and update `window.IS_AUTHENTICATED`.

#### `window.IS_AUTHENTICATED`
A global variable (`'true'` or `'false'`) used by UI components to check auth state without a network request.
*   **Usage**: `if (window.IS_AUTHENTICATED === 'true') { ... }`
*   **Note**: Always check against string `'true'` or boolean `true` for robustness.

## 4. Configuration

Key configuration variables in `config.py` or environment variables:

-   `JWT_SECRET_KEY`: Secret for signing tokens.
-   `JWT_ACCESS_TOKEN_EXPIRES`: Duration of access token.
-   `ALLOW_PUBLIC_TEMP_AUDIO`: If `True`, anonymous users can play audio snippets. If `False`, even snippets require login.

## 5. Common Issues & Troubleshooting

### "Para ver la transcripción completa..." Error
If a user sees this error despite being logged in:
1.  **Cause**: `window.IS_AUTHENTICATED` is not set correctly.
2.  **Fix**: Ensure `auth-setup.js` is loaded in `base.html`.
3.  **Debug**: Check console for `[Auth] ✅ Authenticated as: ...`.

### 401 Errors on Optional Routes
If an optional route returns 401:
1.  **Cause**: The browser sent an expired or invalid token, and Flask-JWT-Extended's default behavior is to error out.
2.  **Fix**: The `expired_token_loader` and `invalid_token_loader` in `src/app/extensions/__init__.py` must handle optional routes gracefully (e.g., by ignoring the error for specific paths).

### Login Loop
If a user logs in but is immediately redirected back to login:
1.  **Cause**: Cookies are not being set or are being rejected (e.g., cross-domain issues, missing `Secure` flag on HTTPS).
2.  **Fix**: Check browser developer tools > Application > Cookies. Ensure `SameSite` and `Secure` attributes are correct.

## 6. Reference Links
-   [API Authentication Endpoints](../reference/api-auth-endpoints.md)
-   [Authentication Access Matrix](../reference/auth-access-matrix.md)
-   [Troubleshooting Auth Issues](../troubleshooting/auth-issues.md)
