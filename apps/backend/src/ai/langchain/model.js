/**
 * MODEL  (Step 6)
 * Wraps the team's existing Ollama Cloud client (src/ai/ollama.client.js) as a
 * LangChain Runnable: messages in -> text out.
 *
 * Reusing ollama.client.js means we use the same OLLAMA_BASE_URL / OLLAMA_API_KEY /
 * OLLAMA_MODEL that already work, with no extra provider package.
 * To switch models/providers later, only this file changes.
 */
const { RunnableLambda } = require('@langchain/core/runnables');

/**
 * @param {object} [opts]
 * @param {Function} [opts.chat] override for tests: async (messages) => ({ content })
 */
function getLlm({ chat } = {}) {
  // lazy require so tests can run without .env / network
  const chatFn = chat || require('../ollama.client').chat;

  return RunnableLambda.from(async (messages) => {
    const reply = await chatFn(messages);
    const content = reply && typeof reply.content === 'string' ? reply.content : '';
    if (!content.trim()) throw new Error('LLM returned an empty response');
    return content;
  });
}

module.exports = { getLlm };
