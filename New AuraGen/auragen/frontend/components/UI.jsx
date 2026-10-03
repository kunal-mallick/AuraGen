// The design system the LLM is allowed to use. Keep in sync with backend/src/designSystem.js
import React from 'react';
export const Card = ({ children }) => <div className="rounded-2xl bg-white p-6 shadow-md space-y-3 max-w-xl mx-auto">{children}</div>;
export const Heading = ({ children }) => <h2 className="text-xl font-semibold">{children}</h2>;
export const Text = ({ children }) => <p className="text-sm text-slate-600">{children}</p>;
export const ProgressBar = ({ value = 0 }) => (
  <div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-indigo-600 transition-all" style={{ width: `${Math.round(value * 100)}%` }} /></div>
);
export const Button = ({ variant = 'primary', onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`rounded-lg px-4 py-2 text-sm font-medium ${variant === 'ghost' ? 'text-slate-600 hover:bg-slate-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{children}</button>
);
export const Field = ({ name, label, hint, type = 'text', options, pattern, error, value, onChange }) => {
  const [touched, setTouched] = React.useState(value !== '' && value != null);   // a field that mounts already holding a value shows its error straight away
  const bad = touched && value !== '' && pattern && !new RegExp(pattern).test(String(value));
  // Fire the native "invalid" event on blur so the telemetry engine counts a real validation error.
  const onBlur = (e) => { setTouched(true); if (value !== '' && pattern && !new RegExp(pattern).test(String(value))) e.target.dispatchEvent(new (e.target.ownerDocument.defaultView.Event)('invalid')); };
  const cls = `w-full rounded-lg border p-2 ${bad ? 'border-red-500' : ''}`;
  return (
    <label className="block space-y-1" data-field={name}>
      <span className="text-sm font-medium">{label}</span>
      {options ? (
        <select className={cls} value={value} onBlur={onBlur} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>{options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : <input className={cls} type={type} value={value} aria-invalid={bad ? 'true' : undefined} onBlur={onBlur} onChange={(e) => onChange(e.target.value)} />}
      {bad ? <span className="block text-xs text-red-600">{error || 'Please check this value'}</span>
        : hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
};
