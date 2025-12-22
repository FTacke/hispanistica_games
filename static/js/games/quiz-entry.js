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

  /**
   * Initialize the entry page
   */
  function init() {
    const topicId = document.querySelector('.game-shell')?.dataset.topic;
    if (!topicId) return;

    // Load leaderboard
    loadLeaderboard(topicId);

    // Setup event handlers
    setupAuthForm(topicId);
    setupAnonymousLogin(topicId);
    setupLogout();
    setupStartButton(topicId);
    setupRestartButton(topicId);
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
   * Render leaderboard entries
   */
  function renderLeaderboard(container, entries) {
    if (entries.length === 0) {
      container.innerHTML = `
        <div class="quiz-leaderboard__empty" data-i18n="ui.quiz.leaderboard_empty">
          Noch keine Einträge.
        </div>
      `;
      return;
    }

    const html = `
      <ul class="quiz-leaderboard__list">
        ${entries.map((entry, idx) => `
          <li class="quiz-leaderboard__item ${entry.rank === 1 ? 'quiz-leaderboard__item--top-1' : entry.rank === 2 ? 'quiz-leaderboard__item--top-2' : entry.rank === 3 ? 'quiz-leaderboard__item--top-3' : ''}">
            <span class="quiz-leaderboard__rank quiz-leaderboard__rank--${entry.rank}">
              ${entry.rank}
            </span>
            <span class="quiz-leaderboard__name">${escapeHtml(entry.player_name)}</span>
            <span class="quiz-leaderboard__score">
              <span class="quiz-leaderboard__score-value">${entry.total_score}</span>
              <span class="quiz-leaderboard__score-label">Punkte</span>
            </span>
            <span class="quiz-leaderboard__tokens">
              <span class="quiz-leaderboard__tokens-value">
                <span class="material-symbols-rounded">toll</span>
                ${entry.tokens_count}
              </span>
              <span class="quiz-leaderboard__tokens-label">Tokens</span>
            </span>
          </li>
        `).join('')}
      </ul>
    `;
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
        // Use unified endpoint: auto-create if unknown, login if known + PIN correct
        const response = await fetch(`${API_BASE}/auth/name-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, pin })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
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
        
        // Redirect to play
        window.location.href = `/quiz/${topicId}/play`;
        
      } catch (error) {
        console.error('Auth failed:', error);
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
        const response = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anonymous: true })
        });
        
        if (!response.ok) {
          throw new Error('Anonymous login failed');
        }
        
        // Redirect to play
        window.location.href = `/quiz/${topicId}/play`;
        
      } catch (error) {
        console.error('Anonymous login failed:', error);
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
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
        window.location.reload();
      } catch (error) {
        console.error('Logout failed:', error);
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
        const response = await fetch(`${API_BASE}/${topicId}/run/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        if (!response.ok) {
          throw new Error('Failed to start run');
        }
        
        // Redirect to play
        window.location.href = `/quiz/${topicId}/play`;
        
      } catch (error) {
        console.error('Start failed:', error);
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
