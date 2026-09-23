const express = require('express');
const ollama = require('../../ai/ollama.client');

const router = express.Router();

/**
 * POST /api/ai/generate
 * Body:
 * {
 *   "prompt": "Say hello"
 * }
 */
router.post('/generate', async (req, res) => {
  const { prompt, model } = req.body;

  if (!prompt) {
    return res.status(400).json({
      status: 'error',
      message: 'prompt is required',
    });
  }

  try {
    const output = await ollama.generate(prompt, { model });

    res.status(200).json({
      status: 'ok',
      output,
    });
  } catch (err) {
    console.error('Ollama generate error:', err);

    res.status(502).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * POST /api/ai/chat
 * Body:
 * {
 *   "messages": [
 *     {
 *       "role": "user",
 *       "content": "Hello"
 *     }
 *   ]
 * }
 */
router.post('/chat', async (req, res) => {
  const { messages, model } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'messages array is required',
    });
  }

  try {
    const reply = await ollama.chat(messages, { model });

    res.status(200).json({
      status: 'ok',
      reply,
    });
  } catch (err) {
    console.error('Ollama chat error:', err);

    res.status(502).json({
      status: 'error',
      message: err.message,
    });
  }
});

module.exports = router;