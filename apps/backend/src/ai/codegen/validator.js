/**
 * VALIDATOR  (Step 7)
 * Takes the raw text from the LLM and decides: is this UI safe and correct?
 *
 *   1. valid JSON?
 *   2. matches our schema? (allowed components, allowed props, Wizard rules)
 *   3. keeps the user's data? (every field exactly once, same id/type/options,
 *      no new fields), unique ids, Wizard steps <= 4 fields, last step has Submit
 *
 * Also has finalizeSpec(): after validation the BACKEND (not the LLM) puts the
 * user's saved values back into the fields.
 */
const { uiSpecSchema, walk, FIELD_TYPES } = require('./schema');
const { parseJsonOutput } = require('../langchain/chain');

const MAX_FIELDS_PER_STEP = 4;
const MAX_ERRORS = 12;

const fail = (errors) => ({ ok: false, spec: null, errors: errors.slice(0, MAX_ERRORS) });
const formatIssue = (i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message);
const optionValues = (opts) => (opts || []).map((o) => (typeof o === 'string' ? o : o.value));

/** The LLM must not set field values (we re-inject them). Remove silently, no retry needed. */
function stripValues(node) {
  if (!node || typeof node !== 'object') return;
  if (FIELD_TYPES.includes(node.type) && node.props && typeof node.props === 'object') delete node.props.value;
  if (Array.isArray(node.children)) node.children.forEach(stripValues);
}

function semanticErrors(spec, context) {
  const errors = [];

  // original fields, by name
  const original = new Map();
  walk(context.currentUi.root, (n) => {
    if (FIELD_TYPES.includes(n.type) && !original.has(n.props.name)) original.set(n.props.name, n);
  });

  // generated fields + duplicate ids
  const seenIds = new Set();
  const dupIds = new Set();
  const generated = new Map(); // name -> [nodes]
  walk(spec.root, (n) => {
    if (seenIds.has(n.id)) dupIds.add(n.id);
    seenIds.add(n.id);
    if (FIELD_TYPES.includes(n.type)) {
      const list = generated.get(n.props.name) || [];
      list.push(n);
      generated.set(n.props.name, list);
    }
  });
  dupIds.forEach((id) => errors.push(`Duplicate id '${id}': every id must be unique`));

  for (const [name, o] of original) {
    const list = generated.get(name) || [];
    if (list.length === 0) {
      errors.push(`Missing field '${name}' (original id '${o.id}'): every original field must be kept`);
      continue;
    }
    if (list.length > 1) errors.push(`Field '${name}' appears ${list.length} times: it must appear exactly once`);
    const n = list[0];
    if (n.id !== o.id) errors.push(`Field '${name}' must keep its original id '${o.id}' (got '${n.id}')`);

    if (o.type === 'Input') {
      if (n.type !== 'Input') errors.push(`Field '${name}' must stay an Input (got ${n.type})`);
      else if (n.props.type !== o.props.type) errors.push(`Field '${name}' must keep input type '${o.props.type}' (got '${n.props.type}')`);
    } else {
      // Select <-> Radio is allowed; Input is not
      if (n.type === 'Input') errors.push(`Field '${name}' was a ${o.type} and cannot become an Input`);
      else if (JSON.stringify(n.props.options) !== JSON.stringify(o.props.options)) {
        errors.push(`Field '${name}' must keep the same options in the same order`);
      }
    }
  }
  for (const name of generated.keys()) {
    if (!original.has(name)) errors.push(`Unknown field '${name}': do not add new fields`);
  }

  // Wizard rules
  walk(spec.root, (w) => {
    if (w.type !== 'Wizard') return;
    w.children.forEach((card) => {
      let count = 0;
      walk(card, (n) => { if (FIELD_TYPES.includes(n.type)) count += 1; });
      if (count > MAX_FIELDS_PER_STEP) errors.push(`Wizard step '${card.id}' has ${count} fields (max ${MAX_FIELDS_PER_STEP})`);
    });
    const last = w.children[w.children.length - 1];
    let hasSubmit = false;
    if (last) walk(last, (n) => { if (n.type === 'Button' && n.props.action === 'submit') hasSubmit = true; });
    if (!hasSubmit) errors.push(`The last step of Wizard '${w.id}' needs a Button with action "submit"`);
  });

  return errors;
}

/** raw LLM text + context -> { ok, spec, errors } */
function validateGenerated(raw, context) {
  const parsed = parseJsonOutput(raw);
  if (!parsed.ok) return fail([`${parsed.error}. Reply with ONLY one JSON object.`]);

  const data = parsed.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return fail(['The top level must be a JSON object with "version" and "root".']);
  }
  stripValues(data.root);

  const res = uiSpecSchema.safeParse(data);
  if (!res.success) return fail(res.error.issues.map(formatIssue));

  const errors = semanticErrors(res.data, context);
  return errors.length ? fail(errors) : { ok: true, spec: res.data, errors: [] };
}

/** Put the user's saved values back into the fields (backend does this, not the LLM). */
function finalizeSpec(spec, context) {
  const out = JSON.parse(JSON.stringify(spec));
  walk(out.root, (n) => {
    if (!FIELD_TYPES.includes(n.type)) return;
    const name = n.props.name;
    if (!Object.prototype.hasOwnProperty.call(context.userValues, name)) return;
    const v = context.userValues[name];
    const isText = typeof v === 'string' || typeof v === 'number';
    if (n.type === 'Input') {
      if (isText) n.props.value = v;
    } else if (isText && optionValues(n.props.options).includes(String(v))) {
      n.props.value = String(v);
    }
  });
  const check = uiSpecSchema.safeParse(out);
  if (!check.success) throw new Error('Internal error: final UI failed the schema after restoring user values');
  return check.data;
}

module.exports = { validateGenerated, finalizeSpec, MAX_FIELDS_PER_STEP };
