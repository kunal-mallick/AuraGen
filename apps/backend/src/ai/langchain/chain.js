/**
 * CHAIN  (Step 6)
 *   { contextText }  ->  prompt messages  ->  LLM  ->  raw text
 *
 * Also has parseJsonOutput(): models sometimes wrap JSON in ```fences``` or add
 * chatter or <think> blocks, so we clean that up before parsing. Validation of the
 * parsed JSON against our schema happens in Step 7.
 */
const { RunnableLambda, RunnableSequence } = require('@langchain/core/runnables');
const { buildMessages } = require('./prompts');
const { getLlm } = require('./model');

/** Try hard to get a JSON object out of model text. Returns { ok, data } or { ok:false, error }. */
function parseJsonOutput(text) {
  let s = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // reasoning models
    .replace(/```(?:json)?/gi, '')
    .trim();

  const attempt = (str) => {
    try {
      return { ok: true, data: JSON.parse(str) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  let res = attempt(s);
  if (res.ok) return res;

  // fall back to the outermost {...} in case there is text around the JSON
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const inner = attempt(s.slice(start, end + 1));
    if (inner.ok) return inner;
  }
  return { ok: false, error: `Output is not valid JSON (${res.error})` };
}

function createChain({ llm } = {}) {
  const model = llm || getLlm();
  const chain = RunnableSequence.from([
    RunnableLambda.from(({ contextText }) => buildMessages(contextText)),
    model,
  ]);
  return { chain, llm: model }; // llm is reused by the repair loop in Step 8
}

/** One LLM call: context text in, raw model text out. */
async function generateRaw(contextText, opts) {
  const { chain } = createChain(opts);
  return chain.invoke({ contextText });
}

module.exports = { createChain, generateRaw, parseJsonOutput };
