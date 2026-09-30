const test = require('node:test');
const assert = require('node:assert');
const { RunnableLambda } = require('@langchain/core/runnables');
const { getLlm } = require('../src/ai/langchain/model');
const { generateRaw, parseJsonOutput } = require('../src/ai/langchain/chain');

test('generateRaw sends system+user messages with the context and returns the text', async () => {
  let seen;
  const llm = RunnableLambda.from(async (messages) => { seen = messages; return '{"ok":true}'; });
  const out = await generateRaw('{"marker":"XYZ"}', { llm });
  assert.strictEqual(out, '{"ok":true}');
  assert.strictEqual(seen[0].role, 'system');
  assert.ok(seen[1].content.includes('XYZ'));
});

test('getLlm returns the content string from the chat client', async () => {
  const llm = getLlm({ chat: async () => ({ role: 'assistant', content: 'hello' }) });
  assert.strictEqual(await llm.invoke([{ role: 'user', content: 'hi' }]), 'hello');
});

test('getLlm throws on empty response', async () => {
  const llm = getLlm({ chat: async () => ({ content: '   ' }) });
  await assert.rejects(() => llm.invoke([]), /empty response/);
});

test('getLlm passes client errors through', async () => {
  const llm = getLlm({ chat: async () => { throw new Error('Ollama /api/chat failed (401)'); } });
  await assert.rejects(() => llm.invoke([]), /401/);
});

test('parseJsonOutput: plain JSON', () => assert.deepStrictEqual(parseJsonOutput('{"a":1}'), { ok: true, data: { a: 1 } }));
test('parseJsonOutput: code fences', () => assert.strictEqual(parseJsonOutput('```json\n{"a":1}\n```').data.a, 1));
test('parseJsonOutput: chatter around JSON', () => assert.strictEqual(parseJsonOutput('Sure! Here it is:\n{"a":{"b":2}}\nHope that helps').data.a.b, 2));
test('parseJsonOutput: <think> block', () => assert.strictEqual(parseJsonOutput('<think>{not json}</think>{"a":3}').data.a, 3));
test('parseJsonOutput: garbage fails cleanly', () => {
  const r = parseJsonOutput('I cannot do that');
  assert.strictEqual(r.ok, false);
  assert.ok(r.error);
});
