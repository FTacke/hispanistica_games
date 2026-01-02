/**
 * Quiz Module - Topic Entry Page
 * 
 * Simplified authentication: One form for login AND registration.
 * - If name unknown: auto-create new profile
 * - If name known + correct PIN: login
 * - If name known + wrong PIN: error message
 */

(function() {
  'use strict';

  const API_BASE = '/api/quiz';

  const DEBUG = new URLSearchParams(window.location.search).has('quizDebug') ||
    window.localStorage.getItem('quizDebug') === '1';
  let debugCallCounter = 0;

  function debugLog(fnName, data) {
    if (!DEBUG) return;
    debugCallCounter++;
    console.log(`[${debugCallCounter}] [quiz-entry] ${fnName}:`, {
      timestamp: performance.now().toFixed(2),
      ...data
    });
  }

  /**
   * Initialize the entry page
   */
  function init() {
    const topicId = document.querySelector('.game-shell')?.dataset.topic;
    if (!topicId) return;

    debugLog('init', { topicId });

    // Load topic data (description)
    loadTopicData(topicId);

    // Load leaderboard
    loadLeaderboard(topicId);

    // Setup event handlers
    setupAuthForm(topicId);
    setupAnonymousLogin(topicId);
    setupLogout();
    setupStartButton(topicId);
    setupShowLoginButton();

    // Test hook: indicates that event handlers are attached.
    // (No user-visible behavior; used by Playwright to avoid early form submits.)
    window.__quizEntryReady = true;
  }

  /**
   * Load topic data and populate title, description, metadata (Single Source of Truth)
   */
  async function loadTopicData(topicId) {
    try {
      const response = await fetch(`${API_BASE}/topics`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const topic = data.topics.find(t => t.topic_id === topicId);
      
      if (topic) {
        // Populate TITLE (same source as quiz cards)
        const titleEl = document.getElementById('quiz-topic-title');
        if (titleEl) {
          let title = topic.title_key || topicId;
          // Try i18n translation first
          if (window.QuizI18n && typeof window.QuizI18n.getTopicTitle === 'function') {
            const i18nTitle = window.QuizI18n.getTopicTitle(topicId);
            if (i18nTitle && i18nTitle !== topicId) {
              title = i18nTitle;
            }
          }
          titleEl.textContent = title;
        }

        // Populate description (same source as quiz cards)
        const descEl = document.getElementById('quiz-topic-description');
        if (descEl && topic.description) {
          // Try i18n translation first
          let description = topic.description;
          if (window.QuizI18n && typeof window.QuizI18n.getTopicDescription === 'function') {
            const i18nDesc = window.QuizI18n.getTopicDescription(topicId);
            if (i18nDesc && i18nDesc !== topicId) {
              description = i18nDesc;
            }
          }
          descEl.textContent = description;
        }

        // Render authors under title ("Quiz-Autor:innen")
        const authorsContainer = document.getElementById('quiz-topic-authors');
        if (authorsContainer && topic.authors && topic.authors.length > 0) {
          let authorsHTML = '<div class="quiz-info-card__authors-section">';
          authorsHTML += '<span class="quiz-info-card__label">Quiz-Autor:innen</span>';
          authorsHTML += '<span class="quiz-info-card__text">' + escapeHtml(topic.authors.join(', ')) + '</span>';
          authorsHTML += '</div>';
          authorsContainer.innerHTML = authorsHTML;
        }
        
        // Render based_on / Grundlage
        const basedOnContainer = document.getElementById('quiz-topic-based-on');
        if (basedOnContainer && topic.based_on && topic.based_on.chapter_title) {
          const chapterTitle = escapeHtml(topic.based_on.chapter_title);
          const chapterUrl = escapeHtml(topic.based_on.chapter_url || '');
          const courseTitle = escapeHtml(topic.based_on.course_title || 'Spanische Linguistik @ School');
          
          let basedOnHTML = '<div class="quiz-info-card__based-on-section">';
          basedOnHTML += '<span class="quiz-info-card__label">Grundlage</span>';
          basedOnHTML += '<span class="quiz-info-card__text">';
          basedOnHTML += 'Kapitel ';
          if (chapterUrl) {
            basedOnHTML += `<a href="${chapterUrl}" target="_blank" rel="noopener">${chapterTitle}</a>`;
          } else {
            basedOnHTML += chapterTitle;
          }
          basedOnHTML += ` aus <em>${courseTitle}</em>`;
          basedOnHTML += '</span>';
          basedOnHTML += '</div>';
          basedOnContainer.innerHTML = basedOnHTML;
        }
      }
    } catch (error) {
      console.error('Failed to load topic data:', error);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Load and display leaderboard
   */
  async function loadLeaderboard(topicId) {
    const container = document.getElementById('quiz-leaderboard-content');
    if (!container) return;

    try {
      const response = await fetch(`${API_BASE}/topics/${topicId}/leaderboard?limit=15`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      renderLeaderboard(container, data.leaderboard || []);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      container.innerHTML = `<div class="quiz-leaderboard__empty">Fehler beim Laden.</div>`;
    }
  }

  /**
   * Render leaderboard entries with Top5 + expandable rest (new card design)
   */
  function renderLeaderboard(container, entries) {
    if (entries.length === 0) {
      container.innerHTML = `
        <p class="quiz-leaderboard-card__empty">
          Noch keine Einträge.
        </p>
      `;
      return;
    }

    // Split into top 5 and rest
    const top5 = entries.slice(0, 5);
    const rest = entries.slice(5);

    const renderEntry = (entry) => `
      <li class="quiz-leaderboard-card__item ${
        entry.rank === 1 ? 'quiz-leaderboard-card__item--rank-1' : 
        entry.rank === 2 ? 'quiz-leaderboard-card__item--rank-2' : 
        entry.rank === 3 ? 'quiz-leaderboard-card__item--rank-3' : ''
      }">
        <span class="quiz-leaderboard-card__rank ${
          entry.rank <= 3 ? 'quiz-leaderboard-card__rank--top' : ''
        }">${entry.rank}</span>
        <span class="quiz-leaderboard-card__name">${escapeHtml(entry.player_name)}</span>
        <span class="quiz-leaderboard-card__score">
          <span class="quiz-leaderboard-card__score-value">${entry.total_score}</span>
          <span class="quiz-leaderboard-card__score-label">Punkte</span>
        </span>
        <span class="quiz-leaderboard-card__tokens">
          <span class="material-symbols-rounded">toll</span>
          <span>${entry.tokens_count}</span>
        </span>
      </li>
    `;

    let html = `<ul class="quiz-leaderboard-card__list">${top5.map(renderEntry).join('')}</ul>`;

    // Add accordion for rest if there are more than 5 entries
    if (rest.length > 0) {
      html += `
        <details class="quiz-leaderboard-card__accordion">
          <summary class="quiz-leaderboard-card__accordion-trigger">
            Gesamte Rangliste anzeigen (${entries.length} Einträge)
          </summary>
          <ul class="quiz-leaderboard-card__list quiz-leaderboard-card__list--expanded">${rest.map(renderEntry).join('')}</ul>
        </details>
      `;
    }

    container.innerHTML = html;
  }

  /**
   * Setup authentication form submission - UNIFIED (auto-create or login)
   */
  function setupAuthForm(topicId) {
    const form = document.getElementById('quiz-auth-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = form.querySelector('#quiz-name').value.trim();
      const pin = form.querySelector('#quiz-pin').value.trim().toUpperCase();
      const errorEl = document.getElementById('quiz-auth-error');
      const submitBtn = document.getElementById('quiz-auth-submit');
      
      // Validate
      if (!name || name.length < 2) {
        showError(errorEl, 'Name muss mindestens 2 Zeichen haben.');
        return;
      }
      
      if (!pin || pin.length !== 4) {
        showError(errorEl, QuizI18n.t('ui.quiz.error_invalid_pin') || 'PIN muss genau 4 Zeichen haben.');
        return;
      }

      submitBtn.disabled = true;
      hideError(errorEl);

      try {
        debugLog('auth.submit', { topicId, name });
        // Use unified endpoint: auto-create if unknown, login if known + PIN correct
        const response = await fetch(`${API_BASE}/auth/name-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, pin })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          debugLog('auth.error', { status: response.status, data });
          // Handle PIN mismatch error
          if (data.code === 'PIN_MISMATCH') {
            showError(errorEl, data.message || 'Profil existiert bereits. Bitte korrekten PIN eingeben.');
          } else if (data.code === 'INVALID_NAME') {
            showError(errorEl, data.message || 'Ungültiger Name.');
          } else if (data.code === 'INVALID_PIN') {
            showError(errorEl, data.message || 'PIN muss genau 4 Zeichen haben.');
          } else {
            showError(errorEl, QuizI18n.t('ui.quiz.error_generic') || 'Ein Fehler ist aufgetreten.');
          }
          submitBtn.disabled = false;
          return;
        }
        
        // Success - show feedback if new user was created
        if (data.is_new_user) {
          console.log('New profile created for:', data.player_name);
        }

        // ✅ CHANGE 1: Nach Login direkt neuen Run starten und ins Quiz
        debugLog('auth.success.startRun', { topicId });
        try {
          const runResp = await fetch(`${API_BASE}/${topicId}/run/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force_new: true })
          });
          if (!runResp.ok) {
            throw new Error('Failed to start run');
          }
          debugLog('auth.success.redirect', { to: `/quiz/${topicId}/play` });
          window.location.href = `/quiz/${topicId}/play`;
        } catch (runError) {
          console.error('Failed to start run after login:', runError);
          // Fallback: zur topic_entry
          window.location.href = `/quiz/${topicId}`;
        }
        
      } catch (error) {
        console.error('Auth failed:', error);
        debugLog('auth.network_error', { message: error?.message });
        showError(errorEl, QuizI18n.t('ui.quiz.error_generic') || 'Ein Fehler ist aufgetreten.');
        submitBtn.disabled = false;
      }
    });
  }

  /**
   * Setup anonymous login button
   */
  function setupAnonymousLogin(topicId) {
    const btn = document.getElementById('quiz-anonymous-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      
      try {
        debugLog('anonymous.start', { topicId });
        const response = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonymous: true })
        });
        
        if (!response.ok) {
          throw new Error('Anonymous login failed');
        }
        
        // ✅ CHANGE 1: Nach Anonym direkt neuen Run starten und ins Quiz
        debugLog('anonymous.success.startRun', { topicId });
        try {
          const runResp = await fetch(`${API_BASE}/${topicId}/run/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force_new: true })
          });
          if (!runResp.ok) {
            throw new Error('Failed to start run');
          }
          debugLog('anonymous.success.redirect', { to: `/quiz/${topicId}/play` });
          window.location.href = `/quiz/${topicId}/play`;
        } catch (runError) {
          console.error('Failed to start run after anonymous login:', runError);
          // Fallback: zur topic_entry
          window.location.href = `/quiz/${topicId}`;
        }
        
      } catch (error) {
        console.error('Anonymous login failed:', error);
        debugLog('anonymous.error', { message: error?.message });
        btn.disabled = false;
        alert(QuizI18n.t('ui.quiz.error_generic') || 'Ein Fehler ist aufgetreten.');
      }
    });
  }

  /**
   * Setup logout button
   */
  function setupLogout() {
    const btn = document.getElementById('quiz-logout-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      try {
        debugLog('logout', {});
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
        window.location.reload();
      } catch (error) {
        console.error('Logout failed:', error);
        debugLog('logout.error', { message: error?.message });
      }
    });
  }

  /**
   * Setup start button for authenticated users
   */
  function setupStartButton(topicId) {
    const btn = document.getElementById('quiz-start-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      
      try {
        debugLog('run.start', { topicId, force_new: true });
        const response = await fetch(`${API_BASE}/${topicId}/run/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force_new: true })
        });
        
        if (!response.ok) {
          throw new Error('Failed to start run');
        }
        
        // Redirect to play
        debugLog('run.start.redirect', { to: `/quiz/${topicId}/play` });
        window.location.href = `/quiz/${topicId}/play`;
        
      } catch (error) {
        console.error('Start failed:', error);
        debugLog('run.start.error', { message: error?.message });
        btn.disabled = false;
        alert(QuizI18n.t('ui.quiz.error_generic') || 'Ein Fehler ist aufgetreten.');
      }
    });
  }

  /**
   * Setup restart button and dialog
   */
  function setupRestartButton(topicId) {
    const btn = document.getElementById('quiz-restart-btn');
    const dialog = document.getElementById('quiz-restart-dialog');
    const cancelBtn = document.getElementById('quiz-restart-cancel');
    const confirmBtn = document.getElementById('quiz-restart-confirm');
    
    if (!btn || !dialog) return;

    btn.addEventListener('click', () => {
      dialog.showModal();
    });

    cancelBtn?.addEventListener('click', () => {
      dialog.close();
    });

    confirmBtn?.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      
      try {
        const response = await fetch(`${API_BASE}/${topicId}/run/restart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error('Restart failed');
        }
        
        dialog.close();
        window.location.href = `/quiz/${topicId}/play`;
        
      } catch (error) {
        console.error('Restart failed:', error);
        confirmBtn.disabled = false;
        alert(QuizI18n.t('ui.quiz.error_generic') || 'Ein Fehler ist aufgetreten.');
      }
    });

    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });
  }

  /**
   * Setup "Mit Namen spielen" button to toggle login form
   */
  function setupShowLoginButton() {
    const btn = document.getElementById('quiz-show-login-btn');
    const loginContainer = document.getElementById('quiz-login-container');
    
    if (!btn || !loginContainer) return;

    btn.addEventListener('click', () => {
      loginContainer.hidden = !loginContainer.hidden;
      if (!loginContainer.hidden) {
        // Focus first input when form appears
        const nameInput = document.getElementById('quiz-name');
        nameInput?.focus();
      }
    });
  }

  /**
   * Show error message
   */
  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  /**
   * Hide error message
   */
  function hideError(el) {
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  /**
   * Setup "Mit Namen spielen" button to toggle login form
   */
  function setupShowLoginButton() {
    const btn = document.getElementById('quiz-show-login-btn');
    const loginContainer = document.getElementById('quiz-login-container');
    
    if (!btn || !loginContainer) return;

    btn.addEventListener('click', () => {
      loginContainer.hidden = !loginContainer.hidden;
      if (!loginContainer.hidden) {
        // Focus first input when form appears
        const nameInput = document.getElementById('quiz-name');
        nameInput?.focus();
      }
    });
  }

  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();
