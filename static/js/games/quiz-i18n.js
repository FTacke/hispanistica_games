/**
 * Quiz Module - i18n (Internationalization) Support
 * 
 * Simple client-side i18n using data attributes.
 * Loads translations from embedded JSON or fetches from API.
 */

(function() {
  'use strict';

  // Default German translations (embedded for fast loading)
  const DEFAULT_TRANSLATIONS = {
    ui: {
      quiz: {
        title: "Quiz",
        select_topic: "Wähle ein Thema",
        back_to_topics: "Zurück zur Übersicht",
        login_title: "Anmeldung",
        name_label: "Spielername",
        name_placeholder: "Dein Name",
        pin_label: "PIN",
        pin_placeholder: "4 Zeichen (A-Z, 0-9)",
        start: "Start",
        login: "Anmelden",
        logout: "Abmelden",
        play_anonymous: "Als Anonym spielen",
        register_new: "Neu registrieren",
        already_registered: "Bereits registriert?",
        error_name_taken: "Dieser Name ist bereits vergeben.",
        error_invalid_pin: "PIN muss genau 4 Zeichen haben.",
        error_invalid_credentials: "Name oder PIN ungültig.",
        error_generic: "Ein Fehler ist aufgetreten.",
        resume: "Fortsetzen",
        restart: "Neu starten",
        restart_confirm: "Aktuelles Spiel wirklich abbrechen und neu starten?",
        restart_yes: "Ja, neu starten",
        restart_no: "Abbrechen",
        question_label: "Frage",
        of: "von",
        level_label: "Level",
        difficulty_level: "Level",
        time_remaining: "Verbleibende Zeit",
        time_up: "Zeit abgelaufen!",
        joker: "50:50",
        joker_remaining: "{count} übrig",
        correct: "Richtig!",
        wrong: "Falsch!",
        timeout: "Zeit abgelaufen!",
        understood_wrong: "Verstanden!",
        knew_right: "Wusste ich schon!",
        finished_title: "Quiz beendet!",
        your_result: "Dein Ergebnis",
        total_points: "Gesamtpunkte",
        your_score: "Deine Punkte",
        tokens_earned: "Erhaltene Tokens",
        result_note: "Basierend auf Schwierigkeit & Zeit",
        breakdown_title: "Ergebnis pro Stufe",
        play_again: "Nochmal spielen",
        back_to_overview: "Zurück zur Übersicht",
        back_to_topics: "Zurück zur Übersicht",
        leaderboard_title: "Rangliste",
        leaderboard_empty: "Noch keine Einträge.",
        rank: "Platz",
        player: "Spieler",
        score: "Punkte",
        tokens: "Token"
      }
    },
    topics: {},
    q: {}
  };

  // Quiz i18n namespace
  window.QuizI18n = {
    translations: DEFAULT_TRANSLATIONS,
    locale: 'de',

    /**
     * Get translation by dot-notation key
     * @param {string} key - e.g., "ui.quiz.start"
     * @param {object} params - interpolation params, e.g., {current: 1, total: 10}
     * @returns {string}
     */
    t(key, params = {}) {
      const parts = key.split('.');
      let value = this.translations;
      
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          // Key not found, return the key itself
          return key;
        }
      }
      
      if (typeof value !== 'string') {
        return key;
      }
      
      // Interpolate params like {current} -> actual value
      return value.replace(/\{(\w+)\}/g, (match, paramName) => {
        return params[paramName] !== undefined ? params[paramName] : match;
      });
    },

    /**
     * Apply translations to all elements with data-i18n attribute
     * @param {HTMLElement} container - Optional container to limit scope
     */
    applyTranslations(container = document) {
      const elements = container.querySelectorAll('[data-i18n]');
      elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = this.t(key);
        if (text !== key) {
          el.textContent = text;
        }
      });
      
      // Also handle placeholders
      const inputs = container.querySelectorAll('[data-placeholder-i18n]');
      inputs.forEach(el => {
        const key = el.getAttribute('data-placeholder-i18n');
        const text = this.t(key);
        if (text !== key) {
          el.placeholder = text;
        }
      });
    },

    /**
     * Get question text by key
     * @param {string} questionId 
     * @param {string} field - 'prompt', 'explanation', or 'answer.N'
     * @returns {string}
     */
    getQuestionText(questionId, field) {
      const q = this.translations.q?.[questionId];
      if (!q) return questionId;
      
      if (field === 'prompt') return q.prompt || questionId;
      if (field === 'explanation') return q.explanation || '';
      
      // Answer text: field is 'answer.1', 'answer.2', etc.
      if (field.startsWith('answer.')) {
        const answerId = field.split('.')[1];
        return q.answer?.[answerId] || field;
      }
      
      return field;
    },

    /**
     * Get topic title by ID
     * @param {string} topicId 
     * @returns {string}
     */
    getTopicTitle(topicId) {
      return this.translations.topics?.[topicId]?.title || topicId;
    },

    /**
     * Get topic description by ID
     * @param {string} topicId 
     * @returns {string}
     */
    getTopicDescription(topicId) {
      return this.translations.topics?.[topicId]?.description || '';
    }
  };

  // Auto-apply translations on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    QuizI18n.applyTranslations();
  });

})();
