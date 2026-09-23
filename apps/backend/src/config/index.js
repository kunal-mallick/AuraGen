require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,

  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  ollamaApiKey: process.env.OLLAMA_API_KEY,
  ollamaModel: process.env.OLLAMA_MODEL,
};