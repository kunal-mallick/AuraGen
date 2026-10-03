// Deterministic, pre-validated fallback. Also what the app degrades to when the LLM misbehaves.
const HEADLINES = {
  rage: "Let's slow down. One question at a time.",
  hesitation: 'Not sure? Each step has a hint.',
  errors: "Let's fix this together, step by step.",
  thrash: "Here's a simpler path through the form.",
  calm: 'A simpler way to finish this form.',
};
const TEMPLATE = `export default function Wizard({ fields, values, onChange, onSubmit, focusField }) {
  const first = fields.findIndex((f) => !values[f.name]);
  const stuck = fields.findIndex((f) => f.name === focusField);   // the server only sends a focusField that is not validly filled
  const [i, setI] = React.useState(stuck >= 0 ? stuck : first < 0 ? 0 : first);
  const f = fields[i];
  const last = i === fields.length - 1;
  return (
    <UI.Card>
      <UI.ProgressBar value={(i + 1) / fields.length} />
      <UI.Heading>__HEADLINE__</UI.Heading>
      <UI.Text>Step {i + 1} of {fields.length}</UI.Text>
      {f.name === focusField && <UI.Text>This one trips a lot of people up. Take your time.</UI.Text>}
      <UI.Field name={f.name} label={f.label} hint={f.hint} type={f.type} options={f.options} pattern={f.pattern} error={f.error}
        value={values[f.name] || ''} onChange={(v) => onChange(f.name, v)} />
      <div className="flex gap-3 mt-4">
        {i > 0 && <UI.Button variant="ghost" onClick={() => setI(i - 1)}>Back</UI.Button>}
        <UI.Button onClick={() => (last ? onSubmit() : setI(i + 1))}>{last ? 'Submit' : 'Next'}</UI.Button>
      </div>
    </UI.Card>
  );
}`;
module.exports = (kind = 'calm') => TEMPLATE.replace('__HEADLINE__', HEADLINES[kind] || HEADLINES.calm);
