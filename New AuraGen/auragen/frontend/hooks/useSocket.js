'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// WebSocket with automatic reconnect (exponential backoff + jitter).
// While offline: telemetry is dropped (it is only a stream), but the latest friction request is queued
// and sent on reconnect so a trigger fired during a blip is not lost.
export function useSocket(url, onMessage) {
  const [state, setState] = useState('connecting');           // connecting | open | reconnecting
  const ref = useRef({ ws: null, queued: null, tries: 0, closed: false, timer: null });
  const handler = useRef(onMessage); handler.current = onMessage;

  useEffect(() => {
    const s = ref.current; s.closed = false;
    const open = () => {
      const ws = new WebSocket(url); s.ws = ws;
      ws.onopen = () => { s.tries = 0; setState('open'); if (s.queued) { ws.send(s.queued); s.queued = null; } };
      ws.onmessage = (e) => { try { handler.current(JSON.parse(e.data)); } catch { /* ignore malformed frames */ } };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (s.closed) return;
        setState('reconnecting');
        const delay = Math.min(10000, 500 * 2 ** s.tries++) * (0.5 + Math.random() / 2);
        s.timer = setTimeout(open, delay);
      };
    };
    open();
    return () => { s.closed = true; clearTimeout(s.timer); s.ws?.close(); };
  }, [url]);

  const send = useCallback((m) => {
    const s = ref.current, data = JSON.stringify(m);
    if (s.ws?.readyState === 1) s.ws.send(data);
    else if (m.type === 'friction') s.queued = data;
  }, []);
  return { state, send };
}
