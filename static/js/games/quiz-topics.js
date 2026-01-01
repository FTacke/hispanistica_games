/**
 * Quiz Module - Topic Selection Page
 * 
 * Loads and displays available quiz topics from the API.
 */

(function() {
  'use strict';

  const API_BASE = '/api/quiz';

  /**
   * Load topics from API and render cards
   */
  async function loadTopics() {
    const container = document.getElementById('quiz-topics-container');
    if (!container) {
      console.error('Quiz topics container not found');
      return;
    }

    console.log('Loading quiz topics...');

    try {
      const response = await fetch(`${API_BASE}/topics`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Topics loaded:', data);
      renderTopics(container, data.topics || []);
    } catch (error) {
      console.error('Failed to load topics:', error);
      container.innerHTML = `
        <div class="quiz-error">
          <span class="material-symbols-rounded">error</span>
          <span>Fehler beim Laden der Themen.</span>
        </div>
      `;
    }
  }

  /**
   * Render topic cards
   */
  function renderTopics(container, topics) {
    if (topics.length === 0) {
      container.innerHTML = `
        <div class="quiz-empty">
          <span class="material-symbols-rounded">quiz</span>
          <span>Keine Quiz-Themen verfügbar.</span>
        </div>
      `;
      return;
    }

    const html = topics.map(topic => {
      // API returns title_key which may contain plaintext or i18n key
      let title = topic.title_key || topic.topic_id || 'Quiz';
      let description = topic.description || topic.description_key || '';
      let authors = topic.authors || [];
      
      // Try to get i18n translations if QuizI18n is available
      if (window.QuizI18n && typeof window.QuizI18n.getTopicTitle === 'function') {
        const i18nTitle = window.QuizI18n.getTopicTitle(topic.topic_id);
        if (i18nTitle && i18nTitle !== topic.topic_id) {
          title = i18nTitle;
        }
        
        const i18nDesc = window.QuizI18n.getTopicDescription(topic.topic_id);
        if (i18nDesc && i18nDesc !== topic.topic_id) {
          description = i18nDesc;
        }
      }
      
      // Build facts items (full display, no truncation, calm structure)
      let factItems = [];
      
      // Authors fact (show all authors)
      if (authors.length > 0) {
        const authorsList = escapeHtml(authors.join(', '));
        factItems.push(`
          <div class="quiz-topic-card__fact">
            <span class="quiz-topic-card__fact-label">Autor:innen</span>
            <span class="quiz-topic-card__fact-value">${authorsList}</span>
          </div>
        `);
      }
      
      // Source fact: "Kapitel [link] aus <em>Course</em>"
      if (topic.based_on && topic.based_on.chapter_title && topic.based_on.chapter_url) {
        const chapterTitle = escapeHtml(topic.based_on.chapter_title);
        const chapterUrl = escapeHtml(topic.based_on.chapter_url);
        const courseTitle = escapeHtml(topic.based_on.course_title || 'Spanische Linguistik @ School');
        
        factItems.push(`
          <div class="quiz-topic-card__fact">
            <span class="quiz-topic-card__fact-label">Grundlage</span>
            <span class="quiz-topic-card__fact-value">
              Kapitel <a class="quiz-topic-card__fact-link" href="${chapterUrl}" target="_blank" rel="noopener">${chapterTitle}</a> aus <em>${courseTitle}</em>
            </span>
          </div>
        `);
      }
      
      const factsBlock = factItems.length > 0 ? `<div class="quiz-topic-card__facts">${factItems.join('')}</div>` : '';
      
      return `
        <div class="quiz-topic-card">
          <div class="quiz-topic-card__icon">
            <span class="material-symbols-rounded">quiz</span>
          </div>
          <div class="quiz-topic-card__content">
            <h2 class="quiz-topic-card__title">${escapeHtml(title)}</h2>
            ${description ? `<p class="quiz-topic-card__description">${escapeHtml(description)}</p>` : ''}
            ${factsBlock}
          </div>
          <div class="quiz-topic-card__actions">
            <a href="${escapeHtml(topic.href)}" class="quiz-btn quiz-btn--primary quiz-btn--full">
              <span class="material-symbols-rounded">play_arrow</span>
              <span>Spielen</span>
            </a>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  /**
   * Handle logout button click
   */
  async function handleLogout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
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

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Quiz topics page initialized');
    loadTopics();

    // Logout button handler
    const logoutBtn = document.getElementById('quiz-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
  });

})();
