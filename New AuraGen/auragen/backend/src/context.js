// Week 3: turn the browser's DOM-state snapshot into a decision the generator can use.
// The snapshot is untrusted client input: bound everything and only keep known field names.
function sanitizeContext(ctx, fields) {
  const known = new Set(fields.map((f) => f.name));
  const num = (v, max) => (Number.isFinite(+v) ? Math.max(0, Math.min(max, +v)) : 0);
  const list = Array.isArray(ctx?.fields) ? ctx.fields.slice(0, 50) : [];
  const names = (a) => (Array.isArray(a) ? a : []).filter((n) => known.has(n)).slice(0, 50);
  const step = ctx?.step && Number.isFinite(+ctx.step.index) ? { index: Math.max(1, Math.min(50, Math.round(+ctx.step.index))), of: Math.max(1, Math.min(50, Math.round(+ctx.step.of) || 1)) } : null;
  return {
    layout: ctx?.layout === 'wizard' ? 'wizard' : 'form',   // what is on screen right now: the full form or one step
    order: names(ctx?.order),                               // field order as shown on screen
    visible: names(ctx?.visible),                           // fields currently visible
    step,                                                   // which step is visible (wizard only)
    focused: known.has(ctx?.focused) ? ctx.focused : null,
    fields: list.filter((f) => known.has(f?.name)).map((f) => ({
      name: f.name, filled: !!f.filled, invalid: !!f.invalid, dwellMs: num(f.dwellMs, 600000), errors: num(f.errors, 100), corrections: num(f.corrections, 1000), struggle: num(f.struggle, 1),
    })),
  };
}

// The unfilled field with the highest struggle. Below the floor there is no real signal, so return null.
function pickFocus(ctx, floor = 0.25) {
  const hard = ctx.fields.filter((f) => !f.filled).sort((a, b) => b.struggle - a.struggle)[0];
  return hard && hard.struggle >= floor ? hard.name : null;
}

function describe(ctx, focus) {
  const parts = [];
  if (!focus) parts.push('No single field stood out.');
  else {
    const f = ctx.fields.find((x) => x.name === focus);
    parts.push(`User struggled most with "${focus}": ${Math.round(f.dwellMs / 1000)}s dwell, ${f.errors} validation errors, ${f.corrections} corrections. Start there and give it extra guidance.`);
  }
  // Snapshot of the screen the user is looking at right now (the "state of the DOM").
  const valid = ctx.fields.filter((f) => f.filled).map((f) => f.name), bad = ctx.fields.filter((f) => f.invalid).map((f) => f.name);
  parts.push(`Screen: ${ctx.layout}${ctx.step ? ` (step ${ctx.step.index} of ${ctx.step.of})` : ''}.`);
  if (ctx.order.length) parts.push(`Order on screen: ${ctx.order.join(', ')}.`);
  if (ctx.visible.length) parts.push(`Visible now: ${ctx.visible.join(', ')}.`);
  parts.push(`Valid: ${valid.join(', ') || 'none'}. Invalid (typed but wrong): ${bad.join(', ') || 'none'}.`);
  return parts.join(' ');
}
module.exports = { sanitizeContext, pickFocus, describe };
