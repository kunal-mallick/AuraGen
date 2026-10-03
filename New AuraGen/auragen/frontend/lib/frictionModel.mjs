// Pure friction model (no DOM, no React) so it can be unit-tested for the Week-2 Telemetry Check.
export const WINDOW_MS = 8000;                       // sliding window
export const THRESHOLD = 60;                         // score that triggers generation
export const CAP = { rage: 6, hesitation: 3, thrash: 8, errors: 3 };          // weighted events that saturate a signal
export const GAIN = { rage: 0.9, hesitation: 0.7, thrash: 0.65, errors: 0.75 }; // how alarming a fully saturated signal is

export const KINDS = Object.keys(CAP);

// events: [{ t, type, w }]  ->  { rage, hesitation, thrash, errors } each in 0..1
export function computeFingerprint(events, now) {
  const fp = {};
  for (const k of KINDS) {
    const sum = events.filter((e) => e.type === k && now - e.t >= 0 && now - e.t < WINDOW_MS).reduce((s, e) => s + e.w, 0);
    fp[k] = Math.min(1, sum / CAP[k]);
  }
  return fp;
}

// Noisy-OR: any ONE saturated signal is enough to matter, several moderate ones compound.
export function scoreFingerprint(fp) {
  const calm = KINDS.reduce((p, k) => p * (1 - GAIN[k] * fp[k] ** 1.5), 1); // ^1.5: a single stray event stays quiet
  return Math.round(100 * (1 - calm));
}

export function classify(fp, score) {
  if (score < 20) return 'calm';
  return Object.entries(fp).sort((a, b) => b[1] - a[1])[0][0];
}

export function snapshot(events, now) {
  const fingerprint = computeFingerprint(events, now);
  const score = scoreFingerprint(fingerprint);
  return { score, kind: classify(fingerprint, score), fingerprint };
}

// Synthetic confusion of one kind, as a list of events at time t.
export function syntheticEvents(kind, t) {
  const n = Math.ceil(CAP[kind] / (kind === 'rage' ? 3 : 1));
  return Array.from({ length: n }, () => ({ t, type: kind, w: kind === 'rage' ? 3 : 1 }));
}
