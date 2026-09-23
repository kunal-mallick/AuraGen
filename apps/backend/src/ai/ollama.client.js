const {
  ollamaBaseUrl,
  ollamaApiKey,
  ollamaModel,
} = require('../config');

/**
 * Ollama Cloud API client
 */

/**
 * Generate a response from Ollama Cloud.
 */
async function generate(
  prompt,
  { model = ollamaModel, stream = false } = {}
) {
  const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ollamaApiKey}`,
    },

    body: JSON.stringify({
      model,
      prompt,
      stream,
    }),
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Ollama /api/generate failed (${response.status}): ${text}`
    );
  }

  const data = await response.json();

  return data.response;
}

/**
 * Chat with Ollama Cloud.
 */
async function chat(
  messages,
  { model = ollamaModel, stream = false } = {}
) {
  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ollamaApiKey}`,
    },

    body: JSON.stringify({
      model,
      messages,
      stream,
    }),
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Ollama /api/chat failed (${response.status}): ${text}`
    );
  }

  const data = await response.json();

  return data.message;
}

module.exports = {
  generate,
  chat,
};