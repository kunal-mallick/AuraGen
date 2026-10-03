'use client';
import * as UI from './UI';
// Deliberately dense: everything at once, no hints. This is the "before".
export default function StaticForm({ fields, values, onChange, onSubmit }) {
  return (
    <div className="max-w-4xl mx-auto rounded-2xl bg-white p-6 shadow-md">
      <h2 className="text-xl font-semibold mb-4">Loan Application</h2>
      <div className="grid grid-cols-2 gap-4">
        {fields.map((f) => <UI.Field key={f.name} {...f} hint={undefined} value={values[f.name] || ''} onChange={(v) => onChange(f.name, v)} />)}
      </div>
      <div className="mt-6"><UI.Button onClick={onSubmit}>Submit</UI.Button></div>
    </div>
  );
}
