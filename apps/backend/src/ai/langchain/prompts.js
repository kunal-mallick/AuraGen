/**
 * PROMPTS  (Step 5)
 * Loads the prompt text files and builds the message list sent to the LLM.
 *
 * We build plain {role, content} messages instead of LangChain's ChatPromptTemplate
 * because our prompt is full of JSON braces {}, which ChatPromptTemplate treats as
 * template variables and would break. Plain strings avoid that problem entirely,
 * and LangChain models accept {role, content} messages directly.
 */
const fs = require('fs');
const path = require('path');

// repo-root/prompts  (5 levels up from apps/backend/src/ai/langchain)
const PROMPTS_DIR = process.env.PROMPTS_DIR || path.resolve(__dirname, '../../../../../prompts');

let cache = null;
function getTemplates() {
  if (!cache) {
    const read = (f) => fs.readFileSync(path.join(PROMPTS_DIR, f), 'utf8').trim();
    cache = { system: read('system-prompt.txt'), task: read('ui-simplification.txt') };
  }
  return cache;
}

/** First attempt: system rules + task with the context inserted. */
function buildMessages(contextText) {
  const { system, task } = getTemplates();
  return [
    { role: 'system', content: system },
    { role: 'user', content: task.split('{{CONTEXT}}').join(contextText) },
  ];
}

/** Repair attempt (Step 8): show the model its bad output and exactly what was wrong. */
function buildRepairMessages(previousMessages, badOutput, errors) {
  const shown = String(badOutput).slice(0, 6000);
  return [
    ...previousMessages,
    { role: 'assistant', content: shown },
    {
      role: 'user',
      content:
        'Your previous output was rejected for these reasons:\n' +
        errors.map((e) => `- ${e}`).join('\n') +
        '\n\nFix every problem and return the complete corrected UI as a single JSON object. ' +
        'No markdown, no explanation.',
    },
  ];
}

module.exports = { buildMessages, buildRepairMessages, PROMPTS_DIR };
