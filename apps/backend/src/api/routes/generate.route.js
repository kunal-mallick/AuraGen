/**
 * POST /api/generate   (Step 10: what the frontend calls)
 *
 * Request body:
 *   { currentUi, userState, cognitiveLoadScore, problematicElement }   (see samples/sample-request.json)
 *
 * Responses:
 *   200 { status:"ok",    ui, attempts, warnings }            -> render `ui` with the Dynamic Renderer
 *   400 { status:"error", message, issues }                   -> bad request body
 *   422 { status:"error", message, errors, fallback }         -> AI failed; keep showing `fallback` (original UI)
 *   502 { status:"error", message }                           -> LLM / network problem
 */
const express = require('express');
const { generateUi } = require('../../ai/codegen/generator');
const { ContextError } = require('../../ai/context/contextBuilder');

function createGenerateRouter({ generate = generateUi } = {}) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const result = await generate(req.body);
      if (result.ok) {
        return res.status(200).json({ status: 'ok', ui: result.spec, attempts: result.attempts.length, warnings: result.warnings });
      }
      return res.status(422).json({
        status: 'error',
        message: 'Could not generate a valid UI',
        errors: result.errors,
        attempts: result.attempts.length,
        fallback: result.fallback,
      });
    } catch (err) {
      if (err instanceof ContextError) {
        return res.status(400).json({ status: 'error', message: 'Invalid request', issues: err.issues });
      }
      console.error('generate error:', err);
      return res.status(502).json({ status: 'error', message: err.message });
    }
  });

  return router;
}

const router = createGenerateRouter();
router.createGenerateRouter = createGenerateRouter;
module.exports = router;
