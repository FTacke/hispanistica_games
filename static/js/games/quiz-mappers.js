/**
 * Quiz API Response Mappers
 * 
 * Zentrale Stelle für API Response → UI Model Transformationen.
 * Backend liefert snake_case, Frontend nutzt camelCase.
 * 
 * PRINZIPIEN:
 * - Backend ist Source of Truth
 * - Keine Defaults/Fallbacks (außer explizit dokumentiert)
 * - Fehlende Pflichtfelder werfen Fehler
 * - Mapper sind dumm: nur Typ-Transformation, keine Logik
 */

/**
 * @typedef {Object} AnswerModel
 * @property {string} result - "correct"|"incorrect"|"timeout"
 * @property {boolean} isCorrect
 * @property {number} correctOptionId
 * @property {string} explanationKey
 * @property {number|null} nextQuestionIndex
 * @property {boolean} finished
 * @property {number} jokerRemaining
 * @property {number} earnedPoints
 * @property {number} runningScore - Score NACH dieser Frage (inkl. Fragepunkte, OHNE Levelbonus)
 * @property {boolean} levelCompleted
 * @property {boolean} levelPerfect
 * @property {number} levelBonus - Bonus für perfektes Level (0 wenn nicht perfect)
 * @property {boolean} bonusAppliedNow
 * @property {number} difficulty
 * @property {number} levelCorrectCount
 * @property {number} levelQuestionsInLevel
 * @property {*} raw - Original Response für Debugging
 */

/**
 * Normalisiert /answer API Response
 * @param {Object} raw - snake_case API Response
 * @returns {AnswerModel}
 * @throws {Error} wenn Pflichtfelder fehlen
 */
export function normalizeAnswerResponse(raw) {
  // Pflichtfelder prüfen
  const required = [
    'result', 'is_correct', 'correct_option_id', 'explanation_key',
    'joker_remaining', 'earned_points', 'running_score', 'difficulty'
  ];
  
  const missing = required.filter(field => raw[field] === undefined);
  if (missing.length > 0) {
    const error = `❌ normalizeAnswerResponse: Missing required fields: ${missing.join(', ')}`;
    console.error(error, raw);
    throw new Error(error);
  }
  
  // Level-Felder nur bei level_completed validieren
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
 * @typedef {Object} LevelResult
 * @property {number} levelIndex
 * @property {number} difficulty
 * @property {number} correctCount
 * @property {number} totalCount
 * @property {number} bonus
 * @property {number} scoreAfterQuestions - Score ohne Bonus (nur Fragenpunkte)
 * @property {number} scoreAfterBonus - Score inkl. Bonus (für LevelUp Display)
 * @property {"A"|"B"|"C"} scenario
 * @property {string} scenarioText
 */

/**
 * Baut LevelResult aus AnswerModel
 * @param {AnswerModel} answer
 * @param {number} levelIndex
 * @returns {LevelResult}
 * @throws {Error} wenn Level-Daten inkonsistent
 */
export function buildLevelResult(answer, levelIndex) {
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
  let scenario;
  let scenarioText;
  
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
  // runningScore = score nach Fragenpunkten + Bonus (wenn perfect)
  // Für UI wollen wir differenzieren:
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
 * @typedef {Object} FinishModel
 * @property {number} totalScore
 * @property {number} tokensCount
 * @property {Array} breakdown
 * @property {number|null} rank
 * @property {*} raw
 */

/**
 * Normalisiert /finish API Response
 * @param {Object} raw
 * @returns {FinishModel}
 */
export function normalizeFinishResponse(raw) {
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
 * @typedef {Object} StatusModel
 * @property {string} runId
 * @property {string} topicId
 * @property {string} status
 * @property {number} currentIndex
 * @property {number} runningScore
 * @property {number|null} nextQuestionIndex
 * @property {boolean} finished
 * @property {number} jokerRemaining
 * @property {boolean} levelCompleted
 * @property {boolean} levelPerfect
 * @property {number} levelBonus
 * @property {number} levelCorrectCount
 * @property {number} levelQuestionsInLevel
 * @property {*} raw
 */

/**
 * Normalisiert /status API Response
 * @param {Object} raw
 * @returns {StatusModel}
 */
export function normalizeStatusResponse(raw) {
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

/**
 * Guard: Wirft Fehler wenn AnswerModel Felder fehlen/falsch sind
 * @param {AnswerModel} answer
 * @throws {Error}
 */
export function assertAnswerModel(answer) {
  const required = ['result', 'runningScore', 'difficulty'];
  const missing = required.filter(field => answer[field] === undefined);
  
  if (missing.length > 0) {
    const error = `❌ assertAnswerModel: Missing fields: ${missing.join(', ')}`;
    console.error(error, answer);
    throw new Error(error);
  }
  
  if (answer.levelCompleted) {
    const levelReq = ['levelCorrectCount', 'levelQuestionsInLevel'];
    const missingLevel = levelReq.filter(field => typeof answer[field] !== 'number');
    if (missingLevel.length > 0) {
      const error = `❌ assertAnswerModel: levelCompleted=true but invalid: ${missingLevel.join(', ')}`;
      console.error(error, answer);
      throw new Error(error);
    }
  }
}

/**
 * Guard: Wirft Fehler wenn LevelResult Felder fehlen/falsch sind
 * @param {LevelResult} levelResult
 * @throws {Error}
 */
export function assertLevelResult(levelResult) {
  const required = ['correctCount', 'totalCount', 'bonus', 'scoreAfterBonus', 'scenario'];
  const missing = required.filter(field => levelResult[field] === undefined);
  
  if (missing.length > 0) {
    const error = `❌ assertLevelResult: Missing fields: ${missing.join(', ')}`;
    console.error(error, levelResult);
    throw new Error(error);
  }
  
  if (typeof levelResult.correctCount !== 'number' || typeof levelResult.totalCount !== 'number') {
    const error = `❌ assertLevelResult: correctCount/totalCount must be numbers`;
    console.error(error, levelResult);
    throw new Error(error);
  }
}

/**
 * Guard: Wirft Fehler wenn FinishModel ungültig
 * @param {FinishModel} finish
 * @throws {Error}
 */
export function assertFinishModel(finish) {
  if (typeof finish.totalScore !== 'number') {
    const error = `❌ assertFinishModel: totalScore must be a number`;
    console.error(error, finish);
    throw new Error(error);
  }
}
