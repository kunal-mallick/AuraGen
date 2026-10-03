'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KINDS, THRESHOLD, WINDOW_MS, snapshot, syntheticEvents } from '../lib/frictionModel.mjs';

// Tracks mouse velocity, rage clicks, hesitation and validation errors.
// Instead of ONE opaque score we expose a 4-part "friction fingerprint" (see lib/frictionModel.mjs).
const EMPTY = { score: 0, kind: 'calm', fingerprint: { rage: 0, hesitation: 0, thrash: 0, errors: 0 } };

export function useFrictionEngine({ onTick, onTrigger, threshold = THRESHOLD, cooldownMs = 20000 }) {
  const events = useRef([]);
  const lastTriggerRef = useRef(0);
  const cb = useRef({}); cb.current = { onTick, onTrigger };
  const [state, setState] = useState(EMPTY);

  const push = useCallback((type, w = 1) => events.current.push({ t: Date.now(), type, w }), []);

  useEffect(() => {
    const m = { x: 0, y: 0, t: 0, sx: 0, sy: 0 };
    let clicks = [], lastInput = Date.now(), lastHes = 0, hot = 0;

    const onMove = (e) => {
      const now = performance.now(), dt = now - m.t;
      if (dt < 16) return;
      const dx = e.clientX - m.x, dy = e.clientY - m.y;
      const v = Math.hypot(dx, dy) / dt;                                 // px/ms mouse velocity
      const sx = Math.sign(dx), sy = Math.sign(dy);
      if (v > 0.6 && ((sx && m.sx && sx !== m.sx) || (sy && m.sy && sy !== m.sy))) push('thrash'); // fast direction reversal
      Object.assign(m, { x: e.clientX, y: e.clientY, t: now, sx: sx || m.sx, sy: sy || m.sy });
    };
    const onClick = (e) => {
      if (e.target.closest?.('[data-sim]')) return;                      // ignore our own demo buttons
      const now = Date.now();
      clicks = clicks.filter((c) => now - c.t < 700);
      clicks.push({ t: now, x: e.clientX, y: e.clientY });
      const near = clicks.filter((c) => Math.hypot(c.x - e.clientX, c.y - e.clientY) < 40);
      if (near.length >= 3) { push('rage', 3); clicks = []; }            // 3+ clicks, <700ms, <40px
      if (e.target.closest?.('[aria-invalid="true"],:disabled')) push('errors');
    };
    const onInvalid = () => push('errors');
    const touch = () => { lastInput = Date.now(); };

    const tick = setInterval(() => {
      const now = Date.now();
      const el = document.activeElement;
      if (el && /INPUT|SELECT|TEXTAREA/.test(el.tagName) && now - lastInput > 4000 && now - lastHes > 4000) { push('hesitation'); lastHes = now; }
      events.current = events.current.filter((e) => now - e.t < WINDOW_MS);
      const next = snapshot(events.current, now);
      setState(next); cb.current.onTick?.(next);
      hot = next.score >= threshold ? hot + 1 : 0;
      if (hot >= 2 && now - lastTriggerRef.current > cooldownMs) { lastTriggerRef.current = now; hot = 0; cb.current.onTrigger?.(next); }
    }, 1000);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('click', onClick, true);
    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', touch, true);
    document.addEventListener('focusin', touch, true);
    return () => {
      clearInterval(tick);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('click', onClick, true);
      document.removeEventListener('invalid', onInvalid, true); document.removeEventListener('input', touch, true); document.removeEventListener('focusin', touch, true);
    };
  }, [push, threshold, cooldownMs]);

  // Week-2 "Telemetry Check" helper: inject ONE kind of synthetic confusion, no human needed.
  const simulate = useCallback((kind = 'rage') => {
    if (!KINDS.includes(kind)) return;
    events.current.push(...syntheticEvents(kind, Date.now()));
  }, []);
  // Demo reset: forget old events and allow an immediate new trigger.
  const rearm = useCallback(() => { events.current = []; lastTriggerRef.current = 0; }, []);
  return { ...state, simulate, rearm, windowMs: WINDOW_MS };
}
