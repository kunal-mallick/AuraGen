// Week 3: DOM-state context. WHICH field is the user struggling with, not just THAT they struggle.
// Pure (no DOM/React) so it is unit-testable; the hook feeds it events, the page sends the snapshot.
export const DWELL_HESITATION_MS = 4000;

// events: { t, field, type: 'focus' | 'blur' | 'error' | 'delete' | 'input' }
export function buildContext(fields, values, events, now, dom = {}) {
  const stats = Object.fromEntries(fields.map((f) => [f.name, { dwellMs: 0, errors: 0, corrections: 0 }]));
  let focused = null, focusedAt = 0;
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    const s = stats[e.field];
    if (e.type === 'focus') { focused = e.field; focusedAt = e.t; }
    else if (e.type === 'blur') { if (s && focused === e.field) s.dwellMs += Math.max(0, e.t - focusedAt); focused = null; }
    else if (s && e.type === 'error') s.errors += 1;
    else if (s && e.type === 'delete') s.corrections += 1;
  }
  if (focused && stats[focused]) stats[focused].dwellMs += Math.max(0, now - focusedAt);   // still inside the field

  const out = fields.map((f) => {
    const s = stats[f.name];
    const v = String(values[f.name] ?? '');
    // "Filled" means non-empty AND valid: someone stuck on a wrong PAN has typed something, but is NOT done.
    const valid = !f.pattern || new RegExp(f.pattern).test(v);
    const filled = v !== '' && valid;
    // Struggle = long dwell + errors (weighted high) + corrections (backspacing), capped per part.
    const struggle = Math.min(1, s.dwellMs / 12000) * 0.4 + Math.min(1, s.errors / 3) * 0.4 + Math.min(1, s.corrections / 8) * 0.2;
    return { name: f.name, filled, invalid: v !== '' && !valid, dwellMs: Math.round(s.dwellMs), errors: s.errors, corrections: s.corrections, struggle: Math.round(struggle * 100) / 100 };
  });
  // The screen as the user sees it: field order, which are visible, and which step (wizard) is showing.
  const known = new Set(fields.map((f) => f.name));
  const order = (dom.order || []).filter((n) => known.has(n)), visible = (dom.visible || []).filter((n) => known.has(n));
  const wizard = visible.length > 0 && visible.length < fields.length;
  const step = wizard && visible.length === 1 ? { index: fields.findIndex((f) => f.name === visible[0]) + 1, of: fields.length } : null;
  return { layout: wizard ? 'wizard' : 'form', order, visible, step, focused, filledCount: out.filter((x) => x.filled).length, total: out.length, fields: out };
}

// Read the live DOM: every [data-field] in document order, and which of them are actually showing.
// `root` is any Document/Element (a real one in the browser, jsdom in tests).
export function readDom(root) {
  const els = [...(root?.querySelectorAll?.('[data-field]') || [])];
  const shown = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { if (n.hidden || n.getAttribute('aria-hidden') === 'true' || n.style?.display === 'none') return false; } return true; };
  return { order: els.map((e) => e.getAttribute('data-field')), visible: els.filter(shown).map((e) => e.getAttribute('data-field')) };
}
