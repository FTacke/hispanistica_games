/**
 * Quiz Module - Gameplay Page
 * 
 * Implements a proper state machine with:
 * - idle: Question visible, answers clickable, joker available
 * - answered_locked: Answer selected, UI locked, feedback visible, "Weiter" button shown
 * - transitioning: Loading next question
 * 
 * Auto-advance after 15 seconds of inactivity in answered_locked state.
 * No immediate navigation after answer selection.
 */

(function() {
  'use strict';

  const API_BASE = '/api/quiz';
  const TIMER_SECONDS = 30;
  const TIMER_WARNING = 10;
  const TIMER_DANGER = 5;
  const AUTO_ADVANCE_DELAY_MS = 15000; // 15 seconds

  // State machine states
  const STATE = {
    IDLE: 'idle',
    ANSWERED_LOCKED: 'answered_locked',
    TRANSITIONING: 'transitioning'
  };

  // Game state
  let state = {
    topicId: null,
    runId: null,
    currentIndex: 0,
    runQuestions: [],
    jokerRemaining: 2,
    jokerUsedOn: [],
    questionStartedAtMs: null,
    deadlineAtMs: null,
    answers: [],
    questionData: null,
    timerInterval: null,
    autoAdvanceTimer: null,
    uiState: STATE.IDLE,
    isAnswered: false,
    selectedAnswerId: null,
    lastAnswerResult: null,
    advanceCallback: null
  };

  /**
   * Initialize the gameplay
   */
  async function init() {
    const container = document.querySelector('.game-shell');
    if (!container) return;

    state.topicId = container.dataset.topic;
    
    // Start or resume run
    try {
      const runData = await startOrResumeRun();
      if (!runData) {
        // Redirect to entry if no run
        window.location.href = `/quiz/${state.topicId}`;
        return;
      }
      
      // Initialize state from run data
      state.runId = runData.run_id;
      state.currentIndex = runData.current_index;
      state.runQuestions = runData.run_questions || [];
      state.jokerRemaining = runData.joker_remaining;
      state.jokerUsedOn = runData.joker_used_on || [];
      state.questionStartedAtMs = runData.question_started_at_ms;
      state.deadlineAtMs = runData.deadline_at_ms;
      state.answers = runData.answers || [];
      
      // Check if already finished
      if (state.currentIndex >= 10) {
        await finishRun();
        return;
      }
      
      // Load current question
      await loadCurrentQuestion();
      
    } catch (error) {
      console.error('Failed to initialize quiz:', error);
      alert('Fehler beim Laden des Quiz.');
      window.location.href = `/quiz/${state.topicId}`;
    }

    // Setup event handlers
    setupJokerButton();
    setupPlayAgainButton();
    setupWeiterButton();
  }

  /**
   * Start a new run or get existing run state
   */
  async function startOrResumeRun() {
    const response = await fetch(`${API_BASE}/${state.topicId}/run/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Not authenticated, redirect to entry
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.run;
  }

  /**
   * Set UI state and update UI accordingly
   */
  function setUIState(newState) {
    state.uiState = newState;
    
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    const weiterBtn = document.getElementById('quiz-weiter-btn');
    const jokerBtn = document.getElementById('quiz-joker-btn');
    const answerBtns = document.querySelectorAll('.quiz-answer');
    
    switch (newState) {
      case STATE.IDLE:
        // Enable answers (unless joker-disabled)
        answerBtns.forEach(btn => {
          if (!btn.classList.contains('quiz-answer--disabled') && !btn.classList.contains('quiz-answer--hidden')) {
            btn.disabled = false;
          }
        });
        // Enable joker if available
        if (jokerBtn) {
          const alreadyUsed = state.jokerUsedOn.includes(state.currentIndex);
          jokerBtn.disabled = state.jokerRemaining <= 0 || alreadyUsed;
        }
        // Hide feedback
        if (feedbackPanel) feedbackPanel.hidden = true;
        if (weiterBtn) weiterBtn.hidden = true;
        break;
        
      case STATE.ANSWERED_LOCKED:
        // Disable ALL answers
        answerBtns.forEach(btn => {
          btn.disabled = true;
        });
        // Disable joker
        if (jokerBtn) jokerBtn.disabled = true;
        // Show feedback panel and Weiter button
        if (feedbackPanel) feedbackPanel.hidden = false;
        if (weiterBtn) {
          weiterBtn.hidden = false;
          weiterBtn.disabled = false;
        }
        // Start 15s auto-advance timer
        startAutoAdvanceTimer();
        // Smooth scroll to feedback if not in viewport
        scrollToFeedbackIfNeeded();
        break;
        
      case STATE.TRANSITIONING:
        // Everything disabled
        answerBtns.forEach(btn => btn.disabled = true);
        if (jokerBtn) jokerBtn.disabled = true;
        if (weiterBtn) weiterBtn.disabled = true;
        // Cancel auto-advance
        cancelAutoAdvanceTimer();
        break;
    }
  }

  /**
   * Start the 15-second auto-advance timer
   */
  function startAutoAdvanceTimer() {
    cancelAutoAdvanceTimer();
    state.autoAdvanceTimer = setTimeout(() => {
      if (state.uiState === STATE.ANSWERED_LOCKED) {
        advanceToNextQuestion();
      }
    }, AUTO_ADVANCE_DELAY_MS);
  }

  /**
   * Cancel the auto-advance timer
   */
  function cancelAutoAdvanceTimer() {
    if (state.autoAdvanceTimer) {
      clearTimeout(state.autoAdvanceTimer);
      state.autoAdvanceTimer = null;
    }
  }

  /**
   * Scroll to feedback panel if not in viewport
   */
  function scrollToFeedbackIfNeeded() {
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    if (!feedbackPanel) return;
    
    const rect = feedbackPanel.getBoundingClientRect();
    const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
    
    if (!isInViewport) {
      feedbackPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Load current question data and display
   */
  async function loadCurrentQuestion() {
    if (state.currentIndex >= state.runQuestions.length) {
      await finishRun();
      return;
    }
    
    const questionConfig = state.runQuestions[state.currentIndex];
    const questionId = questionConfig.question_id;
    
    // Fetch question details
    const response = await fetch(`${API_BASE}/questions/${questionId}`);
    if (!response.ok) {
      throw new Error('Failed to load question');
    }
    
    state.questionData = await response.json();
    state.isAnswered = false;
    state.selectedAnswerId = null;
    state.lastAnswerResult = null;
    
    // Start timer if not already started
    if (!state.questionStartedAtMs) {
      await startQuestionTimer();
    }
    
    // Render question
    renderQuestion();
    
    // Set UI to idle
    setUIState(STATE.IDLE);
    
    // Start countdown
    startTimerCountdown();
  }

  /**
   * Start question timer on server
   */
  async function startQuestionTimer() {
    const startedAtMs = Date.now();
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/question/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_index: state.currentIndex,
          started_at_ms: startedAtMs
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        state.questionStartedAtMs = data.question_started_at_ms;
        state.deadlineAtMs = data.deadline_at_ms;
      } else {
        // Fallback to client-side timer
        state.questionStartedAtMs = startedAtMs;
        state.deadlineAtMs = startedAtMs + (TIMER_SECONDS * 1000);
      }
    } catch (error) {
      // Fallback to client-side timer
      state.questionStartedAtMs = startedAtMs;
      state.deadlineAtMs = startedAtMs + (TIMER_SECONDS * 1000);
    }
  }

  /**
   * Start the timer countdown display
   */
  function startTimerCountdown() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
    }
    
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((state.deadlineAtMs - now) / 1000));
      
      const timerEl = document.getElementById('quiz-timer');
      const timerDisplay = document.getElementById('quiz-timer-display');
      
      if (timerDisplay) {
        timerDisplay.textContent = remaining;
      }
      
      // Update timer styling based on remaining time
      if (timerEl) {
        timerEl.classList.remove('quiz-timer--warning', 'quiz-timer--danger');
        if (remaining <= TIMER_DANGER) {
          timerEl.classList.add('quiz-timer--danger');
        } else if (remaining <= TIMER_WARNING) {
          timerEl.classList.add('quiz-timer--warning');
        }
      }
      
      // Check for timeout (only in idle state)
      if (remaining <= 0 && state.uiState === STATE.IDLE && !state.isAnswered) {
        handleTimeout();
      }
    };
    
    updateTimer();
    state.timerInterval = setInterval(updateTimer, 100);
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Render the current question
   */
  function renderQuestion() {
    const config = state.runQuestions[state.currentIndex];
    const q = state.questionData;
    
    // Update header
    const difficulty = config.difficulty;
    document.getElementById('quiz-level-num').textContent = difficulty;
    document.getElementById('quiz-question-current').textContent = state.currentIndex + 1;
    document.getElementById('quiz-question-total').textContent = '10';
    
    // Update joker button
    updateJokerButton();
    
    // Render prompt
    const promptEl = document.getElementById('quiz-question-prompt');
    promptEl.textContent = q.prompt_key;
    
    // Render media if present
    const mediaEl = document.getElementById('quiz-question-media');
    if (q.media && q.media.type === 'audio') {
      mediaEl.innerHTML = `<audio controls src="${escapeHtml(q.media.url)}"></audio>`;
      mediaEl.hidden = false;
    } else {
      mediaEl.innerHTML = '';
      mediaEl.hidden = true;
    }
    
    // Shuffle answers on first load (generate answers_order if not present)
    const answersEl = document.getElementById('quiz-answers');
    if (!config.answers_order) {
      // First time loading this question - shuffle answers
      const allAnswerIds = q.answers.map(a => a.id);
      config.answers_order = shuffleArray(allAnswerIds);
      // Store in run config for persistence
      state.runQuestions[state.currentIndex].answers_order = config.answers_order;
    }
    const answersOrder = config.answers_order;
    const jokerDisabled = config.joker_disabled || [];
    
    const answersHtml = answersOrder.map((answerId, idx) => {
      const answer = q.answers.find(a => a.id === answerId);
      if (!answer) return '';
      
      const isDisabled = jokerDisabled.includes(answerId);
      const marker = String.fromCharCode(65 + idx); // A, B, C, D
      const answerText = answer.text_key;
      
      // If joker was used, hide the disabled options completely
      if (isDisabled) {
        return `
          <button 
            type="button" 
            class="quiz-answer quiz-answer--hidden"
            data-answer-id="${answerId}"
            disabled
            hidden
          >
            <span class="quiz-answer__marker">${marker}</span>
            <span class="quiz-answer__text">${escapeHtml(answerText)}</span>
          </button>
        `;
      }
      
      return `
        <button 
          type="button" 
          class="quiz-answer"
          data-answer-id="${answerId}"
        >
          <span class="quiz-answer__marker">${marker}</span>
          <span class="quiz-answer__text">${escapeHtml(answerText)}</span>
        </button>
      `;
    }).join('');
    
    answersEl.innerHTML = answersHtml;
    
    // Add click handlers
    answersEl.querySelectorAll('.quiz-answer:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => handleAnswerClick(btn.dataset.answerId));
    });
    
    // Hide feedback panel initially
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    if (feedbackPanel) feedbackPanel.hidden = true;
    
    const weiterBtn = document.getElementById('quiz-weiter-btn');
    if (weiterBtn) weiterBtn.hidden = true;
    
    showQuestionContainer();
  }

  /**
   * Handle answer click - ONLY locks UI, does NOT advance automatically
   */
  async function handleAnswerClick(answerId) {
    if (state.uiState !== STATE.IDLE || state.isAnswered) return;
    
    state.isAnswered = true;
    state.selectedAnswerId = answerId;
    
    // Stop timer
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    
    // Immediately lock UI and show "checking" feedback
    setUIState(STATE.ANSWERED_LOCKED);
    showCheckingFeedback();
    
    // Highlight selected answer
    const answerBtns = document.querySelectorAll('.quiz-answer');
    answerBtns.forEach(btn => {
      if (btn.dataset.answerId === answerId) {
        btn.classList.add('quiz-answer--selected');
      }
    });
    
    // Submit answer
    const usedJoker = state.jokerUsedOn.includes(state.currentIndex);
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_index: state.currentIndex,
          selected_answer_id: answerId,
          answered_at_ms: Date.now(),
          used_joker: usedJoker
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }
      
      const data = await response.json();
      state.lastAnswerResult = data;
      
      // Show result styling on answers
      showAnswerResult(answerId, data.result, data.correct_option_id);
      
      // Show feedback panel with result and explanation
      showFeedbackPanel(data.result, data.explanation_key);
      
      // Update state for next question
      state.jokerRemaining = data.joker_remaining;
      
      // Store callback for advancing
      if (data.finished) {
        state.advanceCallback = () => finishRun();
      } else {
        state.currentIndex = data.next_question_index;
        state.questionStartedAtMs = null;
        state.deadlineAtMs = null;
        state.advanceCallback = () => loadCurrentQuestion();
      }
      
      // Note: We stay in ANSWERED_LOCKED state until user clicks "Weiter" or 15s passes
      
    } catch (error) {
      console.error('Failed to submit answer:', error);
      // Allow retry
      state.isAnswered = false;
      setUIState(STATE.IDLE);
      answerBtns.forEach(btn => {
        btn.classList.remove('quiz-answer--selected');
      });
    }
  }

  /**
   * Handle timeout (no answer given)
   */
  async function handleTimeout() {
    if (state.uiState !== STATE.IDLE || state.isAnswered) return;
    
    state.isAnswered = true;
    
    // Stop timer
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    
    // Lock UI
    setUIState(STATE.ANSWERED_LOCKED);
    showCheckingFeedback();
    
    // Submit timeout
    const usedJoker = state.jokerUsedOn.includes(state.currentIndex);
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_index: state.currentIndex,
          selected_answer_id: null,
          answered_at_ms: Date.now(),
          used_joker: usedJoker
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit timeout');
      }
      
      const data = await response.json();
      state.lastAnswerResult = data;
      
      // Show correct answer
      showCorrectAnswer(data.correct_option_id);
      
      // Show feedback panel
      showFeedbackPanel('timeout', data.explanation_key);
      
      // Update state
      state.jokerRemaining = data.joker_remaining;
      
      if (data.finished) {
        state.advanceCallback = () => finishRun();
      } else {
        state.currentIndex = data.next_question_index;
        state.questionStartedAtMs = null;
        state.deadlineAtMs = null;
        state.advanceCallback = () => loadCurrentQuestion();
      }
      
    } catch (error) {
      console.error('Failed to submit timeout:', error);
    }
  }

  /**
   * Show checking feedback while waiting for server
   */
  function showCheckingFeedback() {
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    const feedbackStatus = document.getElementById('quiz-feedback-status');
    const feedbackExplanation = document.getElementById('quiz-feedback-explanation');
    
    if (feedbackStatus) {
      feedbackStatus.textContent = 'Prüfe…';
      feedbackStatus.className = 'quiz-feedback__status';
    }
    if (feedbackExplanation) {
      feedbackExplanation.textContent = '';
    }
    if (feedbackPanel) {
      feedbackPanel.hidden = false;
    }
  }

  /**
   * Show feedback panel with result
   */
  function showFeedbackPanel(result, explanationKey) {
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    const feedbackStatus = document.getElementById('quiz-feedback-status');
    const feedbackExplanation = document.getElementById('quiz-feedback-explanation');
    
    if (feedbackStatus) {
      let statusText = '';
      let statusClass = 'quiz-feedback__status';
      
      if (result === 'correct') {
        statusText = QuizI18n.t('ui.quiz.correct') || 'Richtig!';
        statusClass += ' quiz-feedback__status--correct';
      } else if (result === 'timeout') {
        statusText = QuizI18n.t('ui.quiz.timeout') || 'Zeit abgelaufen!';
        statusClass += ' quiz-feedback__status--wrong';
      } else {
        statusText = QuizI18n.t('ui.quiz.wrong') || 'Falsch.';
        statusClass += ' quiz-feedback__status--wrong';
      }
      
      feedbackStatus.textContent = statusText;
      feedbackStatus.className = statusClass;
    }
    
    if (feedbackExplanation) {
      // Use explanation text directly from backend (never null/empty - backend provides default)
      const explanation = explanationKey || 'Erklärung folgt.';
      feedbackExplanation.textContent = explanation;
    }
    
    if (feedbackPanel) {
      feedbackPanel.hidden = false;
      feedbackPanel.classList.remove('quiz-feedback--correct', 'quiz-feedback--wrong');
      feedbackPanel.classList.add(result === 'correct' ? 'quiz-feedback--correct' : 'quiz-feedback--wrong');
    }
    
    // Show Weiter button
    const weiterBtn = document.getElementById('quiz-weiter-btn');
    if (weiterBtn) {
      weiterBtn.hidden = false;
      weiterBtn.disabled = false;
    }
  }

  /**
   * Show result styling on answer buttons
   */
  function showAnswerResult(selectedId, result, correctId) {
    document.querySelectorAll('.quiz-answer').forEach(btn => {
      const id = btn.dataset.answerId;
      if (id === correctId) {
        btn.classList.add('quiz-answer--correct');
      } else if (id === selectedId && result !== 'correct') {
        btn.classList.add('quiz-answer--wrong');
      }
    });
  }

  /**
   * Show the correct answer (for timeout)
   */
  function showCorrectAnswer(correctId) {
    document.querySelectorAll('.quiz-answer').forEach(btn => {
      const id = btn.dataset.answerId;
      if (id === correctId) {
        btn.classList.add('quiz-answer--correct');
      }
    });
  }

  /**
   * Setup "Weiter" button handler
   */
  function setupWeiterButton() {
    const btn = document.getElementById('quiz-weiter-btn');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
      advanceToNextQuestion();
    });
  }

  /**
   * Advance to the next question
   */
  function advanceToNextQuestion() {
    if (state.uiState !== STATE.ANSWERED_LOCKED) return;
    
    cancelAutoAdvanceTimer();
    setUIState(STATE.TRANSITIONING);
    
    if (state.advanceCallback) {
      const callback = state.advanceCallback;
      state.advanceCallback = null;
      callback();
    }
  }

  /**
   * Show question container
   */
  function showQuestionContainer() {
    document.getElementById('quiz-header').hidden = false;
    document.getElementById('quiz-question-container').hidden = false;
    document.getElementById('quiz-finish').hidden = true;
  }

  /**
   * Setup joker button
   */
  function setupJokerButton() {
    const btn = document.getElementById('quiz-joker-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      if (state.uiState !== STATE.IDLE) return;
      if (state.jokerRemaining <= 0) return;
      if (state.jokerUsedOn.includes(state.currentIndex)) return;
      
      btn.disabled = true;
      
      try {
        const response = await fetch(`${API_BASE}/run/${state.runId}/joker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_index: state.currentIndex
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          if (errorData.code === 'LIMIT_REACHED') {
            alert('50/50 Joker: Limit erreicht (max 2× pro Durchlauf)');
          }
          throw new Error('Failed to use joker');
        }
        
        const data = await response.json();
        
        // Update state
        state.jokerRemaining = data.joker_remaining;
        state.jokerUsedOn.push(state.currentIndex);
        
        // Update run_questions config
        state.runQuestions[state.currentIndex].joker_disabled = data.disabled_answer_ids;
        
        // Hide wrong answers (not just disabled - completely hidden)
        data.disabled_answer_ids.forEach(id => {
          const answerBtn = document.querySelector(`.quiz-answer[data-answer-id="${id}"]`);
          if (answerBtn) {
            answerBtn.disabled = true;
            answerBtn.hidden = true;
            answerBtn.classList.add('quiz-answer--hidden');
          }
        });
        
        updateJokerButton();
        
      } catch (error) {
        console.error('Failed to use joker:', error);
        btn.disabled = false;
      }
    });
  }

  /**
   * Update joker button state
   */
  function updateJokerButton() {
    const btn = document.getElementById('quiz-joker-btn');
    const count = document.getElementById('quiz-joker-count');
    
    if (!btn || !count) return;
    
    count.textContent = state.jokerRemaining;
    
    const alreadyUsed = state.jokerUsedOn.includes(state.currentIndex);
    btn.disabled = state.jokerRemaining <= 0 || alreadyUsed || state.uiState !== STATE.IDLE;
  }

  /**
   * Finish the run and show results
   */
  async function finishRun() {
    // Stop timer
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    cancelAutoAdvanceTimer();
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to finish run');
      }
      
      const data = await response.json();
      
      // Show finish screen
      showFinishScreen(data);
      
    } catch (error) {
      console.error('Failed to finish run:', error);
      // Show finish screen anyway with cached data
      showFinishScreen({ total_score: 0, tokens_count: 0, breakdown: [] });
    }
  }

  /**
   * Show the finish screen with results
   */
  function showFinishScreen(data) {
    // Set quiz state to finished (hides header via CSS)
    const gameShell = document.querySelector('.game-shell[data-game="quiz"]');
    if (gameShell) {
      gameShell.setAttribute('data-quiz-state', 'finished');
    }
    
    document.getElementById('quiz-header').hidden = true;
    document.getElementById('quiz-question-container').hidden = true;
    
    const feedbackPanel = document.getElementById('quiz-feedback-panel');
    if (feedbackPanel) feedbackPanel.hidden = true;
    
    const weiterBtn = document.getElementById('quiz-weiter-btn');
    if (weiterBtn) weiterBtn.hidden = true;
    
    document.getElementById('quiz-finish').hidden = false;
    
    // Set scores
    document.getElementById('quiz-final-score').textContent = data.total_score;
    document.getElementById('quiz-final-tokens').textContent = data.tokens_count;
    
    // Render breakdown with new scannable structure
    const breakdownContent = document.getElementById('quiz-breakdown-content');
    if (breakdownContent && data.breakdown) {
      breakdownContent.innerHTML = data.breakdown.map(b => {
        const isPerfect = b.correct === b.total;
        const icon = isPerfect ? '<span class="quiz-finish__breakdown-icon">✓</span>' : '<span class="quiz-finish__breakdown-icon"></span>';
        
        return `
          <div class="quiz-finish__breakdown-row">
            ${icon}
            <span class="quiz-finish__breakdown-level">Stufe ${b.difficulty}</span>
            <span class="quiz-finish__breakdown-accuracy">${b.correct} / ${b.total}</span>
            <span class="quiz-finish__breakdown-points">${b.points + b.token_bonus}</span>
          </div>
        `;
      }).join('');
    }
  }

  /**
   * Setup play again button
   */
  function setupPlayAgainButton() {
    const btn = document.getElementById('quiz-play-again');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      
      try {
        const response = await fetch(`${API_BASE}/${state.topicId}/run/restart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error('Failed to restart');
        }
        
        // Reload the page
        window.location.reload();
        
      } catch (error) {
        console.error('Failed to restart:', error);
        btn.disabled = false;
        alert('Fehler beim Neustarten.');
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
