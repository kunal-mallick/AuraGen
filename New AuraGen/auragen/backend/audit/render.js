// Render harness: runs generated components exactly like the browser shell does
// (compiled CommonJS, ONLY React + UI in scope), inside jsdom, and lets tests click and type.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { createRoot } = require('react-dom/client');

// Load the REAL design system from the frontend.
const uiSrc = fs.readFileSync(path.join(__dirname, '../../frontend/components/UI.jsx'), 'utf8');
const uiCode = babel.transformSync(uiSrc, {
  babelrc: false, configFile: false,
  presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
  plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
}).code;
const UI = (() => { const m = { exports: {} }; new Function('require', 'module', 'exports', uiCode)(require, m, m.exports); return m.exports; })();

const act = (fn) => React.act(fn);

function mount(code, { fields, values = {}, onSubmit = () => {}, ...extra }) {
  const exports = {};
  new Function('React', 'UI', 'exports', code)(React, UI, exports);   // same sandbox call as DynamicRenderer
  const Comp = exports.default;
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  const state = { values: { ...values } };
  const draw = () => act(() => root.render(React.createElement(Comp, { ...extra, fields, values: state.values, onChange: (k, v) => { state.values = { ...state.values, [k]: v }; draw(); }, onSubmit })));
  draw();
  const api = {
    el, state,
    text: () => el.textContent,
    button: (label) => [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === label),
    click(label) {
      const b = api.button(label); if (!b) throw new Error(`no button "${label}" in: ${api.text()}`);
      act(() => { b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    },
    type(value) {
      const input = el.querySelector('input,select'); if (!input) throw new Error('no input rendered');
      const proto = input.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
      act(() => { input.dispatchEvent(new window.Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
    },
    blur() {
      const input = el.querySelector('input,select');
      act(() => { input.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })); });
    },
    unmount() { act(() => root.unmount()); el.remove(); },
  };
  return api;
}

module.exports = { mount, UI };
