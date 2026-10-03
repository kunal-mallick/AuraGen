// Week 4: keep a slow or failing LLM from hurting the user.
// - withTimeout: a hard deadline that works even if the model ignores AbortSignal.
// - CircuitBreaker: after N consecutive LLM failures, skip the LLM for a cooldown and serve the
//   validated template straight away (no more 8-second waits on every trigger), then probe once.
class TimeoutError extends Error { constructor(ms) { super(`LLM timed out after ${ms}ms`); this.name = 'TimeoutError'; } }

function withTimeout(run, ms) {
  const ac = new AbortController();
  let timer;
  const deadline = new Promise((_, rej) => { timer = setTimeout(() => { ac.abort(); rej(new TimeoutError(ms)); }, ms); });
  const work = Promise.resolve().then(() => run(ac.signal));
  work.catch(() => {});                                   // a late rejection after the deadline must not crash the process
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

class CircuitBreaker {
  constructor({ maxFailures = 3, cooldownMs = 60000, now = Date.now } = {}) {
    Object.assign(this, { maxFailures, cooldownMs, now, failures: 0, openedAt: 0, probing: false });
  }
  get state() {
    if (this.failures < this.maxFailures) return 'closed';
    return this.now() - this.openedAt >= this.cooldownMs ? 'half-open' : 'open';
  }
  // May we call the LLM right now? In half-open exactly one probe is allowed at a time.
  allow() {
    const s = this.state;
    if (s === 'closed') return true;
    if (s === 'half-open' && !this.probing) { this.probing = true; return true; }
    return false;
  }
  success() { this.failures = 0; this.probing = false; }
  failure() {
    this.failures++; this.probing = false;
    if (this.failures >= this.maxFailures) this.openedAt = this.now();   // (re)open: a failed probe restarts the cooldown
  }
}
module.exports = { withTimeout, CircuitBreaker, TimeoutError };
