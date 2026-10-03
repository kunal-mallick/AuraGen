'use client';
import React, { Component, Suspense } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import * as UI from './UI';
import { compileInBrowser } from '../lib/browserCompile';

// Suspense-friendly resource cache: compiling is async (Babel is dynamically imported), so the
// component "suspends" by throwing the promise until the compiled component is ready.
const cache = new Map();
function read(source, hash) {
  const key = `${hash || ''}|${source}`;   // include source: a tampered body must not reuse a verified entry
  let e = cache.get(key);
  if (!e) {
    const t0 = performance.now();
    e = { status: 'pending' };
    e.promise = compileInBrowser(source, hash)
      .then((code) => {
        const exports = {};
        new Function('React', 'UI', 'exports', code)(React, UI, exports);   // ONLY React + UI in scope
        if (typeof exports.default !== 'function') throw new Error('generated module has no default component');
        e.status = 'ready'; e.Comp = exports.default; e.ms = Math.round(performance.now() - t0);
      })
      .catch((err) => { e.status = 'error'; e.error = err; });
    cache.set(key, e);
    if (cache.size > 20) cache.delete(cache.keys().next().value);
  }
  if (e.status === 'pending') throw e.promise;
  if (e.status === 'error') throw e.error;
  return e;
}

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { this.props.onFail?.(err.message); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

function Compiled({ source, hash, onCompiled, ...props }) {
  const { Comp, ms } = read(source, hash);
  const reduce = useReducedMotion();
  React.useEffect(() => { onCompiled?.(ms); }, [ms]);
  // The "morph": the new UI eases in over the original form (skipped for prefers-reduced-motion users).
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
      <Comp {...props} />
    </motion.div>
  );
}

// While Babel loads, Suspense keeps the ORIGINAL form on screen (no blank flash).
// Any compile/runtime failure falls back to the original form too.
export default function DynamicRenderer({ source, hash, fallback, onFail, onCompiled, ...props }) {
  return (
    <Boundary key={`${hash || ''}|${source}`} fallback={fallback} onFail={onFail}>
      <Suspense fallback={fallback}>
        <Compiled source={source} hash={hash} onCompiled={onCompiled} {...props} />
      </Suspense>
    </Boundary>
  );
}
