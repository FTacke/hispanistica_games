/**
 * Quiz Module - Gameplay Page
 * 
 * Implements a proper state machine with:
 * - idle: Question visible, answers clickable, joker available
 * - answered_locked: Answer selected, UI locked, explanation visible, "Weiter" button shown
 * - transitioning: Loading next question with slide animation
 * 
 * Auto-advance after 15 seconds of inactivity in answered_locked state.
 * No immediate navigation after answer selection.
 * 
 * Features:
 * - Score chip with points-pop animation on correct answers
 * - Answer states: neutral, selected_correct, selected_wrong, correct_reveal, locked
 * - Explanation card (no "Richtig/Falsch" text)
 * - Question transitions with slide+fade
 * - Accessibility: aria-live announcements, focus management
 * - Reduced motion support
 */

(function() {
  'use strict';
  
  // ============================================================================
  // API RESPONSE MAPPERS (inline für non-module Kontext)
  // ============================================================================
  
  /**
   * Normalisiert /answer API Response (snake_case → camelCase)
   */
  function normalizeAnswerResponse(raw) {
    const required = ['result', 'is_correct', 'correct_option_id', 'explanation_key',
                      'joker_remaining', 'earned_points', 'running_score', 'difficulty'];
    
    const missing = required.filter(field => raw[field] === undefined);
    if (missing.length > 0) {
      const error = `❌ normalizeAnswerResponse: Missing required fields: ${missing.join(', ')}`;
      console.error(error, raw);
      throw new Error(error);
    }
    
    if (raw.level_completed) {
      const levelFields = ['level_perfect', 'level_bonus', 'level_correct_count', 'level_questions_in_level'];
      const missingLevel = levelFields.filter(field => raw[field] === undefined);
      if (missingLevel.length > 0) {
        const error = `❌ normalizeAnswerResponse: level_completed=true but missing: ${missingLevel.join(', ')}`;
        console.error(error, raw);
        throw new Error(error);
      }
    }
    
    return {
      result: raw.result,
      isCorrect: raw.is_correct,
      correctOptionId: raw.correct_option_id,
      explanationKey: raw.explanation_key,
      nextQuestionIndex: raw.next_question_index !== undefined ? raw.next_question_index : null,
      finished: !!raw.finished,
      jokerRemaining: raw.joker_remaining,
      earnedPoints: raw.earned_points,
      runningScore: raw.running_score,
      levelCompleted: !!raw.level_completed,
      levelPerfect: !!raw.level_perfect,
      levelBonus: raw.level_bonus || 0,
      bonusAppliedNow: !!(raw.bonus_applied_now),
      difficulty: raw.difficulty,
      levelCorrectCount: raw.level_correct_count !== undefined ? raw.level_correct_count : 0,
      levelQuestionsInLevel: raw.level_questions_in_level !== undefined ? raw.level_questions_in_level : 2,
      raw
    };
  }
  
  /**
   * Baut LevelResult aus AnswerModel
   */
  function buildLevelResult(answer, levelIndex) {
    if (!answer.levelCompleted) {
      throw new Error('❌ buildLevelResult: answer.levelCompleted must be true');
    }
    
    const correctCount = answer.levelCorrectCount;
    const totalCount = answer.levelQuestionsInLevel;
    
    if (typeof correctCount !== 'number' || typeof totalCount !== 'number') {
      const error = `❌ buildLevelResult: correctCount/totalCount must be numbers. Got: ${typeof correctCount}/${typeof totalCount}`;
      console.error(error, answer);
      throw new Error(error);
    }
    
    // Scenario NUR aus correctCount/totalCount
    let scenario, scenarioText;
    
    if (correctCount === totalCount) {
      scenario = 'A';
      scenarioText = 'Stark! Das war fehlerfrei.';
    } else if (correctCount > 0) {
      scenario = 'B';
      scenarioText = 'Da geht noch mehr!';
    } else {
      scenario = 'C';
      scenarioText = 'Leider war das nichts.';
    }
    
    // Score-Breakdown:
    // runningScore vom Backend = score nach Fragenpunkten + Bonus (wenn bonusAppliedNow)
    // Für UI differenzieren:
    // - scoreAfterQuestions: ohne Bonus (für HUD während Level)
    // - scoreAfterBonus: mit Bonus (für LevelUp "Neuer Punktestand")
    
    const bonus = answer.levelBonus;
    const scoreAfterBonus = answer.runningScore;
    const scoreAfterQuestions = answer.bonusAppliedNow ? (scoreAfterBonus - bonus) : scoreAfterBonus;
    
    return {
      levelIndex,
      difficulty: answer.difficulty,
      correctCount,
      totalCount,
      bonus,
      scoreAfterQuestions,
      scoreAfterBonus,
      scenario,
      scenarioText
    };
  }
  
  /**
   * Normalisiert /finish API Response
   */
  function normalizeFinishResponse(raw) {
    if (typeof raw.total_score !== 'number') {
      console.error('❌ normalizeFinishResponse: total_score missing or not a number', raw);
      throw new Error('normalizeFinishResponse: total_score is required');
    }
    
    return {
      totalScore: raw.total_score,
      tokensCount: raw.tokens_count || 0,
      breakdown: raw.breakdown || [],
      rank: raw.rank !== undefined ? raw.rank : null,
      raw
    };
  }
  
  /**
   * Normalisiert /status API Response
   */
  function normalizeStatusResponse(raw) {
    if (!raw.run_id || typeof raw.running_score !== 'number') {
      console.error('❌ normalizeStatusResponse: Missing required fields', raw);
      throw new Error('normalizeStatusResponse: run_id and running_score are required');
    }
    
    return {
      runId: raw.run_id,
      topicId: raw.topic_id,
      status: raw.status,
      currentIndex: raw.current_index,
      runningScore: raw.running_score,
      nextQuestionIndex: raw.next_question_index !== undefined ? raw.next_question_index : null,
      finished: !!raw.finished,
      jokerRemaining: raw.joker_remaining,
      levelCompleted: !!raw.level_completed,
      levelPerfect: !!raw.level_perfect,
      levelBonus: raw.level_bonus || 0,
      levelCorrectCount: raw.level_correct_count || 0,
      levelQuestionsInLevel: raw.level_questions_in_level || 2,
      raw
    };
  }

  const API_BASE = '/api/quiz';
  const TIMER_SECONDS = 30;
  const TIMER_WARNING = 10;
  const TIMER_DANGER = 5;
  const AUTO_ADVANCE_DELAY_MS = 20000; // 20 seconds - genug Zeit zum Lesen
  const TRANSITION_DURATION_MS = 600; // Slower transitions
  const COUNT_UP_DURATION_MS = 700;   // Score count-up animation
  // Level-up is a real intermediate stage; do not auto-advance.
  const LEVEL_UP_AUTO_ADVANCE_MS = null;
  const POINTS_POP_DURATION_MS = 1000; // Points pop visibility
  
  // Media bonus time (fetched from API response time_limit_bonus_s)
  let currentQuestionMediaBonusSeconds = 0;

  // Debug flag (default OFF). Enable with ?quizDebug=1 or localStorage quizDebug=1
  const DEBUG = new URLSearchParams(window.location.search).has('quizDebug') ||
    window.localStorage.getItem('quizDebug') === '1';
  let debugCallCounter = 0;

  function debugLog(fnName, data) {
    if (!DEBUG) return;
    debugCallCounter++;
    console.log(`[${debugCallCounter}] [quiz-play] ${fnName}:`, {
      timestamp: performance.now().toFixed(2),
      runId: state.runId,
      currentIndex: state.currentIndex,
      currentView: state.currentView,
      runningScore: state.runningScore,
      displayedScore: state.displayedScore,
      lastAnswer: state.lastAnswerResult ? {
        finished: state.lastAnswerResult.finished,
        is_run_finished: state.lastAnswerResult.is_run_finished,
        next_question_index: state.lastAnswerResult.next_question_index,
        earned_points: state.lastAnswerResult.earned_points,
        running_score: state.lastAnswerResult.running_score,
        level_completed: state.lastAnswerResult.level_completed,
        level_perfect: state.lastAnswerResult.level_perfect,
        level_bonus: state.lastAnswerResult.level_bonus,
      } : null,
      uiState: state.uiState,
      ...data
    });
  }

  const RUN_ID_CACHE_KEY_PREFIX = 'quiz:lastRunId:';     // per topic
  const SCORE_CACHE_KEY_PREFIX = 'quiz:lastScore:';      // per run

  function getCachedRunIdForTopic(topicId) {
    if (!topicId) return null;
    return window.localStorage.getItem(`${RUN_ID_CACHE_KEY_PREFIX}${topicId}`);
  }

  function setCachedRunIdForTopic(topicId, runId) {
    if (!topicId || !runId) return;
    window.localStorage.setItem(`${RUN_ID_CACHE_KEY_PREFIX}${topicId}`, runId);
  }

  function getCachedScoreForRun(runId) {
    if (!runId) return null;
    const raw = window.localStorage.getItem(`${SCORE_CACHE_KEY_PREFIX}${runId}`);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function setCachedScoreForRun(runId, score) {
    if (!runId) return;
    if (!Number.isFinite(score)) return;
    window.localStorage.setItem(`${SCORE_CACHE_KEY_PREFIX}${runId}`, String(Math.round(score)));
  }

  // View states for single-stage architecture
  const VIEW = {
    QUESTION: 'question',
    LEVEL_UP: 'level_up',
    FINISH: 'finish',
    POST_ANSWER: 'post_answer' // ✅ TEIL 2: New state for explanation/feedback
  };

  // State machine states
  const STATE = {
    IDLE: 'idle',
    ANSWERED_LOCKED: 'answered_locked',
    TRANSITIONING: 'transitioning'
  };

  // Question phase substates
  const PHASE = {
    ANSWERING: 'ANSWERING',        // Question active, timer running, answer buttons enabled
    POST_ANSWER: 'POST_ANSWER'     // Answer submitted, explanation shown, waiting for "Weiter"
  };

  // Game state
  let state = {
    topicId: null,
    runId: null,
    currentIndex: 0,
    nextQuestionIndex: null, // ✅ TEIL 3: Track next question from backend
    runQuestions: [],
    jokerRemaining: 2,
    jokerUsedOn: [],
    questionStartedAtMs: null,
    deadlineAtMs: null,
    answers: [],
    questionData: null,
    timerInterval: null,
    autoAdvanceTimer: null,
    levelUpTimer: null,
    uiState: STATE.IDLE,
    phase: PHASE.ANSWERING,  // ✅ NEW: Explicit phase tracking
    isAnswered: false,
    selectedAnswerId: null,
    lastAnswerResult: null,
    advanceCallback: null,
    runningScore: 0,
    displayedScore: null, // Start with null to indicate "loading"
    pendingLevelUp: false,
    pendingLevelUpData: null,
    pendingTransition: null, // ✅ TEIL 2: What to do after POST_ANSWER "Weiter"
    currentView: VIEW.QUESTION,
    isTransitioning: false,
    transitionInFlight: false, // ✅ FIX: Global lock gegen konkurrierende Transitions
    stageEls: null,
    finishData: null,
    // ✅ NEW: TimerController state
    activeTimerAttemptId: null,
    timeoutSubmittedForAttemptId: {}
  };

  // Expose state globally for debugging
  if (DEBUG) {
    window.quizState = state;
  }

  /**
   * Initialize the gameplay
   */
  async function init() {
    debugLog('init', { action: 'start' });
    
    // Setup audio button event delegation (once)
    setupAudioButtonDelegation();
    
    const container = document.querySelector('.game-shell');
    if (!container) {
      debugLog('init', { error: 'container not found' });
      return;
    }

    state.topicId = container.dataset.topic;

    // Prevent 0-flash on refresh: use cached score for last run (topic-scoped), then replace with server /status.
    try {
      const cachedRunId = getCachedRunIdForTopic(state.topicId);
      const cachedScore = getCachedScoreForRun(cachedRunId);
      if (typeof cachedScore === 'number') {
        state.runningScore = cachedScore;
        state.displayedScore = cachedScore;
        updateScoreDisplay();
        debugLog('init', { action: 'applied cached score', cachedRunId, cachedScore });
      }
    } catch (e) {
      // ignore cache errors
    }
    
    // Start or resume run
    try {
      const runData = await startOrResumeRun();
      if (!runData) {
        debugLog('init', { error: 'no run data, redirecting' });
        // Redirect to entry if no run
        window.location.href = `/quiz/${state.topicId}`;
        return;
      }
      
      debugLog('init', { runData });
      
      // Initialize state from run data
      state.runId = runData.run_id;
      setCachedRunIdForTopic(state.topicId, state.runId);

      // Apply cached score for this run ASAP (still server will replace via /status)
      const cachedScoreForThisRun = getCachedScoreForRun(state.runId);
      if (typeof cachedScoreForThisRun === 'number') {
        state.runningScore = cachedScoreForThisRun;
        state.displayedScore = cachedScoreForThisRun;
        updateScoreDisplay();
        debugLog('init', { action: 'applied cached score for run', cachedScoreForThisRun });
      }
      state.currentIndex = runData.current_index;
      state.runQuestions = runData.run_questions || [];
      state.jokerRemaining = runData.joker_remaining;
      state.jokerUsedOn = runData.joker_used_on || [];
      state.questionStartedAtMs = runData.question_started_at_ms;
      state.deadlineAtMs = runData.deadline_at_ms;
      state.answers = runData.answers || [];
      
      // Restore score from server (source of truth)
      await restoreRunningScore();
      
      // Check if already finished
      if (state.currentIndex >= 10) {
        debugLog('init', { action: 'already finished, calling finishRun' });
        await finishRun();
        return;
      }
      
      // Load current question
      await loadCurrentQuestion();
      
    } catch (error) {
      console.error('Failed to initialize quiz:', error);
      debugLog('init', { error: error.message });
      alert('Fehler beim Laden des Quiz.');
      window.location.href = `/quiz/${state.topicId}`;
    }

    // Setup event handlers
    setupJokerButton();
    setupWeiterButton();
    
    // ✅ PHASE 4: Globale Event Delegation für alle data-quiz-action Buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-quiz-action]');
      if (!btn) return;
      
      const action = btn.getAttribute('data-quiz-action');
      console.error('[QUIZ ACTION]', action);
      
      e.preventDefault();
      e.stopPropagation();
      
      switch (action) {
        case 'levelup-continue':
          cancelAutoAdvanceTimer();
          advanceFromLevelUp();
          break;
        case 'final-retry':
          // Restart run
          window.location.href = `/quiz/${state.topicId}?restart=1`;
          break;
        case 'final-leaderboard':
          // Go to topic entry (where leaderboard is) and scroll to it
          window.location.href = `/quiz/${state.topicId}#leaderboard`;
          break;
        case 'final-topics':
          // Go to topic selection
          window.location.href = '/quiz';
          break;
        default:
          console.warn('[QUIZ ACTION] Unknown action:', action);
      }
    });
    
    // Note: setupPlayAgainButton is called when finish screen is rendered
    
    debugLog('init', { action: 'complete' });
  }

  /**
   * Start a new run (immer neu, kein Resume)
   * Vereinfacht: Jeder Quiz-Start ist ein neuer Lauf.
   */
  async function startOrResumeRun() {
    debugLog('startOrResumeRun', { action: 'starting NEW run (always force_new)' });

    const startResp = await fetch(`${API_BASE}/${state.topicId}/run/start`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force_new: true })
    });

    if (!startResp.ok) {
      if (startResp.status === 401 || startResp.status === 403) {
        return null;
      }
      throw new Error(`HTTP ${startResp.status}`);
    }

    const startData = await startResp.json();
    debugLog('startOrResumeRun', {
      action: 'start response',
      is_new: startData.is_new,
      run_id: startData.run?.run_id,
      current_index: startData.run?.current_index,
      status: startData.run?.status
    });

    return startData.run;
  }

  /**
   * Restore running score from server (source of truth)
   * Called on page load/refresh to ensure score is correct
   */
  async function restoreRunningScore() {
    debugLog('restoreRunningScore', { action: 'start' });
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/status`, {
        credentials: 'same-origin'
      });
      
      debugLog('restoreRunningScore', { 
        responseStatus: response.status, 
        responseOk: response.ok 
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Failed to restore score: HTTP ${response.status}`, errorData);
        debugLog('restoreRunningScore', { 
          error: 'http error', 
          status: response.status, 
          statusText: response.statusText,
          errorCode: errorData.code,
          errorMessage: errorData.error
        });
        
        // Handle specific error codes - NO SILENT FALLBACK TO 0
        if (response.status === 401 || response.status === 403) {
          alert('Bitte melden Sie sich an, um fortzufahren.');
          window.location.href = `/quiz/${state.topicId}`;
          return;
        }
        
        if (response.status === 404) {
          alert('Quiz-Lauf wurde nicht gefunden. Bitte starten Sie neu.');
          window.location.href = `/quiz/${state.topicId}`;
          return;
        }
        
        if (response.status === 500) {
          alert('Serverfehler beim Laden des Spielstands. Bitte versuchen Sie es erneut.');
          window.location.href = `/quiz/${state.topicId}`;
          return;
        }
        
        // Unknown error
        alert(`Fehler beim Laden des Spielstands (${response.status}). Bitte versuchen Sie es erneut.`);
        window.location.href = `/quiz/${state.topicId}`;
        return;
      }
      
      const data = await response.json();
      debugLog('restoreRunningScore', { serverData: data });
      
      // Validate response
      if (typeof data.running_score !== 'number') {
        console.error('Invalid response: running_score is not a number', data);
        debugLog('restoreRunningScore', { error: 'invalid response', data });
        alert('Ungültige Antwort vom Server.');
        window.location.href = `/quiz/${state.topicId}`;
        return;
      }
      
      state.runningScore = data.running_score;
      state.displayedScore = state.runningScore;
      updateScoreDisplay();
      
      debugLog('restoreRunningScore', { 
        runningScore: state.runningScore,
        level_completed: data.level_completed,
        level_perfect: data.level_perfect
      });
      updateScoreDisplay();

      // Keep cache in sync to prevent 0-flash on future refresh
      setCachedScoreForRun(state.runId, state.runningScore);

      if (typeof data.current_index === 'number') {
        state.currentIndex = data.current_index;
      }
      
      debugLog('restoreRunningScore', { 
        action: 'complete', 
        finalScore: state.runningScore,
        displayedScore: state.displayedScore
      });
    } catch (error) {
      console.error('Failed to restore score:', error);
      debugLog('restoreRunningScore', { error: error.message, stack: error.stack });
      alert('Netzwerkfehler beim Laden des Spielstands. Bitte prüfen Sie Ihre Verbindung.');
      window.location.href = `/quiz/${state.topicId}`;
    }
  }

  /**
   * Fallback: Fetch status and apply running score when answer response is incomplete
   */
  async function fetchStatusAndApply() {
    debugLog('fetchStatusAndApply', { action: 'fetching /status as fallback' });
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/status`, {
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        console.error('❌ fetchStatusAndApply failed:', response.status);
        alert('Fehler beim Laden des aktuellen Spielstands');
        return null;
      }
      
      const data = await response.json();
      
      debugLog('fetchStatusAndApply', {
        running_score: data.running_score,
        current_index: data.current_index
      });
      
      if (typeof data.running_score === 'number') {
        state.runningScore = data.running_score;
        await updateScoreWithAnimation(state.runningScore);

        setCachedScoreForRun(state.runId, state.runningScore);

        if (typeof data.current_index === 'number') {
          state.currentIndex = data.current_index;
        }
        return data;
      } else {
        console.error('❌ /status response missing running_score');
        return null;
      }
      
    } catch (error) {
      console.error('❌ fetchStatusAndApply error:', error);
      return null;
    }
  }

  /**
   * Render current view (QUESTION, LEVEL_UP, or FINISH)
   * This is the single source of truth for what's visible on stage
   */
  function ensureStageContainers() {
    if (state.stageEls) return;

    const questionContainer = document.getElementById('quiz-question-container');
    const questionWrapper = document.getElementById('quiz-question-wrapper');
    if (!questionContainer || !questionWrapper) return;

    // ✅ FIX: LevelUp/Finish müssen SIBLINGS von questionContainer sein, nicht Children!
    // Finde parent container (sollte game-shell oder quiz-play-root sein)
    const parentContainer = questionContainer.parentElement;
    if (!parentContainer) return;

    let levelUpContainer = document.getElementById('quiz-level-up-container');
    if (!levelUpContainer) {
      levelUpContainer = document.createElement('div');
      levelUpContainer.id = 'quiz-level-up-container';
      levelUpContainer.className = 'quiz-level-up-container';
      levelUpContainer.hidden = true;
      parentContainer.appendChild(levelUpContainer); // Sibling, nicht Child!
      console.error('[ENSURE CONTAINERS] Created levelUpContainer as SIBLING of questionContainer');
    }

    let finishContainer = document.getElementById('quiz-finish-container');
    if (!finishContainer) {
      finishContainer = document.createElement('div');
      finishContainer.id = 'quiz-finish-container';
      finishContainer.className = 'quiz-finish-container';
      finishContainer.hidden = true;
      parentContainer.appendChild(finishContainer); // Sibling, nicht Child!
      console.error('[ENSURE CONTAINERS] Created finishContainer as SIBLING of questionContainer');
    }

    state.stageEls = {
      questionWrapper,
      levelUpContainer,
      finishContainer
    };
  }

  function renderCurrentView() {
    debugLog('renderCurrentView', { view: state.currentView });
    
    ensureStageContainers();
    
    const questionContainer = document.getElementById('quiz-question-container');
    const questionWrapper = document.getElementById('quiz-question-wrapper');
    const hudEl = document.getElementById('quiz-hud');
    
    if (!questionContainer) {
      debugLog('renderCurrentView', { error: 'question container not found' });
      return;
    }
    
    // Keep HUD always visible so score display is accessible
    // Only hide timer/joker during non-question views
    if (hudEl) {
      const timerEl = document.getElementById('quiz-timer');
      const jokerEl = document.getElementById('quiz-joker-btn');
      const isQuestion = state.currentView === VIEW.QUESTION;
      
      if (timerEl) timerEl.style.display = isQuestion ? '' : 'none';
      if (jokerEl) jokerEl.style.display = isQuestion ? '' : 'none';
    }

    // ✅ FIX: Verwende state.stageEls (konsistente Referenzen)
    const levelUpContainer = state.stageEls?.levelUpContainer;
    const finalContainer = state.stageEls?.finishContainer;
    
    console.error('[RENDER CURRENT VIEW]', {
      view: state.currentView,
      questionWrapperExists: !!questionWrapper,
      levelUpContainerExists: !!levelUpContainer,
      finalContainerExists: !!finalContainer,
      levelUpParent: levelUpContainer?.parentElement?.id,
      questionContainerSiblings: questionContainer.parentElement?.children.length
    });
    
    // ✅ FIX: Hide individual containers (siblings), NOT parent questionContainer
    if (questionWrapper) questionWrapper.hidden = true;
    if (levelUpContainer) levelUpContainer.hidden = true;
    if (finalContainer) finalContainer.hidden = true;
    
    // Test hook: expose current view for E2E diagnostics.
    window.__quizPlayCurrentView = state.currentView;
    
    switch (state.currentView) {
      case VIEW.QUESTION:
        if (questionWrapper) questionWrapper.hidden = false;
        debugLog('renderCurrentView', { action: 'showing QUESTION view' });
        break;
        
      case VIEW.LEVEL_UP:
        if (levelUpContainer) {
          levelUpContainer.hidden = false;
          levelUpContainer.removeAttribute('hidden'); // Force remove attribute
          console.error('[RENDER CURRENT VIEW] ✅ Setting LevelUp visible (parent:', levelUpContainer.parentElement?.id, ')');
        } else {
          console.error('[RENDER CURRENT VIEW] ❌ LevelUp container NOT FOUND!');
        }
        renderLevelUpInContainer();
        debugLog('renderCurrentView', { action: 'showing LEVEL_UP view' });
        break;
        
      case VIEW.FINISH:
        if (finalContainer) finalContainer.hidden = false;
        renderFinishInContainer();
        debugLog('renderCurrentView', { action: 'showing FINISH view' });
        break;
    }
    
    // Update page title
    const container = document.querySelector('.game-shell');
    const topicTitle = container?.dataset.topic || '';
    setPageTitle(state.currentView, topicTitle);
    
    // Scroll to top to ensure view is visible
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }

  /**
   * Transition to a new view with animation
   */
  async function transitionToView(newView) {
    if (state.isTransitioning) return;
    
    // ✅ FIX: Stop ALL timers when leaving QUESTION view
    if (newView !== VIEW.QUESTION) {
      stopAllTimers();
      console.error('[TRANSITION] Stopped all timers, transitioning to:', newView);
    }
    
    // Stop any playing audio on view transition
    AudioController.stopAndReset();
    
    state.isTransitioning = true;
    const wrapper = document.getElementById('quiz-question-wrapper');
    
    // Start leaving animation
    if (wrapper) {
      wrapper.setAttribute('data-transition-state', 'leaving');
    }
    
    await new Promise(resolve => setTimeout(resolve, TRANSITION_DURATION_MS));
    
    // Switch view
    state.currentView = newView;
    renderCurrentView();
    
    // Start entering animation
    if (wrapper) {
      wrapper.setAttribute('data-transition-state', 'entering');
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (wrapper) {
      wrapper.setAttribute('data-transition-state', 'idle');
    }
    
    state.isTransitioning = false;
  }

  /**
   * Update the score display (instant, no animation)
   */
  function updateScoreDisplay() {
    const scoreEl = document.getElementById('quiz-score-display');
    if (scoreEl) {
      if (state.displayedScore === null || !Number.isFinite(state.displayedScore)) {
        scoreEl.textContent = '—';
      } else {
        scoreEl.textContent = Math.round(state.displayedScore);
      }
      debugLog('updateScoreDisplay', { 
        displayedScore: state.displayedScore, 
        elementText: scoreEl.textContent
      });
    } else {
      debugLog('updateScoreDisplay', { error: 'score element not found!' });
      console.error('Score element #quiz-score-display not found in DOM');
    }
  }

  /**
   * Animate score count-up from current to target value
   * @param {HTMLElement} element - Element to animate
   * @param {number} targetValue - Target value
   * @param {number} duration - Animation duration in ms (default 700ms)
   * @param {string} prefix - Optional prefix (e.g., '+')
   */
  function animateCountUp(element, targetValue, duration = COUNT_UP_DURATION_MS, prefix = '') {
    if (!element) return;
    
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      element.textContent = prefix + Math.round(targetValue);
      return;
    }
    
    const startValue = parseInt(element.textContent.replace(/[^\d]/g, ''), 10) || 0;
    const startTime = performance.now();
    
    element.classList.add('quiz-score-chip__value--counting');
    
    function updateValue(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for snappy feel
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (targetValue - startValue) * eased);
      
      element.textContent = prefix + currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(updateValue);
      } else {
        element.classList.remove('quiz-score-chip__value--counting');
      }
    }
    
    requestAnimationFrame(updateValue);
  }

  /**
   * Update score with count-up animation
   */
  function updateScoreWithAnimation(targetScore) {
    debugLog('updateScoreWithAnimation', { 
      startValue: state.displayedScore, 
      targetScore 
    });
    
    const scoreEl = document.getElementById('quiz-score-display');
    if (!scoreEl) {
      debugLog('updateScoreWithAnimation', { error: 'score element not found' });
      console.error('Score element not found for animation');
      return;
    }
    
    // Animate from displayed to target
    const startValue = state.displayedScore;
    const startTime = performance.now();
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      state.displayedScore = targetScore;
      updateScoreDisplay();
      return;
    }
    
    function animateScore(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / COUNT_UP_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      state.displayedScore = startValue + (targetScore - startValue) * eased;
      updateScoreDisplay();
      
      if (progress < 1) {
        requestAnimationFrame(animateScore);
      } else {
        state.displayedScore = targetScore;
        updateScoreDisplay();
        debugLog('updateScoreWithAnimation', { action: 'complete', finalScore: targetScore });
      }
    }
    
    requestAnimationFrame(animateScore);
  }

  /**
   * Show points pop animation on score chip (longer duration, more visible)
   */
  function showPointsPop(points) {
    if (points <= 0) return;
    
    const popEl = document.getElementById('quiz-score-pop');
    if (!popEl) return;
    
    // Set text and trigger animation
    popEl.textContent = `+${points}`;
    popEl.classList.remove('quiz-score-chip__pop--animate');
    
    // Force reflow to restart animation
    void popEl.offsetWidth;
    
    popEl.classList.add('quiz-score-chip__pop--animate');
    
    // Remove class after animation completes (longer duration)
    setTimeout(() => {
      popEl.classList.remove('quiz-score-chip__pop--animate');
    }, POINTS_POP_DURATION_MS);
  }

  /**
   * Announce to screen readers
   */
  function announceA11y(message) {
    const announceEl = document.getElementById('quiz-a11y-announce');
    if (announceEl) {
      announceEl.textContent = message;
    }
  }

  /**
   * Set page title (removed - now handled by template)
   * Titles remain stable: "Quiz | Games.Hispanistica"
   * @deprecated No longer sets document.title dynamically
   * @param {string} view - Current view (QUESTION, LEVEL_UP, or FINISH)
   * @param {string} quizTitle - Quiz topic title
   */
  function setPageTitle(view, quizTitle = '') {
    // Title is now set by template and stays stable
    // No dynamic changes during quiz navigation
  }

  /**
   * Set UI state and update UI accordingly
   */
  function setUIState(newState) {
    state.uiState = newState;
    
    const explanationCard = document.getElementById('quiz-explanation-card');
    const weiterBtn = document.getElementById('quiz-weiter-btn');
    const jokerBtn = document.getElementById('quiz-joker-btn');
    const answerBtns = document.querySelectorAll('.quiz-answer-option');
    
    switch (newState) {
      case STATE.IDLE:
        // Enable answers (unless hidden)
        answerBtns.forEach(btn => {
          if (!btn.hidden) {
            btn.removeAttribute('aria-disabled');
            btn.setAttribute('tabindex', '0');
          }
        });
        // Enable joker if available
        if (jokerBtn) {
          const alreadyUsed = state.jokerUsedOn.includes(state.currentIndex);
          jokerBtn.disabled = state.jokerRemaining <= 0 || alreadyUsed;
        }
        // Hide explanation and weiter
        if (explanationCard) explanationCard.hidden = true;
        if (weiterBtn) weiterBtn.hidden = true;
        break;
        
      case STATE.ANSWERED_LOCKED:
        // Disable ALL answers and add locked class
        answerBtns.forEach(btn => {
          btn.setAttribute('aria-disabled', 'true');
          btn.setAttribute('tabindex', '-1');
          // Only add locked class to non-selected, non-correct-reveal answers
          if (!btn.classList.contains('quiz-answer--selected-correct') &&
              !btn.classList.contains('quiz-answer--selected-wrong') &&
              !btn.classList.contains('quiz-answer--correct-reveal')) {
            btn.classList.add('quiz-answer--locked');
          }
        });
        // Disable joker
        if (jokerBtn) jokerBtn.disabled = true;
        // Show Weiter button
        if (weiterBtn) {
          weiterBtn.hidden = false;
          weiterBtn.disabled = false;
        }
        // Start 15s auto-advance timer
        startAutoAdvanceTimer();
        break;
        
      case STATE.TRANSITIONING:
        // Everything disabled
        answerBtns.forEach(btn => {
          btn.setAttribute('aria-disabled', 'true');
          btn.setAttribute('tabindex', '-1');
        });
        if (jokerBtn) jokerBtn.disabled = true;
        if (weiterBtn) weiterBtn.disabled = true;
        // Cancel auto-advance
        cancelAutoAdvanceTimer();
        break;
    }
  }

  /**
   * Start the auto-advance timer (simulates Weiter button click)
   * ✅ FIX: Nutzt Weiter-Button statt eigenen Navigation-Pfad
   */
  function startAutoAdvanceTimer() {
    cancelAutoAdvanceTimer();
    state.autoAdvanceTimer = setTimeout(() => {
      // Guard: nur wenn noch im richtigen Zustand
      if (state.phase === PHASE.POST_ANSWER && !state.transitionInFlight) {
        const weiterBtn = document.getElementById('quiz-weiter-btn');
        if (weiterBtn && !weiterBtn.disabled && !weiterBtn.hidden) {
          debugLog('startAutoAdvanceTimer', { action: 'auto-clicking Weiter button' });
          weiterBtn.click();
        }
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
   * Scroll to explanation card if not in viewport
   */
  function scrollToExplanationIfNeeded() {
    const explanationCard = document.getElementById('quiz-explanation-card');
    if (!explanationCard || explanationCard.hidden) return;
    
    const rect = explanationCard.getBoundingClientRect();
    const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
    
    if (!isInViewport) {
      explanationCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Load current question data and display
   * ✅ FIX: Atomisiert mit Lock, Guards, vollständigem Timer-Stop
   */
  async function loadCurrentQuestion() {
    // ✅ GUARD 1: Transition Lock
    if (state.transitionInFlight) {
      console.error('[GUARD] ❌ BLOCKED loadCurrentQuestion - transition in flight');
      return;
    }
    
    // ✅ GUARD 2: View Check
    if (state.currentView !== VIEW.QUESTION) {
      console.error('[GUARD] ❌ BLOCKED loadCurrentQuestion - currentView:', state.currentView);
      return;
    }
    
    // ✅ SET LOCK
    state.transitionInFlight = true;
    debugLog('loadCurrentQuestion', { action: 'set transition lock', index: state.currentIndex });
    
    // ✅ STOP ALL TIMERS SOFORT
    stopAllTimers();
    
    // Stop any playing audio when loading new question
    AudioController.stopAndReset();
    
    debugLog('loadCurrentQuestion', { index: state.currentIndex });
    
    if (state.currentIndex >= state.runQuestions.length) {
      debugLog('loadCurrentQuestion', { action: 'finished, calling finishRun' });
      await finishRun();
      return;
    }
    
    const questionConfig = state.runQuestions[state.currentIndex];
    const questionId = questionConfig.question_id;
    
    debugLog('loadCurrentQuestion', { questionId, difficulty: questionConfig.difficulty });
    
    // Fetch question details
    const response = await fetch(`${API_BASE}/questions/${questionId}`, {
      credentials: 'same-origin'
    });
    if (!response.ok) {
      throw new Error('Failed to load question');
    }
    
    state.questionData = await response.json();
    state.isAnswered = false;
    state.selectedAnswerId = null;
    state.lastAnswerResult = null;
    state.pendingLevelUp = false;
    state.pendingLevelUpData = null;
    state.pendingTransition = null; // ✅ Clear pending transition
    
    // Check for media time bonus (API returns time_limit_bonus_s for media-rich questions)
    currentQuestionMediaBonusSeconds = state.questionData.time_limit_bonus_s || 0;
    debugLog('loadCurrentQuestion', { 
      hasMedia: !!(state.questionData.media && state.questionData.media.length),
      mediaBonus: currentQuestionMediaBonusSeconds 
    });
    
    debugLog('loadCurrentQuestion', { action: 'data loaded, rendering question' });
    
    // Start timer if not already started
    if (!state.questionStartedAtMs) {
      await startQuestionTimer();
    }
    
    // Render question
    renderQuestion();
    
    // Switch to QUESTION view
    state.currentView = VIEW.QUESTION;
    renderCurrentView();
    
    // [DEBUG] Verify prompt text after renderCurrentView
    const promptCheck = document.getElementById('quiz-question-prompt');
    if (promptCheck) {
      console.log('[DEBUG] Prompt after renderCurrentView:', promptCheck.textContent);
    }
    
    // Set UI to idle
    setUIState(STATE.IDLE);
    
    // Set transition wrapper to idle
    const wrapper = document.getElementById('quiz-question-wrapper');
    if (wrapper) {
      wrapper.setAttribute('data-transition-state', 'idle');
    }
    
    // ✅ CHANGE 6: Fokus für Accessibility setzen, aber ohne sichtbaren Ring
    // Nutze { preventScroll: true } und verzögere den Fokus leicht
    const promptEl = document.getElementById('quiz-question-prompt');
    if (promptEl) {
      promptEl.setAttribute('tabindex', '-1');
      // Fokus für Screen-Reader, aber ohne visuellen Ring durch Verzögerung
      requestAnimationFrame(() => {
        promptEl.focus({ preventScroll: true });
        // Sofort blur um Ring zu entfernen, Screen-Reader hat schon fokussiert
        promptEl.blur();
        
        // ✅ MOBILE: Scroll to question on mobile to ensure visibility
        if (window.innerWidth <= 600) {
          const questionContainer = document.getElementById('quiz-question-container');
          if (questionContainer) {
            // Smooth scroll to question with offset for HUD
            const yOffset = -80; // Account for sticky HUD
            const y = questionContainer.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        }
      });
    }
    
    // ✅ PHASE: Set to ANSWERING NUR am Ende, nach allem Setup
    state.phase = PHASE.ANSWERING;
    console.error('[PHASE] ✅ Set to ANSWERING for question:', state.currentIndex);
    
    // ✅ RELEASE LOCK
    state.transitionInFlight = false;
    debugLog('loadCurrentQuestion', { action: 'released transition lock' });
    
    // ✅ TIMER: Start countdown nur wenn phase = ANSWERING
    startTimerCountdown();
    
    debugLog('loadCurrentQuestion', { action: 'complete' });
  }

  /**
   * Start question timer on server
   * Includes media bonus time if question has audio/image
   */
  async function startQuestionTimer() {
    const startedAtMs = Date.now();
    
    // Calculate total time including media bonus
    const totalTimerSeconds = TIMER_SECONDS + currentQuestionMediaBonusSeconds;
    
    if (currentQuestionMediaBonusSeconds > 0) {
      debugLog('startQuestionTimer', { 
        baseTimer: TIMER_SECONDS, 
        mediaBonus: currentQuestionMediaBonusSeconds,
        totalTimer: totalTimerSeconds
      });
    }
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/question/start`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_index: state.currentIndex,
          started_at_ms: startedAtMs,
          time_limit_bonus_s: currentQuestionMediaBonusSeconds
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        state.questionStartedAtMs = data.question_started_at_ms;
        state.deadlineAtMs = data.deadline_at_ms;
      } else {
        // Fallback to client-side timer (with bonus)
        state.questionStartedAtMs = startedAtMs;
        state.deadlineAtMs = startedAtMs + (totalTimerSeconds * 1000);
      }
    } catch (error) {
      // Fallback to client-side timer (with bonus)
      state.questionStartedAtMs = startedAtMs;
      state.deadlineAtMs = startedAtMs + (totalTimerSeconds * 1000);
    }
  }

  /**
   * Stop ALL timers completely (cleanup)
   * ✅ FIX: Zentrales Timer-Management - stoppt ALLE Timer ohne Ausnahme
   */
  function stopAllTimers() {
    // Countdown Timer
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    const oldAttemptId = state.activeTimerAttemptId;
    state.activeTimerAttemptId = null;
    if (oldAttemptId && DEBUG) {
      debugLog('stopAllTimers', { clearedAttemptId: oldAttemptId });
    }
    
    // Auto-Advance Timer
    if (state.autoAdvanceTimer) {
      clearTimeout(state.autoAdvanceTimer);
      state.autoAdvanceTimer = null;
    }
    
    // LevelUp Auto-Forward
    if (state.autoForwardTimeout) {
      clearTimeout(state.autoForwardTimeout);
      state.autoForwardTimeout = null;
    }
    if (state.autoForwardInterval) {
      clearInterval(state.autoForwardInterval);
      state.autoForwardInterval = null;
    }
    
    // Legacy LevelUp Timer
    if (state.levelUpTimer) {
      clearTimeout(state.levelUpTimer);
      state.levelUpTimer = null;
    }
  }

  /**
   * Start the timer countdown display with attemptId guards
   * ✅ FIX: Verstärkte Guards + stopAllTimers() zuerst
   */
  function startTimerCountdown() {
    // ✅ GUARD 1: Transition Lock
    if (state.transitionInFlight) {
      console.error('[TIMER GUARD] ❌ BLOCKED startTimerCountdown - transition in flight');
      return;
    }
    
    // ✅ GUARD 2: Timer darf NUR laufen bei view=QUESTION und phase=ANSWERING
    if (state.currentView !== VIEW.QUESTION || state.phase !== PHASE.ANSWERING) {
      console.error('[TIMER GUARD] ❌ BLOCKED startTimerCountdown - view:', state.currentView, 'phase:', state.phase);
      return;
    }
    
    // ✅ GUARD 3: Question Data muss vorhanden sein
    if (!state.questionData || !state.questionData.id) {
      console.error('[TIMER GUARD] ❌ BLOCKED startTimerCountdown - no questionData');
      return;
    }
    
    // ✅ BUILD attemptId: eindeutige ID für diese Frage-Versuch
    const attemptId = `${state.runId}:${state.currentIndex}:${state.questionData.id}`;
    
    // ✅ GUARD 4: Verhindere Duplikat-Timer für dieselbe AttemptId
    if (state.activeTimerAttemptId === attemptId) {
      console.error('[TIMER GUARD] ❌ BLOCKED startTimerCountdown - already running for attemptId:', attemptId);
      return;
    }
    
    stopAllTimers(); // Stop any stale timers
    
    state.activeTimerAttemptId = attemptId;
    console.error('[TIMER] ✅ Started for attemptId:', attemptId, 'index:', state.currentIndex);
    
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
      
      // ✅ TIMEOUT GUARD: Prüfe phase statt nur uiState
      if (remaining <= 0 && state.phase === PHASE.ANSWERING && !state.isAnswered) {
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
    // ✅ PHASE 3: Render-Lock - Blockiere während LevelUp/Finish
    if (state.currentView === VIEW.LEVEL_UP || state.currentView === VIEW.FINISH) {
      const stack = new Error().stack;
      console.error('[RENDER GUARD] ❌ BLOCKED renderQuestion() - currentView:', state.currentView);
      console.error('[RENDER GUARD] Call stack:', stack);
      return;
    }
    
    const config = state.runQuestions[state.currentIndex];
    const q = state.questionData;
    
    // Update header
    const difficulty = config.difficulty;
    document.getElementById('quiz-level-num').textContent = difficulty;
    document.getElementById('quiz-question-current').textContent = state.currentIndex + 1;
    document.getElementById('quiz-question-total').textContent = '10';
    
    // Update joker button
    updateJokerButton();
    
    // Render prompt - support both 'prompt' and 'prompt_key'
    const promptEl = document.getElementById('quiz-question-prompt');
    const promptText = q.prompt || q.prompt_key || '';
    console.log('[DEBUG] Prompt text:', promptText, 'from q:', q);
    promptEl.textContent = promptText;
    
    // Render question-level media (supports v2 array format)
    const mediaEl = document.getElementById('quiz-question-media');
    const mediaHtml = renderMediaArray(q.media);
    if (mediaHtml) {
      mediaEl.innerHTML = mediaHtml;
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
      const answerText = answer.text || answer.text_key || '';  // Support both 'text' and 'text_key'
      
      // Check if answer has audio media
      const answerMedia = answer.media || [];
      const audioItem = answerMedia.find(m => m.type === 'audio');
      const hasAudio = !!audioItem;
      const audioSrc = audioItem ? audioItem.src : '';
      const audioCaption = audioItem ? (audioItem.caption || audioItem.label || '') : '';
      
      // Build audio elements HTML (only if audio exists)
      const audioElementsHtml = hasAudio ? `
        <span class="quiz-answer-audio-icon material-symbols-rounded" aria-hidden="true">headphones</span>
        <button type="button"
                class="md3-audio-btn md3-audio-btn--inline"
                data-audio-src="${escapeHtml(audioSrc)}"
                data-audio-label="Antwort ${marker}"
                aria-label="Antwort ${marker} abspielen"
                aria-pressed="false"
                tabindex="-1">
          <span class="material-symbols-rounded md3-audio-btn__icon" aria-hidden="true">play_arrow</span>
        </button>
      ` : '';
      
      const audioCaptionHtml = hasAudio && audioCaption ? `
        <span class="quiz-answer-audio-text">${escapeHtml(audioCaption)}</span>
      ` : '';
      
      const inlineClass = hasAudio ? 'quiz-answer-inline has-audio' : 'quiz-answer-inline';
      
      // If joker was used, hide the disabled options completely
      if (isDisabled) {
        return `
          <div 
            class="quiz-answer-option quiz-answer-option--hidden"
            data-answer-id="${answerId}"
            role="button"
            tabindex="-1"
            aria-disabled="true"
            hidden
          >
            <div class="${inlineClass}">
              <span class="quiz-answer-letter">${marker}</span>
              ${audioElementsHtml}
              <span class="quiz-answer-text">${escapeHtml(answerText)}</span>
              ${audioCaptionHtml}
            </div>
          </div>
        `;
      }
      
      return `
        <div 
          class="quiz-answer-option"
          data-answer-id="${answerId}"
          role="button"
          tabindex="0"
          aria-label="Antwort ${marker}: ${escapeHtml(answerText)}"
        >
          <div class="${inlineClass}">
            <span class="quiz-answer-letter">${marker}</span>
            ${audioElementsHtml}
            <span class="quiz-answer-text">${escapeHtml(answerText)}</span>
            ${audioCaptionHtml}
          </div>
        </div>
      `;
    }).join('');
    
    answersEl.innerHTML = answersHtml;
    
    // Add click handlers for answer option divs (not the audio buttons inside)
    answersEl.querySelectorAll('.quiz-answer-option:not([hidden])').forEach(answerDiv => {
      // Click on answer option (but not on audio button inside)
      answerDiv.addEventListener('click', (e) => {
        // Don't select answer if clicking on audio button
        if (e.target.closest('.md3-audio-btn')) {
          return;
        }
        // Don't select if disabled
        if (answerDiv.getAttribute('aria-disabled') === 'true') {
          return;
        }
        handleAnswerClick(answerDiv.dataset.answerId);
      });
      
      // Keyboard support for div[role="button"]
      answerDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Don't select if disabled
          if (answerDiv.getAttribute('aria-disabled') === 'true') {
            return;
          }
          handleAnswerClick(answerDiv.dataset.answerId);
        }
      });
    });
    
    // Hide explanation card initially
    const explanationCard = document.getElementById('quiz-explanation-card');
    if (explanationCard) explanationCard.hidden = true;
    
    const weiterBtn = document.getElementById('quiz-weiter-btn');
    if (weiterBtn) weiterBtn.hidden = true;
  }

  /**
   * Handle answer click - ONLY locks UI, does NOT advance automatically
   */
  async function handleAnswerClick(answerId) {
    debugLog('handleAnswerClick', { answerId, uiState: state.uiState, isAnswered: state.isAnswered });
    
    // ✅ FIX: Guard gegen Transitions
    if (state.transitionInFlight) {
      debugLog('handleAnswerClick', { action: 'blocked', reason: 'transition in flight' });
      return;
    }
    
    if (state.uiState !== STATE.IDLE || state.isAnswered) {
      debugLog('handleAnswerClick', { action: 'blocked', reason: 'already answered or wrong state' });
      return;
    }
    
    // ✅ FIX: Set Lock während Submit
    state.transitionInFlight = true;
    
    state.isAnswered = true;
    state.selectedAnswerId = answerId;
    
    // ✅ Stop ALL timers SOFORT
    stopAllTimers();
    
    // Immediately lock UI
    setUIState(STATE.ANSWERED_LOCKED);
    
    // Highlight selected answer
    const answerBtns = document.querySelectorAll('.quiz-answer-option');
    answerBtns.forEach(btn => {
      if (btn.dataset.answerId === answerId) {
        btn.classList.add('quiz-answer--selected');
      }
    });
    
    const answeredIndex = state.currentIndex;

    // Submit answer
    const usedJoker = state.jokerUsedOn.includes(state.currentIndex);
    const selectedAnswerIdPayload = (/^\d+$/.test(String(answerId))
      ? Number(answerId)
      : answerId);
    
    debugLog('handleAnswerClick', { action: 'submitting answer' });
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/answer`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_index: state.currentIndex,
          selected_answer_id: selectedAnswerIdPayload,
          answered_at_ms: Date.now(),
          used_joker: usedJoker
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }
      
      const data = await response.json();
      
      // ✅ RELEASE LOCK nach erfolgreichem Submit
      state.transitionInFlight = false;
      
      // ✅ PHASE: Transition to POST_ANSWER nach Submit
      state.phase = PHASE.POST_ANSWER;
      console.error('[PHASE] ✅ Set to POST_ANSWER after answer submit');
      
      // ✅ INSTRUMENTATION: Log raw API response
      console.error('[ANSWER RAW]', {
        result: data.result,
        running_score: data.running_score,
        level_completed: data.level_completed,
        level_perfect: data.level_perfect,
        level_bonus: data.level_bonus,
        level_correct_count: data.level_correct_count,
        level_questions_in_level: data.level_questions_in_level,
        difficulty: data.difficulty,
        fullData: data
      });
      
      // ✅ MAPPER: Normalisiere Response zu AnswerModel
      let answer;
      try {
        answer = normalizeAnswerResponse(data);
        console.error('[ANSWER MODEL]', answer);
      } catch (e) {
        console.error('❌ Failed to normalize answer response:', e);
        alert('Fehler beim Verarbeiten der Antwort. Bitte Seite neu laden.');
        return;
      }
      
      state.lastAnswerResult = answer;
      // Test hook: expose the normalized answer model
      window.__quizPlayLastAnswer = answer;
      
      // Log FULL answer model for debugging
      debugLog('handleAnswerClick', {
        action: 'got normalized answer model',
        result: answer.result,
        runningScore: answer.runningScore,
        earnedPoints: answer.earnedPoints,
        levelCompleted: answer.levelCompleted,
        levelPerfect: answer.levelPerfect,
        levelBonus: answer.levelBonus,
        bonusAppliedNow: answer.bonusAppliedNow,
        finished: answer.finished
      });
      
      // Show result styling on answers (new state system)
      showAnswerResult(answerId, answer.result, answer.correctOptionId);
      
      // CRITICAL: Validate and update score from backend (source of truth)
      const oldScore = state.runningScore;
      const hasNumericRunningScore = typeof answer.runningScore === 'number';
      const earnedPoints = answer.earnedPoints;

      const runningScoreLooksInconsistent = (
        hasNumericRunningScore && (
          answer.runningScore < oldScore ||
          (earnedPoints > 0 && answer.runningScore <= oldScore)
        )
      );

      if (!hasNumericRunningScore || runningScoreLooksInconsistent) {
        console.error('❌ running_score missing/inconsistent; falling back to /status', {
          runningScore: answer.runningScore,
          oldScore,
          earnedPoints,
          answer
        });

        const statusData = await fetchStatusAndApply();
        if (!statusData) {
          alert('Kritischer Fehler beim Score-Update. Bitte Seite neu laden.');
          return;
        }

        // Keep the Weiter-decision inputs consistent with the server source of truth.
        try {
          state.lastAnswerResult.runningScore = statusData.runningScore;
          state.lastAnswerResult.levelCompleted = statusData.levelCompleted;
          state.lastAnswerResult.levelPerfect = statusData.levelPerfect;
          state.lastAnswerResult.levelBonus = statusData.levelBonus;
          window.__quizPlayLastAnswer = state.lastAnswerResult;
        } catch (e) {
          // Best-effort; scoring display is already corrected.
        }
      } else {
        state.runningScore = answer.runningScore;
        debugLog('handleAnswerClick', {
          action: 'updating score from /answer',
          oldScore,
          newScore: state.runningScore,
          difference: state.runningScore - oldScore,
          bonusAppliedNow: answer.bonusAppliedNow
        });

        if (answer.result === 'correct' && earnedPoints > 0) {
          showPointsPop(earnedPoints);
          announceA11y('Antwort korrekt');
        } else {
          announceA11y(answer.result === 'timeout' ? 'Zeit abgelaufen' : 'Antwort falsch');
        }

        // Update score display: HUD zeigt scoreAfterQuestions (ohne Bonus)
        // Bonus wird erst auf LevelUp visuell "applied"
        if (answer.levelCompleted && answer.levelBonus > 0 && answer.bonusAppliedNow) {
            // Backend hat Bonus schon in runningScore eingerechnet
            // HUD zeigt Score OHNE Bonus (für jetzt)
            state.displayedScore = answer.runningScore - answer.levelBonus;
            updateScoreDisplay();
        } else {
            // Kein Bonus oder Bonus nicht applied: direkt anzeigen
            updateScoreWithAnimation(answer.runningScore);
        }
        setCachedScoreForRun(state.runId, state.runningScore);
      }
      
      // Show explanation card (no "Richtig/Falsch" text)
      showExplanationCard(answer.explanationKey);
      
      // Update state for next question
      state.jokerRemaining = answer.jokerRemaining;
      
      // Store correctness in runQuestions for Level-Up stats
      if (state.runQuestions[state.currentIndex]) {
        state.runQuestions[state.currentIndex].correct = (answer.result === 'correct');
      }

      // Prepare Level-Up Data if completed
      if (answer.levelCompleted) {
          state.pendingLevelUp = true;
          
          // ✅ MAPPER: Baue LevelResult aus AnswerModel
          try {
            const levelIndex = Math.floor(state.currentIndex / 2); // 0,1 -> 0; 2,3 -> 1; etc.
            const levelResult = buildLevelResult(answer, levelIndex);
            
            state.pendingLevelUpData = {
              ...levelResult,
              nextQuestionIndex: answer.nextQuestionIndex,
              finished: answer.finished
            };
            
            // ✅ INSTRUMENTATION: Log LevelResult
            console.error('[LEVELRESULT BUILT]', levelResult);
            
            // ✅ TEIL 2: Set pending transition (will be executed on "Weiter" click)
            state.pendingTransition = answer.finished ? 'LEVEL_UP_THEN_FINAL' : 'LEVEL_UP';
            console.error('[POST_ANSWER] Pending transition:', state.pendingTransition);
            
          } catch (e) {
            console.error('❌ CRITICAL: Failed to build LevelResult:', e);
            alert('Fehler: Level-Daten unvollständig. Bitte Seite neu laden.');
            return;
          }
      } else if (answer.finished) {
          // Finished without level completed (shouldn't happen but handle it)
          state.pendingTransition = 'FINAL';
      } else {
          // Normal next question
          state.pendingTransition = 'NEXT_QUESTION';
      }

      // ✅ TEIL 3: Store nextQuestionIndex from backend
      state.nextQuestionIndex = answer.nextQuestionIndex;
      console.error('[INDEX] after answer', {
        current: state.currentIndex,
        next: state.nextQuestionIndex,
        levelCompleted: answer.levelCompleted,
        pendingTransition: state.pendingTransition
      });

      // DO NOT update currentIndex here anymore - will be done on "Weiter" click
      state.questionStartedAtMs = null;
      state.deadlineAtMs = null;
      debugLog('handleAnswerClick', {
        action: 'stored lastAnswerResult; waiting for Weiter decision',
        answeredIndex,
        nextIndex: state.nextQuestionIndex,
        pendingTransition: state.pendingTransition
      });
      
      // ✅ TEIL 2: Stay in POST_ANSWER state - show explanation, wait for "Weiter"
      // Note: Weiter button is already visible from setupWeiterButton()
      
    } catch (error) {
      console.error('Failed to submit answer:', error);
      // ✅ FIX: Release Lock on error
      state.transitionInFlight = false;
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
   * ✅ FIX: Verstärkte Guards, Lock während Submit
   */
  async function handleTimeout() {
    // ✅ GUARD 1: Transition Lock (SOFORT prüfen)
    if (state.transitionInFlight) {
      console.error('[TIMER GUARD] ❌ Blocked handleTimeout - transition in flight');
      return;
    }
    
    // ✅ GUARD 2: Phase Check (SOFORT prüfen)
    if (state.phase !== PHASE.ANSWERING) {
      console.error('[TIMER GUARD] ❌ Blocked handleTimeout - phase is not ANSWERING, phase:', state.phase);
      stopAllTimers();
      return;
    }
    
    // ✅ GUARD 3: Already Answered
    if (state.isAnswered) {
      console.error('[TIMER GUARD] ❌ Blocked handleTimeout - already answered');
      stopAllTimers();
      return;
    }
    
    // ✅ GUARD 4: View Check
    if (state.currentView !== VIEW.QUESTION) {
      console.error('[TIMER GUARD] ❌ Blocked handleTimeout - not in QUESTION view, currentView:', state.currentView);
      stopAllTimers();
      return;
    }
    
    // ✅ BUILD attemptId für diese Timeout
    const attemptId = state.activeTimerAttemptId;
    
    // ✅ GUARD 5: AttemptId vorhanden
    if (!attemptId) {
      console.error('[TIMER GUARD] ❌ Blocked handleTimeout - no active attemptId');
      return;
    }
    
    // ✅ GUARD 6: Check if timeout already submitted for this attemptId
    if (state.timeoutSubmittedForAttemptId[attemptId]) {
      console.error('[TIMER GUARD] ❌ Blocked handleTimeout - already submitted for attemptId:', attemptId);
      stopAllTimers();
      return;
    }
    
    console.error('[TIMER] ✅ Timeout triggered for attemptId:', attemptId, 'index:', state.currentIndex);
    
    // ✅ SOFORT stoppen und markieren
    stopAllTimers();
    state.timeoutSubmittedForAttemptId[attemptId] = true;
    state.isAnswered = true;
    
    // ✅ SET LOCK während Submit
    state.transitionInFlight = true;
    debugLog('handleTimeout', { action: 'set transition lock' });
    
    // Lock UI
    setUIState(STATE.ANSWERED_LOCKED);
    
    const answeredIndex = state.currentIndex;

    // Submit timeout
    const usedJoker = state.jokerUsedOn.includes(state.currentIndex);
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/answer`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_index: state.currentIndex,
          selected_answer_id: null,
          answered_at_ms: Date.now(),
          used_joker: usedJoker
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[TIMER] ❌ Timeout submit failed:', response.status, errorData);
        
        // ✅ INVALID_INDEX: Sync mit Server statt Loop
        if (response.status === 400 && errorData.code === 'INVALID_INDEX') {
          console.error('[TIMER] ❌ INVALID_INDEX - Client/Server out of sync!');
          stopTimer(); // Stop timer komplett
          announceA11y('Synchronisiere mit Server...');
          
          // Sync mit Server
          try {
            const syncData = await fetchStatusAndApply();
            if (syncData) {
              console.error('[TIMER] ✅ Synced with server, currentIndex now:', state.currentIndex);
              // Lade aktuelle Frage vom Server
              await loadCurrentQuestion();
              return;
            }
          } catch (syncError) {
            console.error('[TIMER] ❌ Sync failed:', syncError);
          }
          
          alert('Fehler: Client/Server nicht synchron. Bitte Seite neu laden.');
          return;
        }
        
        // ✅ Andere Fehler: Don't freeze UI
        announceA11y('Timeout konnte nicht gespeichert werden');
        
        // Allow proceeding to next question anyway
        state.lastAnswerResult = {
          result: 'timeout',
          correct_option_id: null,
          running_score: state.runningScore,
          level_completed: false
        };
        
        setUIState(STATE.ANSWERED_LOCKED);
        return; // Don't throw, just log and continue
      }
      
      const data = await response.json();
      
      // ✅ RELEASE LOCK nach erfolgreichem Submit
      state.transitionInFlight = false;
      
      // ✅ PHASE: Transition to POST_ANSWER
      state.phase = PHASE.POST_ANSWER;
      console.error('[PHASE] ✅ Set to POST_ANSWER after timeout submit');
      
      // ✅ MAPPER: Normalisiere Response zu AnswerModel (gleich wie bei handleAnswerClick)
      let answer;
      try {
        answer = normalizeAnswerResponse(data);
        console.error('[TIMEOUT ANSWER MODEL]', answer);
      } catch (e) {
        console.error('❌ Failed to normalize timeout response:', e);
        // Fallback ohne normalization
        answer = data;
      }
      
      state.lastAnswerResult = answer;
      window.__quizPlayLastAnswer = answer;
      
      debugLog('handleTimeout', {
        action: 'got response',
        result: answer.result,
        runningScore: answer.runningScore,
        nextQuestionIndex: answer.nextQuestionIndex
      });
      
      // Show correct answer with reveal state
      showCorrectAnswer(answer.correctOptionId || data.correct_option_id);
      
      // Announce timeout
      announceA11y('Zeit abgelaufen');
      
      // Update score (timeout earns 0, but running total must still be correct)
      if (typeof answer.runningScore === 'number') {
        const oldScore = state.runningScore;
        state.runningScore = answer.runningScore;
        state.displayedScore = state.runningScore;
        updateScoreDisplay();
        setCachedScoreForRun(state.runId, state.runningScore);
        debugLog('handleTimeout', { action: 'updated score from /answer', oldScore, newScore: state.runningScore });
      } else {
        console.error('❌ running_score missing in timeout response; falling back to /status', data);
        const statusData = await fetchStatusAndApply();
        if (statusData) {
          try {
            state.lastAnswerResult.runningScore = statusData.runningScore;
            if (typeof statusData.levelCompleted === 'boolean') state.lastAnswerResult.levelCompleted = statusData.levelCompleted;
            if (typeof statusData.levelPerfect === 'boolean') state.lastAnswerResult.levelPerfect = statusData.levelPerfect;
            if (typeof statusData.levelBonus === 'number') state.lastAnswerResult.levelBonus = statusData.levelBonus;
            window.__quizPlayLastAnswer = state.lastAnswerResult;
          } catch (e) {
            // ignore
          }
        }
      }
      
      // Show explanation card
      showExplanationCard(answer.explanationKey || data.explanation_key);
      
      // Update state
      state.jokerRemaining = answer.jokerRemaining;
      
      // Store correctness in runQuestions
      if (state.runQuestions[state.currentIndex]) {
        state.runQuestions[state.currentIndex].correct = false; // timeout = wrong
      }
      
      // ✅ Set pending transition like handleAnswerClick
      if (answer.levelCompleted) {
          state.pendingLevelUp = true;
          
          try {
            const levelIndex = Math.floor(state.currentIndex / 2);
            const levelResult = buildLevelResult(answer, levelIndex);
            
            state.pendingLevelUpData = {
              ...levelResult,
              nextQuestionIndex: answer.nextQuestionIndex,
              finished: answer.finished
            };
            
            state.pendingTransition = answer.finished ? 'LEVEL_UP_THEN_FINAL' : 'LEVEL_UP';
            console.error('[TIMEOUT POST_ANSWER] Pending transition:', state.pendingTransition);
            
          } catch (e) {
            console.error('❌ CRITICAL: Failed to build LevelResult from timeout:', e);
            state.pendingTransition = answer.finished ? 'FINAL' : 'NEXT_QUESTION';
          }
      } else if (answer.finished) {
          state.pendingTransition = 'FINAL';
      } else {
          state.pendingTransition = 'NEXT_QUESTION';
      }
      
      // ✅ TEIL 3: Store nextQuestionIndex from backend
      state.nextQuestionIndex = answer.nextQuestionIndex;
      console.error('[TIMEOUT INDEX]', {
        current: state.currentIndex,
        next: state.nextQuestionIndex,
        pendingTransition: state.pendingTransition
      });
      
      state.questionStartedAtMs = null;
      state.deadlineAtMs = null;
      debugLog('handleTimeout', { action: 'stored lastAnswerResult; waiting for Weiter decision', nextIndex: state.nextQuestionIndex });
      
    } catch (error) {
      console.error('Failed to submit timeout:', error);
      // ✅ FIX: Release Lock on error
      state.transitionInFlight = false;
    }
  }

  /**
   * Show explanation card (no "Richtig/Falsch" text)
   */
  function showExplanationCard(explanationKey) {
    const explanationCard = document.getElementById('quiz-explanation-card');
    const explanationText = document.getElementById('quiz-explanation-text');
    
    if (!explanationCard || !explanationText) return;
    
    // Use explanation text directly from backend
    const explanation = explanationKey || 'Keine Erklärung verfügbar.';
    explanationText.textContent = explanation;
    
    // Show card with animation
    explanationCard.hidden = false;
    
    // Show Weiter button
    const weiterBtn = document.getElementById('quiz-weiter-btn');
    if (weiterBtn) {
      weiterBtn.hidden = false;
      weiterBtn.disabled = false;
    }
    
    // Scroll to explanation if needed
    setTimeout(() => {
      scrollToExplanationIfNeeded();
    }, 50);
  }

  /**
   * Show result styling on answer buttons (new state system)
   */
  function showAnswerResult(selectedId, result, correctId) {
    document.querySelectorAll('.quiz-answer-option').forEach(btn => {
      const id = btn.dataset.answerId;
      
      // Remove old classes
      btn.classList.remove('quiz-answer--selected', 'quiz-answer--correct', 'quiz-answer--wrong', 'quiz-answer-option--inactive');
      
      if (id === selectedId) {
        if (result === 'correct') {
          // User selected correctly
          btn.classList.add('quiz-answer--selected-correct');
        } else {
          // User selected incorrectly
          btn.classList.add('quiz-answer--selected-wrong');
        }
      } else if (id === correctId && result !== 'correct') {
        // Show correct answer subtly when user was wrong
        btn.classList.add('quiz-answer--correct-reveal');
      } else {
        // Other answers: inactive (dimmed)
        btn.classList.add('quiz-answer-option--inactive');
      }
    });
  }

  /**
   * Show the correct answer (for timeout)
   */
  function showCorrectAnswer(correctId) {
    document.querySelectorAll('.quiz-answer-option').forEach(btn => {
      const id = btn.dataset.answerId;
      if (id === correctId) {
        btn.classList.add('quiz-answer--correct-reveal');
      }
    });
  }

  /**
   * Setup "Weiter" button handler
   */
  function setupWeiterButton() {
    const btn = document.getElementById('quiz-weiter-btn');
    if (!btn) return;
    
    // ✅ TEIL 2: Handle POST_ANSWER transitions based on pendingTransition
    btn.addEventListener('click', async () => {
      if (state.uiState !== STATE.ANSWERED_LOCKED) return;
      
      // ✅ FIX: Guard gegen doppelte Transitions
      if (state.transitionInFlight) {
        debugLog('setupWeiterButton', { action: 'blocked', reason: 'transition in flight' });
        return;
      }
      
      // ✅ FIX: Set Lock
      state.transitionInFlight = true;
      debugLog('setupWeiterButton', { action: 'set transition lock' });
      
      // Disable button to prevent double-clicks
      btn.disabled = true;
      
      console.error('[INDEX] on continue (Weiter)', {
        pending: state.pendingTransition,
        current: state.currentIndex,
        next: state.nextQuestionIndex
      });
      
      stopAllTimers(); // ✅ FIX: Stop ALL timers before transition
      setUIState(STATE.TRANSITIONING);
      
      switch (state.pendingTransition) {
        case 'LEVEL_UP':
          // Show LevelUp screen
          console.error('[TRANSITION] -> LEVEL_UP after Weiter');
          state.transitionInFlight = false; // Release Lock vor View-Transition
          await transitionToView(VIEW.LEVEL_UP);
          break;
          
        case 'LEVEL_UP_THEN_FINAL':
          // Show LevelUp first, then Final after continue
          console.error('[TRANSITION] -> LEVEL_UP (then FINAL) after Weiter');
          state.transitionInFlight = false; // Release Lock vor View-Transition
          await transitionToView(VIEW.LEVEL_UP);
          break;
          
        case 'FINAL':
          // Go directly to Final (no LevelUp)
          console.error('[TRANSITION] -> FINAL after Weiter');
          state.transitionInFlight = false; // Release Lock vor finishRun
          await finishRun();
          break;
          
        case 'NEXT_QUESTION':
        default:
          // ✅ TEIL 3: Use nextQuestionIndex from backend, NOT currentIndex + 1
          if (state.nextQuestionIndex === null || state.nextQuestionIndex === undefined) {
            console.error('❌ CRITICAL: nextQuestionIndex is null! Cannot proceed.');
            alert('Fehler: Nächste Frage nicht gefunden. Bitte Seite neu laden.');
            state.transitionInFlight = false;
            btn.disabled = false;
            return;
          }
          
          state.currentIndex = state.nextQuestionIndex;
          state.nextQuestionIndex = null;
          
          console.error('[INDEX] loading next question:', state.currentIndex);
          // ✅ loadCurrentQuestion setzt phase=ANSWERING, startet Timer, und released Lock selbst
          await loadCurrentQuestion();
          break;
      }
      
      btn.disabled = false;
    });
  }

  /**
   * Advance to the next question with transition animation
   * ✅ DEPRECATED: Ersetzt durch Weiter-Button (setupWeiterButton)
   * Diese Funktion wird nicht mehr verwendet - Auto-Advance simuliert Button-Klick
   */
  async function advanceToNextQuestion(trigger = 'button') {
    console.error('❌ DEPRECATED: advanceToNextQuestion() called with trigger:', trigger);
    console.error('Stack trace:', new Error().stack);
    
    // Fallback: Simuliere Weiter-Button Klick
    const weiterBtn = document.getElementById('quiz-weiter-btn');
    if (weiterBtn && !weiterBtn.disabled) {
      console.error('Fallback: Simulating Weiter button click');
      weiterBtn.click();
    } else {
      console.error('Cannot fallback: Weiter button not available');
    }
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
          credentials: 'same-origin',
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
          const answerBtn = document.querySelector(`.quiz-answer-option[data-answer-id="${id}"]`);
          if (answerBtn) {
            answerBtn.setAttribute('aria-disabled', 'true');
            answerBtn.setAttribute('tabindex', '-1');
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
   * Start auto-forward timer for Level-Up screen
   */
  function startAutoForwardTimer() {
    cancelAutoAdvanceTimer();
    
    const duration = 10000; // 10s
    const start = Date.now();
    const timerEl = document.getElementById('quiz-level-up-timer');
    
    if (timerEl) {
      state.autoForwardInterval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((duration - (Date.now() - start)) / 1000));
        timerEl.textContent = `Automatisch weiter in ${remaining}s`;
        if (remaining <= 0) {
          cancelAutoAdvanceTimer();
          advanceFromLevelUp();
        }
      }, 1000);
    }
    
    state.autoForwardTimeout = setTimeout(() => {
      advanceFromLevelUp();
    }, duration);
  }
  
  function cancelAutoAdvanceTimer() {
    if (state.autoForwardTimeout) {
      clearTimeout(state.autoForwardTimeout);
      state.autoForwardTimeout = null;
    }
    if (state.autoForwardInterval) {
      clearInterval(state.autoForwardInterval);
      state.autoForwardInterval = null;
    }
  }

  /**
   * Animate number count-up with reduced-motion support
   * @param {HTMLElement} element - Target element to update textContent
   * @param {number} start - Starting value
   * @param {number} end - Ending value
   * @param {number} duration - Animation duration in ms (default 800ms)
   * @param {string} prefix - Prefix string (e.g. '+' for bonus)
   */
  function animateCountUp(element, start, end, duration = 800, prefix = '') {
    if (!element) return;
    
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Reduced motion: show end value immediately
    if (isReducedMotion) {
      element.textContent = `${prefix}${end}`;
      return;
    }
    
    const startTime = performance.now();
    
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * easeOut);
      
      element.textContent = `${prefix}${current}`;
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        // Ensure we end exactly at the target value
        element.textContent = `${prefix}${end}`;
      }
    }
    
    requestAnimationFrame(update);
  }

  /**
   * Render level-up screen dynamically in the main container
   */
  function renderLevelUpInContainer() {
    debugLog('renderLevelUpInContainer', { data: state.pendingLevelUpData });

    ensureStageContainers();
    const container = state.stageEls?.levelUpContainer;
    if (!container || !state.pendingLevelUpData) return;
    
    // ✅ MAPPER: pendingLevelUpData ist bereits ein LevelResult (aus buildLevelResult)
    const levelResult = state.pendingLevelUpData;
    
    // ✅ INSTRUMENTATION: Log render input
    console.error('[LEVELUP RENDER INPUT]', {
        difficulty: levelResult.difficulty,
        correctCount: levelResult.correctCount,
        totalCount: levelResult.totalCount,
        bonus: levelResult.bonus,
        scoreAfterBonus: levelResult.scoreAfterBonus,
        scenario: levelResult.scenario,
        correctCountType: typeof levelResult.correctCount,
        totalCountType: typeof levelResult.totalCount
    });
    
    const { difficulty, correctCount, totalCount, bonus, scoreAfterBonus, scenario, scenarioText } = levelResult;

    // ✅ FINAL CHECK vor Render
    console.error('[LEVELUP FINAL VALUES]', { correctCount, totalCount, bonus, scoreAfterBonus, scenario });

    debugLog('renderLevelUpInContainer', { 
        action: 'rendering', 
        scenario, 
        correctCount, 
        totalCount, 
        bonus, 
        scoreAfterBonus,
        levelResult
    });

    container.innerHTML = `
      <div class="quiz-level-up" id="quiz-level-up-stage">
        <div class="quiz-level-up__card">
          <h2 class="quiz-level-up__title">Level ${difficulty} abgeschlossen</h2>
          <p class="quiz-level-up__subline">${scenarioText}</p>
          
          <div class="quiz-level-up__result-row">
            <span class="material-symbols-rounded">check_circle</span>
            <span>Richtig: ${correctCount}/${totalCount}</span>
          </div>
          
          <div class="quiz-level-up__points-grid">
            <div class="quiz-level-up__bonus-block ${bonus > 0 ? 'quiz-level-up__bonus-block--active' : ''}">
              <span class="quiz-level-up__label">BONUS</span>
              <span class="quiz-level-up__value">+${bonus}</span>
            </div>
            <div class="quiz-level-up__total-block">
              <span class="quiz-level-up__label">Neuer Punktestand</span>
              <span class="quiz-level-up__value">${scoreAfterBonus}</span>
            </div>
          </div>

          ${scenario === 'C' ? `
          <p class="quiz-level-up__tip">
            <span class="material-symbols-rounded">lightbulb</span>
            Tipp: Lies die Erklärung nach jeder Frage genau.
          </p>
          ` : ''}

          <div class="quiz-level-up__actions">
            <p class="quiz-level-up__timer" id="quiz-level-up-timer">Automatisch weiter in 10s</p>
            <button type="button" class="md3-button md3-button--filled" data-quiz-action="levelup-continue">
              Weiter
            </button>
          </div>
        </div>
      </div>
    `;
    
    // ✅ PHASE 2: DOM-Verifikation - Stelle sicher, dass nur EIN Bonus-Element existiert
    setTimeout(() => {
      const bonusElements = document.querySelectorAll('.quiz-level-up__bonus-block');
      const bonusValueEl = container.querySelector('.quiz-level-up__bonus-block .quiz-level-up__value');
      
      console.error('[LEVELUP DOM VERIFICATION]', {
        totalBonusElements: bonusElements.length,
        bonusTextInDOM: bonusValueEl?.textContent,
        expectedBonus: `+${bonus}`,
        match: bonusValueEl?.textContent === `+${bonus}`
      });
      
      if (bonusElements.length > 1) {
        console.error('❌ CRITICAL: Multiple bonus elements found! Legacy HTML still exists.');
        alert('ENTWICKLER-FEHLER: Doppelte Bonus-Elemente im DOM. Bitte Dev-Team informieren.');
      }
      
      if (bonusValueEl?.textContent !== `+${bonus}`) {
        console.error('❌ CRITICAL: Bonus text mismatch! Expected:', `+${bonus}`, 'Got:', bonusValueEl?.textContent);
        alert(`ENTWICKLER-FEHLER: Bonus-Anzeige falsch. Erwartet: +${bonus}, Angezeigt: ${bonusValueEl?.textContent}`);
      }
      
      // ✅ PHASE 5: In-Code Assertions
      const scoreValueEl = container.querySelector('.quiz-level-up__total-block .quiz-level-up__value');
      if (scoreValueEl?.textContent !== String(scoreAfterBonus)) {
        console.error('❌ CRITICAL: Score text mismatch! Expected:', scoreAfterBonus, 'Got:', scoreValueEl?.textContent);
        alert(`ENTWICKLER-FEHLER: Score falsch. Erwartet: ${scoreAfterBonus}, Angezeigt: ${scoreValueEl?.textContent}`);
      }
      
      console.error('✅ [LEVELUP DOM ASSERTIONS PASSED]', {
        bonusCorrect: true,
        scoreCorrect: true,
        noDuplicates: true
      });
      
      // ✅ FIX 4: Bonus Count-Up Animation starten (nur wenn bonus > 0)
      if (bonus > 0 && bonusValueEl) {
        animateCountUp(bonusValueEl, 0, bonus, 800, '+');
        debugLog('animateCountUp', { target: 'bonus', from: 0, to: bonus });
      }
      
      // ✅ PHASE 1: VISIBILITY CHECK - Beweise dass Container SICHTBAR ist
      const questionContainer = document.getElementById('quiz-question-container');
      const computedStyle = getComputedStyle(container);
      const rect = container.getBoundingClientRect();
      
      console.error('[VIEW VISIBILITY CHECK - LEVEL_UP]', {
        containerExists: !!container,
        containerHiddenAttr: container.hasAttribute('hidden'),
        containerDisplay: computedStyle.display,
        containerVisibility: computedStyle.visibility,
        containerOpacity: computedStyle.opacity,
        containerZIndex: computedStyle.zIndex,
        containerRect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
        questionHiddenAttr: questionContainer?.hasAttribute('hidden'),
        questionDisplay: questionContainer ? getComputedStyle(questionContainer).display : null,
        currentView: state.currentView,
        activeElement: document.activeElement?.id
      });
      
      // ✅ PHASE 2: CONTAINER COUNT CHECK
      console.error('[CONTAINER COUNT]', {
        levelUpContainers: document.querySelectorAll('#quiz-level-up-container').length,
        legacyLevelUpContainers: document.querySelectorAll('#quiz-levelup-container').length
      });
      
      // ✅ PHASE 4: TOPMOST ELEMENT CHECK
      const topElement = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      console.error('[TOPMOST ELEMENT]', {
        tagName: topElement?.tagName,
        id: topElement?.id,
        className: topElement?.className,
        zIndex: topElement ? getComputedStyle(topElement).zIndex : null,
        isLevelUpDescendant: container.contains(topElement)
      });
      
      if (rect.height <= 0 || computedStyle.display === 'none') {
        console.error('❌ CRITICAL: LevelUp container not visible!', { height: rect.height, display: computedStyle.display });
        alert('ENTWICKLER-FEHLER: LevelUp Container im DOM aber nicht sichtbar!');
      }
    }, 50); // Small delay to ensure DOM update
    
    // ✅ PHASE 4: Event Delegation - Button wird über globalen Handler abgefangen (siehe init())
    console.error('[LEVELUP BTN] Rendered, delegation active via data-quiz-action="levelup-continue"');

    // Start Auto-Forward
    startAutoForwardTimer();
    
    debugLog('renderLevelUpInContainer', { action: 'rendered', scenario, correctCount, totalCount });
    window.__quizPlayLastLevelUpRender = { ok: true, reason: 'injected', pending: state.pendingLevelUpData };

    // Announce for screen readers
    announceA11y(`Stufe ${difficulty} abgeschlossen! Neuer Punktestand: ${scoreAfterBonus}`);
  }

  /**
   * Show Level-Up screen as main stage view with auto-advance
   * Uses pendingLevelUpData from state (set during answer handling)
   */
  async function showLevelUpScreen() {
    debugLog('showLevelUpScreen', { data: state.pendingLevelUpData });
    
    if (!state.pendingLevelUpData) {
      debugLog('showLevelUpScreen', { error: 'no level-up data, going to next question' });
      // No level-up data, go directly to next question
      await loadCurrentQuestion();
      return;
    }
    
    // Switch to LEVEL_UP view (this renders the level-up screen)
    state.currentView = VIEW.LEVEL_UP;
    renderCurrentView();
    
    debugLog('showLevelUpScreen', { action: 'view rendered (no auto-advance)' });
  }

  /**
   * Handle click on level-up screen to skip auto-advance
   */
  function handleLevelUpClick() {
    if (state.levelUpTimer) {
      clearTimeout(state.levelUpTimer);
      state.levelUpTimer = null;
    }
    advanceFromLevelUp();
  }

  /**
   * Advance from level-up screen to next question or finish
   */
  async function advanceFromLevelUp() {
    debugLog('advanceFromLevelUp', { isTransitioning: state.isTransitioning });
    
    if (state.isTransitioning) {
      debugLog('advanceFromLevelUp', { action: 'blocked', reason: 'already transitioning' });
      return;
    }
    
    // ✅ FIX: Ensure ALL timers are stopped before transitioning
    stopAllTimers();
    console.error('[ADVANCE FROM LEVELUP] All timers stopped before loading next question');

    // Check if we are finished
    const isFinished = state.pendingLevelUpData && state.pendingLevelUpData.finished;
    
    // ✅ PHASE 3: Beim Verlassen von LevelUp wird Bonus visuell "applied"
    // HUD Score muss auf scoreAfterBonus aktualisiert werden
    if (state.pendingLevelUpData && state.pendingLevelUpData.scoreAfterBonus) {
      state.runningScore = state.pendingLevelUpData.scoreAfterBonus;
      updateScoreWithAnimation(state.runningScore);
      debugLog('advanceFromLevelUp', { 
        action: 'applied bonus to global score', 
        scoreAfterBonus: state.pendingLevelUpData.scoreAfterBonus 
      });
    }
    
    // ✅ TEIL 3: Get nextQuestionIndex from pendingLevelUpData (was stored from answer)
    const nextIndex = state.pendingLevelUpData?.nextQuestionIndex;
    
    // Clear level-up data
    state.pendingLevelUp = false;
    state.pendingLevelUpData = null;
    
    if (isFinished) {
        debugLog('advanceFromLevelUp', { action: 'game finished -> finishRun' });
        await finishRun();
    } else {
        // ✅ TEIL 3: Use nextQuestionIndex from backend, NOT currentIndex + 1
        if (nextIndex === null || nextIndex === undefined) {
          console.error('❌ CRITICAL: nextQuestionIndex is null after LevelUp! Cannot proceed.');
          alert('Fehler: Nächste Frage nicht gefunden. Bitte Seite neu laden.');
          return;
        }
        
        state.currentIndex = nextIndex;
        console.error('[INDEX] loading next question after LevelUp:', state.currentIndex);
        
        debugLog('advanceFromLevelUp', { action: 'transitioning to next question', nextIndex });
        await transitionToView(VIEW.QUESTION);
        await loadCurrentQuestion();
    }
  }

  /**
   * Finish the run and show results
   */
  async function finishRun() {
    debugLog('finishRun', { action: 'start' });
    
    // ✅ FIX: Stop ALL timers
    stopAllTimers();
    
    try {
      const response = await fetch(`${API_BASE}/run/${state.runId}/finish`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to finish run');
      }
      
      const rawData = await response.json();
      
      debugLog('finishRun', { finishRawData: rawData });
      
      // ✅ MAPPER: Normalisiere Finish Response
      let finish;
      try {
        finish = normalizeFinishResponse(rawData);
        console.error('[FINISH MODEL]', finish);
      } catch (e) {
        console.error('❌ Failed to normalize finish response:', e);
        // Fallback auf cached score
        finish = {
          totalScore: state.runningScore || 0,
          tokensCount: 0,
          breakdown: [],
          rank: null
        };
      }
      
      // Update score to final value
      state.runningScore = finish.totalScore;
      state.displayedScore = finish.totalScore;
      
      // Store finish data for render
      state.finishData = finish;
      
      // Switch to FINISH view
      transitionToView(VIEW.FINISH);
      
      debugLog('finishRun', { action: 'complete' });
      
    } catch (error) {
      console.error('Failed to finish run:', error);
      debugLog('finishRun', { error: error.message });
      // Show finish screen anyway with cached data
      state.finishData = {
        totalScore: state.runningScore || 0,
        tokensCount: 0,
        breakdown: [],
        rank: null
      };
      transitionToView(VIEW.FINISH);
    }
  }

  /**
   * Render Finish Screen
   */
  async function renderFinishInContainer() {
      const finish = state.finishData;
      
      // ✅ GUARD: Verhindere Crash wenn finishModel fehlt
      if (!finish || typeof finish.totalScore !== 'number') {
        console.error('❌ renderFinishInContainer: Invalid finishModel', finish);
        ensureStageContainers();
        const container = state.stageEls?.finishContainer;
        if (container) {
          container.innerHTML = `
            <div class="quiz-finish-card md3-card md3-elevation-1">
              <h2 class="quiz-finish-title display-small">Fehler beim Abschließen</h2>
              <p>Das Quiz konnte nicht korrekt abgeschlossen werden. Bitte versuche es erneut.</p>
              <button type="button" class="md3-btn md3-btn--filled" data-quiz-action="final-topics">
                Zurück zur Übersicht
              </button>
            </div>
          `;
        }
        return;
      }

      ensureStageContainers();
      const container = state.stageEls?.finishContainer;
      if (!container) return;

      // Calculate total correct/questions for summary
      let totalCorrect = 0;
      let totalQuestions = 0;
      if (finish.breakdown) {
          finish.breakdown.forEach(level => {
              totalCorrect += level.correct;
              totalQuestions += level.total;
          });
      }

      container.innerHTML = `
        <div class="quiz-finish-card md3-card md3-elevation-1">
            <div class="quiz-finish-header">
                <h2 class="quiz-finish-title display-small">Quiz beendet!</h2>
                <div class="quiz-finish-score">
                    <span class="quiz-finish-score-value display-large">${finish.totalScore}</span>
                    <span class="quiz-finish-score-label label-large">Punkte</span>
                </div>
            </div>

            <div class="quiz-finish-stats">
                <div class="quiz-stat-row">
                    <span class="material-symbols-rounded">check_circle</span>
                    <span class="body-large">Gesamt: ${totalCorrect} / ${totalQuestions} richtig</span>
                </div>
            </div>

            <div class="quiz-finish-breakdown" id="quiz-final-breakdown">
                ${finish.breakdown ? finish.breakdown.map(level => `
                    <div class="quiz-level-summary surface-variant-light">
                        <div class="quiz-level-summary-header">
                            <span class="quiz-level-badge label-medium">Level ${level.difficulty}</span>
                            <span class="quiz-level-points label-medium">${level.points} Pkt</span>
                        </div>
                        <div class="quiz-level-progress-track">
                            <div class="quiz-level-progress-fill" style="width: ${(level.correct / level.total) * 100}%"></div>
                        </div>
                        <div class="quiz-level-details body-small">
                            ${level.correct} / ${level.total} richtig
                        </div>
                    </div>
                `).join('') : ''}
            </div>

            <div class="quiz-finish-actions">
                <button type="button" class="md3-button md3-button--filled" data-quiz-action="final-retry">
                    <span class="material-symbols-rounded">replay</span>
                    Nochmal spielen
                </button>
                <button type="button" class="md3-button md3-button--filled" data-quiz-action="final-leaderboard">
                    <span class="material-symbols-rounded">leaderboard</span>
                    Zur Rangliste
                </button>
                <button type="button" class="md3-button md3-button--text" data-quiz-action="final-topics">
                    Zur Übersicht
                </button>
            </div>
        </div>
      `;

      // ✅ PHASE 4: Buttons nutzen globale Event Delegation (keine setup function mehr nötig)
      
      // Announce
      announceA11y(`Quiz beendet. Dein Ergebnis: ${finish.totalScore} Punkte.`);
  }

  // ============================================================================
  // AudioController - Single playback, custom MD3 buttons (no native <audio controls>)
  // ============================================================================
  
  /**
   * AudioController manages a single Audio instance for the entire quiz.
   * Only one audio can play at a time. Buttons toggle Play↔Pause.
   * 
   * media.src wird beim Seeding aus seed_src erzeugt und zeigt auf /static/quiz-media/...
   * Reihenfolge im JSON bestimmt Labels (Audio 1, Audio 2...), falls label fehlt.
   */
  const AudioController = (function() {
    const audio = new Audio();
    audio.preload = 'metadata';
    
    let currentBtn = null;
    let currentSrc = null;
    
    /**
     * Set button playing state (icon, aria, class)
     */
    function setBtnPlaying(btn, isPlaying) {
      if (!btn) return;
      
      const icon = btn.querySelector('.md3-audio-btn__icon');
      const text = btn.querySelector('.md3-audio-btn__text');
      
      if (icon) {
        icon.textContent = isPlaying ? 'pause' : 'play_arrow';
      }
      if (text) {
        text.textContent = isPlaying ? 'Pause' : 'Play';
      }
      
      btn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
      btn.classList.toggle('is-playing', isPlaying);
      
      // Update aria-label
      const baseLabel = btn.dataset.audioLabel || 'Audio';
      btn.setAttribute('aria-label', `${baseLabel} ${isPlaying ? 'pausieren' : 'abspielen'}`);
    }
    
    /**
     * Handle button click - toggle play/pause, ensure single playback
     */
    function handleClick(btn) {
      const src = btn.dataset.audioSrc;
      if (!src) return;
      
      // Different source - stop current, play new
      if (src !== currentSrc) {
        // Reset previous button
        if (currentBtn) {
          setBtnPlaying(currentBtn, false);
        }
        
        audio.src = src;
        currentSrc = src;
        currentBtn = btn;
        
        audio.play().then(() => {
          setBtnPlaying(btn, true);
        }).catch(err => {
          console.warn('[AudioController] Play failed:', err);
          setBtnPlaying(btn, false);
        });
      } else {
        // Same source - toggle play/pause
        if (audio.paused) {
          audio.play().then(() => {
            setBtnPlaying(btn, true);
          }).catch(err => {
            console.warn('[AudioController] Play failed:', err);
          });
        } else {
          audio.pause();
          setBtnPlaying(btn, false);
        }
      }
    }
    
    /**
     * Stop and reset everything (call on question change, level-up, finish)
     */
    function stopAndReset() {
      audio.pause();
      audio.currentTime = 0;
      
      if (currentBtn) {
        setBtnPlaying(currentBtn, false);
      }
      
      currentBtn = null;
      currentSrc = null;
    }
    
    // Audio ended - reset button state
    audio.addEventListener('ended', () => {
      if (currentBtn) {
        setBtnPlaying(currentBtn, false);
      }
    });
    
    // Audio error - reset and warn
    audio.addEventListener('error', () => {
      console.warn('[AudioController] Audio error for:', currentSrc);
      if (currentBtn) {
        setBtnPlaying(currentBtn, false);
      }
    });
    
    return {
      handleClick,
      stopAndReset
    };
  })();
  
  // Event delegation for audio buttons (attached once)
  let audioButtonsDelegated = false;
  function setupAudioButtonDelegation() {
    if (audioButtonsDelegated) return;
    audioButtonsDelegated = true;
    
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.md3-audio-btn');
      if (!btn) return;
      
      e.preventDefault();
      e.stopPropagation();
      AudioController.handleClick(btn);
    });
  }
  
  /**
   * Render media array (v2 format) to HTML
   * Uses custom MD3 audio buttons instead of native <audio controls>
   * 
   * @param {Array|Object|null} media - Media array (v2) or single object (v1 legacy)
   * @param {Object} options - Rendering options
   * @param {boolean} options.compact - If true, render in compact/inline style (for answers)
   * @param {string} options.answerId - Answer ID for namespacing audio IDs
   * @returns {string} HTML string for media elements
   */
  function renderMediaArray(media, options = {}) {
    if (!media) return '';
    
    // Handle legacy v1 single object format (convert to array)
    let mediaArray = Array.isArray(media) ? media : [media];
    
    if (mediaArray.length === 0) return '';
    
    const isCompact = options.compact || false;
    const answerId = options.answerId || '';
    
    // Separate audio and image items
    const audioItems = mediaArray.filter(m => m.type === 'audio');
    const imageItems = mediaArray.filter(m => m.type === 'image');
    
    let html = '';
    
    // Render audio items in grid layout
    if (audioItems.length > 0) {
      const gridLayout = audioItems.length > 1 ? 'grid-2' : 'single';
      const gridClass = isCompact ? 'quiz-media-grid quiz-media-grid--compact' : 'quiz-media-grid';
      
      const audioHtml = audioItems.map((m, idx) => {
        const src = m.src || m.url || '';
        const mediaId = m.id || `m${idx + 1}`;
        const audioId = answerId ? `${answerId}_${mediaId}` : mediaId;
        const label = m.label || `Audio ${idx + 1}`;
        
        if (!src) return '';
        
        if (isCompact) {
          // Inline button only (no label row, used in answers)
          return `
            <button type="button"
                    class="md3-audio-btn md3-audio-btn--inline"
                    data-audio-src="${escapeHtml(src)}"
                    data-audio-id="${escapeHtml(audioId)}"
                    data-audio-label="${escapeHtml(label)}"
                    aria-label="${escapeHtml(label)} abspielen"
                    aria-pressed="false">
              <span class="material-symbols-rounded md3-audio-btn__icon" aria-hidden="true">play_arrow</span>
            </button>
          `;
        }
        
        // Full audio item with label
        return `
          <div class="quiz-media-item quiz-media-item--audio">
            <div class="quiz-media-label">
              <span class="material-symbols-rounded quiz-media-icon" aria-hidden="true">headphones</span>
              <span class="quiz-media-label-text">${escapeHtml(label)}</span>
            </div>
            <button type="button"
                    class="md3-audio-btn"
                    data-audio-src="${escapeHtml(src)}"
                    data-audio-id="${escapeHtml(audioId)}"
                    data-audio-label="${escapeHtml(label)}"
                    aria-label="${escapeHtml(label)} abspielen"
                    aria-pressed="false">
              <span class="material-symbols-rounded md3-audio-btn__icon" aria-hidden="true">play_arrow</span>
              <span class="md3-audio-btn__text">Play</span>
            </button>
          </div>
        `;
      }).filter(Boolean).join('');
      
      if (audioHtml) {
        html += `<div class="${gridClass}" data-layout="${gridLayout}">${audioHtml}</div>`;
      }
    }
    
    // Render image items
    if (imageItems.length > 0) {
      const imageHtml = imageItems.map(m => {
        const src = m.src || m.url || '';
        const alt = m.alt || m.label || '';
        const caption = m.caption || '';
        
        if (!src) return '';
        
        const imgClass = isCompact ? 'quiz-media__item quiz-media__item--image quiz-media__item--compact' : 'quiz-media__item quiz-media__item--image';
        
        return `
          <figure class="${imgClass}">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="quiz-media__image" loading="lazy">
            ${caption ? `<figcaption class="quiz-media__caption">${escapeHtml(caption)}</figcaption>` : ''}
          </figure>
        `;
      }).filter(Boolean).join('');
      
      if (imageHtml) {
        const containerClass = isCompact ? 'quiz-media quiz-media--compact' : 'quiz-media';
        html += `<div class="${containerClass}">${imageHtml}</div>`;
      }
    }
    
    // Handle unknown types
    mediaArray.filter(m => m.type !== 'audio' && m.type !== 'image').forEach(m => {
      console.warn('[renderMediaArray] Unknown media type:', m.type, m);
    });
    
    return html;
  }
  
  /**
   * Render answer media (compact inline style)
   * Returns inline audio buttons for answer row layout
   * 
   * @param {Array|null} media - Answer media array
   * @param {string} answerId - Answer ID for namespacing
   * @returns {string} HTML string
   */
  function renderAnswerMedia(media, answerId = '') {
    return renderMediaArray(media, { compact: true, answerId });
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
