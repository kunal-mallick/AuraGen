const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const healthRoute = require('./api/routes/health.route');
const { port } = require('./config');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/health', healthRoute);

app.get('/', (req, res) => {
  res.json({ message: 'AuraGen backend is running. See /api/health.' });
});

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.listen(port, () => {
  console.log(`AuraGen backend listening on http://localhost:${port}`);
});
