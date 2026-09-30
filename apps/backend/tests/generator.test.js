const test = require('node:test');
const assert = require('node:assert');
const { generateUi } = require('../src/ai/codegen/generator');
const { ContextError } = require('../src/ai/context/contextBuilder');
const { walk } = require('../src/ai/codegen/schema');
const { raw, goodSpec, fakeLlm, field, clone } = require('./fixtures');

const FIELD = ['Input', 'Select', 'Radio'];
const fieldsOf = (spec) => { const f = []; walk(spec.root, (n) => FIELD.includes(n.type) && f.push(n)); return f; };
const lastText = (messages) => messages[messages.length - 1].content;

test('complex form -> Wizard, every field kept', async () => {
  const r = await generateUi(raw(), { llm: fakeLlm(goodSpec()) });
  assert.ok(r.ok);
  assert.strictEqual(r.spec.root.type, 'Wizard');
  assert.deepStrictEqual(fieldsOf(r.spec).map((f) => f.props.name).sort(), ['city', 'email', 'employment', 'fullName', 'income', 'phone', 'pin']);
  assert.strictEqual(r.attempts.length, 1);
});

test('difficult dropdown -> Radio buttons', async () => {
  const r = await generateUi(raw(), { llm: fakeLlm(goodSpec()) });
  assert.strictEqual(fieldsOf(r.spec).find((f) => f.props.name === 'employment').type, 'Radio');
});

test('too many fields -> multi-step form (max 4 per step)', async () => {
  const r = await generateUi(raw(), { llm: fakeLlm(goodSpec()) });
  const steps = r.spec.root.children;
  assert.ok(steps.length > 1);
  steps.forEach((card) => assert.ok(fieldsOf({ root: card }).length <= 4));
});

test('existing user data preserved; password never sent to the LLM', async () => {
  const llm = fakeLlm(goodSpec());
  const r = await generateUi(raw(), { llm });
  const byName = Object.fromEntries(fieldsOf(r.spec).map((f) => [f.props.name, f.props.value]));
  assert.strictEqual(byName.fullName, 'Asha Rao');
  assert.strictEqual(byName.email, 'asha@example.com');
  assert.strictEqual(byName.employment, 'Student');
  assert.strictEqual(byName.income, 42000);
  assert.strictEqual(byName.pin, undefined);
  assert.ok(!JSON.stringify(llm.calls).includes('1234'), 'PIN leaked to the LLM');
});

test('a value invented by the LLM is replaced by the real one, no retry', async () => {
  const s = goodSpec();
  s.root.children[0].children[0].props.value = 'Someone Else';
  const r = await generateUi(raw(), { llm: fakeLlm(s) });
  assert.strictEqual(r.attempts.length, 1);
  assert.strictEqual(fieldsOf(r.spec).find((f) => f.props.name === 'fullName').props.value, 'Asha Rao');
});

test('invalid output -> auto-correction (bad JSON, then bad component, then good)', async () => {
  const bad = goodSpec();
  bad.root.children[0].children[0].type = 'Slider';
  const llm = fakeLlm('not json at all', bad, goodSpec());
  const r = await generateUi(raw(), { llm });
  assert.ok(r.ok);
  assert.strictEqual(r.attempts.length, 3);
  assert.deepStrictEqual(r.attempts.map((a) => a.ok), [false, false, true]);
  assert.strictEqual(llm.calls.length, 3);
  assert.ok(/JSON/.test(lastText(llm.calls[1])), 'model was told its output was not JSON');
  assert.ok(lastText(llm.calls[2]).includes('Slider'), 'model was told which component was wrong');
});

test('dropped field is caught and repaired', async () => {
  const bad = goodSpec();
  bad.root.children[2].children.splice(1, 1); // drop city
  const llm = fakeLlm(bad, goodSpec());
  const r = await generateUi(raw(), { llm });
  assert.ok(r.ok);
  assert.ok(lastText(llm.calls[1]).includes("Missing field 'city'"));
});

test('gives up after maxAttempts and returns the ORIGINAL UI as fallback', async () => {
  const llm = fakeLlm('nope');
  const input = raw();
  const r = await generateUi(input, { llm, maxAttempts: 3 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(llm.calls.length, 3);
  assert.deepStrictEqual(r.fallback, input.currentUi);
  assert.ok(r.errors.length > 0);
});

test('invalid request throws ContextError before calling the LLM', async () => {
  const llm = fakeLlm(goodSpec());
  const bad = raw(); bad.cognitiveLoadScore = 7;
  await assert.rejects(() => generateUi(bad, { llm }), ContextError);
  assert.strictEqual(llm.calls.length, 0);
});

test('LLM/network errors are passed through', async () => {
  await assert.rejects(() => generateUi(raw(), { llm: fakeLlm(new Error('Ollama /api/chat failed (401)')) }), /401/);
});

test('an already-simple form comes back as a simple valid UI', async () => {
  const simple = { currentUi: { version: '1.0', root: { type: 'Card', id: 'root', props: {}, children: [field('Input', 'name'), field('Input', 'email', { type: 'email' })] } }, userState: {}, cognitiveLoadScore: 0.1 };
  const answer = clone(simple.currentUi);
  const r = await generateUi(simple, { llm: fakeLlm(answer) });
  assert.ok(r.ok);
  assert.strictEqual(r.spec.root.type, 'Card');
});
