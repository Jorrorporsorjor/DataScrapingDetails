// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// ✅ serve success_keyword.json
app.get('/keywords', (req, res) => {
  const filePath = path.join(__dirname, 'output', 'success_keyword.json');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  res.json(JSON.parse(data));
});

// ✅ endpoint สถานะ
app.get('/status', (req, res) => {
  res.json({ status: 'server running', timestamp: new Date().toISOString() });
});

// ✅ fallback
app.get('/', (req, res) => {
  res.send('✅ Scraper Server Running');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
