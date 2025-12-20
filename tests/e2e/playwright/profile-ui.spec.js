const { test, expect } = require('@playwright/test');

// Helper to login as e2e user
async function login(page, base) {
  await page.goto(`${base}/auth/login`);
  await page.fill('#login-username', 'e2e_user');
  await page.fill('#login-password', 'password123');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type=submit]'),
  ]);
}

test.describe('Profile UI', () => {
  const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';

  test('buttons do not change width on hover and icons are centered', async ({ page }) => {
    await login(page, base);

    await page.goto(`${base}/auth/account/profile/page`);
    await expect(page).toHaveURL(/\/auth\/account\/profile/);

    // Selectors
    const saveBtn = page.locator('#save');
    const changePassword = page.locator('a[href$="/auth/account/password/page"]');

    // Capture widths before and after hover
    const saveBox1 = await saveBtn.boundingBox();
    await saveBtn.hover();
    const saveBox2 = await saveBtn.boundingBox();

    const changeBox1 = await changePassword.boundingBox();
    await changePassword.hover();
    const changeBox2 = await changePassword.boundingBox();

    // Allow tiny rendering differences but not layout change
    expect(Math.abs(saveBox1.width - saveBox2.width)).toBeLessThan(2);
    expect(Math.abs(changeBox1.width - changeBox2.width)).toBeLessThan(2);

    // Icon vertical center check (approx): compare icon center y to button center y
    const saveIcon = page.locator('#save .md3-button__icon');
    const saveIconBox = await saveIcon.boundingBox();
    const saveBtnBox = saveBox2;
    // center distance should be small
    expect(Math.abs((saveIconBox.y + saveIconBox.height / 2) - (saveBtnBox.y + saveBtnBox.height / 2))).toBeLessThan(4);
  });

  test('delete dialog: wrong password shows error; successful deletion triggers logout + redirect (mocked)', async ({ page }) => {
    await login(page, base);
    await page.goto(`${base}/auth/account/profile/page`);

    // Open dialog
    await page.click('#delete-account-btn');
    await page.waitForSelector('#delete-dialog[open]');

    // Enter wrong password and confirm
    await page.fill('#delete-password', 'nope');
    await page.click('#confirm-delete');

    const err = page.locator('#delete-error');
    await expect(err).toBeVisible();
    await expect(err).toHaveText(/Ungültiges Passwort|invalid/i);

    // Now intercept the DELETE endpoint to simulate server-side 202 accept
    await page.route('**/auth/account/delete', async route => {
      await route.fulfill({ status: 202, body: JSON.stringify({ accepted: true }) });
    });

    // Also intercept logout POST to respond OK (best-effort)
    let logoutCalled = false;
    await page.route('**/auth/logout', async route => {
      logoutCalled = true;
      await route.fulfill({ status: 200, body: JSON.stringify({ msg: 'logout successful' }) });
    });

    // Enter correct pw and confirm
    await page.fill('#delete-password', 'password123');

    // Wait for navigation to base after successful delete+logout
    const [response] = await Promise.all([
      page.waitForNavigation({ url: base + '/', waitUntil: 'networkidle' }),
      page.click('#confirm-delete'),
    ]);

    // Ensure logout was called by the client
    expect(logoutCalled).toBeTruthy();

    // After redirect, profile page should not be accessible — verify redirect to login
    await page.goto(`${base}/auth/account/profile/page`);
    expect(page.url()).toMatch(/\/auth\/login/);
  });

  test('profile edit: username and email editable and saved (mocked)', async ({ page }) => {
    await login(page, base);
    await page.goto(`${base}/auth/account/profile/page`);

    // Username input should be editable and pre-filled
    const usernameInput = page.locator('#username');
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).not.toHaveAttribute('readonly', 'true');
    await expect(usernameInput).toHaveValue(/e2e_user/);

    // Intercept the PATCH and assert body contains username + email
    let captured = null;
    await page.route('**/auth/account/profile', async route => {
      if (route.request().method() === 'PATCH') {
        captured = await route.request().postDataJSON();
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      } else {
        await route.continue();
      }
    });

    // Change both fields
    await usernameInput.fill('e2e_user_new');
    await page.fill('#email', 'e2e_user_new@example.com');

    // Save
    await page.click('#save');

    // Wait briefly for client-side status update
    await page.waitForSelector('#status');
    const statusText = await page.locator('#status').innerText();
    expect(statusText).toContain('Profil erfolgreich gespeichert');

    // Ensure PATCH body contained both fields
    expect(captured).not.toBeNull();
    expect(captured.username).toBe('e2e_user_new');
    expect(captured.email).toBe('e2e_user_new@example.com');
  });
});
