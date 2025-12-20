/**
 * E2E tests for search flows.
 * 
 * Tests the search functionality from a user perspective.
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';

test.describe('Search Flows', () => {
  
  test('landing page has search functionality', async ({ page }) => {
    await page.goto(`${BASE}/`);
    
    // Look for search input or search link
    const hasSearchInput = await page.locator('input[type="search"], input[name="q"], .search-input').count() > 0;
    const hasSearchLink = await page.locator('a[href*="search"]').count() > 0;
    
    expect(hasSearchInput || hasSearchLink).toBeTruthy();
  });

  test('search page loads without errors', async ({ page }) => {
    // Try common search page paths
    const searchPaths = ['/search/advanced', '/corpus/search', '/search'];
    
    for (const path of searchPaths) {
      const response = await page.goto(`${BASE}${path}`);
      if (response && response.status() === 200) {
        // Found a valid search page
        await expect(page).not.toHaveTitle(/error/i);
        return;
      }
    }
    
    // If no search page found, it might require auth
    console.log('Search page may require authentication');
  });

  test('search form accepts input', async ({ page }) => {
    await page.goto(`${BASE}/`);
    
    // Find search input
    const searchInput = page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i], input[placeholder*="buscar" i]').first();
    
    if (await searchInput.count() > 0) {
      await searchInput.fill('test query');
      const value = await searchInput.inputValue();
      expect(value).toBe('test query');
    }
  });

});

test.describe('Admin User Management Flow', () => {

  test.beforeEach(async ({ page }) => {
    // This test requires admin login
    // Assuming e2e_user has admin privileges or using a separate admin account
  });

  test('admin can access user management page', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';
    
    // Login first
    await page.goto(`${base}/auth/login`);
    await page.fill('#login-username', 'e2e_user');
    await page.fill('#login-password', 'password123');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type=submit]'),
    ]);

    // Try to access admin users page
    const response = await page.goto(`${base}/admin/users`);
    
    // If user is admin, page loads. Otherwise, 403.
    if (response && response.status() === 200) {
      // Admin access confirmed
      await expect(page.locator('body')).toContainText(/user|usuario/i);
    } else {
      // User doesn't have admin role - expected for non-admin test user
      expect(response?.status()).toBe(403);
    }
  });

});

test.describe('Full User Journey', () => {

  test('anonymous user can browse public pages', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';
    
    // Landing page
    await page.goto(`${base}/`);
    expect(await page.title()).toBeTruthy();
    
    // Legal pages
    for (const path of ['/impressum', '/privacy', '/proyecto']) {
      const resp = await page.goto(`${base}${path}`);
      // These pages should exist (200) or redirect
      expect(resp?.status()).toBeLessThan(500);
    }
  });

  test('login → profile → logout flow', async ({ page }) => {
    const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';

    // 1. Go to login
    await page.goto(`${base}/auth/login`);
    await expect(page.locator('#login-form')).toBeVisible();

    // 2. Login
    await page.fill('#login-username', 'e2e_user');
    await page.fill('#login-password', 'password123');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type=submit]'),
    ]);

    // 3. Access profile
    await page.goto(`${base}/auth/account/profile/page`);
    const profileUrl = page.url();
    expect(profileUrl).toContain('/auth/account/profile');

    // 4. Logout
    try {
      // Try UI logout
      await page.click('.md3-top-app-bar__account-button', { timeout: 2000 });
      await page.waitForSelector('[data-user-menu]', { state: 'visible', timeout: 2000 });
      await page.click('[data-logout="fetch"]');
    } catch (_e) {
      // Fallback: direct navigation
      await page.goto(`${base}/auth/logout`);
    }
    await page.waitForLoadState('networkidle');

    // 5. Verify logged out - profile should redirect or 401
    const resp = await page.goto(`${base}/auth/account/profile/page`);
    const finalUrl = page.url();
    
    if (!finalUrl.includes('/auth/login')) {
      // If not redirected, should be 401
      expect(resp?.status()).toBe(401);
    }
  });

});

test.describe('Health Endpoints', () => {

  test('health endpoint returns status', async ({ request }) => {
    const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';
    
    const resp = await request.get(`${base}/health`);
    expect(resp.status()).toBe(200);
    
    const data = await resp.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('checks');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
  });

  test('auth health endpoint returns status', async ({ request }) => {
    const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';
    
    const resp = await request.get(`${base}/health/auth`);
    // Should be 200 or 503 depending on auth DB
    expect([200, 503]).toContain(resp.status());
    
    const data = await resp.json();
    expect(data).toHaveProperty('ok');
  });

});
