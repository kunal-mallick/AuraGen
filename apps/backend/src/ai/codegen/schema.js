/**
 * STEP 1 - UI SCHEMA   +   STEP 2 - COMPONENT REGISTRY
 *
 * The LLM must output a UISpec: a tree of nodes.
 *
 *   { version: "1.0",
 *     root: { type, id, props, children } }
 *
 * The frontend Dynamic Renderer walks this tree and maps
 * `type` -> React component, passing `props`, rendering `children`.
 */
const { z } = require('zod');

// ---------------------------------------------------------------------------
// STEP 2 - Component registry: the ONLY components the AI may use.
// `props` is a strict zod schema (unknown props are rejected).
// `container` = can this component have children?
// ---------------------------------------------------------------------------
const optionSchema = z.union([
  z.string(),
  z.object({ label: z.string(), value: z.string() }).strict(),
]);

const REGISTRY = {
  Input: {
    container: false,
    props: z
      .object({
        name: z.string().min(1), // field key, used to keep user data
        label: z.string().min(1),
        type: z.enum(['text', 'email', 'number', 'password', 'tel', 'date']).optional(),
        placeholder: z.string().optional(),
        value: z.union([z.string(), z.number()]).optional(),
        helpText: z.string().optional(),
        required: z.boolean().optional(),
      })
      .strict(),
  },
  Select: {
    container: false,
    props: z
      .object({
        name: z.string().min(1),
        label: z.string().min(1),
        options: z.array(optionSchema).min(1),
        value: z.string().optional(),
        helpText: z.string().optional(),
        required: z.boolean().optional(),
      })
      .strict(),
  },
  Radio: {
    container: false,
    props: z
      .object({
        name: z.string().min(1),
        label: z.string().min(1),
        options: z.array(optionSchema).min(1),
        value: z.string().optional(),
        helpText: z.string().optional(),
        required: z.boolean().optional(),
      })
      .strict(),
  },
  Button: {
    container: false,
    props: z
      .object({
        label: z.string().min(1),
        action: z.enum(['submit', 'next', 'back', 'reset']).optional(),
        variant: z.enum(['primary', 'secondary']).optional(),
      })
      .strict(),
  },
  Card: {
    container: true,
    props: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
      })
      .strict(),
  },
  // Wizard: each child MUST be a Card, and each Card is one step.
  Wizard: {
    container: true,
    props: z
      .object({
        title: z.string().optional(),
      })
      .strict(),
  },
};

const COMPONENT_TYPES = Object.keys(REGISTRY);
const FIELD_TYPES = ['Input', 'Select', 'Radio']; // components that hold user data

// ---------------------------------------------------------------------------
// STEP 1 - Node + UISpec schemas (recursive)
// ---------------------------------------------------------------------------
const nodeSchema = z.lazy(() =>
  z
    .object({
      type: z.enum(COMPONENT_TYPES),
      id: z.string().min(1),
      props: z.record(z.any()).default({}),
      children: z.array(nodeSchema).default([]),
    })
    .strict()
    .superRefine((node, ctx) => {
      const entry = REGISTRY[node.type];
      if (!entry) return; // enum error already reported

      // props must match this component's prop schema
      const res = entry.props.safeParse(node.props);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['props', ...issue.path],
            message: `${node.type} '${node.id}': ${issue.message}`,
          });
        }
      }
      // only containers may have children
      if (!entry.container && node.children.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['children'],
          message: `${node.type} '${node.id}' cannot have children`,
        });
      }
      // Wizard children must all be Cards (one per step)
      if (node.type === 'Wizard') {
        if (node.children.length === 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['children'], message: `Wizard '${node.id}' needs at least one step (Card child)` });
        }
        node.children.forEach((c, i) => {
          if (c.type !== 'Card') {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['children', i], message: `Wizard '${node.id}' child must be a Card (got ${c.type})` });
          }
        });
      }
    })
);

const uiSpecSchema = z
  .object({
    version: z.literal('1.0'),
    root: nodeSchema,
  })
  .strict();

// Helpers reused by the validator / context builder in later steps
function walk(node, visit) {
  visit(node);
  (node.children || []).forEach((c) => walk(c, visit));
}

/** Describe the registry in plain JSON for the LLM prompt (Step 4 reuses this). */
function describeRegistry() {
  const out = {};
  for (const [name, entry] of Object.entries(REGISTRY)) {
    out[name] = {
      canHaveChildren: entry.container,
      props: Object.fromEntries(
        Object.entries(entry.props.shape).map(([k, v]) => [k, v.isOptional() ? 'optional' : 'required'])
      ),
    };
  }
  out.Wizard.note = 'children must all be Card; each Card is one step';
  return out;
}

module.exports = {
  REGISTRY,
  COMPONENT_TYPES,
  FIELD_TYPES,
  nodeSchema,
  uiSpecSchema,
  walk,
  describeRegistry,
};
