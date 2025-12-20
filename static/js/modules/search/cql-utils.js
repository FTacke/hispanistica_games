/**
 * CQL (Corpus Query Language) Utilities
 *
 * Helper functions for escaping and building CQL patterns.
 * Used by advanced search form validation.
 */

/**
 * Escape special CQL characters
 * @param {string} text - Raw input text
 * @returns {string} CQL-safe escaped string
 */
export function escapeCQL(text) {
  if (typeof text !== "string") return "";

  // Order matters: backslash first, then quotes, then brackets
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

/**
 * Tokenize query string (whitespace-separated)
 * @param {string} query - Query string
 * @returns {string[]} Array of tokens
 */
export function tokenize(query) {
  if (typeof query !== "string") return [];

  return query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Quote a string for CQL (wrap in double quotes, escaped)
 * @param {string} text - Text to quote
 * @returns {string} Quoted string, e.g., "México"
 */
export function quoteString(text) {
  return `"${escapeCQL(text)}"`;
}

/**
 * Validate query before submission
 * @param {string} query - User input
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateQuery(query) {
  if (!query || query.trim().length === 0) {
    return { valid: false, error: "La consulta no puede estar vacía" };
  }

  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return { valid: false, error: "La consulta no contiene tokens válidos" };
  }

  return { valid: true };
}

/**
 * Build CQL preview (client-side, simplified)
 * @param {Object} params - Form parameters
 * @param {string} params.q - Query
 * @param {string} params.mode - Mode (forma, forma_exacta, lemma)
 * @param {boolean} params.ci - Case insensitive
 * @param {boolean} params.da - Diacritics agnostic
 * @param {string} params.pos - POS tags (comma-separated)
 * @returns {string} CQL pattern preview
 */
export function buildCQLPreview(params) {
  const tokens = tokenize(params.q || "");
  if (tokens.length === 0) return "";

  const mode = params.mode || "forma";
  const ci = params.ci || false;
  const da = params.da || false;
  const posList = (params.pos || "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p);

  const cqlTokens = tokens.map((token, i) => {
    let field, value;

    if (mode === "forma_exacta") {
      field = "word";
      value = token;
    } else if (mode === "lemma") {
      field = "lemma";
      value = token.toLowerCase();
    } else {
      // forma
      if (ci || da) {
        field = "norm";
        value = token.toLowerCase();
      } else {
        field = "word";
        value = token;
      }
    }

    let constraint = `${field}=${quoteString(value)}`;

    // Add POS if available
    if (posList[i]) {
      constraint += ` & pos=${quoteString(posList[i].toUpperCase())}`;
    }

    return `[${constraint}]`;
  });

  return cqlTokens.join(" ");
}

// Attach to window for global access (if needed)
if (typeof window !== "undefined") {
  window.CQLUtils = {
    escapeCQL,
    tokenize,
    quoteString,
    validateQuery,
    buildCQLPreview,
  };
}
