const crypto = require('crypto');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { CONTRACT } = require('./designSystem');
const { validate } = require('./validator');
const { compile } = require('./compile');
const templateWizard = require('./templateWizard');
const { sanitizeContext, pickFocus, describe } = require('./context');
const { GenCache } = require('./cache');
const { withTimeout, CircuitBreaker } = require('./resilience');

const defaultCache = new GenCache();
const defaultBreaker = new CircuitBreaker({ maxFailures: +process.env.LLM_MAX_FAILURES || 3, cooldownMs: +process.env.LLM_COOLDOWN_MS || 60000 });
const LLM_TIMEOUT_MS = () => +process.env.LLM_TIMEOUT_MS || 8000;    // total LLM budget per redesign, across all self-heal attempts
const NOTICE = 'We switched to a simplified design to keep things quick and reliable.';

function getModel() {
  if (process.env.LLM_PROVIDER === 'ollama') {
    const { ChatOllama } = require('@langchain/ollama');
    return new ChatOllama({ model: process.env.OLLAMA_MODEL || 'llama3', temperature: 0.2, ...(process.env.OLLAMA_BASE_URL ? { baseUrl: process.env.OLLAMA_BASE_URL } : {}) });
  }
  if (process.env.OPENAI_API_KEY) {
    const { ChatOpenAI } = require('@langchain/openai');
    return new ChatOpenAI({ model: 'gpt-4o', temperature: 0.2 });
  }
  return null; // no LLM configured -> template mode (demo still works)
}

// Friction type changes the DESIGN INTENT, not just the trigger.
const STRATEGY = {
  rage: 'User is rage-clicking: ONE field per screen, big obvious primary button, no distractions.',
  hesitation: "User is hesitating: show each field's hint prominently as plain-language guidance.",
  errors: 'User keeps hitting validation errors: one field per step with the hint shown before input.',
  thrash: 'User is lost: show progress and a clear Back/Next flow.',
  calm: 'Generic simplification into a wizard.',
};

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You write React components for a fintech portal.\n{contract}\nReturn ONLY code.'],
  ['human', 'Friction: {kind} (score {score}/100).\nStrategy: {strategy}\nFields: {fields}\nValues so far: {values}\nContext: {context}\n{repair}'],
]);

const strip = (t) => t.replace(/^```(?:jsx|js|javascript)?\n?/i, '').replace(/```\s*$/, '').trim();

// Typed values flow into the prompt, so bound them (the validator is the real defence).
const clean = (values) => Object.fromEntries(Object.entries(values || {}).slice(0, 20).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 100)]));

