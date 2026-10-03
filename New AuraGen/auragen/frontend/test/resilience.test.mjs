import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { createRetryGate, createTokenPreview, noticeFor } from '../lib/resilience.mjs';
import { buildContext, readDom } from '../lib/domContext.mjs';
import { FIELDS } from '../components/fields.mjs';
console.log('Week 4: resilience + fuller DOM snapshot');

{ let t = 0; const g = createRetryGate({ max: 2, cooldownMs: 1000, now: () => t });
  assert.ok(g.canTrigger()); g.fail(); assert.ok(g.canTrigger()); g.fail();
  assert.equal(g.canTrigger(), false, 'blocked after max failures');
  t = 999; assert.equal(g.canTrigger(), false); t = 1000; assert.ok(g.canTrigger(), 'allowed again after cooldown');
  g.ok(); assert.equal(g.failures, 0); g.fail(); g.fail(); g.reset(); assert.ok(g.canTrigger(), 'reset re-arms');
  console.log('  PASS  retry gate: blocks after N failures, reopens after cooldown, reset re-arms'); }
{ const p = createTokenPreview(10); p.push('abcdef'); p.push('ghijkl');
  assert.equal(p.text, 'cdefghijkl'); assert.equal(p.reset(), '');
  console.log('  PASS  token preview keeps only the tail and resets between attempts'); }
{ assert.equal(noticeFor({ degraded: false }), null);
  assert.match(noticeFor({ degraded: true, reason: 'timeout' }), /Simplified design.*too long.*answers are kept/);
  assert.match(noticeFor({ degraded: true, reason: 'circuit-open' }), /paused/);
  console.log('  PASS  "simplified design" notice only for degraded results, with a reason'); }
{ // readDom: full form vs a wizard step, tolerating hidden wrappers
  const d = new JSDOM(`<body>${FIELDS.map((f) => `<label data-field="${f.name}"></label>`).join('')}</body>`).window.document;
  const full = readDom(d); assert.deepEqual(full.order, FIELDS.map((f) => f.name)); assert.equal(full.visible.length, FIELDS.length);
  const d2 = new JSDOM(`<body><div hidden><label data-field="fullName"></label></div><label data-field="pan"></label><div style="display:none"><label data-field="income"></label></div></body>`).window.document;
  assert.deepEqual(readDom(d2).visible, ['pan']); assert.deepEqual(readDom(d2).order, ['fullName', 'pan', 'income']);
  console.log('  PASS  readDom reports on-screen order and which fields are really visible'); }
{ const values = { fullName: 'Aryan', pan: 'abcde1234f' };
  const form = buildContext(FIELDS, values, [], 0, { order: FIELDS.map((f) => f.name), visible: FIELDS.map((f) => f.name) });
  assert.equal(form.layout, 'form'); assert.equal(form.step, null);
  const wiz = buildContext(FIELDS, values, [], 0, { order: FIELDS.map((f) => f.name), visible: ['pan'] });
  assert.equal(wiz.layout, 'wizard'); assert.deepEqual(wiz.step, { index: 2, of: FIELDS.length });
  const by = (n) => wiz.fields.find((f) => f.name === n);
  assert.equal(by('pan').invalid, true); assert.equal(by('pan').filled, false); assert.equal(by('fullName').invalid, false);
  console.log('  PASS  snapshot carries valid/invalid per field, layout, and the visible step'); }
console.log('Resilience tests passed');
