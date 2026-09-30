const test = require('node:test');
const assert = require('node:assert');
const { uiSpecSchema, describeRegistry } = require('../src/ai/codegen/schema');
const sample = require('../src/ai/codegen/samples/sample-wizard.json');

const clone = (o) => JSON.parse(JSON.stringify(o));
const errs = (spec) => { const r = uiSpecSchema.safeParse(spec); return r.success ? [] : r.error.issues.map(i => i.message); };

test('sample wizard is valid', () => assert.deepStrictEqual(errs(sample), []));

test('unknown component rejected', () => {
  const s = clone(sample); s.root.children[1].children[0].type = 'Slider';
  assert.ok(errs(s).length);
});

test('unknown prop rejected', () => {
  const s = clone(sample); s.root.children[0].children[0].props.color = 'red';
  assert.ok(errs(s).some(m => m.includes('color') || m.includes('Unrecognized')));
});

test('missing required prop rejected', () => {
  const s = clone(sample); delete s.root.children[0].children[0].props.label;
  assert.ok(errs(s).length);
});

test('Wizard child must be Card', () => {
  const s = clone(sample); s.root.children[0].type = 'Input';
  assert.ok(errs(s).some(m => m.includes('must be a Card')));
});

test('leaf component cannot have children', () => {
  const s = clone(sample); s.root.children[0].children[0].children = [clone(s.root.children[0].children[1])];
  assert.ok(errs(s).some(m => m.includes('cannot have children')));
});

test('describeRegistry works', () => assert.ok(describeRegistry().Select.props.options === 'required'));
