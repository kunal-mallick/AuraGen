// Real-model benchmark. Answers the two open questions from the PDF:
//   Week 4: "redesign time under 2 seconds"      -> latency percentiles, cold vs cached
//   Mid-project: "consistently valid components" -> first-try pass rate, self-heal rate, fallback rate
//
//   OPENAI_API_KEY=sk-... node bench/bench.js [--runs 5] [--timeout 8000]
//   LLM_PROVIDER=ollama OLLAMA_MODEL=llama3 node bench/bench.js
//   node bench/bench.js --fake      # offline smoke test of this script only (NOT a model result)
const fs = require('fs'); const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const RUNS = +arg('runs', 5), FAKE = !!arg('fake', false);
if (arg('timeout', false)) process.env.LLM_TIMEOUT_MS = String(arg('timeout'));
const { generate, STRATEGY } = require('../src/codegen');
const { GenCache } = require('../src/cache');
const { CircuitBreaker } = require('../src/resilience');

const provider = FAKE ? 'fake (script smoke test)' : process.env.LLM_PROVIDER === 'ollama' ? `ollama/${process.env.OLLAMA_MODEL || 'llama3'}` : process.env.OPENAI_API_KEY ? 'openai/gpt-4o' : null;
if (!provider) { console.error('No model configured. Set OPENAI_API_KEY, or LLM_PROVIDER=ollama, or pass --fake for a script smoke test.'); process.exit(2); }

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
(async () => {
  const { FIELDS } = await import(require('url').pathToFileURL(path.join(__dirname, '../../frontend/components/fields.mjs')).href);
  let opts = {};
  if (FAKE) { const { RunnableLambda } = require('@langchain/core/runnables'); const tpl = require('../src/templateWizard'); opts.model = RunnableLambda.from(async () => tpl('calm')); }
  const kinds = Object.keys(STRATEGY), rows = [], cold = [];
  console.log(`Model: ${provider} | kinds: ${kinds.length} | runs/kind: ${RUNS}\n`);
  for (const kind of kinds) for (let i = 0; i < RUNS; i++) {
    const breaker = new CircuitBreaker({ maxFailures: 1e9 });                    // measure the model, not the breaker
    const t0 = Date.now(); const o = await generate({ kind, score: 80, fields: FIELDS, values: { fullName: 'Aryan' } }, () => {}, { ...opts, cache: null, breaker });
    const r = o.report, ms = Date.now() - t0;
    rows.push({ kind, ms, attempts: r.attempts, firstTry: r.mode === 'llm' && r.attempts === 1, healed: r.mode === 'llm' && r.attempts > 1, fellBack: r.degraded, reason: r.reason });
    cold.push(ms); process.stdout.write(r.degraded ? 'x' : r.attempts > 1 ? 'h' : '.');
  }
  // Cached path: same request again through a warm cache.
  const cache = new GenCache(); const warm = [];
  await generate({ kind: 'rage', score: 80, fields: FIELDS }, () => {}, { ...opts, cache, breaker: new CircuitBreaker() });
  for (let i = 0; i < 20; i++) { const t0 = Date.now(); await generate({ kind: 'rage', score: 80, fields: FIELDS }, () => {}, { ...opts, cache }); warm.push(Date.now() - t0); }

  const n = rows.length, c = (f) => rows.filter(f).length, rate = (k) => `${k}/${n} (${Math.round(100 * k / n)}%)`;
  const under2 = cold.filter((x) => x < 2000).length;
  const out = [
    `# AuraGen real-model benchmark`, '', `- Model: **${provider}**${FAKE ? ' (smoke test only: these numbers say nothing about a real model)' : ''}`, `- Date: ${new Date().toISOString()}`, `- ${n} generations (${kinds.length} friction kinds x ${RUNS}), cache disabled, LLM timeout ${process.env.LLM_TIMEOUT_MS || 8000}ms`, '',
    '## Generation quality (mid-project "consistently valid")', '',
    `| Outcome | Count |`, `|---|---|`,
    `| Valid on the first try | ${rate(c((r) => r.firstTry))} |`, `| Valid after self-healing | ${rate(c((r) => r.healed))} |`, `| Fell back to the template | ${rate(c((r) => r.fellBack))} |`,
    `| **Delivered a valid component in total** | ${rate(n)} (the template is validated, so users never get a broken UI) |`,
    `| **Real LLM design delivered** | ${rate(c((r) => !r.fellBack))} |`, '',
    '## Latency (Week 4 "under 2 seconds")', '',
    `| Path | p50 | p95 | max | under 2000ms |`, `|---|---|---|---|---|`,
    `| Cold (LLM) | ${pct(cold, .5)}ms | ${pct(cold, .95)}ms | ${Math.max(...cold)}ms | ${under2}/${n} |`,
    `| Cached | ${pct(warm, .5)}ms | ${pct(warm, .95)}ms | ${Math.max(...warm)}ms | ${warm.filter((x) => x < 2000).length}/${warm.length} |`, '',
    'Cold = a user whose situation has not been seen before. Pre-warming at server start turns the first request for each friction kind into a cached one.', '',
  ];
  const fb = rows.filter((r) => r.fellBack); if (fb.length) out.push('## Fallback reasons', '', ...Object.entries(fb.reduce((m, r) => (m[r.reason] = (m[r.reason] || 0) + 1, m), {})).map(([k, v]) => `- ${k}: ${v}`), '');
  console.log('\n\n' + out.join('\n'));
  if (!FAKE) { fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), out.join('\n')); console.log('Saved bench/RESULTS.md'); }
  process.exit(0);
})();
