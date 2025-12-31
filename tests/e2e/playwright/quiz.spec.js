/**
 * E2E Tests for Quiz Module
 *
 * NOTE: The entry UX is deterministic:
 * - Auth (name+PIN) redirects back to entry
 * - User must explicitly click Start/Fortsetzen/Neu starten
 */

const { test, expect } = require('@playwright/test');

// Base URL for tests
const BASE_URL =
  process.env.E2E_BASE_URL ||
  process.env.BASE_URL ||
  'http://127.0.0.1:8000';

async function ensureLoggedOut(page) {
  // Be robust against storageState / previous test runs.
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/quiz`);
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // ignore
    }
  });
  await page.evaluate(async () => {
    try {
      await fetch('/api/quiz/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
  });
}

async function gotoAnyTopicEntry(page) {
  await page.goto(`${BASE_URL}/quiz`);
  const playBtns = page.locator('a.quiz-topic-card__play-btn');
  await expect(playBtns.first()).toBeVisible({ timeout: 15000 });
  await playBtns.first().click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => window.__quizEntryReady === true, null, { timeout: 15000 }).catch(() => null);

  // Should land on /quiz/<topic_id>
  await expect(page).toHaveURL(/\/quiz\/[a-zA-Z0-9_\-]+/);
  const topicId = await page.locator('.game-shell').getAttribute('data-topic');
  return topicId;
}

async function authOnEntry(page, name, pin) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => window.__quizEntryReady === true, null, { timeout: 15000 }).catch(() => null);

  // If already authenticated, the entry shows Start/Fortsetzen instead of the auth form.
  const authForm = page.locator('#quiz-auth-form');
  if (await authForm.isVisible().catch(() => false)) {
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="pin"]', pin);

    // The JS handler submits via fetch to /api/quiz/auth/name-pin.
    // If we click too early (before handlers attach), the browser may do a normal GET
    // submit which appends ?name=...&pin=... and does NOT authenticate.
    const authRespPromise = page
      .waitForResponse(
        (r) => r.url().includes('/api/quiz/auth/name-pin') && r.request().method() === 'POST',
        { timeout: 15000 }
      )
      .catch(() => null);

    await page.click('#quiz-auth-submit');

    const authResp = await authRespPromise;
    if (authResp) {
      expect(authResp.ok()).toBeTruthy();
    }

    // Successful auth triggers a client-side navigation back to the entry page.
    await page.waitForLoadState('domcontentloaded');
  }
  // Successful auth redirects back to entry (same URL).
  await expect(page.locator('.quiz-login--authenticated')).toBeVisible({ timeout: 15000 });
}

async function waitForQuestionPayload(page) {
  const resp = await page.waitForResponse(
    (r) => r.url().includes('/api/quiz/questions/') && r.request().method() === 'GET' && r.ok(),
    { timeout: 30000 }
  );
  return await resp.json();
}

async function startRunFromEntry(page) {
  // Entry has two distinct auth states:
  // - unauthenticated: shows #quiz-auth-form
  // - authenticated: shows .quiz-login--authenticated with Start/Fortsetzen controls
  const authBox = page.locator('.quiz-login--authenticated');
  await expect(authBox).toBeVisible({ timeout: 10000 });

  // Ensure click handlers are attached (avoids flake where clicks do nothing).
  await page.waitForFunction(() => window.__quizEntryReady === true, null, { timeout: 15000 }).catch(() => null);

  // Be specific to avoid matching "Neu starten".
  const startBtn = authBox.locator('#quiz-start-btn');
  const resumeBtn = authBox.locator('a:has-text("Fortsetzen")');

  if (await startBtn.isVisible().catch(() => false)) {
    const startResp = page.waitForResponse(
      (r) => r.url().includes('/run/start') && r.request().method() === 'POST' && r.ok(),
      { timeout: 20000 }
    );
    const qPromise = waitForQuestionPayload(page);
    await startBtn.click();
    await startResp;
    await page.waitForURL(/\/quiz\/.+\/play/, { timeout: 30000 });
    await expect(page.locator('.quiz-question')).toBeVisible({ timeout: 15000 });
    return await qPromise;
  }

  await expect(resumeBtn).toBeVisible({ timeout: 10000 });
  const qPromise = waitForQuestionPayload(page);
  await Promise.all([
    page.waitForURL(/\/quiz\/.+\/play/, { timeout: 15000 }),
    resumeBtn.click(),
  ]);
  await expect(page.locator('.quiz-question')).toBeVisible({ timeout: 15000 });
  return await qPromise;
}

async function expectAnsweredState(page) {
  const weiterBtn = page.locator('#quiz-weiter-btn');
  const explanationCard = page.locator('#quiz-explanation-card');

  await expect(weiterBtn).toBeVisible({ timeout: 5000 });
  await expect(explanationCard).toBeVisible({ timeout: 5000 });

  const anyState = page.locator(
    '.quiz-answer--selected-correct, .quiz-answer--selected-wrong, .quiz-answer--correct-reveal'
  );
  await expect(anyState.first()).toBeVisible({ timeout: 5000 });
}

async function answerCorrectNoWeiter(page, questionPayload) {
  await expect(page.locator('.quiz-question')).toBeVisible({ timeout: 15000 });
  if (questionPayload?.prompt_key) {
    await expect(page.locator('#quiz-question-prompt')).toHaveText(String(questionPayload.prompt_key), { timeout: 15000 });
  }
  const correct = (questionPayload?.answers || []).find((a) => a && a.correct);
  if (!correct) {
    throw new Error('No correct answer found in /api/quiz/questions payload');
  }

  await page.locator(`.quiz-answer[data-answer-id="${String(correct.id)}"]`).click();
  await expectAnsweredState(page);
}

async function answerCorrectAndContinue(page, questionPayload) {
  await expect(page.locator('.quiz-question')).toBeVisible({ timeout: 15000 });
  if (questionPayload?.prompt_key) {
    await expect(page.locator('#quiz-question-prompt')).toHaveText(String(questionPayload.prompt_key), { timeout: 15000 });
  }
  const correct = (questionPayload?.answers || []).find((a) => a && a.correct);
  if (!correct) {
    throw new Error('No correct answer found in /api/quiz/questions payload');
  }

  await page.locator(`.quiz-answer[data-answer-id="${String(correct.id)}"]`).click();
  await expectAnsweredState(page);

  const weiterBtn = page.locator('#quiz-weiter-btn, .quiz-weiter-btn, button:has-text("Weiter")');
  await expect(weiterBtn).toBeVisible({ timeout: 5000 });
  await weiterBtn.click();
}

async function waitForNextStage(page, { autoDismissLevelUp = true } = {}) {
  const levelUp = page.locator('#quiz-level-up-stage');
  const finish = page.locator('#quiz-finish-stage');
  const question = page.locator('.quiz-question');

  await Promise.race([
    levelUp.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
    finish.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
    question.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
  ]);

  if (await levelUp.isVisible().catch(() => false)) {
    if (autoDismissLevelUp) {
      await levelUp.click();
      await expect(question).toBeVisible({ timeout: 15000 });
    }
  }
}

test.describe('Quiz Module - Unified Auth', () => {
  test('should auto-create new user with name+PIN', async ({ page }) => {
    await ensureLoggedOut(page);
    await gotoAnyTopicEntry(page);
    const uniqueName = `TestUser${Date.now()}`;
    await authOnEntry(page, uniqueName, 'TEST');
    await startRunFromEntry(page);
  });

  test('should login existing user with correct PIN', async ({ page }) => {
    const testName = `ExistingUser${Date.now()}`;

    await ensureLoggedOut(page);
    await page.goto(`${BASE_URL}/quiz`);
    const topicId = await gotoAnyTopicEntry(page);
    await authOnEntry(page, testName, 'GOOD');

    await startRunFromEntry(page);

    // Logout, then login again
    await page.goto(`${BASE_URL}/quiz/${topicId}`);
    const logoutBtn = page.locator('#quiz-logout-btn');
    await expect(logoutBtn).toBeVisible({ timeout: 10000 });
    await logoutBtn.click();
    await expect(page.locator('#quiz-auth-form')).toBeVisible({ timeout: 10000 });

    await authOnEntry(page, testName, 'GOOD');
    await startRunFromEntry(page);
  });

  test('should show error for wrong PIN', async ({ page }) => {
    const testName = `PinTestUser${Date.now()}`;

    await ensureLoggedOut(page);
    const topicId = await gotoAnyTopicEntry(page);
    await authOnEntry(page, testName, 'GOOD');

    await startRunFromEntry(page);

    // Logout and try wrong PIN
    await page.goto(`${BASE_URL}/quiz/${topicId}`);
    const logoutBtn = page.locator('#quiz-logout-btn');
    await expect(logoutBtn).toBeVisible({ timeout: 10000 });
    await logoutBtn.click();
    await expect(page.locator('#quiz-auth-form')).toBeVisible({ timeout: 10000 });

    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="pin"]', 'BADD');
    await page.click('#quiz-auth-submit');

    const err = page.locator('#quiz-auth-error');
    await expect(err).toBeVisible({ timeout: 5000 });
    await expect(err).toContainText(/PIN|Profil|korrekt|falsch|existiert/i);
  });
});

test.describe('Quiz Module - Gameplay Flow', () => {
  let questionPayload;

  test.beforeEach(async ({ page }) => {
    const uniqueName = `GameUser${Date.now()}`;
    await ensureLoggedOut(page);
    await gotoAnyTopicEntry(page);
    await authOnEntry(page, uniqueName, 'TEST');
    questionPayload = await startRunFromEntry(page);
  });

  test('should display question and options', async ({ page }) => {
    await expect(page.locator('.quiz-question')).toBeVisible();
    const options = page.locator('.quiz-answer');
    await expect(options).toHaveCount(4);
  });

  test('should show feedback after answering and advance on Weiter', async ({ page }) => {
    await expect(page.locator('.quiz-question')).toBeVisible();
    await page.locator('.quiz-answer:visible').first().click();
    await expectAnsweredState(page);

    const weiterBtn = page.locator('#quiz-weiter-btn, .quiz-weiter-btn, button:has-text("Weiter")');
    await expect(weiterBtn).toBeVisible({ timeout: 5000 });
    const nextQPromise = waitForQuestionPayload(page);
    await weiterBtn.click();
    await waitForNextStage(page);
    questionPayload = await nextQPromise.catch(() => questionPayload);
  });

  test('should preserve score on refresh (no 0-flash)', async ({ page }) => {
    await answerCorrectNoWeiter(page, questionPayload);

    const scoreEl = page.locator('#quiz-score-display');
    await expect(scoreEl).toBeVisible();
    await expect(scoreEl).not.toHaveText('0', { timeout: 5000 });

    // Score animates via count-up; sample after a short delay for stability.
    const first = ((await scoreEl.textContent()) || '0').trim();
    await page.waitForTimeout(400);
    const scoreBefore = ((await scoreEl.textContent()) || first).trim();
    expect(Number(scoreBefore)).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator('#quiz-score-display')).toHaveText(scoreBefore, { timeout: 5000 });
  });

  test('should show LevelUp stage after a perfect level', async ({ page }) => {
    // Run question difficulties can be randomized; don't assume the first two
    // questions complete a level. Answer correctly until LevelUp appears.
    test.setTimeout(60000);

    const levelUpStage = page.locator('#quiz-level-up-stage');
    const finishStage = page.locator('#quiz-finish-stage');
    const weiterBtn = page.locator('#quiz-weiter-btn, .quiz-weiter-btn, button:has-text("Weiter")');

    let q = questionPayload;
    let sawPerfectLevelCompletion = false;
    let perfectCompletionAnswerPayload = null;
    const observed = [];

    for (let i = 0; i < 10; i++) {
      await answerCorrectNoWeiter(page, q);

      const lastAnswer = await page.evaluate(() => window.__quizPlayLastAnswer || null);
      if (!lastAnswer) {
        throw new Error('Missing window.__quizPlayLastAnswer after answering; quiz-play test hook not set');
      }

      observed.push({
        i,
        result: lastAnswer.result,
        correct_option_id: lastAnswer.correct_option_id,
        level_completed: lastAnswer.level_completed,
        level_perfect: lastAnswer.level_perfect,
        level_bonus: lastAnswer.level_bonus,
        bonus_applied_now: lastAnswer.bonus_applied_now,
        running_score: lastAnswer.running_score,
        next_question_index: lastAnswer.next_question_index,
        finished: lastAnswer.finished,
      });

      if (lastAnswer) {
        const bonusAppliedNow = !!(
          lastAnswer.level_completed &&
          lastAnswer.level_perfect &&
          lastAnswer.level_bonus > 0
        );
        if (bonusAppliedNow) {
          sawPerfectLevelCompletion = true;
          perfectCompletionAnswerPayload = lastAnswer;
        }
      }

      await expect(weiterBtn).toBeVisible({ timeout: 5000 });

      const nextQuestionPromise = page
        .waitForResponse(
          (r) => r.url().includes('/api/quiz/questions/') && r.request().method() === 'GET' && r.ok(),
          { timeout: 7000 }
        )
        .then(async (r) => ({ kind: 'question', payload: await r.json() }))
        .catch(() => null);

      await weiterBtn.click();

      if (sawPerfectLevelCompletion) {
        // After completing a perfect level, the next screen must be LEVEL_UP.
        await page.waitForFunction(
          () => window.__quizPlayAdvanceDecision && window.__quizPlayAdvanceDecision.shouldLevelUp === true,
          null,
          { timeout: 15000 }
        ).catch(() => null);
        try {
          await expect(levelUpStage).toBeVisible({ timeout: 15000 });
        } catch (e) {
          const diag = await page.evaluate(() => {
            const levelUpContainer = document.getElementById('quiz-level-up-container');
            const questionWrapper = document.getElementById('quiz-question-wrapper');
            return {
              currentView: window.__quizPlayCurrentView,
              advanceDecision: window.__quizPlayAdvanceDecision,
              levelUpRender: window.__quizPlayLastLevelUpRender,
              hasLevelUpStage: !!document.getElementById('quiz-level-up-stage'),
              levelUpContainerHidden: levelUpContainer ? levelUpContainer.hidden : null,
              questionWrapperHidden: questionWrapper ? questionWrapper.hidden : null,
            };
          });
          const msg = (e && e.message ? e.message : String(e));
          throw new Error(`${msg}\n[LevelUp DIAG] ${JSON.stringify(diag)}\n[Perfect /answer payload] ${JSON.stringify(perfectCompletionAnswerPayload)}`);
        }
        break;
      }

      if (await finishStage.isVisible().catch(() => false)) {
        break;
      }

      const nextQ = await nextQuestionPromise;
      if (nextQ?.kind === 'question' && nextQ.payload) {
        q = nextQ.payload;
      }
    }

    if (!sawPerfectLevelCompletion) {
      throw new Error(`[LevelUp] No perfect level completion observed in /answer payloads: ${JSON.stringify(observed)}`);
    }

    await expect(levelUpStage).toBeVisible({ timeout: 15000 });
    await levelUpStage.click();
    await expect(page.locator('.quiz-question')).toBeVisible({ timeout: 15000 });
  });

  test('should auto-advance after 15 seconds if no Weiter click', async ({ page }) => {
    test.setTimeout(30000);
    await expect(page.locator('.quiz-question')).toBeVisible();
    const initialQuestion = await page.locator('.quiz-question').textContent();

    await page.locator('.quiz-answer:visible').first().click();
    await expect(page.locator('#quiz-weiter-btn')).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(16000);
    const newContent = await page.locator('.quiz-question, .quiz-finish').textContent();
    expect(newContent).not.toBe(initialQuestion);
  });
});

test.describe('Quiz Module - 50/50 Joker', () => {
  test.beforeEach(async ({ page }) => {
    const uniqueName = `JokerUser${Date.now()}`;
    await ensureLoggedOut(page);
    await gotoAnyTopicEntry(page);
    await authOnEntry(page, uniqueName, 'TEST');
    await startRunFromEntry(page);
  });

  test('should use 50/50 joker and hide 2 wrong answers', async ({ page }) => {
    await expect(page.locator('.quiz-question')).toBeVisible();

    const visibleOptions = page.locator('.quiz-answer:visible');
    await expect(visibleOptions).toHaveCount(4, { timeout: 10000 });

    const jokerBtn = page.locator('#quiz-joker-btn, button:has-text("50/50")');
    await expect(jokerBtn).toBeVisible();
    await jokerBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator('.quiz-answer:visible')).toHaveCount(2, { timeout: 10000 });

    const hiddenOptions = await page.locator('.quiz-answer.quiz-answer--hidden').count();
    expect(hiddenOptions).toBe(2);
  });

  test('should allow joker usage exactly 2 times per run', async ({ page }) => {
    await expect(page.locator('.quiz-question')).toBeVisible();
    const jokerBtn = page.locator('#quiz-joker-btn, button:has-text("50/50")');

    await expect(jokerBtn).toBeEnabled();
    await jokerBtn.click();
    await page.waitForTimeout(500);

    await page.locator('.quiz-answer:visible').first().click();
    await expectAnsweredState(page);
    const weiterBtn = page.locator('#quiz-weiter-btn, .quiz-weiter-btn, button:has-text("Weiter")');
    await weiterBtn.click();
    await waitForNextStage(page);

    await expect(jokerBtn).toBeEnabled();
    await jokerBtn.click();
    await page.waitForTimeout(500);

    await page.locator('.quiz-answer:visible').first().click();
    await expectAnsweredState(page);
    await weiterBtn.click();
    await waitForNextStage(page);

    await expect(jokerBtn).toBeDisabled();
  });
});

test.describe('Quiz Module - Finish Smoke', () => {
  test('should reach Finish screen after 10 questions', async ({ page }) => {
    test.setTimeout(60000);
    const uniqueName = `FinishUser${Date.now()}`;
    await ensureLoggedOut(page);
    await gotoAnyTopicEntry(page);
    await authOnEntry(page, uniqueName, 'TEST');

    let q = await startRunFromEntry(page);

    for (let i = 0; i < 10; i++) {
      const nextQPromise = waitForQuestionPayload(page).catch(() => null);
      await answerCorrectAndContinue(page, q);
      await waitForNextStage(page);

      if (await page.locator('#quiz-finish-stage').isVisible().catch(() => false)) {
        break;
      }
      const nextQ = await nextQPromise;
      if (nextQ) q = nextQ;
    }

    await expect(page.locator('#quiz-finish-stage')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Quiz Module - Navigation', () => {
  test('should navigate to quiz page', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/quiz`);
    await expect(page).toHaveURL(/\/quiz/);
    await expect(page.locator('body')).toContainText(/quiz/i);
  });
});
