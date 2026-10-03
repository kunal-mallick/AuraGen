// Tiny LRU + TTL cache. Safe to key without typed values: generated components read `values` at runtime,
// so the same source serves every user in the same situation (kind + form shape + focus field).
const crypto = require('crypto');
class GenCache {
  constructor({ max = 50, ttlMs = 10 * 60 * 1000 } = {}) { this.max = max; this.ttlMs = ttlMs; this.m = new Map(); this.hits = 0; this.misses = 0; }
  key(parts) { return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex'); }
  get(k) {
    const e = this.m.get(k);
    if (!e || Date.now() - e.t > this.ttlMs) { if (e) this.m.delete(k); this.misses++; return null; }
    this.m.delete(k); this.m.set(k, e); this.hits++; return e.v;       // refresh recency
  }
  set(k, v) { this.m.set(k, { v, t: Date.now() }); if (this.m.size > this.max) this.m.delete(this.m.keys().next().value); }
  clear() { this.m.clear(); }
}
module.exports = { GenCache };
