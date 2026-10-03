// Single source of truth: used in the LLM prompt AND the AST validator allowlist.
const UI_COMPONENTS = {
  Card: 'Container. Props: children',
  Heading: 'Title text. Props: children',
  Text: 'Muted paragraph. Props: children',
  Field: 'Labelled input/select. Props: name, label, hint, type, options, pattern, error, value, onChange(value)',
  Button: 'Props: variant("primary"|"ghost"), onClick, children',
  ProgressBar: 'Props: value (0..1)',
};
const HTML_TAGS = new Set(['div', 'span', 'p', 'ul', 'li', 'strong']);
const TAILWIND_HINT = 'Tailwind only, for layout on plain tags: flex, gap-3, mt-4, grid, text-sm, text-slate-600.';

const CONTRACT = `Output ONE module, no imports, no markdown:
export default function Wizard({ fields, values, onChange, onSubmit, focusField }) { ... }
- fields: [{name,label,type,hint?,options?}]  values: {name: string}
- onChange(name, value) updates a value, onSubmit() finishes.
- focusField: name of the field the user struggled with (may be undefined). Start on that field if it is defined, else on the first empty field.
- Always pass name, pattern and error through to UI.Field (name={f.name} pattern={f.pattern} error={f.error}) so validation and telemetry keep working.
- React and UI are in scope as globals. Use hooks as React.useState.
- Use UI.<Component> only from: ${Object.keys(UI_COMPONENTS).join(', ')}.
- Allowed plain tags: ${[...HTML_TAGS].join(', ')}. ${TAILWIND_HINT}
- Never touch window/document/fetch/eval/storage. Pre-fill from "values" so typed data is kept.`;

module.exports = { UI_COMPONENTS, HTML_TAGS, CONTRACT };