// opts.model lets tests inject a scripted LLM (null = force template mode).
async function generate({ kind = 'calm', score = 0, fields, values = {}, context }, onStatus = () => {}, opts = {}) {
  const T0 = Date.now();
  if (!Array.isArray(fields) || !fields.length) throw new Error('fields[] is required');
  values = clean(values);
  const ctx = sanitizeContext(context, fields);
  const focusField = pickFocus(ctx);
  const cache = opts.cache === undefined ? defaultCache : opts.cache;   // opts.cache=null disables caching
  const model = opts.model !== undefined ? opts.model : getModel();
  const breaker = opts.breaker || defaultBreaker;
  const timeoutMs = opts.timeoutMs || LLM_TIMEOUT_MS();
  const onToken = opts.onToken || (() => {});

  const ckey = cache && cache.key({ kind, focusField, model: model ? 'llm' : 'tpl', fields: fields.map((f) => [f.name, f.label, f.type, f.hint, f.options, f.pattern]) });
  const hit = cache && cache.get(ckey);
  if (hit) { onStatus('Reusing a validated design…'); return { ...hit, focusField, report: { ...hit.report, cached: true }, timings: { totalMs: Date.now() - T0 } }; }

  const report = { mode: model ? 'llm' : 'template', attempts: 0, errors: [], cached: false, degraded: false, reason: null, notice: null };
  const timings = { llmMs: 0, validateMs: 0, compileMs: 0 };
  let source = null, repair = '';

  const degrade = (reason) => { report.mode = 'template-fallback'; report.degraded = true; report.reason = reason; report.notice = NOTICE; };

  if (model && !breaker.allow()) {
    onStatus('AI design is temporarily unavailable, using a simplified design…');
    degrade('circuit-open');                    // the LLM has been failing: do not make this user wait for it again
  } else if (model) {
    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const deadline = Date.now() + timeoutMs;
    let failed = null;                           // 'timeout' | 'llm-error' | 'invalid'
    try {
      await withTimeout(async (signal) => {
        for (let a = 1; a <= 3; a++) {
          report.attempts = a;
          onStatus(a === 1 ? 'Generating UI…' : `Self-healing (attempt ${a})…`);
          onToken({ reset: true, attempt: a });
          const tl = Date.now();
          let raw = '', lastPing = 0;
          const stream = await chain.stream({
            contract: CONTRACT, kind, score, strategy: STRATEGY[kind] || STRATEGY.calm,
            fields: JSON.stringify(fields), values: JSON.stringify(values), context: describe(ctx, focusField), repair,
          }, { signal });
          for await (const chunk of stream) {
            if (signal.aborted) return;
            raw += chunk; onToken({ chunk });   // raw tokens go to the browser for a live PREVIEW only; nothing is compiled from them
            if (Date.now() - lastPing > 150) { lastPing = Date.now(); onStatus(`Writing component… ${raw.length} chars`); }
          }
          if (signal.aborted) return;                    // deadline already passed: a late answer must never be used
          timings.llmMs += Date.now() - tl;
          const candidate = strip(raw);
          const tv = Date.now();
          const v = validate(candidate);
          timings.validateMs += Date.now() - tv;
          if (signal.aborted) return;
          if (v.ok) { source = candidate; return; }
          report.errors.push(...v.errors);
          // Self-healing loop: feed the validator's verdict back to the model.
          repair = `Your previous code was REJECTED:\n${v.errors.join('\n')}\nPrevious code:\n${candidate}\nFix it.`;
          if (Date.now() >= deadline - 50) return;       // no time for another attempt inside the budget
        }
      }, timeoutMs);
      if (!source) failed = 'invalid';
    } catch (e) {
      failed = e.name === 'TimeoutError' ? 'timeout' : 'llm-error';
      report.errors.push(e.message);
      timings.llmMs = Math.max(timings.llmMs, Date.now() - T0);
    }
    if (failed) { breaker.failure(); degrade(failed); onStatus(`AI design ${failed === 'timeout' ? 'was too slow' : 'failed'}, using a simplified design…`); }
    else breaker.success();
  }
  if (!source) source = templateWizard(kind);

  const tv2 = Date.now();
  const v = validate(source);
  timings.validateMs += Date.now() - tv2;
  if (!v.ok) throw new Error('template failed validation: ' + v.errors.join('; '));
  const tc = Date.now();
  const { code } = compile(source);   // proves it compiles; the browser compiles the raw source itself
  timings.compileMs = Date.now() - tc;
  const hash = crypto.createHash('sha256').update(source).digest('hex');  // browser re-hashes to verify the download
  timings.totalMs = Date.now() - T0;
  const result = { code, hash, source, report };
  // Only cache designs that are safe to reuse: never cache a degraded fallback after an LLM failure,
  // so the next user gets another chance at a real LLM design.
  if (cache && report.mode !== 'template-fallback') cache.set(ckey, result);
  return { ...result, focusField, timings };
}

// Cold-start removal: generate (and cache) a design for every friction kind before the first user arrives.
// Covers the "no single stuck field" case; designs for a specific stuck field are cached as they happen.
async function prewarm(fields, opts = {}) {
  const kinds = Object.keys(STRATEGY), out = { warmed: 0, degraded: 0, ms: 0 }, t0 = Date.now();
  for (const kind of kinds) {
    const r = await generate({ kind, score: 75, fields }, () => {}, opts);
    r.report.degraded ? out.degraded++ : out.warmed++;
  }
  out.ms = Date.now() - t0; return out;
}

module.exports = { generate, prewarm, defaultCache, defaultBreaker, STRATEGY };
