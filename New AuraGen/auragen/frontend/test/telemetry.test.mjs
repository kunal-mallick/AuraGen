// Week-2 "Telemetry Check": prove the score SPIKES during simulated confusion and stays calm otherwise.
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { KINDS, THRESHOLD, WINDOW_MS, snapshot, syntheticEvents } from '../lib/frictionModel.mjs';

export function runTelemetryCheck(log = () => {}) {
  const rows = [];
  const spark = (v) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor(v / 12.6))];

  // 1. A calm user: a few stray events, never enough to matter.
  const calm = [{ t: 0, type: 'thrash', w: 1 }, { t: 3000, type: 'hesitation', w: 1 }];
  const calmScore = Math.max(...[0, 2000, 4000, 6000, 8000].map((t) => snapshot(calm, t).score));
  assert.ok(calmScore < 20, `calm baseline must stay under 20, got ${calmScore}`);
  rows.push({ scenario: 'calm baseline', peak: calmScore, kind: 'calm', triggers: false, series: '' });

  // 2. Each kind of confusion, injected at t=5s into a 20s timeline.
  for (const kind of KINDS) {
    const ev = syntheticEvents(kind, 5000);
    const series = Array.from({ length: 21 }, (_, s) => snapshot(ev, s * 1000));
    const before = series[4].score, peak = Math.max(...series.map((x) => x.score)), after = series[5 + WINDOW_MS / 1000 + 1].score;
    const peakSnap = series[5];
    assert.ok(before < 20, `${kind}: before spike should be calm (${before})`);
    assert.ok(peak >= THRESHOLD, `${kind}: peak ${peak} must reach trigger threshold ${THRESHOLD}`);
    assert.equal(peakSnap.kind, kind, `${kind}: dominant signal must be identified (got ${peakSnap.kind})`);
    assert.ok(after < 20, `${kind}: score must decay after the ${WINDOW_MS}ms window (${after})`);
    rows.push({ scenario: `simulate ${kind}`, peak, kind: peakSnap.kind, triggers: true, series: series.map((x) => spark(x.score)).join('') });
  }

  // 3. Compounding: two moderate signals together should beat either alone.
  const mix = [...syntheticEvents('hesitation', 0).slice(0, 2), ...syntheticEvents('errors', 0).slice(0, 2)];
  const only = (type) => snapshot(mix.filter((e) => e.type === type), 0).score;
  const both = snapshot(mix, 0).score;
  assert.ok(both > only('hesitation') && both > only('errors'), 'mixed signals should compound');
  rows.push({ scenario: 'hesitation+errors mix', peak: both, kind: snapshot(mix, 0).kind, triggers: both >= THRESHOLD, series: '' });

  rows.forEach((r) => log(`  ${r.scenario.padEnd(24)} peak ${String(r.peak).padStart(3)}  dominant=${r.kind.padEnd(10)} ${r.series}`));
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Telemetry Check (score over 20s, spike injected at t=5s)');
  runTelemetryCheck(console.log);
  console.log('Telemetry check passed');
}
