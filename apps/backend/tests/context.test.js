const test = require('node:test');
const assert = require('node:assert');
const { buildContext, ContextError } = require('../src/ai/context/contextBuilder');

const field = (t, name, extra = {}) => ({ type: t, id: `f-${name}`, props: { name, label: name, ...extra }, children: [] });
const ui = (children) => ({ version: '1.0', root: { type: 'Card', id: 'root', props: {}, children } });

const bigForm = ui([
  field('Input', 'name'), field('Input', 'email'),
  field('Select', 'plan', { options: ['free', 'pro', 'team'] }),
  field('Input', 'phone'), field('Input', 'city'),
  field('Input', 'pass', { type: 'password' }),
]);
const base = { currentUi: bigForm, userState: { name: 'Asha', email: 'a@x.com', pass: 'secret', junk: 1 }, cognitiveLoadScore: 0.85, problematicElement: 'f-plan' };

test('builds context and text', () => {
  const r = buildContext(base);
  assert.strictEqual(r.context.cognitiveLoad.level, 'high');
  assert.ok(r.text.includes('availableComponents'));
});

test('hints: select -> radio and split into wizard', () => {
  const { hints } = buildContext(base).context;
  assert.ok(hints.some((h) => h.includes('convert it to a Radio')));
  assert.ok(hints.some((h) => h.includes('Wizard')));
});

test('password value never reaches the LLM text', () => {
  const r = buildContext(base);
  assert.ok(!r.text.includes('secret'));
  assert.deepStrictEqual(r.context.sensitiveFields, ['pass']);
});

test('unknown userState keys ignored with a warning', () => {
  const r = buildContext(base);
  assert.deepStrictEqual(r.context.userValues, { name: 'Asha', email: 'a@x.com' });
  assert.ok(r.warnings.some((w) => w.includes('junk')));
});

test('problematic element resolved to its node', () => {
  const p = buildContext(base).context.problematicElement;
  assert.strictEqual(p.found, true);
  assert.strictEqual(p.node.type, 'Select');
});

test('missing problematic element warns, does not crash', () => {
  const r = buildContext({ ...base, problematicElement: 'nope' });
  assert.ok(r.warnings.some((w) => w.includes('not found')));
});

test('bad score rejected', () => {
  assert.throws(() => buildContext({ ...base, cognitiveLoadScore: 1.5 }), ContextError);
});

test('invalid currentUi rejected', () => {
  assert.throws(() => buildContext({ ...base, currentUi: { version: '1.0', root: { type: 'Slider', id: 'x' } } }), ContextError);
});
