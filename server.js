// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Initializes the DB and applies schema.sql on startup (see db/init.js)
require('./db/init');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Interview Agent Pipeline running at http://localhost:${PORT}`);
});
