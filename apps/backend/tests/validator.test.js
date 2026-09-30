const test = require('node:test');
const assert = require('node:assert');
const { validateGenerated, finalizeSpec } = require('../src/ai/codegen/validator');
const { buildContext } = require('../src/ai/context/contextBuilder');
const { raw, goodSpec, field, btn, card } = require('./fixtures');

const { context } = buildContext(raw());
const check = (spec) => validateGenerated(JSON.stringify(spec), context);
const has = (res, text) => assert.ok(res.errors.some((e) => e.includes(text)), `expected an error containing "${text}", got:\n${res.errors.join('\n')}`);
const stepFields = (spec, i) => spec.root.children[i].children;

test('a good wizard is valid (Select -> Radio allowed)', () => {
  const r = check(goodSpec());
  assert.deepStrictEqual(r.errors, []);
  assert.ok(r.ok);
});

test('not JSON', () => has(validateGenerated('sorry, I cannot', context), 'JSON'));
test('JSON array at top level', () => has(validateGenerated('[1,2]', context), 'JSON object'));

test('unknown component', () => { const s = goodSpec(); stepFields(s, 0)[0].type = 'Slider'; has(check(s), 'Slider'); });
test('unknown prop', () => { const s = goodSpec(); stepFields(s, 0)[0].props.color = 'red'; has(check(s), 'color'); });

test('dropped field', () => { const s = goodSpec(); stepFields(s, 2).splice(1, 1); has(check(s), "Missing field 'city'"); });
test('added field', () => { const s = goodSpec(); stepFields(s, 2).splice(3, 0, field('Input', 'extra')); has(check(s), "Unknown field 'extra'"); });
test('duplicated field', () => { const s = goodSpec(); stepFields(s, 0).splice(0, 0, field('Input', 'phone', { type: 'tel' })); has(check(s), "'phone' appears 2 times"); });
test('renamed field id', () => { const s = goodSpec(); stepFields(s, 0)[0].id = 'name-box'; has(check(s), "original id 'f-fullName'"); });
test('changed input type', () => { const s = goodSpec(); stepFields(s, 0)[1].props.type = 'text'; has(check(s), "input type 'email'"); });
test('Select turned into Input', () => { const s = goodSpec(); stepFields(s, 1)[0] = field('Input', 'employment'); has(check(s), 'cannot become an Input'); });
test('changed options order', () => { const s = goodSpec(); stepFields(s, 1)[0].props.options = ['Student', 'Salaried', 'Self-employed']; has(check(s), 'same options'); });
test('duplicate node id', () => { const s = goodSpec(); s.root.children[1].id = 'step-1'; has(check(s), "Duplicate id 'step-1'"); });

test('more than 4 fields in one step', () => {
  const s = goodSpec();
  const fields = s.root.children.flatMap((c) => c.children.filter((n) => ['Input', 'Radio', 'Select'].includes(n.type)));
  s.root.children = [card('only', 'Everything', [...fields, btn('b-submit', 'Submit', 'submit')])];
  has(check(s), 'has 7 fields (max 4)');
});

test('last wizard step needs a submit button', () => {
  const s = goodSpec();
  s.root.children[2].children = s.root.children[2].children.filter((n) => n.id !== 'b-submit');
  has(check(s), 'submit');
});

test('LLM-set values are stripped, not an error', () => {
  const s = goodSpec();
  stepFields(s, 0)[0].props.value = 'HACKED';
  const r = check(s);
  assert.ok(r.ok);
  assert.strictEqual(r.spec.root.children[0].children[0].props.value, undefined);
});

test('JSON in code fences with chatter is accepted', () => {
  const r = validateGenerated('Here you go:\n```json\n' + JSON.stringify(goodSpec()) + '\n```', context);
  assert.ok(r.ok);
});

test('finalizeSpec restores user values (not the password)', () => {
  const out = finalizeSpec(check(goodSpec()).spec, context);
  const byName = {};
  const collect = (n) => { if (n.props && n.props.name) byName[n.props.name] = n; (n.children || []).forEach(collect); };
  collect(out.root);
  assert.strictEqual(byName.fullName.props.value, 'Asha Rao');
  assert.strictEqual(byName.income.props.value, 42000);
  assert.strictEqual(byName.employment.type, 'Radio');
  assert.strictEqual(byName.employment.props.value, 'Student');
  assert.strictEqual(byName.pin.props.value, undefined);
});
