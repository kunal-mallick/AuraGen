// In-browser compile step (Week 2): the server ships RAW, already-validated JSX; we compile it here.
// @babel/standalone is large, so it is loaded with a dynamic import() only when a morph actually happens.
let babelPromise;
const loadBabel = () => (babelPromise ||= import('@babel/standalone').then((m) => m.default || m));

export async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;                                   // insecure context: skip the integrity check
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function compileInBrowser(source, expectedHash) {
  const actual = await sha256Hex(source);
  if (expectedHash && actual && actual !== expectedHash) throw new Error('integrity check failed: source does not match server hash');
  const Babel = await loadBabel();
  return Babel.transform(source, {
    sourceType: 'module',
    presets: [['react', { runtime: 'classic' }]],
    plugins: ['transform-modules-commonjs'],
  }).code;
}
