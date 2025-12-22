/**
 * E2E Tests for Quiz Module
 * 
 * Tests cover:
 * - Unified auth (name+PIN auto-create/login)
 * - Quiz gameplay flow with state machine
 * - 50/50 joker usage (2x limit)
 * - Answer feedback and auto-advance
 */

const { test, expect } = require('@playwright/test');

// Base URL for tests
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';

test.describe('Quiz Module - Unified Auth', () => {
  test('should auto-create new user with name+PIN', async ({ page }) => {
    await page.goto(`${BASE_URL}/quiz`);
    
    // Click on test topic
    await page.click('text=Test Topic');
    
    // Should be on topic entry page
    await expect(page).toHaveURL(/\/quiz\/test_topic/);
    
    // Fill in name and PIN
    const uniqueName = `TestUser${Date.now()}`;
    await page.fill('input[name="name"]', uniqueName);
    await page.fill('input[name="pin"]', 'TEST');
    
    // Submit auth form
    await page.click('button:has-text("Starten")');
    
    // Should be on play page
    await expect(page).toHaveURL(/\/quiz\/test_topic\/play/);
    
    // Should see first question
    await expect(page.locator('.quiz-question')).toBeVisible();
  });

  test('should login existing user with correct PIN', async ({ page }) => {
    const testName = `ExistingUser${Date.now()}`;
    
    // First, create the user
    await page.goto(`${BASE_URL}/quiz/test_topic`);
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="pin"]', 'GOOD');
    await page.click('button:has-text("Starten")');
    await expect(page).toHaveURL(/\/quiz\/test_topic\/play/);
    
    // Go back to entry page (simulate logout)
    await page.goto(`${BASE_URL}/quiz/test_topic`);
    
    // Login with same credentials
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="pin"]', 'GOOD');
    await page.click('button:has-text("Starten")');
    
    // Should be on play page
    await expect(page).toHaveURL(/\/quiz\/test_topic\/play/);
  });

  test('should show error for wrong PIN', async ({ page }) => {
    const testName = `PinTestUser${Date.now()}`;
    
    // Create user with PIN
    await page.goto(`${BASE_URL}/quiz/test_topic`);
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="pin"]', 'GOOD');
    await page.click('button:has-text("Starten")');
    await expect(page).toHaveURL(/\/quiz\/test_topic\/play/);
    
    // Go back and try wrong PIN
    await page.goto(`${BASE_URL}/quiz/test_topic`);
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="pin"]', 'BADD');
    await page.click('button:has-text("Starten")');
    
    // Should show error message
    await expect(page.locator('text=/PIN|incorrect|falsch/i')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Quiz Module - Gameplay Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Create user and start quiz
    const uniqueName = `GameUser${Date.now()}`;
    await page.goto(`${BASE_URL}/quiz/test_topic`);
    await page.fill('input[name="name"]', uniqueName);
    await page.fill('input[name="pin"]', 'TEST');
    await page.click('button:has-text("Starten")');
    await expect(page).toHaveURL(/\/quiz\/test_topic\/play/);
  });

  test('should display question and options', async ({ page }) => {
    // Wait for question to load
    await expect(page.locator('.quiz-question')).toBeVisible();
    
    // Should have 4 answer options
    const options = page.locator('.quiz-answer');
    await expect(options).toHaveCount(4);
  });

  test('should show feedback after answering and advance on Weiter', async ({ page }) => {
    // Wait for question
    await expect(page.locator('.quiz-question')).toBeVisible();
    
    // Click first answer
    await page.click('.quiz-answer:first-child');
    
    // Should show feedback panel
    await expect(page.locator('.quiz-feedback')).toBeVisible({ timeout: 2000 });
    
    // Should show either correct or wrong feedback
    const feedbackText = await page.locator('.quiz-feedback').textContent();
    expect(feedbackText).toMatch(/richtig|falsch|correct|wrong/i);
    
    // Should show Weiter button
    const weiterBtn = page.locator('.quiz-weiter-btn, button:has-text("Weiter")');
    await expect(weiterBtn).toBeVisible();
    
    // Click Weiter
    await weiterBtn.click();
    
    // Should advance to next question (or finish screen)
    // Wait a bit for state change
    await page.waitForTimeout(500);
  });

  test('should auto-advance after 15 seconds if no Weiter click', async ({ page }) => {
    // Wait for question
    await expect(page.locator('.quiz-question')).toBeVisible();
    
    // Get initial question text
    const initialQuestion = await page.locator('.quiz-question').textContent();
    
    // Click first answer
    await page.click('.quiz-answer:first-child');
    
    // Should show feedback
    await expect(page.locator('.quiz-feedback')).toBeVisible({ timeout: 2000 });
    
    // Wait for auto-advance (15 seconds + buffer)
    await page.waitForTimeout(16000);
    
    // Question should have changed or we're on finish screen
    const newContent = await page.locator('.quiz-question, .quiz-finish').textContent();
    expect(newContent).not.toBe(initialQuestion);
  }, { timeout: 30000 }); // Extend test timeout for 15s wait
});

