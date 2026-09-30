/**
 * LIVE test of the whole pipeline against your real LLM:
 *   context -> prompt -> LLM -> validate -> (repair loop) -> new UI
 *
 * Run from apps/backend:   node scripts/try-generate.js
 * Needs OLLAMA_BASE_URL, OLLAMA_API_KEY, OLLAMA_MODEL in apps/backend/.env
 */
const { generateUi } = require('../src/ai/codegen/generator');
const sample = require('../src/ai/codegen/samples/sample-request.json');

(async () => {
  console.log('Calling the LLM (this can take a while)...\n');
  const result = await generateUi(sample);

  result.attempts.forEach((a) => {
    console.log(`Attempt ${a.attempt}: ${a.ok ? 'VALID' : 'REJECTED'}`);
    a.errors.forEach((e) => console.log(`   - ${e}`));
  });

  if (result.ok) {
    console.log('\nSUCCESS. New UI spec:\n');
    console.log(JSON.stringify(result.spec, null, 2));
  } else {
    console.log('\nFAILED after all attempts. The frontend would keep the original UI (fallback).');
  }
})().catch((e) => console.error('\nERROR:', e.message));
