# AuraGen: Weeks 1-4 (complete)

## Setup
    cp .env.example backend/.env     # optional: add OPENAI_API_KEY (never commit .env)
    # Node 20+ required

## Run
    cd backend  && npm i && npm start          # :4000  (REST + WebSocket)
    cd frontend && npm i && npm run dev        # :3000
LLM is optional. Without one, a validated template is used:
    OPENAI_API_KEY=sk-...                      # GPT-4o
    LLM_PROVIDER=ollama OLLAMA_MODEL=llama3    # local / private

## Prove it works (no API keys, no browser, no human)
    cd backend  && npm test        # validator (11 attacks) + Generation Audit (51 checks) -> writes ../AUDIT.md
    cd frontend && npm test        # Telemetry Check (score spikes) + DynamicRenderer tests
    cd frontend && npm run build   # production Next.js build
    python e2e/run.py              # real Chromium end-to-end (pip install playwright; playwright install chromium)
    python e2e/run_degraded.py     # same, with the LLM genuinely unreachable: notice, fallback, circuit breaker

## Try it on YOUR model (the one thing I cannot run for you)
    cd backend && OPENAI_API_KEY=sk-... npm run bench -- --runs 5
    cd backend && LLM_PROVIDER=ollama OLLAMA_MODEL=llama3 npm run bench
Writes `backend/bench/RESULTS.md`: first-try pass rate, self-heal rate, fallback rate, cold vs cached latency (p50/p95). Use it for the mid-project "consistently valid" claim and the Week 4 "under 2 s" claim.

## Week 1
- `backend/src/codegen.js`: LangChain pipeline (prompt | model | parser), GPT-4o or Ollama, design-system contract in the prompt.
- `frontend/hooks/useFrictionEngine.js` + `lib/frictionModel.mjs`: mouse velocity, rage clicks, hesitation, validation errors, streamed over WebSockets.
- `frontend/hooks/useSocket.js`: auto-reconnect with backoff; a friction trigger fired while offline is replayed on reconnect.

## Week 2
- `backend/src/validator.js`: allowlist AST validator. `POST /api/generate` and the WebSocket both return RAW validated source.
- `frontend/lib/browserCompile.js`: downloads raw code, verifies its SHA-256, compiles in the browser with a dynamically imported `@babel/standalone`.
- `frontend/components/DynamicRenderer.jsx`: Suspense (original form stays visible while Babel loads) + error boundary + only React and UI in scope.

## Mid-project deliverables
| Deliverable | Evidence |
|---|---|
| Generation Audit | `npm test` in backend; results in `AUDIT.md` |
| Telemetry Check | `npm test` in frontend (score series per friction kind) and the "simulate" buttons on the page |

## Week 3: contextual awareness, speed, polish
- **DOM-state context** (`lib/domContext.mjs`, `hooks/useFormContext.js`): per-field dwell time, validation errors and backspacing. The browser sends WHICH field the user is stuck on, not just THAT they are stuck.
- **Focus field** (`backend/src/context.js`): the unfilled-or-invalid field with the highest struggle. The generated wizard opens on it with extra guidance, so the user resumes exactly where they were stuck. Client context is untrusted and sanitised.
- **Real validation** in `UI.Field` (pattern + error message). A bad blur fires a native `invalid` event, so the "errors" signal now comes from real mistakes. A field only counts as "filled" if its value is valid.
- **Cache** (`backend/src/cache.js`): LRU + TTL keyed by kind, focus field and form shape (not typed values). Degraded template fallbacks are never cached, so the next user retries the LLM.
- **Streaming**: LLM tokens stream, and the page shows live "Writing component… N chars" progress.
- **Morph animation**: Framer Motion eases the new UI in (respects prefers-reduced-motion).
- **Latency**: per-phase timings (LLM, validate, compile, total) and a live "friction -> new UI" readout. Template path is ~0.2s server-side, ~0.8s end to end in Chromium; cached hits are ~0ms server-side. With a real LLM the time is dominated by the model.

## Week 4: latency, streaming, graceful degradation
- **Fuller DOM snapshot** (closes the Week 3 gap): besides per-field struggle, the browser now reports on-screen field order, which fields are visible, whether it is the full form or a wizard step (and which), and valid vs typed-but-invalid fields. All of it is sanitised server-side and written into the LLM prompt.
- **Token streaming**: raw tokens go to the browser as `token` frames (batched ~60 ms) and show as a live preview. Nothing is compiled from them: the validator needs the complete source, so the browser still compiles only the validated `component` message. A test proves an unsafe draft can be streamed as preview text yet is never delivered as a component.
- **Timeout**: one hard budget for the whole redesign (default 8 s, `LLM_TIMEOUT_MS`), across all self-heal attempts, enforced even if the model ignores abort. A late answer is never used.
- **Circuit breaker** (`src/resilience.js`): after 3 consecutive LLM failures (`LLM_MAX_FAILURES`) the LLM is skipped for 60 s (`LLM_COOLDOWN_MS`) and users get the validated template instantly. Then one probe at a time: success closes it, failure restarts the cooldown.
- **Visible fallback**: `report.degraded` / `reason` (timeout, llm-error, invalid, circuit-open) drives a "Simplified design" banner on the page. Degraded designs are never cached.
- **Browser safety net**: 12 s watchdog for a hung connection, and a retry gate that stops auto-triggering after 2 failures (the reset button re-arms it).
- **Pre-warm**: at startup one design per friction kind is generated and cached (`PREWARM=0` to disable), so the first real redesign is a cache hit.
- **Benchmark**: `npm run bench` (see above).

## What makes it different
1. Friction fingerprint (rage / hesitation / thrash / errors); the dominant signal changes the design the LLM is asked for.
2. Allowlist validation, not a blocklist.
3. Self-healing loop: validator errors go back to the LLM (3 attempts), then a validated template takes over.
4. One design-system definition drives the prompt and the validator; the audit fails if the frontend UI drifts from it.
5. Typed data survives the morph: wizard starts at the first empty field.
6. Integrity hash: the browser refuses source that does not match the server's hash.
7. Noisy-OR scoring with a convex curve: stray events stay calm, one saturated signal triggers.

## Not done / honest limits
- Nothing here has run against a real GPT-4o or Ollama model. The audit uses a scripted model and the browser tests use the template or an unreachable Ollama. Run `npm run bench` to get real numbers; with a real model the time is dominated by the model and the 2 s target may only hold for cached or pre-warmed designs.
- Pre-warm covers the "no single stuck field" case; a design for a specific stuck field is cached after its first occurrence.
- Persisting sessions/telemetry server-side, auth and deployment are out of scope.
