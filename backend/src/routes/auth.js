const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});


router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email=? AND is_active=1').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

  // Write to access_logs (not audit_logs)
  db.prepare('INSERT INTO access_logs (user_id, user_name, event, ip_address, user_agent) VALUES (?,?,?,?,?)').run(
    user.id, user.name, 'LOGIN',
    req.ip || req.socket?.remoteAddress || null,
    req.headers['user-agent'] || null
  );

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post('/logout', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('INSERT INTO access_logs (user_id, user_name, event, ip_address, user_agent) VALUES (?,?,?,?,?)').run(
    req.user.id, req.user.name, 'LOGOUT',
    req.ip || req.socket?.remoteAddress || null,
    req.headers['user-agent'] || null
  );
  res.json({ message: 'Logged out' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
