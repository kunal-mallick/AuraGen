import assert from 'node:assert';
import { buildContext } from '../lib/domContext.mjs';
import { FIELDS } from '../components/fields.mjs';

const ev = (t, field, type) => ({ t, field, type });
const by = (c, n) => c.fields.find((f) => f.name === n);
console.log('Context model');

{ // User breezes through name, then fights with PAN: long dwell, 3 errors, lots of backspacing.
  const events = [ev(0, 'fullName', 'focus'), ev(1500, 'fullName', 'blur'),
    ev(2000, 'pan', 'focus'), ...Array.from({ length: 6 }, (_, i) => ev(3000 + i * 500, 'pan', 'delete')),
    ev(7000, 'pan', 'error'), ev(9000, 'pan', 'error'), ev(11000, 'pan', 'error'), ev(14000, 'pan', 'blur')];
  const c = buildContext(FIELDS, { fullName: 'Aryan' }, events, 15000);
  assert.equal(by(c, 'fullName').dwellMs, 1500);
  assert.equal(by(c, 'pan').dwellMs, 12000);
  assert.equal(by(c, 'pan').errors, 3);
  assert.equal(by(c, 'pan').corrections, 6);
  assert.ok(by(c, 'pan').struggle > 0.8 && by(c, 'fullName').struggle < 0.2, `pan ${by(c, 'pan').struggle} vs name ${by(c, 'fullName').struggle}`);
  assert.equal(c.filledCount, 1);
  console.log(`  PASS  isolates the struggling field (pan struggle ${by(c, 'pan').struggle}, name ${by(c, 'fullName').struggle})`);
}
{ // Still inside a field right now: open dwell counts up to "now".
  const c = buildContext(FIELDS, {}, [ev(1000, 'income', 'focus')], 7000);
  assert.equal(c.focused, 'income'); assert.equal(by(c, 'income').dwellMs, 6000);
  console.log('  PASS  counts dwell for the field the user is still in');
}
{ // Garbage in: unknown fields and out-of-order events must not throw or poison other fields.
  const c = buildContext(FIELDS, {}, [ev(5, 'nope', 'error'), ev(3, 'pan', 'blur'), ev(1, 'pan', 'focus')], 10);
  assert.equal(c.fields.length, FIELDS.length); assert.ok(c.fields.every((f) => f.struggle === 0 || f.name === 'pan'));
  console.log('  PASS  ignores unknown fields, tolerates out-of-order events');
}
{ // A wrong PAN is typed but not "filled"; a correct one is.
  const wrong = buildContext(FIELDS, { pan: 'abcde1234f' }, [], 0), right = buildContext(FIELDS, { pan: 'ABCDE1234F' }, [], 0);
  assert.equal(by(wrong, 'pan').filled, false); assert.equal(by(right, 'pan').filled, true);
  assert.equal(wrong.filledCount, 0);
  console.log('  PASS  an invalid value does not count as filled');
}
console.log('Context tests passed');
