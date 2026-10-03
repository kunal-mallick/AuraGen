'use client';
import { useCallback, useEffect, useRef } from 'react';
import { buildContext, readDom } from '../lib/domContext.mjs';

// Records per-field focus/blur/error/delete events from anything carrying data-field (see UI.Field).
// Works for BOTH the static form and any generated UI, because both render UI.Field.
export function useFormContext() {
  const events = useRef([]);
  useEffect(() => {
    const fieldOf = (t) => t?.closest?.('[data-field]')?.getAttribute('data-field');
    const add = (type) => (e) => { const field = fieldOf(e.target); if (field) events.current.push({ t: Date.now(), field, type }); };
    const onInput = (e) => { if (e.inputType?.startsWith('delete')) add('delete')(e); };
    const h = { focusin: add('focus'), focusout: add('blur'), invalid: add('error'), input: onInput };
    for (const [k, fn] of Object.entries(h)) document.addEventListener(k, fn, true);
    return () => { for (const [k, fn] of Object.entries(h)) document.removeEventListener(k, fn, true); };
  }, []);
  const snapshot = useCallback((fields, values) => buildContext(fields, values, events.current.slice(-500), Date.now(), readDom(document)), []);
  const reset = useCallback(() => { events.current = []; }, []);
  return { snapshot, reset };
}
