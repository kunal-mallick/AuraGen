const assert = require('assert');
const { validate } = require('../src/validator');
const { compile } = require('../src/compile');
const tpl = require('../src/templateWizard');

const good = tpl('rage');
assert.ok(validate(good).ok, 'template must pass');
assert.ok(compile(good).code.includes('React.createElement'), 'compiles to classic JSX');

const bad = {
  'syntax error': 'export default function W( { return <div> }',
  'import': "import fs from 'fs'; export default function W(){return <div/>}",
  'fetch': "export default function W(){ fetch('//evil'); return <div/> }",
  'window': 'export default function W(){ window.location="x"; return <div/> }',
  'eval': 'export default function W(){ eval("1"); return <div/> }',
  'constructor escape': "export default function W(){ ''['constructor']['constructor']('1')(); return <div/> }",
  'built property': "export default function W(){ const a={}; a['con'+'structor']; return <div/> }",
  'script tag': 'export default function W(){ return <script/> }',
  'innerHTML': 'export default function W(){ return <div dangerouslySetInnerHTML={{__html:"x"}}/> }',
  'unknown UI': 'export default function W(){ return <UI.Iframe/> }',
  'no default': 'function W(){ return <div/> }',
};
for (const [name, code] of Object.entries(bad)) {
  const r = validate(code);
  assert.ok(!r.ok, `should reject: ${name}`);
  console.log(`  rejected  ${name.padEnd(20)} -> ${r.errors[0]}`);
}
console.log('All validator tests passed');
