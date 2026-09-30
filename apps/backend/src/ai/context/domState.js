/**
 * DOM / UI STATE  (Step 3)
 * Looks at the user's current UI (a UISpec) and extracts facts the agent needs:
 * what fields exist, how deep it is, and which element is the problem.
 */
const { FIELD_TYPES, walk } = require('../codegen/schema');

function depthOf(node) {
  if (!node.children || node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(depthOf));
}

/** Collect every data-holding field in a UI tree. */
function collectFields(root) {
  const fields = [];
  walk(root, (n) => {
    if (FIELD_TYPES.includes(n.type)) {
      fields.push({
        id: n.id,
        type: n.type,
        name: n.props.name,
        label: n.props.label,
        inputType: n.props.type, // e.g. "password"
        optionCount: Array.isArray(n.props.options) ? n.props.options.length : undefined,
      });
    }
  });
  return fields;
}

/** Facts + simple rule-based hints about how to simplify. */
function analyzeUi(currentUi) {
  const root = currentUi.root;
  const fields = collectFields(root);
  let hasWizard = false;
  walk(root, (n) => { if (n.type === 'Wizard') hasWizard = true; });

  const hints = [];
  for (const f of fields) {
    if (f.type === 'Select' && f.optionCount <= 5) {
      hints.push(`Select '${f.id}' has only ${f.optionCount} options: convert it to a Radio.`);
    }
  }
  if (!hasWizard && fields.length > 4) {
    hints.push(`The UI has ${fields.length} fields on one screen: split it into a Wizard with at most 4 fields per step.`);
  }
  if (hints.length === 0) hints.push('Simplify labels and group related fields into Cards.');

  return {
    analysis: { fieldCount: fields.length, depth: depthOf(root), hasWizard, fieldNames: fields.map((f) => f.name) },
    fields,
    hints,
  };
}

/** Attach the actual node for the problematic element so the LLM sees it. */
function resolveProblematicElement(raw, currentUi) {
  if (!raw) return null;
  const id = typeof raw === 'string' ? raw : raw.id;
  const reason = typeof raw === 'string' ? undefined : raw.reason;
  let found = null;
  walk(currentUi.root, (n) => { if (n.id === id) found = n; });
  return { id, reason, found: Boolean(found), node: found };
}

module.exports = { collectFields, analyzeUi, resolveProblematicElement };
