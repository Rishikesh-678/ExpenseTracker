require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getDb, initDb } = require('./db/database');

// Fail fast if JWT_SECRET is missing or too short
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ FATAL: JWT_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}

// Initialize database
initDb();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Authenticated file download — replaces static /uploads serving
app.get('/uploads/:filename', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const user = getDb().prepare('SELECT id,role FROM users WHERE id=? AND is_active=1').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const expense = getDb().prepare('SELECT user_id FROM expenses WHERE file_path=?').get(req.params.filename);
    if (!expense) return res.status(404).json({ error: 'File not found' });
    if (user.role !== 'admin' && expense.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
    const filePath = path.join(__dirname, '../uploads', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});


app.use('/api/auth', require('./routes/auth'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/budget', require('./routes/budget'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/reports', require('./routes/reports'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`🚀 NetOps API running on http://localhost:${PORT}`));
