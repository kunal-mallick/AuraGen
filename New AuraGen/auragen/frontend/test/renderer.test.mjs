// Tests the REAL DynamicRenderer.jsx: Suspense + dynamic import + in-browser Babel compile + error fallback.
import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
for (const k of ['SVGElement', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'getComputedStyle']) globalThis[k] ??= dom.window[k];   // framer-motion expects a browser
dom.window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Bundle the real component (react stays external so the test and component share one React).
const out = path.join(here, '.tmp'); fs.mkdirSync(out, { recursive: true });
await build({ entryPoints: [path.join(here, '../components/DynamicRenderer.jsx')], bundle: true, platform: 'node', format: 'cjs',
  external: ['react', 'react-dom'], loader: { '.js': 'jsx' }, outfile: path.join(out, 'DynamicRenderer.cjs'), logLevel: 'error' });
const React = require('react');
const { createRoot } = require('react-dom/client');
const DynamicRenderer = require('./.tmp/DynamicRenderer.cjs').default;
const template = require('../../backend/src/templateWizard');
const { FIELDS } = await import('../components/fields.mjs');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(fn);
async function until(el, pred, ms = 5000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { await act(() => sleep(25)); if (pred(el.textContent)) return; } throw new Error('timeout; DOM says: ' + el.textContent); }

async function mount(props) {
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el); const calls = { fail: [], compiled: [] };
  await act(() => root.render(React.createElement(DynamicRenderer, { fields: FIELDS, values: { fullName: 'Aryan', pan: 'ABCDE1234F' }, onChange() {}, onSubmit() {},
    fallback: React.createElement('div', null, 'ORIGINAL FORM'), onFail: (e) => calls.fail.push(e), onCompiled: (ms) => calls.compiled.push(ms), ...props })));
  return { el, calls };
}
const good = template('rage');
let n = 0; const pass = (name, extra = '') => console.log(`  PASS  ${name}${extra ? '  (' + extra + ')' : ''}`);

console.log('DynamicRenderer (Suspense + in-browser compile)');
{
  const { el, calls } = await mount({ source: good, hash: sha(good) });
  assert.ok(el.textContent.includes('ORIGINAL FORM'), 'while Babel loads, Suspense must keep the original form on screen');
  await until(el, (t) => t.includes('Step 3 of 6'));
  assert.ok(!el.textContent.includes('ORIGINAL FORM') && calls.fail.length === 0);
  assert.ok(calls.compiled.length >= 1, 'onCompiled must report compile time');
  pass('suspends on original form, then renders compiled wizard at first empty field', `compiled in ${calls.compiled[0]}ms`);
}
{
  const { el, calls } = await mount({ source: good + '\n// tampered', hash: sha(good) });
  await until(el, () => calls.fail.length > 0);
  assert.ok(/integrity/.test(calls.fail[0]) && el.textContent.includes('ORIGINAL FORM'));
  pass('tampered source (hash mismatch) is refused, original form restored');
}
{
  const bad = 'export default function W( { return <div> }';
  const { el, calls } = await mount({ source: bad, hash: sha(bad) });
  await until(el, () => calls.fail.length > 0);
  assert.ok(el.textContent.includes('ORIGINAL FORM'));
  pass('syntax error from compile -> original form restored', calls.fail[0].split('\n')[0].slice(0, 60));
}
{
  const boom = 'export default function W(){ const x = null; return <div>{x.y}</div> }';
  const { el, calls } = await mount({ source: boom, hash: sha(boom) });
  await until(el, () => calls.fail.length > 0);
  assert.ok(el.textContent.includes('ORIGINAL FORM'));
  pass('runtime crash in generated component -> error boundary restores original form');
}
{
  const noDefault = 'export const x = 1;';
  const { el, calls } = await mount({ source: noDefault, hash: sha(noDefault) });
  await until(el, () => calls.fail.length > 0);
  pass('module without a component -> original form restored', calls.fail[0]);
}
fs.rmSync(out, { recursive: true, force: true });
console.log('Renderer tests passed');
process.exit(0);
