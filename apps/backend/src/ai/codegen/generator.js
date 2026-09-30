/**
 * GENERATOR  (Steps 7 + 8: validate + error/repair loop)
 *
 *   context -> LLM -> validate -> (errors? -> tell LLM -> LLM -> validate ...) -> new UI
 *
 * Never returns an invalid UI. If the model can't produce a valid one within
 * maxAttempts, it returns { ok:false, fallback } where fallback is the user's
 * ORIGINAL UI, so the frontend can just keep showing that.
 */
const { buildContext } = require('../context/contextBuilder');
const { buildMessages, buildRepairMessages } = require('../langchain/prompts');
const { getLlm } = require('../langchain/model');
const { validateGenerated, finalizeSpec } = require('./validator');

/**
 * @param {object} rawInput  { currentUi, userState, cognitiveLoadScore, problematicElement }
 * @param {object} [opts]
 * @param {object} [opts.llm]          LangChain runnable (messages -> text); default = Ollama
 * @param {number} [opts.maxAttempts=3]
 * @throws ContextError if rawInput is invalid; any LLM/network error is passed through
 */
async function generateUi(rawInput, { llm, maxAttempts = 3 } = {}) {
  const { context, text, warnings } = buildContext(rawInput); // throws ContextError
  const model = llm || getLlm();

  let messages = buildMessages(text);
  const attempts = [];
  let lastErrors = [];

  for (let i = 1; i <= maxAttempts; i += 1) {
    const raw = await model.invoke(messages);
    const result = validateGenerated(raw, context);
    attempts.push({ attempt: i, ok: result.ok, errors: result.errors });

    if (result.ok) {
      return { ok: true, spec: finalizeSpec(result.spec, context), attempts, warnings };
    }
    lastErrors = result.errors;
    messages = buildRepairMessages(messages, raw, result.errors); // LLM -> Validation -> Error -> LLM
  }

  return { ok: false, errors: lastErrors, attempts, warnings, fallback: context.currentUi };
}

module.exports = { generateUi };
