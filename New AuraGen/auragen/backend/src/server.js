const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { generate, prewarm } = require('./codegen');

// The browser downloads RAW validated source and compiles it itself, so `code` is never sent.
const publicPayload = ({ source, hash, report, focusField, timings }) => ({ source, hash, report, focusField: focusField || null, timings });

function createServer() {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {           // dev CORS for the Next.js frontend
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' });
    req.method === 'OPTIONS' ? res.sendStatus(204) : next();
  });
  app.get('/health', (_, res) => res.json({ ok: true }));
  // REST twin of the WebSocket flow: download raw generated code for a friction kind.
  app.post('/api/generate', async (req, res) => {
    const t0 = Date.now();
    try { res.json({ ...publicPayload(await generate(req.body || {})), ms: Date.now() - t0 }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  wss.on('connection', (ws) => {
    const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
    ws.on('message', async (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.type === 'telemetry') return; // Week 3: persist for contextual awareness
      if (m.type === 'friction') {
        const t0 = Date.now();
        try {
          // Tokens are batched (~60ms) so a fast model does not flood the socket. They are a PREVIEW only:
          // the browser compiles nothing until the validated 'component' message arrives.
          let buf = '', timer = null;
          const flush = () => { timer = null; if (buf) { send({ type: 'token', chunk: buf }); buf = ''; } };
          const onToken = (t) => {
            if (t.reset) { clearTimeout(timer); timer = null; buf = ''; send({ type: 'token-reset', attempt: t.attempt }); return; }
            buf += t.chunk; if (!timer) timer = setTimeout(flush, 60);
          };
          const out = await generate(m, (message) => send({ type: 'status', message }), { onToken });
          clearTimeout(timer); flush();            // deliver any tail tokens before the component, never drop them
          send({ type: 'component', ...publicPayload(out), ms: Date.now() - t0 });
        } catch (e) { send({ type: 'error', message: e.message }); }
      }
    });
  });
  return server;
}

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  createServer().listen(PORT, () => {
    console.log(`AuraGen backend :${PORT}  (LLM: ${process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'template-only')})`);
    if (process.env.PREWARM === '0') return;
    // Pre-generate one design per friction kind so the first real redesign is a cache hit.
    import('../../frontend/components/fields.mjs').then(({ FIELDS }) => prewarm(FIELDS))
      .then((r) => console.log(`Pre-warmed ${r.warmed} designs in ${r.ms}ms${r.degraded ? ` (${r.degraded} degraded, will retry on demand)` : ''}`))
      .catch((e) => console.log('Pre-warm skipped:', e.message));
  });
}
module.exports = { createServer };
