'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrictionEngine } from '../hooks/useFrictionEngine';
import { useSocket } from '../hooks/useSocket';
import { useFormContext } from '../hooks/useFormContext';
import DynamicRenderer from '../components/DynamicRenderer';
import StaticForm from '../components/StaticForm';
import { FIELDS } from '../components/fields.mjs';
import { createRetryGate, createTokenPreview, noticeFor } from '../lib/resilience.mjs';

const CLIENT_TIMEOUT_MS = 12000;   // server budget is 8s; this only catches a dead/hung connection
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws';

export default function Page() {
  const [values, setValues] = useState({});
  const [gen, setGen] = useState(null);
  const [status, setStatus] = useState('Watching…');
  const [ctx, setCtx] = useState(null);
  const [lat, setLat] = useState(null);
  const [preview, setPreview] = useState('');
  const t0 = useRef(0), fc = useFormContext(), gate = useRef(createRetryGate()), tokens = useRef(createTokenPreview()), watchdog = useRef(null);
  const busy = useRef(false), vref = useRef(values), genRef = useRef(gen);
  vref.current = values; genRef.current = gen;

  const { state: conn, send } = useSocket(WS_URL, (m) => {
    if (m.type === 'status') setStatus(m.message);
    if (m.type === 'token-reset') setPreview(tokens.current.reset());
    if (m.type === 'token') setPreview(tokens.current.push(m.chunk));
    if (m.type === 'component') { clearTimeout(watchdog.current); gate.current.ok(); setPreview(''); setGen(m); setLat({ roundTrip: Math.round(performance.now() - t0.current), server: m.timings?.totalMs, cached: m.report.cached }); setStatus(`Downloaded ${m.source.length}B in ${m.ms}ms (${m.report.mode}, attempts ${m.report.attempts}), compiling in browser…`); busy.current = false; }
    if (m.type === 'error') { clearTimeout(watchdog.current); gate.current.fail(); setPreview(''); setStatus('Generation failed, keeping the original form'); busy.current = false; }
  });
  useEffect(() => { if (conn !== 'open') busy.current = false; }, [conn]);   // a dropped socket must not leave us stuck "busy"

  const f = useFrictionEngine({
    onTick: (t) => { send({ type: 'telemetry', ...t }); setCtx(fc.snapshot(FIELDS, vref.current)); },
    onTrigger: (t) => {
      if (busy.current || genRef.current) return;
      if (!gate.current.canTrigger()) { setStatus('Redesign paused after repeated failures, original form kept'); return; }   // retry limit
      busy.current = true; tokens.current.reset(); setPreview('');
      clearTimeout(watchdog.current);
      watchdog.current = setTimeout(() => { if (!busy.current) return; busy.current = false; gate.current.fail(); setStatus('Redesign took too long, keeping the original form'); }, CLIENT_TIMEOUT_MS); t0.current = performance.now(); setStatus('Friction detected…');
      send({ type: 'friction', ...t, fields: FIELDS, values: vref.current, context: fc.snapshot(FIELDS, vref.current) });
    },
  });
  const onChange = (k, v) => setValues((p) => ({ ...p, [k]: v }));
  const onSubmit = () => alert('Submitted: ' + JSON.stringify(values, null, 2));
  const props = { fields: FIELDS, values, onChange, onSubmit };
  const fallback = <StaticForm {...props} />;
  const dot = conn === 'open' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse';

  return (
    <main className="p-8 space-y-6">
      <div className="max-w-4xl mx-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-200 font-mono">
        <div className="flex justify-between gap-4">
          <span>Cognitive Load Score: <b>{f.score}</b> ({f.kind})</span>
          <span className="flex items-center gap-2"><i className={`inline-block h-2 w-2 rounded-full ${dot}`} />{conn}<span className="text-slate-400">· {status}</span></span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {Object.entries(f.fingerprint).map(([k, v]) => (
            <div key={k}>{k}<div className="h-1.5 bg-slate-700 rounded"><div className="h-1.5 bg-amber-400 rounded" style={{ width: `${v * 100}%` }} /></div></div>
          ))}
        </div>
        <div className="mt-2 text-slate-300">
          {(() => { const top = ctx?.fields.filter((x) => !x.filled).sort((a, b) => b.struggle - a.struggle)[0];
            return <>stuck on: <b>{top && top.struggle >= 0.25 ? `${top.name} (struggle ${top.struggle})` : 'nothing yet'}</b> · filled {ctx?.filledCount ?? 0}/{FIELDS.length}</>; })()}
          {lat && <span className="ml-3">friction → new UI: <b>{lat.total ?? '…'}ms</b> (server {lat.server}ms{lat.cached ? ', cached' : ''}, round trip {lat.roundTrip}ms){gen?.focusField ? ` · opened on ${gen.focusField}` : ''}</span>}
        </div>
        <div className="mt-3 flex gap-2">
          {['rage', 'hesitation', 'errors', 'thrash'].map((k) => <button key={k} data-sim onClick={() => f.simulate(k)} className="rounded bg-slate-700 px-2 py-1">simulate {k}</button>)}
          <button data-sim onClick={() => { setGen(null); setLat(null); setPreview(''); gate.current.reset(); clearTimeout(watchdog.current); fc.reset(); f.rearm(); busy.current = false; setStatus('Reset'); }} className="rounded bg-slate-700 px-2 py-1 ml-auto">reset UI</button>
        </div>
      </div>
      {preview && <pre data-testid="token-preview" className="max-w-4xl mx-auto max-h-32 overflow-hidden rounded-xl bg-slate-950 p-3 text-[10px] leading-tight text-emerald-300">{preview}</pre>}
      {gen?.report && noticeFor(gen.report) && <div role="status" data-testid="simplified-notice" className="max-w-xl mx-auto rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">{noticeFor(gen.report)}</div>}
      {gen
        ? <DynamicRenderer source={gen.source} hash={gen.hash} fallback={fallback}
            focusField={gen.focusField || undefined}
            onCompiled={(ms) => { setStatus(`Morphed: compiled in browser in ${ms}ms (${gen.report.mode}${gen.report.cached ? ', cached' : ''}, hash ${gen.hash.slice(0, 8)})`); setLat((l) => l && { ...l, total: Math.round(performance.now() - t0.current) }); }}
            onFail={(e) => setStatus('Render failed, original form restored: ' + e)} {...props} />
        : fallback}
    </main>
  );
}
