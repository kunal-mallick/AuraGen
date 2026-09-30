const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createGenerateRouter } = require('../src/api/routes/generate.route');
const { generateUi } = require('../src/ai/codegen/generator');
const { raw, goodSpec, fakeLlm } = require('./fixtures');

const servers = [];
function start(llm) {
  const app = express();
  app.use(express.json());
  app.use('/api/generate', createGenerateRouter({ generate: (body) => generateUi(body, { llm }) }));
  return new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => { servers.push(s); resolve(s); }); });
}
const post = (s, body) => fetch(`http://127.0.0.1:${s.address().port}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test.after(() => servers.forEach((s) => s.close()));

test('200: returns the new UI', async () => {
  const res = await post(await start(fakeLlm(goodSpec())), raw());
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.status, 'ok');
  assert.strictEqual(body.ui.root.type, 'Wizard');
  assert.strictEqual(body.attempts, 1);
});

test('400: bad request body', async () => {
  const bad = raw(); delete bad.cognitiveLoadScore;
  const res = await post(await start(fakeLlm(goodSpec())), bad);
  const body = await res.json();
  assert.strictEqual(res.status, 400);
  assert.ok(body.issues.length > 0);
});

test('422: AI never produces a valid UI -> fallback is the original UI', async () => {
  const input = raw();
  const res = await post(await start(fakeLlm('garbage')), input);
  const body = await res.json();
  assert.strictEqual(res.status, 422);
  assert.deepStrictEqual(body.fallback, input.currentUi);
  assert.strictEqual(body.attempts, 3);
});

test('502: LLM/network failure', async () => {
  const res = await post(await start(fakeLlm(new Error('boom'))), raw());
  const body = await res.json();
  assert.strictEqual(res.status, 502);
  assert.ok(body.message.includes('boom'));
});
