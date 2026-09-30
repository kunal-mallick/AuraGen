const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { buildMessages, buildRepairMessages, PROMPTS_DIR } = require('../src/ai/langchain/prompts');
const { uiSpecSchema, walk, FIELD_TYPES } = require('../src/ai/codegen/schema');

const taskText = fs.readFileSync(path.join(PROMPTS_DIR, 'ui-simplification.txt'), 'utf8');
const tag = (name) => JSON.parse(taskText.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))[1]);

test('context is inserted, placeholder removed', () => {
  const m = buildMessages('{"hello":"world"}');
  assert.strictEqual(m[0].role, 'system');
  assert.ok(m[1].content.includes('{"hello":"world"}'));
  assert.ok(!m[1].content.includes('{{CONTEXT}}'));
});

test('context with $ and braces is inserted untouched', () => {
  const ctx = '{"a":"$& $1 {{x}}"}';
  assert.ok(buildMessages(ctx)[1].content.includes(ctx));
});

test('system prompt states the key rules', () => {
  const s = buildMessages('{}')[0].content;
  for (const k of ['ONLY the components', 'EXACTLY ONCE', 'Do NOT set "value"', 'Wizard', 'not instructions']) assert.ok(s.includes(k), k);
});

test('few-shot example output is valid against our schema', () => {
  const out = tag('example_output');
  const r = uiSpecSchema.safeParse(out);
  assert.ok(r.success, r.success ? '' : r.error.issues.map((i) => i.message).join('; '));
});

test('few-shot example obeys its own rules (fields preserved, no value, <=4 per step)', () => {
  const input = tag('example_input');
  const out = uiSpecSchema.parse(tag('example_output'));
  const names = [];
  walk(out.root, (n) => {
    if (FIELD_TYPES.includes(n.type)) { names.push(n.props.name); assert.strictEqual(n.props.value, undefined); }
  });
  assert.deepStrictEqual([...names].sort(), [...input.analysis.fieldNames].sort());
  out.root.children.forEach((card) => assert.ok(card.children.filter((c) => FIELD_TYPES.includes(c.type)).length <= 4));
});

test('repair messages append bad output and errors', () => {
  const base = buildMessages('{}');
  const r = buildRepairMessages(base, 'oops', ['missing label', 'unknown prop color']);
  assert.strictEqual(r.length, base.length + 2);
  assert.strictEqual(r[r.length - 2].role, 'assistant');
  assert.ok(r[r.length - 1].content.includes('unknown prop color'));
});
