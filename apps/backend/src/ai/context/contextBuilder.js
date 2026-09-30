/**
 * CONTEXT BUILDER  (Step 4)
 * raw request  ->  validated + cleaned context  ->  compact text for the LLM.
 */
const { z } = require('zod');
const { uiSpecSchema, describeRegistry } = require('../codegen/schema');
const { analyzeUi, resolveProblematicElement } = require('./domState');
const { cognitiveLoadLevel, normalizeUserState } = require('./userState');

// What the API / frontend sends us (Step 3: the agent's inputs)
const rawContextSchema = z
  .object({
    currentUi: uiSpecSchema, // the UI the user is struggling with
    userState: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    cognitiveLoadScore: z.number().min(0).max(1),
    problematicElement: z
      .union([z.string(), z.object({ id: z.string(), reason: z.string().optional() })])
      .optional(),
  })
  .strict();

class ContextError extends Error {
  constructor(issues) {
    super(`Invalid agent context:\n- ${issues.join('\n- ')}`);
    this.name = 'ContextError';
    this.issues = issues;
  }
}

function buildContext(raw) {
  const parsed = rawContextSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ContextError(parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  }
  const { currentUi, userState, cognitiveLoadScore, problematicElement } = parsed.data;

  const { analysis, hints } = analyzeUi(currentUi);
  const user = normalizeUserState(userState, currentUi);
  const problem = resolveProblematicElement(problematicElement, currentUi);

  const context = {
    cognitiveLoad: { score: cognitiveLoadScore, level: cognitiveLoadLevel(cognitiveLoadScore) },
    problematicElement: problem,
    currentUi,
    userValues: user.userValues,
    sensitiveFields: user.sensitiveFields, // values withheld; must keep these fields
    analysis,
    hints,
    availableComponents: describeRegistry(),
  };

  return {
    context, // object (used by tests, logging, validator in Step 7)
    text: JSON.stringify(context, null, 2), // string for the prompt (Step 5)
    warnings: [
      ...(user.ignoredKeys.length ? [`Ignored userState keys not in UI: ${user.ignoredKeys.join(', ')}`] : []),
      ...(problem && !problem.found ? [`problematicElement '${problem.id}' not found in currentUi`] : []),
    ],
  };
}

module.exports = { buildContext, ContextError, rawContextSchema };
