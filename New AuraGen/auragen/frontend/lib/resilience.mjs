// Week 4 (browser side): never wait forever, never hammer a failing backend, never show half-written code as UI.

// Allow at most `max` consecutive failures, then stop auto-triggering until `cooldownMs` passes or reset() is called.
export function createRetryGate({ max = 2, cooldownMs = 30000, now = Date.now } = {}) {
  let fails = 0, blockedAt = 0;
  return {
    get failures() { return fails; },
    canTrigger() { return fails < max || now() - blockedAt >= cooldownMs; },
    fail() { fails++; if (fails >= max) blockedAt = now(); },
    ok() { fails = 0; },
    reset() { fails = 0; blockedAt = 0; },
  };
}

// Live token preview. Text only: it is shown in a <pre>, never compiled or executed.
export function createTokenPreview(maxChars = 1200) {
  let text = '';
  return {
    push(chunk) { text = (text + String(chunk ?? '')).slice(-maxChars); return text; },
    reset() { text = ''; return text; },
    get text() { return text; },
  };
}

// Plain-English reason for the "simplified design" banner.
export function noticeFor(report) {
  if (!report?.degraded) return null;
  const why = { timeout: 'the AI took too long', 'llm-error': 'the AI service had a problem', invalid: 'the AI draft did not pass our safety checks', 'circuit-open': 'the AI service is temporarily paused' }[report.reason] || 'the AI design was unavailable';
  return `Simplified design: ${why}, so we're showing a safe standard step-by-step form. Your answers are kept.`;
}
