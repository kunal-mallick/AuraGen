// Shared test data (not a test file itself)
const { RunnableLambda } = require('@langchain/core/runnables');

const clone = (o) => JSON.parse(JSON.stringify(o));
const field = (type, name, props = {}) => ({ type, id: `f-${name}`, props: { name, label: name, ...props }, children: [] });
const btn = (id, label, action, variant) => ({ type: 'Button', id, props: { label, action, ...(variant ? { variant } : {}) }, children: [] });
const card = (id, title, children) => ({ type: 'Card', id, props: { title }, children });

const EMPLOYMENT = ['Salaried', 'Self-employed', 'Student'];

// The user's current, overloaded form: 7 fields on one screen
const currentUi = () => ({
  version: '1.0',
  root: card('root', 'Loan application', [
    field('Input', 'fullName', { label: 'Full name' }),
    field('Input', 'email', { label: 'Email', type: 'email' }),
    field('Select', 'employment', { label: 'Employment', options: EMPLOYMENT }),
    field('Input', 'income', { label: 'Monthly income', type: 'number' }),
    field('Input', 'phone', { label: 'Phone', type: 'tel' }),
    field('Input', 'city', { label: 'City' }),
    field('Input', 'pin', { label: 'PIN', type: 'password' }),
  ]),
});

// A full request body as the frontend would send it
const raw = () => ({
  currentUi: currentUi(),
  userState: { fullName: 'Asha Rao', email: 'asha@example.com', employment: 'Student', income: 42000, pin: '1234' },
  cognitiveLoadScore: 0.85,
  problematicElement: 'f-employment',
});

// What a GOOD model answer looks like for the form above
const goodSpec = () => ({
  version: '1.0',
  root: {
    type: 'Wizard', id: 'wizard-1', props: { title: 'Loan application' },
    children: [
      card('step-1', 'About you', [
        field('Input', 'fullName', { label: 'Full name' }),
        field('Input', 'email', { label: 'Email', type: 'email' }),
        btn('b-next-1', 'Next', 'next'),
      ]),
      card('step-2', 'Work and income', [
        field('Radio', 'employment', { label: 'Employment', options: EMPLOYMENT }),
        field('Input', 'income', { label: 'Monthly income', type: 'number' }),
        btn('b-back-2', 'Back', 'back', 'secondary'),
        btn('b-next-2', 'Next', 'next'),
      ]),
      card('step-3', 'Contact and security', [
        field('Input', 'phone', { label: 'Phone', type: 'tel' }),
        field('Input', 'city', { label: 'City' }),
        field('Input', 'pin', { label: 'PIN', type: 'password' }),
        btn('b-back-3', 'Back', 'back', 'secondary'),
        btn('b-submit', 'Submit', 'submit'),
      ]),
    ],
  },
});

/** Fake LLM: returns the queued responses in order (string, object, or Error to throw). Records calls. */
function fakeLlm(...responses) {
  const calls = [];
  const llm = RunnableLambda.from(async (messages) => {
    calls.push(messages);
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (next instanceof Error) throw next;
    return typeof next === 'string' ? next : JSON.stringify(next);
  });
  llm.calls = calls;
  return llm;
}

module.exports = { clone, field, btn, card, currentUi, raw, goodSpec, fakeLlm, EMPLOYMENT };