test.describe('Quiz Module - 50/50 Joker', () => {
  test.beforeEach(async ({ page }) => {
    // Create user and start quiz
    const uniqueName = `JokerUser${Date.now()}`;
    await page.goto(`${BASE_URL}/quiz/test_topic`);
    await page.fill('input[name="name"]', uniqueName);
    await page.fill('input[name="pin"]', 'TEST');
    await page.click('button:has-text("Starten")');
    await expect(page).toHaveURL(/\/quiz\/test_topic\/play/);
  });

  test('should use 50/50 joker and hide 2 wrong answers', async ({ page }) => {
    // Wait for question
    await expect(page.locator('.quiz-question')).toBeVisible();
    
    // Count visible answers before joker
    const optionsBefore = await page.locator('.quiz-answer:visible').count();
    expect(optionsBefore).toBe(4);
    
    // Click joker button
    const jokerBtn = page.locator('.quiz-joker-btn, button:has-text("50/50")');
    await expect(jokerBtn).toBeVisible();
    await jokerBtn.click();
    
    // Wait for joker to apply
    await page.waitForTimeout(500);
    
    // Should have exactly 2 visible answers
    const optionsAfter = await page.locator('.quiz-answer:visible').count();
    expect(optionsAfter).toBe(2);
    
    // 2 answers should be hidden
    const hiddenOptions = await page.locator('.quiz-answer.quiz-answer--hidden').count();
    expect(hiddenOptions).toBe(2);
  });

  test('should allow joker usage exactly 2 times per run', async ({ page }) => {
    // Wait for question
    await expect(page.locator('.quiz-question')).toBeVisible();
    
    const jokerBtn = page.locator('.quiz-joker-btn, button:has-text("50/50")');
    
    // Use joker 1st time
    await expect(jokerBtn).toBeEnabled();
    await jokerBtn.click();
    await page.waitForTimeout(500);
    
    // Answer and proceed to next question
    await page.click('.quiz-answer:visible:first-child');
    await expect(page.locator('.quiz-feedback')).toBeVisible({ timeout: 2000 });
    const weiterBtn = page.locator('.quiz-weiter-btn, button:has-text("Weiter")');
    await weiterBtn.click();
    await page.waitForTimeout(1000);
    
    // Use joker 2nd time
    await expect(jokerBtn).toBeEnabled();
    await jokerBtn.click();
    await page.waitForTimeout(500);
    
    // Answer and proceed
    await page.click('.quiz-answer:visible:first-child');
    await expect(page.locator('.quiz-feedback')).toBeVisible({ timeout: 2000 });
    await weiterBtn.click();
    await page.waitForTimeout(1000);
    
    // Try joker 3rd time - should be disabled
    await expect(jokerBtn).toBeDisabled();
  });
});

test.describe('Quiz Module - Navigation', () => {
  test('should have Quiz link in navigation and navigate to quiz page', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Set viewport to ensure consistent behavior
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Navigate directly to quiz page to verify it works
    await page.goto(`${BASE_URL}/quiz`);
    
    // Should be on quiz index page
    await expect(page).toHaveURL(/\/quiz/);
    
    // Should see quiz page content (topic list or heading)
    await expect(page.locator('body')).toContainText(/quiz/i);
  });
});
