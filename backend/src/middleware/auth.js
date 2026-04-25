const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = getDb().prepare('SELECT id,name,email,role,is_active FROM users WHERE id=?').get(payload.userId);
    if (!user || !user.is_active) return res.status(401).json({ error: 'User not found or inactive' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { requireAuth };
