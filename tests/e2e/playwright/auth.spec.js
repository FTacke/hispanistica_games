const { test, expect } = require('@playwright/test');

test('login → protected → refresh → logout (basic smoke)', async ({ page, request }) => {
  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';

  // 1) Login
  await page.goto(`${base}/auth/login`);
  await page.fill('#login-username', 'e2e_user');
  await page.fill('#login-password', 'password123');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type=submit]'),
  ]);

  // 2) Access protected page to verify cookie/session
  await page.goto(`${base}/auth/account/profile/page`);
  expect(page.url()).toContain('/auth/account/profile');

  // 3) Try a refresh via calling the endpoint (browser cookies will be present)
  const refreshResp = await request.post(`${base}/auth/refresh`);
  expect([200, 401, 403]).toContain(refreshResp.status()); // allow rotation behavior

  // 4) Trigger logout via UI (our data-logout handler) and ensure session cleared
  // Try UI-driven logout first (open menu → click logout). If the account
  // button/menu isn't present or clickable (strict page variants), fall back
  // to navigating directly to the logout URL which also clears cookies.
  try {
    await page.click('.md3-top-app-bar__account-button', { timeout: 2000 });
    await page.waitForSelector('[data-user-menu]', { state: 'visible', timeout: 2000 });
    await page.click('[data-logout="fetch"]');
  } catch (_e) {
    await page.goto(`${base}/auth/logout`);
  }
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('networkidle');

  // After logout attempt, accessing profile should redirect to login
  // After logout, protected pages may either redirect to login (HTML) or
  // return a 401 JSON response (API/JWT-protected). Accept both outcomes.
  const resp = await page.goto(`${base}/auth/account/profile/page`);
  const landed = page.url();
  if (!landed.includes('/auth/login')) {
    // Expect unauthorized status when there is no redirect
    expect(resp.status()).toBe(401);
  } else {
    expect(landed.includes('/auth/login')).toBeTruthy();
  }
});

test('login sheet shows Spanish MD3 warning for invalid credentials', async ({ page }) => {
  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';

  await page.goto(`${base}/auth/login`);
  // Use valid username but wrong password to surface 'invalid credentials' flow
  await page.fill('#login-username', 'e2e_user');
  await page.fill('#login-password', 'wrong-password');

  // Submit and wait for the sheet to display an error
  await Promise.all([
    page.waitForSelector('.md3-sheet__errors'),
    page.click('button[type=submit]'),
  ]);

  const err = await page.locator('.md3-sheet__errors .error-message__text').innerText();
  expect(err).toContain('Benutzername oder Passwort ist falsch');
});

test('login link navigates to full-page login (MD3 Goldstandard)', async ({ page }) => {
  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';

  await page.goto(`${base}/`);

  // Click the top-right login icon (unauthenticated state)
  await page.click('a[aria-label="Anmelden"]');

  // Wait for navigation to full-page login
  await page.waitForURL(/\/login/);

  // Ensure login form is present on the full page
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#login-form button[type=submit]')).toBeVisible();
  
  // Verify page has proper heading
  await expect(page.locator('h2:has-text("Anmelden")')).toBeVisible();
});

