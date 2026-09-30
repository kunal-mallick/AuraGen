/**
 * USER STATE  (Step 3)
 * Cleans the user's current input values and turns the cognitive load
 * score into a level the prompt can use.
 */
const { collectFields } = require('./domState');

// TODO(team): replace with friction/thresholds.js once that file exists.
const THRESHOLDS = { medium: 0.4, high: 0.7 };

function cognitiveLoadLevel(score) {
  if (score >= THRESHOLDS.high) return 'high';
  if (score >= THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Keep only values for fields that exist in the current UI, and never send
 * sensitive fields (password) to the LLM.
 * The backend re-injects the real values after generation (Step 7), so the
 * LLM only needs to keep each field's `name`.
 */
function normalizeUserState(userState, currentUi) {
  const fields = collectFields(currentUi.root);
  const known = new Set(fields.map((f) => f.name));
  const sensitiveFields = fields.filter((f) => f.inputType === 'password').map((f) => f.name);

  const userValues = {};
  const ignoredKeys = [];
  for (const [key, val] of Object.entries(userState || {})) {
    if (!known.has(key)) ignoredKeys.push(key);
    else if (!sensitiveFields.includes(key)) userValues[key] = val;
  }
  return { userValues, sensitiveFields, ignoredKeys };
}

module.exports = { cognitiveLoadLevel, normalizeUserState, THRESHOLDS };
