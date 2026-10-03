// Allowlist-based AST validator: we prove what the code CAN reference, not hunt for bad strings.
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { UI_COMPONENTS, HTML_TAGS } = require('./designSystem');

const ALLOWED_GLOBALS = new Set(['React', 'UI', 'Math', 'Number', 'String', 'Boolean', 'Array', 'JSON', 'undefined', 'NaN', 'Infinity']);
const BANNED_PROPS = new Set(['constructor', '__proto__', 'prototype', '__defineGetter__', '__lookupGetter__']);
const MAX_BYTES = 8000;

function validate(code) {
  const errors = [];
  if (Buffer.byteLength(code) > MAX_BYTES) return { ok: false, errors: [`code exceeds ${MAX_BYTES} bytes`] };
  let ast;
  try { ast = parse(code, { sourceType: 'module', plugins: ['jsx'] }); }
  catch (e) { return { ok: false, errors: [`Syntax error: ${e.message}`] }; }

  let defaults = 0;
  traverse(ast, {
    ImportDeclaration() { errors.push('imports are forbidden (use the UI registry)'); },
    ExportNamedDeclaration() { errors.push('only a default export is allowed'); },
    ExportAllDeclaration() { errors.push('export * is forbidden'); },
    ExportDefaultDeclaration(p) {
      defaults++;
      if (!['FunctionDeclaration', 'ArrowFunctionExpression', 'FunctionExpression'].includes(p.node.declaration.type))
        errors.push('default export must be a function component');
    },
    Identifier(p) {
      if (!p.isReferencedIdentifier()) return;
      const n = p.node.name;
      if (!p.scope.getBinding(n) && !ALLOWED_GLOBALS.has(n)) errors.push(`forbidden global: ${n}`);
    },
    MemberExpression(p) { checkMember(p.node, errors); },
    OptionalMemberExpression(p) { checkMember(p.node, errors); },
    JSXOpeningElement(p) {
      const name = p.node.name;
      if (name.type === 'JSXMemberExpression') {
        if (name.object.name !== 'UI' || !(name.property.name in UI_COMPONENTS))
          errors.push(`unknown component: ${name.object.name}.${name.property.name}`);
      } else if (name.type === 'JSXIdentifier') {
        const n = name.name;
        const isHtml = n[0] === n[0].toLowerCase();
        if (isHtml && !HTML_TAGS.has(n)) errors.push(`forbidden tag: <${n}>`);
        if (!isHtml && !p.scope.getBinding(n)) errors.push(`unknown component: <${n}>`);
      } else errors.push('namespaced JSX tags are forbidden');
    },
    JSXAttribute(p) {
      const n = p.node.name.name;
      if (n === 'dangerouslySetInnerHTML' || n === 'srcDoc') errors.push(`forbidden attribute: ${n}`);
    },
  });
  if (defaults !== 1) errors.push(`expected exactly 1 default export, found ${defaults}`);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function checkMember(node, errors) {
  const prop = node.property;
  if (!node.computed && BANNED_PROPS.has(prop.name)) errors.push(`forbidden property: ${prop.name}`);
  if (node.computed) {
    if (prop.type === 'StringLiteral' && BANNED_PROPS.has(prop.value)) errors.push(`forbidden property: ${prop.value}`);
    if (prop.type === 'BinaryExpression' || prop.type === 'TemplateLiteral') errors.push('computed string-built property access is forbidden');
  }
}

module.exports = { validate };
